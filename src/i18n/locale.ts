import type { Locale } from './types';

/**
 * The locale union, its ordered list, display labels, and the trust-boundary
 * guard — mirroring the shape of `src/domain/cloudType.ts` so the persistence
 * layer can narrow an imported value the same way it narrows `cloudType`.
 *
 * `pseudo` is deliberately part of the union rather than a test-only escape
 * hatch. It is a real, selectable locale that derives every string from `en`
 * at runtime (see `pseudo.ts`), which is what lets a component test render a
 * surface in it and assert that no un-translated literal leaks through. It is
 * excluded from {@link SELECTABLE_LOCALES} so it never reaches the Settings
 * dropdown, and it is only ever reachable through the registry's dynamic
 * import, so production never pays for it beyond an unloaded chunk.
 */

export const LOCALES: readonly Locale[] = ['en', 'pseudo'];

export const DEFAULT_LOCALE: Locale = 'en';

/**
 * Locales offered to users in Settings. Kept separate from {@link LOCALES}
 * because the union also carries the pseudo-locale QA harness, which is
 * selectable programmatically but must never be presented as a product
 * choice.
 */
export const SELECTABLE_LOCALES: readonly Locale[] = ['en'];

/**
 * Display names are autonyms — a language is named in its own language, so
 * these are NOT routed through the catalogue. A Danish user scanning the list
 * looks for "Dansk", not for whatever the active UI locale calls Danish.
 */
export const LOCALE_LABEL: Record<Locale, string> = {
  en: 'English',
  pseudo: 'Pseudo (QA)',
};

/**
 * BCP-47 tag per locale, for `<html lang>` and any `Intl` consumer that needs
 * the language rather than the catalogue. `pseudo` reports `en` because its
 * copy IS English (bracket-wrapped) — telling a screen reader otherwise would
 * make the QA locale actively misleading to test with.
 */
export const BCP47_BY_LOCALE: Record<Locale, string> = {
  en: 'en',
  pseudo: 'en',
};

/** Trust-boundary guard for persistence + stored preferences. */
export const isLocale = (value: unknown): value is Locale =>
  typeof value === 'string' && (LOCALES as readonly string[]).includes(value);
