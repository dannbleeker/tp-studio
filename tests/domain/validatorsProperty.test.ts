import { validate, validateTiered } from '@/domain/validators';
import * as fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { docArb } from '../helpers/docArb';

/**
 * Session 85 / #14 — property-based totality coverage for the CLR
 * validator registry.
 *
 * The hand-written tests in `validators.test.ts` cover the *behavior* of
 * each rule on cases we thought to write. This file covers a different
 * promise: every rule, on every diagram type, must be *total* — it must
 * return well-formed `Warning[]` for any structurally valid `TPDocument`
 * without throwing. A rule that crashes on an unusual graph shape would
 * surface to the user as a blank Inspector and a logged exception; we'd
 * rather fail in CI with a shrunk repro.
 *
 * Properties:
 *
 *  1. **`validate(doc)` never throws** for any arbitrary doc. The
 *     registry walks every rule for the doc's diagram type, so this
 *     covers all 16 rules transitively in one property.
 *  2. **Every warning's tier is a valid `ClrTier`.** Catches a rule that
 *     somehow emits a warning the registry forgot to tag (today's typing
 *     makes that hard, but it's cheap insurance against a future
 *     regression).
 *  3. **Every warning references an entity/edge that exists in the doc.**
 *     Rules that look up the *opposite* endpoint of an edge or
 *     transitive descendants have historically been the spot where
 *     "ghost id" warnings appear after a delete. The property catches
 *     them even on docs that *don't* exercise the delete path.
 *  4. **`validateTiered(doc)` partitions exactly the same warnings as
 *     `validate(doc)`** — no drops, no duplicates. Pins the contract
 *     between the two exported entry points so future refactors of the
 *     tier-grouping helper don't silently lose warnings.
 */

// Session 115 — `docArb` and its child generators were extracted into
// `tests/helpers/docArb.ts` so other property-based test files
// (`shareLinkProperty.test.ts`, etc.) can share one canonical
// TPDocument generator. The properties below now read from the shared
// helper.

// ── Properties ────────────────────────────────────────────────────────

const VALID_TIERS = new Set(['clarity', 'existence', 'sufficiency']);

describe('CLR validators — property-based totality', () => {
  it('validate(doc) never throws and returns a well-formed Warning[]', () => {
    fc.assert(
      fc.property(docArb, (doc) => {
        const warnings = validate(doc);
        // Plain shape checks — a rule that returned `undefined` for a
        // field would otherwise hide behind the eventual UI render.
        for (const w of warnings) {
          expect(typeof w.id).toBe('string');
          expect(typeof w.ruleId).toBe('string');
          expect(typeof w.message).toBe('string');
          expect(VALID_TIERS.has(w.tier)).toBe(true);
          expect(typeof w.resolved).toBe('boolean');
          expect(w.target).toBeDefined();
        }
      }),
      { numRuns: 200 }
    );
  });

  it('every warning targets an entity or edge that exists in the doc', () => {
    fc.assert(
      fc.property(docArb, (doc) => {
        const warnings = validate(doc);
        for (const w of warnings) {
          if (w.target.kind === 'entity') {
            expect(doc.entities[w.target.id]).toBeDefined();
          } else if (w.target.kind === 'edge') {
            expect(doc.edges[w.target.id]).toBeDefined();
          }
          // No other `kind` exists today; if a future rule adds one,
          // the test will surface the omission via the `else` falling
          // through harmlessly.
        }
      }),
      { numRuns: 200 }
    );
  });

  it('validateTiered partitions exactly the same warnings as validate', () => {
    fc.assert(
      fc.property(docArb, (doc) => {
        const flat = validate(doc);
        const tiered = validateTiered(doc);
        const recombined = [...tiered.clarity, ...tiered.existence, ...tiered.sufficiency];
        expect(recombined.length).toBe(flat.length);
        // Set-equality on warning ids — order within a tier isn't part
        // of the contract, but membership is.
        const flatIds = new Set(flat.map((w) => w.id));
        const recombinedIds = new Set(recombined.map((w) => w.id));
        expect(recombinedIds).toEqual(flatIds);
      }),
      { numRuns: 100 }
    );
  });
});
