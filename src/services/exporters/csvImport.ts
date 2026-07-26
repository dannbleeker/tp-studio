import { isEntityType } from '@/domain/guards';
import type { EntityType } from '@/domain/types';
import { useDocumentStore } from '@/store';
import { pickFile } from '../exporters/picker';
import { CSV_FORMULA_GUARD, CSV_FORMULA_LEAD } from '../exporters/shared';

/**
 * Bulk CSV entity import (FL-QC2).
 *
 * Expected header (case-insensitive, order-flexible):
 *   title, type, description, parent_title
 *
 * - `title` (required)
 * - `type` (required) — one of the EntityType literals (`effect`, `ude`, …)
 * - `description` (optional)
 * - `parent_title` (optional) — connects this row as a child of the
 *   row whose title matches. Resolves within the same import only.
 *
 * Returns `{ entities, edges }` when successful, `{ errors }` otherwise.
 * Errors carry 1-based line numbers so toasts can point at the offending row.
 */

export type CsvRow = {
  title: string;
  type: EntityType;
  description?: string;
  parentTitle?: string;
};

/**
 * Undo the exporters' formula-injection guard. They prefix `'` to any cell
 * starting with `= + - @` or a tab so spreadsheets treat it as literal text;
 * stripping it here keeps TP Studio's own CSV round-trip exact. A cell the user
 * genuinely began with `'` is unaffected — the guard is only removed when what
 * follows is a lead character the exporter would have guarded.
 */
const unguard = (raw: string | undefined): string => {
  const trimmed = raw?.trim() ?? '';
  if (!trimmed.startsWith(CSV_FORMULA_GUARD)) return trimmed;
  const rest = trimmed.slice(CSV_FORMULA_GUARD.length);
  return CSV_FORMULA_LEAD.test(rest) ? rest : trimmed;
};

export type CsvParseResult =
  | { ok: true; rows: CsvRow[] }
  | { ok: false; errors: { line: number; message: string }[] };

/**
 * Single-pass, quote-aware CSV record tokenizer. Walks the WHOLE document so a
 * quoted field may span physical lines (an RFC 4180 multiline cell): commas
 * split fields and newlines split records only OUTSIDE quotes; inside quotes
 * both are literal content and `""` is an escaped quote. Each record carries the
 * 1-based physical line it STARTS on, so error toasts still point at the right
 * row and the count stays accurate after a multiline field. Cells are trimmed,
 * matching the previous per-line parser.
 *
 * Line endings are normalized (CRLF / lone CR -> LF) up front. An unclosed quote
 * reads to end of file (standard RFC 4180); the previous line-based parser
 * stopped at the line break, but every well-formed CSV — including this app's
 * own `exportToCsv` — is unaffected. Replaces the old `split(/\r?\n/)` +
 * per-line parser, which tore quoted multiline fields across rows.
 */
