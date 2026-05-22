// Session 130 — split from `domain/types.ts`. Group color palette + the
// Group record. References `GroupId` only.

import type { GroupId } from './ids';

/**
 * Group palette tones. Fixed set so theme/dark/highContrast can pre-map.
 * No freeform color picker yet.
 */
export type GroupColor = 'slate' | 'indigo' | 'emerald' | 'amber' | 'rose' | 'violet';

/**
 * A logical container for entities (and nested groups). Renders as a shaded
 * rounded rectangle behind its members. `memberIds` is ordered and entries
 * resolve to either an `EntityId` or a `GroupId` — disambiguate by lookup
 * against `doc.entities` / `doc.groups`.
 */
export type Group = {
  id: GroupId;
  title: string;
  color: GroupColor;
  memberIds: string[];
  /** When true, members aren't rendered individually; the group becomes one
   *  big node with a member-count badge. Internal positions are preserved. */
  collapsed: boolean;
  /** Session 135 medium gap — "preserve rejected logic". When true, the
   *  group + all its members are hidden from the canvas unless the
   *  app-wide `showArchivedGroups` preference is on. Lets a user park a
   *  branch of reasoning they've rejected (a discarded cause cluster, a
   *  superseded injection set) without deleting it — the logic stays in
   *  the doc + persists, but doesn't clutter the live diagram. Emit-or-
   *  omit on persist: only `true` is stored, unset means "not archived". */
  archived?: boolean;
  createdAt: number;
  updatedAt: number;
};
