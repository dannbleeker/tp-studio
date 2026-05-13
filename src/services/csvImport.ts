import { isEntityType } from '@/domain/guards';
import type { EntityType } from '@/domain/types';
import { useDocumentStore } from '@/store';
import { pickFile } from './exporters/picker';

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

export type CsvParseResult =
  | { ok: true; rows: CsvRow[] }
  | { ok: false; errors: { line: number; message: string }[] };

/**
 * Forgiving line parser: quoted fields support embedded commas, doubled-up
 * quotes escape a literal quote, and a missing closing quote falls back to
 * "read to end of line." Plenty of CSV in the wild is more permissive than
 * RFC 4180 wants — being lenient costs nothing here.
 */
const parseCsvLine = (line: string): string[] => {
  const out: string[] = [];
  let cur = '';
  let inQuotes = false;
  // Index-based loop because we need lookahead (`line[i + 1]`) on the
  // doubled-quote escape rule. `for…of line` would lose the lookahead.
  for (let i = 0; i < line.length; i++) {
    const ch = line.charAt(i);
    if (inQuotes) {
      if (ch === '"' && line.charAt(i + 1) === '"') {
        cur += '"';
        i += 1;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        cur += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      out.push(cur);
      cur = '';
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out.map((s) => s.trim());
};

export const parseEntitiesCsv = (text: string): CsvParseResult => {
  const lines = text.split(/\r?\n/).map((l) => l.trim());
  // Drop trailing empties.
  while (lines.length && !lines[lines.length - 1]) lines.pop();
  if (lines.length === 0) return { ok: false, errors: [{ line: 1, message: 'Empty file.' }] };

  const [headerLine = ''] = lines;
  const header = parseCsvLine(headerLine).map((h) => h.toLowerCase());
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
  for (let i = 1; i < lines.length; i++) {
    const raw = lines[i];
    if (!raw) continue;
    const cells = parseCsvLine(raw);
    const title = cells[idx.title]?.trim() ?? '';
    const type = cells[idx.type]?.trim() ?? '';
    const description = idx.description !== -1 ? cells[idx.description]?.trim() : undefined;
    const parentTitle = idx.parentTitle !== -1 ? cells[idx.parentTitle]?.trim() : undefined;
    const lineNo = i + 1;
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
export const applyCsvRows = (rows: CsvRow[]): { entities: number; edges: number } => {
  if (rows.length === 0) return { entities: 0, edges: 0 };
  const state = useDocumentStore.getState();
  const idByTitle = new Map<string, string>();

  for (const row of rows) {
    const entity = state.addEntity({ type: row.type, title: row.title });
    if (row.description) state.updateEntity(entity.id, { description: row.description });
    idByTitle.set(row.title, entity.id);
  }

  let edges = 0;
  for (const row of rows) {
    if (!row.parentTitle) continue;
    const parentId = idByTitle.get(row.parentTitle);
    const childId = idByTitle.get(row.title);
    if (parentId && childId) {
      const e = state.connect(parentId, childId);
      if (e) edges += 1;
    }
  }

  state.selectEntities([...idByTitle.values()]);
  return { entities: rows.length, edges };
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
