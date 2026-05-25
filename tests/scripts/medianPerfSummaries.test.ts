import { describe, expect, it } from 'vitest';
// @ts-expect-error — .mjs ESM module without a .d.ts; tested for behaviour.
import { median, medianSummary } from '../../scripts/median-perf-summaries.mjs';

/**
 * Session 135 — guards for the median-of-N perf-trace aggregator. The
 * full disk round-trip is exercised by the Perf-trace workflow; this
 * suite locks the pure-function contract: numeric leaves are medianed,
 * composite leaves fall through to the first sample, and the canonical
 * `_samples` annotation surfaces every iteration's p95/p99 so a
 * borderline gate trip is debuggable from the workflow log alone.
 */

const buildSummary = (overrides: {
  p95: number;
  p99: number;
  events?: number;
  count?: number;
}) => ({
  scenario: 'all-actions',
  events: overrides.events ?? 3000,
  totals_ms: { scripting: 100, layout: 20, paint: 5 },
  scripting_percentiles: {
    p50_ms: 0.02,
    p75_ms: 0.05,
    p95_ms: overrides.p95,
    p99_ms: overrides.p99,
    max_ms: 200,
    count: overrides.count ?? 3500,
  },
  long_tasks: { count_over_50ms: 1, total_ms: 60, items: [{ ms: 60 }] },
  hottest_events: { by_count: [], by_time: [] },
  trace_path: 'perf-trace-output/perf-trace-all-actions.json',
  trace_size_kb: 1000,
});

describe('median (utility)', () => {
  it('returns the middle value for odd-length input', () => {
    expect(median([3, 1, 2])).toBe(2);
  });

  it('averages the two middle values for even-length input', () => {
    expect(median([1, 2, 3, 4])).toBe(2.5);
  });

  it('is order-independent', () => {
    expect(median([9, 1, 5])).toBe(5);
  });
});

describe('medianSummary — perf-trace aggregation', () => {
  it("medians the gate-driving percentile (the noisy run's outlier is outvoted)", () => {
    const merged = medianSummary([
      buildSummary({ p95: 8.12, p99: 35.0 }), // noisy high run (failed gate)
      buildSummary({ p95: 3.15, p99: 33.5 }), // noisy low rerun
      buildSummary({ p95: 6.4, p99: 34.0 }), // a "real" middle measurement
    ]);
    // Median of {3.15, 6.40, 8.12} = 6.40 — well within the 25% gate vs 6.45 baseline.
    expect(merged.scripting_percentiles.p95_ms).toBe(6.4);
    expect(merged.scripting_percentiles.p99_ms).toBe(34);
  });

  it('annotates the median with _median_of_n and per-iteration _samples', () => {
    const merged = medianSummary([
      buildSummary({ p95: 5, p99: 30, events: 3000 }),
      buildSummary({ p95: 7, p99: 32, events: 3200 }),
      buildSummary({ p95: 6, p99: 31, events: 3100 }),
    ]);
    expect(merged._median_of_n).toBe(3);
    expect(merged._samples).toEqual([
      { p95_ms: 5, p99_ms: 30, events: 3000 },
      { p95_ms: 7, p99_ms: 32, events: 3200 },
      { p95_ms: 6, p99_ms: 31, events: 3100 },
    ]);
  });

  it('medians long_tasks count + total, keeping items[] from the first sample', () => {
    const a = buildSummary({ p95: 5, p99: 30 });
    a.long_tasks = { count_over_50ms: 1, total_ms: 60, items: [{ ms: 60 }] };
    const b = buildSummary({ p95: 6, p99: 31 });
    b.long_tasks = { count_over_50ms: 3, total_ms: 200, items: [{ ms: 90 }, { ms: 110 }] };
    const c = buildSummary({ p95: 7, p99: 32 });
    c.long_tasks = { count_over_50ms: 5, total_ms: 320, items: [{ ms: 100 }] };
    const merged = medianSummary([a, b, c]);
    expect(merged.long_tasks.count_over_50ms).toBe(3);
    expect(merged.long_tasks.total_ms).toBe(200);
    // First-sample fall-through for the composite items array.
    expect(merged.long_tasks.items).toEqual([{ ms: 60 }]);
  });

  it('takes the first sample for non-numeric leaves (scenario, trace_path)', () => {
    const merged = medianSummary([
      buildSummary({ p95: 5, p99: 30 }),
      buildSummary({ p95: 6, p99: 31 }),
    ]);
    expect(merged.scenario).toBe('all-actions');
    expect(merged.trace_path).toBe('perf-trace-output/perf-trace-all-actions.json');
  });
});
