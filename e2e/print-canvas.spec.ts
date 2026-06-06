import { expect, test } from '@playwright/test';

/**
 * Regression guard for the browser-print pipeline (Session 178).
 *
 * For a long time `window.print()` / native Ctrl+P printed a BLANK page: the
 * print stylesheet neutralised React Flow's viewport transform with nothing
 * re-framing the diagram, and a source-order CSS bug hid the title header +
 * footer in print too. `usePrintCanvas` now frames the whole diagram into a
 * fixed print box on `beforeprint` and restores the user's viewport on
 * `afterprint`.
 *
 * This asserts the observable DOM contract of that hook (no PDF/pixel diff):
 *   - `beforeprint` adds `body.printing`, re-frames the viewport, and hides
 *     the MiniMap (whose Tailwind `sm:!block` otherwise printed over the tree);
 *   - `afterprint` removes the class and restores the exact prior viewport.
 *
 * AppLocker on the dev box blocks Playwright's bundled Chromium; CI (Linux)
 * runs it natively. Use system Edge locally, bundled Chromium on CI.
 */
test.use(process.env.CI ? {} : { channel: 'msedge' });

test.describe('browser print', () => {
  test('frames the diagram and hides chrome on beforeprint', async ({ page }) => {
    await page.goto('/?test=1');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await page.evaluate(() => {
      // biome-ignore lint/suspicious/noExplicitAny: e2e test hook
      const hook = (window as any).__TP_TEST__;
      if (!hook) throw new Error('no test hook');
      const ids = hook.seed({ titles: ['Root cause', 'Intermediate', 'Top effect'] });
      hook.connect(ids[0], ids[1]);
      hook.connect(ids[1], ids[2]);
    });
    await page.waitForSelector('.react-flow__node');
    await page.waitForTimeout(500);

    const viewport = page.locator('.react-flow__viewport');
    const beforeTransform = await viewport.evaluate((el) => (el as HTMLElement).style.transform);

    // Fire the print lifecycle exactly as the browser does for Ctrl+P.
    await page.evaluate(() => window.dispatchEvent(new Event('beforeprint')));
    await page.waitForTimeout(150);

    // body.printing is set so print.css can pin the canvas box.
    await expect(page.locator('body')).toHaveClass(/printing/);

    // The viewport was re-framed (transform changed from the on-screen fit).
    const printTransform = await viewport.evaluate((el) => (el as HTMLElement).style.transform);
    expect(printTransform).not.toBe(beforeTransform);
    expect(printTransform).toMatch(/matrix|translate|scale/);

    // The MiniMap thumbnail is hidden for print (inline !important).
    const minimapDisplay = await page
      .locator('.react-flow__minimap')
      .evaluate((el) => (el as HTMLElement).style.display);
    expect(minimapDisplay).toBe('none');

    // afterprint restores the prior viewport and clears the print state.
    await page.evaluate(() => window.dispatchEvent(new Event('afterprint')));
    await page.waitForTimeout(150);
    await expect(page.locator('body')).not.toHaveClass(/printing/);
    const restoredTransform = await viewport.evaluate((el) => (el as HTMLElement).style.transform);
    expect(restoredTransform).toBe(beforeTransform);
  });
});
