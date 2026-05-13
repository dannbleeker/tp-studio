import type { Group, GroupId } from '@/domain/types';
import { exportToCsv } from '@/services/csvExport';
import { parseEntitiesCsv } from '@/services/csvImport';
import { beforeEach, describe, expect, it } from 'vitest';
import { makeDoc, makeEdge, makeEntity, resetIds } from '../domain/helpers';

beforeEach(resetIds);

describe('exportToCsv', () => {
  it('emits a header row followed by entity / edge / group rows', () => {
    const a = makeEntity({ title: 'A', annotationNumber: 1 });
    const b = makeEntity({ title: 'B', annotationNumber: 2 });
    const e = makeEdge(a.id, b.id, { label: 'within 30d' });
    const doc = makeDoc([a, b], [e]);
    const g: Group = {
      id: 'g1' as GroupId,
      title: 'Group 1',
      color: 'indigo',
      memberIds: [a.id],
      collapsed: false,
      createdAt: 1,
      updatedAt: 1,
    };
    doc.groups = { g1: g };

    const csv = exportToCsv(doc);
    const lines = csv.trim().split('\n');
    expect(lines[0]).toContain('kind,id,type,title');
    // header + 2 entity rows + 1 edge row + 1 group row = 5
    expect(lines).toHaveLength(5);
  });

  it('quotes cells containing commas, quotes, or newlines per RFC 4180', () => {
    const a = makeEntity({
      title: 'Comma, in the title',
      description: 'Says "hello"\nover multiple lines',
    });
    const csv = exportToCsv(makeDoc([a], []));
    expect(csv).toContain('"Comma, in the title"');
    expect(csv).toContain('"Says ""hello""\nover multiple lines"');
  });

  it('writes entity rows that the CSV importer can read back', () => {
    const a = makeEntity({ title: 'Foo' });
    const b = makeEntity({ title: 'Bar' });
    const doc = makeDoc([a, b], []);
    const csv = exportToCsv(doc);
    // Stub: build a re-importable CSV that uses the exported entity rows only.
    // The full csvImport.ts only reads title + type so we strip down — the
    // round-trip target is structural shape, not byte-identical content.
    const entityLines = csv
      .split('\n')
      .filter((l) => l.startsWith('entity') || l.startsWith('kind'));
    // Replace 'kind,id,type,title,...' header with the import header.
    const importable = ['title,type,description', ...entityLines.slice(1).map(parseEntityRow)].join(
      '\n'
    );
    const r = parseEntitiesCsv(importable);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.rows.map((row) => row.title).sort()).toEqual(['Bar', 'Foo']);
  });

  it('contains entity, edge, and group rows in order', () => {
    const a = makeEntity({ title: 'A' });
    const b = makeEntity({ title: 'B' });
    const e = makeEdge(a.id, b.id);
    const doc = makeDoc([a, b], [e]);
    const csv = exportToCsv(doc);
    const lines = csv.trim().split('\n');
    expect(lines[1]).toContain('entity');
    expect(lines[2]).toContain('entity');
    expect(lines[3]).toContain('edge');
  });
});

// Helper: pull a CSV "entity" row into the importer's narrower title,type,description schema.
function parseEntityRow(line: string): string {
  const parts = parseRow(line);
  const title = parts[3] ?? '';
  const type = parts[2] ?? '';
  const description = parts[9] ?? '';
  return [csvQuote(title), csvQuote(type), csvQuote(description)].join(',');
}

function csvQuote(s: string): string {
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

// Minimal CSV row parser for this test only — handles the quoted-comma case.
function parseRow(line: string): string[] {
  const out: string[] = [];
  let cur = '';
  let q = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]!;
    if (q) {
      if (ch === '"' && line[i + 1] === '"') {
        cur += '"';
        i += 1;
      } else if (ch === '"') q = false;
      else cur += ch;
    } else if (ch === '"') q = true;
    else if (ch === ',') {
      out.push(cur);
      cur = '';
    } else cur += ch;
  }
  out.push(cur);
  return out;
}
