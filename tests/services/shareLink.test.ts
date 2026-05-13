import {
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

  it('clearShareHash strips the fragment from the URL without reloading', () => {
    window.history.replaceState({}, '', '/?x=1#!share=abc123');
    expect(window.location.hash).toBe('#!share=abc123');
    clearShareHash();
    expect(window.location.hash).toBe('');
    expect(window.location.search).toBe('?x=1');
  });
});
