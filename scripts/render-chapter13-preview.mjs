/**
 * Diagnostic preview: render chapter 13's CLR-map section as a PNG using
 * the *book's* CSS (so the points-based sizing is honoured) rather than
 * the standalone preview's px-based CSS.
 *
 * Disposable — useful for verifying the embedded map looks right after
 * touching `CLR_MAP_CSS` or the chapter body.
 */
import { chromium } from '@playwright/test';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { clrMapHtml, CLR_MAP_CSS } from './lib/clrMapHtml.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');
const OUT = resolve(ROOT, 'docs', 'guide', 'diagrams', 'clr-map-in-book.png');

// Match the book's A4 content area (170mm wide ≈ 643 css-px at 96dpi).
const HTML = `<!doctype html>
<html><head><meta charset="utf-8"><title>CLR map — book embed preview</title>
<style>
  html, body { margin: 0; padding: 0;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto,
                 "Helvetica Neue", Arial, sans-serif;
    color: #1f2937; font-size: 11pt; }
  .page { width: 170mm; padding: 8mm; background: white; }
  ${CLR_MAP_CSS}
</style>
</head>
<body>
  <div class="page">
    ${clrMapHtml()}
  </div>
</body></html>`;

await mkdir(dirname(OUT), { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage({
  viewport: { width: 800, height: 1200 },
  deviceScaleFactor: 2,
});
await page.setContent(HTML, { waitUntil: 'load' });
const target = await page.locator('.page').boundingBox();
if (!target) throw new Error('Could not locate .page element');
const buf = await page.screenshot({ clip: target, type: 'png' });
await browser.close();
await writeFile(OUT, buf);
console.log(`Wrote ${OUT}`);
