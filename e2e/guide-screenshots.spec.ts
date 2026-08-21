import { mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { test } from '@playwright/test';

/**
 * Session 103 — Screenshots for the *Causal Thinking with TP Studio*
 * book (`docs/guide/`). Originally titled *Thinking with TP Studio*;
 * retitled Session 110 to break the surface-level title pattern with
 * the third-party book *Thinking with Flying Logic*.
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
 *
 * ─────────────────────────────────────────────────────────────────
 * Session 210 — STAGING. Eleven of the fifteen committed PNGs had a
 * transient overlay sitting on the diagram, four of them hiding
 * content the caption promised (Chapter 3's cause node, Chapter 4's
 * third UDE). The causes were all "correct product behaviour, wrong
 * book behaviour": `addEntity` selects what it created, so every
 * seeded capture ended with the SelectionToolbar over the canvas and
 * the Inspector on the right edge; `FirstEntityTip` fires at 1–2
 * entities against the freshly-cleared localStorage below; and the
 * old toaster `mask:` argument did not HIDE the toaster — Playwright
 * overpaints a masked element with #FF00FF, so three chapters shipped
 * a fluorescent magenta bar across the diagram.
 *
 * The fix is `_screenshot` staging every capture through
 * `__TP_TEST__.stageForCapture()` rather than each test remembering
 * to. Add a scene and it is staged by construction.
 * ─────────────────────────────────────────────────────────────────
 */

const SCREENSHOT_DIR = 'docs/guide/screenshots';

// The book shows the whole app window, so the frame has to fit the app's
// chrome: the Building Blocks rail (236 px) plus the Inspector (~300 px)
// leave only ~740 px of canvas at the config's 1280×720, and 720 px of
// height clipped the Export dialog mid-row and pushed the revision panel's
// header under the top bar. Scoped to this file on purpose — the 1280×720
// in `playwright.config.ts` is the pinned baseline for the `visual-*`
// snapshot specs and must not move.
test.use({ viewport: { width: 1440, height: 900 } });

type StageOptions = { keepSelection?: boolean; minimap?: boolean };

/**
 * Clear the transient overlays and frame the diagram. Separate from
 * `_screenshot` for the one scene that has to stage BEFORE its final
 * gesture (the Chapter 15 walkthrough, whose own selection we must not
 * clear afterwards).
 */
const _stage = async (
  page: import('@playwright/test').Page,
  options: StageOptions = {}
): Promise<void> => {
  await page.evaluate((opts) => {
    window.__TP_TEST__?.stageForCapture(opts);
  }, options);
  // Let React commit the cleared overlays + the fitView transform.
  await page.waitForTimeout(250);
};

/**
 * Open the command palette and run the first match for `query`.
 *
 * Session 210 — the four palette-driven scenes used to press `Control+K`
 * immediately after `page.goto`, which races the `useGlobalShortcuts` effect
 * that installs the keydown listener: lose the race and the keypress lands on
 * nothing, the palette never opens, and the test times out waiting for its
 * input. CI's `retries: 2` was papering over it. Waiting for the top bar's
 * command-search affordance proves the effect has run, and keeps the keyboard
 * gesture (the one the manuscript documents) as the thing under test.
 */
const _runCommand = async (page: import('@playwright/test').Page, query: string): Promise<void> => {
  await page.getByRole('button', { name: 'Search or run a command' }).first().waitFor();
  await page.keyboard.press('Control+K');
  await page.getByPlaceholder(/command/i).fill(query);
  await page.keyboard.press('Enter');
};

const _screenshot = async (
  page: import('@playwright/test').Page,
  name: string,
  options: StageOptions & { stage?: boolean } = {}
) => {
  const { stage = true, ...stageOptions } = options;
  if (stage) await _stage(page, stageOptions);
  const path = join(SCREENSHOT_DIR, `${name}.png`);
  await mkdir(dirname(path), { recursive: true });
  await page.screenshot({ path, fullPage: false });
};

test.describe('book — Part 1 — Foundations', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/?test=1');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
  });

  test('chapter02-empty-canvas', async ({ page }) => {
    await page.goto('/?test=1');
    await page.waitForSelector('.react-flow__viewport');
    await _screenshot(page, 'chapter02-empty-canvas');
  });

  test('chapter02-first-entity', async ({ page }) => {
    await page.goto('/?test=1');
    await page.evaluate(() => {
      window.__TP_TEST__?.seed({ titles: ['Customers churn'] });
    });
    await page.waitForSelector('[data-component="tp-node"]');
    await page.waitForTimeout(200);
    await _screenshot(page, 'chapter02-first-entity');
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
    await _screenshot(page, 'chapter02-connected-pair');
  });

  test('chapter02-tabs', async ({ page }) => {
    await page.goto('/?test=1');
    await page.evaluate(() => {
      const hook = window.__TP_TEST__;
      if (!hook) throw new Error('test hook not installed');
      // Default first tab: a small slice of the book's running CRT example.
      hook.seed({ type: 'ude', titles: ['Customers churn at renewal'] });
      hook.setDocTitle('Renewal churn (CRT)');
      // Two more documents, each its own tab and a different diagram type,
      // so the strip shows a realistic mixed working set.
      hook.openTab('ec', 'Triage vs. ship (EC)');
      hook.openTab('goalTree', 'Team goal tree');
      // Re-focus the CRT so the canvas beneath the strip shows content.
      hook.switchToTabIndex(0);
    });
    await page.waitForSelector('[data-component="tab-strip"]');
    await page.waitForSelector('[data-component="tp-node"]');
    await page.waitForTimeout(300);
    await _screenshot(page, 'chapter02-tabs');
  });

  test('chapter02-start-page', async ({ page }) => {
    // Taller frame so the template gallery's first row lands whole — the
    // caption names the gallery, and at 900 px the cards cut off mid-blurb.
    await page.setViewportSize({ width: 1440, height: 1040 });
    await page.goto('/?test=1');
    await page.evaluate(() => {
      const hook = window.__TP_TEST__;
      if (!hook) throw new Error('test hook not installed');
      // A small mixed working set so the Start page shows the hero, a
      // "pick up where you left off" row, and the template strip.
      hook.seed({ type: 'ude', titles: ['Customers churn at renewal'] });
      hook.setDocTitle('Renewal churn (CRT)');
      hook.openTab('ec', 'Triage vs. ship (EC)');
      hook.openTab('goalTree', 'Team goal tree');
      hook.switchToTabIndex(0);
    });
    // Open the Start workspace via the Home logo.
    await page
      .getByRole('button', { name: /home — tp studio workspace/i })
      .first()
      .click();
    await page.waitForSelector('aside[aria-label="Workspace"]');
    await page.waitForTimeout(400);
    await _screenshot(page, 'chapter02-start-page');
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
    await _screenshot(page, 'chapter03-causality-because');
  });

  // Session 210 — the chapter covers both the per-edge notation AND the
  // global fallback in Settings → Display. The pair shot above is the
  // notation; this is the setting that names it.
  test('chapter03-causality-setting', async ({ page }) => {
    await page.goto('/?test=1');
    await page.evaluate(() => {
      const hook = window.__TP_TEST__;
      if (!hook) throw new Error('test hook not installed');
      const [a, b] = hook.seed({ titles: ['Triage rubric missing', 'Resolution time > 8h'] });
      hook.connect(a!, b!);
      hook.openSettings();
    });
    await page.getByRole('tab', { name: /display/i }).click();
    // The reading control sits below the badge toggles. Scroll the FOLLOWING
    // field into view rather than the causality label itself — landing the
    // label at the fold clipped its four options off the bottom edge.
    await page.getByText('Default direction for new documents').scrollIntoViewIfNeeded();
    await page.waitForTimeout(300);
    await _screenshot(page, 'chapter03-causality-setting');
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
    await _screenshot(page, 'chapter04-crt-step1-first-ude');
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
    await _screenshot(page, 'chapter04-crt-step2-three-udes');
  });

  // Chapter 5 — Evaporating Cloud. The creation wizard walkthrough.

  test('chapter05-ec-wizard-step1', async ({ page }) => {
    await page.goto('/?test=1');
    await _runCommand(page, 'New diagram');
    await page.waitForSelector('h2:has-text("New diagram")');
    await page.getByRole('button', { name: /evaporating cloud/i }).click();
    // Wait for the canvas to mount with the EC pre-seed.
    await page.waitForSelector('[data-component="tp-node"]');
    await page.waitForTimeout(400);
    await _screenshot(page, 'chapter05-ec-wizard-step1');
  });

  // Chapter 9 — Goal Tree creation wizard.

  test('chapter09-goal-tree-wizard', async ({ page }) => {
    await page.goto('/?test=1');
    await _runCommand(page, 'New diagram');
    await page.waitForSelector('h2:has-text("New diagram")');
    // Use the picker's full "New: …" name — Session 182's method-path stepper
    // also renders a "Goal Tree" pill, so /goal tree/i would be ambiguous.
    await page.getByRole('button', { name: /new: goal tree/i }).click();
    // Goal Tree opens with the creation wizard at step 1; no
    // entities exist yet (the wizard creates the Goal entity on
    // step-1 commit). Wait for the wizard panel, not a tp-node.
    await page.waitForSelector('[data-component="creation-wizard"]');
    await page.waitForTimeout(400);
    await _screenshot(page, 'chapter09-goal-tree-wizard');
  });

  // Chapter 10 — Strategy & Tactics tree.

  test('chapter10-st-example', async ({ page }) => {
    await page.goto('/?test=1');
    await _runCommand(page, 'Load example');
    await page.waitForSelector('h2:has-text("Load example diagram")');
    await page.getByRole('button', { name: /strategy/i }).click();
    await page.waitForSelector('[data-component="tp-node"]');
    await page.waitForTimeout(500);
    await _screenshot(page, 'chapter10-st-example');
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
    // The Inspector IS the subject here ("Click any entity with an open
    // warning. The Inspector's Warnings section lists them…"), so the
    // selection stays — but the warnings sit below Title / Type /
    // Description, which is why the old capture showed no warning at all.
    await _stage(page, { keepSelection: true });
    await page.locator('[data-component="warnings-list"]').scrollIntoViewIfNeeded();
    await page.waitForTimeout(200);
    await _screenshot(page, 'chapter13-clr-warnings-visible', { stage: false });
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
    await _screenshot(page, 'chapter14-revision-panel-open');
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
    // Stage BEFORE opening the walkthrough: the read-through drives its own
    // selection as it steps through edges, and clearing that afterwards would
    // erase the highlight the overlay is describing.
    await _stage(page);
    // Open the walkthrough via palette.
    await _runCommand(page, 'Start read-through');
    await page.waitForTimeout(500);
    await _screenshot(page, 'chapter15-walkthrough-overlay', { stage: false });
  });

  test('chapter16-export-picker', async ({ page }) => {
    // The picker lists five category groups and is taller than any laptop
    // viewport — at the file's 900 px it cut off mid-list, and the caption
    // ("with its category groupings") is precisely about seeing them all.
    // Taller frame for this one capture rather than a scrolled, truncated one.
    await page.setViewportSize({ width: 1440, height: 1280 });
    await page.goto('/?test=1');
    await _runCommand(page, 'Export');
    await page.waitForSelector('h3:has-text("Images")');
    await page.waitForTimeout(300);
    await _screenshot(page, 'chapter16-export-picker');
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
//     // Capture. `_screenshot` stages the frame for you.
//     await _screenshot(page, 'chapterNN-scene-slug');
//   });
//
// Conventions:
//   - Names are `chapterNN-<scene>` where NN matches the book's
//     chapter number. Two digits for stable sort.
//   - Each test self-contained — no shared state across tests so
//     they can run parallel and re-order.
//   - Never pass Playwright's `mask:` — it OVERPAINTS in #FF00FF
//     rather than hiding. `_screenshot` dismisses toasts instead.
//   - Let `_screenshot` stage the frame. Pass `{ stage: false }`
//     and call `_stage` earlier only when the final gesture owns a
//     selection the staging would clear.
//   - Always `waitForTimeout` after the final gesture to let
//     layout transitions settle (the canvas anim duration is 200ms
//     in the default theme).
// ─────────────────────────────────────────────────────────────────
