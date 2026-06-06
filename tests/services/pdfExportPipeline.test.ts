// @vitest-environment jsdom
import type { Node } from '@xyflow/react';
import { toSvg } from 'html-to-image';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { exportToVectorPdf } from '@/services/exporters/pdfExport';
import { triggerDownload } from '@/services/exporters/shared';
import { makeDoc, makeEdge, makeEntity, resetIds } from '../domain/helpers';

/**
 * Session 177 — integration coverage for the `exportToVectorPdf` entry point.
 *
 * The sibling `pdfExport.test.ts` covers the pure helpers (decoder, page-count
 * math, placeholder + appendix-estimate). This file drives the full pipeline
 * by mocking the heavy boundaries — `html-to-image`'s `toSvg`, the lazy
 * `loadJsPdf` (a fake recording jsPDF), `svg2pdf.js`, and the download
 * side-effect — so the capture → paginate → appendix → download flow runs
 * end-to-end in jsdom.
 */

const pdfMock = vi.hoisted(() => ({
  instances: [] as Array<{
    opts: { format?: string };
    pages: number;
    texts: string[];
    clips: number;
    rects: Array<{ x: number; y: number; w: number; h: number; style: string | null }>;
  }>,
}));

vi.mock('@/services/exporters/pdfShared', () => {
  class FakePdf {
    opts: { format?: string };
    pages = 1;
    texts: string[] = [];
    clips = 0;
    rects: Array<{ x: number; y: number; w: number; h: number; style: string | null }> = [];
    constructor(opts: { format?: string }) {
      this.opts = opts;
      pdfMock.instances.push(this);
    }
    addPage(): void {
      this.pages += 1;
    }
    setFontSize(): void {}
    setTextColor(): void {}
    setFont(): void {}
    text(t: string): void {
      this.texts.push(t);
    }
    splitTextToSize(s: string): string[] {
      return String(s).split('\n');
    }
    saveGraphicsState(): void {}
    restoreGraphicsState(): void {}
    rect(x: number, y: number, w: number, h: number, style: string | null = null): void {
      this.rects.push({ x, y, w, h, style });
    }
    clip(): void {
      this.clips += 1;
    }
    discardPath(): void {}
    output(): Blob {
      return new Blob(['pdf'], { type: 'application/pdf' });
    }
  }
  return { loadJsPdf: () => Promise.resolve(FakePdf) };
});

vi.mock('svg2pdf.js', () => ({ svg2pdf: () => Promise.resolve() }));

vi.mock('html-to-image', () => ({ toSvg: vi.fn() }));

vi.mock('@/services/exporters/shared', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/services/exporters/shared')>()),
  triggerDownload: vi.fn(),
}));

const mockDownload = vi.mocked(triggerDownload);
const mockToSvg = vi.mocked(toSvg);
const SVG_NS = 'http://www.w3.org/2000/svg';
const svgDataUrl = (w: number, h: number): string =>
  `data:image/svg+xml;charset=utf-8,<svg xmlns="${SVG_NS}" width="${w}" height="${h}"></svg>`;

const nodes = [
  {
    id: 'a',
    type: 'tp',
    position: { x: 0, y: 0 },
    width: 100,
    height: 50,
    measured: { width: 100, height: 50 },
    data: {},
  },
] as unknown as Node[];

const firstPdf = () => {
  const inst = pdfMock.instances[0];
  if (!inst) throw new Error('no jsPDF instance recorded');
  return inst;
};

beforeEach(() => {
  resetIds();
  pdfMock.instances.length = 0;
  mockDownload.mockClear();
  mockToSvg.mockReset();
  mockToSvg.mockResolvedValue(svgDataUrl(800, 600));
  document.body.innerHTML = '<div class="react-flow__viewport"></div>';
});
afterEach(() => {
  vi.restoreAllMocks();
});

