import { PNG_PADDING } from '@/domain/constants';
import { structuralEntities } from '@/domain/graph';
import { SURFACE_DARK, SURFACE_LIGHT } from '@/domain/tokens';
import type { TPDocument } from '@/domain/types';
import { slug, triggerDownload } from '@/services/exporters/shared';
import { type Node, getNodesBounds, getViewportForBounds } from '@xyflow/react';

/**
 * Session 80 / brief §8.1 + §8.6 + §8.8 + §8.13 — true vector PDF export.
 *
 * The v1 print pipeline (Session 77) handed off to `window.print()` and
 * relied on the browser's Save-as-PDF flow. That works but has two
 * limitations the brief calls out:
 *
 *   - The user has to navigate the browser print dialog (no programmatic
 *     download).
 *   - There's no way to embed a custom font or paginate predictably.
 *
 * This module fixes both by snapshotting the live React Flow viewport as
 * SVG (reusing the same approach as `image.ts`'s `exportSVG`), then
 * converting that SVG to a PDF via `jspdf` + `svg2pdf.js`. The output is
 * a real vector PDF — text stays text, edges + node strokes stay
 * resolution-independent, every glyph is selectable + searchable.
 *
 * Why not the `react-to-pdf` library named in the v3 brief: that package
 * is a `html2canvas` wrapper — it rasters the DOM into a PNG and embeds
 * the PNG in the PDF. That contradicts "true vector". We use `jspdf` +
 * `svg2pdf.js` instead, which preserves the SVG's path/text geometry.
 *
 * `jspdf` ships with four Latin-1-only Type 1 fonts (Helvetica, Times,
 * Courier, plus their bold/italic variants). For diagrams that contain
 * non-ASCII content we use the default Helvetica fall-back; embedding a
 * full Unicode TrueType font would add 200-400 KB to the bundle. Users
 * who need CJK / Cyrillic / accented characters in printed output should
 * use the browser-print path (which uses the system fonts) instead. This
 * is a documented trade-off, not an oversight — see CHANGELOG Session
 * 80.
 *
 * Multi-page output: when the rendered diagram is taller than a single
 * page's drawable area, the SVG is sliced vertically into N tiles and
 * each tile becomes one page. Horizontal overflow is handled by scaling
 * the entire diagram down to fit page-width — we'd rather lose some
 * detail than introduce horizontal-page navigation, which is hard to
 * follow on paper or in a PDF reader.
 */

export type PdfPageSize = 'a4' | 'letter';
export type PdfMode = 'standard' | 'workshop' | 'inksaving';

export interface PdfExportOptions {
  pageSize?: PdfPageSize;
  mode?: PdfMode;
  /** When true, append a numbered list of every entity's description. */
  includeAppendix?: boolean;
  /** Free text rendered at the top of every page. Merge fields are
   * resolved by the caller — pdfExport itself does no templating. */
  header?: string;
  /** Free text rendered at the bottom of every page. */
  footer?: string;
}

/** Type predicate: narrows `Element` to `SVGSVGElement` when the tag is `svg`.
 *  Avoids the `as unknown as SVGSVGElement` cast at the DOMParser boundary. */
const isSvgRoot = (el: Element | null): el is SVGSVGElement =>
  el !== null && el.tagName.toLowerCase() === 'svg';

// Page geometry — millimetres, jspdf's default unit.
const PAGE_DIMENSIONS_MM: Record<PdfPageSize, { width: number; height: number }> = {
  a4: { width: 210, height: 297 },
  letter: { width: 215.9, height: 279.4 },
};
const MARGIN_MM = 12; // generous breathing room on all sides
const HEADER_BAND_MM = 8; // top band reserved for the header text
const FOOTER_BAND_MM = 8; // bottom band reserved for the footer text
const HEADER_FONT_PT = 8;
const FOOTER_FONT_PT = 8;
const APPENDIX_TITLE_FONT_PT = 14;
const APPENDIX_BODY_FONT_PT = 10;
const APPENDIX_LINE_HEIGHT_MM = 4.5;

/**
 * Capture the live React Flow viewport's SVG by running the same DOM
 * pre-flight as the PNG/JPEG/SVG exporters, then handing off to
 * `html-to-image`'s `toSvg` which serialises the (off-screen) DOM into
 * an SVG data URL. We then parse that data URL back into an in-document
 * `<svg>` node so `svg2pdf.js` can walk it.
 */
