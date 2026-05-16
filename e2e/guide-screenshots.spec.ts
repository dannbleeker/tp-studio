import { mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { test } from '@playwright/test';

/**
 * Session 103 — Screenshots for the *Thinking with TP Studio*
 * book (`docs/guide/`).
 *
 * This spec is companion to `visual-canvas.spec.ts` and
 * `visual-dialogs.spec.ts` but its purpose is different:
 *
 *   - **Visual specs** PIN the UI — pixel diffs fail CI.
 *   - **This spec** ILLUSTRATES the book — each test drives the
 *     app through a documented gesture sequence and saves a PNG
 *     directly to `docs/guide/screenshots/`. No diff comparison;
 *     the spec acts as a **smoke test for the gestures the book
 *     describes** (a selector breaking here means the chapter's
 *     instructions are stale and need a manuscript update).
 *
 * Why `page.screenshot({ path })` rather than `toHaveScreenshot`:
 *   - Clean filenames (`chapter02-empty-canvas.png`, no
 *     `-chromium-linux` suffix). Manuscript embeds resolve as
 *     `![…](screenshots/chapter02-empty-canvas.png)`.
 *   - Directory of choice (`docs/guide/screenshots/` lives next
 *     to the manuscript).
 *   - The Playwright `--update-snapshots` flag is irrelevant here;
 *     each run writes the PNG unconditionally.
 *
 * One test per book screenshot. Names map 1:1 to file names
 * referenced in the manuscript (see `docs/guide/AUTHORING.md`).
 * `_screenshot()` is a tiny helper so the per-test code stays
 * focused on the gesture sequence rather than the file plumbing.
 */

const SCREENSHOT_DIR = 'docs/guide/screenshots';

const _screenshot = async (
  page: import('@playwright/test').Page,
  name: string,
  options: { mask?: ReturnType<import('@playwright/test').Page['locator']>[] } = {}
) => {
  const path = join(SCREENSHOT_DIR, `${name}.png`);
  await mkdir(dirname(path), { recursive: true });
  await page.screenshot({
    path,
    mask: options.mask,
    fullPage: false,
  });
};

const TOASTER_MASK = (page: import('@playwright/test').Page) => [
  page.locator('[data-component="toaster"]'),
];

test.describe('book — Part 1 — Foundations', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/?test=1');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
  });

  test('chapter02-empty-canvas', async ({ page }) => {
    await page.goto('/?test=1');
    await page.waitForSelector('.react-flow__viewport');
    await _screenshot(page, 'chapter02-empty-canvas', { mask: TOASTER_MASK(page) });
  });

  test('chapter02-first-entity', async ({ page }) => {
    await page.goto('/?test=1');
    await page.evaluate(() => {
      window.__TP_TEST__?.seed({ titles: ['Customers churn'] });
    });
    await page.waitForSelector('[data-component="tp-node"]');
    await page.waitForTimeout(200);
    await _screenshot(page, 'chapter02-first-entity', { mask: TOASTER_MASK(page) });
  });

  test('chapter02-connected-pair', async ({ page }) => {
    await page.goto('/?test=1');
    await page.evaluate(() => {
      const hook = window.__TP_TEST__;
      if (!hook) throw new Error('test hook not installed');
      const [a, b] = hook.seed({ titles: ['Resolution time > 8h', 'Customers churn'] });
      hook.connect(a!, b!);
    });
    await page.waitForSelector('[data-component="tp-node"]');
    await page.waitForTimeout(300);
    await _screenshot(page, 'chapter02-connected-pair', { mask: TOASTER_MASK(page) });
  });

  test('chapter03-causality-because', async ({ page }) => {
    await page.goto('/?test=1');
    await page.evaluate(() => {
      const hook = window.__TP_TEST__;
      if (!hook) throw new Error('test hook not installed');
      const [a, b] = hook.seed({ titles: ['Triage rubric missing', 'Resolution time > 8h'] });
      hook.connect(a!, b!);
    });
    await page.waitForSelector('[data-component="tp-node"]');
    await page.waitForTimeout(300);
    await _screenshot(page, 'chapter03-causality-because', { mask: TOASTER_MASK(page) });
  });
});

