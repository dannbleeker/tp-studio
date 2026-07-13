#!/usr/bin/env node
/**
 * Session 132 / Tier 3 #12 — perf-trace regression check.
 *
 * Reads the per-scenario summary JSONs the `perf-trace.spec.ts` writes
 * under `perf-trace-output/perf-trace-<scenario>-summary.json`, compares
 * each scenario's measured `scripting_percentiles.p95_ms` against the
 * baseline at `perf-baseline.json` at repo root, and exits non-zero if
 * any scenario regressed by more than `regressionThresholdPct`.
 *
 * Wired into the `Perf trace` workflow (`.github/workflows/perf-trace.yml`)
 * as a post-capture step, and runs on a weekly schedule so drift
 * surfaces without anyone remembering to push the button.
 *
 * Updating the baseline:
 *   1. Run `pnpm exec playwright test e2e/perf-trace.spec.ts` (or
 *      trigger the workflow_dispatch) with the new code.
 *   2. Read the printed `p95_ms` per scenario.
 *   3. Update `perf-baseline.json` in the same commit that introduces
 *      the deliberate perf change. The diff is the audit trail.
 *
 * Threshold rationale: the default `regressionThresholdPct` (25%) covers a
 * single run's variance — GC pause timing, runner host load, V8 JIT warmup —
 * while still catching real 2-3x regressions. A scenario may override it with
 * its own `thresholdPct` (see `scenarioThreshold`): `edit-heavy`'s variance is
 * BETWEEN runner hosts, not within a run, which median-of-N can't shrink, so it
 * carries a wider (35%) gate without loosening the others.
 */

import { readFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = resolve(HERE, '..');
const BASELINE_PATH = join(PROJECT_ROOT, 'perf-baseline.json');
const TRACE_DIR = join(PROJECT_ROOT, 'perf-trace-output');

/**
 * @typedef {{ p95_ms: number, p99_ms: number }} BaselineScenario
 * @typedef {{ regressionThresholdPct: number, scenarios: Record<string, BaselineScenario> }} Baseline
 */

const loadJson = async (path) => JSON.parse(await readFile(path, 'utf8'));

/**
 * The regression threshold for a scenario: its own `thresholdPct` when set to a
 * positive number, else the baseline's global `regressionThresholdPct`. This lets
 * a scenario with an irreducible noise floor carry a wider gate without loosening
 * the others — `edit-heavy`'s residual variance is BETWEEN runner hosts (its three
 * within-run samples are near-identical), which median-of-N can't shrink, so it
 * gets a per-scenario threshold covering that host-to-host floor. Exported for
 * unit testing.
 */
export const scenarioThreshold = (scenarioBaseline, globalThreshold) =>
  typeof scenarioBaseline?.thresholdPct === 'number' && scenarioBaseline.thresholdPct > 0
    ? scenarioBaseline.thresholdPct
    : globalThreshold;

/** Format a delta as `+N.NN% (was X → Y)` so the log line reads naturally. */
const fmt = (current, baseline) => {
  const deltaPct = ((current - baseline) / baseline) * 100;
  const sign = deltaPct >= 0 ? '+' : '';
  return `${sign}${deltaPct.toFixed(1)}% (was ${baseline.toFixed(2)} → ${current.toFixed(2)})`;
};

const main = async () => {
  /** @type {Baseline} */
  const baseline = await loadJson(BASELINE_PATH);
  const threshold = baseline.regressionThresholdPct;
  if (typeof threshold !== 'number' || threshold <= 0) {
    console.error(`Baseline is missing regressionThresholdPct or it's not positive.`);
    process.exit(2);
  }

  console.log(`Perf-trace regression check`);
  console.log(`  Baseline: ${BASELINE_PATH}`);
  console.log(
    `  Default threshold: > ${threshold}% slower than baseline fails (per-scenario overrides apply).`
  );
  console.log('');

  const regressions = [];
  const summaries = [];

  for (const [scenario, baselineScenario] of Object.entries(baseline.scenarios)) {
    if (scenario.startsWith('_')) continue;
    const summaryPath = join(TRACE_DIR, `perf-trace-${scenario}-summary.json`);
    let summary;
    try {
      summary = await loadJson(summaryPath);
    } catch (e) {
      console.error(`✘ ${scenario}: no summary at ${summaryPath} (${e.message})`);
      process.exit(2);
    }
    summaries.push({ scenario, summary });

    const p95 = summary?.scripting_percentiles?.p95_ms;
    if (typeof p95 !== 'number') {
      console.error(`✘ ${scenario}: summary missing scripting_percentiles.p95_ms`);
      process.exit(2);
    }
    const baselineP95 = baselineScenario.p95_ms;
    const scenThreshold = scenarioThreshold(baselineScenario, threshold);
    const deltaPct = ((p95 - baselineP95) / baselineP95) * 100;
    const status = deltaPct > scenThreshold ? 'FAIL' : deltaPct > scenThreshold / 2 ? 'WARN' : 'OK';

    const thrTag = scenThreshold === threshold ? '' : ` [thr ${scenThreshold}%]`;
    const line = `  ${status === 'FAIL' ? '✘' : status === 'WARN' ? '~' : '✓'} ${scenario.padEnd(14)} p95 ${fmt(p95, baselineP95)}${thrTag}`;
    console.log(line);

    if (status === 'FAIL') {
      regressions.push({ scenario, baselineP95, p95, deltaPct, threshold: scenThreshold });
    }
  }

  if (regressions.length > 0) {
    console.log('');
    console.log(`✘ ${regressions.length} regression(s) exceeded their threshold:`);
    for (const r of regressions) {
      console.log(
        `    ${r.scenario}: p95 ${r.p95.toFixed(2)} ms (baseline ${r.baselineP95.toFixed(2)} ms, +${r.deltaPct.toFixed(1)}%, threshold ${r.threshold}%)`
      );
    }
    console.log('');
    console.log(`If this regression is intentional, update perf-baseline.json in the same commit.`);
    process.exit(1);
  }

  console.log('');
  console.log(`✓ No scenarios regressed beyond the threshold.`);
};

// Canonical ESM "is this the entrypoint?" gate — run `main` only when invoked
// directly by node, so a unit test can import `scenarioThreshold` without the
// script reading files / calling process.exit.
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((err) => {
    console.error('Unexpected error:', err);
    process.exit(2);
  });
}