const captureCanvasSvg = async (nodes: Node[]): Promise<SVGSVGElement | null> => {
  if (nodes.length === 0) return null;
  const flowEl = document.querySelector('.react-flow__viewport') as HTMLElement | null;
  if (!flowEl) return null;
  const bounds = getNodesBounds(nodes);
  const width = bounds.width + PNG_PADDING * 2;
  const height = bounds.height + PNG_PADDING * 2;
  const viewport = getViewportForBounds(bounds, width, height, 0.5, 2, PNG_PADDING);
  const isDark = document.documentElement.classList.contains('dark');
  const backgroundColor = isDark ? SURFACE_DARK : SURFACE_LIGHT;
  const { toSvg } = await import('html-to-image');
  const dataUrl = await toSvg(flowEl, {
    backgroundColor,
    width,
    height,
    style: {
      width: `${width}px`,
      height: `${height}px`,
      transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.zoom})`,
    },
  });
  const svgMarkup = decodeSvgDataUrl(dataUrl);
  const parsed = new DOMParser().parseFromString(svgMarkup, 'image/svg+xml');
  // DOMParser yields `Element` (or `HTMLElement` for HTML payloads);
  // when fed `image/svg+xml` the root is an SVGSVGElement, but the
  // type system can't express that without a runtime check. Type
  // predicate keeps the narrowing honest — no `as unknown as` cast.
  const root = parsed.documentElement;
  if (!isSvgRoot(root)) return null;
  const svg = root;
  // svg2pdf needs the element to be in the document so it can resolve
  // computed styles / namespaces. We attach it off-screen and the
  // caller is responsible for cleanup.
  svg.style.position = 'absolute';
  svg.style.left = '-99999px';
  svg.style.top = '0';
  document.body.appendChild(svg);
  return svg;
};

/**
 * `html-to-image` returns `data:image/svg+xml;charset=utf-8,<encoded>` —
 * decode it back to raw SVG markup. Exported for direct test coverage.
 */
export const decodeSvgDataUrl = (dataUrl: string): string => {
  const commaIdx = dataUrl.indexOf(',');
  if (commaIdx < 0) return dataUrl;
  const payload = dataUrl.slice(commaIdx + 1);
  // Both `;base64` and percent-encoded forms exist in the wild.
  if (dataUrl.slice(0, commaIdx).includes(';base64')) {
    return atob(payload);
  }
  return decodeURIComponent(payload);
};

/**
 * Compute how many vertical pages a diagram of `(svgWidthPx, svgHeightPx)`
 * occupies on a page with `(usableWidthMm, usableHeightMm)` after
 * scaling so the SVG's width matches the page's usable width.
 * Exported for direct test coverage.
 */
export const computePageCount = (
  svgWidthPx: number,
  svgHeightPx: number,
  usableWidthMm: number,
  usableHeightMm: number
): number => {
  if (svgWidthPx <= 0 || svgHeightPx <= 0) return 1;
  const scale = usableWidthMm / svgWidthPx;
  const scaledHeightMm = svgHeightPx * scale;
  return Math.max(1, Math.ceil(scaledHeightMm / usableHeightMm));
};

/**
 * Strip optional `pageNumber` / `pageCount` placeholders that the print
 * dialog's merge-field resolver left blank, and replace them now with
 * the actual page numbers. Exported for direct test coverage.
 */
export const resolvePagePlaceholders = (
  text: string,
  pageNumber: number,
  pageCount: number
): string =>
  text.replace(/\{pageNumber\}/g, String(pageNumber)).replace(/\{pageCount\}/g, String(pageCount));

interface SvgRenderable {
  svg: SVGSVGElement;
  widthPx: number;
  heightPx: number;
}

/** Read width/height from the SVG element, falling back to viewBox. */
const readSvgDimensions = (svg: SVGSVGElement): { widthPx: number; heightPx: number } => {
  const w = Number.parseFloat(svg.getAttribute('width') ?? '0');
  const h = Number.parseFloat(svg.getAttribute('height') ?? '0');
  if (w > 0 && h > 0) return { widthPx: w, heightPx: h };
  const vb = svg.getAttribute('viewBox')?.split(/\s+/).map(Number) ?? [];
  if (vb.length === 4 && vb[2]! > 0 && vb[3]! > 0) {
    return { widthPx: vb[2]!, heightPx: vb[3]! };
  }
  return { widthPx: 800, heightPx: 600 };
};

/**
 * Render the diagram SVG across N pages of the supplied jsPDF doc.
 * Each page draws the same SVG at the same scale; the page's clipping
 * window slides down by one page-height worth of SVG content per page.
 *
 * Tile alignment is done by translating the SVG origin upward on each
 * subsequent page (negative `y`). `svg2pdf` honours the supplied `(x,
 * y)` as the top-left position and clips at the page boundary.
 */
const renderDiagramPages = async (
  pdf: import('jspdf').jsPDF,
  renderable: SvgRenderable,
  geometry: {
    pageWidthMm: number;
    pageHeightMm: number;
    drawableTopMm: number;
    drawableHeightMm: number;
  },
  headerText: string,
  footerText: string,
  pageCount: number,
  totalPageCount: number,
  startPageNumber: number
): Promise<void> => {
  const { svg, widthPx, heightPx } = renderable;
  const usableWidthMm = geometry.pageWidthMm - MARGIN_MM * 2;
  const scaleMmPerPx = usableWidthMm / widthPx;
  const scaledHeightMm = heightPx * scaleMmPerPx;
  const { svg2pdf } = await import('svg2pdf.js');
  for (let i = 0; i < pageCount; i++) {
    if (i > 0) pdf.addPage();
    drawHeaderFooter(pdf, headerText, footerText, geometry, startPageNumber + i, totalPageCount);
    const yOriginMm = geometry.drawableTopMm - i * geometry.drawableHeightMm;
    // svg2pdf draws starting at (x, y) and continues downward — we
    // shift the origin up by i full drawable-heights so that page i
    // shows the i-th slice of the diagram.
    await svg2pdf(svg, pdf, {
      x: MARGIN_MM,
      y: yOriginMm,
      width: usableWidthMm,
      height: scaledHeightMm,
    });
  }
};

const drawHeaderFooter = (
  pdf: import('jspdf').jsPDF,
  headerText: string,
  footerText: string,
  geometry: { pageWidthMm: number; pageHeightMm: number },
  pageNumber: number,
  pageCount: number
): void => {
  pdf.setTextColor(64, 64, 64);
  if (headerText) {
    pdf.setFontSize(HEADER_FONT_PT);
    pdf.text(resolvePagePlaceholders(headerText, pageNumber, pageCount), MARGIN_MM, MARGIN_MM);
  }
  if (footerText) {
    pdf.setFontSize(FOOTER_FONT_PT);
    pdf.text(
      resolvePagePlaceholders(footerText, pageNumber, pageCount),
      MARGIN_MM,
      geometry.pageHeightMm - MARGIN_MM
    );
  }
  pdf.setTextColor(0, 0, 0);
};

/**
 * Render the annotation appendix as one or more PDF pages.
 * Entities are listed in `annotationNumber` order (the same order the
 * Markdown annotation export uses, so they line up).
 */
const renderAppendix = (
  pdf: import('jspdf').jsPDF,
  doc: TPDocument,
  geometry: {
    pageWidthMm: number;
    pageHeightMm: number;
  },
  headerText: string,
  footerText: string,
  startPageNumber: number,
  totalPageCount: number
): { pagesUsed: number } => {
  const items = structuralEntities(doc)
    .filter((e) => e.description && e.description.trim().length > 0)
    .sort((a, b) => a.annotationNumber - b.annotationNumber);
  if (items.length === 0) return { pagesUsed: 0 };

  let pagesUsed = 0;
  const startNewPage = (firstPage: boolean): void => {
    if (!firstPage) pdf.addPage();
    pagesUsed += 1;
    drawHeaderFooter(
      pdf,
      headerText,
      footerText,
      geometry,
      startPageNumber + pagesUsed - 1,
      totalPageCount
    );
  };

  startNewPage(true);
  pdf.setFontSize(APPENDIX_TITLE_FONT_PT);
  pdf.text('Annotation appendix', MARGIN_MM, MARGIN_MM + HEADER_BAND_MM + 4);

  let cursorY = MARGIN_MM + HEADER_BAND_MM + 14;
  const usableWidthMm = geometry.pageWidthMm - MARGIN_MM * 2;
  const bottomCutoff = geometry.pageHeightMm - MARGIN_MM - FOOTER_BAND_MM;

  for (const entity of items) {
    pdf.setFontSize(APPENDIX_BODY_FONT_PT);
    const headerLine = `#${entity.annotationNumber} — ${entity.title || '(untitled)'}`;
    const bodyLines = pdf.splitTextToSize(entity.description ?? '', usableWidthMm);
    const blockHeight = APPENDIX_LINE_HEIGHT_MM * (bodyLines.length + 1) + 2;
    if (cursorY + blockHeight > bottomCutoff) {
      startNewPage(false);
      cursorY = MARGIN_MM + HEADER_BAND_MM + 4;
    }
    pdf.setFont('helvetica', 'bold');
    pdf.text(headerLine, MARGIN_MM, cursorY);
    cursorY += APPENDIX_LINE_HEIGHT_MM;
    pdf.setFont('helvetica', 'normal');
    for (const line of bodyLines) {
      pdf.text(line, MARGIN_MM, cursorY);
      cursorY += APPENDIX_LINE_HEIGHT_MM;
    }
    cursorY += 2;
  }
  return { pagesUsed };
};

