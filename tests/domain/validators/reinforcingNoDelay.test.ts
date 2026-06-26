import { beforeEach, describe, expect, it } from 'vitest';
import { validate } from '@/domain/validators';
import { makeDoc, makeEdge, makeEntity, resetIds } from '../helpers';

/**
 * Dedicated coverage for the `reinforcing-no-delay` CLR rule
 * (src/domain/validators/reinforcingNoDelay.ts), driven through the public
 * `validate()` entry on a `crt` doc (the rule is only registered on
 * crt/frt/nbr).
 *
 * The rule fires once per simple cycle that is BOTH reinforcing (even count of
 * `negative`-weighted edges → positive parity) AND carries no `delay` edge. It
 * anchors the warning on the loop's closing back-edge.
 *
 * Cycle/back-edge ordering note: `findCycles` canonicalises each cycle to start
 * at the lexicographically-smallest entity id, and the closing edge runs from
 * the last entity in that canonical order back to the first. With `resetIds()`
 * the first entity built is `e-1` (smallest), so a freshly-built
 * `a → b → c → a` loop closes on the `c → a` edge.
 */

beforeEach(() => {
  resetIds();
});

const RULE = 'reinforcing-no-delay';
const MESSAGE_RX = /reinforcing loop has no delay/;

const warningsFor = (...args: Parameters<typeof makeDoc>) =>
  validate(makeDoc(...args)).filter((w) => w.ruleId === RULE);

const warningsForDoc = (doc: ReturnType<typeof makeDoc>) =>
  validate(doc).filter((w) => w.ruleId === RULE);

/**
 * Build a 3-entity loop a → b → c → a. `weights[i]` (optional) sets the weight
 * on edge i (0: a→b, 1: b→c, 2: c→a, the closing edge); `delays[i]` sets delay.
 * Returns the entity ids and the closing edge id so tests can assert the target.
 */
type EdgeWeight = NonNullable<Parameters<typeof makeEdge>[2]>['weight'];

// Build an edge override object that OMITS undefined keys — `tsconfig` runs
// with `exactOptionalPropertyTypes`, which rejects an explicit `weight:
// undefined`. So omission, not undefined, is how "unset" is expressed.
const edgeOpts = (weight?: EdgeWeight, delay?: boolean) => ({
  ...(weight !== undefined ? { weight } : {}),
  ...(delay !== undefined ? { delay } : {}),
});

const loopDoc = (opts: { weights?: EdgeWeight[]; delays?: boolean[] } = {}) => {
  const a = makeEntity();
  const b = makeEntity();
  const c = makeEntity();
  const w = opts.weights ?? [];
  const d = opts.delays ?? [];
  const ab = makeEdge(a.id, b.id, edgeOpts(w[0], d[0]));
  const bc = makeEdge(b.id, c.id, edgeOpts(w[1], d[1]));
  const ca = makeEdge(c.id, a.id, edgeOpts(w[2], d[2]));
  return {
    a,
    b,
    c,
    closingId: ca.id,
    doc: makeDoc([a, b, c], [ab, bc, ca], 'crt'),
  };
};

