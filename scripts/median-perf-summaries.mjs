#!/usr/bin/env node
/**
 * Session 135 — median-of-N for the perf-trace cron.
 *
 * Background: single perf-trace runs swing dramatically on the CI runner
 * (one observed run measured `all-actions` p95 at 8.12 ms; the next, on
 * the same commit, measured 3.15 ms). The 25 % regression gate then
 * flips green↔red on the same code purely from runner noise.
 *
 * Fix: run the spec N times in the workflow, snapshot each iteration's
 * canonical `perf-trace-<scenario>-summary.json` to a numbered file
 * (`*-summary.1.json` … `*-summary.N.json`), then this script reads the
 * numbered set and writes a median summary back to the canonical path.
 * `check-perf-regression.mjs` then reads the median — vastly more stable
 * than any single iteration.
 *
 * Aggregation rules:
 *   - `scripting_percentiles.*` (p50/p75/p95/p99/max/count) → median.
 *   - `totals_ms.*` (scripting/layout/paint) → median.
 *   - `long_tasks.count_over_50ms`, `long_tasks.total_ms` → median.
 *   - `events`, `trace_size_kb` → median.
 *   - Composite fields (`long_tasks.items[]`, `hottest_events`) → take
 *     the first iteration's value. The regression gate doesn't read them
 *     and "median of a list of events" isn't well-defined; the artifact
 *     upload retains each iteration's full summary for forensics.
 *   - Strings (`scenario`, `trace_path`) → take the first.
 *
 * Plus a `_samples` array carrying every iteration's p95/p99 — visible
 * in the workflow log, useful when triaging a borderline gate trip.
 */

import { readdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');
const TRACE_DIR = join(ROOT, 'perf-trace-output');

/** Scenarios captured by `e2e/perf-trace.spec.ts`. Kept in sync with
 *  `perf-baseline.json` + the regression-checker. */
const SCENARIOS = ['all-actions', 'edit-heavy'];

/** Numeric median (averages the two middle values for even N).
 *  Exported for unit testing. */
export const median = (xs) => {
  if (xs.length === 0) return Number.NaN;
  const sorted = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
};

/** Round to two decimals — matches the spec's own toFixed(2). */
const round2 = (n) => +n.toFixed(2);

/**
 * Median across N summary objects. Walks the leaf paths we care about
 * (numeric percentiles, totals, long-task counts); composite fields
 * fall through to the first sample. Exported for unit testing.
 */
export const medianSummary = (summaries) => {
  const first = summaries[0];
  const result = { ...first };

  const medianAt = (path) => {
    const xs = summaries
      .map((s) => path.reduce((o, k) => o?.[k], s))
      .filter((v) => typeof v === 'number');
    if (xs.length === 0) return undefined;
    return round2(median(xs));
  };

  // scripting_percentiles — the gate-driving block.
  const sp = { ...first.scripting_percentiles };
  for (const k of Object.keys(sp)) {
    const v = medianAt(['scripting_percentiles', k]);
    if (v !== undefined) sp[k] = v;
  }
  result.scripting_percentiles = sp;

  // totals_ms
  const totals = { ...first.totals_ms };
  for (const k of Object.keys(totals)) {
    const v = medianAt(['totals_ms', k]);
    if (v !== undefined) totals[k] = v;
  }
  result.totals_ms = totals;

  // long_tasks (count + total; items[] kept from first sample)
  const lt = { ...first.long_tasks };
  const ltCount = medianAt(['long_tasks', 'count_over_50ms']);
  const ltTotal = medianAt(['long_tasks', 'total_ms']);
  if (ltCount !== undefined) lt.count_over_50ms = ltCount;
  if (ltTotal !== undefined) lt.total_ms = ltTotal;
  result.long_tasks = lt;

  // Top-level numerics.
  const ev = medianAt(['events']);
  const ts = medianAt(['trace_size_kb']);
  if (ev !== undefined) result.events = ev;
  if (ts !== undefined) result.trace_size_kb = ts;

  // Annotate the median so a future reader of the artifact knows what
  // they're looking at + can spot a noisy run.
  result._median_of_n = summaries.length;
  result._samples = summaries.map((s) => ({
    p95_ms: s.scripting_percentiles?.p95_ms,
    p99_ms: s.scripting_percentiles?.p99_ms,
    events: s.events,
  }));
  return result;
};

const main = async () => {
  let entries;
  try {
    entries = await readdir(TRACE_DIR);
  } catch (err) {
    console.error(`Cannot read ${TRACE_DIR}: ${err.message}`);
    process.exit(2);
  }

  let exitCode = 0;
  for (const scenario of SCENARIOS) {
    const prefix = `perf-trace-${scenario}-summary.`;
    const numbered = entries
      .filter(
        (f) => f.startsWith(prefix) && f.endsWith('.json') && f !== `${prefix.slice(0, -1)}.json` // exclude the canonical (this script's output)
      )
      .sort((a, b) => {
        // Sort by the numeric iteration suffix so the order in `_samples`
        // matches the iteration order in the workflow log.
        const n = (f) => +f.slice(prefix.length).replace(/\.json$/, '');
        return n(a) - n(b);
      });

    if (numbered.length === 0) {
      console.error(
        `No per-iteration summaries found for ${scenario} (looked for ${prefix}<N>.json).`
      );
      exitCode = 1;
      continue;
    }

    const summaries = [];
    for (const f of numbered) {
      const raw = await readFile(join(TRACE_DIR, f), 'utf8');
      summaries.push(JSON.parse(raw));
    }

    const merged = medianSummary(summaries);
    const outPath = join(TRACE_DIR, `perf-trace-${scenario}-summary.json`);
    await writeFile(outPath, JSON.stringify(merged, null, 2));

    const p95s = merged._samples.map((s) => s.p95_ms);
    console.log(
      `✓ ${scenario}: median-of-${numbered.length} → p95 ${merged.scripting_percentiles.p95_ms} ms ` +
        `(samples: ${p95s.join(', ')})`
    );
  }

  process.exit(exitCode);
};

// Canonical ESM "is this the entrypoint?" gate. When the file is
// imported (e.g. by the unit test) we don't run `main`; when invoked
// directly by node we do.
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  await main();
}