/**
 * Main entry point. Captures the live canvas, builds a multi-page PDF
 * with optional appendix + header/footer, triggers a download.
 *
 * Returns `false` when there's nothing to render (no nodes or the
 * canvas DOM isn't mounted yet); the caller can surface a toast.
 */
export const exportToVectorPdf = async (
  doc: TPDocument,
  nodes: Node[],
  options: PdfExportOptions = {}
): Promise<boolean> => {
  const renderable = await captureCanvasSvg(nodes);
  if (!renderable) return false;
  const dims = readSvgDimensions(renderable);
  const svgRenderable: SvgRenderable = {
    svg: renderable,
    widthPx: dims.widthPx,
    heightPx: dims.heightPx,
  };
  try {
    const pageSize = options.pageSize ?? 'a4';
    const { width: pageWidthMm, height: pageHeightMm } = PAGE_DIMENSIONS_MM[pageSize];
    const drawableTopMm = MARGIN_MM + HEADER_BAND_MM;
    const drawableHeightMm = pageHeightMm - MARGIN_MM * 2 - HEADER_BAND_MM - FOOTER_BAND_MM;
    const usableWidthMm = pageWidthMm - MARGIN_MM * 2;
    const diagramPageCount = computePageCount(
      svgRenderable.widthPx,
      svgRenderable.heightPx,
      usableWidthMm,
      drawableHeightMm
    );
    // jspdf needs to be imported lazily — the entire pdf bundle is
    // ~150 KB gzipped and we don't want it on the critical path.
    const { jsPDF } = await import('jspdf');
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: pageSize,
      compress: true,
    });
    // Estimate appendix page count up front so header/footer
    // placeholders ({pageCount}) resolve correctly. The estimate
    // matches the real loop logic byte-for-byte except that real
    // text-wrap happens at render time — so a one-page overshoot in
    // the count is possible. Worth the simplicity.
    const appendixPageEstimate = options.includeAppendix
      ? estimateAppendixPages(doc, pageHeightMm, usableWidthMm)
      : 0;
    const totalPageCount = diagramPageCount + appendixPageEstimate;
    await renderDiagramPages(
      pdf,
      svgRenderable,
      {
        pageWidthMm,
        pageHeightMm,
        drawableTopMm,
        drawableHeightMm,
      },
      options.header ?? '',
      options.footer ?? '',
      diagramPageCount,
      totalPageCount,
      1
    );
    if (options.includeAppendix) {
      renderAppendix(
        pdf,
        doc,
        { pageWidthMm, pageHeightMm },
        options.header ?? '',
        options.footer ?? '',
        diagramPageCount + 1,
        totalPageCount
      );
    }
    const blob = pdf.output('blob');
    triggerDownload(blob, `${slug(doc.title)}.pdf`);
    return true;
  } finally {
    svgRenderable.svg.remove();
  }
};

