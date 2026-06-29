#!/usr/bin/env node
// scripts/mutation-score.mjs
// -----------------------------------------------------------------------------
// Distills the large (gitignored) Stryker report at reports/mutation/mutation.json
// into a tiny reports/mutation/score.json that the stats pipeline + dashboard read:
//
//   { "mutationScore": 77.59, "mutants": 58, "scope": "...", "generatedAt": "..." }
//
// Run after Stryker (in .github/workflows/mutation.yml, and locally to seed). Only
// this ~100-byte summary is committed — never the multi-hundred-KB full report.
//
// Dependency-free. Usage: node scripts/mutation-score.mjs ["<scope label>"]
// -----------------------------------------------------------------------------

import { existsSync, readFileSync, writeFileSync } from 'node:fs';

const REPORT = 'reports/mutation/mutation.json';
const OUT = 'reports/mutation/score.json';

if (!existsSync(REPORT)) {
  console.error(`No ${REPORT} found — run Stryker (stryker.mutation.config.mjs) first.`);
  process.exit(1);
}

const r = JSON.parse(readFileSync(REPORT, 'utf8'));
let killed = 0;
let total = 0;
for (const f of Object.values(r.files ?? {})) {
  for (const m of f.mutants ?? []) {
    // Match Stryker's mutation-score denominator: Ignored / CompileError /
    // RuntimeError mutants are excluded; NoCoverage counts against the score.
    if (m.status === 'Ignored' || m.status === 'CompileError' || m.status === 'RuntimeError') {
      continue;
    }
    total++;
    if (m.status === 'Killed' || m.status === 'Timeout') killed++;
  }
}

const out = {
  mutationScore: total > 0 ? Math.round((killed / total) * 10000) / 100 : null,
  mutants: total,
  scope: process.argv[2] ?? 'src/domain/validators',
  generatedAt: new Date().toISOString(),
};

writeFileSync(OUT, `${JSON.stringify(out, null, 2)}\n`);
console.log(`Wrote ${OUT} —`, JSON.stringify(out));
