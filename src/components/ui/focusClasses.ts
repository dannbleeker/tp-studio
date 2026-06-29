/**
 * Session 93 — shared focus-ring class strings.
 *
 * The UI review (#36) flagged visual inconsistency between the
 * focus-ring patterns scattered across components. Reading the
 * codebase carefully: the patterns were actually tiered by **kind of
 * affordance** rather than truly inconsistent —
 *
 *   - **Inputs / textareas**: `ring-1` (subtle, doesn't crowd a tight
 *     form layout) tinted in the indigo accent.
 *   - **Clickable cards / large buttons**: `ring-2` (more visible,
 *     scans well at card-grid distances) on a slightly lighter ring
 *     so the card outline doesn't compete with its content.
 *   - **EC-themed badges** (verbalisation strip, assumption well):
 *     violet ring instead of indigo. This is intentional — EC has its
 *     own visual identity carried through the violet palette.
 *     (Design audit #14 — the rule is *partial*: EC's badges + chrome
 *     run violet, but the EC inspector tab bar shares the app-wide
 *     indigo `<TabBar>` rather than carrying violet. Deliberate — the
 *     tab bar reads as app navigation, and a one-consumer violet TabBar
 *     variant wasn't worth the indirection.)
 *
 * This module exposes those three patterns as named constants so
 * future components inherit the right pattern by class name rather
 * than re-deriving the exact ring values, and so a future visual-
 * accessibility audit can change them in one place.
 *
 * The Button primitive uses `focus-visible:` (keyboard-only) rather
 * than `focus:` (also mouse-focus) — input fields use plain `focus:`
 * because keyboard users land in them via Tab AND mouse users land
 * in them via click, and both should see the same visual cue.
 */

/** Form fields — input, textarea, select. Subtle `ring-1` ring + a
 *  border-color shift so the field reads as "active" without
 *  dominating the surrounding layout. Always pair with
 *  `outline-none`. */
export const INPUT_FOCUS =
  'outline-hidden focus:border-accent-400 focus:ring-1 focus:ring-accent-400';

/** Clickable cards in picker dialogs (DiagramTypePicker /
 *  ExportPicker / Templates). Bolder `ring-2` ring at a lighter
 *  ring color so a focused card reads at card-grid distance. Pairs
 *  with `outline-none` and a complementary `focus:border-accent-400`.
 *  Dark-mode override uses `dark:focus:ring-accent-600` to maintain
 *  visibility on the darker background. */
export const CARD_FOCUS =
  'focus:border-accent-400 focus:outline-hidden focus:ring-2 focus:ring-accent-300 dark:focus:ring-accent-600';
