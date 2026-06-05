// @vitest-environment jsdom
import type { Node } from '@xyflow/react';
import { toSvg } from 'html-to-image';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { exportToVectorPdf } from '@/services/exporters/pdfExport';
import { triggerDownload } from '@/services/exporters/shared';
import { makeDoc, makeEntity, resetIds } from '../domain/helpers';

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
  instances: [] as Array<{ opts: { format?: string }; pages: number; texts: string[] }>,
}));

vi.mock('@/services/exporters/pdfShared', () => {
  class FakePdf {
    opts: { format?: string };
    pages = 1;
    texts: string[] = [];
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
});
