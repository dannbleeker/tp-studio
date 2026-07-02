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

/**
 * Session 193 — true when `text` contains any character outside the Latin-1
 * (ISO-8859-1, code point ≤ 0xFF) range.
 *
 * jsPDF's built-in fonts encode WinAnsi/Latin-1 only, so glyphs beyond that
 * range — CJK, Cyrillic, Greek, Arabic, Hebrew, Devanagari, emoji … — drop
 * or mis-render in both the vector PDF (`pdfExport`) and the EC workshop
 * sheet (`ecWorkshopExport`). The Print/Save-as-PDF dialog uses this to warn
 * before a user exports a diagram whose text won't survive the built-in
 * fonts; browser print (Ctrl/Cmd+P) uses system fonts and is unaffected.
 */
export const hasNonLatin1 = (text: string): boolean => {
  for (const ch of text) {
    const cp = ch.codePointAt(0);
    if (cp !== undefined && cp > 0xff) return true;
  }
  return false;
};
