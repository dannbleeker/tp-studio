import { expect, test } from '@playwright/test';

/**
 * Session 95 — Selection-anchored toolbar e2e.
 *
 * Verifies the user-visible contract end-to-end:
 *   1. With nothing selected, the toolbar is not in the DOM.
 *   2. Double-click → entity is created AND selected → toolbar
 *      appears with verb buttons.
 *   3. Clicking a verb button on the toolbar invokes the underlying
 *      palette command (here: Add child creates a second entity).
 *   4. Pressing Cmd+K (opening the palette) hides the toolbar; Esc
 *      restores it.
 *
 * The toolbar's positioning math (anchored above the selection,
 * flipped below when the selection is near the top) is exercised
 * implicitly — if the toolbar didn't position itself anywhere
 * sensible, the verb-button click in step 3 wouldn't land.
 */

test.describe('SelectionToolbar e2e', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
  });

  test('appears on selection and disappears when nothing is selected', async ({ page }) => {
    // No selection — toolbar absent.
    await expect(page.locator('[data-component="selection-toolbar"]')).toHaveCount(0);

    // Spawn one entity via dblclick (canvas center). The entity is
    // created in editing mode + selected.
    const viewport = page.viewportSize();
    if (!viewport) test.fail();
    await page.mouse.dblclick(viewport!.width / 2, viewport!.height / 2);

    // Wait for the entity to land + the inline title editor to open
    // (editingEntityId !== null). Editing mode HIDES the toolbar by
    // design — so press Escape to commit / leave the editor before
    // asserting toolbar visibility.
    await page.waitForSelector('[data-component="tp-node"]');
    await page.keyboard.press('Escape');

    // Now click the node to ensure it's selected (Escape may have
    // cleared selection depending on whether editing was active).
    const node = page.locator('[data-component="tp-node"]').first();
    await node.click();

    // Toolbar should appear above the selection.
    await expect(page.locator('[data-component="selection-toolbar"]')).toBeVisible();

    // Verify the expected verbs are present for a single-entity
    // selection: Add child, Add parent, Delete.
    const toolbar = page.locator('[data-component="selection-toolbar"]');
    await expect(toolbar.getByRole('button', { name: /^add child$/i })).toBeVisible();
    await expect(toolbar.getByRole('button', { name: /^add parent$/i })).toBeVisible();
    await expect(toolbar.getByRole('button', { name: /^delete$/i })).toBeVisible();
  });

  test('clicking the Add child verb creates a second entity', async ({ page }) => {
    const viewport = page.viewportSize();
    if (!viewport) test.fail();
    await page.mouse.dblclick(viewport!.width / 2, viewport!.height / 2);
    await page.waitForSelector('[data-component="tp-node"]');
    await page.keyboard.press('Escape');
    await page.locator('[data-component="tp-node"]').first().click();
    await expect(page.locator('[data-component="selection-toolbar"]')).toBeVisible();

    // Click Add child verb. New entity should land and open in
    // editing mode (we leave the editor by pressing Escape so the
    // count assertion runs against the post-editor DOM).
    await page
      .locator('[data-component="selection-toolbar"]')
      .getByRole('button', { name: /^add child$/i })
      .click();
    await page.keyboard.press('Escape');

    await expect(page.locator('[data-component="tp-node"]')).toHaveCount(2);
  });

  test('hides when the command palette is open', async ({ page }) => {
    const viewport = page.viewportSize();
    if (!viewport) test.fail();
    await page.mouse.dblclick(viewport!.width / 2, viewport!.height / 2);
    await page.waitForSelector('[data-component="tp-node"]');
    await page.keyboard.press('Escape');
    await page.locator('[data-component="tp-node"]').first().click();
    await expect(page.locator('[data-component="selection-toolbar"]')).toBeVisible();

    // Open the palette — toolbar should disappear.
    await page.keyboard.press('Control+K');
    await expect(page.getByPlaceholder(/command/i)).toBeVisible();
    await expect(page.locator('[data-component="selection-toolbar"]')).toHaveCount(0);

    // Close the palette — toolbar reappears.
    await page.keyboard.press('Escape');
    await expect(page.locator('[data-component="selection-toolbar"]')).toBeVisible();
  });
});