test.describe('book — Part 2 — Thinking Processes', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/?test=1');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
  });

  // Chapter 4 — Current Reality Tree. Worked example: support-team
  // firefighting. The book walks the chapter through a series of
  // intermediate canvas states; each test below captures one.

  test('chapter04-crt-step1-first-ude', async ({ page }) => {
    await page.goto('/?test=1');
    await page.evaluate(() => {
      window.__TP_TEST__?.seed({ type: 'ude', titles: ['Customers churn at renewal'] });
    });
    await page.waitForSelector('[data-component="tp-node"]');
    await page.waitForTimeout(200);
    await _screenshot(page, 'chapter04-crt-step1-first-ude', { mask: TOASTER_MASK(page) });
  });

  test('chapter04-crt-step2-three-udes', async ({ page }) => {
    await page.goto('/?test=1');
    await page.evaluate(() => {
      window.__TP_TEST__?.seed({
        type: 'ude',
        titles: [
          'Customers churn at renewal',
          'NPS keeps dropping',
          'Support cost per ticket up 40%',
        ],
      });
    });
    await page.waitForSelector('[data-component="tp-node"]');
    await page.waitForTimeout(300);
    await _screenshot(page, 'chapter04-crt-step2-three-udes', { mask: TOASTER_MASK(page) });
  });

  // Chapter 5 — Evaporating Cloud. The creation wizard walkthrough.

  test('chapter05-ec-wizard-step1', async ({ page }) => {
    await page.goto('/?test=1');
    await page.keyboard.press('Control+K');
    await page.getByPlaceholder(/command/i).fill('New diagram');
    await page.keyboard.press('Enter');
    await page.waitForSelector('h2:has-text("New diagram")');
    await page.getByRole('button', { name: /evaporating cloud/i }).click();
    // Wait for the canvas to mount with the EC pre-seed.
    await page.waitForSelector('[data-component="tp-node"]');
    await page.waitForTimeout(400);
    await _screenshot(page, 'chapter05-ec-wizard-step1', { mask: TOASTER_MASK(page) });
  });

  // Chapter 9 — Goal Tree creation wizard.

  test('chapter09-goal-tree-wizard', async ({ page }) => {
    await page.goto('/?test=1');
    await page.keyboard.press('Control+K');
    await page.getByPlaceholder(/command/i).fill('New diagram');
    await page.keyboard.press('Enter');
    await page.waitForSelector('h2:has-text("New diagram")');
    await page.getByRole('button', { name: /goal tree/i }).click();
    // Goal Tree opens with the creation wizard at step 1; no
    // entities exist yet (the wizard creates the Goal entity on
    // step-1 commit). Wait for the wizard panel, not a tp-node.
    await page.waitForSelector('[data-component="creation-wizard"]');
    await page.waitForTimeout(400);
    await _screenshot(page, 'chapter09-goal-tree-wizard', { mask: TOASTER_MASK(page) });
  });

  // Chapter 10 — Strategy & Tactics tree.

  test('chapter10-st-example', async ({ page }) => {
    await page.goto('/?test=1');
    await page.keyboard.press('Control+K');
    await page.getByPlaceholder(/command/i).fill('Load example');
    await page.keyboard.press('Enter');
    await page.waitForSelector('h2:has-text("Load example diagram")');
    await page.getByRole('button', { name: /strategy/i }).click();
    await page.waitForSelector('[data-component="tp-node"]');
    await page.waitForTimeout(500);
    await _screenshot(page, 'chapter10-st-example', { mask: TOASTER_MASK(page) });
  });
});

