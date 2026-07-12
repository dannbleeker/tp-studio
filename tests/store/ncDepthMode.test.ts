import { beforeEach, describe, expect, it } from 'vitest';
import { exportToJSON, importFromJSON } from '@/domain/persistence';
import { resetStoreForTest, useDocumentStore } from '@/store';

beforeEach(resetStoreForTest);

/**
 * Session 199 (backlog A4) — `setNcDepthMode` store action + JSON persistence.
 * Mirrors `setCloudType`: persists the opt-in mode, treats `undefined` as the
 * strict-default clear (drops the field) so a strict Goal Tree round-trips
 * unchanged, and the import path drops any unknown value.
 */
describe('setNcDepthMode', () => {
  const s = () => useDocumentStore.getState();

  it('defaults to undefined (strict) on a fresh Goal Tree', () => {
    s().newDocument('goalTree');
    expect(s().doc.ncDepthMode).toBeUndefined();
  });

  it('persists conflict-resolution mode and clears back to strict', () => {
    s().newDocument('goalTree');
    s().setNcDepthMode('conflict-resolution');
    expect(s().doc.ncDepthMode).toBe('conflict-resolution');
    s().setNcDepthMode(undefined);
    expect(s().doc.ncDepthMode).toBeUndefined();
  });

  it('is a no-op when already in the requested mode', () => {
    s().newDocument('goalTree');
    s().setNcDepthMode('conflict-resolution');
    const before = s().doc;
    s().setNcDepthMode('conflict-resolution');
    expect(s().doc).toBe(before);
  });

  it('round-trips through JSON, and a corrupt value drops to strict on import', () => {
    s().newDocument('goalTree');
    s().setNcDepthMode('conflict-resolution');
    const reimported = importFromJSON(exportToJSON(s().doc));
    expect(reimported.ncDepthMode).toBe('conflict-resolution');

    const corrupt = { ...JSON.parse(exportToJSON(s().doc)), ncDepthMode: 'nonsense' };
    expect(importFromJSON(JSON.stringify(corrupt)).ncDepthMode).toBeUndefined();
  });
});
