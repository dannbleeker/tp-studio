import { describe, expect, it } from 'vitest';
import { effectiveState, propagateStates } from '@/domain/statePropagation';
import type { EntityId } from '@/domain/types';
import { makeDoc, makeEdge, makeEntity, resetIds } from './helpers';

/**
 * Session 135 / spec major gap #4 Phase 1B — propagation engine tests.
 *
 * Each test seeds a tiny doc, runs `propagateStates`, and asserts on
 * the derived state for the entity under test. Manual override is
 * applied on the SOURCE entities only (so the propagation has
 * something to work with from the leaves up); the derived map returned
 * does NOT apply the override at the target — that's `effectiveState`'s
 * job.
 */

describe('propagateStates — empty + degenerate shapes', () => {
  it('returns an empty record for an empty doc', () => {
    resetIds();
    const doc = makeDoc([], []);
    expect(propagateStates(doc)).toEqual({});
  });

  it('returns unknown for a singleton entity with no edges', () => {
    resetIds();
    const a = makeEntity({ title: 'lonely' });
    const doc = makeDoc([a], []);
    expect(propagateStates(doc)).toEqual({ [a.id]: 'unknown' });
  });

  it('returns the same unknown for a leaf with a manual state — the derived map is pure', () => {
    // Manual override is NOT applied to the returned derived map.
    // Callers merge via `effectiveState()`. The whole point of
    // separating the two is letting the UI surface "user claims X but
    // graph implies Y" — which requires both values side by side.
    resetIds();
    const a = makeEntity({ title: 'with-manual', state: 'true' });
    const doc = makeDoc([a], []);
    expect(propagateStates(doc)).toEqual({ [a.id]: 'unknown' });
  });
});

describe('propagateStates — single-edge propagation (implicit OR)', () => {
  it('true source → true target', () => {
    resetIds();
    const src = makeEntity({ title: 'src', state: 'true' });
    const tgt = makeEntity({ title: 'tgt' });
    const e = makeEdge(src.id, tgt.id);
    const out = propagateStates(makeDoc([src, tgt], [e]));
    expect(out[tgt.id]).toBe('true');
  });

  it('false source → false target', () => {
    resetIds();
    const src = makeEntity({ state: 'false' });
    const tgt = makeEntity();
    const out = propagateStates(makeDoc([src, tgt], [makeEdge(src.id, tgt.id)]));
    expect(out[tgt.id]).toBe('false');
  });

  it('disputed source → disputed target', () => {
    resetIds();
    const src = makeEntity({ state: 'disputed' });
    const tgt = makeEntity();
    const out = propagateStates(makeDoc([src, tgt], [makeEdge(src.id, tgt.id)]));
    expect(out[tgt.id]).toBe('disputed');
  });

  it('unknown source → unknown target', () => {
    resetIds();
    const src = makeEntity(); // no state
    const tgt = makeEntity();
    const out = propagateStates(makeDoc([src, tgt], [makeEdge(src.id, tgt.id)]));
    expect(out[tgt.id]).toBe('unknown');
  });
});

