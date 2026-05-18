// Session 89 — wrap the browser's `beforeinstallprompt` event so the
// command palette can offer an explicit "Install TP Studio…" action.
//
// Why we capture the event ourselves rather than letting the browser
// surface its own UI:
//   - Chrome / Edge only show their default install affordance once
//     the user has cleared an opaque "engagement" heuristic
//     (multiple visits + minimum dwell time + manifest validity).
//     The palette command works for power users who know what they
//     want immediately, while the browser-driven UI still fires
//     normally for everyone else.
//   - The captured event has a one-shot `prompt()` method. Calling
//     it consumes the event; we then nullify our stored reference so
//     subsequent palette invocations get the "not available" toast
//     instead of throwing.
//
// `BeforeInstallPromptEvent` isn't in the TS DOM lib (it's a Chrome
// extension to the spec); we declare the shape inline rather than
// pulling in `@types/web-app-manifest` for a single interface.

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
};

let deferredPrompt: BeforeInstallPromptEvent | null = null;

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    // Prevent Chrome's automatic mini-infobar; we surface the action
    // ourselves via the palette.
    e.preventDefault();
    deferredPrompt = e as BeforeInstallPromptEvent;
  });
  // After install completes, the prompt is no longer relevant — drop
  // the stored reference so the palette command reports correctly.
  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
  });
}

export type InstallPromptResult = 'accepted' | 'dismissed' | 'unavailable';

export const triggerInstallPrompt = async (): Promise<InstallPromptResult> => {
  if (!deferredPrompt) return 'unavailable';
  await deferredPrompt.prompt();
  const choice = await deferredPrompt.userChoice;
  deferredPrompt = null;
  return choice.outcome;
};

// Test hook — vitest needs to clear / set the captured event without
// dispatching a real `BeforeInstallPromptEvent` (which jsdom doesn't
// implement). Production callers should never reach for this.
export const __setDeferredPromptForTest = (event: BeforeInstallPromptEvent | null): void => {
  deferredPrompt = event;
};
