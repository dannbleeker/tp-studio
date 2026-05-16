import { expect, test } from '@playwright/test';

/**
 * Session 101 — Visual regression for the top-three user-visible
 * dialogs (Settings, Help, Template Picker). Sister spec to
 * `visual-canvas.spec.ts` which covers the React Flow canvas itself.
 *
 * Why these three (and not the other ~7 dialogs):
 *   - **SettingsDialog** — biggest surface, exercises the tabs +
 *     FormPrimitives + theme swatches. The most likely place a CSS
 *     regression in a shared primitive bites.
 *   - **HelpDialog** — keyboard-shortcut + gesture reference; mostly
 *     static text, low expected churn, high signal when something
 *     changes (typography / token regression).
 *   - **TemplatePickerDialog** — grid of inline-SVG thumbnails. Catches
 *     SVG layout regressions that `templateThumbnailSvg`'s unit tests
 *     miss (those check structure, not rendered geometry).
 *
 * The remaining dialogs (Print Preview, Export Picker, Diagram Type,
 * Confirm, Quick Capture, Revisions, Side-by-Side) are tracked as a
 * follow-up in NEXT_STEPS — add them one at a time as their content
 * stabilises.
 *
 * ┌─────────────────────────────────────────────────────────────────┐
 * │ ONE-TIME BOOTSTRAP — REMOVE `test.fixme()` AFTER FIRST RUN.     │
 * ├─────────────────────────────────────────────────────────────────┤
 * │ This spec is marked `fixme` until its baseline PNGs exist on    │
 * │ `main`. To bootstrap:                                           │
 * │                                                                 │
 * │  1. Trigger the `Update visual snapshots` GitHub Actions        │
 * │     workflow (manual `workflow_dispatch`).                      │
 * │  2. The workflow runs `playwright test --update-snapshots`,     │
 * │     generates `*-chromium-linux.png` baselines, opens a PR.     │
 * │  3. Review the PR (visual diff vs. the dialog snapshots).       │
 * │  4. Merge it. The baseline PNGs land in                         │
 * │     `e2e/visual-dialogs.spec.ts-snapshots/`.                    │
 * │  5. Remove the `test.fixme()` markers below and push.           │
 * │                                                                 │
 * │ CI will then enforce the baselines on every subsequent push.    │
 * │ The same workflow refreshes baselines after an intentional      │
 * │ visual change.                                                  │
 * └─────────────────────────────────────────────────────────────────┘
 */

test.describe('dialog visual regression', () => {
  test.beforeEach(async ({ page }) => {
    // Clean state — match the convention from `smoke.spec.ts` and
    // `visual-canvas.spec.ts` so a stale doc / dialog open flag from
    // a previous test doesn't leak in.
    await page.goto('/?test=1');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
  });

  test('settings dialog', async ({ page }) => {
    test.fixme(true, 'Baselines pending first run of update-visual-snapshots workflow.');
    await page.goto('/?test=1');
    // Cmd+, → openSettings (`useGlobalShortcuts.ts:88`). Ctrl works on
    // the Linux runner; the binding accepts either modifier.
    await page.keyboard.press('Control+Comma');
    // Native <dialog> renders into the top layer; wait for the
    // tablist (the first piece of content past the title) to settle.
    await page.waitForSelector('[role="tablist"]');
    await expect(page).toHaveScreenshot('dialog-settings.png', {
      maxDiffPixelRatio: 0.02,
      mask: [page.locator('[data-component="toaster"]')],
    });
  });

  test('help dialog', async ({ page }) => {
    test.fixme(true, 'Baselines pending first run of update-visual-snapshots workflow.');
    await page.goto('/?test=1');
    // No direct keyboard shortcut for Help — open via the palette.
    // (`useGlobalShortcuts.ts` exposes Cmd+K → openPalette; typing
    // "Keyboard" then Enter lands on the Help dialog command.)
    await page.keyboard.press('Control+K');
    await page.getByPlaceholder(/command/i).fill('Keyboard');
    await page.keyboard.press('Enter');
    // The dialog header carries the title — wait for it before
    // screenshotting so we capture a fully-painted modal.
    await page.waitForSelector('h2:has-text("Keyboard shortcuts")');
    await expect(page).toHaveScreenshot('dialog-help.png', {
      maxDiffPixelRatio: 0.02,
      mask: [page.locator('[data-component="toaster"]')],
    });
  });

  test('template picker dialog', async ({ page }) => {
    test.fixme(true, 'Baselines pending first run of update-visual-snapshots workflow.');
    await page.goto('/?test=1');
    // Cmd+K → "New from template" routes through `templatePickerOpen`.
    await page.keyboard.press('Control+K');
    await page.getByPlaceholder(/command/i).fill('New from template');
    await page.keyboard.press('Enter');
    // The picker renders 10 cards in a grid — wait for the first
    // template card to land before snapshotting so the SVG
    // thumbnails are committed.
    await page.waitForSelector('[data-component="template-card"]');
    // The grid contains framework-free SVG thumbnails; a small wait
    // lets any animated transitions on the modal settle.
    await page.waitForTimeout(150);
    await expect(page).toHaveScreenshot('dialog-template-picker.png', {
      maxDiffPixelRatio: 0.02,
      mask: [page.locator('[data-component="toaster"]')],
    });
  });
});
