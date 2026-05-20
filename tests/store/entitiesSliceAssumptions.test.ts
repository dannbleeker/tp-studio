import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { resetStoreForTest, useDocumentStore } from '@/store';
import { seedConnectedPair, seedEntity } from '../helpers/seedDoc';

/**
 * Session 134 coverage push (round 3) — `entitiesSlice.ts` was at
 * 65% statements / 71% lines, with the gap concentrated on the
 * assumption-related actions (setAssumptionStatus / setAssumptionText /
 * setAssumptionResolved / linkInjectionToAssumption /
 * unlinkInjectionFromAssumption) and the toggleEntityCollapsed branch.
 *
 * These actions are pure store mutations — straightforward to drive
 * directly via `useDocumentStore.getState().X(...)` and assert the
 * resulting doc shape.
 */

beforeEach(resetStoreForTest);
afterEach(resetStoreForTest);

const s = () => useDocumentStore.getState();

const seedEdgeWithAssumption = () => {
  const { edge } = seedConnectedPair('Root', 'Effect');
  const a = useDocumentStore.getState().addAssumptionToEdge(edge.id);
  if (!a) throw new Error('addAssumptionToEdge failed');
  return { edge, assumption: a };
};

describe('entitiesSlice — toggleEntityCollapsed', () => {
  it("flips an entity's collapsed flag on then off", () => {
    const e = seedEntity('thing');
    expect(s().doc.entities[e.id]?.collapsed).toBeUndefined();
    useDocumentStore.getState().toggleEntityCollapsed(e.id);
    expect(s().doc.entities[e.id]?.collapsed).toBe(true);
    useDocumentStore.getState().toggleEntityCollapsed(e.id);
    expect(s().doc.entities[e.id]?.collapsed).toBeUndefined();
  });

  it('is a no-op when the entity id is unknown', () => {
    const before = s().doc;
    useDocumentStore.getState().toggleEntityCollapsed('nope');
    expect(s().doc).toBe(before);
  });
});

describe('entitiesSlice — setAssumptionStatus', () => {
  it('updates the status field', () => {
    const { assumption } = seedEdgeWithAssumption();
    useDocumentStore.getState().setAssumptionStatus(assumption.id, 'valid');
    expect(s().doc.assumptions?.[assumption.id]?.status).toBe('valid');
  });

  it('is a no-op when status is unchanged', () => {
    const { assumption } = seedEdgeWithAssumption();
    const before = s().doc;
    useDocumentStore
      .getState()
      .setAssumptionStatus(
        assumption.id,
        s().doc.assumptions?.[assumption.id]?.status ?? 'unexamined'
      );
    expect(s().doc).toBe(before);
  });

  it('is a no-op for an unknown assumption id', () => {
    const before = s().doc;
    useDocumentStore.getState().setAssumptionStatus('nope', 'invalid');
    expect(s().doc).toBe(before);
  });
});

describe('entitiesSlice — setAssumptionText', () => {
  it('updates both the assumption text and the dual-write entity title', () => {
    const { assumption } = seedEdgeWithAssumption();
    useDocumentStore.getState().setAssumptionText(assumption.id, 'New text');
    expect(s().doc.assumptions?.[assumption.id]?.text).toBe('New text');
    // Dual-write: the assumption-typed entity's `title` should mirror.
    const ent = s().doc.entities[assumption.id];
    if (ent && ent.type === 'assumption') {
      expect(ent.title).toBe('New text');
    }
  });

  it('is a no-op for an unknown assumption id', () => {
    const before = s().doc;
    useDocumentStore.getState().setAssumptionText('nope', 'x');
    expect(s().doc).toBe(before);
  });
});

describe('entitiesSlice — setAssumptionResolved', () => {
  it('flips the resolved flag on (and the field is present)', () => {
    const { assumption } = seedEdgeWithAssumption();
    useDocumentStore.getState().setAssumptionResolved(assumption.id, true);
    expect(s().doc.assumptions?.[assumption.id]?.resolved).toBe(true);
  });

  it('flips the resolved flag off (and the field is dropped)', () => {
    const { assumption } = seedEdgeWithAssumption();
    useDocumentStore.getState().setAssumptionResolved(assumption.id, true);
    useDocumentStore.getState().setAssumptionResolved(assumption.id, false);
    expect(s().doc.assumptions?.[assumption.id]?.resolved).toBeUndefined();
  });

  it('is a no-op when already in the requested state', () => {
    const { assumption } = seedEdgeWithAssumption();
    const before = s().doc;
    useDocumentStore.getState().setAssumptionResolved(assumption.id, false);
    expect(s().doc).toBe(before);
  });

  it('is a no-op for an unknown id', () => {
    const before = s().doc;
    useDocumentStore.getState().setAssumptionResolved('nope', true);
    expect(s().doc).toBe(before);
  });
});

describe('entitiesSlice — linkInjectionToAssumption / unlinkInjectionFromAssumption', () => {
  it('links and unlinks an injection on an assumption', () => {
    const { assumption } = seedEdgeWithAssumption();
    const inj = seedEntity('Auto-publish', 'injection');
    useDocumentStore.getState().linkInjectionToAssumption(assumption.id, inj.id);
    expect(s().doc.assumptions?.[assumption.id]?.injectionIds).toContain(inj.id);
    useDocumentStore.getState().unlinkInjectionFromAssumption(assumption.id, inj.id);
    expect(s().doc.assumptions?.[assumption.id]?.injectionIds ?? []).not.toContain(inj.id);
  });

  it('linking the same injection twice is a no-op (no duplicates)', () => {
    const { assumption } = seedEdgeWithAssumption();
    const inj = seedEntity('Auto-publish', 'injection');
    useDocumentStore.getState().linkInjectionToAssumption(assumption.id, inj.id);
    const before = s().doc;
    useDocumentStore.getState().linkInjectionToAssumption(assumption.id, inj.id);
    expect(s().doc).toBe(before);
  });

  it('unlinking a never-linked injection is a no-op', () => {
    const { assumption } = seedEdgeWithAssumption();
    const inj = seedEntity('Auto-publish', 'injection');
    const before = s().doc;
    useDocumentStore.getState().unlinkInjectionFromAssumption(assumption.id, inj.id);
    expect(s().doc).toBe(before);
  });

  it('linking on an unknown assumption is a no-op', () => {
    const inj = seedEntity('Auto-publish', 'injection');
    const before = s().doc;
    useDocumentStore.getState().linkInjectionToAssumption('nope', inj.id);
    expect(s().doc).toBe(before);
  });
});
