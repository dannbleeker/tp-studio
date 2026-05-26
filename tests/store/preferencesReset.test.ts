import { beforeEach, describe, expect, it } from 'vitest';
import { resetStoreForTest, useDocumentStore } from '@/store';

beforeEach(resetStoreForTest);

/**
 * Session 136 — `resetPreferencesToDefaults` action tests. Per Dann's
 * usage-feedback ask: "all settings should be able to restore to
 * defaults". The action is the single source-of-truth for "what does
 * the dialog do when the Restore Defaults button is clicked". Cover
 * three contracts:
 *
 *   1. Every persisted preference flips back to its factory value
 *      when called, regardless of what the user had changed.
 *   2. Theme is handled separately (it lives in its own localStorage
 *      key) — confirm it resets too.
 *   3. Session-only flags (`emptyStateTipDismissed`,
 *      `ecReadingInstructionsDismissed`) also clear, so the welcome
 *      affordances reappear next time their condition fires.
 */

describe('resetPreferencesToDefaults', () => {
  it('reverts every persisted preference back to factory defaults', () => {
    const s = () => useDocumentStore.getState();

    // Mutate a representative sample across each tab.
    s().setShowAnnotationNumbers(true);
    s().setShowEntityIds(true);
    s().setShowMinimap(false);
    s().setCausalityLabel('because');
    s().setDefaultLayoutDirection('LR');
    s().setShowSelectionToolbar(false);
    s().setShowArchivedGroups(true);
    s().setEdgePalette('colorblindSafe');
    s().setBrowseLocked(true);

    // Confirm the mutations took.
    expect(s().showAnnotationNumbers).toBe(true);
    expect(s().showMinimap).toBe(false);
    expect(s().causalityLabel).toBe('because');
    expect(s().browseLocked).toBe(true);

    s().resetPreferencesToDefaults();

    // Every field back to its default per `preferencesDefaults()`.
    expect(s().showAnnotationNumbers).toBe(false);
    expect(s().showEntityIds).toBe(false);
    expect(s().showMinimap).toBe(true);
    expect(s().causalityLabel).toBe('auto');
    expect(s().defaultLayoutDirection).toBe('auto');
    expect(s().showSelectionToolbar).toBe(true);
    expect(s().showArchivedGroups).toBe(false);
    expect(s().edgePalette).toBe('default');
    expect(s().browseLocked).toBe(false);
  });

  it('resets theme alongside the other prefs', () => {
    const s = () => useDocumentStore.getState();
    s().setTheme('dark');
    expect(s().theme).toBe('dark');

    s().resetPreferencesToDefaults();
    expect(s().theme).toBe('light');
  });

  it('re-shows the welcome affordances by clearing the dismissed flags', () => {
    const s = () => useDocumentStore.getState();
    s().dismissEmptyStateTip();
    s().dismissECReadingInstructions();
    expect(s().emptyStateTipDismissed).toBe(true);
    expect(s().ecReadingInstructionsDismissed).toBe(true);

    s().resetPreferencesToDefaults();
    expect(s().emptyStateTipDismissed).toBe(false);
    expect(s().ecReadingInstructionsDismissed).toBe(false);
  });

  it('persists the reset to localStorage so a reload picks up the defaults', () => {
    const s = () => useDocumentStore.getState();
    s().setCausalityLabel('therefore');
    s().resetPreferencesToDefaults();
    // The persisted prefs slot now reflects the defaults — the next
    // boot will read `causalityLabel: 'auto'` (the Session 136 default)
    // not `'therefore'`.
    const raw = localStorage.getItem('tp-studio:prefs:v1');
    expect(raw).not.toBeNull();
    if (raw) {
      const parsed = JSON.parse(raw) as { causalityLabel?: string };
      expect(parsed.causalityLabel).toBe('auto');
    }
  });
});
