/**
 * @vitest-environment jsdom
 */
import { useThemeClass } from '@/hooks/useThemeClass';
import { resetStoreForTest, useDocumentStore } from '@/store';
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

beforeEach(() => {
  resetStoreForTest();
  // Clean slate on <html> for each case.
  document.documentElement.className = '';
});

afterEach(() => {
  document.documentElement.className = '';
});

describe('FL-TO1 — theme variant CSS class application', () => {
  it('applies .dark + .theme-rust when theme is "rust"', () => {
    renderHook(() => useThemeClass());
    act(() => useDocumentStore.getState().setTheme('rust'));
    const root = document.documentElement;
    expect(root.classList.contains('dark')).toBe(true);
    expect(root.classList.contains('theme-rust')).toBe(true);
  });

  it('swaps variant class cleanly when theme changes', () => {
    renderHook(() => useThemeClass());
    act(() => useDocumentStore.getState().setTheme('rust'));
    act(() => useDocumentStore.getState().setTheme('navy'));
    const root = document.documentElement;
    expect(root.classList.contains('theme-rust')).toBe(false);
    expect(root.classList.contains('theme-navy')).toBe(true);
    expect(root.classList.contains('dark')).toBe(true);
  });

  it('removes all variant classes when theme is "light"', () => {
    renderHook(() => useThemeClass());
    act(() => useDocumentStore.getState().setTheme('coal'));
    act(() => useDocumentStore.getState().setTheme('light'));
    const root = document.documentElement;
    expect(root.classList.contains('dark')).toBe(false);
    expect(root.classList.contains('theme-coal')).toBe(false);
    expect(root.classList.contains('theme-rust')).toBe(false);
    expect(root.classList.contains('theme-navy')).toBe(false);
    expect(root.classList.contains('theme-ayu')).toBe(false);
    expect(root.classList.contains('theme-hc')).toBe(false);
  });

  it('rust / coal / navy / ayu all keep .dark applied', () => {
    renderHook(() => useThemeClass());
    for (const theme of ['rust', 'coal', 'navy', 'ayu'] as const) {
      act(() => useDocumentStore.getState().setTheme(theme));
      expect(document.documentElement.classList.contains('dark')).toBe(true);
      expect(document.documentElement.classList.contains(`theme-${theme}`)).toBe(true);
    }
  });

  it('highContrast layers theme-hc on .dark and clears the named variants', () => {
    renderHook(() => useThemeClass());
    act(() => useDocumentStore.getState().setTheme('rust'));
    act(() => useDocumentStore.getState().setTheme('highContrast'));
    const root = document.documentElement;
    expect(root.classList.contains('dark')).toBe(true);
    expect(root.classList.contains('theme-hc')).toBe(true);
    expect(root.classList.contains('theme-rust')).toBe(false);
  });
});
