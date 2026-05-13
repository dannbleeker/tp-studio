import { findCoreDrivers, udeReachCounts } from '@/domain/coreDriver';
import { resetStoreForTest, useDocumentStore } from '@/store';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { seedConnectedPair, seedEntity } from '../helpers/seedDoc';

beforeEach(resetStoreForTest);
afterEach(resetStoreForTest);

const doc = () => useDocumentStore.getState().doc;

describe('udeReachCounts', () => {
  it('returns an empty map when the document has no UDEs', () => {
    seedEntity('Plain effect', 'effect');
    expect(udeReachCounts(doc()).size).toBe(0);
  });

  it('counts UDEs reachable forward from each structural entity', () => {
    // rc → effect → ude
    const rc = seedEntity('Root cause', 'rootCause');
    const mid = seedEntity('Effect', 'effect');
    const ude = seedEntity('UDE', 'ude');
    const state = useDocumentStore.getState();
    state.connect(rc.id, mid.id);
    state.connect(mid.id, ude.id);

    const counts = udeReachCounts(doc());
    expect(counts.get(rc.id)).toBe(1);
    expect(counts.get(mid.id)).toBe(1);
    expect(counts.get(ude.id)).toBeUndefined(); // UDE doesn't reach itself
  });

  it('handles multiple downstream UDEs (counts each once)', () => {
    const rc = seedEntity('Root cause', 'rootCause');
    const u1 = seedEntity('UDE 1', 'ude');
    const u2 = seedEntity('UDE 2', 'ude');
    const state = useDocumentStore.getState();
    state.connect(rc.id, u1.id);
    state.connect(rc.id, u2.id);
    expect(udeReachCounts(doc()).get(rc.id)).toBe(2);
  });

  it('ignores assumption entities entirely', () => {
    seedEntity('UDE', 'ude');
    seedEntity('Side note', 'assumption');
    const counts = udeReachCounts(doc());
    // Assumption is not structural and shouldn't appear as a reaching entity.
    expect([...counts.keys()].some((id) => doc().entities[id]?.type === 'assumption')).toBe(false);
  });
});

describe('findCoreDrivers', () => {
  it('returns [] for a diagram with no UDEs', () => {
    seedConnectedPair('Plain cause', 'Plain effect');
    expect(findCoreDrivers(doc())).toEqual([]);
  });

  it('returns [] when no root cause reaches any UDE', () => {
    // Two disconnected subgraphs: rc isolated from the ude.
    seedEntity('Lonely root cause', 'rootCause');
    seedEntity('Lonely UDE', 'ude');
    expect(findCoreDrivers(doc())).toEqual([]);
  });

  it('finds the dominant Core Driver and scores it correctly', () => {
    // rcA reaches 2 UDEs, rcB reaches 1 UDE.
    const rcA = seedEntity('Strong root cause', 'rootCause');
    const rcB = seedEntity('Weak root cause', 'rootCause');
    const u1 = seedEntity('UDE 1', 'ude');
    const u2 = seedEntity('UDE 2', 'ude');
    const u3 = seedEntity('UDE 3', 'ude');
    const s = useDocumentStore.getState();
    s.connect(rcA.id, u1.id);
    s.connect(rcA.id, u2.id);
    s.connect(rcB.id, u3.id);
    const candidates = findCoreDrivers(doc());
    expect(candidates.length).toBeGreaterThan(0);
    const top = candidates[0];
    expect(top?.entity.id).toBe(rcA.id);
    expect(top?.reachedUdeCount).toBe(2);
  });

  it('returns the candidate sorted by reach descending, annotation ascending', () => {
    const rcA = seedEntity('A', 'rootCause');
    const rcB = seedEntity('B', 'rootCause');
    const u1 = seedEntity('U1', 'ude');
    const u2 = seedEntity('U2', 'ude');
    const s = useDocumentStore.getState();
    // Both reach exactly one UDE → tie → annotation order breaks it.
    s.connect(rcA.id, u1.id);
    s.connect(rcB.id, u2.id);
    const candidates = findCoreDrivers(doc());
    expect(candidates.map((c) => c.entity.id)).toEqual([rcA.id, rcB.id]);
  });

  it('falls back to "no incoming structural edges" when no rootCause entities exist', () => {
    // Use plain effects rather than rootCause entities. The bottom-of-graph
    // entity (no structural incoming) should still surface as a candidate.
    const leaf = seedEntity('Leaf cause', 'effect');
    const mid = seedEntity('Mid', 'effect');
    const ude = seedEntity('UDE', 'ude');
    const s = useDocumentStore.getState();
    s.connect(leaf.id, mid.id);
    s.connect(mid.id, ude.id);
    const candidates = findCoreDrivers(doc());
    expect(candidates[0]?.entity.id).toBe(leaf.id);
    expect(candidates[0]?.reachedUdeCount).toBe(1);
  });

  it('exposes the reached UDE id list for downstream UI use', () => {
    const rc = seedEntity('Root cause', 'rootCause');
    const u1 = seedEntity('UDE 1', 'ude');
    const u2 = seedEntity('UDE 2', 'ude');
    const s = useDocumentStore.getState();
    s.connect(rc.id, u1.id);
    s.connect(rc.id, u2.id);
    const candidates = findCoreDrivers(doc());
    expect(candidates[0]?.reachedUdeIds).toEqual(expect.arrayContaining([u1.id, u2.id]));
  });
});
