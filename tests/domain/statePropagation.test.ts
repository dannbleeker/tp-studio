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
});