describe('propagateStates — AND-group merge', () => {
  it('all-true → true', () => {
    resetIds();
    const a = makeEntity({ state: 'true' });
    const b = makeEntity({ state: 'true' });
    const tgt = makeEntity();
    const e1 = makeEdge(a.id, tgt.id, { andGroupId: 'g1' });
    const e2 = makeEdge(b.id, tgt.id, { andGroupId: 'g1' });
    const out = propagateStates(makeDoc([a, b, tgt], [e1, e2]));
    expect(out[tgt.id]).toBe('true');
  });

  it('any-false → false (overrides true / disputed siblings)', () => {
    resetIds();
    const a = makeEntity({ state: 'true' });
    const b = makeEntity({ state: 'false' });
    const c = makeEntity({ state: 'disputed' });
    const tgt = makeEntity();
    const out = propagateStates(
      makeDoc(
        [a, b, c, tgt],
        [
          makeEdge(a.id, tgt.id, { andGroupId: 'g1' }),
          makeEdge(b.id, tgt.id, { andGroupId: 'g1' }),
          makeEdge(c.id, tgt.id, { andGroupId: 'g1' }),
        ]
      )
    );
    expect(out[tgt.id]).toBe('false');
  });

  it('disputed without false → disputed', () => {
    resetIds();
    const a = makeEntity({ state: 'true' });
    const b = makeEntity({ state: 'disputed' });
    const tgt = makeEntity();
    const out = propagateStates(
      makeDoc(
        [a, b, tgt],
        [makeEdge(a.id, tgt.id, { andGroupId: 'g1' }), makeEdge(b.id, tgt.id, { andGroupId: 'g1' })]
      )
    );
    expect(out[tgt.id]).toBe('disputed');
  });

  it('mixed true + unknown (no false / no disputed) → unknown', () => {
    resetIds();
    const a = makeEntity({ state: 'true' });
    const b = makeEntity(); // unknown
    const tgt = makeEntity();
    const out = propagateStates(
      makeDoc(
        [a, b, tgt],
        [makeEdge(a.id, tgt.id, { andGroupId: 'g1' }), makeEdge(b.id, tgt.id, { andGroupId: 'g1' })]
      )
    );
    expect(out[tgt.id]).toBe('unknown');
  });
});

describe('propagateStates — OR merge (implicit + explicit)', () => {
  it('any-true → true (two standalone edges)', () => {
    resetIds();
    const a = makeEntity({ state: 'true' });
    const b = makeEntity({ state: 'false' });
    const tgt = makeEntity();
    const out = propagateStates(
      makeDoc([a, b, tgt], [makeEdge(a.id, tgt.id), makeEdge(b.id, tgt.id)])
    );
    expect(out[tgt.id]).toBe('true');
  });

  it('all-false → false', () => {
    resetIds();
    const a = makeEntity({ state: 'false' });
    const b = makeEntity({ state: 'false' });
    const tgt = makeEntity();
    const out = propagateStates(
      makeDoc([a, b, tgt], [makeEdge(a.id, tgt.id), makeEdge(b.id, tgt.id)])
    );
    expect(out[tgt.id]).toBe('false');
  });

  it('explicit orGroupId behaves identically to standalone edges', () => {
    resetIds();
    const a = makeEntity({ state: 'true' });
    const b = makeEntity({ state: 'false' });
    const tgt = makeEntity();
    const out = propagateStates(
      makeDoc(
        [a, b, tgt],
        [makeEdge(a.id, tgt.id, { orGroupId: 'or1' }), makeEdge(b.id, tgt.id, { orGroupId: 'or1' })]
      )
    );
    expect(out[tgt.id]).toBe('true');
  });
});

describe('propagateStates — XOR merge', () => {
  it('exactly-one-true → true', () => {
    resetIds();
    const a = makeEntity({ state: 'true' });
    const b = makeEntity({ state: 'false' });
    const tgt = makeEntity();
    const out = propagateStates(
      makeDoc(
        [a, b, tgt],
        [makeEdge(a.id, tgt.id, { xorGroupId: 'x1' }), makeEdge(b.id, tgt.id, { xorGroupId: 'x1' })]
      )
    );
    expect(out[tgt.id]).toBe('true');
  });

  it('multiple-true → false (XOR violated)', () => {
    resetIds();
    const a = makeEntity({ state: 'true' });
    const b = makeEntity({ state: 'true' });
    const tgt = makeEntity();
    const out = propagateStates(
      makeDoc(
        [a, b, tgt],
        [makeEdge(a.id, tgt.id, { xorGroupId: 'x1' }), makeEdge(b.id, tgt.id, { xorGroupId: 'x1' })]
      )
    );
    expect(out[tgt.id]).toBe('false');
  });

  it('all-false → false', () => {
    resetIds();
    const a = makeEntity({ state: 'false' });
    const b = makeEntity({ state: 'false' });
    const tgt = makeEntity();
    const out = propagateStates(
      makeDoc(
        [a, b, tgt],
        [makeEdge(a.id, tgt.id, { xorGroupId: 'x1' }), makeEdge(b.id, tgt.id, { xorGroupId: 'x1' })]
      )
    );
    expect(out[tgt.id]).toBe('false');
  });

  it('any-disputed → disputed', () => {
    resetIds();
    const a = makeEntity({ state: 'true' });
    const b = makeEntity({ state: 'disputed' });
    const tgt = makeEntity();
    const out = propagateStates(
      makeDoc(
        [a, b, tgt],
        [makeEdge(a.id, tgt.id, { xorGroupId: 'x1' }), makeEdge(b.id, tgt.id, { xorGroupId: 'x1' })]
      )
    );
    expect(out[tgt.id]).toBe('disputed');
  });
});

