import {
  renderEdgeSentence,
  resolveCausalityWord,
  resolveEdgeConnector,
  topologicalEdgeOrder,
} from '@/domain/edgeReading';
import { beforeEach, describe, expect, it } from 'vitest';
import { makeDoc, makeEdge, makeEntity, resetIds } from './helpers';

beforeEach(() => {
  resetIds();
});

describe('resolveCausalityWord', () => {
  it('returns undefined for "none"', () => {
    expect(resolveCausalityWord('none', 'crt')).toBeUndefined();
  });

  it('returns the explicit word for non-auto modes', () => {
    expect(resolveCausalityWord('because', 'crt')).toBe('because');
    expect(resolveCausalityWord('therefore', 'crt')).toBe('therefore');
    expect(resolveCausalityWord('in-order-to', 'prt')).toBe('in order to');
  });

  it('auto picks "because" for CRT / FRT / TT', () => {
    expect(resolveCausalityWord('auto', 'crt')).toBe('because');
    expect(resolveCausalityWord('auto', 'frt')).toBe('because');
    expect(resolveCausalityWord('auto', 'tt')).toBe('because');
  });

  it('auto picks "in order to" for PRT / EC', () => {
    expect(resolveCausalityWord('auto', 'prt')).toBe('in order to');
    expect(resolveCausalityWord('auto', 'ec')).toBe('in order to');
  });
});

describe('renderEdgeSentence', () => {
  const cause = { title: 'Order entry is manual' } as never;
  const effect = { title: 'Customers churn' } as never;

  it('renders the "because" form by default', () => {
    expect(renderEdgeSentence(cause, effect, 'because')).toBe(
      '"Customers churn" because "Order entry is manual".'
    );
  });

  it('renders the "therefore" form (cause-first)', () => {
    expect(renderEdgeSentence(cause, effect, 'therefore')).toBe(
      '"Order entry is manual", therefore "Customers churn".'
    );
  });

  it('renders the "in order to" form (necessary-condition)', () => {
    expect(renderEdgeSentence(cause, effect, 'in order to')).toBe(
      'In order to obtain "Customers churn", "Order entry is manual" must hold.'
    );
  });

  it('falls back to an arrow when no connector is provided', () => {
    expect(renderEdgeSentence(cause, effect, undefined)).toBe(
      'Order entry is manual → Customers churn'
    );
  });
});

describe('topologicalEdgeOrder', () => {
  it('orders edges from root cause toward effect on a linear chain', () => {
    const a = makeEntity({ title: 'A' });
    const b = makeEntity({ title: 'B' });
    const c = makeEntity({ title: 'C' });
    const ab = makeEdge(a.id, b.id);
    const bc = makeEdge(b.id, c.id);
    const order = topologicalEdgeOrder(makeDoc([a, b, c], [ab, bc]));
    expect(order).toEqual([ab.id, bc.id]);
  });

  it('skips edges involving assumption entities', () => {
    const a = makeEntity({ title: 'A' });
    const b = makeEntity({ title: 'B' });
    const assn = makeEntity({ title: 'note', type: 'assumption' });
    const ab = makeEdge(a.id, b.id);
    const aAssn = makeEdge(a.id, assn.id);
    const order = topologicalEdgeOrder(makeDoc([a, b, assn], [ab, aAssn]));
    expect(order).toEqual([ab.id]);
  });

  it('falls back to creation order on the remaining unreached edges (cycle)', () => {
    const a = makeEntity({ title: 'A' });
    const b = makeEntity({ title: 'B' });
    const ab = makeEdge(a.id, b.id);
    const ba = makeEdge(b.id, a.id);
    const order = topologicalEdgeOrder(makeDoc([a, b], [ab, ba]));
    // Either ordering is acceptable — both edges must be present.
    expect(order.sort()).toEqual([ab.id, ba.id].sort());
  });
});

describe('resolveEdgeConnector', () => {
  it('uses the per-edge label when set', () => {
    const e = makeEdge('a' as never, 'b' as never, { label: 'within 30 days' });
    expect(resolveEdgeConnector(e, 'because', 'crt')).toBe('within 30 days');
  });

  it('falls back to the global causality word when no label set', () => {
    const e = makeEdge('a' as never, 'b' as never);
    expect(resolveEdgeConnector(e, 'because', 'crt')).toBe('because');
    expect(resolveEdgeConnector(e, 'auto', 'ec')).toBe('in order to');
  });
});
