import { beforeEach, describe, expect, it } from 'vitest';
import { resolveCloudState } from '@/domain/cloudResolution';
import type { Assumption, Entity, TPDocument } from '@/domain/types';
import { makeDoc, makeEdge, makeEntity, resetIds } from './helpers';

const makeAssumption = (edgeId: string, overrides: Partial<Assumption> = {}): Assumption => {
  const now = 1_700_000_000_000;
  return {
    id: `asm-${edgeId}`,
    edgeId,
    text: 'Only one of us can have it',
    status: 'unexamined',
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
};

/**
 * A canonical five-box cloud: A ← B ← D, A ← C ← D′, plus the D↔D′ mutex
 * conflict arrow. Returns the doc pieces so tests can layer assumptions +
 * injections on top.
 */
const buildCloud = () => {
  const a = makeEntity({ type: 'goal', title: 'A', ecSlot: 'a' });
  const b = makeEntity({ type: 'need', title: 'B', ecSlot: 'b' });
  const c = makeEntity({ type: 'need', title: 'C', ecSlot: 'c' });
  const d = makeEntity({ type: 'want', title: 'D', ecSlot: 'd' });
  const dPrime = makeEntity({ type: 'want', title: "D'", ecSlot: 'dPrime' });
  const conflict = makeEdge(d.id, dPrime.id, { kind: 'necessity', isMutualExclusion: true });
  const edges = [
    makeEdge(b.id, a.id, { kind: 'necessity' }),
    makeEdge(c.id, a.id, { kind: 'necessity' }),
    makeEdge(d.id, b.id, { kind: 'necessity' }),
    makeEdge(dPrime.id, c.id, { kind: 'necessity' }),
    conflict,
  ];
  return { entities: [a, b, c, d, dPrime], edges, conflict, d, dPrime };
};

const withAssumptions = (doc: TPDocument, assumptions: Assumption[]): TPDocument => ({
  ...doc,
  assumptions: Object.fromEntries(assumptions.map((a) => [a.id, a])),
});

const makeInjection = (implemented: boolean): Entity =>
  makeEntity({
    type: 'injection',
    title: 'Break the constraint',
    ...(implemented ? { attributes: { implemented: { kind: 'bool', value: true } } } : {}),
  });

describe('resolveCloudState', () => {
  beforeEach(resetIds);

  it('is unresolved on a non-EC document', () => {
    const { entities, edges } = buildCloud();
    const doc = makeDoc(entities, edges, 'crt');
    expect(resolveCloudState(doc).resolved).toBe(false);
  });

  it('is unresolved when no mutual-exclusion edge exists between wants', () => {
    const { entities, edges, conflict } = buildCloud();
    const withoutMutex = edges.map((e) => {
      if (e.id !== conflict.id) return e;
      const { isMutualExclusion: _drop, ...rest } = e;
      return rest;
    });
    const doc = makeDoc(entities, withoutMutex, 'ec');
    expect(resolveCloudState(doc).resolved).toBe(false);
  });

  it('is unresolved when the conflict arrow has no assumptions', () => {
    const { entities, edges } = buildCloud();
    const doc = makeDoc(entities, edges, 'ec');
    expect(resolveCloudState(doc).resolved).toBe(false);
  });

  it('is unresolved when the conflict assumption has no linked injection', () => {
    const { entities, edges, conflict } = buildCloud();
    const doc = withAssumptions(makeDoc(entities, edges, 'ec'), [makeAssumption(conflict.id)]);
    expect(resolveCloudState(doc).resolved).toBe(false);
  });

  it('is unresolved when the linked injection is not implemented', () => {
    const { entities, edges, conflict } = buildCloud();
    const injection = makeInjection(false);
    const doc = withAssumptions(makeDoc([...entities, injection], edges, 'ec'), [
      makeAssumption(conflict.id, { injectionIds: [injection.id] }),
    ]);
    expect(resolveCloudState(doc).resolved).toBe(false);
  });

  it('resolves when a conflict assumption is challenged by an implemented injection', () => {
    const { entities, edges, conflict, d, dPrime } = buildCloud();
    const injection = makeInjection(true);
    const doc = withAssumptions(makeDoc([...entities, injection], edges, 'ec'), [
      makeAssumption(conflict.id, { injectionIds: [injection.id] }),
    ]);
    const state = resolveCloudState(doc);
    expect(state.resolved).toBe(true);
    if (state.resolved) {
      expect(state.conflictEdgeId).toBe(conflict.id);
      expect(state.wantIds).toEqual([d.id, dPrime.id]);
    }
  });

  it('ignores implemented injections linked to assumptions on non-conflict edges', () => {
    const { entities, edges, d } = buildCloud();
    const supportEdge = edges.find((e) => e.sourceId === d.id && !e.isMutualExclusion);
    if (!supportEdge) throw new Error('cloud fixture is missing the D→B edge');
    const injection = makeInjection(true);
    const doc = withAssumptions(makeDoc([...entities, injection], edges, 'ec'), [
      makeAssumption(supportEdge.id, { injectionIds: [injection.id] }),
    ]);
    expect(resolveCloudState(doc).resolved).toBe(false);
  });

  it('resolves when ONE of several conflict assumptions is broken (TOC semantics)', () => {
    const { entities, edges, conflict } = buildCloud();
    const injection = makeInjection(true);
    const doc = withAssumptions(makeDoc([...entities, injection], edges, 'ec'), [
      makeAssumption(conflict.id, { id: 'asm-untouched' }),
      makeAssumption(conflict.id, { id: 'asm-broken', injectionIds: [injection.id] }),
    ]);
    expect(resolveCloudState(doc).resolved).toBe(true);
  });
});
