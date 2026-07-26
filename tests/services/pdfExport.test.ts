import { describe, expect, it } from 'vitest';
import {
  computePageCount,
  decodeSvgDataUrl,
  estimateAppendixPages,
  estimateReasoningPages,
  renderAppendix,
  resolvePagePlaceholders,
} from '@/services/exporters/pdfExport';
import { resetStoreForTest, useDocumentStore } from '@/store';

/**
 * Session 80 — direct tests of the pdfExport helpers.
 *
 * The full export entry point (`exportToVectorPdf`) drives a heavy DOM /
 * SVG / jsPDF pipeline that's painful to mount in jsdom — covered by the
 * Playwright e2e suite. The pure helpers (data-url decoder, page-count
 * math, placeholder resolution, appendix-page estimator) carry the
 * regression risk that fits a unit test; they're tested directly here.
 */

describe('decodeSvgDataUrl', () => {
  it('decodes percent-encoded SVG payloads', () => {
    const dataUrl =
      'data:image/svg+xml;charset=utf-8,%3Csvg%20width%3D%22100%22%20height%3D%22100%22%2F%3E';
    expect(decodeSvgDataUrl(dataUrl)).toBe('<svg width="100" height="100"/>');
  });

  it('decodes base64 SVG payloads', () => {
    const svg = '<svg width="100" height="100"/>';
    const dataUrl = `data:image/svg+xml;base64,${btoa(svg)}`;
    expect(decodeSvgDataUrl(dataUrl)).toBe(svg);
  });

  it('returns the input unchanged when no comma is present', () => {
    expect(decodeSvgDataUrl('not-a-data-url')).toBe('not-a-data-url');
  });
});

describe('computePageCount', () => {
  it('returns 1 for a diagram that fits one page', () => {
    // 800px wide scaled to 186mm usable → 0.2325 mm/px scale →
    // 600px tall ≈ 139.5mm — well under any reasonable page height.
    expect(computePageCount(800, 600, 186, 250)).toBe(1);
  });

  it('paginates when the scaled diagram exceeds page height', () => {
    // 800px wide → 186mm. 4000px tall × 0.2325 = 930mm. Across 250mm
    // pages → ceil(930/250) = 4 pages.
    expect(computePageCount(800, 4000, 186, 250)).toBe(4);
  });

  it('always returns at least 1 page', () => {
    expect(computePageCount(0, 0, 186, 250)).toBe(1);
    expect(computePageCount(-100, 50, 186, 250)).toBe(1);
  });

  it('handles tall narrow diagrams', () => {
    // 200px × 5000px scaled to 186mm width → scale 0.93 → 4650mm tall.
    expect(computePageCount(200, 5000, 186, 250)).toBeGreaterThanOrEqual(18);
  });
});

describe('resolvePagePlaceholders', () => {
  it('substitutes {pageNumber} and {pageCount}', () => {
    expect(resolvePagePlaceholders('Page {pageNumber} of {pageCount}', 2, 5)).toBe('Page 2 of 5');
  });

  it('leaves other text untouched', () => {
    expect(resolvePagePlaceholders('My Title · {pageNumber}', 1, 1)).toBe('My Title · 1');
  });

  it('replaces every occurrence', () => {
    expect(resolvePagePlaceholders('{pageNumber} {pageNumber}', 3, 4)).toBe('3 3');
  });
});

describe('estimateAppendixPages', () => {
  it('returns 0 when no entities have descriptions', () => {
    resetStoreForTest();
    useDocumentStore.getState().addEntity({ type: 'effect', title: 'No desc here' });
    const doc = useDocumentStore.getState().doc;
    expect(estimateAppendixPages(doc, 297, 186)).toBe(0);
  });

  it('returns at least 1 page when entities carry descriptions', () => {
    resetStoreForTest();
    const e = useDocumentStore.getState().addEntity({ type: 'effect', title: 'A' });
    useDocumentStore
      .getState()
      .updateEntity(e.id, { description: 'A short description that fits one line.' });
    const doc = useDocumentStore.getState().doc;
    expect(estimateAppendixPages(doc, 297, 186)).toBeGreaterThanOrEqual(1);
  });

  it('grows with the number of described entities', () => {
    resetStoreForTest();
    const longDesc = 'a'.repeat(2000);
    for (let i = 0; i < 30; i++) {
      const e = useDocumentStore.getState().addEntity({ type: 'effect', title: `Entity ${i}` });
      useDocumentStore.getState().updateEntity(e.id, { description: longDesc });
    }
    const doc = useDocumentStore.getState().doc;
    expect(estimateAppendixPages(doc, 297, 186)).toBeGreaterThan(1);
  });
});

