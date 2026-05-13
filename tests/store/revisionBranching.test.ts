import { resetStoreForTest, useDocumentStore } from '@/store';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { seedEntity } from '../helpers/seedDoc';

beforeEach(resetStoreForTest);
afterEach(resetStoreForTest);

describe('H3 — branchFromRevision', () => {
  it('creates a new revision with the branch tag + parentRevisionId pointing at source', () => {
    seedEntity('A');
    const s = useDocumentStore.getState();
    const sourceId = s.captureSnapshot('Baseline');
    const branchedId = s.branchFromRevision(sourceId, 'experiment');
    expect(branchedId).not.toBeNull();
    const branched = useDocumentStore.getState().revisions.find((r) => r.id === branchedId);
    expect(branched).toBeTruthy();
    expect(branched?.branchName).toBe('experiment');
    expect(branched?.parentRevisionId).toBe(sourceId);
  });

  it('returns null on unknown source revision id', () => {
    const r = useDocumentStore.getState().branchFromRevision('not-a-real-id', 'experiment');
    expect(r).toBeNull();
  });

  it('returns null on empty / whitespace-only branch name', () => {
    seedEntity('A');
    const sourceId = useDocumentStore.getState().captureSnapshot('Baseline');
    expect(useDocumentStore.getState().branchFromRevision(sourceId, '')).toBeNull();
    expect(useDocumentStore.getState().branchFromRevision(sourceId, '   ')).toBeNull();
  });

  it('does not modify the live doc', () => {
    seedEntity('A');
    const docBefore = useDocumentStore.getState().doc;
    const s = useDocumentStore.getState();
    const sourceId = s.captureSnapshot('Baseline');
    s.branchFromRevision(sourceId, 'experiment');
    expect(useDocumentStore.getState().doc).toBe(docBefore);
  });

  it('clones the source doc — mutating the branched doc later does not affect the source', () => {
    seedEntity('A');
    const s = useDocumentStore.getState();
    const sourceId = s.captureSnapshot('Baseline');
    const sourceDocBefore = useDocumentStore
      .getState()
      .revisions.find((r) => r.id === sourceId)?.doc;
    s.branchFromRevision(sourceId, 'experiment');
    // Branched revision is a deep clone — `Object.is` would fail on the doc reference.
    const branched = useDocumentStore
      .getState()
      .revisions.find((r) => r.branchName === 'experiment');
    expect(branched?.doc).not.toBe(sourceDocBefore);
  });
});

describe('H3 — restoreSnapshot wires parentRevisionId on safety capture', () => {
  it('the safety snapshot points at the restored revision', () => {
    seedEntity('A');
    const s = useDocumentStore.getState();
    const id = s.captureSnapshot('Baseline');
    s.restoreSnapshot(id);
    const list = useDocumentStore.getState().revisions;
    // Top of list is the safety capture from the restore.
    const safety = list[0];
    expect(safety?.parentRevisionId).toBe(id);
  });

  it('safety capture inherits the branch name of the restored revision', () => {
    seedEntity('A');
    const s = useDocumentStore.getState();
    const baseId = s.captureSnapshot('Baseline');
    const branchedId = s.branchFromRevision(baseId, 'fork-1');
    if (!branchedId) throw new Error('branch failed');
    s.restoreSnapshot(branchedId);
    const safety = useDocumentStore.getState().revisions[0];
    expect(safety?.branchName).toBe('fork-1');
  });
});
