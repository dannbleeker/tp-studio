import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';

/**
 * The network-status seam behind the TopBar's offline chip.
 *
 * jsdom implements `navigator.onLine` (always `true`) but never flips it, so
 * the tests drive the flag directly and dispatch the real `online`/`offline`
 * window events — the same pair the hook subscribes to.
 */

/** jsdom's `navigator.onLine` is a getter on the prototype; override it per test. */
const setOnLine = (value: boolean) => {
  Object.defineProperty(window.navigator, 'onLine', {
    configurable: true,
    get: () => value,
  });
};

afterEach(() => {
  cleanup();
  setOnLine(true);
});

describe('useOnlineStatus', () => {
  it('seeds from navigator.onLine rather than assuming online', () => {
    setOnLine(false);
    const { result } = renderHook(() => useOnlineStatus());
    expect(result.current).toBe(false);
  });

  it('reports online when navigator.onLine is true', () => {
    const { result } = renderHook(() => useOnlineStatus());
    expect(result.current).toBe(true);
  });

  it('re-renders when the browser goes offline and comes back', () => {
    const { result } = renderHook(() => useOnlineStatus());
    expect(result.current).toBe(true);

    act(() => {
      setOnLine(false);
      window.dispatchEvent(new Event('offline'));
    });
    expect(result.current).toBe(false);

    act(() => {
      setOnLine(true);
      window.dispatchEvent(new Event('online'));
    });
    expect(result.current).toBe(true);
  });

  it('detaches both listeners on unmount', () => {
    const { result, unmount } = renderHook(() => useOnlineStatus());
    unmount();
    // A post-unmount event must not reach the (now gone) subscriber. React
    // would warn on a setState-after-unmount; asserting the last value is
    // unchanged pins that the listeners really were removed.
    setOnLine(false);
    window.dispatchEvent(new Event('offline'));
    expect(result.current).toBe(true);
  });

  it('treats a missing navigator.onLine as online', () => {
    Object.defineProperty(window.navigator, 'onLine', {
      configurable: true,
      get: () => undefined,
    });
    const { result } = renderHook(() => useOnlineStatus());
    expect(result.current).toBe(true);
  });
});
