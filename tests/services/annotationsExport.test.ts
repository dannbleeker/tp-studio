import { exportAnnotationsMarkdown, exportAnnotationsText } from '@/services/annotationsExport';
import { beforeEach, describe, expect, it } from 'vitest';
import { makeDoc, makeEntity, resetIds } from '../domain/helpers';

beforeEach(resetIds);

describe('exportAnnotationsMarkdown', () => {
  it('orders entries by annotation number ascending', () => {
    const a = makeEntity({ title: 'A', annotationNumber: 3 });
    const b = makeEntity({ title: 'B', annotationNumber: 1 });
    const c = makeEntity({ title: 'C', annotationNumber: 2 });
    const md = exportAnnotationsMarkdown(makeDoc([a, b, c], []));
    const positions = ['#1 — B', '#2 — C', '#3 — A'].map((s) => md.indexOf(s));
    expect(positions.every((p) => p > -1)).toBe(true);
    expect(positions).toEqual([...positions].sort((x, y) => x - y));
  });

  it('renders document title as H1 and entity titles as H2 with annotation prefix', () => {
    const a = makeEntity({ title: 'Customer satisfaction is declining', annotationNumber: 1 });
    const doc = { ...makeDoc([a], []), title: 'My CRT' };
    const md = exportAnnotationsMarkdown(doc);
    expect(md).toMatch(/^# My CRT/);
    expect(md).toContain('## #1 — Customer satisfaction is declining');
  });

  it('emits an author line when set, omits when missing', () => {
    const a = makeEntity();
    expect(exportAnnotationsMarkdown({ ...makeDoc([a], []), author: 'Eli' })).toContain('_by Eli_');
    expect(exportAnnotationsMarkdown(makeDoc([a], []))).not.toContain('_by ');
  });

  it('preserves description markdown verbatim', () => {
    const a = makeEntity({ title: 'A', description: '**bold** and *italic*' });
    expect(exportAnnotationsMarkdown(makeDoc([a], []))).toContain('**bold** and *italic*');
  });
});

describe('exportAnnotationsText', () => {
  it('emits a flat text block with indented descriptions', () => {
    const a = makeEntity({
      title: 'Order entry is manual',
      description: 'Hand-keyed\nfrom emails',
      annotationNumber: 1,
    });
    const txt = exportAnnotationsText(makeDoc([a], []));
    expect(txt).toContain('#1 Order entry is manual (Effect)');
    expect(txt).toContain('    Hand-keyed');
    expect(txt).toContain('    from emails');
  });

  it('keeps entries ordered by annotation number', () => {
    const a = makeEntity({ title: 'A', annotationNumber: 2 });
    const b = makeEntity({ title: 'B', annotationNumber: 1 });
    const txt = exportAnnotationsText(makeDoc([a, b], []));
    expect(txt.indexOf('#1 B')).toBeLessThan(txt.indexOf('#2 A'));
  });
});
