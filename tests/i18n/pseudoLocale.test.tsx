import { cleanup, render } from '@testing-library/react';
import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { AppearanceTab } from '@/components/settings/tabs/AppearanceTab';
import { BehaviorTab } from '@/components/settings/tabs/BehaviorTab';
import { DisplayTab } from '@/components/settings/tabs/DisplayTab';
import { LayoutTab } from '@/components/settings/tabs/LayoutTab';
import { PSEUDO_PREFIX, PSEUDO_SUFFIX } from '@/i18n/pseudo';
import { isLocaleLoaded, peekMessages, preloadLocale } from '@/i18n/registry';
import { resetStoreForTest, useDocumentStore } from '@/store';

beforeEach(resetStoreForTest);
afterEach(cleanup);

/**
 * The pseudo-locale is how "did we miss a string?" becomes an assertion rather
 * than an eyeball exercise. Every catalogue value is bracket-wrapped, so any
 * text a converted surface renders WITHOUT brackets is a hardcoded literal
 * that never went through `useT`.
 */

/** Visible text nodes under `el`, trimmed, ignoring whitespace-only nodes. */
const visibleText = (el: HTMLElement): string[] => {
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  const out: string[] = [];
  let node = walker.nextNode();
  while (node) {
    const text = node.textContent?.trim() ?? '';
    if (text !== '') out.push(text);
    node = walker.nextNode();
  }
  return out;
};

describe('pseudo-locale', () => {
  it('loads lazily, and falls back to English until its chunk resolves', async () => {
    // The registry cache is module-level and survives `resetStoreForTest`, so
    // the un-loaded state is only observable here — before any sibling test
    // has asked for the locale. Both assertions live in one test for that
    // reason rather than splitting into an order-dependent pair.
    expect(isLocaleLoaded('pseudo')).toBe(false);
    // The synchronous snapshot `useT` reads during render: English, never a
    // blank or a raw key.
    expect(peekMessages('pseudo').settings.appearance.theme).toBe('Theme');

    await preloadLocale('pseudo');
    expect(isLocaleLoaded('pseudo')).toBe(true);
  });

  it('derives every string from English rather than duplicating the catalogue', async () => {
    await preloadLocale('pseudo');
    const messages = peekMessages('pseudo');
    expect(messages.settings.appearance.theme).toBe(`${PSEUDO_PREFIX}Theme${PSEUDO_SUFFIX}`);
    // Interpolated entries wrap their RESULT, so parameters stay readable.
    expect(messages.clr['clarity.too-long']({ limit: 25 })).toContain('25');
    expect(messages.clr['clarity.too-long']({ limit: 25 })).toContain(PSEUDO_PREFIX);
  });

  /**
   * Every converted Settings tab, each with the text it is ALLOWED to render
   * un-tagged. Keeping the allowances explicit and per-tab means a newly
   * hardcoded string fails the test rather than blending into a permissive
   * filter — the exceptions have to be argued for, one at a time.
   */
  const TABS: { name: string; render: () => ReturnType<typeof render>; allowed: string[] }[] = [
    {
      name: 'Appearance',
      render: () => render(<AppearanceTab />),
      // `LOCALE_LABEL` values are autonyms — a language names itself in its
      // own language — so these are deliberately not routed through the
      // catalogue.
      allowed: ['English'],
    },
    { name: 'Behavior', render: () => render(<BehaviorTab />), allowed: [] },
    { name: 'Display', render: () => render(<DisplayTab />), allowed: [] },
    { name: 'Layout', render: () => render(<LayoutTab />), allowed: [] },
  ];

  for (const tab of TABS) {
    it(`renders the ${tab.name} tab with no un-catalogued text`, async () => {
      await preloadLocale('pseudo');
      act(() => {
        useDocumentStore.getState().setLocale('pseudo');
      });

      const { container } = tab.render();
      const untagged = visibleText(container).filter(
        (text) =>
          !(text.startsWith(PSEUDO_PREFIX) && text.endsWith(PSEUDO_SUFFIX)) &&
          // Pure digits are values, not copy (the compactness slider readout).
          !/^\d+$/.test(text)
      );

      expect(untagged).toEqual(tab.allowed);
    });
  }
});
