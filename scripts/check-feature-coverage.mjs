// scripts/check-feature-coverage.mjs
//
// Guards docs/features.json — the feature catalogue that build-stats.mjs turns
// into the `featureCoverage` metric. Run in the local preflight gate AND in the
// Stats workflow so the catalogue can't silently rot:
//
//   • INTEGRITY (hard fail): duplicate / missing id, unknown area, missing or
//     non-boolean coverage flag, or `bookExample` without `book`. Any of these
//     would corrupt the metric — build-stats reads this file through `safe()`,
//     so a broken registry would otherwise just make featureCoverage null with
//     no signal. This converts that silent failure into a loud one.
//   • FRESHNESS (warn): if the CHANGELOG has advanced past the catalogue's
//     `reviewedThroughSession`, the catalogue may be missing newly-shipped
//     user-facing features — surfaced as a GitHub annotation, not a hard fail
//     (many sessions ship only infrastructure).
//
// The coverage flags themselves are judgment-maintained alongside the docs (see
// the repo's "keep the docs in sync" rule); this guards the denominator and the
// structure, not the prose.

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => readFileSync(join(ROOT, rel), 'utf8');

let reg;
try {
  reg = JSON.parse(read('docs/features.json'));
} catch (e) {
  console.error(`✗ docs/features.json is not valid JSON: ${e.message}`);
  process.exit(1);
}

const feats = reg.features;
if (!Array.isArray(feats) || feats.length === 0) {
  console.error('✗ docs/features.json: `features` must be a non-empty array');
  process.exit(1);
}

const areas = new Set(Array.isArray(reg.areas) ? reg.areas : []);
const errors = [];
const seen = new Set();
for (const f of feats) {
  const where = f && typeof f.id === 'string' ? f.id : JSON.stringify(f);
  if (typeof f.id !== 'string' || !f.id) errors.push(`feature has no string id: ${where}`);
  else if (seen.has(f.id)) errors.push(`duplicate id: ${f.id}`);
  else seen.add(f.id);
  if (typeof f.name !== 'string' || !f.name) errors.push(`${where}: missing name`);
  if (!areas.has(f.area)) errors.push(`${where}: area "${f.area}" not in the declared areas list`);
  if (typeof f.since !== 'number') errors.push(`${where}: since must be a number`);
  for (const k of ['manual', 'book', 'bookExample'])
    if (typeof f[k] !== 'boolean') errors.push(`${where}: ${k} must be a boolean`);
  if (f.bookExample === true && f.book !== true)
    errors.push(`${where}: bookExample is true but book is false`);
}

if (errors.length) {
  console.error(`✗ feature catalogue integrity: ${errors.length} error(s)`);
  for (const e of errors) console.error(`  - ${e}`);
  process.exit(1);
}

// Surface the live coverage numbers in the gate output.
const T = feats.length;
const pct = (n) => Math.round((n / T) * 1000) / 10;
const count = (k) => feats.filter((f) => f[k]).length;
console.log(
  `✓ feature catalogue: ${T} features — manual ${count('manual')} (${pct(count('manual'))}%), ` +
    `book ${count('book')} (${pct(count('book'))}%), book+example ${count('bookExample')} (${pct(count('bookExample'))}%)`
);

// Freshness: has the CHANGELOG advanced past the last reviewed session?
const reviewed = typeof reg.reviewedThroughSession === 'number' ? reg.reviewedThroughSession : 0;
const sessions = [...read('CHANGELOG.md').matchAll(/^## Session (\d+)/gm)].map((m) => Number(m[1]));
const latest = sessions.length ? Math.max(...sessions) : 0;
if (latest > reviewed) {
  process.stdout.write(
    `::warning::feature catalogue reviewed through Session ${reviewed}, but CHANGELOG is at Session ${latest}. ` +
      `Review Sessions ${reviewed + 1}-${latest} for new user-facing features, update docs/features.json, and bump reviewedThroughSession.\n`
  );
} else {
  console.log(`✓ catalogue reviewed through Session ${reviewed} (CHANGELOG latest: ${latest})`);
}
