import { beforeEach, describe, expect, it } from 'vitest';
import { validateEdge } from '@/domain/persistenceValidators';
import { validate } from '@/domain/validators';
import { reinforcingNoDelayRule } from '@/domain/validators/reinforcingNoDelay';
import { makeDoc, makeEdge, makeEntity, resetIds } from './helpers';

/**
 * Theme A (Session 180) — A4 delay markers + A3 loop naming.
 *   - Edge.delay / loopName / loopNarrative persist (validateEdge).
 *   - reinforcing-no-delay validator flags an R-loop with no delayed edge.
 */
beforeEach(resetIds);

const baseEdge = { id: 'e1', sourceId: 'a', targetId: 'b', kind: 'sufficiency' as const };

describe('edge persistence — delay + loop metadata', () => {
  it('round-trips delay, loopName, and loopNarrative', () => {
    const e = validateEdge(
      {
        ...baseEdge,
        delay: true,
        loopName: 'Burnout spiral',
        loopNarrative: 'escalates over months',
      },
      'edge'
    );
    expect(e.delay).toBe(true);
    expect(e.loopName).toBe('Burnout spiral');
    expect(e.loopNarrative).toBe('escalates over months');
  });

  it('omits falsy / empty loop metadata (keeps JSON minimal)', () => {
    const e = validateEdge({ ...baseEdge, delay: false, loopName: '', loopNarrative: '' }, 'edge');
    expect(e.delay).toBeUndefined();
    expect('loopName' in e).toBe(false);
    expect('loopNarrative' in e).toBe(false);
  });

  it('rejects malformed values', () => {
    expect(() => validateEdge({ ...baseEdge, delay: 'yes' }, 'edge')).toThrow();
    expect(() => validateEdge({ ...baseEdge, loopName: 5 }, 'edge')).toThrow();
    expect(() => validateEdge({ ...baseEdge, loopNarrative: {} }, 'edge')).toThrow();
  });
});

/** A 3-entity reinforcing cycle a → b → c → a (all default-positive weights).
 *  `overrides` apply to the closing edge (c → a). */
const cycleDoc = (overrides = {}) => {
  const a = makeEntity();
  const b = makeEntity();
  const c = makeEntity();
  const closing = makeEdge(c.id, a.id, overrides);
  return {
    closing,
    doc: makeDoc([a, b, c], [makeEdge(a.id, b.id), makeEdge(b.id, c.id), closing], 'crt'),
  };
};

describe('reinforcingNoDelayRule', () => {
  it('flags a reinforcing loop with no delayed edge', () => {
    const { closing, doc } = cycleDoc();
    const w = reinforcingNoDelayRule(doc);
    expect(w).toHaveLength(1);
    expect(w[0]?.target).toEqual({ kind: 'edge', id: closing.id });
    expect(w[0]?.message).toMatch(/reinforcing loop has no delay/);
  });

  it('is silent once an edge in the loop carries a delay', () => {
    const { doc } = cycleDoc({ delay: true });
    expect(reinforcingNoDelayRule(doc)).toEqual([]);
  });

  it('is silent for a balancing loop (one negative edge → odd parity)', () => {
    const { doc } = cycleDoc({ weight: 'negative' });
    expect(reinforcingNoDelayRule(doc)).toEqual([]);
  });

  it('does not fire without a cycle', () => {
    const a = makeEntity();
    const b = makeEntity();
    expect(reinforcingNoDelayRule(makeDoc([a, b], [makeEdge(a.id, b.id)], 'crt'))).toEqual([]);
  });

  it('honours the resolvedWarnings escape hatch', () => {
    const { closing, doc } = cycleDoc();
    const id = `reinforcing-no-delay:edge:${closing.id}`;
    const resolved = { ...doc, resolvedWarnings: { [id]: true as const } };
    expect(reinforcingNoDelayRule(resolved)[0]?.resolved).toBe(true);
  });
});

describe('reinforcing-no-delay registration + cache invalidation', () => {
  it('runs via validate() on a CRT, and adding a delay re-validates (fingerprint includes delay)', () => {
    const { closing, doc } = cycleDoc();
    expect(validate(doc).some((w) => w.ruleId === 'reinforcing-no-delay')).toBe(true);
    // A new edges ref AND a changed fingerprint (delay is now encoded) → cache miss.
    const withDelay = {
      ...doc,
      edges: { ...doc.edges, [closing.id]: { ...closing, delay: true } },
    };
    expect(validate(withDelay).some((w) => w.ruleId === 'reinforcing-no-delay')).toBe(false);
  });

  it('is NOT registered on a Goal Tree (necessity logic, no loop-polarity)', () => {
    const { doc } = cycleDoc();
    const goalTreeDoc = { ...doc, diagramType: 'goalTree' as const };
    expect(validate(goalTreeDoc).some((w) => w.ruleId === 'reinforcing-no-delay')).toBe(false);
  });
});
