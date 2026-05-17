/**
 * Session 94 (Top-30 #4) — shared infrastructure for PDF exporters.
 *
 * Both `src/services/pdfExport.ts` (the canvas vector PDF) and
 * `src/services/ecWorkshopExport.ts` (the one-page EC workshop sheet)
 * lazy-import `jspdf` the same way. The `import('jspdf')` dynamic-import
 * sits in one place so the bundle splitter consistently emits a single
 * jspdf chunk; a future PDF exporter calls `loadJsPdf()` and gets the
 * same lazy-loaded constructor.
 *
 * Session 112 knip pass — `PAGE_DIMENSIONS_MM` / `dimensionsFor` /
 * `sanitizeForLatin1Pdf` / `PdfPageSize` / `PdfOrientation` were
 * authored alongside `loadJsPdf` but the two exporters declare their
 * own page-dimensions and don't use the sanitizer. Removed as
 * unused; add back from real call-site demand if a third PDF
 * exporter ever wants them.
 */
import type { jsPDF } from 'jspdf';

/**
 * Lazy-load jspdf and return a ready-to-construct `jsPDF` class. The
 * caller decides orientation / unit / format. Awaited in async export
 * paths so the import lands only when the user actually invokes a
 * PDF export — keeping the eager bundle under the 200-KB-gz target.
 */
export const loadJsPdf = async (): Promise<typeof jsPDF> => {
  const { jsPDF: ctor } = await import('jspdf');
  return ctor;
};
