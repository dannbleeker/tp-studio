import { beforeEach, describe, expect, it } from 'vitest';
import { loopsWithPolarity } from '@/domain/loopAnalysis';
import { loopPolarityRule } from '@/domain/validators/loopPolarity';
import { makeDoc, makeEdge, makeEntity, resetIds } from './helpers';

/**
 * Session 179 (Theme A) — loop-polarity analysis (the System-Dynamics lens) and
 * the diagram-type-aware loop CLR built on it.
 */
beforeEach(resetIds);

describe('loopsWithPolarity', () => {
  it('classifies an all-positive loop as reinforcing', () => {
    const a = makeEntity();
    const b = makeEntity();
    const doc = makeDoc([a, b], [makeEdge(a.id, b.id), makeEdge(b.id, a.id)], 'crt');
    const loops = loopsWithPolarity(doc);
    expect(loops).toHaveLength(1);
    expect(loops[0]?.polarity).toBe('reinforcing');
  });

  it('classifies a single-negative loop as balancing', () => {
    const a = makeEntity();
    const b = makeEntity();
    const doc = makeDoc(
      [a, b],
      [makeEdge(a.id, b.id), makeEdge(b.id, a.id, { weight: 'negative' })],
      'crt'
    );
    expect(loopsWithPolarity(doc)[0]?.polarity).toBe('balancing');
  });

  it('classifies a two-negative loop as reinforcing (even count of negatives)', () => {
    const a = makeEntity();
    const b = makeEntity();
    const doc = makeDoc(
      [a, b],
      [makeEdge(a.id, b.id, { weight: 'negative' }), makeEdge(b.id, a.id, { weight: 'negative' })],
      'crt'
    );
    expect(loopsWithPolarity(doc)[0]?.polarity).toBe('reinforcing');
  });

  it('returns unknown when a loop contains a zero-weight edge', () => {
    const a = makeEntity();
    const b = makeEntity();
    const doc = makeDoc(
      [a, b],
      [makeEdge(a.id, b.id, { weight: 'zero' }), makeEdge(b.id, a.id)],
      'crt'
    );
    expect(loopsWithPolarity(doc)[0]?.polarity).toBe('unknown');
  });

  it('returns no loops on an acyclic graph', () => {
    const a = makeEntity();
    const b = makeEntity();
    expect(loopsWithPolarity(makeDoc([a, b], [makeEdge(a.id, b.id)], 'crt'))).toEqual([]);
  });

  it('exposes the closing edge id and one edge per hop', () => {
    const a = makeEntity();
    const b = makeEntity();
    const doc = makeDoc([a, b], [makeEdge(a.id, b.id), makeEdge(b.id, a.id)], 'crt');
    const loop = loopsWithPolarity(doc)[0];
    expect(loop?.closingEdgeId).toBeTruthy();
    expect(loop?.edgeIds).toHaveLength(2);
  });
});

describe('loopPolarityRule', () => {
  it('fires on a balancing loop in a CRT, anchored on an edge', () => {
    const a = makeEntity();
    const b = makeEntity();
    const doc = makeDoc(
      [a, b],
      [makeEdge(a.id, b.id), makeEdge(b.id, a.id, { weight: 'negative' })],
      'crt'
    );
    const w = loopPolarityRule(doc);
    expect(w).toHaveLength(1);
    expect(w[0]?.target.kind).toBe('edge');
    expect(w[0]?.message).toMatch(/balancing/);
  });

  it('does not fire on a reinforcing loop in a CRT', () => {
    const a = makeEntity();
    const b = makeEntity();
    const doc = makeDoc([a, b], [makeEdge(a.id, b.id), makeEdge(b.id, a.id)], 'crt');
    expect(loopPolarityRule(doc)).toEqual([]);
  });

  it('fires on a balancing loop in an FRT', () => {
    const a = makeEntity();
    const b = makeEntity();
    const doc = makeDoc(
      [a, b],
      [makeEdge(a.id, b.id), makeEdge(b.id, a.id, { weight: 'negative' })],
      'frt'
    );
    expect(loopPolarityRule(doc)).toHaveLength(1);
  });

  it('does not fire on diagram types with no loop expectation (Goal Tree)', () => {
    const a = makeEntity();
    const b = makeEntity();
    const doc = makeDoc(
      [a, b],
      [makeEdge(a.id, b.id), makeEdge(b.id, a.id, { weight: 'negative' })],
      'goalTree'
    );
    expect(loopPolarityRule(doc)).toEqual([]);
  });
});
