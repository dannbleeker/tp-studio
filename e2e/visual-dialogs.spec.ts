import { expect, test } from '@playwright/test';

/**
 * Visual regression for the user-visible dialogs. Sister spec to
 * `visual-canvas.spec.ts` which covers the React Flow canvas itself.
 *
 * Session 101 seeded the first three (Settings / Help / Template
 * Picker — the highest-leverage surfaces): SettingsDialog exercises
 * the tabs + FormPrimitives + theme swatches; HelpDialog covers the
 * keyboard-shortcut + gesture reference; TemplatePickerDialog
 * catches SVG layout regressions in `templateThumbnailSvg`. Session
 * 102 added the remaining seven (Print Preview, Export Picker,
 * Diagram Type, Confirm, Quick Capture, Revisions, Side-by-Side) so
 * every modal in the app has continuous pixel-comparison coverage.
 *
 * Baselines are committed under `e2e/visual-dialogs.spec.ts-snapshots/`.
 * When an intentional visual change lands, trigger the `Update visual
 * snapshots` workflow to refresh — it commits the regenerated PNGs
 * back via a PR; review the diff and merge.
 *
 * The Session 102 additions carry a `test.skip(SKIP_PENDING_BASELINES,
 * ...)` guard until their baseline PNGs land on `main`. The pattern
 * mirrors Session 101's bootstrap: skip in regular CI so we don't fail
 * on missing baselines, opt-in via `REFRESH_VISUAL_SNAPSHOTS=1` in
 * the refresh workflow so it generates the initial set. Once the
 * baselines PR merges, the guard comes out.
 */

