/**
 * Shared helpers for the per-format exporter files.
 *
 * `slug` is exported so tests can pin its edge cases directly; the
 * trigger-download helpers are internal — every per-format file calls one of
 * them at the end of its export pipeline.
 */

/**
 * Slugify a document title for filename use. Lowercase, non-alphanumeric
 * runs collapse to hyphens, leading/trailing hyphens are trimmed, the
 * result is capped at 60 chars, and an empty result falls back to "untitled".
 *
 * Exported for direct test coverage of the edge cases.
 */
export const slug = (s: string): string =>
  s
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'untitled';

/**
 * Trigger a browser download from a `Blob`. Creates an off-screen `<a>`
 * with an object URL, clicks it, removes it, and revokes the URL on the
 * next tick so the browser has time to start the download.
 */
export const triggerDownload = (blob: Blob, filename: string): void => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 0);
};

/**
 * Same as `triggerDownload` but for `data:` URLs (used by `html-to-image`
 * which returns data URLs directly). No object URL to revoke.
 */
export const triggerDataUrlDownload = (dataUrl: string, filename: string): void => {
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
};

/**
 * Session 135 — RFC 4180-safe CSV cell escaper. Quotes any cell
 * containing `,`, `"`, newline, or CR; doubles up internal quotes.
 * Empty / null / undefined values produce the empty cell. Shared so
 * every CSV exporter (`riskRegister.ts`, `ttTasks.ts`, …) uses one
 * encoder; previously each exporter duplicated this function inline.
 */
export const csvCell = (raw: string | number | undefined | null): string => {
  if (raw === undefined || raw === null) return '';
  const s = String(raw);
  if (s.length === 0) return '';
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
};

/**
 * Build one CSV row from an array of cells. Maps each cell through
 * `csvCell` for RFC-4180-correct escaping, then joins with commas.
 * Does NOT add a trailing newline — the caller controls line
 * terminators (Windows-style CRLF vs Unix LF) by joining with their
 * preferred separator.
 */
export const csvRow = (cells: (string | number | undefined | null)[]): string =>
  cells.map(csvCell).join(',');
