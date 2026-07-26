import { en } from '@/i18n/locales/en';
import type { EdgeKind, EntityType } from './types';

/**
 * Session 180 / E6 — Reader / Trainee mode coaching copy.
 *
 * Per-element explanations shown as tooltip cards when the user hovers
 * an entity or edge in Reader mode. The goal is to let a non-expert read
 * a shared TP diagram without prior training: they can hover any element
 * and understand what it represents in Theory of Constraints terms.
 *
 * Two registries:
 *   `ENTITY_TYPE_COACHING` — covers all built-in entity types.
 *   `EDGE_KIND_COACHING`   — covers both edge kinds (sufficiency / necessity).
 *
 * Custom entity classes are not in this registry; `EntityCoachingTooltip`
 * falls back to the type label alone when no entry is found.
 *
 * Coaching copy is deliberately concise (≤ 2 sentences). The goal is
 * orientation, not a tutorial. The full book chapter is always reachable
 * via the ? Help button.
 *
 * The copy itself now lives in the message catalogue (`src/i18n/locales/en.ts`)
 * so it can be translated. These exports are the ENGLISH view of it, kept for
 * tests and for callers outside a React render; components should read
 * `useT().coaching` instead so the tooltips follow the active locale.
 */

export interface CoachingEntry {
  /** Short noun-phrase label shown in bold above the tip. */
  label: string;
  /** 1–2 sentence coaching text. */
  tip: string;
}

export const ENTITY_TYPE_COACHING: Record<EntityType, CoachingEntry> = en.coaching.entity;

export const EDGE_KIND_COACHING: Record<EdgeKind, CoachingEntry> = en.coaching.edge;