describe('exportToVectorPdf — full pipeline', () => {
  it('captures the canvas, builds a one-page PDF, and triggers a download', async () => {
    const doc = makeDoc([makeEntity({ title: 'A' })], []);
    doc.title = 'My CRT';

    const ok = await exportToVectorPdf(doc, nodes);

    expect(ok).toBe(true);
    expect(mockDownload).toHaveBeenCalledWith(expect.any(Blob), 'my-crt.pdf');
    expect(pdfMock.instances).toHaveLength(1);
    expect(firstPdf().pages).toBe(1);
  });

  it('paginates a tall diagram across multiple pages', async () => {
    mockToSvg.mockResolvedValueOnce(svgDataUrl(800, 4000));
    const doc = makeDoc([makeEntity({ title: 'A' })], []);

    const ok = await exportToVectorPdf(doc, nodes);

    expect(ok).toBe(true);
    expect(firstPdf().pages).toBeGreaterThan(1);
  });

  it('renders an annotation appendix when includeAppendix is set', async () => {
    const a = makeEntity({
      title: 'Cause',
      description: 'A described cause that belongs in the appendix.',
    });
    const doc = makeDoc([a], []);

    const ok = await exportToVectorPdf(doc, nodes, { includeAppendix: true });

    expect(ok).toBe(true);
    expect(firstPdf().texts).toContain('Annotation appendix');
    expect(firstPdf().texts.some((t) => t.includes('Cause'))).toBe(true);
    // The appendix starts on its own page — a single-page diagram + appendix
    // is 2 physical pages, not 1 overlaid page (Session 177 pagination fix).
    expect(firstPdf().pages).toBeGreaterThanOrEqual(2);
  });

  it('renders the reasoning companion when includeReasoning is set', async () => {
    const a = makeEntity({ title: 'A' });
    const b = makeEntity({ title: 'B' });
    const doc = makeDoc([a, b], [makeEdge(a.id, b.id)]);

    const ok = await exportToVectorPdf(doc, nodes, { includeReasoning: true });

    expect(ok).toBe(true);
    expect(firstPdf().texts).toContain('Reasoning');
    // The cause→effect read-out (CRT 'auto' → effect "because" cause) is rendered.
    expect(firstPdf().texts.some((t) => t.includes('because'))).toBe(true);
    // Starts on its own page after the diagram.
    expect(firstPdf().pages).toBeGreaterThanOrEqual(2);
  });

  it('prints the how-to-read legend on the diagram page when includeLegend is set', async () => {
    const doc = makeDoc([makeEntity({ title: 'A' })], []);

    const ok = await exportToVectorPdf(doc, nodes, { includeLegend: true });

    expect(ok).toBe(true);
    // The CRT reading rule is wrapped + drawn under the page header.
    const { texts } = firstPdf();
    expect(texts.some((t) => t.includes('How to read this Current Reality Tree'))).toBe(true);
    expect(texts.some((t) => t.includes('bottom-up'))).toBe(true);
  });

  it('omits the legend by default', async () => {
    const doc = makeDoc([makeEntity({ title: 'A' })], []);

    const ok = await exportToVectorPdf(doc, nodes);

    expect(ok).toBe(true);
    expect(firstPdf().texts.some((t) => t.includes('How to read this'))).toBe(false);
  });

  it('draws no legend for a freeform diagram even when includeLegend is set', async () => {
    // Freeform has no fixed reading rule — `printLegendFor` returns '' — so no
    // band is reserved and nothing is drawn.
    const doc = makeDoc([makeEntity({ title: 'A' })], [], 'freeform');

    const ok = await exportToVectorPdf(doc, nodes, { includeLegend: true });

    expect(ok).toBe(true);
    expect(firstPdf().texts.some((t) => t.includes('How to read this'))).toBe(false);
  });

  it('repeats the legend on every page of a multi-page diagram', async () => {
    // Per-page (not just first-page) so each physical sheet is self-explanatory.
    mockToSvg.mockResolvedValueOnce(svgDataUrl(800, 4000));
    const doc = makeDoc([makeEntity({ title: 'A' })], []);

    const ok = await exportToVectorPdf(doc, nodes, { includeLegend: true });

    expect(ok).toBe(true);
    const legendHits = firstPdf().texts.filter((t) => t.includes('How to read this')).length;
    expect(firstPdf().pages).toBeGreaterThan(1);
    // No appendix/reasoning here, so every physical page is a diagram page.
    expect(legendHits).toBe(firstPdf().pages);
  });

  it('clips every diagram page to the drawable band so the diagram never bleeds over the header/footer', async () => {
    // Without the clip, a multi-page diagram's full-height SVG paints over the
    // header/footer/legend bands and duplicates content across the page seam.
    mockToSvg.mockResolvedValueOnce(svgDataUrl(800, 4000));
    const doc = makeDoc([makeEntity({ title: 'A' })], []);

    const ok = await exportToVectorPdf(doc, nodes);
    expect(ok).toBe(true);

    const pdf = firstPdf();
    expect(pdf.pages).toBeGreaterThan(1);
    // One clip per diagram page (no appendix/reasoning pages in this run).
    expect(pdf.clips).toBe(pdf.pages);
    // The clip rect is the drawable band: x = left margin (12mm), y = below the
    // header (margin + header = 20mm), a positive height shorter than full A4.
    // `style === null` is what makes `rect()` a clip path (no stroked border).
    const clipRect = pdf.rects.find((r) => r.style === null);
    expect(clipRect).toBeDefined();
    expect(clipRect?.x).toBe(12);
    expect(clipRect?.y).toBe(20);
    expect(clipRect?.w).toBe(210 - 24);
    expect(clipRect?.h).toBeGreaterThan(0);
    expect(clipRect?.h).toBeLessThan(297);
  });

  it('reserves a legend band so the diagram is pushed below it when the legend is on', async () => {
    // Guards the band math directly: with the legend ON, the clip rect's top
    // shifts DOWN from the bare 20mm (margin 12 + header 8) and its height
    // shrinks by the SAME band. Without this, a regression in the
    // drawableTop/drawableHeight subtraction would let the legend overprint the
    // diagram while every text/count assertion still passed.
    mockToSvg.mockResolvedValueOnce(svgDataUrl(800, 4000));
    const doc = makeDoc([makeEntity({ title: 'A' })], []);

    const ok = await exportToVectorPdf(doc, nodes, { includeLegend: true });
    expect(ok).toBe(true);

    const clipRect = firstPdf().rects.find((r) => r.style === null);
    expect(clipRect).toBeDefined();
    const HEADER_BOTTOM = 20; // margin 12 + header band 8
    const BARE_DRAWABLE_H = 297 - 24 - 8 - 8; // A4 minus margins + header + footer
    expect(clipRect?.y).toBeGreaterThan(HEADER_BOTTOM); // band reserved → pushed down
    // top shifts down and height shrinks by exactly the same reserved band:
    expect((clipRect?.y ?? 0) - HEADER_BOTTOM).toBe(BARE_DRAWABLE_H - (clipRect?.h ?? 0));
  });

  it('draws header and footer with resolved page placeholders', async () => {
    const doc = makeDoc([makeEntity({ title: 'A' })], []);

    const ok = await exportToVectorPdf(doc, nodes, {
      header: 'Top {pageNumber}/{pageCount}',
      footer: 'Foot',
    });

    expect(ok).toBe(true);
    expect(firstPdf().texts).toContain('Top 1/1');
    expect(firstPdf().texts).toContain('Foot');
  });

  it('honours the letter page size option', async () => {
    const doc = makeDoc([makeEntity({ title: 'A' })], []);

    const ok = await exportToVectorPdf(doc, nodes, { pageSize: 'letter' });

    expect(ok).toBe(true);
    expect(firstPdf().opts.format).toBe('letter');
  });

  it('returns false and skips the download when there are no nodes', async () => {
    const doc = makeDoc([makeEntity({ title: 'A' })], []);

    const ok = await exportToVectorPdf(doc, []);

    expect(ok).toBe(false);
    expect(mockDownload).not.toHaveBeenCalled();
  });

  it('returns false when the canvas viewport element is absent', async () => {
    document.body.innerHTML = '';
    const doc = makeDoc([makeEntity({ title: 'A' })], []);

    const ok = await exportToVectorPdf(doc, nodes);

    expect(ok).toBe(false);
  });

  it('uses the dark surface colour when the document is in dark mode', async () => {
    // captureCanvasSvg reads `documentElement.classList.contains('dark')` to
    // pick SURFACE_DARK vs SURFACE_LIGHT — exercise the dark branch.
    document.documentElement.classList.add('dark');
    const doc = makeDoc([makeEntity({ title: 'A' })], []);
    try {
      const ok = await exportToVectorPdf(doc, nodes);
      expect(ok).toBe(true);
      expect(firstPdf().pages).toBe(1);
    } finally {
      document.documentElement.classList.remove('dark');
    }
  });

  it('falls back to the viewBox when the SVG has no width/height attributes', async () => {
    mockToSvg.mockResolvedValueOnce(
      `data:image/svg+xml;charset=utf-8,<svg xmlns="${SVG_NS}" viewBox="0 0 800 600"></svg>`
    );
    const doc = makeDoc([makeEntity({ title: 'A' })], []);

    const ok = await exportToVectorPdf(doc, nodes);

    expect(ok).toBe(true);
    expect(firstPdf().pages).toBe(1);
  });

  it('falls back to default dimensions when the SVG carries neither size nor viewBox', async () => {
    mockToSvg.mockResolvedValueOnce(
      `data:image/svg+xml;charset=utf-8,<svg xmlns="${SVG_NS}"></svg>`
    );
    const doc = makeDoc([makeEntity({ title: 'A' })], []);

    const ok = await exportToVectorPdf(doc, nodes);

    expect(ok).toBe(true);
    expect(firstPdf().pages).toBe(1);
  });

  it('breaks the appendix across pages and labels an untitled entity', async () => {
    // Many described entities force the in-loop page break; a blank title
    // exercises the "(untitled)" fallback in the appendix header line.
    const entities = Array.from({ length: 40 }, (_, i) =>
      makeEntity({ title: i === 0 ? '' : `E${i}`, description: 'x'.repeat(400) })
    );
    const doc = makeDoc(entities, []);

    const ok = await exportToVectorPdf(doc, nodes, { includeAppendix: true });

    expect(ok).toBe(true);
    expect(firstPdf().pages).toBeGreaterThan(2);
    expect(firstPdf().texts.some((t) => t.includes('(untitled)'))).toBe(true);
  });
});
