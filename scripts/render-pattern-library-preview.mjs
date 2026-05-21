/**
 * Diagnostic preview: snapshot the pattern-library dialog as a PNG so
 * we can eyeball the layout / chip row / card grid without running
 * the full app. Generates `docs/guide/diagrams/pattern-library-preview.png`.
 *
 * Mirrors the structure of `render-clr-map-native.mjs` — Playwright
 * launches Chromium, sets static HTML mimicking the dialog markup
 * with the same Tailwind classes, and clips a screenshot.
 *
 * Static HTML; doesn't import the real component (avoiding bundling
 * the whole app for one preview). Kept synchronized by eye when the
 * dialog's structure changes — this is a one-off QA artefact, not a
 * regression guard.
 */

import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');
const OUT = resolve(ROOT, 'docs', 'guide', 'diagrams', 'pattern-library-preview.png');

// Mirror of the PATTERNS registry — kept inline so the preview script
// is self-contained.
const PATTERNS = [
  [
    'crt',
    'Customer satisfaction declining',
    'Classic operational CRT — fulfilment-flow root causes feeding a single customer UDE, with one AND junctor.',
  ],
  [
    'crt',
    'Engineering velocity decline',
    'Software team CRT — sprint slip rolls up from on-call / review / flake causes, with an AND on the ops-drag effect.',
  ],
  [
    'ec',
    'Work / life balance',
    'Teaching-classic personal EC — "leave at 5" vs "stay late", with the explicit D↔D′ mutex arrow.',
  ],
  [
    'ec',
    'Quality vs speed',
    'Engineering tradeoff EC — QA gate vs continuous delivery, both routes to "ship features customers love".',
  ],
  [
    'frt',
    'Future Reality Tree starter',
    'Bottom-up FRT seeded with an injection — propagates through intermediate effects to a desired effect.',
  ],
  [
    'prt',
    'Prerequisite Tree starter',
    'Necessity-style PRT — objective at top, obstacles beneath, intermediate objectives clearing each.',
  ],
  [
    'tt',
    'Support triage Transition Tree',
    'Canonical Outcome ← (Precondition + Action) triples joined by AND junctors, including one unspecified precondition.',
  ],
  [
    'goalTree',
    'Goal Tree starter',
    '3-layer necessity tree — Goal at top, Critical Success Factors beneath, Necessary Conditions feeding each CSF.',
  ],
  [
    'st',
    'Strategy & Tactics starter',
    'Hierarchical S&T — strategy / tactic pairs with rationale fields (necessary / parallel / sufficient assumptions).',
  ],
];

const TYPE_LABEL = {
  crt: 'CRT',
  frt: 'FRT',
  prt: 'PRT',
  tt: 'TT',
  ec: 'EC',
  goalTree: 'Goal Tree',
  st: 'S&T',
};

const cards = PATTERNS.map(
  ([type, label, hint]) => `
  <li>
    <div class="card">
      <span class="chip">${TYPE_LABEL[type]}</span>
      <h3>${label}</h3>
      <p>${hint}</p>
    </div>
  </li>`
).join('');

const filterChips = [
  ['all', 'All', 9],
  ['crt', 'Current Reality Tree', 2],
  ['frt', 'Future Reality Tree', 1],
  ['prt', 'Prerequisite Tree', 1],
  ['tt', 'Transition Tree', 1],
  ['ec', 'Evaporating Cloud', 2],
  ['goalTree', 'Goal Tree', 1],
  ['st', 'Strategy & Tactics', 1],
];

const HTML = `<!doctype html>
<html><head><meta charset="utf-8"><title>Pattern library — preview</title>
<style>
  html, body { margin: 0; padding: 0; background: #f3f4f6;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto,
                 "Helvetica Neue", Arial, sans-serif;
    color: #1f2937; }
  .modal { width: 920px; margin: 32px; padding: 24px;
    background: white; border-radius: 12px;
    box-shadow: 0 20px 50px rgba(0,0,0,.15); }
  h1 { font-size: 18px; margin: 0; color: #111827; font-weight: 600; }
  .subtitle { font-size: 12px; color: #6b7280; margin: 4px 0 16px; }
  .filter-row { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 16px; }
  .filter-chip { padding: 3px 10px; font-size: 11px; font-weight: 500;
    border-radius: 9999px; border: 1px solid #e5e7eb;
    background: white; color: #4b5563; }
  .filter-chip.active { border-color: #6366f1; background: #eef2ff; color: #4338ca; }
  .filter-chip .count { opacity: .7; margin-left: 2px; }
  ul { list-style: none; padding: 0; margin: 0;
    display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }
  .card { display: flex; flex-direction: column; gap: 6px;
    padding: 12px; background: white; border-radius: 6px;
    border: 1px solid #e5e7eb; height: 100%; }
  .card .chip { align-self: flex-start;
    background: #eef2ff; color: #4338ca; font-weight: 600;
    text-transform: uppercase; font-size: 9px; letter-spacing: .04em;
    padding: 1px 6px; border-radius: 3px; }
  .card h3 { font-size: 14px; margin: 0; color: #111827; font-weight: 500; line-height: 1.25; }
  .card p { font-size: 12px; color: #4b5563; margin: 0; line-height: 1.35; }
</style>
</head>
<body>
  <div class="modal">
    <h1>Pattern library</h1>
    <p class="subtitle">Curated starter diagrams for common TOC scenarios. Pick one to drop onto the canvas; Undo from the toast restores your previous doc.</p>
    <div class="filter-row">
      ${filterChips.map(([id, label, count]) => `<span class="filter-chip ${id === 'all' ? 'active' : ''}">${label} <span class="count">(${count})</span></span>`).join('')}
    </div>
    <ul>${cards}</ul>
  </div>
</body></html>`;

await mkdir(dirname(OUT), { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage({
  viewport: { width: 1024, height: 1100 },
  deviceScaleFactor: 1.5,
});
await page.setContent(HTML, { waitUntil: 'load' });
const target = await page.locator('.modal').boundingBox();
if (!target) throw new Error('Could not locate .modal element');
const buf = await page.screenshot({ clip: target, type: 'png' });
await browser.close();
await writeFile(OUT, buf);
console.log(`Wrote ${OUT}`);
