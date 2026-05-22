import { describe, expect, it } from 'vitest';
import { udeReachCounts } from '@/domain/coreDriver';
import { validationFingerprint } from '@/domain/fingerprint';
import { findCycles, hasEdge, pinnedEntities } from '@/domain/graph';
import { descendantEntityCount, findParentGroup } from '@/domain/groups';
import { propagateStates } from '@/domain/statePropagation';
import type { Group, GroupId, TPDocument } from '@/domain/types';
import { makeDoc, makeEdge, makeEntity, resetIds } from './helpers';

/**
 * Session 135 / Perf pass — guards for the WeakMap caches added across
 * the domain layer. The correctness of each function is covered by its
 * own suite; these tests lock the *caching contract*: a reference hit
 * returns the identical memoized object, and a new input reference (the
 * store's immutable-update pattern) recomputes with correct values. A
 * mis-keyed WeakMap would either leak a stale result or never hit —
 * both caught here.
 */

const group = (id: string, memberIds: string[]): Group => ({
  id: id as GroupId,
  title: id,
  color: 'slate',
  memberIds,
  collapsed: false,
  createdAt: 1_700_000_000_000,
  updatedAt: 1_700_000_000_000,
});

describe('perf caches — identity on hit', () => {
  it('propagateStates returns the same object on repeated (no-override) calls', () => {
    resetIds();
    const a = makeEntity({ type: 'effect', state: 'true' });
    const b = makeEntity({ type: 'effect' });
    const doc = makeDoc([a, b], [makeEdge(a.id, b.id)]);
    const first = propagateStates(doc);
    const second = propagateStates(doc);
    expect(second).toBe(first); // cache hit → identical reference
  });

  it('propagateStates with overrides bypasses the cache (fresh result)', () => {
    resetIds();
    const a = makeEntity({ type: 'effect', state: 'true' });
    const b = makeEntity({ type: 'effect' });
    const doc = makeDoc([a, b], [makeEdge(a.id, b.id)]);
    const plain = propagateStates(doc);
    const speculated = propagateStates(doc, { [a.id]: 'false' });
    expect(speculated).not.toBe(plain);
    expect(speculated[b.id]).toBe('false'); // override flowed downstream
  });

  it('udeReachCounts returns the same map on repeated calls', () => {
    resetIds();
    const root = makeEntity({ type: 'rootCause' });
    const ude = makeEntity({ type: 'ude' });
    const doc = makeDoc([root, ude], [makeEdge(root.id, ude.id)]);
    const first = udeReachCounts(doc);
    expect(udeReachCounts(doc)).toBe(first);
    expect(first.get(root.id)).toBe(1);
  });

  it('findCycles returns the same array on repeated calls', () => {
    resetIds();
    const a = makeEntity();
    const b = makeEntity();
    const doc = makeDoc(
      [a, b],
      [makeEdge(a.id, b.id), makeEdge(b.id, a.id, { isBackEdge: false })]
    );
    const first = findCycles(doc);
    expect(findCycles(doc)).toBe(first);
    expect(first).toHaveLength(1);
  });

  it('pinnedEntities caches on the entities reference', () => {
    resetIds();
    const a = makeEntity({ position: { x: 1, y: 2 } });
    const b = makeEntity();
    const doc = makeDoc([a, b], []);
    const first = pinnedEntities(doc);
    expect(pinnedEntities(doc)).toBe(first);
    expect(first.map((e) => e.id)).toEqual([a.id]);
  });
});

describe('perf caches — invalidation on new reference', () => {
  it('propagateStates recomputes when edges get a new reference', () => {
    resetIds();
    const a = makeEntity({ type: 'effect', state: 'true' });
    const b = makeEntity({ type: 'effect' });
    const doc1 = makeDoc([a, b], [makeEdge(a.id, b.id)]);
    expect(propagateStates(doc1)[b.id]).toBe('true');
    // New edges map (no edge) → b no longer derives true.
    const doc2: TPDocument = { ...doc1, edges: {} };
    const r2 = propagateStates(doc2);
    expect(r2).not.toBe(propagateStates(doc1));
    expect(r2[b.id]).toBe('unknown');
  });

  it('hasEdge reflects a new edges reference', () => {
    resetIds();
    const a = makeEntity();
    const b = makeEntity();
    const e = makeEdge(a.id, b.id);
    const doc1 = makeDoc([a, b], [e]);
    expect(hasEdge(doc1, a.id, b.id)).toBe(true);
    const doc2: TPDocument = { ...doc1, edges: {} };
    expect(hasEdge(doc2, a.id, b.id)).toBe(false);
  });
});

describe('perf caches — groups', () => {
  it('findParentGroup resolves direct membership via the cached index', () => {
    resetIds();
    const a = makeEntity();
    const b = makeEntity();
    const doc: TPDocument = { ...makeDoc([a, b], []), groups: {} };
    const g = group('g-1', [a.id]);
    const withGroup: TPDocument = { ...doc, groups: { [g.id]: g } };
    expect(findParentGroup(withGroup, a.id)?.id).toBe(g.id);
    expect(findParentGroup(withGroup, b.id)).toBeUndefined();
    // Repeated call hits the cache and stays correct.
    expect(findParentGroup(withGroup, a.id)?.id).toBe(g.id);
  });

  it('descendantEntityCount counts transitive entity members (nested groups excluded)', () => {
    resetIds();
    const a = makeEntity();
    const b = makeEntity();
    const c = makeEntity();
    const inner = group('g-inner', [b.id, c.id]);
    const outer = group('g-outer', [a.id, inner.id]);
    const doc: TPDocument = {
      ...makeDoc([a, b, c], []),
      groups: { [inner.id]: inner, [outer.id]: outer },
    };
    // a + b + c are entities; g-inner is a group (not counted as an entity).
    expect(descendantEntityCount(doc, outer.id)).toBe(3);
    expect(descendantEntityCount(doc, inner.id)).toBe(2);
    // Repeated call (cache hit) is stable.
    expect(descendantEntityCount(doc, outer.id)).toBe(3);
  });
});

describe('perf caches — validation fingerprint', () => {
  it('returns the same string on repeated calls and changes on a title edit', () => {
    resetIds();
    const a = makeEntity({ title: 'Original' });
    const doc = makeDoc([a], []);
    const fp1 = validationFingerprint(doc);
    expect(validationFingerprint(doc)).toBe(fp1);
    const edited = { ...a, title: 'Changed' };
    const doc2: TPDocument = { ...doc, entities: { [a.id]: edited } };
    expect(validationFingerprint(doc2)).not.toBe(fp1);
  });
});