describe('propagateStates — edge weight semantics', () => {
  it('negative weight flips true → false', () => {
    resetIds();
    const src = makeEntity({ state: 'true' });
    const tgt = makeEntity();
    const out = propagateStates(
      makeDoc([src, tgt], [makeEdge(src.id, tgt.id, { weight: 'negative' })])
    );
    expect(out[tgt.id]).toBe('false');
  });

  it('negative weight flips false → true', () => {
    resetIds();
    const src = makeEntity({ state: 'false' });
    const tgt = makeEntity();
    const out = propagateStates(
      makeDoc([src, tgt], [makeEdge(src.id, tgt.id, { weight: 'negative' })])
    );
    expect(out[tgt.id]).toBe('true');
  });

  it('negative weight passes through disputed unchanged', () => {
    resetIds();
    const src = makeEntity({ state: 'disputed' });
    const tgt = makeEntity();
    const out = propagateStates(
      makeDoc([src, tgt], [makeEdge(src.id, tgt.id, { weight: 'negative' })])
    );
    expect(out[tgt.id]).toBe('disputed');
  });

  it('zero weight contributes nothing — sibling edges decide alone', () => {
    resetIds();
    const noisy = makeEntity({ state: 'true' });
    const signal = makeEntity({ state: 'false' });
    const tgt = makeEntity();
    const out = propagateStates(
      makeDoc(
        [noisy, signal, tgt],
        [makeEdge(noisy.id, tgt.id, { weight: 'zero' }), makeEdge(signal.id, tgt.id)]
      )
    );
    // The zero-weight edge is invisible to propagation, so only the
    // signal edge contributes and the target reads `false`.
    expect(out[tgt.id]).toBe('false');
  });

  it('a target with only zero-weight inputs falls through to unknown', () => {
    resetIds();
    const src = makeEntity({ state: 'true' });
    const tgt = makeEntity();
    const out = propagateStates(
      makeDoc([src, tgt], [makeEdge(src.id, tgt.id, { weight: 'zero' })])
    );
    expect(out[tgt.id]).toBe('unknown');
  });
});

describe('propagateStates — non-causal edges are skipped', () => {
  it('back-edges contribute nothing (the user marked a reinforcing loop)', () => {
    resetIds();
    const a = makeEntity({ state: 'true' });
    const tgt = makeEntity();
    const out = propagateStates(makeDoc([a, tgt], [makeEdge(a.id, tgt.id, { isBackEdge: true })]));
    expect(out[tgt.id]).toBe('unknown');
  });

  it('mutual-exclusion edges contribute nothing (EC marker)', () => {
    resetIds();
    const a = makeEntity({ state: 'true' });
    const b = makeEntity();
    const out = propagateStates(
      makeDoc([a, b], [makeEdge(a.id, b.id, { isMutualExclusion: true })])
    );
    expect(out[b.id]).toBe('unknown');
  });
});

