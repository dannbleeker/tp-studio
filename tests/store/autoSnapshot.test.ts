/**
 * Improvement review — auto-snapshot while editing. A long single-tab session
 * used to accrue zero rollback points (snapshots only fired on doc swap). Now a
 * committed edit captures an "Auto" revision, gated so it fires at most once per
 * interval and only when the doc actually changed since the newest snapshot.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { resetStoreForTest, useDocumentStore } from '@/store';
import { AUTO_SNAPSHOT_INTERVAL_MS } from '@/store/documentSlice/docMutate';

const s = () => useDocumentStore.getState();
const autoCount = () => s().revisions.filter((r) => r.label === 'Auto').length;

beforeEach(() => {
  resetStoreForTest();
  localStorage.clear();
  // resetStoreForTest disables auto-snapshot for determinism; this suite is
  // the one place that exercises it, so turn it back on.
  s().setAutoSnapshot(true);
  vi.useFakeTimers();
  vi.setSystemTime(1_000);
});
afterEach(() => vi.useRealTimers());

describe('auto-snapshot while editing', () => {
  it('snapshots the first edit, then not again within the interval', () => {
    const a = s().addEntity({ type: 'ude', title: 'A' }); // first edit → no prior snapshot → captures
    expect(autoCount()).toBe(1);
    s().updateEntity(a.id, { title: 'A2' }); // same instant → time-gated
    expect(autoCount()).toBe(1);
  });

  it('snapshots again once the interval elapses and the doc changed', () => {
    const a = s().addEntity({ type: 'ude', title: 'A' });
    expect(autoCount()).toBe(1);
    vi.setSystemTime(1_000 + AUTO_SNAPSHOT_INTERVAL_MS + 1);
    s().updateEntity(a.id, { title: 'A2' }); // interval passed + real diff → captures
    expect(autoCount()).toBe(2);
  });

  it('does not snapshot when the doc has not changed since the newest snapshot', () => {
    const a = s().addEntity({ type: 'ude', title: 'A' }); // auto #1
    expect(autoCount()).toBe(1);
    vi.setSystemTime(1_000 + AUTO_SNAPSHOT_INTERVAL_MS + 1);
    // A no-op update (same title) doesn't change the doc reference, so
    // applyDocChange short-circuits before the snapshot check.
    s().updateEntity(a.id, { title: 'A' });
    expect(autoCount()).toBe(1);
  });

  it('does not snapshot when the setting is off', () => {
    s().setAutoSnapshot(false);
    const a = s().addEntity({ type: 'ude', title: 'A' });
    s().updateEntity(a.id, { title: 'A2' });
    expect(autoCount()).toBe(0);
  });
});
