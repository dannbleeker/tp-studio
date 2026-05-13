import type { GroupColor } from './types';

/**
 * Tailwind class strings for each group tone.
 *
 * Tailwind's JIT compiler purges class names it can't see as literals at
 * build time, so these have to be written out (no template interpolation).
 * Centralizing the map here means adding a new color updates every consumer:
 * the group rectangle, the collapsed-group card, and the inspector swatch.
 *
 * Each entry exposes the four facets a consumer might need:
 *   - `bg` / `bgStrong`: subtle vs solid background tints (light + dark)
 *   - `border`           : the outline color
 *   - `text`             : the on-tint text color
 *   - `swatch`           : a solid color square for color pickers
 *
 * Consumers pick the keys they care about; unused ones cost nothing because
 * Tailwind still emits them once (they appear here as literals).
 */
export type GroupColorClasses = {
  /** Subtle tinted fill — used behind expanded group rectangles. */
  bg: string;
  /** Stronger tinted fill — used by collapsed group cards. */
  bgStrong: string;
  /** Border / outline color. */
  border: string;
  /** Text color on tinted backgrounds (titles, icons). */
  text: string;
  /** Solid swatch tint for color pickers. */
  swatch: string;
};

export const GROUP_COLOR_CLASSES: Record<GroupColor, GroupColorClasses> = {
  slate: {
    bg: 'bg-slate-100/60 dark:bg-slate-800/30',
    bgStrong: 'bg-slate-100 dark:bg-slate-800/60',
    border: 'border-slate-300 dark:border-slate-700',
    text: 'text-slate-700 dark:text-slate-300',
    swatch: 'bg-slate-400',
  },
  indigo: {
    bg: 'bg-indigo-50/60 dark:bg-indigo-950/30',
    bgStrong: 'bg-indigo-50 dark:bg-indigo-950/60',
    border: 'border-indigo-300 dark:border-indigo-800',
    text: 'text-indigo-700 dark:text-indigo-300',
    swatch: 'bg-indigo-400',
  },
  emerald: {
    bg: 'bg-emerald-50/60 dark:bg-emerald-950/30',
    bgStrong: 'bg-emerald-50 dark:bg-emerald-950/60',
    border: 'border-emerald-300 dark:border-emerald-800',
    text: 'text-emerald-700 dark:text-emerald-300',
    swatch: 'bg-emerald-400',
  },
  amber: {
    bg: 'bg-amber-50/60 dark:bg-amber-950/30',
    bgStrong: 'bg-amber-50 dark:bg-amber-950/60',
    border: 'border-amber-300 dark:border-amber-800',
    text: 'text-amber-700 dark:text-amber-300',
    swatch: 'bg-amber-400',
  },
  rose: {
    bg: 'bg-rose-50/60 dark:bg-rose-950/30',
    bgStrong: 'bg-rose-50 dark:bg-rose-950/60',
    border: 'border-rose-300 dark:border-rose-800',
    text: 'text-rose-700 dark:text-rose-300',
    swatch: 'bg-rose-400',
  },
  violet: {
    bg: 'bg-violet-50/60 dark:bg-violet-950/30',
    bgStrong: 'bg-violet-50 dark:bg-violet-950/60',
    border: 'border-violet-300 dark:border-violet-800',
    text: 'text-violet-700 dark:text-violet-300',
    swatch: 'bg-violet-400',
  },
};

/** Display order used by the color picker swatches. */
export const GROUP_COLORS_ORDER: readonly GroupColor[] = [
  'slate',
  'indigo',
  'emerald',
  'amber',
  'rose',
  'violet',
];
