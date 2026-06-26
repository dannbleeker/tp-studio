import { beforeEach, describe, expect, it } from 'vitest';
import { validate } from '@/domain/validators';
import { makeDoc, makeEdge, makeEntity, resetIds } from '../helpers';

beforeEach(() => {
  resetIds();
});

const RULE = 'loop-polarity';

const loopWarnings = (warnings: ReturnType<typeof validate>) =>
  warnings.filter((w) => w.ruleId === RULE);

/**
 * Build a 3-cycle e1 → e2 → e3 → e1 with the supplied per-edge weights.
 * Entity ids are e-1, e-2, e-3 (lexicographically increasing), so
 * `findCycles` canonicalizes the loop to [e-1, e-2, e-3] and the closing
 * (back-)edge is e-3 → e-1 — i.e. the third edge in `weights`.
 */
const makeTriangle = (weights: Array<'positive' | 'negative' | 'zero' | undefined>) => {
  const a = makeEntity();
  const b = makeEntity();
  const c = makeEntity();
  const ab = makeEdge(a.id, b.id, weights[0] ? { weight: weights[0] } : {});
  const bc = makeEdge(b.id, c.id, weights[1] ? { weight: weights[1] } : {});
  const ca = makeEdge(c.id, a.id, weights[2] ? { weight: weights[2] } : {});
  return { a, b, c, ab, bc, ca, entities: [a, b, c], edges: [ab, bc, ca] };
};

describe('CLR: loop-polarity', () => {
  describe('positive — balancing loop fires', () => {
    it('fires on a CRT loop with exactly one negative edge (odd → balancing)', () => {
      const { entities, edges, ca } = makeTriangle(['positive', 'positive', 'negative']);
      const warnings = loopWarnings(validate(makeDoc(entities, edges, 'crt')));

      expect(warnings).toHaveLength(1);
      const w = warnings[0]!;
      expect(w.target.kind).toBe('edge');
      // Anchored on the loop-closing back-edge (e-3 → e-1), not an arbitrary hop.
      expect(w.target).toEqual({ kind: 'edge', id: ca.id });
      expect(w.message).toContain('balancing');
      expect(w.message).toContain('reinforcing (vicious) cycle');
      expect(w.message).toContain('Check the edge polarities');
    });

    it('fires with three negative edges (odd → balancing)', () => {
      const { entities, edges } = makeTriangle(['negative', 'negative', 'negative']);
      const warnings = loopWarnings(validate(makeDoc(entities, edges, 'crt')));
      expect(warnings).toHaveLength(1);
    });

    it('anchors on the closing edge even when the negative is on a non-closing hop', () => {
      // Negative is on the FIRST hop (e-1 → e-2), but the warning still
      // targets the closing edge (e-3 → e-1) — kills a "target the negative
      // edge" mutant.
      const { entities, edges, ca } = makeTriangle(['negative', 'positive', 'positive']);
      const warnings = loopWarnings(validate(makeDoc(entities, edges, 'crt')));
      expect(warnings).toHaveLength(1);
      expect(warnings[0]!.target).toEqual({ kind: 'edge', id: ca.id });
    });
  });

  describe('negative — reinforcing / unknown loops do not fire', () => {
    it('does not fire on an all-positive loop (zero negatives → reinforcing)', () => {
      const { entities, edges } = makeTriangle(['positive', 'positive', 'positive']);
      const warnings = loopWarnings(validate(makeDoc(entities, edges, 'crt')));
      expect(warnings).toHaveLength(0);
    });

    it('does not fire when weights are unset (default positive → reinforcing)', () => {
      const { entities, edges } = makeTriangle([undefined, undefined, undefined]);
      const warnings = loopWarnings(validate(makeDoc(entities, edges, 'crt')));
      expect(warnings).toHaveLength(0);
    });

    it('does not fire with exactly two negative edges (even → reinforcing, off-by-one)', () => {
      const { entities, edges } = makeTriangle(['negative', 'negative', 'positive']);
      const warnings = loopWarnings(validate(makeDoc(entities, edges, 'crt')));
      expect(warnings).toHaveLength(0);
    });

    it('does not fire when a zero-weight edge severs classification (unknown)', () => {
      // One negative would be balancing, but the zero edge makes the product
      // zero → unknown → skipped. Kills a "treat zero as positive" mutant.
      const { entities, edges } = makeTriangle(['negative', 'zero', 'positive']);
      const warnings = loopWarnings(validate(makeDoc(entities, edges, 'crt')));
      expect(warnings).toHaveLength(0);
    });

    it('does not fire on an acyclic graph (no loop at all)', () => {
      const a = makeEntity();
      const b = makeEntity();
      const c = makeEntity();
      const edges = [
        makeEdge(a.id, b.id, { weight: 'negative' }),
        makeEdge(b.id, c.id, { weight: 'positive' }),
      ];
      const warnings = loopWarnings(validate(makeDoc([a, b, c], edges, 'crt')));
      expect(warnings).toHaveLength(0);
    });
  });

  describe('two-node balancing loop', () => {
    it('fires on a 2-cycle with one negative edge and anchors on the closing edge', () => {
      const a = makeEntity();
      const b = makeEntity();
      // e-1 → e-2 (positive), e-2 → e-1 (negative). Canonical [e-1, e-2];
      // closing edge is e-2 → e-1.
      const ab = makeEdge(a.id, b.id, { weight: 'positive' });
      const ba = makeEdge(b.id, a.id, { weight: 'negative' });
      const warnings = loopWarnings(validate(makeDoc([a, b], [ab, ba], 'crt')));
      expect(warnings).toHaveLength(1);
      expect(warnings[0]!.target).toEqual({ kind: 'edge', id: ba.id });
    });
  });

  describe('multiple independent loops', () => {
    it('emits one warning per balancing loop', () => {
      // Two disjoint balancing triangles → two warnings.
      const t1 = makeTriangle(['negative', 'positive', 'positive']);
      const a = makeEntity();
      const b = makeEntity();
      const c = makeEntity();
      const t2edges = [
        makeEdge(a.id, b.id, { weight: 'negative' }),
        makeEdge(b.id, c.id, { weight: 'positive' }),
        makeEdge(c.id, a.id, { weight: 'positive' }),
      ];
      const warnings = loopWarnings(
        validate(makeDoc([...t1.entities, a, b, c], [...t1.edges, ...t2edges], 'crt'))
      );
      expect(warnings).toHaveLength(2);
    });
  });

  describe('diagram-type gating + message variants', () => {
    it('does not fire on a goal-tree diagram type (rule not registered there)', () => {
      const { entities, edges } = makeTriangle(['positive', 'positive', 'negative']);
      const warnings = loopWarnings(validate(makeDoc(entities, edges, 'goalTree')));
      expect(warnings).toHaveLength(0);
    });

    it('uses the FRT-specific message on an FRT balancing loop', () => {
      const { entities, edges } = makeTriangle(['positive', 'positive', 'negative']);
      const warnings = loopWarnings(validate(makeDoc(entities, edges, 'frt')));
      expect(warnings).toHaveLength(1);
      expect(warnings[0]!.message).toContain('self-limiting');
      expect(warnings[0]!.message).toContain('injection that counteracts itself');
    });

    it('uses the NBR-specific message on an NBR balancing loop', () => {
      const { entities, edges } = makeTriangle(['positive', 'positive', 'negative']);
      const warnings = loopWarnings(validate(makeDoc(entities, edges, 'nbr')));
      expect(warnings).toHaveLength(1);
      expect(warnings[0]!.message).toContain('negative branch that sustains itself');
    });
  });
});
