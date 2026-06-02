import { triggerInstallPrompt } from '@/services/pwa/pwaInstall';
import { checkForUpdate } from '@/services/pwa/pwaUpdate';
import type { Command } from './types';

export const helpCommands: Command[] = [
  {
    id: 'help',
    label: 'Help & keyboard shortcuts',
    group: 'Help',
    run: (s) => s.openHelp(),
  },
  {
    id: 'about',
    label: 'About TP Studio…',
    group: 'Help',
    run: (s) => s.openAbout(),
  },
  // Session 89 — surface Chrome / Edge's PWA install affordance from
  // the palette. The browser only fires `beforeinstallprompt` once it
  // considers the user "engaged" (multiple visits + dwell time + PWA
  // manifest valid). When the deferred event isn't available yet, we
  // toast a helpful message so the command isn't silently broken.
  {
    id: 'install-app',
    label: 'Install TP Studio…',
    group: 'Help',
    run: async (s) => {
      const result = await triggerInstallPrompt();
      if (result === 'accepted') s.showToast('success', 'TP Studio installed.');
      else if (result === 'dismissed') s.showToast('info', 'Install cancelled.');
      else s.showToast('info', 'Install prompt not available yet — visit a few times first.');
    },
  },
  // Session 135 — manual update check. Normally the SW polls on its own
  // cadence; this gives users a way to force the check + get an explicit
  // up-to-date confirmation. The `already-pending` branch leaves the
  // toast to `checkForUpdate` (it re-surfaces the canonical "Refresh
  // now" prompt) so we don't double-toast.
  {
    id: 'check-for-update',
    label: 'Check for updates',
    group: 'Help',
    run: async (s) => {
      const result = await checkForUpdate();
      if (result === 'up-to-date') {
        s.showToast('success', "You're on the latest version of TP Studio.");
      } else if (result === 'newly-found') {
        s.showToast(
          'info',
          'New version found — the refresh prompt will appear once it finishes downloading.'
        );
      } else if (result === 'unsupported') {
        s.showToast(
          'info',
          "Update checks aren't available here (the service worker isn't running)."
        );
      }
      // 'already-pending' — `checkForUpdate` already surfaced the
      // "Refresh now" toast, so nothing to add.
    },
  },
];
