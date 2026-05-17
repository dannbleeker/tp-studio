import AxeBuilder from '@axe-core/playwright';
import { expect, type Page, test } from '@playwright/test';

/**
 * Session 114 — Accessibility regression coverage via `@axe-core/playwright`.
 *
 * Pairs with the manual Session 79 a11y audit (focus-trap hook,
 * aria-labels, semantic landmarks, focus rings) and the Session 87 (S25)
 * StatusStrip work. Manual review caught the obvious issues; this
 * automated layer surfaces the kinds of things humans miss on each pass —
 * color-contrast violations, missing aria-labels on auto-generated
 * controls, focus-order regressions after a future refactor.
 *
 * Why axe + Playwright (vs. ESLint's a11y rules + a Jest-axe-style unit
 * test): axe needs a live DOM with computed styles + actual focus state
 * to evaluate contrast, focus order, and aria relationships. Playwright
 * gives us that against the real production build, the same way the
 * visual-regression specs do.
 *
 * Rules disabled per surface:
 *
 *   - `color-contrast` — we have several intentional violations:
 *     placeholder text in muted neutral, the canvas's faint grid /
 *     viewport indicator, and dark-mode "softNeutral" accents that
 *     fall short of 4.5:1 by design. Re-enabling would force a theme
 *     overhaul that's not in scope for an a11y *regression* spec.
 *
 *   - `region` — React Flow's canvas wrapper isn't a landmark; axe
 *     wants every region of the page inside one. Not actionable today.
 *
 *   - `aria-allowed-attr` on the canvas — React Flow assigns
 *     `aria-describedby` to nodes pointing at descriptions that aren't
 *     in the DOM at all times. Library-level concern.
 *
 * The disable list is deliberately short — anything more is a deferred
 * a11y debt that should land as its own session, not silently shipped
 * here.
 *
 * Session 121 — dialog axe scans + per-dialog Esc-close coverage.
 * Session 116 had dropped the dialog tests because the keyboard-press
 * flows raced in headless CI Chromium; Session 121 re-enables them by
 * driving the dialog opens through the new
 * `window.__TP_TEST__.openHelp / openAbout / openSettings` hooks
 * (deterministic store-action dispatch — same code path the real
 * shortcuts hit, none of the gesture flakiness). These tests are the
 * automated portion of Tier-3 #28 (Full hands-on keyboard navigation
 * pass). The fully-manual author walkthrough of focus-order
 * coherence + discoverability remains worth doing periodically — see
 * NEXT_STEPS for the manual checklist.
 *
 * Session 122 — added per-dialog focus-trap coverage after wiring
 * `useFocusTrap` into the `Modal` primitive. Three tests assert that
 * Tabbing inside Help / About / Settings never escapes the dialog.
 *
 * Run via: `pnpm test:e2e --grep a11y`
 */

const DISABLED_RULES = ['color-contrast', 'region', 'aria-allowed-attr'];

const goToTestMode = async (page: Page) => {
  await page.goto('/?test=1');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.goto('/?test=1');
  await page.waitForFunction(() => Boolean(window.__TP_TEST__));
};

/**
 * Session 121 — open a dialog via the test hook, then wait for the
 * <dialog open> element to appear in the DOM. Returns the locator so
 * subsequent assertions can scope to it.
 */
const openDialog = async (page: Page, which: 'help' | 'about' | 'settings') => {
  await page.evaluate((w) => {
    if (w === 'help') window.__TP_TEST__?.openHelp();
    else if (w === 'about') window.__TP_TEST__?.openAbout();
    else window.__TP_TEST__?.openSettings();
  }, which);
  const dialog = page.locator('dialog[open]');
  await dialog.waitFor({ state: 'visible' });
  return dialog;
};

test.describe('a11y — main surfaces', () => {
  test('canvas with content has no critical / serious axe violations', async ({ page }) => {
    await goToTestMode(page);
    await page.evaluate(() => {
      window.__TP_TEST__?.seed({
        type: 'effect',
        titles: ['First', 'Second', 'Third'],
      });
    });
    await page.waitForSelector('[data-component="tp-node"]');
    const results = await new AxeBuilder({ page }).disableRules(DISABLED_RULES).analyze();
    const blocking = results.violations.filter(
      (v) => v.impact === 'critical' || v.impact === 'serious'
    );
    if (blocking.length > 0) {
      console.log('Axe blocking violations:');
      for (const v of blocking) {
        console.log(`  - [${v.impact}] ${v.id}: ${v.description}`);
        for (const n of v.nodes.slice(0, 2)) {
          console.log(`      ${n.target.join(' ')}`);
        }
      }
    }
    expect(blocking).toEqual([]);
  });
});

