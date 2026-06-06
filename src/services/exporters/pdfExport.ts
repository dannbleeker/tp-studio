import { getNodesBounds, getViewportForBounds, type Node } from '@xyflow/react';
import { PNG_PADDING } from '@/domain/constants';
import { structuralEntities } from '@/domain/graph';
import { printLegendFor } from '@/domain/printLegend';
import { buildReasoningSentences } from '@/domain/reasoningExport';
import { SURFACE_DARK, SURFACE_LIGHT } from '@/domain/tokens';
import type { DiagramType, TPDocument } from '@/domain/types';
import { loadJsPdf } from '@/services/exporters/pdfShared';
import { slug, triggerDownload } from '@/services/exporters/shared';

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
  /** Session 178 — page orientation. Defaults to portrait; landscape swaps
   *  the page width/height so the existing pagination math just works. */
  orientation?: 'portrait' | 'landscape';
  mode?: PdfMode;
  /** When true, append a numbered list of every entity's description. */
  includeAppendix?: boolean;
  /** When true, append the cause→effect reasoning read-out (one numbered
   *  sentence per link in topological order). */
  includeReasoning?: boolean;
  /** When true, print the diagram's one-line, type-specific "how to read this"
   *  legend under the header on every diagram page (parity with the
   *  browser-print `PrintLegend`). Freeform diagrams have no rule, so nothing
   *  is reserved or drawn for them. */
  includeLegend?: boolean;
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

/**
 * Yield to the browser's paint cycle so any pending React renders (e.g.,
 * the caller's "busy" state flip) can flush before this function takes
 * over the main thread. `requestAnimationFrame` is the right tool — it
 * resolves after the next paint, which is exactly when we want the
 * "Saving…" button label to be on screen.
 */
const yieldToPaint = (): Promise<void> =>
  new Promise((resolve) => {
    if (typeof requestAnimationFrame === 'function') {
      requestAnimationFrame(() => resolve());
    } else {
      // jsdom + Node test environments don't have rAF; fall through to
      // setTimeout(0) so unit tests don't hang.
      setTimeout(resolve, 0);
    }
  });