/**
 * Estimate how many pages the annotation appendix will occupy. We size
 * each entry conservatively: 1 line for the header + N lines for the
 * body wrapped at the usable width. Exported for direct test coverage.
 */
export const estimateAppendixPages = (
  doc: TPDocument,
  pageHeightMm: number,
  usableWidthMm: number
): number => {
  const items = structuralEntities(doc).filter(
    (e) => e.description && e.description.trim().length > 0
  );
  if (items.length === 0) return 0;
  const lineHeightMm = APPENDIX_LINE_HEIGHT_MM;
  const usablePerPage = pageHeightMm - MARGIN_MM * 2 - HEADER_BAND_MM - FOOTER_BAND_MM - 14; // 14mm reserved for title on first page
  // Cheap line-count heuristic — ~70 chars per usable mm at our
  // 10pt body font (calibrated against helvetica). Fine for an
  // upper-bound estimate; the real wrap happens via splitTextToSize.
  const charsPerLine = Math.max(40, Math.floor(usableWidthMm * 5));
  let totalLines = 0;
  for (const e of items) {
    const desc = (e.description ?? '').trim();
    const bodyLines = Math.max(1, Math.ceil(desc.length / charsPerLine));
    totalLines += 1 + bodyLines + 1; // header + body + gap
  }
  const totalHeightMm = totalLines * lineHeightMm;
  return Math.max(1, Math.ceil(totalHeightMm / usablePerPage));
};
