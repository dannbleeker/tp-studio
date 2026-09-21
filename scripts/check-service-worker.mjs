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

// The SPA navigation fallback must not swallow the book. Workbox emits the
// NavigationRoute FIRST and the Router matches in registration order, so the
// fallback claims a navigation to `/…​.pdf` before the CacheFirst rule for
// pdf/epub is ever consulted: clicking "PDF" or "EPUB" opened a second copy of
// the app instead of the book. Verified in a real browser against a production
// build — a *navigation* returned `text/html` (index.html byte for byte) while
// a `fetch()` of the same URL returned the real `application/pdf`. Only
// navigations were affected, which is why the runtime cache looked healthy and
// nothing else in the build complained. Asserted on the emitted denylist
// because that is the only place the ordering is actually fixed.
const denylistMatch = /denylist\s*:\s*\[([^\]]*)\]/.exec(sw);
if (denylistMatch === null) {
  // Distinct from "the entry is missing": no denylist at all means the emitted
  // shape changed and this check is no longer looking at what it thinks it is.
  errors.push(
    `${SW} has no \`denylist\` on its NavigationRoute — either navigateFallbackDenylist was ` +
      `dropped from vite.config.ts, or workbox changed the emitted shape and this check needs updating.`
  );
} else {
  const denylist = denylistMatch[1];
  for (const ext of ['pdf', 'epub']) {
    if (!denylist.includes(ext)) {
      errors.push(
        `${SW}'s navigateFallbackDenylist does not exclude \`.${ext}\`, so the SPA fallback serves ` +
          `index.html for a navigation to the book. Add it to \`navigateFallbackDenylist\` in ` +
          `vite.config.ts — a runtimeCaching rule cannot fix this, because the NavigationRoute is ` +
          `registered first and the Router matches in registration order.`
      );
    }
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
