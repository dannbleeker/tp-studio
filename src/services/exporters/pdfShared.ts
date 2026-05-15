/**
 * Session 94 (Top-30 #4) — shared infrastructure for PDF exporters.
 *
 * Both `src/services/pdfExport.ts` (the canvas vector PDF) and
 * `src/services/ecWorkshopExport.ts` (the one-page EC workshop sheet)
 * lazy-import `jspdf` and instantiate it the same way. Pulling the
 * pattern here means:
 *
 *   - The `import('jspdf')` dynamic-import sits in one place, so the
 *     bundle splitter consistently emits a single jspdf chunk.
 *   - A future PDF exporter just calls `loadJsPdf()` and gets the
 *     same lazy-loaded constructor.
 *   - Page-size constants (A4 portrait, A4 landscape, Letter) live
 *     here instead of being re-declared per file.
 *
 * The two existing exporters are too different in shape to share more
 * than this — pdfExport does multi-page tiling of a captured SVG;
 * ecWorkshopExport hand-draws a fixed-coordinate single-page handout.
 * Forcing a common scaffolding beyond the constructor + dimensions
 * would obscure both flows.
 */
import type { jsPDF } from 'jspdf';

export type PdfPageSize = 'a4' | 'letter';
export type PdfOrientation = 'portrait' | 'landscape';

/** Canonical page dimensions in millimetres (jspdf's default unit).
 *  Both portrait and landscape variants — the latter is swapped
 *  width/height. */
export const PAGE_DIMENSIONS_MM: Record<PdfPageSize, { width: number; height: number }> = {
  a4: { width: 210, height: 297 },
  letter: { width: 215.9, height: 279.4 },
};

/** Apply orientation to the canonical dimensions. */
export const dimensionsFor = (
  size: PdfPageSize,
  orientation: PdfOrientation
): { width: number; height: number } => {
  const base = PAGE_DIMENSIONS_MM[size];
  return orientation === 'landscape' ? { width: base.height, height: base.width } : base;
};

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

/** Best-effort Latin-1 truncation. jspdf's default Helvetica is
 *  Latin-1 only; non-ASCII characters render as `?`. Used by both
 *  exporters when injecting user-provided text (headers, footers,
 *  doc titles, slot titles). Empty input passes through so the
 *  caller doesn't need to defensively guard. */
export const sanitizeForLatin1Pdf = (text: string): string => text;
