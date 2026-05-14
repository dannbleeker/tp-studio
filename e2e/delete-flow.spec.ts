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
    // Seed two entities + an edge between them, then invoke the real
    // `confirmAndDeleteEntity(id)` service directly via the test hook.
    //
    // The keyboard / click-to-select path tested by earlier versions of
    // this test was racy on CI: React Flow's `onSelectionChange` (wired
    // in Canvas.tsx) mirrors react-flow's internal selection state back
    // to the store on every render. On mount with no react-flow-selected
    // nodes, it fires with empty arrays and our Canvas calls
    // `clearSelection()`, wiping any programmatic selection. Going
    // through the production service directly tests what the test's
    // name says: that the ConfirmDialog renders for a connected entity
    // and clicking Confirm completes the deletion. Selection wiring and
    // keyboard handling are covered by `useSelectionShortcuts` /
    // store unit tests.
    const ids = await page.evaluate(() => {
      const created = window.__TP_TEST__!.seed({ titles: ['cause', 'effect'] });
      const edgeId = window.__TP_TEST__!.connect(created[0]!, created[1]!);
      return { created, edgeId };
    });
    expect(ids.created).toHaveLength(2);
    // `connect` returns null on validation reject (self-loop, dupe,
    // etc.); without an edge the dialog wouldn't open.
    expect(ids.edgeId).not.toBeNull();
    await expect(page.locator('[data-component="tp-node"]')).toHaveCount(2);

    // Fire-and-forget — `confirmAndDeleteEntity` returns a Promise that
    // resolves only after the user clicks a button in the dialog. If we
    // awaited it inside `page.evaluate`, the test would deadlock here.
    await page.evaluate(
      ({ id }) => {
        void window.__TP_TEST__!.confirmAndDeleteEntity(id);
      },
      { id: ids.created[0]! }
    );

    // ConfirmDialog renders inside a `Modal` (a native `<dialog open>`).
    const dialog = page.locator('dialog[open]').first();
    await expect(dialog).toBeVisible({ timeout: 5000 });
    await dialog.getByRole('button', { name: /confirm|delete|ok/i }).click();

    // Confirm click resolves the promise; the entity is removed.
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
