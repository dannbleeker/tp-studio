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
 * Threshold rationale (25%): a single CI run carries real variance —
 * GC pause timing, runner host load, V8 JIT warmup. The Session 131
 * perf-trace report measured 24% improvement on one metric and "flat
 * within noise" on another, which suggests noise ≈ 10-15% in normal
 * conditions. 25% catches real 2-3x regressions while staying above
 * the noise floor.
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
  console.log(`  Threshold: > ${threshold}% slower than baseline triggers a fail.`);
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
    const deltaPct = ((p95 - baselineP95) / baselineP95) * 100;
    const status = deltaPct > threshold ? 'FAIL' : deltaPct > threshold / 2 ? 'WARN' : 'OK';

    const line = `  ${status === 'FAIL' ? '✘' : status === 'WARN' ? '~' : '✓'} ${scenario.padEnd(14)} p95 ${fmt(p95, baselineP95)}`;
    console.log(line);

    if (status === 'FAIL') {
      regressions.push({ scenario, baselineP95, p95, deltaPct });
    }
  }

  if (regressions.length > 0) {
    console.log('');
    console.log(`✘ ${regressions.length} regression(s) exceeded the ${threshold}% threshold:`);
    for (const r of regressions) {
      console.log(
        `    ${r.scenario}: p95 ${r.p95.toFixed(2)} ms (baseline ${r.baselineP95.toFixed(2)} ms, +${r.deltaPct.toFixed(1)}%)`
      );
    }
    console.log('');
    console.log(
      `If this regression is intentional, update perf-baseline.json in the same commit.`
    );
    process.exit(1);
  }

  console.log('');
  console.log(`✓ No scenarios regressed beyond the threshold.`);
};

main().catch((err) => {
  console.error('Unexpected error:', err);
  process.exit(2);
});