describe('reinforcing-no-delay: positive (fires)', () => {
  it('fires exactly one warning on an all-positive reinforcing loop', () => {
    const a = makeEntity();
    const b = makeEntity();
    const c = makeEntity();
    const warnings = validate(
      makeDoc([a, b, c], [makeEdge(a.id, b.id), makeEdge(b.id, c.id), makeEdge(c.id, a.id)], 'crt')
    ).filter((w) => w.ruleId === RULE);
    expect(warnings).toHaveLength(1);
  });

  it('anchors the warning on the loop-closing back-edge (kind + id)', () => {
    const a = makeEntity();
    const b = makeEntity();
    const c = makeEntity();
    const closing = makeEdge(c.id, a.id);
    const warnings = validate(
      makeDoc([a, b, c], [makeEdge(a.id, b.id), makeEdge(b.id, c.id), closing], 'crt')
    ).filter((w) => w.ruleId === RULE);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]?.target).toEqual({ kind: 'edge', id: closing.id });
  });

  it('carries the distinctive message, the clarity tier, and a stable id', () => {
    const { doc, closingId } = loopDoc();
    const w = validate(doc).filter((x) => x.ruleId === RULE)[0];
    expect(w?.message).toMatch(MESSAGE_RX);
    // distinctive call-to-action phrasing the message ends on
    expect(w?.message).toContain('Mark the lagged edge as delayed.');
    expect(w?.tier).toBe('clarity');
    expect(w?.id).toBe(`reinforcing-no-delay:edge:${closingId}`);
    expect(w?.resolved).toBe(false);
  });

  it('fires on a 2-entity reinforcing loop (a → b → a), targeting the back-edge', () => {
    const a = makeEntity();
    const b = makeEntity();
    const back = makeEdge(b.id, a.id);
    const warnings = validate(makeDoc([a, b], [makeEdge(a.id, b.id), back], 'crt')).filter(
      (w) => w.ruleId === RULE
    );
    expect(warnings).toHaveLength(1);
    expect(warnings[0]?.target).toEqual({ kind: 'edge', id: back.id });
  });

  it('fires with TWO negative edges (even parity is still reinforcing)', () => {
    // off-by-one guard: 1 negative → balancing (silent), 2 negative → reinforcing.
    const warnings = warningsForDoc(loopDoc({ weights: ['negative', 'negative', undefined] }).doc);
    expect(warnings).toHaveLength(1);
  });

  it('fires once per independent reinforcing loop (two disjoint cycles)', () => {
    const a = makeEntity();
    const b = makeEntity();
    const c = makeEntity();
    const d = makeEntity();
    const warnings = validate(
      makeDoc(
        [a, b, c, d],
        [
          // loop 1: a ↔ b
          makeEdge(a.id, b.id),
          makeEdge(b.id, a.id),
          // loop 2: c ↔ d
          makeEdge(c.id, d.id),
          makeEdge(d.id, c.id),
        ],
        'crt'
      )
    ).filter((w) => w.ruleId === RULE);
    expect(warnings).toHaveLength(2);
  });
});

describe('reinforcing-no-delay: negative (silent)', () => {
  it('is silent on an acyclic graph (no loop at all)', () => {
    const a = makeEntity();
    const b = makeEntity();
    expect(warningsFor([a, b], [makeEdge(a.id, b.id)], 'crt')).toEqual([]);
  });

  it('is silent for a balancing loop — exactly ONE negative edge (odd parity)', () => {
    expect(warningsForDoc(loopDoc({ weights: ['negative', undefined, undefined] }).doc)).toEqual(
      []
    );
  });

  it('is silent for a balancing loop with THREE negative edges (odd parity)', () => {
    expect(warningsForDoc(loopDoc({ weights: ['negative', 'negative', 'negative'] }).doc)).toEqual(
      []
    );
  });

  it('is silent when a loop edge has weight "zero" (polarity is unknown, not reinforcing)', () => {
    expect(warningsForDoc(loopDoc({ weights: ['zero', undefined, undefined] }).doc)).toEqual([]);
  });

  it('goes silent when the CLOSING edge carries a delay', () => {
    expect(warningsForDoc(loopDoc({ delays: [false, false, true] }).doc)).toEqual([]);
  });

  it('goes silent when a NON-closing edge carries the delay (any edge, not just the back-edge)', () => {
    expect(warningsForDoc(loopDoc({ delays: [true, false, false] }).doc)).toEqual([]);
  });

  it('treats delay === false the same as unset (still fires)', () => {
    const warnings = warningsForDoc(loopDoc({ delays: [false, false, false] }).doc);
    expect(warnings).toHaveLength(1);
  });
});

describe('reinforcing-no-delay: resolved escape hatch', () => {
  it('still emits the warning but flags resolved:true when resolved in the doc', () => {
    const a = makeEntity();
    const b = makeEntity();
    const c = makeEntity();
    const closing = makeEdge(c.id, a.id);
    const id = `reinforcing-no-delay:edge:${closing.id}`;
    const warnings = validate(
      makeDoc([a, b, c], [makeEdge(a.id, b.id), makeEdge(b.id, c.id), closing], 'crt', {
        [id]: true,
      })
    ).filter((w) => w.ruleId === RULE);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]?.resolved).toBe(true);
  });
});