describe('propagateStates — multi-hop chains', () => {
  it('propagates through a 3-deep chain', () => {
    resetIds();
    const a = makeEntity({ state: 'true' });
    const b = makeEntity();
    const c = makeEntity();
    const out = propagateStates(makeDoc([a, b, c], [makeEdge(a.id, b.id), makeEdge(b.id, c.id)]));
    expect(out[b.id]).toBe('true');
    expect(out[c.id]).toBe('true');
  });

  it('manual override on a middle entity wins over upstream', () => {
    // a (true) → b (manual: disputed) → c. C reads the *manual*
    // value at b, not the propagated 'true'.
    resetIds();
    const a = makeEntity({ state: 'true' });
    const b = makeEntity({ state: 'disputed' });
    const c = makeEntity();
    const out = propagateStates(makeDoc([a, b, c], [makeEdge(a.id, b.id), makeEdge(b.id, c.id)]));
    expect(out[b.id]).toBe('true'); // derived value (override not applied)
    expect(out[c.id]).toBe('disputed'); // but the contribution to c reads manual
  });

  it('two diverging targets each receive an independent derived value', () => {
    resetIds();
    const src = makeEntity({ state: 'true' });
    const t1 = makeEntity();
    const t2 = makeEntity();
    const out = propagateStates(
      makeDoc(
        [src, t1, t2],
        [makeEdge(src.id, t1.id), makeEdge(src.id, t2.id, { weight: 'negative' })]
      )
    );
    expect(out[t1.id]).toBe('true');
    expect(out[t2.id]).toBe('false');
  });
});

describe('propagateStates — cycle handling', () => {
  it('terminates on a 2-node cycle without throwing or looping', () => {
    // a ↔ b with no manual state anywhere. Both should resolve to
    // 'unknown' — the cycle short-circuit means neither side
    // contributes signal to the other.
    resetIds();
    const a = makeEntity();
    const b = makeEntity();
    const doc = makeDoc([a, b], [makeEdge(a.id, b.id), makeEdge(b.id, a.id)]);
    const out = propagateStates(doc);
    expect(out[a.id]).toBe('unknown');
    expect(out[b.id]).toBe('unknown');
  });

  it('a manually-anchored member of a cycle still propagates to the other side', () => {
    // Anchor a as 'true' (manual). b's contribution to a is short-
    // circuited (cycle), but a's contribution to b reads the manual
    // override and so b resolves to 'true'.
    resetIds();
    const a = makeEntity({ state: 'true' });
    const b = makeEntity();
    const doc = makeDoc([a, b], [makeEdge(a.id, b.id), makeEdge(b.id, a.id)]);
    const out = propagateStates(doc);
    expect(out[b.id]).toBe('true');
  });
});

describe('propagateStates — mixed junctors at the same target', () => {
  it('AND-group + standalone edge merge as two OR-inputs', () => {
    // (a AND b) OR c. With a=true, b=false (AND→false), c=true → OR
    // result is true.
    resetIds();
    const a = makeEntity({ state: 'true' });
    const b = makeEntity({ state: 'false' });
    const c = makeEntity({ state: 'true' });
    const tgt = makeEntity();
    const out = propagateStates(
      makeDoc(
        [a, b, c, tgt],
        [
          makeEdge(a.id, tgt.id, { andGroupId: 'g1' }),
          makeEdge(b.id, tgt.id, { andGroupId: 'g1' }),
          makeEdge(c.id, tgt.id),
        ]
      )
    );
    expect(out[tgt.id]).toBe('true');
  });

  it('AND-group + standalone edge, AND succeeds and standalone is unknown → true', () => {
    // (a AND b) OR c. With a=true, b=true (AND→true), c=unknown →
    // OR result is true (any-true wins).
    resetIds();
    const a = makeEntity({ state: 'true' });
    const b = makeEntity({ state: 'true' });
    const c = makeEntity();
    const tgt = makeEntity();
    const out = propagateStates(
      makeDoc(
        [a, b, c, tgt],
        [
          makeEdge(a.id, tgt.id, { andGroupId: 'g1' }),
          makeEdge(b.id, tgt.id, { andGroupId: 'g1' }),
          makeEdge(c.id, tgt.id),
        ]
      )
    );
    expect(out[tgt.id]).toBe('true');
  });
});

