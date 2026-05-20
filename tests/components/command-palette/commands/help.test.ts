import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { helpCommands } from '@/components/command-palette/commands/help';
import { resetStoreForTest, useDocumentStore } from '@/store';
import { findCommand, runCommand } from './helpers';

beforeEach(resetStoreForTest);
afterEach(() => {
  resetStoreForTest();
  vi.restoreAllMocks();
});

const s = () => useDocumentStore.getState();

describe('helpCommands', () => {
  it('help opens the help dialog', async () => {
    await runCommand(findCommand(helpCommands, 'help'));
    expect(s().helpOpen).toBe(true);
  });

  it('about opens the about dialog', async () => {
    await runCommand(findCommand(helpCommands, 'about'));
    expect(s().aboutOpen).toBe(true);
  });

  it('install-app toasts the "not available yet" message when no install prompt is queued', async () => {
    // No `beforeinstallprompt` event fires in jsdom, so triggerInstallPrompt()
    // resolves to 'unavailable' on its first call.
    await runCommand(findCommand(helpCommands, 'install-app'));
    expect(s().toasts.some((t) => /install prompt not available/i.test(t.message))).toBe(true);
  });
});
