import { expect, test } from '@playwright/test';

/**
 * Z-1 — the zoom-percent chip in `CanvasNav` is click-to-edit. Clicking the
 * "{n}%" button swaps it for a numeric input; typing a value + Enter zooms to
 * that percentage (React Flow clamps to its min/max), Escape cancels without
 * touching the zoom. This drives the full interaction against the production
 * build — the part jsdom unit tests can't reach, because it depends on React
 * Flow's live viewport transform.
 */

test.describe('CanvasNav — editable zoom percent (Z-1)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
  });

  test('typing a percentage zooms; Escape cancels', async ({ page }) => {
    await page.goto('/');

    // The zoom chip is the only CanvasNav button whose accessible name is a
    // bare percentage (the zoom-out / zoom-in / fit buttons are icon-only).
    const zoomChip = page.getByRole('button', { name: /^\d+%$/ });
    await expect(zoomChip).toBeVisible();

    // Click to edit → type 150 → Enter commits a 150% zoom. React Flow's
    // default max zoom is 200%, so 150% lands exactly.
    await zoomChip.click();
    const input = page.getByLabel('Set zoom percent');
    await expect(input).toBeVisible();
    await input.fill('150');
    await input.press('Enter');

    // The input collapses back to a button reading the new zoom.
    await expect(input).toHaveCount(0);
    await expect(page.getByRole('button', { name: '150%' })).toBeVisible();

    // Re-open, type a different value, press Escape → the zoom stays at 150%.
    await zoomChip.click();
    const input2 = page.getByLabel('Set zoom percent');
    await input2.fill('80');
    await input2.press('Escape');
    await expect(page.getByRole('button', { name: '150%' })).toBeVisible();
  });
});
