import { beforeEach, describe, expect, it } from 'vitest';
import { applyCsvRows, parseEntitiesCsv } from '@/services/exporters/csvImport';
import { resetStoreForTest, useDocumentStore } from '@/store';

beforeEach(resetStoreForTest);

describe('parseEntitiesCsv', () => {
  it('rejects an empty file', () => {
    const r = parseEntitiesCsv('');
    expect(r.ok).toBe(false);
  });

  it('rejects a header missing the title column', () => {
    const r = parseEntitiesCsv('type\neffect');
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.errors[0]!.message).toMatch(/title/i);
  });

  it('parses a minimal header + row', () => {
    const r = parseEntitiesCsv('title,type\nFoo,effect');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.rows).toEqual([{ title: 'Foo', type: 'effect' }]);
  });

  it('supports description and parent_title columns in any order', () => {
    const r = parseEntitiesCsv(
      'parent_title,description,type,title\n,Some notes,effect,Foo\nFoo,,effect,Bar'
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.rows).toEqual([
      { title: 'Foo', type: 'effect', description: 'Some notes' },
      { title: 'Bar', type: 'effect', parentTitle: 'Foo' },
    ]);
  });

  it('flags rows with unknown types and reports line numbers', () => {
    const r = parseEntitiesCsv('title,type\nFoo,unknown\nBar,effect');
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.errors).toEqual([{ line: 2, message: expect.stringMatching(/Unknown type/) }]);
  });

  it('handles quoted fields with embedded commas', () => {
    const r = parseEntitiesCsv('title,type,description\n"Foo, with comma",effect,"a; b; c"');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.rows[0]).toEqual({
      title: 'Foo, with comma',
      type: 'effect',
      description: 'a; b; c',
    });
  });

  it('handles doubled-up quote escapes inside fields', () => {
    const r = parseEntitiesCsv('title,type\n"say ""hi""",effect');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.rows[0]!.title).toBe('say "hi"');
  });

  it('parses a quoted field containing newlines (RFC 4180 multiline cell)', () => {
    const r = parseEntitiesCsv(
      'title,type,description\n"Foo",effect,"Line one\nLine two\nLine three"'
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.rows[0]).toEqual({
      title: 'Foo',
      type: 'effect',
      description: 'Line one\nLine two\nLine three',
    });
  });

  it('keeps later rows and error line numbers correct after a multiline field', () => {
    // The 3-line description spans physical lines 2-4, so the bad row is line 5.
    const r = parseEntitiesCsv('title,type,description\n"A",effect,"l1\nl2\nl3"\nB,bogus');
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.errors).toEqual([{ line: 5, message: expect.stringMatching(/Unknown type/) }]);
  });

  it('normalizes CRLF endings, including inside a quoted multiline field', () => {
    const r = parseEntitiesCsv('title,type,description\r\n"A",effect,"l1\r\nl2"\r\nB,effect\r\n');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.rows).toEqual([
      { title: 'A', type: 'effect', description: 'l1\nl2' },
      { title: 'B', type: 'effect' },
    ]);
  });

  it('handles a quoted field containing both a comma and a newline', () => {
    const r = parseEntitiesCsv(
      'title,type,description\n"A",effect,"first, still line one\nline two"'
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.rows[0]!.description).toBe('first, still line one\nline two');
  });

  it('handles a doubled-quote escape inside a multiline field', () => {
    const r = parseEntitiesCsv('title,type,description\n"A",effect,"say ""hi""\nthen bye"');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.rows[0]!.description).toBe('say "hi"\nthen bye');
  });

  it('does not emit a phantom row for a trailing newline', () => {
    const r = parseEntitiesCsv('title,type\nFoo,effect\n');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.rows).toEqual([{ title: 'Foo', type: 'effect' }]);
  });
});

describe('applyCsvRows', () => {
  it('creates entities + wires parent_title edges within the import', () => {
    const summary = applyCsvRows([
      { title: 'Root', type: 'effect' },
      { title: 'Child', type: 'effect', parentTitle: 'Root' },
    ]);
    expect(summary.entities).toBe(2);
    expect(summary.edges).toBe(1);
    const doc = useDocumentStore.getState().doc;
    expect(Object.keys(doc.entities)).toHaveLength(2);
    expect(Object.keys(doc.edges)).toHaveLength(1);
  });

  it('attaches descriptions when provided', () => {
    applyCsvRows([{ title: 'Foo', type: 'effect', description: 'about Foo' }]);
    const e = Object.values(useDocumentStore.getState().doc.entities)[0]!;
    expect(e.description).toBe('about Foo');
  });

  it('skips parent links to unknown titles silently', () => {
    const summary = applyCsvRows([{ title: 'Foo', type: 'effect', parentTitle: 'Ghost' }]);
    expect(summary.edges).toBe(0);
  });
});