test.describe('a11y — dialogs', () => {
  /**
   * Each dialog is scanned by axe with the same rule set as the main
   * canvas. Critical / serious violations fail the test; warning-level
   * findings stay non-blocking (logged but accepted).
   */
  for (const which of ['help', 'about', 'settings'] as const) {
    test(`${which} dialog has no critical / serious axe violations`, async ({ page }) => {
      await goToTestMode(page);
      await openDialog(page, which);
      const results = await new AxeBuilder({ page })
        .include('dialog[open]')
        .disableRules(DISABLED_RULES)
        .analyze();
      const blocking = results.violations.filter(
        (v) => v.impact === 'critical' || v.impact === 'serious'
      );
      if (blocking.length > 0) {
        console.log(`Axe blocking violations in ${which} dialog:`);
        for (const v of blocking) {
          console.log(`  - [${v.impact}] ${v.id}: ${v.description}`);
          for (const n of v.nodes.slice(0, 2)) {
            console.log(`      ${n.target.join(' ')}`);
          }
        }
      }
      expect(blocking).toEqual([]);
    });
  }
});

test.describe('a11y — keyboard navigation', () => {
  /**
   * #28 absorbed into the automated coverage as a smoke check: Tab
   * cycles through interactive elements without trapping focus on a
   * non-modal surface. Manual hands-on keyboard walkthrough remains
   * worth doing periodically, but the automated subset catches
   * focus-trap regressions on the main UI shell.
   */

  test('Tab cycles through interactive elements without trapping on the canvas', async ({
    page,
  }) => {
    await goToTestMode(page);
    // Press Tab a small number of times and confirm the focused
    // element changes each time — a stuck focus indicates a trap.
    const focusedTags: string[] = [];
    for (let i = 0; i < 6; i++) {
      await page.keyboard.press('Tab');
      const tag = await page.evaluate(() => {
        const el = document.activeElement;
        if (!el) return '<none>';
        const role = el.getAttribute('aria-label') || el.getAttribute('title') || '';
        return `${el.tagName.toLowerCase()}${role ? `[${role.slice(0, 20)}]` : ''}`;
      });
      focusedTags.push(tag);
    }
    // Pin: each focused element should differ from the next at least
    // half the time (some natural duplicate focuses on a Tab cycle
    // are OK, but ALL identical means focus is stuck).
    const distinctRatio = new Set(focusedTags).size / focusedTags.length;
    expect(distinctRatio).toBeGreaterThanOrEqual(0.4);
  });

  /**
   * Session 121 — per-dialog Esc-close coverage. The Modal primitive
   * dismisses on Escape via `useOutsideAndEscape` (Session 79); these
   * tests pin the contract per-dialog so a future regression in the
   * Esc cascade or a custom `onDismiss` override fails loudly.
   *
   * Session 122 — added focus-trap coverage. `Modal` now wires
   * `useFocusTrap` (with `initialFocus: false` so each consumer can
   * keep its own autofocus). Tabbing past the last focusable element
   * wraps back to the first; Shift+Tab past the first wraps to the
   * last. The test below presses Tab many times and asserts the
   * activeElement always stays inside the dialog — catches focus-trap
   * regressions across all Modal-based dialogs in one test.
   */
  for (const which of ['help', 'about', 'settings'] as const) {
    test(`${which} dialog closes on Escape`, async ({ page }) => {
      await goToTestMode(page);
      await openDialog(page, which);
      await page.keyboard.press('Escape');
      // The dialog should unmount or lose its `open` attribute.
      await expect(page.locator('dialog[open]')).toHaveCount(0);
    });

    test(`${which} dialog traps focus within itself when tabbing`, async ({ page }) => {
      await goToTestMode(page);
      await openDialog(page, which);
      // Tab through 15 elements — enough to cycle past the longest
      // dialog's tab order even with multiple focus stops. After
      // each press, the active element must still be inside the
      // dialog (focus didn't escape to <body> or the canvas).
      for (let i = 0; i < 15; i++) {
        await page.keyboard.press('Tab');
        const inside = await page.evaluate(() => {
          const el = document.activeElement;
          if (!el) return false;
          const dialog = document.querySelector('dialog[open]');
          return Boolean(dialog?.contains(el));
        });
        expect(inside, `Tab ${i + 1} escaped the ${which} dialog`).toBe(true);
      }
    });
  }
});
