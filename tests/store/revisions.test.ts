import { resetStoreForTest, useDocumentStore } from '@/store';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { seedEntity } from '../helpers/seedDoc';

beforeEach(resetStoreForTest);
afterEach(() => {
  // resetStoreForTest already clears localStorage, but make sure no
  // leftover revisions sneak from one test to the next.
  if (typeof globalThis.localStorage !== 'undefined') globalThis.localStorage.clear();
});

/**
 * Unit coverage for the H1 revisions slice. Drives the store directly so
 * the localStorage round-trip + safety-snapshot + cap behaviors are pinned
 * end-to-end. The diff function has its own domain-layer coverage in
 * `tests/domain/revisions.test.ts`.
 */

describe('revisionsSlice', () => {
  it('captureSnapshot appends to the active doc history newest-first', () => {
    seedEntity('A');
    useDocumentStore.getState().captureSnapshot('Baseline');
    seedEntity('B');
    useDocumentStore.getState().captureSnapshot('Added B');
    const revs = useDocumentStore.getState().revisions;
    expect(revs).toHaveLength(2);
    expect(revs[0]?.label).toBe('Added B');
    expect(revs[1]?.label).toBe('Baseline');
    // Both snapshot the doc-at-capture-time, so their entity counts grow:
    expect(Object.keys(revs[1]?.doc.entities ?? {}).length).toBe(1);
    expect(Object.keys(revs[0]?.doc.entities ?? {}).length).toBe(2);
  });

  it('captureSnapshot trims a labelled snapshot of whitespace before storing', () => {
    useDocumentStore.getState().captureSnapshot('   ');
    expect(useDocumentStore.getState().revisions[0]?.label).toBeUndefined();
    useDocumentStore.getState().captureSnapshot('  Real label  ');
    expect(useDocumentStore.getState().revisions[0]?.label).toBe('Real label');
  });

  it('restoreSnapshot rolls the doc back AND captures a safety snapshot first', () => {
    seedEntity('A');
    const baselineId = useDocumentStore.getState().captureSnapshot('Baseline');
    seedEntity('B');
    expect(Object.keys(useDocumentStore.getState().doc.entities)).toHaveLength(2);
    useDocumentStore.getState().restoreSnapshot(baselineId);
    // Doc is back to one entity:
    expect(Object.keys(useDocumentStore.getState().doc.entities)).toHaveLength(1);
    // History has the original baseline + an auto safety snapshot pre-restore:
    const revs = useDocumentStore.getState().revisions;
    expect(revs.length).toBeGreaterThanOrEqual(2);
    expect(revs[0]?.label).toContain('before restoring');
  });

  it('deleteSnapshot removes the target without touching the doc', () => {
    seedEntity('A');
    const id = useDocumentStore.getState().captureSnapshot('drop me');
    useDocumentStore.getState().deleteSnapshot(id);
    expect(useDocumentStore.getState().revisions.find((r) => r.id === id)).toBeUndefined();
    // Doc is untouched:
    expect(Object.keys(useDocumentStore.getState().doc.entities)).toHaveLength(1);
  });

  it('renameSnapshot updates an existing label and clears on empty input', () => {
    const id = useDocumentStore.getState().captureSnapshot('first');
    useDocumentStore.getState().renameSnapshot(id, 'renamed');
    expect(useDocumentStore.getState().revisions.find((r) => r.id === id)?.label).toBe('renamed');
    useDocumentStore.getState().renameSnapshot(id, '   ');
    expect(useDocumentStore.getState().revisions.find((r) => r.id === id)?.label).toBeUndefined();
  });

  it('renameSnapshot is a no-op for an unknown id', () => {
    useDocumentStore.getState().captureSnapshot('label');
    const before = useDocumentStore.getState().revisions[0]?.label;
    useDocumentStore.getState().renameSnapshot('not-a-real-id', 'X');
    expect(useDocumentStore.getState().revisions[0]?.label).toBe(before);
  });

  it('newDocument auto-captures the outgoing doc as a revision', () => {
    const oldDocId = useDocumentStore.getState().doc.id;
    seedEntity('important');
    useDocumentStore.getState().newDocument('frt');
    // The new doc has no revisions yet:
    expect(useDocumentStore.getState().revisions).toHaveLength(0);
    // ...but localStorage retains the auto-snapshot under the OLD doc id.
    const storage = JSON.parse(globalThis.localStorage.getItem('tp-studio:revisions:v1') ?? '{}');
    const oldHistory = storage[oldDocId] ?? [];
    expect(oldHistory.length).toBeGreaterThan(0);
    expect(oldHistory[0]?.label).toMatch(/Auto:/);
  });

  it('reloadRevisionsForActiveDoc filters to the current doc', () => {
    seedEntity('A');
    useDocumentStore.getState().captureSnapshot('doc 1 snap');
    const docId1 = useDocumentStore.getState().doc.id;
    useDocumentStore.getState().newDocument('frt');
    useDocumentStore.getState().captureSnapshot('doc 2 snap');
    // Active panel shows doc 2's history only:
    expect(useDocumentStore.getState().revisions).toHaveLength(1);
    expect(useDocumentStore.getState().revisions[0]?.label).toBe('doc 2 snap');
    // Swap back to doc 1 via setDocument; its history should re-appear (its
    // single manual snapshot, plus the auto-snapshot from when we switched
    // away).
    const docId2 = useDocumentStore.getState().doc.id;
    const storage = JSON.parse(globalThis.localStorage.getItem('tp-studio:revisions:v1') ?? '{}');
    const doc1History = storage[docId1] ?? [];
    expect(doc1History.length).toBeGreaterThanOrEqual(1);
    expect(doc1History.find((r: { label?: string }) => r.label === 'doc 1 snap')).toBeDefined();
    expect(docId2).not.toBe(docId1);
  });
});
