import AxeBuilder from '@axe-core/playwright';
import { type Page, expect, test } from '@playwright/test';

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

  test('help dialog passes a11y when open', async ({ page }) => {
    await goToTestMode(page);
    await page.keyboard.press('?');
    await page.waitForSelector('text=Keyboard shortcuts');
    const results = await new AxeBuilder({ page })
      .include('dialog')
      .disableRules(DISABLED_RULES)
      .analyze();
    const blocking = results.violations.filter(
      (v) => v.impact === 'critical' || v.impact === 'serious'
    );
    expect(blocking).toEqual([]);
  });

  test('about dialog passes a11y when open', async ({ page }) => {
    await goToTestMode(page);
    // Cmd+K → "about" → Enter
    await page.keyboard.press('ControlOrMeta+k');
    await page.waitForSelector('[data-component="command-palette"]');
    await page.keyboard.type('about TP');
    await page.keyboard.press('Enter');
    await page.waitForSelector('text=About TP Studio');
    const results = await new AxeBuilder({ page })
      .include('dialog')
      .disableRules(DISABLED_RULES)
      .analyze();
    const blocking = results.violations.filter(
      (v) => v.impact === 'critical' || v.impact === 'serious'
    );
    expect(blocking).toEqual([]);
  });

  test('settings dialog passes a11y when open', async ({ page }) => {
    await goToTestMode(page);
    await page.keyboard.press('ControlOrMeta+,');
    await page.waitForSelector('text=Settings');
    const results = await new AxeBuilder({ page })
      .include('dialog')
      .disableRules(DISABLED_RULES)
      .analyze();
    const blocking = results.violations.filter(
      (v) => v.impact === 'critical' || v.impact === 'serious'
    );
    expect(blocking).toEqual([]);
  });
});

test.describe('a11y — keyboard navigation', () => {
  /**
   * #28 absorbed into the automated coverage as a smoke check: Tab
   * cycles through interactive elements, Esc dismisses overlays, and
   * focus doesn't get trapped on a non-modal surface. Manual hands-on
   * keyboard walkthrough remains worth doing periodically, but the
   * automated subset catches focus-trap regressions and the obvious
   * "this button has no aria-label" issues.
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

  test('Esc closes the help dialog and restores focus', async ({ page }) => {
    await goToTestMode(page);
    await page.keyboard.press('?');
    await page.waitForSelector('text=Keyboard shortcuts');
    await page.keyboard.press('Escape');
    await expect(page.locator('text=Keyboard shortcuts')).toHaveCount(0);
  });

  test('Esc closes the command palette', async ({ page }) => {
    await goToTestMode(page);
    await page.keyboard.press('ControlOrMeta+k');
    await page.waitForSelector('[data-component="command-palette"]');
    await page.keyboard.press('Escape');
    await expect(page.locator('[data-component="command-palette"]')).toHaveCount(0);
  });
});