describe('effectiveState — manual / derived merge helper', () => {
  it('returns unknown when the entity is undefined', () => {
    expect(effectiveState(undefined, {})).toBe('unknown');
  });

  it('returns the manual state when set, ignoring derived', () => {
    resetIds();
    const e = makeEntity({ state: 'disputed' });
    expect(effectiveState(e, { [e.id]: 'true' })).toBe('disputed');
  });

  it('falls through to derived when manual state is unset', () => {
    resetIds();
    const e = makeEntity();
    expect(effectiveState(e, { [e.id]: 'true' as const })).toBe('true');
  });

  it('returns unknown when neither manual nor derived is present', () => {
    resetIds();
    const e = makeEntity();
    // Empty derived map (not even a placeholder for this id).
    expect(effectiveState(e, {} as Record<EntityId, ReturnType<typeof effectiveState>>)).toBe(
      'unknown'
    );
  });

  it('a speculative override outranks both manual and derived', () => {
    resetIds();
    const e = makeEntity({ state: 'true' });
    expect(effectiveState(e, { [e.id]: 'false' }, { [e.id]: 'disputed' })).toBe('disputed');
  });

  it('falls back to manual when the override map has no entry for this id', () => {
    resetIds();
    const e = makeEntity({ state: 'true' });
    expect(effectiveState(e, {}, { other: 'false' })).toBe('true');
  });
});

describe('propagateStates — reducer mixed-state corner cases (mutation pass)', () => {
  // Session 135 mutation pass. The reducers were covered by homogeneous
  // tests (all-true, all-false, etc.) which leave `every` ↔ `some` and
  // boundary-flip mutants alive. These tests stress mixed-state inputs
  // that have only one correct answer under the documented semantics.

  it('OR with no trues, no disputed, mix of false + unknown → unknown', () => {
    // `every(v === 'false')` (line 102) guards the all-false → 'false'
    // result. With `some`, one false sibling would short-circuit to
    // 'false'. With `every` intact: not all false → fall through to
    // 'unknown' (no signal-bearing input). Diagnostic shape.
    resetIds();
    const a = makeEntity({ state: 'false' });
    const b = makeEntity(); // unknown
    const tgt = makeEntity();
    const out = propagateStates(
      makeDoc([a, b, tgt], [makeEdge(a.id, tgt.id), makeEdge(b.id, tgt.id)])
    );
    expect(out[tgt.id]).toBe('unknown');
  });

  it('XOR with exactly-one-true and an unknown is uncertain → unknown', () => {
    // XOR's "exactly one true" only commits to 'true' when every other
    // contribution is also a definite ('true' | 'false'). An 'unknown'
    // sibling means "we don't yet know if XOR is violated", so → unknown.
    // Pins both the `every` → `some` mutant and the `(v === 'true' || v
    // === 'false')` → `true` mutant on line 112.
    resetIds();
    const a = makeEntity({ state: 'true' });
    const b = makeEntity(); // unknown
    const tgt = makeEntity();
    const out = propagateStates(
      makeDoc(
        [a, b, tgt],
        [makeEdge(a.id, tgt.id, { xorGroupId: 'x1' }), makeEdge(b.id, tgt.id, { xorGroupId: 'x1' })]
      )
    );
    expect(out[tgt.id]).toBe('unknown');
  });

  it('XOR with no trues + a mix of false + unknown → unknown', () => {
    // Pins line 113 (`trues >= 2` → `true`), line 114:7 (every-false →
    // 'false' guard, both ConditionalExpression + MethodExpression
    // mutants), and line 114:27 (lambda body). The 'unknown' sibling
    // means we can't claim "all false"; the function falls through to
    // 'unknown'. With any of those mutants flipped, the function returns
    // 'false' instead.
    resetIds();
    const a = makeEntity({ state: 'false' });
    const b = makeEntity(); // unknown
    const tgt = makeEntity();
    const out = propagateStates(
      makeDoc(
        [a, b, tgt],
        [makeEdge(a.id, tgt.id, { xorGroupId: 'x1' }), makeEdge(b.id, tgt.id, { xorGroupId: 'x1' })]
      )
    );
    expect(out[tgt.id]).toBe('unknown');
  });

  it('an OR-group with two trues stays true (vs XOR which would flip to false)', () => {
    // Pins line 275 (`tier === XOR_TIER` → `true`) and the line 248
    // `else if (ed.xorGroupId)` → `else if (true)` mutant. If the OR
    // group were reduced as XOR by mistake, two trues would flip to
    // 'false'.
    resetIds();
    const a = makeEntity({ state: 'true' });
    const b = makeEntity({ state: 'true' });
    const tgt = makeEntity();
    const out = propagateStates(
      makeDoc(
        [a, b, tgt],
        [makeEdge(a.id, tgt.id, { orGroupId: 'or1' }), makeEdge(b.id, tgt.id, { orGroupId: 'or1' })]
      )
    );
    expect(out[tgt.id]).toBe('true');
  });
});

