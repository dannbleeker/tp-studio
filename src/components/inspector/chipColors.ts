/**
 * Session 135 — shared chip-color palette + helpers.
 *
 * Inspector pills (status chips, source pills, strength pills, etc.)
 * historically lived next to their consumers as inline
 * `Record<…, string>` maps in `AssumptionWell.tsx`, `EvidenceList.tsx`,
 * and the legacy `EdgeAssumptions.tsx`. Three nearly-identical
 * dark-mode palettes is two too many: when the design tokens change,
 * three files have to change in lockstep.
 *
 * This module centralizes:
 *   1. A typed `ChipScheme` record carrying the eight semantic
 *      palettes (neutral, amber, red, blue, emerald, indigo, violet,
 *      yellow) — each entry is a Tailwind className string covering
 *      border / background / text in both light + dark mode.
 *   2. Three pre-built dictionaries that map the closed enums used
 *      by current consumers (`AssumptionStatus`,
 *      `EvidenceSource`, `EvidenceStrength`) to palette names.
 *   3. The `chipClass(scheme)` helper for the rare consumer that
 *      wants the raw className for an arbitrary palette.
 *
 * Future consumers add a new palette here (one place to design),
 * then map their domain enum to a palette name in their own file.
 * The chip palettes never escape this module's class names —
 * downstream code never literals the colours.
 */

import type {
  AssumptionKind,
  AssumptionStatus,
  EvidenceSource,
  EvidenceStrength,
} from '@/domain/types';

export type ChipScheme =
  | 'neutral'
  | 'amber'
  | 'red'
  | 'blue'
  | 'emerald'
  | 'indigo'
  | 'violet'
  | 'yellow';

/**
 * The eight semantic palettes. Each entry covers `border-`, `bg-`,
 * `text-` for both light and dark mode in one string. The exact
 * hue tokens here are the single source of truth — change them
 * here to recolour every chip in the inspector at once.
 */
export const CHIP_SCHEME: Record<ChipScheme, string> = {
  neutral:
    'border-neutral-300 bg-neutral-100 text-neutral-700 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-300',
  amber:
    'border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-200',
  red: 'border-red-400 bg-red-50 text-red-700 dark:border-red-700 dark:bg-red-950 dark:text-red-200',
  blue: 'border-blue-300 bg-blue-50 text-blue-800 dark:border-blue-700 dark:bg-blue-950 dark:text-blue-200',
  emerald:
    'border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-700 dark:bg-emerald-950 dark:text-emerald-200',
  indigo:
    'border-indigo-300 bg-indigo-50 text-indigo-800 dark:border-indigo-700 dark:bg-indigo-950 dark:text-indigo-200',
  violet:
    'border-violet-300 bg-violet-50 text-violet-800 dark:border-violet-700 dark:bg-violet-950 dark:text-violet-200',
  yellow:
    'border-yellow-300 bg-yellow-50 text-yellow-800 dark:border-yellow-700 dark:bg-yellow-950 dark:text-yellow-200',
};

/**
 * Look up the className for a palette name. Equivalent to indexing
 * the `CHIP_SCHEME` map directly but reads more naturally at call
 * sites and keeps the dictionary access path in one place.
 */
export const chipClass = (scheme: ChipScheme): string => CHIP_SCHEME[scheme];

/**
 * Assumption-status → chip palette mapping. The four statuses come
 * from the AssumptionStatus union (`unexamined / valid / invalid /
 * challengeable`); the visual hierarchy is:
 *   - unexamined → neutral (no opinion yet)
 *   - valid      → amber (a soft "OK")
 *   - invalid    → red (the breakthrough)
 *   - challengeable → blue (workbench-able)
 *
 * Used by `AssumptionWell.tsx` for the cycling status chip.
 */
export const ASSUMPTION_STATUS_CHIP: Record<AssumptionStatus, string> = {
  unexamined: CHIP_SCHEME.neutral,
  valid: CHIP_SCHEME.amber,
  invalid: CHIP_SCHEME.red,
  challengeable: CHIP_SCHEME.blue,
};

/**
 * Assumption-kind → chip palette mapping (S&T sub-typing, Session
 * 135). Three roles an assumption can play:
 *   - necessary  → indigo (the cause can't work without it)
 *   - parallel   → violet (holds alongside, matches assumption chrome)
 *   - sufficient → emerald (makes the cause enough on its own)
 *
 * The "untyped" (unset) state isn't in this map — the chip renders
 * neutral via `CHIP_SCHEME.neutral` directly when `kind` is undefined.
 * Used by `AssumptionWell.tsx` for the cycling kind chip.
 */
export const ASSUMPTION_KIND_CHIP: Record<AssumptionKind, string> = {
  necessary: CHIP_SCHEME.indigo,
  parallel: CHIP_SCHEME.violet,
  sufficient: CHIP_SCHEME.emerald,
};

/**
 * Evidence-source → chip palette mapping. The five sources come
 * from EvidenceSource:
 *   - observed     → emerald ("I saw it")
 *   - stakeholder  → blue (people)
 *   - metric       → indigo (numbers)
 *   - policy       → amber (rules)
 *   - assumption   → violet (matches assumption chrome elsewhere)
 *
 * Used by `EvidenceList.tsx` for the cycling source pill.
 */
export const EVIDENCE_SOURCE_CHIP: Record<EvidenceSource, string> = {
  observed: CHIP_SCHEME.emerald,
  stakeholder: CHIP_SCHEME.blue,
  metric: CHIP_SCHEME.indigo,
  policy: CHIP_SCHEME.amber,
  assumption: CHIP_SCHEME.violet,
};

/**
 * Evidence-strength → chip palette mapping. Three-step qualitative
 * rating; the visual hierarchy reinforces the value:
 *   - weak     → neutral (nothing to act on yet)
 *   - moderate → amber (a soft signal)
 *   - strong   → emerald (lean in)
 *
 * Used by `EvidenceList.tsx` for the cycling strength pill.
 */
export const EVIDENCE_STRENGTH_CHIP: Record<EvidenceStrength, string> = {
  weak: CHIP_SCHEME.neutral,
  moderate: CHIP_SCHEME.amber,
  strong: CHIP_SCHEME.emerald,
};
