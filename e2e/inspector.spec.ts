import { expect, test } from '@playwright/test';

/**
 * EntityInspector section-render e2e (Session 169 — structural tier).
 *
 * Guards the inspector decomposition: selecting an entity must surface its
 * inspector with the extracted **State picker** (`EntityStateSection`). A future
 * section extraction that mis-threads props would silently drop the section —
 * this catches it in a real browser, where jsdom component tests can't fully
 * exercise the React Flow selection → store → inspector data flow.
 *
 * Selection is driven through the production React Flow path (`selectNodeViaRF`),
 * the same deterministic hook the SelectionToolbar spec uses.
 */
test.describe('EntityInspector sections e2e', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/?test=1');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await page.goto('/?test=1');
    await page.waitForFunction(() => Boolean(window.__TP_TEST__));
  });

  test('selecting an entity surfaces the State picker (EntityStateSection)', async ({ page }) => {
    const id = await page.evaluate(() => window.__TP_TEST__!.seed({ titles: ['Pick me'] })[0]!);
    await page.waitForSelector(`.react-flow__node[data-id="${id}"]`);
    await page.waitForFunction((eid) => window.__TP_TEST__!.selectNodeViaRF(eid), id, {
      timeout: 5000,
    });
    await page.waitForFunction(() => {
      const sel = window.__TP_TEST__!.getSelection();
      return sel.kind === 'entities' && sel.ids.length === 1;
    });

    // The extracted State picker renders, with all four state buttons.
    const picker = page.locator('[data-component="entity-state-picker"]');
    await expect(picker).toHaveCount(1);
    await expect(picker.getByRole('button', { name: /^unknown$/i })).toBeVisible();
    await expect(picker.getByRole('button', { name: /^true$/i })).toBeVisible();
    await expect(picker.getByRole('button', { name: /^false$/i })).toBeVisible();
    await expect(picker.getByRole('button', { name: /^disputed$/i })).toBeVisible();
  });
});
