// scripts/preflight.mjs
//
// Session 180 — the local pre-push gate, AppLocker-safe.
//
// Mirrors what CI runs (`pnpm verify` + the bundle-size job) but invokes every
// tool through its NODE entry point, because the corporate AppLocker box blocks
// the native `.exe` shims (`biome.exe`, the bundled Playwright Chromium, …) that
// `pnpm <script>` would call. Run this before every push so CI is a
// confirmation, not a discovery — the two red-CI rounds that shipped E6 happened
// because the gate was run piecemeal (tsc + vitest, but not biome + bundle-size).
//
//   node scripts/preflight.mjs          # full gate (~3 min)
//   node scripts/preflight.mjs --fast   # static checks only (tsc + biome + knip, ~15s)
//
// Fail-fast: stops at the first failing step and exits non-zero, printing the
// fix command where there is one. biome runs in CHECK mode (no --write) so this
// stays a faithful mirror of CI and never silently mutates the working tree — on
// a biome failure it tells you the one-liner to autofix, then re-run.
//
// cwd-independent: paths resolve from the script's own location, and every child
// runs with cwd = repo root, so it works no matter where it's invoked from.

import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const fast = process.argv.includes('--fast');

const STEPS = [
  { label: 'typecheck', argv: ['./node_modules/typescript/bin/tsc', '--noEmit'], fast: true },
  {
    label: 'biome',
    argv: ['./node_modules/@biomejs/biome/bin/biome', 'check', 'src', 'tests'],
    fast: true,
    fixHint:
      'node ./node_modules/@biomejs/biome/bin/biome check --write --unsafe src tests  (then re-run)',
  },
  { label: 'knip', argv: ['./node_modules/knip/bin/knip.js', '--no-progress'], fast: true },
  { label: 'vitest', argv: ['./node_modules/vitest/vitest.mjs', 'run'], fast: false },
  { label: 'build', argv: ['./node_modules/vite/bin/vite.js', 'build'], fast: false },
  {
    label: 'bundle-size',
    argv: ['./scripts/check-bundle-size.mjs'],
    fast: false,
    fixHint: 'a chunk exceeds bundle-budget.json + 10% slop — reduce it, or re-pin the budget deliberately',
  },
];

const steps = STEPS.filter((s) => !fast || s.fast);
const started = Date.now();

for (const step of steps) {
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
process.stdout.write(`\n✓ preflight green${fast ? ' (fast)' : ''} in ${total}s — safe to push.\n`);
