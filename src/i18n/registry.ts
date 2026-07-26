import { log } from '@/services/logger';
import { DEFAULT_LOCALE } from './locale';
import { en } from './locales/en';
import type { Locale, Messages } from './types';

/**
 * Locale registry + the tiny external store `useT` subscribes to.
 *
 * `en` is the only STATIC import: it must be resolvable synchronously at
 * first paint, or the app would flash untranslated. Every other locale is a
 * dynamic `import()`, which is what keeps it out of the eager `index` chunk —
 * the codebase has been bitten by the opposite before (see the pattern-library
 * incident recorded in `bundle-budget.json`, where one static import of a
 * static-content registry silently cost ~23 KB gz on the eager path).
 *
 * Deliberately NOT a React context: `createContext` appears nowhere in this
 * codebase, there is no shared test render helper, and 119 test files call
 * RTL `render()` directly. Locale lives in the Zustand preferences slice like
 * every other preference, so `resetStoreForTest` resets it for free and no
 * test needs a provider wrapper.
 */

const LOADERS: Record<Locale, () => Promise<Messages>> = {
  en: () => Promise.resolve(en),
  // Derived from `en` at runtime rather than shipped as a second copy of
  // every string, so the chunk is a wrapper function, not a catalogue.
  pseudo: () => import('./pseudo').then((m) => m.pseudoMessages(en)),
};

const loaded = new Map<Locale, Messages>([[DEFAULT_LOCALE, en]]);
const inFlight = new Set<Locale>();
const listeners = new Set<() => void>();

/**
 * Synchronous, side-effect-free read — safe to call from a `useSyncExternalStore`
 * snapshot. Falls back to English until the requested chunk resolves, which is
 * why the returned reference is stable once a locale is loaded.
 */
export const peekMessages = (locale: Locale): Messages => loaded.get(locale) ?? en;

/** Has this locale's catalogue chunk resolved yet? */
export const isLocaleLoaded = (locale: Locale): boolean => loaded.has(locale);

export const subscribeMessages = (onChange: () => void): (() => void) => {
  listeners.add(onChange);
  return () => {
    listeners.delete(onChange);
  };
};

/**
 * Load a locale's catalogue if it isn't already resolved. Idempotent and
 * concurrency-safe; a failed load leaves the previous catalogue in place
 * rather than blanking the UI.
 *
 * Exported for tests, which await it before selecting a non-default locale so
 * assertions don't race the dynamic import.
 */
export const preloadLocale = async (locale: Locale): Promise<void> => {
  if (loaded.has(locale) || inFlight.has(locale)) return;
  inFlight.add(locale);
  try {
    loaded.set(locale, await LOADERS[locale]());
    for (const notify of listeners) notify();
  } catch (cause) {
    log.error('i18n: failed to load locale catalogue', { locale, cause });
  } finally {
    inFlight.delete(locale);
  }
};
