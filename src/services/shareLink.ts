import { exportToJSON, importFromJSON } from '@/domain/persistence';
import type { TPDocument } from '@/domain/types';
import { errorMessage } from './errors';

/**
 * FL-CO1 — Reader Mode share-link.
 *
 * Encode a TP Studio document into a URL fragment (`#!share=<payload>`)
 * that the receiver can open to view the diagram in read-only mode. The
 * doc is compressed with the native `CompressionStream('gzip')` API and
 * base64-url encoded into the hash, so the entire share link is the URL
 * — no server, no upload, no account, nothing to expire.
 *
 * Trade-offs:
 *   - URL length grows with diagram size. A typical 20-entity CRT lands
 *     under 2 KB compressed (well within typical email / chat clients);
 *     a 200-entity Goal Tree might push past 8 KB and start tripping
 *     length limits in some clients. We surface a soft warning above
 *     {@link SHARE_LINK_SOFT_WARN_BYTES} so the sender knows.
 *   - The fragment never reaches the server, but it IS visible in the
 *     receiver's browser history. Treat shared diagrams as "public
 *     enough to email" — same threat model as JSON export.
 *   - Requires `CompressionStream` (Chrome 80+, FF 113+, Safari 16.4+).
 *     Older browsers fall back to a clear "not supported" error.
 *
 * The receiver-side counterpart {@link parseShareHash} is called once on
 * boot from App.tsx; if it succeeds the doc is loaded and Browse Lock
 * auto-engages so the receiver can't accidentally edit a shared link.
 */

/** Prefix sentinel inside the URL fragment. Lets us tell a share link
 *  apart from any other future hash-routed feature (no clash with
 *  React-Flow's own fragment usage, which there is none of today). */
const SHARE_HASH_PREFIX = '#!share=';

/** Soft warning threshold for the encoded payload. Below this we copy
 *  silently; above, the caller gets a "warning, link is large" hint to
 *  pass along to the user. Email / chat clients vary on actual limits;
 *  4 KB is a conservative ceiling that works in Slack, Gmail, Outlook,
 *  and most issue trackers without truncation. */
export const SHARE_LINK_SOFT_WARN_BYTES = 4096;

/** URL-safe base64 alphabet: `+` → `-`, `/` → `_`, no `=` padding. */
const toUrlSafeBase64 = (s: string): string =>
  s.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

const fromUrlSafeBase64 = (s: string): string => {
  const padded = s.replace(/-/g, '+').replace(/_/g, '/');
  const padLen = (4 - (padded.length % 4)) % 4;
  return padded + '='.repeat(padLen);
};

const arrayBufferToBase64 = (buffer: ArrayBuffer): string => {
  // Chunked to avoid blowing the call stack on large docs — `apply`
  // with a 100KB Uint8Array slice still works on all engines, but
  // future-proofing for huge inputs is cheap.
  const bytes = new Uint8Array(buffer);
  const CHUNK = 0x8000;
  let binary = '';
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(binary);
};

const base64ToUint8Array = (b64: string): Uint8Array => {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
};

const compressionSupported = (): boolean =>
  typeof CompressionStream !== 'undefined' && typeof DecompressionStream !== 'undefined';

/**
 * Generate a read-only share link for the given document. The returned
 * string is a fully-qualified URL the caller can copy to the clipboard.
 *
 * Throws on browsers without `CompressionStream`. Callers should catch
 * and surface a "this browser doesn't support share links" toast.
 */
export const generateShareLink = async (doc: TPDocument): Promise<string> => {
  if (!compressionSupported()) {
    throw new Error(
      'Share links require a browser with CompressionStream (Chrome 80+, Firefox 113+, Safari 16.4+).'
    );
  }
  const json = exportToJSON(doc);
  // Build the readable stream by hand (single chunk) rather than via
  // `new Blob([json]).stream()` — Blob.stream() is widely supported in
  // real browsers but missing in jsdom, and a hand-rolled stream gives
  // us identical behaviour with no test-env shim.
  const encoded = new TextEncoder().encode(json);
  // Type-erase the source stream so `pipeThrough` accepts both
  // `Uint8Array<ArrayBuffer>` and `Uint8Array<ArrayBufferLike>` variants
  // of CompressionStream's writable side. The runtime is identical;
  // this is purely satisfying TS's stricter typed-array variance.
  const source: ReadableStream = new ReadableStream({
    start(controller) {
      controller.enqueue(encoded);
      controller.close();
    },
  });
  const compressed = source.pipeThrough(new CompressionStream('gzip'));
  const buffer = await new Response(compressed).arrayBuffer();
  const payload = toUrlSafeBase64(arrayBufferToBase64(buffer));
  const base = `${window.location.origin}${window.location.pathname}`;
  return `${base}${SHARE_HASH_PREFIX}${payload}`;
};

/**
 * Parse the current page's URL fragment for an embedded share payload
 * and return the decoded document. Returns `null` when the fragment
 * isn't a share link or the payload is malformed. Throws (rather than
 * returns null) when the payload IS a share link but decompression /
 * validation fails — the boot path surfaces that as an error toast so
 * the user understands why nothing loaded.
 */
export const parseShareHash = async (hash: string): Promise<TPDocument | null> => {
  if (!hash.startsWith(SHARE_HASH_PREFIX)) return null;
  if (!compressionSupported()) {
    throw new Error('This browser cannot open share links (missing CompressionStream support).');
  }
  const payload = hash.slice(SHARE_HASH_PREFIX.length);
  if (payload.length === 0) return null;
  try {
    const bytes = base64ToUint8Array(fromUrlSafeBase64(payload));
    // Hand-rolled ReadableStream mirrors the encoder side — avoids
    // depending on Blob.stream() which jsdom doesn't ship. Same
    // type-erase trick as `generateShareLink` for variance.
    const source: ReadableStream = new ReadableStream({
      start(controller) {
        controller.enqueue(bytes);
        controller.close();
      },
    });
    const decompressed = source.pipeThrough(new DecompressionStream('gzip'));
    const json = await new Response(decompressed).text();
    return importFromJSON(json);
  } catch (err) {
    throw new Error(`Share link could not be opened: ${errorMessage(err)}`);
  }
};

/** Strip the share fragment from the current URL without reloading. Used
 *  after a share-link load so a refresh doesn't keep re-loading the same
 *  shared doc (the receiver can now mutate, save, and own their copy if
 *  they ungate Browse Lock). */
export const clearShareHash = (): void => {
  if (typeof window === 'undefined') return;
  const { origin, pathname, search } = window.location;
  window.history.replaceState({}, '', `${origin}${pathname}${search}`);
};
