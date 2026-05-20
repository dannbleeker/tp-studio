import { readFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';
import JSZip from 'jszip';

/**
 * Session 134 — PowerPoint deck export, end-to-end.
 *
 * The unit-test suite covers `pptxExport.ts`'s pure helpers (slide
 * pagination, narrative-sentence ordering) but not the full pipeline,
 * because pptxgenjs's `writeFile` drives `URL.createObjectURL` + a
 * synthetic anchor click — jsdom doesn't model either. Playwright
 * intercepts the synthetic-click download natively via
 * `page.waitForEvent('download')`, so this spec exercises the path
 * unit tests can't reach.
 *
 * The contract under test:
 *
 *   1. Seed a CRT with a distinctive doc title + a known causal pair.
 *   2. Open the Export… picker.
 *   3. Click the "PowerPoint deck (.pptx)" card.
 *   4. A `.pptx` download fires.
 *   5. Unzipping the file reveals slide XML containing both the doc
 *      title (cover slide) AND the edge sentence (reasoning slide).
 *
 * `.pptx` is a ZIP of XML — JSZip reads it directly. The text
 * payload of each slide lives in `ppt/slides/slideN.xml`; we walk
 * every slide and assert the test fixtures appear at least once.
 */

test.describe('PowerPoint deck export', () => {
  test.beforeEach(async ({ page }) => {
    // Same boot dance as the other e2e specs — open with `?test=1`,
    // clear any leftover localStorage, reload, wait for the test hook.
    await page.goto('/?test=1');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await page.goto('/?test=1');
    await page.waitForFunction(() => Boolean(window.__TP_TEST__));
  });

  test('downloads a .pptx with cover title + reasoning sentence', async ({ page }, testInfo) => {
    // Distinctive strings so the unzipped-XML grep can't false-positive
    // on stock pptxgenjs / template content.
    const docTitle = 'E2E-PPTX-PROBE-DOC-TITLE';
    const causeTitle = 'E2E-PPTX-PROBE-CAUSE';
    const effectTitle = 'E2E-PPTX-PROBE-EFFECT';

    // Seed the doc + connect the two entities + set the distinctive title.
    await page.evaluate(
      ({ docTitle, causeTitle, effectTitle }) => {
        const ids = window.__TP_TEST__!.seed({ titles: [causeTitle, effectTitle] });
        window.__TP_TEST__!.connect(ids[0]!, ids[1]!);
        window.__TP_TEST__!.setDocTitle(docTitle);
      },
      { docTitle, causeTitle, effectTitle }
    );

    // Open the Export… picker via the test hook (not the palette UI —
    // the palette path is its own concern). The picker is a
    // `<LargeDialog>`-flavored modal; we wait for its presence by
    // looking for the "PowerPoint" card text.
    await page.evaluate(() => window.__TP_TEST__!.openExportPicker());
    const pptxCard = page.getByRole('button', { name: /PowerPoint deck/i });
    await expect(pptxCard).toBeVisible({ timeout: 5000 });

    // Two browser actions need to happen near-simultaneously: clicking
    // the card AND catching the download event Playwright dispatches.
    // `waitForEvent('download')` registers a listener BEFORE the click,
    // so the synthetic-anchor click that pptxgenjs's writeFile dispatches
    // is captured deterministically. The 30s timeout covers the cold-
    // start cost of the lazy-loaded pptxgenjs chunk.
    const downloadPromise = page.waitForEvent('download', { timeout: 30_000 });
    await pptxCard.click();
    const download = await downloadPromise;

    // Sanity: filename ends in .pptx (the exporter uses `slug(doc.title)`
    // for the basename + .pptx suffix; the slug step lowercases + dashes
    // so the distinctive title shows up in slug-form too).
    const suggestedName = download.suggestedFilename();
    expect(suggestedName).toMatch(/\.pptx$/);
    expect(suggestedName.toLowerCase()).toContain('e2e-pptx-probe-doc-title');

    // Persist to disk via the testInfo fixture so a failed CI run
    // leaves the artefact attached for inspection. The Playwright
    // run-temp dir lives under the test-results folder.
    const downloadPath = testInfo.outputPath('exported.pptx');
    await download.saveAs(downloadPath);

    // Unzip + walk every slide XML, concatenate the visible text, then
    // assert the three distinctive strings each appear at least once.
    // We grep across all slides so the test doesn't depend on the
    // exporter's exact slide-ordering (cover vs. reasoning vs. likely-
    // core-driver — any order is fine, the content has to be there).
    const buf = await readFile(downloadPath);
    const zip = await JSZip.loadAsync(buf);
    const slidePaths = Object.keys(zip.files).filter((p) => /^ppt\/slides\/slide\d+\.xml$/.test(p));
    expect(slidePaths.length).toBeGreaterThan(0);

    const allSlideText = (
      await Promise.all(slidePaths.map((p) => zip.file(p)!.async('text')))
    ).join('\n');

    // Cover slide carries the doc title verbatim.
    expect(allSlideText).toContain(docTitle);
    // Reasoning slides carry the two endpoint titles (the rendered
    // sentence form, '"effect" because "cause".', includes both).
    expect(allSlideText).toContain(causeTitle);
    expect(allSlideText).toContain(effectTitle);

    // Bonus: app.xml carries the doc title in the file metadata
    // pptxgenjs sets via `pptx.title = doc.title`. Verify that pathway
    // too so a regression in the metadata write surfaces here.
    const appXml = zip.file('docProps/app.xml');
    if (appXml) {
      const appText = await appXml.async('text');
      expect(appText).toContain(docTitle);
    }
  });
});
