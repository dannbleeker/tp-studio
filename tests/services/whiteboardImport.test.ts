import { beforeEach, describe, expect, it } from 'vitest';
import { applyWhiteboardPaste, parseWhiteboardPaste } from '@/services/exporters/whiteboardImport';
import { resetStoreForTest, useDocumentStore } from '@/store';

beforeEach(resetStoreForTest);

describe('parseWhiteboardPaste', () => {
  it('returns an empty array on empty input', () => {
    expect(parseWhiteboardPaste('')).toEqual([]);
  });

  it('splits non-empty lines into separate statements', () => {
    const r = parseWhiteboardPaste('alpha\nbeta\ngamma');
    expect(r).toEqual(['alpha', 'beta', 'gamma']);
  });

  it('handles CRLF line endings (Windows clipboard)', () => {
    const r = parseWhiteboardPaste('alpha\r\nbeta\r\n');
    expect(r).toEqual(['alpha', 'beta']);
  });

  it('drops empty / whitespace-only lines', () => {
    const r = parseWhiteboardPaste('alpha\n\n  \nbeta\n');
    expect(r).toEqual(['alpha', 'beta']);
  });

  it('strips a dash bullet prefix', () => {
    expect(parseWhiteboardPaste('- one\n- two')).toEqual(['one', 'two']);
  });

  it('strips a star bullet prefix', () => {
    expect(parseWhiteboardPaste('* one\n* two')).toEqual(['one', 'two']);
  });

  it('strips a Unicode bullet (•) prefix — what Miro/Mural copy-paste produces', () => {
    expect(parseWhiteboardPaste('• one\n• two')).toEqual(['one', 'two']);
  });

  it('strips ordered-list markers (1., 2., 12.)', () => {
    expect(parseWhiteboardPaste('1. one\n2. two\n12. twelve')).toEqual(['one', 'two', 'twelve']);
  });

  it('strips ordered-list markers with closing paren (1), 2))', () => {
    expect(parseWhiteboardPaste('1) one\n2) two')).toEqual(['one', 'two']);
  });

  it('tolerates leading whitespace before a bullet', () => {
    expect(parseWhiteboardPaste('   - one\n\t- two')).toEqual(['one', 'two']);
  });

  it('takes only the first column of a tab-separated line (spreadsheet paste)', () => {
    // Miro / Mural CSV → Excel → copy back round-trips into tab-separated
    // rows; we only want the sticky text, not the metadata columns.
    const r = parseWhiteboardPaste('alpha\textra\tcol3\nbeta\tmore');
    expect(r).toEqual(['alpha', 'beta']);
  });

  it('preserves internal whitespace in the statement', () => {
    expect(parseWhiteboardPaste('- the quick   brown fox')).toEqual(['the quick   brown fox']);
  });

  it('does NOT strip dashes that appear mid-statement', () => {
    // "5-second rule" should not become "second rule".
    expect(parseWhiteboardPaste('the 5-second rule')).toEqual(['the 5-second rule']);
  });

  it('preserves order from the source paste', () => {
    const r = parseWhiteboardPaste('z\ny\nx');
    expect(r).toEqual(['z', 'y', 'x']);
  });
});

describe('applyWhiteboardPaste', () => {
  it('returns 0 and mints no entities when given an empty list', () => {
    const before = Object.keys(useDocumentStore.getState().doc.entities).length;
    expect(applyWhiteboardPaste([], 'effect')).toBe(0);
    const after = Object.keys(useDocumentStore.getState().doc.entities).length;
    expect(after).toBe(before);
  });

  it('mints one entity per statement, all of the chosen type', () => {
    const count = applyWhiteboardPaste(['alpha', 'beta'], 'ude');
    expect(count).toBe(2);
    const entities = Object.values(useDocumentStore.getState().doc.entities);
    const minted = entities.filter((e) => ['alpha', 'beta'].includes(e.title));
    expect(minted).toHaveLength(2);
    for (const e of minted) {
      expect(e.type).toBe('ude');
    }
  });

  it('preserves the statement ordering as the entity titles', () => {
    applyWhiteboardPaste(['first', 'second', 'third'], 'effect');
    const titles = Object.values(useDocumentStore.getState().doc.entities).map((e) => e.title);
    expect(titles).toEqual(expect.arrayContaining(['first', 'second', 'third']));
  });

  it('selects the freshly-minted entities', () => {
    applyWhiteboardPaste(['alpha', 'beta'], 'effect');
    const sel = useDocumentStore.getState().selection;
    expect(sel.kind).toBe('entities');
    if (sel.kind !== 'entities') return;
    expect(sel.ids).toHaveLength(2);
  });
});