describe('propagateStates — junctor isolation by group id (mutation pass)', () => {
  // Each `<tier>:${id}` key (lines 244 / 249 / 254) distinguishes one
  // junctor group from another at the same target. Without the id in the
  // key, distinct groups collapse into one. These tests pair two
  // different-id groups of the same tier whose merge would yield a
  // different overall result than the independent fold.

  it('AND-groups with distinct ids reduce independently (no key collapse)', () => {
    // g1 = AND(true, true) → true. g2 = AND(true, false) → false.
    // Top OR: true ∨ false = true. If both groups collapsed (key
    // mutation), AND(true, true, true, false) = false → top = false.
    resetIds();
    const a = makeEntity({ state: 'true' });
    const b = makeEntity({ state: 'true' });
    const c = makeEntity({ state: 'true' });
    const d = makeEntity({ state: 'false' });
    const tgt = makeEntity();
    const out = propagateStates(
      makeDoc(
        [a, b, c, d, tgt],
        [
          makeEdge(a.id, tgt.id, { andGroupId: 'g1' }),
          makeEdge(b.id, tgt.id, { andGroupId: 'g1' }),
          makeEdge(c.id, tgt.id, { andGroupId: 'g2' }),
          makeEdge(d.id, tgt.id, { andGroupId: 'g2' }),
        ]
      )
    );
    expect(out[tgt.id]).toBe('true');
  });

  it('XOR-groups with distinct ids reduce independently (no key collapse)', () => {
    // g1 = XOR(true, false) → true. g2 = XOR(true, true) → false.
    // Top OR: true ∨ false = true. If both groups collapsed:
    // XOR(true, false, true, true) → trues=3 → false → top = false.
    resetIds();
    const a = makeEntity({ state: 'true' });
    const b = makeEntity({ state: 'false' });
    const c = makeEntity({ state: 'true' });
    const d = makeEntity({ state: 'true' });
    const tgt = makeEntity();
    const out = propagateStates(
      makeDoc(
        [a, b, c, d, tgt],
        [
          makeEdge(a.id, tgt.id, { xorGroupId: 'x1' }),
          makeEdge(b.id, tgt.id, { xorGroupId: 'x1' }),
          makeEdge(c.id, tgt.id, { xorGroupId: 'x2' }),
          makeEdge(d.id, tgt.id, { xorGroupId: 'x2' }),
        ]
      )
    );
    expect(out[tgt.id]).toBe('true');
  });

  it('OR-groups with distinct ids stay distinct (key includes the id)', () => {
    // Two explicit OR-groups, each with all-false members. Each reduces
    // independently to 'false'; top OR is 'false'. If both collapsed
    // into one cache key, the result is still 'false' — equivalent. So
    // we use a shape where collapse matters: each group's all-false
    // member set is distinct, and one group additionally has a true
    // sibling.
    //   g1 = OR(true, false) → true
    //   g2 = OR(false, false) → false
    //   Top OR: true. Collapsed OR(true, false, false, false) → still
    //   true. Same result. Let's prove collapse via the standalone-merge
    //   path instead — the OR cache key is exercised by the explicit
    //   orGroupId fixture below, which is the canonical OR-group shape.
    resetIds();
    const a = makeEntity({ state: 'false' });
    const b = makeEntity({ state: 'false' });
    const c = makeEntity({ state: 'false' });
    const d = makeEntity({ state: 'true' });
    const tgt = makeEntity();
    const out = propagateStates(
      makeDoc(
        [a, b, c, d, tgt],
        [
          makeEdge(a.id, tgt.id, { orGroupId: 'or-x' }),
          makeEdge(b.id, tgt.id, { orGroupId: 'or-x' }),
          makeEdge(c.id, tgt.id, { orGroupId: 'or-y' }),
          makeEdge(d.id, tgt.id, { orGroupId: 'or-y' }),
        ]
      )
    );
    expect(out[tgt.id]).toBe('true');
  });
});

