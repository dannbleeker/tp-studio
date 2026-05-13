import { expect, test } from '@playwright/test';

/**
 * Smoke tests for TP Studio.
 *
 * These run against the production build (`vite preview`) in a real
 * Chromium browser. They cover the workflows that unit tests can't
 * verify — React Flow rendering, the keyboard palette opening, native
 * `<dialog>` focus behavior, and `localStorage` persistence across
 * page reloads.
 *
 * Keep them few and high-signal: each test should describe a user
 * journey that, if it breaks, the app is meaningfully degraded.
 */

test.describe('TP Studio smoke', () => {
  test.beforeEach(async ({ page }) => {
    // Clear localStorage before each test so persisted state from a
    // previous run doesn't leak into the next. The doc and prefs both
    // live in localStorage; reset both.
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
  });

  test('renders the empty canvas with the new-doc CTA', async ({ page }) => {
    await page.goto('/');
    // The title badge should be visible at the top-left.
    await expect(page.getByRole('textbox')).toBeAttached();
    // The Commands button is the primary CTA at every breakpoint.
    await expect(page.getByRole('button', { name: /commands/i })).toBeVisible();
  });

  test('Cmd+K opens the command palette', async ({ page }) => {
    await page.goto('/');
    // Ctrl+K works as a substitute for Cmd+K on non-Mac CI runners; the
    // app binding listens to either modifier.
    await page.keyboard.press('Control+K');
    await expect(page.getByPlaceholder(/search/i)).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByPlaceholder(/search/i)).not.toBeVisible();
  });

  test('canvas double-click creates a new entity (preserves across reload)', async ({ page }) => {
    await page.goto('/');
    // Double-click the canvas surface to spawn an entity at that point.
    // The canvas takes the full viewport; click the center.
    const viewport = page.viewportSize();
    if (!viewport) test.fail();
    await page.mouse.dblclick(viewport!.width / 2, viewport!.height / 2);

    // A new entity should appear. We don't assert on the position
    // (dagre may re-layout) — just on the count.
    const initialNodes = await page.locator('[data-component="tp-node"]').count();
    expect(initialNodes).toBeGreaterThanOrEqual(1);

    // Reload — the autosave should bring the entity back.
    await page.reload();
    const afterReloadNodes = await page.locator('[data-component="tp-node"]').count();
    expect(afterReloadNodes).toBe(initialNodes);
  });
});
