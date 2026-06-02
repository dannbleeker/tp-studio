import { beforeEach, describe, expect, it } from 'vitest';
import { resetStoreForTest, useDocumentStore } from '@/store';

beforeEach(resetStoreForTest);

/**
 * Phase 1 (TP completeness #1 — Cloud progression) — `setCloudType` store
 * action. Mirrors the `setECVerbalStyle` shape: persists a chosen value, and
 * treats `undefined` as the implicit "untyped" clear (drops the field) so an
 * untyped doc round-trips unchanged.
 */
describe('setCloudType', () => {
  const s = () => useDocumentStore.getState();

  it('defaults to undefined on a fresh EC doc', () => {
    s().newDocument('ec');
    expect(s().doc.cloudType).toBeUndefined();
  });

  it('persists a chosen cloud type on the doc', () => {
    s().newDocument('ec');
    s().setCloudType('core');
    expect(s().doc.cloudType).toBe('core');
  });

  it('clears the field when set to undefined (untyped)', () => {
    s().newDocument('ec');
    s().setCloudType('firefighting');
    expect(s().doc.cloudType).toBe('firefighting');
    s().setCloudType(undefined);
    expect(s().doc.cloudType).toBeUndefined();
  });

  it('is a no-op when the type is already the requested value', () => {
    s().newDocument('ec');
    s().setCloudType('ude');
    const before = s().doc;
    s().setCloudType('ude');
    // Reference equality: a no-op leaves the same doc object in place.
    expect(s().doc).toBe(before);
  });

  it('is a no-op when clearing an already-untyped doc', () => {
    s().newDocument('ec');
    const before = s().doc;
    s().setCloudType(undefined);
    expect(s().doc).toBe(before);
  });
});
