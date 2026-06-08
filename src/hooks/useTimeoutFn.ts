import { useCallback, useEffect, useRef } from 'react';

/**
 * Returns a stable `setTimer(fn, ms)` that schedules `fn` after `ms`, cancelling
 * any timer it previously scheduled. The pending timer is also cleared on
 * unmount, so a late callback never runs against a torn-down component.
 *
 * A one-shot timer firing `setState` after unmount is a no-op under React 18, but
 * the timer itself is a real (if short-lived) leak until it fires — this closes
 * that window and makes "re-arm cancels the prior timer" the default, which is
 * what every "show a transient state for N ms" caller actually wants.
 */
export const useTimeoutFn = (): ((fn: () => void, ms: number) => void) => {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    []
  );
  return useCallback((fn: () => void, ms: number) => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(fn, ms);
  }, []);
};
