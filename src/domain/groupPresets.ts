import type { GroupColor } from './types';

/**
 * Canonical "Group preset" entries — book-derived names + colors that
 * recur across TOC tree types. Selecting a preset on the Group inspector
 * (Session 59) writes both the title and the color in one click; the
 * fields stay editable afterwards so a preset is just a starting point,
 * not a lock.
 *
 *   - **Negative Branch** (rose) — an FRT injection's unintended downstream
 *     UDE captured as a sub-tree. The book's "NBR" device.
 *   - **Positive Reinforcing Loop** (emerald) — a self-sustaining FRT
 *     loop where success feeds itself. Pairs naturally with Session 55's
 *     back-edge tagging on the loop-closing edge.
 *   - **Archive** (slate) — pruned alternatives and considered-but-rejected
 *     branches. CRT Step 8 and PRT Step 6 both say: don't delete what you
 *     tried, archive it. Default `collapsed: true` so the archive doesn't
 *     clutter the live diagram.
 *   - **Step** (indigo) — the TT structural triple (Action + Precondition →
 *     Outcome) wrapped as a unit. Makes the per-step boundaries explicit
 *     in a multi-step plan.
 *   - **NSP Block** (amber) — Strategy & Tactics Tree triple (Necessary
 *     condition / Sufficient action / Parallel assumption). Parked as a
 *     name + color slot until S&T Tree ships as a diagram type.
 *
 * Catalog order matches the typical FRT / PRT / TT workflow: capture
 * negatives, design positives, archive alternatives, model steps.
 */

export type GroupPresetId =
  | 'negative-branch'
  | 'positive-reinforcing-loop'
  | 'archive'
  | 'step'
  | 'nsp-block';

export type GroupPreset = {
  id: GroupPresetId;
  title: string;
  color: GroupColor;
  collapsed: boolean;
  hint: string;
};

export const GROUP_PRESETS: GroupPreset[] = [
  {
    id: 'negative-branch',
    title: 'Negative Branch',
    color: 'rose',
    collapsed: false,
    hint: 'FRT: an injection has produced an unintended UDE — model it here.',
  },
  {
    id: 'positive-reinforcing-loop',
    title: 'Positive Reinforcing Loop',
    color: 'emerald',
    collapsed: false,
    hint: 'FRT: a self-sustaining loop. Pair with back-edge tagging on the closing edge.',
  },
  {
    id: 'archive',
    title: 'Archive',
    color: 'slate',
    collapsed: true,
    hint: 'Pruned alternatives. Keep the path-not-taken visible without cluttering the diagram.',
  },
  {
    id: 'step',
    title: 'Step',
    color: 'indigo',
    collapsed: false,
    hint: 'TT: wrap one (Action + Precondition → Outcome) triple as a unit.',
  },
  {
    id: 'nsp-block',
    title: 'NSP Block',
    color: 'amber',
    collapsed: false,
    hint: 'S&T Tree: Necessary condition / Sufficient action / Parallel assumption triple.',
  },
];

/** Look up a preset by id. Returns undefined for unknown ids. */
export const presetById = (id: string): GroupPreset | undefined =>
  GROUP_PRESETS.find((p) => p.id === id);

/** Look up a preset by title (case-insensitive, trimmed). Used by the
 *  "Archive" command to find an existing Archive group before creating
 *  a new one — multiple Archives in the same document would be noise. */
export const presetByTitle = (title: string): GroupPreset | undefined => {
  const norm = title.trim().toLowerCase();
  return GROUP_PRESETS.find((p) => p.title.toLowerCase() === norm);
};
