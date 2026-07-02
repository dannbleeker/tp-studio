import { renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useThemeClass } from '@/hooks/useThemeClass';
import { prefersReducedMotion } from '@/services/prefersReducedMotion';
import { resetStoreForTest, useDocumentStore } from '@/store';

/**
 * Reduced-motion accessibility. CSS transitions honour the OS setting via the
 * `@media (prefers-reduced-motion: reduce)` override on `--anim-speed`; the
 * only JS moving part is (a) the `prefersReducedMotion()` helper that gates
 * React Flow's `fitView` durations, and (b) `useThemeClass` leaving
 * `--anim-speed` to CSS on the default speed so that media query can win.
 */

const stubMatchMedia = (reduce: boolean) => {
  vi.stubGlobal(
    'matchMedia',
    (query: string) =>
      ({
        matches: query.includes('reduce') ? reduce : false,
        media: query,
        onchange: null,
        addEventListener() {},
        removeEventListener() {},
        addListener() {},
        removeListener() {},
        dispatchEvent() {
          return false;
        },
      }) as unknown as MediaQueryList
  );
};

describe('prefersReducedMotion', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('reflects the OS reduce-motion media query', () => {
    stubMatchMedia(true);
    expect(prefersReducedMotion()).toBe(true);
    stubMatchMedia(false);
    expect(prefersReducedMotion()).toBe(false);
  });
});

describe('useThemeClass — animation speed / reduced motion', () => {
  beforeEach(resetStoreForTest);
  afterEach(() => {
    document.documentElement.style.removeProperty('--anim-speed');
  });

  it('leaves --anim-speed to CSS on the default speed so the reduce-motion query can win', () => {
    useDocumentStore.getState().setAnimationSpeed('default');
    renderHook(() => useThemeClass());
    // No inline override → the CSS :root value and the @media reduce override govern.
    expect(document.documentElement.style.getPropertyValue('--anim-speed')).toBe('');
  });

  it('writes an inline --anim-speed override for an explicit non-default speed', () => {
    useDocumentStore.getState().setAnimationSpeed('instant');
    renderHook(() => useThemeClass());
    expect(document.documentElement.style.getPropertyValue('--anim-speed')).toBe('0');
  });
});