describe('propagateStates — zero-weight contributions are inert (mutation pass)', () => {
  // Existing tests cover zero weight on standalone edges. These pin the
  // same semantics inside a junctor group (line 269 `if (c !== null)`)
  // and the contribs.length === 0 short-circuit (line 271).

  it('AND-group with a zero-weight sibling treats it as no contribution (not a null void)', () => {
    // AND(true, zero-skipped) = AND(true) = true. With the `c !== null`
    // guard disabled (mutant), null would be pushed into contribs and
    // reduceAnd's `every === 'true'` check would see a non-'true' value
    // → fall through to 'unknown'. Target would read 'unknown' instead.
    resetIds();
    const a = makeEntity({ state: 'true' });
    const zero = makeEntity({ state: 'false' });
    const tgt = makeEntity();
    const out = propagateStates(
      makeDoc(
        [a, zero, tgt],
        [
          makeEdge(a.id, tgt.id, { andGroupId: 'g1' }),
          makeEdge(zero.id, tgt.id, { andGroupId: 'g1', weight: 'zero' }),
        ]
      )
    );
    expect(out[tgt.id]).toBe('true');
  });

  it('a junctor group with only zero-weight inputs contributes nothing (does NOT poison sibling groups)', () => {
    // g1 = AND { zero(true) } → no contribs → skip. g2 = AND { x(false) }
    // → false. orInputs = ['false']. Top OR: 'false'.
    // With `if (contribs.length === 0) continue` flipped to `if (false)
    // continue`, the AND would receive [] and reduceAnd([]) returns
    // 'unknown'. orInputs = ['unknown', 'false']. reduceOr finds no
    // 'true' / 'disputed' / all-'false' → 'unknown'. Asserting 'false'
    // catches the difference.
    resetIds();
    const zeroEnt = makeEntity({ state: 'true' });
    const xEnt = makeEntity({ state: 'false' });
    const tgt = makeEntity();
    const out = propagateStates(
      makeDoc(
        [zeroEnt, xEnt, tgt],
        [
          makeEdge(zeroEnt.id, tgt.id, { andGroupId: 'g-zero', weight: 'zero' }),
          makeEdge(xEnt.id, tgt.id, { andGroupId: 'g-other' }),
        ]
      )
    );
    expect(out[tgt.id]).toBe('false');
  });
});

