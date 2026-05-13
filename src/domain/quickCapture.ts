/**
 * Pure parser for the Quick Capture feature (FL-QC1).
 *
 * Input: arbitrary text the user pasted or typed. Each non-empty line
 * becomes an entity-to-be; indentation establishes parent / child links.
 *
 * Output: a forest of nodes. `roots` are the top-level (zero-indent) lines.
 * The caller assigns canonical ids when materializing into the document.
 *
 * Conventions (matches PRD 3.1 + X-Capture-2/3):
 *   - One indent step = 2 spaces or 1 tab. Indents must be multiples of that.
 *   - Leading list markers are stripped: `-`, `*`, `•`, `1.`, `1)`, `>`.
 *   - A single leading emoji or symbol followed by whitespace is stripped.
 *   - Blank lines and lines that are only a list marker are ignored.
 *   - If a child's indent skips levels (e.g. parent at 0 then child at 4),
 *     the parser snaps it to one level deeper than its nearest available
 *     ancestor; we never throw on malformed indentation.
 */

export type CaptureNode = {
  title: string;
  children: CaptureNode[];
};

const INDENT_STEP_SPACES = 2;

/**
 * Strip leading list markers and (a single) emoji prefix. Pure regex —
 * deliberately conservative. The full Unicode "emoji" code-point class is
 * not portable across runtimes, so we approximate with the Emoji_Presentation
 * range used by common bullet symbols (e.g. ✅ 🔥 ⭐).
 */
const stripPrefix = (raw: string): string => {
  let s = raw;
  // List markers, in priority order. Trailing whitespace OR end-of-string
  // both count, so a lone "-" line becomes empty and is filtered out by the
  // parser.
  s = s.replace(/^([-*•>]|[0-9]+[.)])(?:\s+|$)/, '');
  // Single emoji + space — Emoji_Presentation rough range.
  s = s.replace(/^(?:[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{1F000}-\u{1F2FF}])\s+/u, '');
  return s.trim();
};

const measureIndent = (line: string): number => {
  let count = 0;
  for (const ch of line) {
    if (ch === ' ') count += 1;
    else if (ch === '\t') count += INDENT_STEP_SPACES;
    else break;
  }
  return Math.floor(count / INDENT_STEP_SPACES);
};

export type ParseResult = {
  roots: CaptureNode[];
  /** Total number of nodes across the forest. */
  total: number;
};

export const parseQuickCapture = (text: string): ParseResult => {
  const lines = text.split(/\r?\n/);

  type Frame = { node: CaptureNode; indent: number };
  const roots: CaptureNode[] = [];
  const stack: Frame[] = [];
  let total = 0;

  for (const raw of lines) {
    const indent = measureIndent(raw);
    const stripped = stripPrefix(raw);
    if (!stripped) continue;
    const node: CaptureNode = { title: stripped, children: [] };
    total += 1;

    // Pop frames that are at or below this line's indent — they aren't a
    // viable parent. After this, stack.top is the closest deeper ancestor.
    while (stack.length && (stack[stack.length - 1]?.indent ?? -1) >= indent) {
      stack.pop();
    }

    const parent = stack[stack.length - 1];
    if (parent) parent.node.children.push(node);
    else roots.push(node);

    stack.push({ node, indent });
  }

  return { roots, total };
};

/**
 * Walk the forest in pre-order with parent linkage.
 * Helper for the apply step (caller mints ids and threads them in).
 */
export const flattenPreorder = (
  roots: CaptureNode[]
): { node: CaptureNode; parent: CaptureNode | null }[] => {
  const out: { node: CaptureNode; parent: CaptureNode | null }[] = [];
  const walk = (n: CaptureNode, parent: CaptureNode | null): void => {
    out.push({ node: n, parent });
    for (const c of n.children) walk(c, n);
  };
  for (const r of roots) walk(r, null);
  return out;
};
