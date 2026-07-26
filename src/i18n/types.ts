import type { en } from './locales/en';

/**
 * Supported locales. `pseudo` is the QA harness described in `locale.ts` —
 * part of the union so it can be selected and rendered like any other locale,
 * excluded from `SELECTABLE_LOCALES` so it never reaches the Settings UI.
 */
export type Locale = 'en' | 'pseudo';

/**
 * The message shape, derived from the English catalogue.
 *
 * Every other locale is typed as `Messages`, so `tsc` rejects a locale that
 * omits a key, adds one, or changes an interpolated entry's signature. This
 * is the compile-time completeness guarantee — there is no runtime key check
 * anywhere, and none is needed.
 */
export type Messages = typeof en;

/**
 * Parameters carried by a CLR warning from `validate()` up to the renderer.
 *
 * Deliberately loose. `validate()` runs below the React boundary and emits
 * ~57 heterogeneous messages through one channel, so a single params type has
 * to cover counts, entity titles, and enum tokens alike. Per-message
 * parameter typing is recovered where it matters — at the `makeWarning` call
 * site the validator names its own params, and the legacy English
 * `Warning.message` is rendered through the same catalogue entry, so a
 * mis-named parameter surfaces immediately in the existing validator tests.
 *
 * `readonly string[]` is admitted for list-valued params (the S&T missing
 * assumption facets), which `Intl.ListFormat` then joins per locale.
 */
export type ClrParams = Readonly<Record<string, string | number | readonly string[]>>;

/** Every CLR message key — `<ruleId>` or `<ruleId>.<variant>`. */
export type ClrMessageKey = keyof Messages['clr'];

/** Every one-click remedy id carried by `WarningAction`. */
export type ClrActionId = keyof Messages['clrAction'];
