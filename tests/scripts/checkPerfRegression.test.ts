import { describe, expect, it } from 'vitest';
// @ts-expect-error — .mjs ESM module without a .d.ts; tested for behaviour.
import { scenarioThreshold } from '../../scripts/check-perf-regression.mjs';

/**
 * Session 203 — per-scenario regression threshold. The perf-trace gate uses a
 * global `regressionThresholdPct` (25%) but lets a scenario override it with its
 * own `thresholdPct` — `edit-heavy`'s variance is between runner hosts (not
 * within a run), which median-of-N can't reduce, so it carries a wider gate
 * without loosening `all-actions`. This locks the fallback contract.
 */
describe('scenarioThreshold', () => {
  it('uses a positive per-scenario thresholdPct when present', () => {
    expect(scenarioThreshold({ p95_ms: 16.7, thresholdPct: 35 }, 25)).toBe(35);
  });

  it('falls back to the global threshold when no override is set', () => {
    expect(scenarioThreshold({ p95_ms: 6.45 }, 25)).toBe(25);
  });

  it('falls back for a non-number, zero, or negative override', () => {
    expect(scenarioThreshold({ thresholdPct: '35' }, 25)).toBe(25);
    expect(scenarioThreshold({ thresholdPct: 0 }, 25)).toBe(25);
    expect(scenarioThreshold({ thresholdPct: -10 }, 25)).toBe(25);
  });

  it('tolerates a missing/undefined scenario baseline', () => {
    expect(scenarioThreshold(undefined, 25)).toBe(25);
  });
});
