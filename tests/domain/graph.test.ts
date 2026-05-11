import {
  connectionCount,
  hasEdge,
  incomingEdges,
  isAssumption,
  outgoingEdges,
  removeEntityFromEdges,
  structuralEntities,
} from '@/domain/graph';
import { beforeEach, describe, expect, it } from 'vitest';
import { makeDoc, makeEdge, makeEntity, resetIds } from './helpers';

beforeEach(resetIds);

describe('incomingEdges / outgoingEdges', () => {
  it('returns only edges that target / source the given entity', () => {
    const a = makeEntity({ title: 'A' });
    const b = makeEntity({ title: 'B' });
    const c = makeEntity({ title: 'C' });
    const ab = makeEdge(a.id, b.id);
    const cb = makeEdge(c.id, b.id);
    const doc = makeDoc([a, b, c], [ab, cb]);

    expect(incomingEdges(doc, b.id).map((e) => e.id)).toEqual([ab.id, cb.id]);
    expect(outgoingEdges(doc, a.id).map((e) => e.id)).toEqual([ab.id]);
    expect(incomingEdges(doc, a.id)).toEqual([]);
    expect(outgoingEdges(doc, b.id)).toEqual([]);
  });
});

describe('connectionCount', () => {
  it('returns the sum of incoming and outgoing', () => {
    const a = makeEntity({ title: 'A' });
    const b = makeEntity({ title: 'B' });
    const c = makeEntity({ title: 'C' });
    const ab = makeEdge(a.id, b.id);
    const bc = makeEdge(b.id, c.id);
    const doc = makeDoc([a, b, c], [ab, bc]);
    expect(connectionCount(doc, b.id)).toBe(2);
    expect(connectionCount(doc, a.id)).toBe(1);
  });

  it('returns 0 for a disconnected entity', () => {
    const a = makeEntity({ title: 'Lonely' });
    expect(connectionCount(makeDoc([a], []), a.id)).toBe(0);
  });
});

describe('hasEdge', () => {
  it('detects an existing edge by source/target', () => {
    const a = makeEntity({ title: 'A' });
    const b = makeEntity({ title: 'B' });
    const ab = makeEdge(a.id, b.id);
    const doc = makeDoc([a, b], [ab]);
    expect(hasEdge(doc, a.id, b.id)).toBe(true);
    expect(hasEdge(doc, b.id, a.id)).toBe(false);
  });
});

describe('isAssumption / structuralEntities', () => {
  it('isAssumption is a pure predicate on entity.type', () => {
    expect(isAssumption(makeEntity({ type: 'assumption' }))).toBe(true);
    expect(isAssumption(makeEntity({ type: 'effect' }))).toBe(false);
  });

  it('structuralEntities filters out assumptions', () => {
    const eff = makeEntity({ type: 'effect', title: 'E' });
    const ass = makeEntity({ type: 'assumption', title: 'A' });
    const doc = makeDoc([eff, ass], []);
    expect(structuralEntities(doc).map((e) => e.id)).toEqual([eff.id]);
  });
});

describe('removeEntityFromEdges', () => {
  it('drops edges that name the entity as source or target', () => {
    const a = makeEntity({ title: 'A' });
    const b = makeEntity({ title: 'B' });
    const c = makeEntity({ title: 'C' });
    const ab = makeEdge(a.id, b.id);
    const bc = makeEdge(b.id, c.id);
    const result = removeEntityFromEdges(makeDoc([a, b, c], [ab, bc]), b.id);
    expect(Object.keys(result)).toEqual([]);
  });

  it('keeps untouched edges intact', () => {
    const a = makeEntity({ title: 'A' });
    const b = makeEntity({ title: 'B' });
    const c = makeEntity({ title: 'C' });
    const ab = makeEdge(a.id, b.id);
    const result = removeEntityFromEdges(makeDoc([a, b, c], [ab]), c.id);
    expect(result[ab.id]).toBe(ab); // same reference — no copy when unaffected
  });

  it('scrubs the id from assumptionIds on surviving edges', () => {
    const a = makeEntity({ title: 'A' });
    const b = makeEntity({ title: 'B' });
    const assumption = makeEntity({ type: 'assumption', title: 'Assumption' });
    const ab = makeEdge(a.id, b.id, { assumptionIds: [assumption.id] });
    const result = removeEntityFromEdges(makeDoc([a, b, assumption], [ab]), assumption.id);
    expect(result[ab.id]).toBeDefined();
    expect(result[ab.id]!.assumptionIds).toBeUndefined();
  });

  it('preserves other assumption ids when only one is removed', () => {
    const a = makeEntity({ title: 'A' });
    const b = makeEntity({ title: 'B' });
    const ass1 = makeEntity({ type: 'assumption', title: 'A1' });
    const ass2 = makeEntity({ type: 'assumption', title: 'A2' });
    const ab = makeEdge(a.id, b.id, { assumptionIds: [ass1.id, ass2.id] });
    const result = removeEntityFromEdges(makeDoc([a, b, ass1, ass2], [ab]), ass1.id);
    expect(result[ab.id]!.assumptionIds).toEqual([ass2.id]);
  });
});