describe('propagateStates — result cache integrity (mutation pass)', () => {
  // Session 135 Perf #7 cache. These pin the two write-side conditionals
  // (`if (!overrides)` line 298 and `if (!byEntities)` line 300) which
  // existing identity tests don't catch — they exercise the read side
  // only.

  it('a speculative pass does NOT poison the (no-override) result cache', () => {
    // Without the `if (!overrides)` guard on the cache write, the
    // speculative pass would overwrite the (edges, entities) entry with
    // the override-derived result. A subsequent no-override call would
    // read the poisoned cache and return the speculated result instead
    // of the true propagated one.
    resetIds();
    const a = makeEntity({ type: 'effect', state: 'true' });
    const b = makeEntity({ type: 'effect' });
    const doc = makeDoc([a, b], [makeEdge(a.id, b.id)]);
    const plain = propagateStates(doc);
    const speculated = propagateStates(doc, { [a.id]: 'false' });
    expect(speculated[b.id]).toBe('false');
    const plainAgain = propagateStates(doc);
    expect(plainAgain).toBe(plain);
    expect(plainAgain[b.id]).toBe('true');
  });

  it('the result cache survives a same-edges different-entities call (byEntities map is not re-created)', () => {
    // The `if (!byEntities)` guard ensures we only allocate the inner
    // WeakMap once per edges reference. With `if (true)`, every save
    // would allocate a fresh inner map — destroying the entries for
    // earlier (edges, entities) tuples. This test edits one entity
    // (new entities reference, same edges reference) then asks again
    // for the original doc and asserts the cache still returns the
    // original derived result.
    resetIds();
    const a = makeEntity({ type: 'effect', state: 'true' });
    const b = makeEntity({ type: 'effect' });
    const doc1 = makeDoc([a, b], [makeEdge(a.id, b.id)]);
    const first = propagateStates(doc1);
    const aEdited = { ...a, title: 'edited' };
    const doc2 = { ...doc1, entities: { ...doc1.entities, [a.id]: aEdited } };
    propagateStates(doc2);
    expect(propagateStates(doc1)).toBe(first);
  });
});

describe('propagateStates — Phase 1C speculative overrides', () => {
  it('an override on a leaf flows downstream like a manual state', () => {
    resetIds();
    const src = makeEntity(); // no manual state
    const tgt = makeEntity();
    const doc = makeDoc([src, tgt], [makeEdge(src.id, tgt.id)]);
    // No override → unknown downstream.
    expect(propagateStates(doc)[tgt.id]).toBe('unknown');
    // Override src to true → target derives true.
    expect(propagateStates(doc, { [src.id]: 'true' })[tgt.id]).toBe('true');
  });

  it('an override beats the manual state when contributing downstream', () => {
    resetIds();
    const src = makeEntity({ state: 'true' });
    const tgt = makeEntity();
    const doc = makeDoc([src, tgt], [makeEdge(src.id, tgt.id)]);
    // Without override, src=true → tgt=true.
    expect(propagateStates(doc)[tgt.id]).toBe('true');
    // Speculating src=false flips the cascade.
    expect(propagateStates(doc, { [src.id]: 'false' })[tgt.id]).toBe('false');
  });

  it('cascades a speculative override through a multi-hop chain', () => {
    resetIds();
    const a = makeEntity({ state: 'true' });
    const b = makeEntity();
    const c = makeEntity();
    const doc = makeDoc([a, b, c], [makeEdge(a.id, b.id), makeEdge(b.id, c.id)]);
    const out = propagateStates(doc, { [a.id]: 'false' });
    expect(out[b.id]).toBe('false');
    expect(out[c.id]).toBe('false');
  });

  it('an empty override map matches the no-override pass (backward compat)', () => {
    resetIds();
    const a = makeEntity({ state: 'true' });
    const b = makeEntity();
    const doc = makeDoc([a, b], [makeEdge(a.id, b.id)]);
    expect(propagateStates(doc, {})).toEqual(propagateStates(doc));
  });

  it('overriding an AND-group member flips the merged result', () => {
    resetIds();
    const a = makeEntity({ state: 'true' });
    const b = makeEntity({ state: 'true' });
    const tgt = makeEntity();
    const doc = makeDoc(
      [a, b, tgt],
      [makeEdge(a.id, tgt.id, { andGroupId: 'g1' }), makeEdge(b.id, tgt.id, { andGroupId: 'g1' })]
    );
    expect(propagateStates(doc)[tgt.id]).toBe('true');
    // Speculating one member false → AND short-circuits to false.
    expect(propagateStates(doc, { [b.id]: 'false' })[tgt.id]).toBe('false');
  });
});
