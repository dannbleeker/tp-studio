import { expect, test } from '@playwright/test';

/**
 * Session 184 — the Start "All trees" library: closing a tab no longer deletes
 * the document, so closed trees stay reachable. This exercises the full flow on
 * the real build + localStorage (the store-level behaviour is unit-tested in
 * tests/components/start): close a tab → it persists in "All trees" → reopen it
 * → delete one (staying on the Start workspace).
 */
test.describe('Start library — close keeps the tree, reopen + delete', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/?test=1');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await page.waitForFunction(() => Boolean(window.__TP_TEST__));
  });

  test('a closed tree stays in All trees, reopens, and can be deleted', async ({ page }) => {
    // Seed a small working set — a CRT plus two more tabs.
    await page.evaluate(() => {
      const h = window.__TP_TEST__;
      if (!h) throw new Error('test hook not installed');
      h.seed({ titles: ['Late shipments'] });
      h.setDocTitle('Renewal churn');
      h.openTab('ec', 'Speed vs Quality');
      h.openTab('goalTree', 'Team goal'); // active = goalTree
    });

    // Close the active tab via the palette — its body must persist.
    await page.keyboard.press('Control+K');
    await page.getByPlaceholder(/command/i).fill('Close tab');
    await page.keyboard.press('Enter');
    await page.waitForSelector('[data-component="tab-strip"]');

    // Open the Start workspace → All trees.
    await page
      .getByRole('button', { name: /home — tp studio workspace/i })
      .first()
      .click();
    await page.waitForSelector('aside[aria-label="Workspace"]');
    await page.getByRole('button', { name: /^All trees/ }).click();

    // All three trees are listed — the closed "Team goal" included.
    const cards = page.locator('button[aria-label^="Open tree:"]');
    await expect(cards).toHaveCount(3);
    await expect(page.locator('button[aria-label="Open tree: Team goal"]')).toBeVisible();

    // Reopen the closed tree → drops back into the editor.
    await page.locator('button[aria-label="Open tree: Team goal"]').click();
    await expect(page.locator('.react-flow__viewport')).toBeVisible();

    // Back to the library, delete a tree (confirm in the app's dialog).
    await page
      .getByRole('button', { name: /home — tp studio workspace/i })
      .first()
      .click();
    await page.getByRole('button', { name: /^All trees/ }).click();
    await page.locator('button[aria-label^="Open tree:"]').first().hover();
    await page.locator('button[aria-label^="Delete tree:"]').first().click({ force: true });
    await page
      .getByRole('dialog')
      .getByRole('button', { name: 'Delete tree', exact: true })
      .click();

    // One fewer tree, and still on the Start workspace (a delete doesn't exit).
    await expect(page.locator('button[aria-label^="Open tree:"]')).toHaveCount(2);
    await expect(page.locator('aside[aria-label="Workspace"]')).toBeVisible();
  });
});
