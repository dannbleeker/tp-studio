import {
  SHARE_LINK_MAX_DECOMPRESSED_BYTES,
  SHARE_LINK_SOFT_WARN_BYTES,
  clearShareHash,
  generateShareLink,
  parseShareHash,
} from '@/services/shareLink';
import { beforeEach, describe, expect, it } from 'vitest';
import { makeDoc, makeEdge, makeEntity, resetIds } from '../domain/helpers';

beforeEach(() => {
  resetIds();
});

/**
 * FL-CO1 — share-link round-trip. The generator gzips + URL-safe-base64s
 * the JSON; the parser decodes + decompresses + validates. A successful
 * round-trip is the contract; the boot path in App.tsx is responsible
 * for the side effects (`setDocument` + `setBrowseLocked`).
 *
 * `CompressionStream` is available in jsdom 25 / Node 20+ — these tests
 * run against the real implementation, not a polyfill.
 */

const sampleDoc = () => {
  const a = makeEntity({ type: 'rootCause', title: 'Root' });
  const b = makeEntity({ type: 'effect', title: 'Mid' });
  const c = makeEntity({ type: 'ude', title: 'UDE' });
  return makeDoc([a, b, c], [makeEdge(a.id, b.id), makeEdge(b.id, c.id)], 'crt');
};

describe('share-link round-trip', () => {
  it('encodes a doc into a URL whose hash starts with #!share=', async () => {
    const link = await generateShareLink(sampleDoc());
    const hash = link.slice(link.indexOf('#'));
    expect(hash.startsWith('#!share=')).toBe(true);
  });

  it('parseShareHash returns the original document', async () => {
    const doc = sampleDoc();
    const link = await generateShareLink(doc);
    const hash = link.slice(link.indexOf('#'));
    const decoded = await parseShareHash(hash);
    expect(decoded).not.toBeNull();
    expect(decoded?.title).toBe(doc.title);
    expect(Object.keys(decoded?.entities ?? {}).sort()).toEqual(Object.keys(doc.entities).sort());
    expect(Object.keys(decoded?.edges ?? {}).sort()).toEqual(Object.keys(doc.edges).sort());
  });

  it('parseShareHash returns null when the hash is not a share link', async () => {
    expect(await parseShareHash('')).toBeNull();
    expect(await parseShareHash('#some-other-hash')).toBeNull();
    expect(await parseShareHash('#!share=')).toBeNull();
  });

  it('parseShareHash throws on corrupted payload', async () => {
    await expect(parseShareHash('#!share=not-valid-base64-or-gzip')).rejects.toThrow(
      /could not be opened/i
    );
  });

  it('produces a link well under the soft-warn threshold for a small doc', async () => {
    const link = await generateShareLink(sampleDoc());
    expect(link.length).toBeLessThan(SHARE_LINK_SOFT_WARN_BYTES);
  });

  /**
   * Session 98 — gzip-bomb defense.
   *
   * A hostile attacker can craft a tiny gzip payload that expands to
   * gigabytes (the "zip bomb" pattern: a long run of zeros compresses
   * to almost nothing but decompresses without bound). Without a cap,
   * `await new Response(stream).text()` will happily allocate the whole
   * output and lock or crash the tab.
   *
   * We assert the cap fires by manufacturing a gzip stream whose
   * decompressed size exceeds {@link SHARE_LINK_MAX_DECOMPRESSED_BYTES}
   * and confirming the parser rejects it with a recognisable error
   * (rather than silently OOMing or returning a truncated doc).
   *
   * Building the payload at runtime — rather than checking in a binary
   * fixture — keeps the test deterministic across browsers and avoids
   * shipping a 5 MB blob in the repo.
   */
  it('rejects payloads whose decompressed size exceeds the cap', async () => {
    // 6 MB of zeros — well over the 5 MB ceiling, compresses to a
    // tiny payload thanks to the all-zeros run.
    const oversize = new Uint8Array(SHARE_LINK_MAX_DECOMPRESSED_BYTES + 1024 * 1024);
    const source: ReadableStream = new ReadableStream({
      start(controller) {
        controller.enqueue(oversize);
        controller.close();
      },
    });
    const compressed = source.pipeThrough(new CompressionStream('gzip'));
    const buf = await new Response(compressed).arrayBuffer();
    // Inline-encode to URL-safe base64 so we don't depend on the
    // module's private helper.
    const bytes = new Uint8Array(buf);
    let binary = '';
    const CHUNK = 0x8000;
    for (let i = 0; i < bytes.length; i += CHUNK) {
      binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
    }
    const payload = btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    await expect(parseShareHash(`#!share=${payload}`)).rejects.toThrow(/compression bomb|exceeds/i);
  });

  it('clearShareHash strips the fragment from the URL without reloading', () => {
    window.history.replaceState({}, '', '/?x=1#!share=abc123');
    expect(window.location.hash).toBe('#!share=abc123');
    clearShareHash();
    expect(window.location.hash).toBe('');
    expect(window.location.search).toBe('?x=1');
  });
});
