import { useDocumentStore } from '@/store';
import { useEffect } from 'react';

const ANIM_SPEED_MULTIPLIER = {
  instant: '0',
  slow: '0.5',
  default: '1',
  fast: '1.75',
} as const;

/**
 * Applies the current theme and animation-speed preference to <html>.
 *
 * - Theme: drives the `dark` and `theme-hc` classes that Tailwind dark
 *   variants and our own CSS scope on. high-contrast layers ON TOP of dark
 *   (so dark backgrounds + brighter foreground).
 * - Animation speed: written as the `--anim-speed` CSS variable, consumed
 *   throughout the stylesheet as `transition-duration: calc(Xms * var(...))`.
 *   `instant` collapses all transitions to 0ms.
 */
export function useThemeClass() {
  const theme = useDocumentStore((s) => s.theme);
  const animationSpeed = useDocumentStore((s) => s.animationSpeed);
  const printInkSaver = useDocumentStore((s) => s.printInkSaver);

  useEffect(() => {
    const root = document.documentElement;
    // `dark` mode is applied for every non-light theme. Variant themes
    // (rust / coal / navy / ayu) layer on top of `.dark` so Tailwind's
    // dark-mode utilities continue to apply throughout the app; only the
    // body background + a few accent colours change per variant.
    const isDarkFamily = theme !== 'light';
    root.classList.toggle('dark', isDarkFamily);
    // Mutually-exclusive variant class. Removing all four before applying
    // the current one keeps theme swaps clean (no stale class leftover
    // from a previous selection).
    const VARIANT_CLASSES = ['theme-hc', 'theme-rust', 'theme-coal', 'theme-navy', 'theme-ayu'];
    for (const cls of VARIANT_CLASSES) root.classList.remove(cls);
    if (theme === 'highContrast') root.classList.add('theme-hc');
    else if (theme === 'rust') root.classList.add('theme-rust');
    else if (theme === 'coal') root.classList.add('theme-coal');
    else if (theme === 'navy') root.classList.add('theme-navy');
    else if (theme === 'ayu') root.classList.add('theme-ayu');
  }, [theme]);

  useEffect(() => {
    document.documentElement.style.setProperty(
      '--anim-speed',
      ANIM_SPEED_MULTIPLIER[animationSpeed]
    );
  }, [animationSpeed]);

  useEffect(() => {
    // F6: print.css scopes its ink-saving rules on `.print-ink-saver` so the
    // user can opt in from Settings without touching the on-screen rendering.
    document.documentElement.classList.toggle('print-ink-saver', printInkSaver);
  }, [printInkSaver]);
}
