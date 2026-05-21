/**
 * One-off: render the CLR map (Chapter 13's native diagram) as a PNG
 * preview so the artefact can be inspected outside the book PDF.
 *
 * Generated PNG: `docs/guide/diagrams/clr-map-native.png`.
 * The HTML markup + CSS come from `scripts/lib/clrMapHtml.mjs`, which
 * is also what the book builder embeds at PDF-render time.
 */

import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';
import { CLR_MAP_CSS, clrMapHtml } from './lib/clrMapHtml.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');
const OUT = resolve(ROOT, 'docs', 'guide', 'diagrams', 'clr-map-native.png');

// 1600 px width approximates the book's printable area at the book
// builder's deviceScaleFactor ≈ 2 (the book renders to A4 ≈ 794 css-px
// wide). Doubling here gives a clean 2x PNG preview.
const HTML = `<!doctype html>
<html><head><meta charset="utf-8"><title>CLR map — native preview</title>
<style>
  html, body { margin: 0; padding: 0; background: white;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto,
                 "Helvetica Neue", Arial, sans-serif;
    color: #1f2937; }
  .preview-wrap { width: 1600px; padding: 24px; }
  ${CLR_MAP_CSS}
</style>
</head>
<body>
  <div class="preview-wrap">
    ${clrMapHtml()}
  </div>
</body></html>`;

await mkdir(dirname(OUT), { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage({
  viewport: { width: 1700, height: 1100 },
  deviceScaleFactor: 1.5,
});
await page.setContent(HTML, { waitUntil: 'load' });
const target = await page.locator('.preview-wrap').boundingBox();
if (!target) throw new Error('Could not locate .preview-wrap element');
const buf = await page.screenshot({ clip: target, type: 'png' });
await browser.close();
await writeFile(OUT, buf);
console.log(`Wrote ${OUT}`);

// Also write a standalone HTML for manual eyeballing.
await writeFile(OUT.replace(/\.png$/, '.html'), HTML);
