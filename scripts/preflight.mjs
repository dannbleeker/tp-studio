// scripts/preflight.mjs
//
// Session 180 — the local pre-push gate, AppLocker-safe.
//
// Invokes every tool through its NODE entry point, because the corporate
// AppLocker box blocks the native `.exe` shims (`biome.exe`, …) that
// `pnpm <script>` calls. Run before every push so CI is a confirmation,
// not a discovery (the two red-CI rounds shipping E6 came from running the
// gate piecemeal and skipping biome + bundle-size).
//
//   node scripts/preflight.mjs              # default gate (~3 min)
//   node scripts/preflight.mjs --fast       # static checks only (tsc + biome + knip, ~15s)
//   node scripts/preflight.mjs --coverage   # vitest WITH coverage (matches CI's gated thresholds)
//   node scripts/preflight.mjs --e2e        # also run the Playwright smoke suite
//
// What the DEFAULT run mirrors: CI's `lint-types` job (tsc + biome + knip) and
// most of `tests-build` (vitest + build + bundle-size). Two things it does NOT
// cover by default, so green here is NOT a full guarantee of green CI:
//   • coverage thresholds — CI's test step is `vitest --coverage`; add `--coverage`.
//   • the Playwright `e2e` job — add `--e2e` (best-effort locally on bundled
//     Chromium; CI's e2e job is authoritative).
//
// Fail-fast: stops at the first failing step. biome runs in CHECK mode (no
// --write) so it never silently mutates the tree — on a failure it prints the
// autofix one-liner. cwd-independent: children run with cwd = repo root.

import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const has = (flag) => process.argv.includes(flag);
const fast = has('--fast');
const withCoverage = has('--coverage');
const withE2e = has('--e2e');

const steps = [
  { label: 'typecheck', argv: ['./node_modules/typescript/bin/tsc', '--noEmit'], fast: true },
  {
    label: 'biome',
    argv: ['./node_modules/@biomejs/biome/bin/biome', 'check', 'src', 'tests'],
    fast: true,
    fixHint:
      'node ./node_modules/@biomejs/biome/bin/biome check --write --unsafe src tests  (then re-run)',
  },
  { label: 'knip', argv: ['./node_modules/knip/bin/knip.js', '--no-progress'], fast: true },
  {
    label: withCoverage ? 'vitest (coverage)' : 'vitest',
    argv: ['./node_modules/vitest/vitest.mjs', 'run', ...(withCoverage ? ['--coverage'] : [])],
    fast: false,
  },
  { label: 'build', argv: ['./node_modules/vite/bin/vite.js', 'build'], fast: false },
  {
    label: 'bundle-size',
    argv: ['./scripts/check-bundle-size.mjs'],
    fast: false,
    fixHint: 'a chunk exceeds bundle-budget.json + 10% slop — reduce it, or re-pin the budget deliberately',
  },
];

if (withE2e) {
  steps.push({
    label: 'e2e (playwright)',
    argv: ['./node_modules/@playwright/test/cli.js', 'test'],
    fast: false,
    fixHint: "e2e is best-effort locally (bundled Chromium); CI's e2e job is authoritative",
  });
}

const selected = steps.filter((s) => !fast || s.fast);
const started = Date.now();

for (const step of selected) {
  process.stdout.write(`\n▶ ${step.label}\n`);
  const t = Date.now();
  const { status } = spawnSync(process.execPath, step.argv, { stdio: 'inherit', cwd: root });
  const secs = ((Date.now() - t) / 1000).toFixed(0);
  if (status !== 0) {
    process.stdout.write(`\n✗ preflight failed at "${step.label}" (exit ${status ?? 'signal'}, ${secs}s).\n`);
    if (step.fixHint) process.stdout.write(`  fix: ${step.fixHint}\n`);
    process.stdout.write('  Fix it before pushing.\n');
    process.exit(typeof status === 'number' ? status : 1);
  }
  process.stdout.write(`✓ ${step.label} (${secs}s)\n`);
}

const total = ((Date.now() - started) / 1000).toFixed(0);
const extra = [withCoverage && 'coverage', withE2e && 'e2e'].filter(Boolean).join(' + ');
process.stdout.write(
  `\n✓ preflight green${fast ? ' (fast)' : ''}${extra ? ` (+${extra})` : ''} in ${total}s — safe to push.\n`
);
