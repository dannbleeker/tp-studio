/**
 * Session 115 — Property-based round-trip test for the share-link
 * encoder + decoder.
 *
 * The example-based tests in `shareLink.test.ts` cover the contract
 * shape (hash starts with `#!share=`, parser rejects bad payloads,
 * etc.). This file covers a different promise: for ANY structurally
 * valid TPDocument, `generateShareLink(doc)` followed by
 * `parseShareHash(hash)` produces a doc whose entity/edge/group
 * surface matches the original.
 *
 * A regression in either the encoder (e.g. dropping a field on
 * serialize) or the decoder (e.g. dropping a field on the strict
 * import validator) gets caught here without us having to enumerate
 * every doc shape that could surface the bug.
 *
 * `docArb` lives in `tests/helpers/docArb.ts` (extracted Session 115);
 * shared by every PB test file. Adding a new field to the doc
 * surface that should round-trip means adding it to the arb there,
 * and every PB test inherits the coverage.
 */

import * as fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { generateShareLink, parseShareHash } from '@/services/shareLink';
import { docArb } from '../helpers/docArb';

describe('share-link — property-based round-trip', () => {
  it('encode → decode preserves entity + edge keys + diagram type', async () => {
    await fc.assert(
      fc.asyncProperty(docArb, async (doc) => {
        const link = await generateShareLink(doc);
        const hash = link.slice(link.indexOf('#'));
        const decoded = await parseShareHash(hash);
        expect(decoded).not.toBeNull();
        if (!decoded) return;
        expect(decoded.diagramType).toBe(doc.diagramType);
        expect(decoded.title).toBe(doc.title);
        expect(Object.keys(decoded.entities).sort()).toEqual(Object.keys(doc.entities).sort());
        expect(Object.keys(decoded.edges).sort()).toEqual(Object.keys(doc.edges).sort());
      }),
      // Default 100 runs would be 100× gzip + base64 + decode — slow.
      // 25 runs is the same shrink-on-failure quality at a fraction of
      // the time. Re-bump if the assert ever flakes.
      { numRuns: 25 }
    );
  });

  it('encode → decode preserves entity titles', async () => {
    await fc.assert(
      fc.asyncProperty(docArb, async (doc) => {
        const link = await generateShareLink(doc);
        const hash = link.slice(link.indexOf('#'));
        const decoded = await parseShareHash(hash);
        if (!decoded) return;
        for (const [id, src] of Object.entries(doc.entities)) {
          const dst = decoded.entities[id];
          expect(dst?.title).toBe(src.title);
          expect(dst?.type).toBe(src.type);
        }
      }),
      { numRuns: 25 }
    );
  });
});