describe('estimateReasoningPages', () => {
  it('returns 0 when there are no sentences', () => {
    expect(estimateReasoningPages([], 297, 186)).toBe(0);
  });

  it('returns at least 1 page for a handful of sentences', () => {
    const pages = estimateReasoningPages(['"B" because "A".', '"C" because "B".'], 297, 186);
    expect(pages).toBeGreaterThanOrEqual(1);
  });

  it('grows with the number + length of sentences', () => {
    const many = Array.from({ length: 80 }, (_, i) => `Step ${i}: ${'cause '.repeat(10)}`);
    expect(estimateReasoningPages(many, 297, 186)).toBeGreaterThan(1);
  });
});

/**
 * Session 209b — the appendix ran its page-break check ONCE per entity, before
 * drawing the whole block, so an entry taller than a page marched off the bottom
 * and the overflow was invisible in the output. Separately, the header line was
 * drawn with a bare `pdf.text` instead of `splitTextToSize`, so a long title was
 * clipped at the right margin rather than wrapping.
 *
 * A fake jsPDF records what would have been drawn. That is enough to assert both
 * properties without a real DOM/SVG pipeline (which e2e covers).
 */
describe('renderAppendix pagination', () => {
  type Drawn = { text: string; y: number; page: number };

  const fakePdf = () => {
    let page = 1;
    const drawn: Drawn[] = [];
    const pdf = {
      setFontSize: () => undefined,
      setFont: () => undefined,
      setTextColor: () => undefined,
      setDrawColor: () => undefined,
      setFillColor: () => undefined,
      rect: () => undefined,
      line: () => undefined,
      addPage: () => {
        page += 1;
      },
      // ~90 chars per line at the appendix body size across the usable width.
      splitTextToSize: (t: string, _w: number) => {
        const words = String(t).split(' ');
        const lines: string[] = [];
        let cur = '';
        for (const w of words) {
          if ((cur + ' ' + w).trim().length > 90) {
            lines.push(cur.trim());
            cur = w;
          } else {
            cur = `${cur} ${w}`;
          }
        }
        if (cur.trim()) lines.push(cur.trim());
        return lines.length > 0 ? lines : [''];
      },
      text: (t: string, _x: number, y: number) => {
        drawn.push({ text: String(t), y, page });
      },
    };
    return { pdf, drawn: () => drawn };
  };

  const A4 = { pageWidthMm: 210, pageHeightMm: 297 };

  const docWith = (description: string, title = 'A title') => {
    resetStoreForTest();
    const s = useDocumentStore.getState();
    const e = s.addEntity({ type: 'effect', title });
    s.updateEntity(e.id, { description });
    return useDocumentStore.getState().doc;
  };

  it('breaks the page per LINE, so a block taller than a page never runs off it', () => {
    // Deliberately far past one page. An earlier draft of this test used ~50
    // wrapped lines, which still FIT — so it passed against the broken code and
    // guarded nothing. Sized so the overflow is unambiguous.
    const long = Array.from({ length: 600 }, (_, i) => `Sentence number ${i} padded out.`).join(
      ' '
    );
    const { pdf, drawn } = fakePdf();

    renderAppendix(
      pdf as unknown as import('jspdf').jsPDF,
      docWith(long),
      A4,
      'header',
      'footer',
      2,
      9
    );

    const lines = drawn();
    expect(lines.length).toBeGreaterThan(180);
    // Nothing is drawn below the printable area on any page. The old code only
    // checked once per entity, so everything after the first page's worth was
    // written past the bottom margin.
    const bottomLimit = A4.pageHeightMm;
    for (const l of lines) expect(l.y).toBeLessThan(bottomLimit);
    // And it genuinely spilled onto further pages rather than piling up.
    expect(Math.max(...lines.map((l) => l.page))).toBeGreaterThan(1);
  });

  it('wraps a long header line instead of clipping it at the margin', () => {
    const longTitle = `Prefix ${'wordy '.repeat(40)}suffix`;
    const { pdf, drawn } = fakePdf();

    renderAppendix(
      pdf as unknown as import('jspdf').jsPDF,
      docWith('Short body.', longTitle),
      A4,
      'header',
      'footer',
      2,
      3
    );

    // The title arrives as several drawn lines, not one over-long string.
    const titleLines = drawn().filter((l) => l.text.includes('wordy'));
    expect(titleLines.length).toBeGreaterThan(1);
    for (const l of titleLines) expect(l.text.length).toBeLessThanOrEqual(90);
  });
});