const parseCsvRecords = (text: string): { cells: string[]; line: number }[] => {
  const normalized = text.replace(/\r\n?/g, '\n');
  const records: { cells: string[]; line: number }[] = [];
  let cells: string[] = [];
  let cur = '';
  let inQuotes = false;
  let line = 1; // physical line of the current character
  let recordStartLine = 1; // physical line the in-progress record began on

  const endRecord = (): void => {
    cells.push(cur.trim());
    records.push({ cells, line: recordStartLine });
    cells = [];
    cur = '';
  };

  for (let i = 0; i < normalized.length; i++) {
    const ch = normalized.charAt(i);
    if (inQuotes) {
      if (ch === '"' && normalized.charAt(i + 1) === '"') {
        cur += '"'; // doubled-quote escape
        i += 1;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        if (ch === '\n') line += 1; // keep the physical line count honest inside a multiline field
        cur += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      cells.push(cur.trim());
      cur = '';
    } else if (ch === '\n') {
      endRecord();
      line += 1;
      recordStartLine = line;
    } else {
      cur += ch;
    }
  }
  // Flush a final record only when content is still pending — a trailing newline
  // leaves none, so it adds no phantom row.
  if (cur !== '' || cells.length > 0) endRecord();
  return records;
};

/**
 * A blank physical line tokenizes to a single empty cell — distinct from `,,`,
 * which yields several empty cells and is still validated as a row.
 */
const isBlankRecord = (r: { cells: string[] }): boolean =>
  r.cells.length === 1 && r.cells[0] === '';

export const parseEntitiesCsv = (text: string): CsvParseResult => {
  const records = parseCsvRecords(text);
  // Drop trailing blank records (a trailing newline / blank tail).
  while (records.length && isBlankRecord(records[records.length - 1]!)) records.pop();
  if (records.length === 0) return { ok: false, errors: [{ line: 1, message: 'Empty file.' }] };

  const header = records[0]!.cells.map((h) => h.toLowerCase());
  const idx = {
    title: header.indexOf('title'),
    type: header.indexOf('type'),
    description: header.indexOf('description'),
    parentTitle: header.indexOf('parent_title'),
  };
  const missing: string[] = [];
  if (idx.title === -1) missing.push('title');
  if (idx.type === -1) missing.push('type');
  if (missing.length) {
    return {
      ok: false,
      errors: [
        {
          line: 1,
          message: `Missing required column${missing.length === 1 ? '' : 's'}: ${missing.join(', ')}`,
        },
      ],
    };
  }

  const errors: { line: number; message: string }[] = [];
  const rows: CsvRow[] = [];
  for (let i = 1; i < records.length; i++) {
    const rec = records[i]!;
    if (isBlankRecord(rec)) continue; // skip blank lines between rows
    const cells = rec.cells;
    const title = unguard(cells[idx.title]);
    const type = cells[idx.type]?.trim() ?? '';
    const description = idx.description !== -1 ? unguard(cells[idx.description]) : undefined;
    const parentTitle = idx.parentTitle !== -1 ? unguard(cells[idx.parentTitle]) : undefined;
    const lineNo = rec.line;
    if (!title) {
      errors.push({ line: lineNo, message: 'Empty title.' });
      continue;
    }
    if (!isEntityType(type)) {
      errors.push({ line: lineNo, message: `Unknown type "${type}".` });
      continue;
    }
    rows.push({
      title,
      type,
      ...(description ? { description } : {}),
      ...(parentTitle ? { parentTitle } : {}),
    });
  }
  if (errors.length) return { ok: false, errors };
  return { ok: true, rows };
};

/**
 * Apply parsed CSV rows to the document. Mints entities in row order, then
 * wires edges from `parent_title` to each row whose title matched. Returns
 * a summary for the success toast.
 */
export const applyCsvRows = (
  rows: CsvRow[]
): { entities: number; edges: number; ambiguousParents: number } => {
  if (rows.length === 0) return { entities: 0, edges: 0, ambiguousParents: 0 };
  const state = useDocumentStore.getState();
  // Each row's OWN id, positionally. `parent_title` still resolves by title
  // (that is the format's contract), but a row's own identity must not: keying
  // both by title meant a repeated title overwrote the map entry, so the second
  // row's edge silently attached to the first row's entity and the row that
  // should have had a parent got none. A 4-row file with one duplicate produced
  // 4 entities and 2 edges where 3 were expected, one silent orphan, and a
  // success toast reporting no problem. Duplicate statement text is ordinary in
  // a workshop CSV.
  const idByRow: string[] = [];
  const idByTitle = new Map<string, string>();
  /** Titles that appear more than once — a `parent_title` naming one of these
   *  is genuinely ambiguous, so it is reported rather than guessed at. */
  const ambiguousTitles = new Set<string>();

  for (const row of rows) {
    const entity = state.addEntity({ type: row.type, title: row.title });
    if (row.description) state.updateEntity(entity.id, { description: row.description });
    idByRow.push(entity.id);
    if (idByTitle.has(row.title)) ambiguousTitles.add(row.title);
    else idByTitle.set(row.title, entity.id);
  }

  let edges = 0;
  let ambiguousParents = 0;
  for (const [i, row] of rows.entries()) {
    if (!row.parentTitle) continue;
    if (ambiguousTitles.has(row.parentTitle)) {
      ambiguousParents += 1;
      continue;
    }
    const parentId = idByTitle.get(row.parentTitle);
    const childId = idByRow[i];
    if (parentId && childId) {
      const e = state.connect(parentId, childId);
      if (e) edges += 1;
    }
  }

  state.selectEntities(idByRow);
  return { entities: rows.length, edges, ambiguousParents };
};

/**
 * Browser file-picker wrapper. Returns the raw text or null if the user
 * cancelled. Goes through the shared `pickFile` pipeline so any future
 * UX additions (drag-drop, recent files) propagate here.
 */
export const pickCsvFile = (): Promise<string | null> =>
  pickFile({
    accept: '.csv,text/csv',
    label: 'CSV',
    // The parse step is identity — `parseEntitiesCsv` runs later in
    // `commands/document.ts` so the command-layer toast can include
    // the row/column position of any parse error.
    parse: (text) => text,
  });
