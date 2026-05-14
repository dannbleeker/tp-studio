// Session 89 — verify `triggerInstallPrompt()` handles all three
// states correctly:
//   - `accepted` — user clicked Install in the browser dialog.
//   - `dismissed` — user closed the dialog without installing.
//   - `unavailable` — `beforeinstallprompt` hasn't fired yet (e.g.
//     fresh visit or already-installed PWA).
//
// jsdom does not implement `BeforeInstallPromptEvent`, so the test
// uses `__setDeferredPromptForTest` to inject a synthetic stub
// directly into the module's captured-event slot.

import { __setDeferredPromptForTest, triggerInstallPrompt } from '@/services/pwaInstall';
import { afterEach, describe, expect, it, vi } from 'vitest';

afterEach(() => {
  __setDeferredPromptForTest(null);
});

describe('triggerInstallPrompt', () => {
  it('returns "unavailable" when no deferred prompt is captured yet', async () => {
    const result = await triggerInstallPrompt();
    expect(result).toBe('unavailable');
  });

  it('returns "accepted" + clears the prompt when the user accepts', async () => {
    const prompt = vi.fn(() => Promise.resolve());
    __setDeferredPromptForTest({
      prompt,
      userChoice: Promise.resolve({ outcome: 'accepted', platform: 'web' }),
    } as unknown as Parameters<typeof __setDeferredPromptForTest>[0]);

    const result = await triggerInstallPrompt();
    expect(result).toBe('accepted');
    expect(prompt).toHaveBeenCalledOnce();

    // Subsequent invocation should report unavailable — the event was
    // consumed and the captured reference cleared.
    const second = await triggerInstallPrompt();
    expect(second).toBe('unavailable');
  });

  it('returns "dismissed" when the user closes the dialog', async () => {
    __setDeferredPromptForTest({
      prompt: () => Promise.resolve(),
      userChoice: Promise.resolve({ outcome: 'dismissed', platform: 'web' }),
    } as unknown as Parameters<typeof __setDeferredPromptForTest>[0]);

    const result = await triggerInstallPrompt();
    expect(result).toBe('dismissed');
  });
});
