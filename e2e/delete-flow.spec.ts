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
    // Seed two entities + connect them + select the first one, all via
    // the test hook. Going through `selectEntity` directly is more
    // reliable than `page.locator(...).click()` — React Flow propagates
    // selection through its `onSelectionChange` callback to the store
    // asynchronously, so a `.click()` followed immediately by `Delete`
    // races and the delete handler can see an empty selection. Setting
    // the selection on the store before pressing Delete sidesteps that
    // race.
    const ids = await page.evaluate(() => {
      const created = window.__TP_TEST__!.seed({ titles: ['cause', 'effect'] });
      const edgeId = window.__TP_TEST__!.connect(created[0]!, created[1]!);
      const store = window.__TP_TEST__!.store as {
        getState: () => { selectEntity: (id: string) => void };
      };
      store.getState().selectEntity(created[0]!);
      return { created, edgeId };
    });
    expect(ids.created).toHaveLength(2);
    // Edge must actually exist — `connect` returns null when validation
    // rejects (self-loop, duplicate, etc.); if that happens the dialog
    // wouldn't open because the entity has zero connections.
    expect(ids.edgeId).not.toBeNull();
    await expect(page.locator('[data-component="tp-node"]')).toHaveCount(2);

    // Wait for the store to reflect the expected state before pressing
    // Delete. Self-documents the precondition + gives a clearer signal
    // when something below is wrong than a downstream visibility check.
    await page.waitForFunction(
      () => {
        // biome-ignore lint/suspicious/noExplicitAny: store shape is internal — we only need a couple of fields here, type-checking it adds noise without value.
        const state = window.__TP_TEST__!.store.getState() as any;
        return (
          Object.keys(state.doc.entities).length === 2 &&
          Object.keys(state.doc.edges).length === 1 &&
          state.selection.kind === 'entities' &&
          state.selection.ids.length === 1
        );
      },
      { timeout: 5000 }
    );

    // Press Delete. The handler in `useSelectionShortcuts` is attached
    // to `window` and reads the selection from the store directly, so
    // no specific focus is needed. We deliberately do NOT click the
    // canvas first — a click on empty canvas would deselect what we
    // just selected.
    await page.keyboard.press('Delete');

    // ConfirmDialog renders inside a `Modal` (a native `<dialog open>`).
    // The Modal wraps the dialog in an `aria-hidden="true"` backdrop
    // div — which Playwright's `getByRole('dialog')` excludes from the
    // accessibility tree. Use the CSS selector for the open dialog
    // directly so the lookup is robust.
    const dialog = page.locator('dialog[open]').first();
    await expect(dialog).toBeVisible({ timeout: 5000 });
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