// Session 102 — bootstrap guard for the new (Print/Export/Diagram/
// Confirm/Quick-Capture/Revisions/SideBySide) tests. The original
// three Session-101 tests have baselines already and aren't gated.
const SKIP_PENDING_BASELINES = !process.env.REFRESH_VISUAL_SNAPSHOTS;

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

  // ─────────────────────────────────────────────────────────────────
  // Session 102 additions — remaining seven dialogs. Each carries a
  // skip guard until baselines exist on main; remove after the
  // baseline-refresh PR lands. The pattern follows Session 101's
  // bootstrap mechanics exactly.
  // ─────────────────────────────────────────────────────────────────

  test('export picker dialog', async ({ page }) => {
    test.skip(SKIP_PENDING_BASELINES, 'Pending baseline bootstrap');
    await page.goto('/?test=1');
    // Palette → "Export…" — opens the unified picker. The catalogue
    // route is `open-export-picker`; the visible label is "Export…".
    await page.keyboard.press('Control+K');
    await page.getByPlaceholder(/command/i).fill('Export');
    await page.keyboard.press('Enter');
    // First category heading is stable across format additions and
    // is rendered inside the LargeDialog body.
    await page.waitForSelector('h3:has-text("Images")');
    await expect(page).toHaveScreenshot('dialog-export-picker.png', {
      maxDiffPixelRatio: 0.02,
      mask: [page.locator('[data-component="toaster"]')],
    });
  });

  test('print preview dialog', async ({ page }) => {
    test.skip(SKIP_PENDING_BASELINES, 'Pending baseline bootstrap');
    await page.goto('/?test=1');
    // Two-step open: the Print/Save-as-PDF route goes through the
    // Export Picker (Session 90 unified the entry points). Cmd+P
    // is the browser print dialog, not ours.
    await page.keyboard.press('Control+K');
    await page.getByPlaceholder(/command/i).fill('Export');
    await page.keyboard.press('Enter');
    await page.getByRole('button', { name: /print/i }).click();
    await page.waitForSelector('h2:has-text("Print / Save as PDF")');
    await expect(page).toHaveScreenshot('dialog-print-preview.png', {
      maxDiffPixelRatio: 0.02,
      mask: [page.locator('[data-component="toaster"]')],
    });
  });

  test('diagram type picker dialog', async ({ page }) => {
    test.skip(SKIP_PENDING_BASELINES, 'Pending baseline bootstrap');
    await page.goto('/?test=1');
    // Palette → "New diagram…" → openDiagramPicker('new'). The
    // dialog body is a card grid; the title is stable per Session 90.
    await page.keyboard.press('Control+K');
    await page.getByPlaceholder(/command/i).fill('New diagram');
    await page.keyboard.press('Enter');
    await page.waitForSelector('h2:has-text("New diagram")');
    await expect(page).toHaveScreenshot('dialog-diagram-type-picker.png', {
      maxDiffPixelRatio: 0.02,
      mask: [page.locator('[data-component="toaster"]')],
    });
  });

  test('quick capture dialog', async ({ page }) => {
    test.skip(SKIP_PENDING_BASELINES, 'Pending baseline bootstrap');
    await page.goto('/?test=1');
    // Bare `E` key (no modifiers, not in a text field) opens Quick
    // Capture — `useGlobalShortcuts.ts` listens for it. The dialog
    // mounts immediately; no async route.
    await page.keyboard.press('e');
    await page.waitForSelector('h2#qc-title');
    await expect(page).toHaveScreenshot('dialog-quick-capture.png', {
      maxDiffPixelRatio: 0.02,
      mask: [page.locator('[data-component="toaster"]')],
    });
  });

  test('revision panel', async ({ page }) => {
    test.skip(SKIP_PENDING_BASELINES, 'Pending baseline bootstrap');
    await page.goto('/?test=1');
    // The RevisionPanel is an `<aside>`, not a centered dialog, but
    // it's the History surface and counts toward modal coverage.
    // Open via the TopBar history button — `aria-label` is stable.
    // (No global keyboard shortcut today.)
    await page
      .getByRole('button', { name: /history/i })
      .first()
      .click();
    await page.waitForSelector('aside[data-component="revision-panel"]');
    // Settle the slide-in transform (200ms duration in tokens) so
    // the screenshot captures the resting state, not mid-animation.
    await page.waitForTimeout(250);
    await expect(page).toHaveScreenshot('panel-revision.png', {
      maxDiffPixelRatio: 0.02,
      mask: [page.locator('[data-component="toaster"]')],
    });
  });

  test('confirm dialog', async ({ page }) => {
    test.skip(SKIP_PENDING_BASELINES, 'Pending baseline bootstrap');
    await page.goto('/?test=1');
    // Seed two entities + a connecting edge so the delete action
    // has a real warning ("This entity has 1 connected edge…"),
    // then fire `confirmAndDeleteEntity` to open the dialog. The
    // test hook's `confirmAndDeleteEntity` matches the production
    // keyboard-Delete path.
    const ids = await page.evaluate(() => {
      const hook = window.__TP_TEST__;
      if (!hook) throw new Error('test hook not installed');
      const seeded = hook.seed({ titles: ['Cause', 'Effect'] });
      hook.connect(seeded[0]!, seeded[1]!);
      return seeded;
    });
    // Don't await the promise — it resolves when the user clicks
    // Confirm/Cancel. We want to screenshot the open dialog instead.
    await page.evaluate((id) => {
      window.__TP_TEST__?.confirmAndDeleteEntity(id);
    }, ids[0]);
    // The ConfirmDialog uses Modal → native <dialog aria-modal>.
    // Wait for the primary action button which carries a stable
    // data attribute.
    await page.waitForSelector('button[data-confirm-primary="true"]');
    await expect(page).toHaveScreenshot('dialog-confirm.png', {
      maxDiffPixelRatio: 0.02,
      mask: [page.locator('[data-component="toaster"]')],
    });
  });

  test('side-by-side compare dialog', async ({ page }) => {
    test.skip(SKIP_PENDING_BASELINES, 'Pending baseline bootstrap');
    await page.goto('/?test=1');
    // Seed entities → capture a manual revision → mutate the doc
    // → open SideBySide against the captured revision. The
    // visible diff (snapshot has 2 entities, live has 3) exercises
    // the dialog's added/removed rendering paths.
    await page.evaluate(() => {
      const hook = window.__TP_TEST__;
      if (!hook) throw new Error('test hook not installed');
      const ids = hook.seed({ titles: ['A', 'B'] });
      hook.connect(ids[0]!, ids[1]!);
      const revId = hook.takeRevision('snapshot for compare');
      // Mutate after the snapshot so there's a real diff to render.
      hook.seed({ titles: ['A', 'B', 'C'], clear: false });
      hook.openSideBySide(revId);
    });
    await page.waitForSelector('dialog[aria-label="Side-by-side compare"]');
    // Settle the dialog's internal layout (it absolutely-positions
    // entity cards by parsed coords).
    await page.waitForTimeout(250);
    await expect(page).toHaveScreenshot('dialog-side-by-side.png', {
      maxDiffPixelRatio: 0.02,
      mask: [page.locator('[data-component="toaster"]')],
    });
  });
});
