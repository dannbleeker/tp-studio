import { isScopeEmpty, maybeNudgeSystemScope } from '@/services/systemScopeNudge';
import { resetStoreForTest, useDocumentStore } from '@/store';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

/**
 * Session 83 — coverage for the soft CRT System Scope nudge.
 *
 * The pure predicate (`isScopeEmpty`) and the side-effecting trigger
 * (`maybeNudgeSystemScope`) both have meaningful failure modes that
 * a future refactor could break. The store-subscribing watcher
 * (`installSystemScopeNudgeWatcher`) is install-time glue; we cover
 * the per-doc-id swap behaviour by driving `maybeNudgeSystemScope`
 * directly with different docs.
 */

describe('isScopeEmpty', () => {
  it('returns true for undefined scope', () => {
    expect(isScopeEmpty(undefined)).toBe(true);
  });

  it('returns true for an empty object', () => {
    expect(isScopeEmpty({})).toBe(true);
  });

  it('returns true when every field is whitespace-only', () => {
    expect(
      isScopeEmpty({
        goal: '   ',
        boundaries: '\n\t',
        successMeasures: '',
      })
    ).toBe(true);
  });

  it('returns false when any field carries content', () => {
    expect(isScopeEmpty({ goal: 'Ship a great product' })).toBe(false);
  });

  it('returns false when content is non-whitespace even if other fields are blank', () => {
    expect(
      isScopeEmpty({
        goal: '   ',
        boundaries: 'org-wide',
      })
    ).toBe(false);
  });
});

describe('maybeNudgeSystemScope', () => {
  beforeEach(() => {
    resetStoreForTest();
  });
  afterEach(() => {
    resetStoreForTest();
  });

  it('shows a toast on a fresh CRT with empty scope', () => {
    const doc = useDocumentStore.getState().doc;
    expect(doc.diagramType).toBe('crt');
    expect(doc.systemScope).toBeUndefined();

    maybeNudgeSystemScope(useDocumentStore.getState().doc);

    const toasts = useDocumentStore.getState().toasts;
    expect(toasts).toHaveLength(1);
    expect(toasts[0]!.kind).toBe('info');
    expect(toasts[0]!.message.toLowerCase()).toContain('system scope');
  });

  it('flips systemScopeNudgeShown after firing', () => {
    maybeNudgeSystemScope(useDocumentStore.getState().doc);
    expect(useDocumentStore.getState().doc.systemScopeNudgeShown).toBe(true);
  });

  it('does not re-fire when systemScopeNudgeShown is already true', () => {
    // First call — fires + flips the flag.
    maybeNudgeSystemScope(useDocumentStore.getState().doc);
    expect(useDocumentStore.getState().toasts).toHaveLength(1);
    // Drain toasts so the second call would surface a new one if it fired.
    const dismissToast = useDocumentStore.getState().dismissToast;
    for (const t of [...useDocumentStore.getState().toasts]) dismissToast(t.id);
    expect(useDocumentStore.getState().toasts).toHaveLength(0);

    // Second call on the same doc — should be a no-op.
    maybeNudgeSystemScope(useDocumentStore.getState().doc);
    expect(useDocumentStore.getState().toasts).toHaveLength(0);
  });

  it('does not fire on a non-CRT diagram', () => {
    useDocumentStore.getState().newDocument('frt');
    maybeNudgeSystemScope(useDocumentStore.getState().doc);
    expect(useDocumentStore.getState().toasts).toHaveLength(0);
  });

  it('does not fire when the scope already has any content', () => {
    useDocumentStore.getState().setSystemScope({ goal: 'Ship' });
    maybeNudgeSystemScope(useDocumentStore.getState().doc);
    expect(useDocumentStore.getState().toasts).toHaveLength(0);
  });
});