// Page geometry — millimetres, jspdf's default unit.
const PAGE_DIMENSIONS_MM: Record<PdfPageSize, { width: number; height: number }> = {
  a4: { width: 210, height: 297 },
  letter: { width: 215.9, height: 279.4 },
};
const MARGIN_MM = 12; // generous breathing room on all sides
const HEADER_BAND_MM = 8; // top band reserved for the header text
const FOOTER_BAND_MM = 8; // bottom band reserved for the footer text
// Y of the first row below the header band: the legend draws here and the
// diagram's drawable area starts here (+ the legend band, when present). One
// name so `drawLegend` and `drawableTopMm` can't drift apart.
const HEADER_BAND_BOTTOM_MM = MARGIN_MM + HEADER_BAND_MM;
const HEADER_FONT_PT = 8;
const FOOTER_FONT_PT = 8;
const APPENDIX_TITLE_FONT_PT = 14;
const APPENDIX_BODY_FONT_PT = 10;
const APPENDIX_LINE_HEIGHT_MM = 4.5;
// How-to-read legend (Session 179) — a touch smaller than the appendix body so
// it reads as a caption; italic + the same #525252 gray as the browser-print
// `PrintLegend` block.
const LEGEND_FONT_PT = 9;
const LEGEND_LINE_HEIGHT_MM = 4;
// Breathing room between the legend band and the diagram below it.
const LEGEND_GAP_MM = 2;

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
  startPageNumber: number,
  legendLines: readonly string[]
): Promise<void> => {
  const { svg, widthPx, heightPx } = renderable;
  const usableWidthMm = geometry.pageWidthMm - MARGIN_MM * 2;
  const scaleMmPerPx = usableWidthMm / widthPx;
  const scaledHeightMm = heightPx * scaleMmPerPx;
  const { svg2pdf } = await import('svg2pdf.js');
  for (let i = 0; i < pageCount; i++) {
    if (i > 0) pdf.addPage();
    drawHeaderFooter(pdf, headerText, footerText, geometry, startPageNumber + i, totalPageCount);
    // Legend on every diagram page (not just the first) so each physical sheet
    // of a multi-page export stays self-explanatory. The band it sits in is
    // already reserved out of `drawableTopMm`, so the diagram below never
    // collides with it.
    drawLegend(pdf, legendLines);
    const yOriginMm = geometry.drawableTopMm - i * geometry.drawableHeightMm;
    // Clip each page to its drawable band before drawing the diagram. The full
    // SVG is drawn on every page (shifted up by i slices), so without a clip a
    // multi-page diagram bleeds over the header/footer/legend bands AND
    // duplicates the bottom of page i at the top of page i+1. Clipping to one
    // drawable-height band fixes both — the slices tile seamlessly. svg2pdf
    // renders inside this graphics state, so its output is clipped too.
    // `rect(…, null)` + `clip()` + `discardPath()` defines a clip region, not a
    // stroked border (a bare `rect` would paint one); save/restore scopes the
    // clip to this page.
    pdf.saveGraphicsState();
    pdf.rect(MARGIN_MM, geometry.drawableTopMm, usableWidthMm, geometry.drawableHeightMm, null);
    pdf.clip();
    pdf.discardPath();
    // svg2pdf draws starting at (x, y) and continues downward — we
    // shift the origin up by i full drawable-heights so that page i
    // shows the i-th slice of the diagram.
    await svg2pdf(svg, pdf, {
      x: MARGIN_MM,
      y: yOriginMm,
      width: usableWidthMm,
      height: scaledHeightMm,
    });
    pdf.restoreGraphicsState();
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

/** Apply the legend's font (family + size). Shared by the measure pass
 *  (`resolveLegendLines`) and the draw pass (`drawLegend`) so the width the
 *  band is sized against always matches the width it's wrapped to when drawn. */
const setLegendFont = (pdf: import('jspdf').jsPDF): void => {
  pdf.setFont('helvetica', 'italic');
  pdf.setFontSize(LEGEND_FONT_PT);
};

/**
 * Wrap the how-to-read legend for `diagramType` to the usable page width using
 * the live jsPDF instance, so the band we reserve matches the text we draw
 * exactly (no estimate/draw drift). Returns `[]` when there's nothing to draw
 * — the toggle is off (`diagramType` is `null`) or it's a freeform diagram,
 * which has no fixed reading rule. Restores helvetica-normal afterwards.
 */
const resolveLegendLines = (
  pdf: import('jspdf').jsPDF,
  diagramType: DiagramType | null,
  usableWidthMm: number
): string[] => {
  if (!diagramType) return [];
  const legend = printLegendFor(diagramType);
  if (!legend) return [];
  setLegendFont(pdf);
  const lines = pdf.splitTextToSize(legend, usableWidthMm) as string[];
  pdf.setFont('helvetica', 'normal');
  return lines;
};

/**
 * Draw the wrapped legend lines in the band reserved just below the page
 * header (italic + #525252 gray, mirroring the browser-print `PrintLegend`).
 * No-op when there's nothing to draw. Restores helvetica-normal + black so the
 * diagram render that follows is unaffected.
 */
const drawLegend = (pdf: import('jspdf').jsPDF, legendLines: readonly string[]): void => {
  if (legendLines.length === 0) return;
  setLegendFont(pdf);
  pdf.setTextColor(82, 82, 82); // #525252 — matches PrintLegend on screen/print
  let y = HEADER_BAND_BOTTOM_MM + LEGEND_LINE_HEIGHT_MM;
  for (const line of legendLines) {
    pdf.text(line, MARGIN_MM, y);
    y += LEGEND_LINE_HEIGHT_MM;
  }
  pdf.setFont('helvetica', 'normal');
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
  // Always begin a fresh page. A diagram page is always rendered before the
  // appendix, so the FIRST appendix page must add one too — otherwise the
  // appendix overlays the diagram's last page on a single-page diagram.
  // (Session 177 bug fix; keeps `{pageCount}` honest since the appendix now
  // occupies the physical pages its estimate already reserved.)
  const startNewPage = (): void => {
    pdf.addPage();
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

  startNewPage();
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
      startNewPage();
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
 * Render the reasoning companion as one or more PDF pages — the cause→effect
 * read-out, one numbered sentence per link in topological order (the same
 * `buildReasoningSentences` the on-screen verbalisation + the Markdown export
 * use). Mirrors {@link renderAppendix}.
 */
const renderReasoning = (
  pdf: import('jspdf').jsPDF,
  sentences: readonly string[],
  geometry: { pageWidthMm: number; pageHeightMm: number },
  headerText: string,
  footerText: string,
  startPageNumber: number,
  totalPageCount: number
): { pagesUsed: number } => {
  if (sentences.length === 0) return { pagesUsed: 0 };
  let pagesUsed = 0;
  const startNewPage = (): void => {
    pdf.addPage();
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

  startNewPage();
  pdf.setFontSize(APPENDIX_TITLE_FONT_PT);
  pdf.text('Reasoning', MARGIN_MM, MARGIN_MM + HEADER_BAND_MM + 4);

  let cursorY = MARGIN_MM + HEADER_BAND_MM + 14;
  const usableWidthMm = geometry.pageWidthMm - MARGIN_MM * 2;
  const bottomCutoff = geometry.pageHeightMm - MARGIN_MM - FOOTER_BAND_MM;
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(APPENDIX_BODY_FONT_PT);

  sentences.forEach((sentence, i) => {
    const bodyLines = pdf.splitTextToSize(`${i + 1}. ${sentence}`, usableWidthMm);
    const blockHeight = APPENDIX_LINE_HEIGHT_MM * bodyLines.length + 2;
    if (cursorY + blockHeight > bottomCutoff) {
      startNewPage();
      cursorY = MARGIN_MM + HEADER_BAND_MM + 4;
    }
    for (const line of bodyLines) {
      pdf.text(line, MARGIN_MM, cursorY);
      cursorY += APPENDIX_LINE_HEIGHT_MM;
    }
    cursorY += 2;
  });
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
  // Session 129 (#16) — yield once so React can paint the caller's
  // "Saving…" busy state before the synchronous body of the export
  // consumes the main thread. The caller (PrintPreviewDialog) flips
  // `pdfBusy` then awaits this function; without a yield, the button
  // never repaints before the SVG capture + svg2pdf walk run.
  //
  // True workerization (the original FL-#16 framing) is blocked by
  // svg2pdf.js's 12+ DOM accesses (document.querySelector + computed
  // styles + DOMParser internals). Moving the whole pipeline to a
  // Web Worker would need a jsdom shim there, which trades main-
  // thread freeze for a much heavier dev surface. Yielding before
  // the work + the "Saving…" button label gives users the same
  // user-visible signal without the worker-shim complexity.
  await yieldToPaint();
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
    const orientation = options.orientation ?? 'portrait';
    const base = PAGE_DIMENSIONS_MM[pageSize];
    // Landscape simply swaps the page's width/height; every downstream
    // calculation reads `pageWidthMm` / `pageHeightMm`, so the pagination,
    // header/footer bands and vertical slicing all follow for free.
    const pageWidthMm = orientation === 'landscape' ? base.height : base.width;
    const pageHeightMm = orientation === 'landscape' ? base.width : base.height;
    const usableWidthMm = pageWidthMm - MARGIN_MM * 2;

    // jspdf needs to be imported lazily — the entire pdf bundle is
    // ~150 KB gzipped and we don't want it on the critical path.
    // Session 94 (Top-30 #4) — routed through `loadJsPdf` so the
    // dynamic-import sits in one shared module. Created before the
    // page-count math so the how-to-read legend can be wrapped with the
    // real `splitTextToSize` and the band it needs reserved exactly.
    const jsPDF = await loadJsPdf();
    const pdf = new jsPDF({
      orientation,
      unit: 'mm',
      format: pageSize,
      compress: true,
    });

    // How-to-read legend band — reserved out of the drawable height on every
    // diagram page (parity with the browser-print `PrintLegend`). Empty when
    // the toggle is off or the diagram is freeform (no fixed reading rule).
    const legendLines = resolveLegendLines(
      pdf,
      options.includeLegend ? doc.diagramType : null,
      usableWidthMm
    );
    const legendBandMm = legendLines.length
      ? legendLines.length * LEGEND_LINE_HEIGHT_MM + LEGEND_GAP_MM
      : 0;

    const drawableTopMm = HEADER_BAND_BOTTOM_MM + legendBandMm;
    const drawableHeightMm =
      pageHeightMm - MARGIN_MM * 2 - HEADER_BAND_MM - FOOTER_BAND_MM - legendBandMm;
    const diagramPageCount = computePageCount(
      svgRenderable.widthPx,
      svgRenderable.heightPx,
      usableWidthMm,
      drawableHeightMm
    );
    // Estimate appendix page count up front so header/footer
    // placeholders ({pageCount}) resolve correctly. The estimate
    // matches the real loop logic byte-for-byte except that real
    // text-wrap happens at render time — so a one-page overshoot in
    // the count is possible. Worth the simplicity.
    const appendixPageEstimate = options.includeAppendix
      ? estimateAppendixPages(doc, pageHeightMm, usableWidthMm)
      : 0;
    const reasoningSentences = options.includeReasoning ? buildReasoningSentences(doc) : [];
    const reasoningPageEstimate = options.includeReasoning
      ? estimateReasoningPages(reasoningSentences, pageHeightMm, usableWidthMm)
      : 0;
    const totalPageCount = diagramPageCount + appendixPageEstimate + reasoningPageEstimate;
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
      1,
      legendLines
    );
    let extraPages = 0;
    if (options.includeAppendix) {
      const { pagesUsed } = renderAppendix(
        pdf,
        doc,
        { pageWidthMm, pageHeightMm },
        options.header ?? '',
        options.footer ?? '',
        diagramPageCount + 1,
        totalPageCount
      );
      extraPages += pagesUsed;
    }
    if (options.includeReasoning) {
      renderReasoning(
        pdf,
        reasoningSentences,
        { pageWidthMm, pageHeightMm },
        options.header ?? '',
        options.footer ?? '',
        diagramPageCount + extraPages + 1,
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

/**
 * Estimate how many pages the reasoning companion will occupy — one numbered
 * sentence per link, conservatively line-counted at the usable width (+1 line of
 * gap each). Exported for direct test coverage.
 */
export const estimateReasoningPages = (
  sentences: readonly string[],
  pageHeightMm: number,
  usableWidthMm: number
): number => {
  if (sentences.length === 0) return 0;
  const usablePerPage = pageHeightMm - MARGIN_MM * 2 - HEADER_BAND_MM - FOOTER_BAND_MM - 14;
  const charsPerLine = Math.max(40, Math.floor(usableWidthMm * 5));
  let totalLines = 0;
  for (const s of sentences) {
    // +4 for the "N. " numbering prefix.
    totalLines += Math.max(1, Math.ceil((s.length + 4) / charsPerLine)) + 1;
  }
  return Math.max(1, Math.ceil((totalLines * APPENDIX_LINE_HEIGHT_MM) / usablePerPage));
};
