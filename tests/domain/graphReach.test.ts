import { beforeEach, describe, expect, it } from 'vitest';
import { findCycles, findPath } from '@/domain/graphReach';
import { resetStoreForTest, useDocumentStore } from '@/store';
import { seedEntity } from '../helpers/seedDoc';

beforeEach(resetStoreForTest);
const s = () => useDocumentStore.getState();

describe('findCycles', () => {
  it('returns no cycles for an acyclic graph', () => {
    const a = seedEntity('A');
    const b = seedEntity('B');
    s().connect(a.id, b.id);
    expect(findCycles(s().doc)).toEqual([]);
  });

  it('detects a directed cycle over its three members', () => {
    const a = seedEntity('A');
    const b = seedEntity('B');
    const c = seedEntity('C');
    s().connect(a.id, b.id);
    s().connect(b.id, c.id);
    s().connect(c.id, a.id); // closes A → B → C → A
    const cycles = findCycles(s().doc);
    expect(cycles).toHaveLength(1);
    expect(new Set(cycles[0])).toEqual(new Set([a.id, b.id, c.id]));
  });

  it('memoises on the edge-set reference (same array on a repeat call)', () => {
    const a = seedEntity('A');
    const b = seedEntity('B');
    s().connect(a.id, b.id);
    const doc = s().doc;
    expect(findCycles(doc)).toBe(findCycles(doc)); // WeakMap cache hit
  });
});

describe('findPath', () => {
  it('finds a route across a diamond, skipping the already-visited join node', () => {
    // A → B, A → C, B → D, C → D — two routes converge on D.
    const a = seedEntity('A');
    const b = seedEntity('B');
    const c = seedEntity('C');
    const d = seedEntity('D');
    s().connect(a.id, b.id);
    s().connect(a.id, c.id);
    s().connect(b.id, d.id);
    s().connect(c.id, d.id);
    const path = findPath(s().doc, a.id, d.id);
    expect(path).not.toBeNull();
    expect(path?.entityIds[0]).toBe(a.id);
    expect(path?.entityIds.at(-1)).toBe(d.id);
  });

  it('returns null when neither a directed nor an undirected route exists', () => {
    const a = seedEntity('A');
    const b = seedEntity('B'); // no edge between them
    expect(findPath(s().doc, a.id, b.id)).toBeNull();
  });
});
