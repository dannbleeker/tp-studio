import { beforeEach, describe, expect, it } from 'vitest';
import { resetStoreForTest, useDocumentStore } from '@/store';
import { seedEntity } from '../helpers/seedDoc';

/**
 * Session 135 / spec gap #4 Phase 1C — speculation overlay store slice.
 *
 * The overlay is UI-only (null = not speculating). Committing writes
 * the overrides into the persisted `entity.state` in one history step;
 * reverting drops them. These tests pin the state machine + the commit
 * / revert doc effects.
 */

beforeEach(resetStoreForTest);

const s = () => useDocumentStore.getState();

describe('speculation slice — enter / exit', () => {
  it('starts not speculating (overlay null)', () => {
    expect(s().speculationOverlay).toBeNull();
  });

  it('beginSpeculation enters with an empty overlay', () => {
    s().beginSpeculation();
    expect(s().speculationOverlay).toEqual({});
  });

  it('beginSpeculation is a no-op when already speculating (preserves overrides)', () => {
    const e = seedEntity('A');
    s().setSpeculativeState(e.id, 'true');
    s().beginSpeculation();
    expect(s().speculationOverlay).toEqual({ [e.id]: 'true' });
  });

  it('revertSpeculation drops the overlay back to null', () => {
    const e = seedEntity('A');
    s().setSpeculativeState(e.id, 'false');
    s().revertSpeculation();
    expect(s().speculationOverlay).toBeNull();
  });
});

describe('speculation slice — setting / clearing overrides', () => {
  it('setSpeculativeState auto-enters speculation mode', () => {
    const e = seedEntity('A');
    expect(s().speculationOverlay).toBeNull();
    s().setSpeculativeState(e.id, 'disputed');
    expect(s().speculationOverlay).toEqual({ [e.id]: 'disputed' });
  });

  it('replaces an existing override', () => {
    const e = seedEntity('A');
    s().setSpeculativeState(e.id, 'true');
    s().setSpeculativeState(e.id, 'false');
    expect(s().speculationOverlay).toEqual({ [e.id]: 'false' });
  });

  it('clearSpeculativeState removes one override but stays in mode', () => {
    const a = seedEntity('A');
    const b = seedEntity('B');
    s().setSpeculativeState(a.id, 'true');
    s().setSpeculativeState(b.id, 'false');
    s().clearSpeculativeState(a.id);
    expect(s().speculationOverlay).toEqual({ [b.id]: 'false' });
  });

  it('setSpeculativeState(undefined) clears the entity override', () => {
    const e = seedEntity('A');
    s().setSpeculativeState(e.id, 'true');
    s().setSpeculativeState(e.id, undefined);
    expect(s().speculationOverlay).toEqual({});
  });

  it('clearSpeculativeState is a no-op when not speculating', () => {
    const e = seedEntity('A');
    s().clearSpeculativeState(e.id);
    expect(s().speculationOverlay).toBeNull();
  });
});

describe('speculation slice — commit', () => {
  it('writes overrides into entity.state and exits speculation', () => {
    const a = seedEntity('A');
    const b = seedEntity('B');
    s().setSpeculativeState(a.id, 'true');
    s().setSpeculativeState(b.id, 'false');
    s().commitSpeculation();
    expect(s().speculationOverlay).toBeNull();
    expect(s().doc.entities[a.id]?.state).toBe('true');
    expect(s().doc.entities[b.id]?.state).toBe('false');
  });

  it('commit is a single undo step for a multi-entity overlay', () => {
    const a = seedEntity('A');
    const b = seedEntity('B');
    const pastLenBefore = s().past.length;
    s().setSpeculativeState(a.id, 'true');
    s().setSpeculativeState(b.id, 'false');
    s().commitSpeculation();
    // Exactly one history entry pushed by the bulk write.
    expect(s().past.length).toBe(pastLenBefore + 1);
    // Undo reverses the whole commit.
    s().undo();
    expect(s().doc.entities[a.id]?.state).toBeUndefined();
    expect(s().doc.entities[b.id]?.state).toBeUndefined();
  });

  it('commit with an empty overlay just exits (no doc change)', () => {
    s().beginSpeculation();
    const before = s().doc;
    s().commitSpeculation();
    expect(s().speculationOverlay).toBeNull();
    expect(s().doc).toBe(before);
  });

  it('commit is a no-op when not speculating', () => {
    const before = s().doc;
    s().commitSpeculation();
    expect(s().doc).toBe(before);
  });
});

describe('speculation slice — setEntityStates bulk action', () => {
  it('clears a state when passed undefined (field dropped)', () => {
    const e = seedEntity('A');
    s().setEntityStates([{ id: e.id, state: 'true' }]);
    expect(s().doc.entities[e.id]?.state).toBe('true');
    s().setEntityStates([{ id: e.id, state: undefined }]);
    const rec = s().doc.entities[e.id];
    expect(rec?.state).toBeUndefined();
    expect(rec && 'state' in rec).toBe(false);
  });

  it('is a no-op when every entry already matches', () => {
    const e = seedEntity('A');
    s().setEntityStates([{ id: e.id, state: 'true' }]);
    const before = s().doc;
    s().setEntityStates([{ id: e.id, state: 'true' }]);
    expect(s().doc).toBe(before);
  });

  it('skips unknown ids', () => {
    const e = seedEntity('A');
    s().setEntityStates([
      { id: e.id, state: 'disputed' },
      { id: 'nope', state: 'true' },
    ]);
    expect(s().doc.entities[e.id]?.state).toBe('disputed');
    expect(s().doc.entities.nope).toBeUndefined();
  });
});
