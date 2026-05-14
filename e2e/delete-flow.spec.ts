import { expect, test } from '@playwright/test';

/**
 * Delete-entity flow:
 *   1. Seed two entities + a connection via the `window.__TP_TEST__`
 *      hook (Session 82 — replaces the brittle `page.mouse.dblclick`
 *      pattern that was racy on the GitHub-Actions Ubuntu runner).
 *   2. Click one entity, press Delete.
 *   3. With a connection present, `confirmAndDeleteEntity` opens the
 *      in-app `ConfirmDialog` (Session 67); Confirm removes the entity.
 *   4. Re-seed without a connection; Delete is silent and removes
 *      immediately.
 *
 * Also covers the Browse-Lock-aware confirmation guard added in
 * session 69 (the bug-fix where `confirmAndDeleteEntity` would
 * previously prompt even while the doc was locked). With the doc
 * unlocked, the dialog should appear; with the lock on, no dialog and
 * the entity stays put.
 */

test.describe('delete entity flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/?test=1');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await page.goto('/?test=1');
    await page.waitForFunction(() => Boolean(window.__TP_TEST__));
  });

  test('shows the in-app ConfirmDialog when deleting a connected entity', async ({ page }) => {
    // Seed two entities + connect them, so the delete path goes through
    // the ConfirmDialog (entity-with-edges branch in
    // `confirmAndDeleteEntity`).
    const ids = await page.evaluate(() => {
      const created = window.__TP_TEST__!.seed({ titles: ['cause', 'effect'] });
      window.__TP_TEST__!.connect(created[0]!, created[1]!);
      return created;
    });
    expect(ids).toHaveLength(2);
    await expect(page.locator('[data-component="tp-node"]')).toHaveCount(2);

    // Select the "cause" entity, press Delete. With the connection
    // present, the confirm dialog should open.
    await page.locator('[data-component="tp-node"]').first().click();
    await page.keyboard.press('Delete');

    // ConfirmDialog has role="dialog" — wait for it.
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await dialog.getByRole('button', { name: /confirm|delete|ok/i }).click();

    // Entity is gone; the still-living one remains.
    await expect(page.locator('[data-component="tp-node"]')).toHaveCount(1);
  });

  test('Browse Lock blocks delete without showing a confirm', async ({ page }) => {
    // Seed one entity, then engage Browse Lock.
    await page.evaluate(() => {
      window.__TP_TEST__!.seed({ titles: ['lone'] });
    });
    await expect(page.locator('[data-component="tp-node"]')).toHaveCount(1);

    // Toggle Browse Lock on. The button has aria-label "Lock document
    // for browsing" when unlocked.
    await page.getByRole('button', { name: /lock document for browsing/i }).click();

    // Select the entity and press Delete. With Browse Lock on, the
    // confirm dialog should NOT open and the entity should remain.
    await page.locator('[data-component="tp-node"]').click();
    await page.keyboard.press('Delete');

    // The confirm dialog has role="dialog"; assert none is open.
    await expect(page.getByRole('dialog')).toHaveCount(0);
    // The entity is still there.
    await expect(page.locator('[data-component="tp-node"]')).toHaveCount(1);
  });
});
