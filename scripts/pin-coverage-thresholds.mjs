// Pin vitest coverage thresholds to the current measured baseline.
//
// Workflow:
//   1. `pnpm install`  (gets @vitest/coverage-v8)
//   2. `pnpm test:coverage`  (writes coverage/coverage-summary.json)
//   3. `node ./scripts/pin-coverage-thresholds.mjs`  (this script)
//   4. Commit the updated `vite.config.ts`.
//
// The script reads the total-coverage percentages from
// coverage/coverage-summary.json, subtracts a 2% slop, rounds down,
// and writes the four numbers back into the thresholds block of
// `vite.config.ts`. The slop leaves room for legitimate noise without
// failing CI on a fresh run.

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const SUMMARY = join(ROOT, 'coverage', 'coverage-summary.json');
const CONFIG = join(ROOT, 'vite.config.ts');
const SLOP_PERCENT = 2;

let summary;
try {
  summary = JSON.parse(readFileSync(SUMMARY, 'utf8'));
} catch (err) {
  console.error(`Cannot read ${SUMMARY}: ${err.message}`);
  console.error('Run `pnpm test:coverage` first to produce the summary file.');
  process.exit(2);
}

const total = summary.total;
if (!total) {
  console.error('coverage-summary.json has no `total` section.');
  process.exit(2);
}

const floor = (kind) => {
  const pct = total[kind]?.pct ?? 0;
  return Math.max(0, Math.floor(pct - SLOP_PERCENT));
};

const next = {
  lines: floor('lines'),
  statements: floor('statements'),
  functions: floor('functions'),
  branches: floor('branches'),
};

console.log('Measured coverage:');
for (const k of Object.keys(next)) {
  console.log(`  ${k.padEnd(11)} ${total[k]?.pct?.toFixed(1)}%  →  threshold ${next[k]}%`);
}

const config = readFileSync(CONFIG, 'utf8');
const re = /thresholds:\s*\{[\s\S]*?\n\s*\}/;
const match = re.exec(config);
if (!match) {
  console.error('Could not find a `thresholds: { ... }` block in vite.config.ts.');
  process.exit(3);
}

const replacement = `thresholds: {
        lines: ${next.lines},
        statements: ${next.statements},
        functions: ${next.functions},
        branches: ${next.branches},
      }`;

const updated = config.replace(re, replacement);
if (updated === config) {
  console.log('Thresholds already match the measured floor — nothing to update.');
  process.exit(0);
}

writeFileSync(CONFIG, updated);
console.log('\nUpdated vite.config.ts. Commit the change.');
