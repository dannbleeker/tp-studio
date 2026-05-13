import { useFingerprintMemo } from '@/hooks/useFingerprintMemo';
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

afterEach(cleanup);

/**
 * `useFingerprintMemo` keys `useMemo` off a single string fingerprint.
 * The contract:
 *   - Same fingerprint → memo returns the previous result without
 *     re-running the compute function.
 *   - Different fingerprint → compute re-runs and the new result is
 *     returned.
 *   - The compute function may close over anything; the hook's name
 *     advertises that the caller is responsible for capturing all
 *     read-state in the fingerprint string.
 */

describe('useFingerprintMemo', () => {
  it('returns the same result when the fingerprint is unchanged', () => {
    const compute = vi.fn(() => ({ value: Math.random() }));
    const { result, rerender } = renderHook(
      ({ fp }: { fp: string }) => useFingerprintMemo(compute, fp),
      { initialProps: { fp: 'v1' } }
    );
    const first = result.current;
    rerender({ fp: 'v1' });
    expect(result.current).toBe(first);
    // The compute function ran exactly once.
    expect(compute).toHaveBeenCalledTimes(1);
  });

  it('recomputes when the fingerprint changes', () => {
    const compute = vi.fn(() => ({}));
    const { result, rerender } = renderHook(
      ({ fp }: { fp: string }) => useFingerprintMemo(compute, fp),
      { initialProps: { fp: 'v1' } }
    );
    const first = result.current;
    rerender({ fp: 'v2' });
    expect(result.current).not.toBe(first);
    expect(compute).toHaveBeenCalledTimes(2);
  });

  it('does NOT recompute when a closed-over value changes but the fingerprint does not', () => {
    // This is the explicit contract — the hook intentionally lets the
    // caller capture all relevant state in the fingerprint. Anything
    // not in the fingerprint is invisible.
    let captured = 1;
    const compute = vi.fn(() => captured);
    const { result, rerender } = renderHook(
      ({ fp }: { fp: string }) => useFingerprintMemo(compute, fp),
      { initialProps: { fp: 'v1' } }
    );
    expect(result.current).toBe(1);
    act(() => {
      captured = 2;
    });
    rerender({ fp: 'v1' });
    // Stale: compute didn't re-run because fp didn't change.
    expect(result.current).toBe(1);
    rerender({ fp: 'v2' });
    expect(result.current).toBe(2);
  });
});
