import { triggerInstallPrompt } from '@/services/pwaInstall';
import type { Command } from './types';

export const helpCommands: Command[] = [
  {
    id: 'help',
    label: 'Show keyboard shortcuts',
    group: 'Help',
    run: (s) => s.openHelp(),
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
];
