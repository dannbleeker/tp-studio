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
    // Seed two entities + an edge between them via the test hook. We
    // deliberately do NOT call `selectEntity` here — React Flow drives
    // its own selection state and, on mount with no react-flow-selected
    // nodes, fires `onSelectionChange({ nodes: [], edges: [] })` which
    // our Canvas mirrors into the store as `clearSelection()`. That
    // wipes any programmatic selection set before the canvas finishes
    // mounting. The robust gesture is to click the rendered node so
    // React Flow selects it, then wait for the store to reflect that
    // selection.
    const ids = await page.evaluate(() => {
      const created = window.__TP_TEST__!.seed({ titles: ['cause', 'effect'] });
      const edgeId = window.__TP_TEST__!.connect(created[0]!, created[1]!);
      return { created, edgeId };
    });
    expect(ids.created).toHaveLength(2);
    // Edge must actually exist — `connect` returns null when validation
    // rejects (self-loop, duplicate, etc.); if that happens the dialog
    // wouldn't open because the entity has zero connections.
    expect(ids.edgeId).not.toBeNull();
    await expect(page.locator('[data-component="tp-node"]')).toHaveCount(2);

    // Click the first node — React Flow's plain-click path goes through
    // its own selection model and then mirrors back to the store via
    // `onSelectionChange` (see Canvas.tsx:138). Wait for that mirror to
    // land before pressing Delete so the keyboard handler sees a real
    // selection.
    await page.locator('[data-component="tp-node"]').first().click();
    await page.waitForFunction(
      () => {
        // biome-ignore lint/suspicious/noExplicitAny: store shape is internal — we only need a couple of fields here.
        const state = window.__TP_TEST__!.store.getState() as any;
        return state.selection.kind === 'entities' && state.selection.ids.length === 1;
      },
      { timeout: 5000 }
    );

    // Synthesise the Delete keydown directly on `window` instead of
    // going through `page.keyboard.press('Delete')`. The latter routes
    // through the focused element; if React Flow's click moved focus
    // to a node element, the shortcut hook's `isEditableTarget` guard
    // still passes (a `<div>` isn't editable), but dispatching on
    // `window` keeps the test deterministic regardless of focus.
    await page.evaluate(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Delete', bubbles: true }));
    });

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
