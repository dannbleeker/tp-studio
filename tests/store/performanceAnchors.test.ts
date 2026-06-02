import { beforeEach, describe, expect, it } from 'vitest';
import { exportToJSON, importFromJSON } from '@/domain/persistence';
import { resetStoreForTest, useDocumentStore } from '@/store';

beforeEach(resetStoreForTest);

const s = () => useDocumentStore.getState();

/**
 * Phase 3 (TP completeness #5 — gap-analysis performance anchors) —
 * `setPerformanceLow` / `setPerformanceHigh`. Mirror the `setCloudType` shape:
 * persist a chosen value; treat a blank value as the implicit clear (drop the
 * field) so an untouched doc round-trips unchanged. Diagram-agnostic.
 */
describe('setPerformanceLow / setPerformanceHigh', () => {
  it('default to undefined on a fresh doc', () => {
    expect(s().doc.performanceLow).toBeUndefined();
    expect(s().doc.performanceHigh).toBeUndefined();
  });

  it('persist the anchors on the doc', () => {
    s().setPerformanceLow('On-time delivery at 60%');
    s().setPerformanceHigh('98% within two quarters');
    expect(s().doc.performanceLow).toBe('On-time delivery at 60%');
    expect(s().doc.performanceHigh).toBe('98% within two quarters');
  });

  it('clear the field when set to blank / whitespace', () => {
    s().setPerformanceLow('something');
    expect(s().doc.performanceLow).toBe('something');
    s().setPerformanceLow('   ');
    expect(s().doc.performanceLow).toBeUndefined();
  });

  it('is a no-op when the value is unchanged', () => {
    s().setPerformanceHigh('target');
    const before = s().doc;
    s().setPerformanceHigh('target');
    expect(s().doc).toBe(before);
  });

  it('is a no-op when clearing an already-empty field', () => {
    const before = s().doc;
    s().setPerformanceLow('');
    expect(s().doc).toBe(before);
  });
});

describe('performance anchors — JSON round-trip', () => {
  it('preserves both anchors through export → import', () => {
    s().setPerformanceLow('Low note');
    s().setPerformanceHigh('High note');
    const restored = importFromJSON(exportToJSON(s().doc));
    expect(restored.performanceLow).toBe('Low note');
    expect(restored.performanceHigh).toBe('High note');
  });

  it('omits unset anchors from a clean doc on round-trip', () => {
    const restored = importFromJSON(exportToJSON(s().doc));
    expect(restored.performanceLow).toBeUndefined();
    expect(restored.performanceHigh).toBeUndefined();
    expect('performanceLow' in restored).toBe(false);
  });

  it('drops a blank or non-string anchor on import (soft validation)', () => {
    const base = JSON.parse(exportToJSON(s().doc));
    const hostile = importFromJSON(
      JSON.stringify({ ...base, performanceLow: '   ', performanceHigh: 42 })
    );
    expect(hostile.performanceLow).toBeUndefined();
    expect(hostile.performanceHigh).toBeUndefined();
  });
});
