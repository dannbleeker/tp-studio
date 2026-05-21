import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { resetStoreForTest, useDocumentStore } from '@/store';

/**
 * Session 135 / spec major gap #9 — app-mode state.
 *
 * Phase 1 lands the state field + setAppMode action + persistence.
 * Per-mode chrome wiring follows in subsequent phases; these tests
 * cover the foundation.
 */

const s = () => useDocumentStore.getState();

beforeEach(() => {
  // Clear any persisted prefs so the default-Expert assertion isn't
  // contaminated by a prior test's localStorage write.
  try {
    window.localStorage.clear();
  } catch {
    // jsdom localStorage is always available, but defensive.
  }
  resetStoreForTest();
});
afterEach(resetStoreForTest);

describe('appMode — state + actions', () => {
  it("defaults to 'expert'", () => {
    expect(s().appMode).toBe('expert');
  });

  it('setAppMode switches the mode', () => {
    s().setAppMode('guided');
    expect(s().appMode).toBe('guided');
    s().setAppMode('workshop');
    expect(s().appMode).toBe('workshop');
    s().setAppMode('presentation');
    expect(s().appMode).toBe('presentation');
    s().setAppMode('expert');
    expect(s().appMode).toBe('expert');
  });
});

describe('appMode — Browse Lock auto-engage on Presentation', () => {
  it('entering Presentation engages Browse Lock when it was off', () => {
    expect(s().browseLocked).toBe(false);
    s().setAppMode('presentation');
    expect(s().browseLocked).toBe(true);
  });

  it('leaving Presentation does NOT auto-unlock', () => {
    s().setAppMode('presentation');
    expect(s().browseLocked).toBe(true);
    s().setAppMode('expert');
    // Lock stays — user explicitly toggles off if they want.
    expect(s().browseLocked).toBe(true);
  });

  it('entering Presentation when Browse Lock already engaged leaves it untouched', () => {
    s().setBrowseLocked(true);
    s().setAppMode('presentation');
    expect(s().browseLocked).toBe(true);
    // No surprise toggle off.
  });

  it('entering Guided / Workshop / Expert does NOT touch Browse Lock', () => {
    expect(s().browseLocked).toBe(false);
    s().setAppMode('guided');
    expect(s().browseLocked).toBe(false);
    s().setAppMode('workshop');
    expect(s().browseLocked).toBe(false);
    s().setAppMode('expert');
    expect(s().browseLocked).toBe(false);
  });
});

describe('appMode — Guided mode wizard force-show', () => {
  it('opens the Goal Tree wizard on newDocument in Guided mode even when the suppress flag is off', () => {
    // Suppress flag explicitly off — without Guided, the wizard would stay closed.
    s().setShowGoalTreeWizard(false);
    s().setAppMode('guided');
    s().newDocument('goalTree');
    expect(s().creationWizard?.kind).toBe('goalTree');
  });

  it('opens the EC wizard on newDocument in Guided mode even when the suppress flag is off', () => {
    s().setShowECWizard(false);
    s().setAppMode('guided');
    s().newDocument('ec');
    expect(s().creationWizard?.kind).toBe('ec');
  });

  it('Expert mode honours the dismissed suppress flag (no force-show)', () => {
    s().setShowGoalTreeWizard(false);
    s().setAppMode('expert');
    s().newDocument('goalTree');
    expect(s().creationWizard).toBe(null);
  });
});

describe('appMode — palette commands', () => {
  it('exposes one switch command per mode', async () => {
    // Lazy-load to avoid pulling the palette through the store cold-
    // start. The command registry is the same module the palette
    // mounts at runtime.
    const { COMMANDS } = await import('@/components/command-palette/commands');
    const modeCommands = COMMANDS.filter((c) => c.id.startsWith('switch-app-mode-'));
    expect(modeCommands).toHaveLength(4);
    const ids = modeCommands.map((c) => c.id).sort();
    expect(ids).toEqual([
      'switch-app-mode-expert',
      'switch-app-mode-guided',
      'switch-app-mode-presentation',
      'switch-app-mode-workshop',
    ]);
  });

  it('running a mode command switches the store state', async () => {
    const { COMMANDS } = await import('@/components/command-palette/commands');
    const guidedCmd = COMMANDS.find((c) => c.id === 'switch-app-mode-guided');
    expect(guidedCmd).toBeDefined();
    if (!guidedCmd) return;
    expect(s().appMode).toBe('expert');
    await guidedCmd.run(useDocumentStore.getState());
    expect(s().appMode).toBe('guided');
  });

  it('running a mode command for the active mode emits an info toast and no-ops', async () => {
    const { COMMANDS } = await import('@/components/command-palette/commands');
    const expertCmd = COMMANDS.find((c) => c.id === 'switch-app-mode-expert');
    expect(expertCmd).toBeDefined();
    if (!expertCmd) return;
    // Already in expert by default; the command should toast + no-op.
    const beforeToasts = s().toasts.length;
    await expertCmd.run(useDocumentStore.getState());
    expect(s().appMode).toBe('expert');
    expect(s().toasts.length).toBe(beforeToasts + 1);
    expect(s().toasts[beforeToasts]?.kind).toBe('info');
  });
});
