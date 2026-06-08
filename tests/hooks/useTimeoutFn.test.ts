import { renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useTimeoutFn } from '@/hooks/useTimeoutFn';

describe('useTimeoutFn', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('runs the callback after the delay', () => {
    const fn = vi.fn();
    const { result } = renderHook(() => useTimeoutFn());
    result.current(fn, 1000);
    expect(fn).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1000);
    expect(fn).toHaveBeenCalledOnce();
  });

  it('re-arming cancels the prior pending callback', () => {
    const first = vi.fn();
    const second = vi.fn();
    const { result } = renderHook(() => useTimeoutFn());
    result.current(first, 1000);
    result.current(second, 1000); // cancels `first`
    vi.advanceTimersByTime(1000);
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledOnce();
  });

  it('cancels a pending callback on unmount (no late fire against a torn-down component)', () => {
    const fn = vi.fn();
    const { result, unmount } = renderHook(() => useTimeoutFn());
    result.current(fn, 1000);
    unmount();
    vi.advanceTimersByTime(1000);
    expect(fn).not.toHaveBeenCalled();
  });
});
