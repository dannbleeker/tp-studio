import { createDocument, createEdge, createEntity } from './factory';
import { isEntityType } from './guards';
import type { DiagramType, Edge, EdgeId, Entity, EntityId, EntityType, TPDocument } from './types';

/**
 * Mermaid `graph` importer (N3 — Session 64). Parses the subset of Mermaid
 * flowchart syntax our exporter emits (`exportToMermaid` from Block D /
 * Session 51), so a round-trip via clipboard or `.mmd` files works.
 *
 * Supported subset:
 *   - Optional `--- … ---` frontmatter block; `title: …` line picked up.
 *   - `graph BT|TB|LR|RL|TD` directive (direction parsed into `LayoutConfig`).
 *   - Node declarations: `id["label"]`, `id[label]`, `id("rounded")`, `id{diamond}`.
 *     Labels may carry `<br/>` line breaks (rendered as `\n`) and `&quot;`
 *     escape sequences for double-quotes — both inverted on parse.
 *   - Edges: `a --> b` (plain) and `a ==> b` (thick → AND-grouped).
 *     Inline labels via `a -->|"text"| b` or `a -->|text| b`.
 *   - `class id type_foo` lines map nodes to their `EntityType` — same naming
 *     convention `exportToMermaid` uses (`classDef type_<type>`).
 *   - `classDef …` style blocks are tolerated and skipped.
 *   - `subgraph` / `end` blocks aren't a model we round-trip; their content
 *     is parsed for nodes + edges but the grouping is dropped.
 *
 * Not supported: chained edges (`a --> b --> c` on one line), broadcast
 * (`a --> b & c`), node shapes that aren't square/round/diamond, edge
 * arrowheads like `-.->`. The exporter never emits these, so a round-trip
 * still works.
 */

const NODE_DECL_RE = /^(\w+)\s*(\[[^\]]*\]|\([^)]*\)|\{[^}]*\})$/;
// Edge line: `id1 -->|label| id2` or `id1 ==> id2` etc. Captures source,
// arrow kind, optional label, target.
const EDGE_RE = /^(\w+)\s*(-->|==>)\s*(?:\|([^|]*)\|\s*)?(\w+)$/;
const CLASS_DECL_RE = /^class\s+([\w,\s]+)\s+type_(\w+);?$/;
const FRONTMATTER_TITLE_RE = /^title:\s*(.+)$/;

/** Strip Mermaid quote/bracket wrappers + decode our exporter's escapes. */
const decodeLabel = (raw: string): string => {
  let s = raw.trim();
  // Strip outer brackets/parens/braces.
  if (
    (s.startsWith('[') && s.endsWith(']')) ||
    (s.startsWith('(') && s.endsWith(')')) ||
    (s.startsWith('{') && s.endsWith('}'))
  ) {
    s = s.slice(1, -1).trim();
  }
  // Strip outer quotes if present.
  if (s.startsWith('"') && s.endsWith('"')) {
    s = s.slice(1, -1);
  }
  // Decode escapes our exporter applies: `<br/>` → newline, `&quot;` → `"`.
  s = s.replace(/<br\s*\/?\s*>/g, '\n').replace(/&quot;/g, '"');
  return s;
};

/**
 * Some node labels carry our exporter's "#N TypeName" preamble — strip it
 * so reimports don't keep stacking type prefixes onto the title. The
 * preamble looks like `#3 Undesirable Effect\nReal title here`; the
 * decoded label has a newline between the preamble and the real title.
 */
const stripExporterPreamble = (label: string): string => {
  const firstNewline = label.indexOf('\n');
  if (firstNewline === -1) return label;
  const first = label.slice(0, firstNewline);
  if (/^#\d+\s+\S/.test(first)) {
    return label.slice(firstNewline + 1).trim();
  }
  return label;
};

type ParsedNode = { id: string; label: string };
type ParsedEdge = { source: string; target: string; label?: string; isAnd: boolean };

