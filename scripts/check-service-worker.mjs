#!/usr/bin/env node
/**
 * Assert the generated service worker actually carries the routes we
 * configured. Runs after `vite build`, as part of `preflight.mjs` and CI.
 *
 * Why this exists: workbox serialises a *function* `urlPattern` by
 * stringifying its source into `sw.js`. The closure does not come with it, so
 * a callback that reads a build-time constant from `vite.config.ts` compiles
 * to a dangling identifier, throws `ReferenceError` inside the worker, and the
 * route silently never matches. Nothing in the build, the type-checker or the
 * unit suite can see it: the build succeeds, the worker registers, and the
 * only symptom is that a cache is never populated — discovered, in our case,
 * on a laptop with no network.
 *
 * So the check is deliberately literal: every on-demand vendor chunk name must
 * appear inside `sw.js`, and no `vite.config.ts` build-time identifier may.
 */
import { readFileSync } from 'node:fs';

const SW = 'dist/sw.js';

// Mirrors ON_DEMAND_VENDOR_CHUNKS in vite.config.ts. Duplicated on purpose:
// a check that imports the value it is checking would pass just as happily
// when the value never reached the worker, which is the whole failure mode.
const VENDOR_CHUNKS = ['jspdf', 'html2canvas', 'svg2pdf', 'pptxgen', 'MarkdownPreview'];

// Identifiers that only exist at build time. Any of them surviving into the
// worker means a closure was stringified and is now dangling.
const BUILD_TIME_IDENTIFIERS = [
  'ON_DEMAND_VENDOR_PATTERN',
  'ON_DEMAND_VENDOR_CHUNKS',
  'ON_DEMAND_VENDOR_GLOBS',
];

let sw;
try {
  sw = readFileSync(SW, 'utf8');
} catch {
  console.error(`check-service-worker: ${SW} not found — run a build first.`);
  process.exit(1);
}

const errors = [];

for (const id of BUILD_TIME_IDENTIFIERS) {
  if (sw.includes(id)) {
    errors.push(
      `${SW} references the build-time identifier \`${id}\`, which does not exist inside a service worker. ` +
        `Pass the value itself (a RegExp serialises; a closure does not) rather than a callback that reads it.`
    );
  }
}

const missing = VENDOR_CHUNKS.filter((name) => !sw.includes(name));
if (missing.length > 0) {
  errors.push(
    `${SW} does not name the on-demand vendor chunk(s): ${missing.join(', ')}. ` +
      `Their runtime-cache route is missing, so the offline warm-up will fetch them and cache nothing.`
  );
}

if (errors.length > 0) {
  for (const e of errors) console.error(`check-service-worker: ${e}`);
  process.exit(1);
}

console.log(
  `check-service-worker: routes intact (${VENDOR_CHUNKS.length} on-demand chunks named).`
);
