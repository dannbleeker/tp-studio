import { expect, test } from '@playwright/test';

/**
 * Session 95 — Selection-anchored toolbar e2e.
 *
 * Earlier attempts used `page.mouse.dblclick()` (racy: same flake as
 * visual-canvas.spec.ts:61) and `page.click()` on the rendered node
 * wrapper (raced with React Flow's mount-time onSelectionChange).
 *
 * The reliable path: drive selection via React Flow's `setNodes`
 * API directly through a `selectNodeViaRF(id)` test-hook helper.
 * That flips `selected: true` on the target node, RF fires
 * `onSelectionChange` naturally → Canvas.tsx's handler mirrors it
 * to our zustand store → the toolbar's effect sees the new
 * selection → rect is computed → toolbar appears. Matches the
 * production data flow exactly without the click-timing race.
 */

test.describe('SelectionToolbar e2e', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/?test=1');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await page.goto('/?test=1');
    await page.waitForFunction(() => Boolean(window.__TP_TEST__));
  });

  /**
   * Seed a single entity via the test hook, wait for it to render,
   * then select it via React Flow's `setNodes` API. RF's
   * `onSelectionChange` mirrors the selection back to our zustand
   * store, the toolbar's effect re-runs, and the toolbar appears.
   * Returns the entity id.
   */
  const seedAndSelectOne = async (page: import('@playwright/test').Page): Promise<string> => {
    const id = await page.evaluate(() => {
      const created = window.__TP_TEST__!.seed({ titles: ['A'] });
      return created[0]!;
    });
    // Wait for the entity to render — this proves React Flow has
    // initialised and `getCanvasInstance()` returns a real instance.
    await page.waitForSelector(`.react-flow__node[data-id="${id}"]`);
    // Drive selection via RF's setNodes. Returns false if RF isn't
    // ready yet; retry up to ~1s.
    await page.waitForFunction((entityId) => window.__TP_TEST__!.selectNodeViaRF(entityId), id, {
      timeout: 5000,
    });
    // Wait for our zustand store to mirror the selection (proves the
    // production data flow ran end-to-end).
    await page.waitForFunction(() => {
      const sel = window.__TP_TEST__!.getSelection();
      return sel.kind === 'entities' && sel.ids.length === 1;
    });
    return id;
  };

  test('appears on selection and shows the expected verbs', async ({ page }) => {
    // No selection — toolbar absent.
    await expect(page.locator('[data-component="selection-toolbar"]')).toHaveCount(0);

    await seedAndSelectOne(page);

    const toolbar = page.locator('[data-component="selection-toolbar"]');
    await expect(toolbar).toHaveCount(1);
    await expect(toolbar.getByRole('button', { name: /^add child$/i })).toBeVisible();
    await expect(toolbar.getByRole('button', { name: /^add parent$/i })).toBeVisible();
    await expect(toolbar.getByRole('button', { name: /^delete$/i })).toBeVisible();
  });

  test('clicking the Add child verb creates a second entity', async ({ page }) => {
    await seedAndSelectOne(page);
    const toolbar = page.locator('[data-component="selection-toolbar"]');
    await expect(toolbar).toHaveCount(1);

    // Click Add child verb. New entity lands in editing mode; Escape
    // leaves the editor so the count assertion sees the post-editor
    // DOM.
    await toolbar.getByRole('button', { name: /^add child$/i }).click();
    await page.keyboard.press('Escape');
    await expect(page.locator('[data-component="tp-node"]')).toHaveCount(2);
  });

  test('hides when the command palette is open', async ({ page }) => {
    await seedAndSelectOne(page);
    await expect(page.locator('[data-component="selection-toolbar"]')).toHaveCount(1);

    // Open the palette — toolbar should disappear.
    await page.keyboard.press('Control+K');
    await expect(page.getByPlaceholder(/command/i)).toBeVisible();
    await expect(page.locator('[data-component="selection-toolbar"]')).toHaveCount(0);

    // Close the palette — toolbar reappears.
    await page.keyboard.press('Escape');
    await expect(page.locator('[data-component="selection-toolbar"]')).toHaveCount(1);
  });
});
