/**
 * True when the OS "reduce motion" accessibility setting is on.
 *
 * CSS transitions honour reduced-motion automatically via the
 * `@media (prefers-reduced-motion: reduce)` override on `--anim-speed` (see
 * `styles/index.css`), but JS-driven animation durations — React Flow's
 * `fitView({ duration })` in particular — bypass CSS entirely, so those call
 * sites read this helper and pass `0` when it returns true.
 *
 * Guarded for non-browser / test environments where `matchMedia` is absent.
 */
export const prefersReducedMotion = (): boolean =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;
