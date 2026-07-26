import { cleanup, render } from '@testing-library/react';
import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { AboutDialog } from '@/components/about/AboutDialog';
import { BlocksRail } from '@/components/canvas/BlocksRail';
import { DiagramTypePickerDialog } from '@/components/diagrams/DiagramTypePickerDialog';
import { HelpDialog } from '@/components/help/HelpDialog';
import { AnalysisJourneyDialog } from '@/components/journey/AnalysisJourneyDialog';
import { DocumentInspector } from '@/components/settings/DocumentInspector';
import { AppearanceTab } from '@/components/settings/tabs/AppearanceTab';
import { BehaviorTab } from '@/components/settings/tabs/BehaviorTab';
import { DisplayTab } from '@/components/settings/tabs/DisplayTab';
import { LayoutTab } from '@/components/settings/tabs/LayoutTab';
import { MethodStepper } from '@/components/toolbar/MethodStepper';
import { TitleBadge } from '@/components/toolbar/TitleBadge';
import { ENTITY_TYPE_META } from '@/domain/entityTypeMeta';
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

/**
 * Visible text nodes under `el`, trimmed, ignoring whitespace-only nodes.
 *
 * `<kbd>` content is skipped: it is keyboard input, not prose. Key combos are
 * built in `shortcuts.ts` from `${M}+K` (⌘ on macOS, Ctrl elsewhere) and match
 * what is printed on the user's keyboard, so they are deliberately outside the
 * catalogue. This is a semantic exemption for one element type — NOT a general
 * "hidden text doesn't count" rule, which would also have swallowed real copy
 * like TitleBadge's aria-hidden "· unsaved".
 */
const visibleText = (el: HTMLElement): string[] => {
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  const out: string[] = [];
  let node = walker.nextNode();
  while (node) {
    const text = node.textContent?.trim() ?? '';
    if (text !== '' && !node.parentElement?.closest('kbd')) out.push(text);
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
  const TABS: {
    name: string;
    render: () => ReturnType<typeof render>;
    allowed: string[];
    /**
     * Text sourced from a named, still-unconverted module, filtered out before
     * the `allowed` comparison. Derived from the module rather than transcribed
     * so the exception names its cause and cannot drift as that module is
     * edited — and so a string hardcoded in the COMPONENT still fails.
     */
    allowedFrom?: () => Set<string>;
  }[] = [
    {
      name: 'Appearance',
      render: () => render(<AppearanceTab />),
      // Was `['English']` — the `LOCALE_LABEL` autonym in the Language picker.
      // That row is hidden while `SELECTABLE_LOCALES` has a single entry, so
      // nothing un-catalogued renders here at all now.
      allowed: [],
    },
    { name: 'Behavior', render: () => render(<BehaviorTab />), allowed: [] },
    { name: 'Display', render: () => render(<DisplayTab />), allowed: [] },
    { name: 'Layout', render: () => render(<LayoutTab />), allowed: [] },
    {
      name: 'Document inspector',
      render: () => {
        act(() => useDocumentStore.getState().openDocSettings());
        return render(<DocumentInspector />);
      },
      allowed: [],
    },
    { name: 'Title badge', render: () => render(<TitleBadge />), allowed: [] },
    { name: 'Method stepper', render: () => render(<MethodStepper />), allowed: [] },
    {
      name: 'Help dialog',
      render: () => {
        act(() => useDocumentStore.getState().openHelp());
        return render(<HelpDialog />);
      },
      allowed: [],
    },
    {
      name: 'About dialog',
      render: () => {
        act(() => useDocumentStore.getState().openAbout());
        return render(<AboutDialog />);
      },
      allowed: [],
    },
    {
      name: 'Diagram type picker',
      render: () => {
        act(() => useDocumentStore.getState().openDiagramPicker('new'));
        return render(<DiagramTypePickerDialog />);
      },
      allowed: [],
    },
    {
      name: 'Building blocks rail',
      render: () => render(<BlocksRail />),
      allowed: [],
      // The rail's rows ARE `ENTITY_TYPE_META` — the built-in type labels and
      // their one-line meanings, which live in `src/domain/entityTypeMeta.ts`
      // and have not been moved to the catalogue yet (they are read by the
      // canvas, the inspector and two exporters, so they move as one piece).
      // Everything the rail itself renders — heading, subtitle, the add/usedIn
      // labels, the templates link — is asserted to be catalogued.
      allowedFrom: () =>
        new Set(
          Object.values(ENTITY_TYPE_META).flatMap((m) =>
            m.meaning ? [m.label, m.meaning] : [m.label]
          )
        ),
    },
    {
      name: 'Analysis journey dialog',
      render: () => {
        act(() => {
          useDocumentStore.getState().newDocument('crt');
          useDocumentStore.getState().openAnalysisJourney();
        });
        return render(<AnalysisJourneyDialog />);
      },
      allowed: [],
    },
  ];

  /*
   * Deliberately NOT covered here: `PatternLibraryDialog`. Its chrome goes
   * through the catalogue, but it also renders ~222 pattern titles and
   * descriptions that are parked outside it on purpose (see `docs/I18N.md`).
   * A text-level assertion would need those 222 strings in `allowed`, which
   * would rot on every library edit and drown the signal the test exists for.
   * Covering it needs the lazy catalogue segment, not a bigger allow-list.
   */

  for (const tab of TABS) {
    it(`renders the ${tab.name} tab with no un-catalogued text`, async () => {
      await preloadLocale('pseudo');
      act(() => {
        useDocumentStore.getState().setLocale('pseudo');
      });

      const { container } = tab.render();
      const fromUnconverted = tab.allowedFrom?.() ?? new Set<string>();
      const untagged = visibleText(container).filter(
        (text) =>
          !(text.startsWith(PSEUDO_PREFIX) && text.endsWith(PSEUDO_SUFFIX)) &&
          // Pure digits are values, not copy (the compactness slider readout).
          !/^\d+$/.test(text) &&
          !fromUnconverted.has(text)
      );

      expect(untagged).toEqual(tab.allowed);
    });
  }
});
