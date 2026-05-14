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
  'outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400';

/** Clickable cards in picker dialogs (DiagramTypePicker /
 *  ExportPicker / TemplatePicker). Bolder `ring-2` ring at a lighter
 *  ring color so a focused card reads at card-grid distance. Pairs
 *  with `outline-none` and a complementary `focus:border-indigo-400`.
 *  Dark-mode override uses `dark:focus:ring-indigo-600` to maintain
 *  visibility on the darker background. */
export const CARD_FOCUS =
  'focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-300 dark:focus:ring-indigo-600';

/** EC-themed badges + verbalisation strip controls. Violet ring on
 *  ring-2. The violet keeps the EC visual identity from leaking into
 *  the indigo accent used everywhere else. */
export const EC_BADGE_FOCUS = 'focus:outline-none focus:ring-2 focus:ring-violet-400';