test.describe('book — Part 3 — Across the canvas', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/?test=1');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
  });

  test('chapter13-clr-warnings-visible', async ({ page }) => {
    await page.goto('/?test=1');
    // Seed two UDEs (CRT diagram-type rejects multiple UDEs of
    // certain kinds — actually CRT supports it; the validators
    // surface clarity warnings on missing root causes etc).
    await page.evaluate(() => {
      window.__TP_TEST__?.seed({ type: 'ude', titles: ['Effect with no causes'] });
    });
    await page.waitForSelector('[data-component="tp-node"]');
    // Click the node to surface the inspector with CLR section.
    await page.locator('[data-component="tp-node"]').first().click();
    await page.waitForTimeout(300);
    await _screenshot(page, 'chapter13-clr-warnings-visible', { mask: TOASTER_MASK(page) });
  });

  test('chapter14-revision-panel-open', async ({ page }) => {
    await page.goto('/?test=1');
    await page.evaluate(() => {
      const hook = window.__TP_TEST__;
      if (!hook) throw new Error('test hook not installed');
      const [a, b] = hook.seed({ titles: ['A', 'B'] });
      hook.connect(a!, b!);
      hook.takeRevision('Initial draft');
    });
    // Open RevisionPanel via TopBar history button.
    await page
      .getByRole('button', { name: /history/i })
      .first()
      .click();
    await page.waitForSelector('aside[data-component="revision-panel"]');
    await page.waitForTimeout(300);
    await _screenshot(page, 'chapter14-revision-panel-open', { mask: TOASTER_MASK(page) });
  });
});

test.describe('book — Part 4 — Beyond the screen', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/?test=1');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
  });

  test('chapter15-walkthrough-overlay', async ({ page }) => {
    await page.goto('/?test=1');
    await page.evaluate(() => {
      const hook = window.__TP_TEST__;
      if (!hook) throw new Error('test hook not installed');
      const [a, b, c] = hook.seed({ titles: ['Root cause', 'Mid effect', 'UDE'] });
      hook.connect(a!, b!);
      hook.connect(b!, c!);
    });
    await page.waitForSelector('[data-component="tp-node"]');
    // Open the walkthrough via palette.
    await page.keyboard.press('Control+K');
    await page.getByPlaceholder(/command/i).fill('Start read-through');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(500);
    await _screenshot(page, 'chapter15-walkthrough-overlay', { mask: TOASTER_MASK(page) });
  });

  test('chapter16-export-picker', async ({ page }) => {
    await page.goto('/?test=1');
    await page.keyboard.press('Control+K');
    await page.getByPlaceholder(/command/i).fill('Export');
    await page.keyboard.press('Enter');
    await page.waitForSelector('h3:has-text("Images")');
    await page.waitForTimeout(300);
    await _screenshot(page, 'chapter16-export-picker', { mask: TOASTER_MASK(page) });
  });
});

// ─────────────────────────────────────────────────────────────────
// Pattern for adding more screenshots as chapters are drafted:
//
//   test('chapterNN-scene-slug', async ({ page }) => {
//     await page.goto('/?test=1');
//     // Set up state — seed entities, capture revisions, etc.
//     await page.evaluate(() => {
//       window.__TP_TEST__?.seed({ … });
//     });
//     // Drive UI gestures the chapter describes.
//     await page.keyboard.press('Control+K');
//     // Settle layout / animation before capture.
//     await page.waitForTimeout(300);
//     // Capture.
//     await _screenshot(page, 'chapterNN-scene-slug', { mask: TOASTER_MASK(page) });
//   });
//
// Conventions:
//   - Names are `chapterNN-<scene>` where NN matches the book's
//     chapter number. Two digits for stable sort.
//   - Each test self-contained — no shared state across tests so
//     they can run parallel and re-order.
//   - Always mask the toaster region; toasts persist across some
//     test transitions and would otherwise add nondeterministic
//     pixels.
//   - Always `waitForTimeout` after the final gesture to let
//     layout transitions settle (the canvas anim duration is 200ms
//     in the default theme).
// ─────────────────────────────────────────────────────────────────
