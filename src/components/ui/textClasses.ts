/**
 * Session 135 — shared typography tokens.
 *
 * `EYEBROW` is the single source of truth for the small uppercase
 * "section / field label" treatment that had drifted across three
 * pixel sizes (10px / 11px / default) and two tracking values in the
 * inspector `Field`, the settings `Section`, dialog `<legend>`s, and
 * the tab bars (design audit finding #2). One token so they read
 * identically and a future tweak lands in one place.
 *
 * Deliberately does NOT set a font-size-relative margin or display —
 * callers compose it onto a `<span>` / `<legend>` and own layout.
 */
export const EYEBROW =
  'font-semibold text-[10px] uppercase tracking-wider text-neutral-500 dark:text-neutral-400';
