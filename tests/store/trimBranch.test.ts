import { beforeEach, describe, expect, it } from 'vitest';
import { resetStoreForTest, useDocumentStore } from '@/store';

/**
 * Phase 3 #4 (TP completeness — NBR trimming) — `trimBranch` mints a trimming
 * injection + a negative-weight edge to the undesirable effect, in one undoable
 * step.
 */

const s = () => useDocumentStore.getState();

beforeEach(resetStoreForTest);

describe('trimBranch', () => {
  it('adds a trimming injection with a negative-weight edge to the effect', () => {
    s().newDocument('frt');
    const effect = s().addEntity({ type: 'ude', title: 'Morale drops' });
    const entitiesBefore = Object.keys(s().doc.entities).length;

    const inj = s().trimBranch(effect.id);

    expect(inj?.type).toBe('injection');
    expect(Object.keys(s().doc.entities).length).toBe(entitiesBefore + 1);

    const trimEdge = Object.values(s().doc.edges).find(
      (e) => e.sourceId === inj?.id && e.targetId === effect.id
    );
    expect(trimEdge).toBeTruthy();
    expect(trimEdge?.weight).toBe('negative');

    // The new injection is selected, ready to name.
    expect(s().selection).toEqual({ kind: 'entities', ids: [inj?.id] });
  });

  it('is a single undo step — the injection and its edge revert together', () => {
    s().newDocument('frt');
    const effect = s().addEntity({ type: 'ude', title: 'X' });
    const entitiesBefore = Object.keys(s().doc.entities).length;
    const edgesBefore = Object.keys(s().doc.edges).length;

    s().trimBranch(effect.id);
    s().undo();

    expect(Object.keys(s().doc.entities).length).toBe(entitiesBefore);
    expect(Object.keys(s().doc.edges).length).toBe(edgesBefore);
  });

  it('returns null when the effect entity is gone', () => {
    s().newDocument('frt');
    expect(s().trimBranch('nonexistent')).toBeNull();
  });
});