const parseMermaid = (
  raw: string
): {
  title?: string;
  direction?: 'BT' | 'TB' | 'LR' | 'RL';
  nodes: Map<string, ParsedNode>;
  nodeTypes: Map<string, EntityType>;
  edges: ParsedEdge[];
} => {
  const lines = raw.split(/\r?\n/);
  const nodes = new Map<string, ParsedNode>();
  const nodeTypes = new Map<string, EntityType>();
  const edges: ParsedEdge[] = [];
  let title: string | undefined;
  let direction: 'BT' | 'TB' | 'LR' | 'RL' | undefined;

  // Frontmatter handling — strip the leading `--- … ---` block and pull
  // out the title if any.
  let i = 0;
  if (lines[0]?.trim() === '---') {
    i = 1;
    while (i < lines.length && lines[i]?.trim() !== '---') {
      const m = lines[i]?.trim().match(FRONTMATTER_TITLE_RE);
      if (m?.[1]) title = m[1].trim();
      i++;
    }
    if (lines[i]?.trim() === '---') i++; // skip the closing fence
  }

  for (; i < lines.length; i++) {
    const line = lines[i]?.trim() ?? '';
    if (!line || line.startsWith('%%')) continue; // comment / blank

    // `graph BT` directive.
    const graphMatch = line.match(/^graph\s+(BT|TB|LR|RL|TD)\s*$/);
    if (graphMatch) {
      const d = graphMatch[1];
      // TD is a Mermaid synonym for TB.
      direction = d === 'TD' ? 'TB' : (d as 'BT' | 'TB' | 'LR' | 'RL');
      continue;
    }

    // `classDef …` lines are stylesheet noise on import — drop.
    if (line.startsWith('classDef ')) continue;

    // `class id type_foo;` — entity-type mapping.
    const classMatch = line.match(CLASS_DECL_RE);
    if (classMatch) {
      const idList = classMatch[1] ?? '';
      const typeName = classMatch[2] ?? '';
      if (isEntityType(typeName)) {
        for (const id of idList.split(/[,\s]+/).filter(Boolean)) {
          nodeTypes.set(id, typeName);
        }
      }
      continue;
    }

    // `subgraph` / `end` markers — tolerated, no group reconstruction.
    if (line.startsWith('subgraph ') || line === 'end') continue;

    // Edge.
    const edgeMatch = line.match(EDGE_RE);
    if (edgeMatch) {
      const [, src, arrow, label, tgt] = edgeMatch;
      if (src && tgt) {
        edges.push({
          source: src,
          target: tgt,
          ...(label ? { label: decodeLabel(label) } : {}),
          isAnd: arrow === '==>',
        });
        // Make sure both endpoints are tracked as nodes even if no
        // explicit declaration was seen for them.
        if (!nodes.has(src)) nodes.set(src, { id: src, label: src });
        if (!nodes.has(tgt)) nodes.set(tgt, { id: tgt, label: tgt });
      }
      continue;
    }

    // Node declaration: `id["label"]` and friends. Last branch in the
    // chain — no `continue;` needed, the for-loop iterates to the next
    // line on its own.
    const nodeMatch = line.match(NODE_DECL_RE);
    if (nodeMatch) {
      const [, id, bracketed] = nodeMatch;
      if (id && bracketed) {
        nodes.set(id, { id, label: stripExporterPreamble(decodeLabel(bracketed)) });
      }
    }

    // Unknown lines are quietly skipped. Easier on the user than a thrown
    // error when somebody hand-edits the file.
  }

  return { title, direction, nodes, nodeTypes, edges };
};

/**
 * Parse a Mermaid `graph` document into a fresh `TPDocument`. Diagram
 * type defaults to `'crt'` (the most common starting point); the user
 * can convert via "New Current Reality Tree" or other palette actions
 * after import. Direction is threaded into `layoutConfig.direction` so
 * the imported geometry matches the source's reading.
 *
 * Throws `Error` only for unrecoverable issues (no `graph` directive,
 * no nodes). Smaller malformations (unknown lines, unknown class names)
 * are tolerated.
 */
export const importFromMermaid = (raw: string, diagramType: DiagramType = 'crt'): TPDocument => {
  const parsed = parseMermaid(raw);
  if (parsed.nodes.size === 0) {
    throw new Error('Mermaid import: no nodes found. Is this a valid `graph` document?');
  }

  const base = createDocument(diagramType);
  if (parsed.title) base.title = parsed.title;
  if (parsed.direction) {
    base.layoutConfig = { ...(base.layoutConfig ?? {}), direction: parsed.direction };
  }

  // Build entities (one per node id) and remember the Mermaid-id → tp-id mapping.
  const idMap = new Map<string, EntityId>();
  let nextAnnotation = base.nextAnnotationNumber;
  const entities: Entity[] = [];
  // Sort node ids so the resulting annotation numbers are stable across
  // parser passes — useful for snapshot-style tests.
  const sortedIds = Array.from(parsed.nodes.keys()).sort();
  for (const mid of sortedIds) {
    const decl = parsed.nodes.get(mid);
    if (!decl) continue;
    const type = parsed.nodeTypes.get(mid) ?? 'effect';
    const entity = createEntity({
      type,
      title: decl.label.trim() || 'Untitled',
      annotationNumber: nextAnnotation++,
    });
    idMap.set(mid, entity.id);
    entities.push(entity);
  }

  // Build edges. Group `==>` edges by target so they share an andGroupId.
  const edges: Edge[] = [];
  const andGroupByTarget = new Map<string, string>();
  for (const e of parsed.edges) {
    const sId = idMap.get(e.source);
    const tId = idMap.get(e.target);
    if (!sId || !tId) continue;
    let andGroupId: string | undefined;
    if (e.isAnd) {
      const existing = andGroupByTarget.get(e.target);
      andGroupId = existing ?? `and_mermaid_${e.target}`;
      if (!existing) andGroupByTarget.set(e.target, andGroupId);
    }
    const created = createEdge({
      sourceId: sId,
      targetId: tId,
      ...(andGroupId ? { andGroupId } : {}),
    });
    const final: Edge = {
      ...created,
      id: created.id as EdgeId,
      ...(e.label?.trim() ? { label: e.label.trim() } : {}),
    };
    edges.push(final);
  }

  return {
    ...base,
    entities: Object.fromEntries(entities.map((e) => [e.id, e])),
    edges: Object.fromEntries(edges.map((e) => [e.id, e])),
    nextAnnotationNumber: nextAnnotation,
  };
};
