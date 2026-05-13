import { resetStoreForTest, useDocumentStore } from '@/store';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

beforeEach(resetStoreForTest);
afterEach(resetStoreForTest);

describe('FL-TO3 — defaultLayoutDirection preference', () => {
  it('defaults to "auto" on a fresh store', () => {
    expect(useDocumentStore.getState().defaultLayoutDirection).toBe('auto');
  });

  it('setDefaultLayoutDirection writes through', () => {
    useDocumentStore.getState().setDefaultLayoutDirection('LR');
    expect(useDocumentStore.getState().defaultLayoutDirection).toBe('LR');
  });

  it('newDocument seeds doc.layoutConfig.direction when pref is non-auto', () => {
    const s = useDocumentStore.getState();
    s.setDefaultLayoutDirection('TB');
    s.newDocument('crt');
    expect(useDocumentStore.getState().doc.layoutConfig?.direction).toBe('TB');
  });

  it('newDocument leaves layoutConfig unset when pref is "auto"', () => {
    const s = useDocumentStore.getState();
    s.setDefaultLayoutDirection('auto');
    s.newDocument('crt');
    expect(useDocumentStore.getState().doc.layoutConfig?.direction).toBeUndefined();
  });

  it('the seeded direction applies regardless of diagram type', () => {
    const s = useDocumentStore.getState();
    s.setDefaultLayoutDirection('LR');
    s.newDocument('prt');
    expect(useDocumentStore.getState().doc.layoutConfig?.direction).toBe('LR');
  });
});
