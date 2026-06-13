import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { helpCommands } from '@/components/command-palette/commands/help';
import { triggerInstallPrompt } from '@/services/pwa/pwaInstall';
import { checkForUpdate } from '@/services/pwa/pwaUpdate';
import { resetStoreForTest, useDocumentStore } from '@/store';
import { findCommand, runCommand } from './helpers';

// A separate file from help.test.ts so that file keeps exercising the REAL
// PWA services (the 'unavailable' path); here we mock them to drive the
// install-result and update-result branches the command toasts on.
vi.mock('@/services/pwa/pwaInstall', () => ({ triggerInstallPrompt: vi.fn() }));
vi.mock('@/services/pwa/pwaUpdate', () => ({ checkForUpdate: vi.fn() }));

const install = vi.mocked(triggerInstallPrompt);
const update = vi.mocked(checkForUpdate);
const s = () => useDocumentStore.getState();
const toastMatches = (re: RegExp) => s().toasts.some((t) => re.test(t.message));

beforeEach(resetStoreForTest);
afterEach(() => {
  resetStoreForTest();
  vi.clearAllMocks();
});

describe('helpCommands — install / update result branches', () => {
  it('toasts success when the install prompt is accepted', async () => {
    install.mockResolvedValue('accepted');
    await runCommand(findCommand(helpCommands, 'install-app'));
    expect(toastMatches(/installed/i)).toBe(true);
  });

  it('toasts cancelled when the install prompt is dismissed', async () => {
    install.mockResolvedValue('dismissed');
    await runCommand(findCommand(helpCommands, 'install-app'));
    expect(toastMatches(/cancelled/i)).toBe(true);
  });

  it('toasts up-to-date when there is no newer version', async () => {
    update.mockResolvedValue('up-to-date');
    await runCommand(findCommand(helpCommands, 'check-for-update'));
    expect(toastMatches(/latest version/i)).toBe(true);
  });

  it('toasts when a new version is found', async () => {
    update.mockResolvedValue('newly-found');
    await runCommand(findCommand(helpCommands, 'check-for-update'));
    expect(toastMatches(/new version found/i)).toBe(true);
  });

  it('toasts when update checks are unsupported', async () => {
    update.mockResolvedValue('unsupported');
    await runCommand(findCommand(helpCommands, 'check-for-update'));
    expect(toastMatches(/aren't available/i)).toBe(true);
  });

  it('stays silent when an update check is already pending', async () => {
    update.mockResolvedValue('already-pending');
    await runCommand(findCommand(helpCommands, 'check-for-update'));
    expect(s().toasts).toHaveLength(0);
  });
});
