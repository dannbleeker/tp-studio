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

  /**
   * Helper: spawn one entity via dblclick and leave it selected,
   * but not in editing mode. dblclick-create sets editingEntityId,
   * which hides the toolbar by design; pressing Escape commits and
   * leaves the entity selected so the toolbar can appear.
   */
  const spawnSelectedEntity = async (page: import('@playwright/test').Page) => {
    const viewport = page.viewportSize();
    if (!viewport) throw new Error('viewport not available');
    await page.mouse.dblclick(viewport.width / 2, viewport.height / 2);
    await page.waitForSelector('[data-component="tp-node"]');
    // Escape leaves editing mode but keeps the entity selected.
    await page.keyboard.press('Escape');
  };

  test('appears on selection and shows the expected verbs', async ({ page }) => {
    // No selection — toolbar absent.
    await expect(page.locator('[data-component="selection-toolbar"]')).toHaveCount(0);

    await spawnSelectedEntity(page);

    // Toolbar should appear above the selection.
    const toolbar = page.locator('[data-component="selection-toolbar"]');
    await expect(toolbar).toBeVisible();

    // Verify the expected verbs are present for a single-entity
    // selection: Add child, Add parent, Delete.
    await expect(toolbar.getByRole('button', { name: /^add child$/i })).toBeVisible();
    await expect(toolbar.getByRole('button', { name: /^add parent$/i })).toBeVisible();
    await expect(toolbar.getByRole('button', { name: /^delete$/i })).toBeVisible();
  });

  test('clicking the Add child verb creates a second entity', async ({ page }) => {
    await spawnSelectedEntity(page);
    const toolbar = page.locator('[data-component="selection-toolbar"]');
    await expect(toolbar).toBeVisible();

    // Click Add child verb. New entity lands in editing mode; Escape
    // leaves the editor so the count assertion sees the post-editor
    // DOM.
    await toolbar.getByRole('button', { name: /^add child$/i }).click();
    await page.keyboard.press('Escape');
    await expect(page.locator('[data-component="tp-node"]')).toHaveCount(2);
  });

  test('hides when the command palette is open', async ({ page }) => {
    await spawnSelectedEntity(page);
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
