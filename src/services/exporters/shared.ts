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
