/**
 * Session 134 — "Paste from whiteboard" import (closes the Miro / Mural
 * gap from the spec gap analysis).
 *
 * Miro and Mural don't export connector structure reliably in any
 * client-accessible format (their CSV exports cover sticky text but
 * not arrows; their JSON backup format is proprietary; round-tripping
 * needs OAuth + their REST APIs, which a browser-local PWA can't
 * shoulder without a backend). The practical escape hatch is the
 * universal one: select stickies on the source board, copy, paste.
 * The clipboard text is invariably newline-separated sticky content,
 * which is all this importer needs.
 *
 * It also incidentally works for any other text-based brainstorm
 * dump — FigJam, Lucidspark, a bulleted Word/Notion list, a meeting
 * transcript with one statement per line, even chat output. The
 * parser is bullet-aware (strips `- `, `* `, `• `, `1.`, `1)` etc.)
 * so users don't have to clean the paste before importing.
 *
 * Connectors are *not* inferred — the user wires up causality after
 * import. This is a tradeoff documented in the dialog UI: this path
 * gets you the entities; logic comes from the user.
 */
import type { EntityType } from '@/domain/types';
import { useDocumentStore } from '@/store';

/**
 * Strip leading bullet glyphs and ordered-list markers. Mirrors the
 * shapes Miro / Mural copy-paste produces and the common Markdown
 * conventions a user might dump in from a notes app.
 *
 * Examples (the captured group is the statement to keep):
 *   "- Stale stand-ups"         → "Stale stand-ups"
 *   "* Stale stand-ups"         → "Stale stand-ups"
 *   "• Stale stand-ups"         → "Stale stand-ups"
 *   "1. Stale stand-ups"        → "Stale stand-ups"
 *   "12) Stale stand-ups"       → "Stale stand-ups"
 *   "   - Stale stand-ups"      → "Stale stand-ups"   (leading whitespace OK)
 *   "Stale stand-ups"           → "Stale stand-ups"   (no marker)
 */
const BULLET_PREFIX_RE = /^[\s ]*(?:[-*•·]|\d+[.)])\s+/;

/**
 * If a line contains a tab (spreadsheet paste from e.g. Excel / Google
 * Sheets with multiple columns), keep only the first column — that's
 * the sticky-text equivalent. Same heuristic Miro/Mural CSV's "Text"
 * column position settles on.
 */
const FIRST_TAB_COLUMN = (line: string): string => {
  const tab = line.indexOf('\t');
  return tab === -1 ? line : line.slice(0, tab);
};

/**
 * Parse pasted whiteboard text into a list of statements (one per
 * non-empty source line). Order is preserved.
 */
export const parseWhiteboardPaste = (raw: string): string[] => {
  if (!raw) return [];
  // Order matters: strip the bullet prefix FIRST (its regex tolerates
  // leading whitespace including tabs), then take the first tab-column.
  // The reverse order drops content for tab-indented bullets like
  // "\t- two" — `FIRST_TAB_COLUMN` would slice everything before the
  // first tab and the "- two" remainder would never be seen.
  return raw
    .split(/\r?\n/)
    .map((line) => line.replace(BULLET_PREFIX_RE, ''))
    .map(FIRST_TAB_COLUMN)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
};

/**
 * Mint one entity per statement, all of the same chosen type. Returns
 * the count for the success toast. Newly-minted entities go into the
 * current selection so the user can immediately type Tab / Cmd+L to
 * arrange them. Each entity carries an `attributes.importedFrom`
 * marker so later validators / reports can flag freshly-imported
 * content that hasn't been wired into the causal graph yet.
 */
export const applyWhiteboardPaste = (statements: string[], type: EntityType): number => {
  if (statements.length === 0) return 0;
  const state = useDocumentStore.getState();
  const ids: string[] = [];
  for (const title of statements) {
    const entity = state.addEntity({ type, title });
    ids.push(entity.id);
  }
  state.selectEntities(ids);
  return ids.length;
};
