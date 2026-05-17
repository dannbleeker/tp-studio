import type { RevisionId, TPDocument } from './types';

/**
 * A single snapshot of a document. The full doc is captured by value so a
 * revision is independent of subsequent edits — restoring is just "swap
 * `doc` for `revision.doc`."
 *
 * Revisions are addressed by their own id (separate from `doc.id` so two
 * revisions of the same doc are distinguishable). `parentRevisionId`
 * records which revision a restore came from — H1 doesn't use this today
 * but a future H3 (named branches) reads it to walk the lineage.
 *
 * Session 113 — `id` and `parentRevisionId` branded as `RevisionId`. The
 * brand is phantom (zero runtime cost) and surfaces at the type level:
 * passing an EntityId where a RevisionId is expected (e.g. into
 * `openSideBySide`) now fails compilation. See `types.ts` for the
 * brand declaration.
 */
export type Revision = {
  id: RevisionId;
  /** The doc this revision snapshots. Used to filter the panel to "this
   *  doc's history" rather than every doc's history. */
  docId: string;
  /** Wall-clock millis at capture time. Sorts revisions newest-first in the
   *  history panel. */
  capturedAt: number;
  /** Optional user-supplied label ("Before refactor", "Q3 baseline"). When
   *  absent, the panel falls back to the relative timestamp ("3 minutes ago").
   *  The auto-snapshot path always sets a label (e.g. "Auto: document
   *  opened") so the user can distinguish manual snapshots from drive-by
   *  ones. */
  label?: string;
  /** Frozen copy of the document at capture time. */
  doc: TPDocument;
  /** When this revision was created by `restoreSnapshot`, points at the
   *  revision that was being restored. Wired by H3 (Session 62) so the
   *  history panel can trace "this branch forked off snapshot X." */
  parentRevisionId?: RevisionId;
  /** H3 named branches (Session 62): optional branch tag. Revisions
   *  without a `branchName` belong to the implicit `'main'` branch; the
   *  panel groups by this field so multiple parallel experiments stay
   *  visually separate. Branches are an organizational layer over the
   *  flat revision list — no per-branch storage tree. */
  branchName?: string;
};

/**
 * Detailed (ID-level) diff between two snapshots. Same logical
 * partitioning as `RevisionDiff` (added / removed / changed) but with the
 * actual ID sets — needed by the visual-diff overlay (H2) and the
 * side-by-side dialog (H4), which color each entity/edge by its diff
 * status. Position-only changes still only count on manual-layout
 * diagrams (matches `computeRevisionDiff`).
 */
export type DetailedRevisionDiff = {
  entitiesAdded: Set<string>;
  entitiesRemoved: Set<string>;
  entitiesChanged: Set<string>;
  edgesAdded: Set<string>;
  edgesRemoved: Set<string>;
  edgesChanged: Set<string>;
  groupsAdded: Set<string>;
  groupsRemoved: Set<string>;
  groupsChanged: Set<string>;
};

/**
 * Per-entity diff status as projected onto the canvas during visual-diff
 * mode. `'added'` exists in next but not prev; `'removed'` exists in prev
 * but not next (rendered as a ghost overlay so the user can see what was
 * dropped); `'changed'` exists in both with different content;
 * `'unchanged'` is the visual baseline.
 */
export type EntityDiffStatus = 'added' | 'removed' | 'changed' | 'unchanged';

/**
 * Shape of the per-(prev → next) diff summary surfaced in the history
 * panel. All fields are non-negative counts; the panel formats them as
 * `"+2 entities, −1 edge"` via `summarizeRevisionDiff` below.
 *
 * `*Changed` counts pick up entities / edges that exist on both sides
 * but whose user-visible content (title, type, edge endpoints, group
 * title/color) differs. Position changes count under entitiesChanged
 * only for manual-layout diagrams — on auto-layout diagrams the user
 * doesn't drag positions, so a position-only diff would be confusing
 * noise.
 */
export type RevisionDiff = {
  entitiesAdded: number;
  entitiesRemoved: number;
  entitiesChanged: number;
  edgesAdded: number;
  edgesRemoved: number;
  edgesChanged: number;
  groupsAdded: number;
  groupsRemoved: number;
  groupsChanged: number;
};

const isManualDiagram = (doc: TPDocument): boolean => doc.diagramType === 'ec';

const entityContentEqual = (
  a: TPDocument['entities'][string],
  b: TPDocument['entities'][string],
  considerPosition: boolean
): boolean => {
  if (a.title !== b.title) return false;
  if (a.type !== b.type) return false;
  if ((a.description ?? '') !== (b.description ?? '')) return false;
  if ((a.titleSize ?? 'md') !== (b.titleSize ?? 'md')) return false;
  if ((a.ordering ?? -1) !== (b.ordering ?? -1)) return false;
  if (Boolean(a.collapsed) !== Boolean(b.collapsed)) return false;
  if (considerPosition) {
    const ap = a.position;
    const bp = b.position;
    if (!ap !== !bp) return false;
    if (ap && bp && (ap.x !== bp.x || ap.y !== bp.y)) return false;
  }
  return true;
};

const edgeContentEqual = (
  a: TPDocument['edges'][string],
  b: TPDocument['edges'][string]
): boolean => {
  if (a.sourceId !== b.sourceId) return false;
  if (a.targetId !== b.targetId) return false;
  if ((a.andGroupId ?? '') !== (b.andGroupId ?? '')) return false;
  if ((a.label ?? '') !== (b.label ?? '')) return false;
  return true;
};

const groupContentEqual = (
  a: TPDocument['groups'][string],
  b: TPDocument['groups'][string]
): boolean => {
  if (a.title !== b.title) return false;
  if (a.color !== b.color) return false;
  if (a.collapsed !== b.collapsed) return false;
  if (a.memberIds.length !== b.memberIds.length) return false;
  for (let i = 0; i < a.memberIds.length; i++) {
    if (a.memberIds[i] !== b.memberIds[i]) return false;
  }
  return true;
};

/**
 * Pure diff between two snapshots. `prev` is the older state, `next` is
 * the newer one — the counts read as "to go from prev to next, add X,
 * remove Y, change Z."
 *
 * The "changed" counts only fire when content differs; identical entries
 * (same id, same fields) don't bump anything. That's the property that
 * makes `RevisionDiff` reliable for the history panel — a no-op revision
 * (snapshot taken with nothing to record) reads as "no changes."
 */
export const computeRevisionDiff = (prev: TPDocument, next: TPDocument): RevisionDiff => {
  // Position matters for manual diagrams only. For auto-layout ones, dagre
  // owns positions and any "change" would be noise.
  const positionMatters = isManualDiagram(next) || isManualDiagram(prev);

  let entitiesAdded = 0;
  let entitiesRemoved = 0;
  let entitiesChanged = 0;
  for (const id of new Set([...Object.keys(prev.entities), ...Object.keys(next.entities)])) {
    const p = prev.entities[id];
    const n = next.entities[id];
    if (!p && n) entitiesAdded += 1;
    else if (p && !n) entitiesRemoved += 1;
    else if (p && n && !entityContentEqual(p, n, positionMatters)) entitiesChanged += 1;
  }

  let edgesAdded = 0;
  let edgesRemoved = 0;
  let edgesChanged = 0;
  for (const id of new Set([...Object.keys(prev.edges), ...Object.keys(next.edges)])) {
    const p = prev.edges[id];
    const n = next.edges[id];
    if (!p && n) edgesAdded += 1;
    else if (p && !n) edgesRemoved += 1;
    else if (p && n && !edgeContentEqual(p, n)) edgesChanged += 1;
  }

  let groupsAdded = 0;
  let groupsRemoved = 0;
  let groupsChanged = 0;
  for (const id of new Set([...Object.keys(prev.groups), ...Object.keys(next.groups)])) {
    const p = prev.groups[id];
    const n = next.groups[id];
    if (!p && n) groupsAdded += 1;
    else if (p && !n) groupsRemoved += 1;
    else if (p && n && !groupContentEqual(p, n)) groupsChanged += 1;
  }

  return {
    entitiesAdded,
    entitiesRemoved,
    entitiesChanged,
    edgesAdded,
    edgesRemoved,
    edgesChanged,
    groupsAdded,
    groupsRemoved,
    groupsChanged,
  };
};

/**
 * Detailed ID-level diff used by visual-diff (H2) and side-by-side (H4).
 * Same partition as `computeRevisionDiff` but returns the actual ID sets
 * so consumers can paint each entity/edge by its status.
 *
 * Session 105 / Tier 1 #4 — WeakMap cache.
 *
 * `useGraphNodeEmission` calls this on every emission run while
 * compare-mode is active; on a 200-entity diff the inner Set
 * operations are noticeable. Since the store uses immutable updates,
 * the `(prev, next)` pair forms a content-stable cache key: as long
 * as neither doc reference has changed, the diff is the same.
 *
 * Two-level WeakMap: `prev → next → diff`. When either doc reference
 * gets GC'd (typical: the user restores a revision, the old "live"
 * doc drops off), the WeakMap entries clean themselves up.
 */
const detailedDiffCache = new WeakMap<TPDocument, WeakMap<TPDocument, DetailedRevisionDiff>>();

const computeDetailedRevisionDiffUncached = (
  prev: TPDocument,
  next: TPDocument
): DetailedRevisionDiff => {
  const positionMatters = isManualDiagram(next) || isManualDiagram(prev);

  const entitiesAdded = new Set<string>();
  const entitiesRemoved = new Set<string>();
  const entitiesChanged = new Set<string>();
  for (const id of new Set([...Object.keys(prev.entities), ...Object.keys(next.entities)])) {
    const p = prev.entities[id];
    const n = next.entities[id];
    if (!p && n) entitiesAdded.add(id);
    else if (p && !n) entitiesRemoved.add(id);
    else if (p && n && !entityContentEqual(p, n, positionMatters)) entitiesChanged.add(id);
  }

  const edgesAdded = new Set<string>();
  const edgesRemoved = new Set<string>();
  const edgesChanged = new Set<string>();
  for (const id of new Set([...Object.keys(prev.edges), ...Object.keys(next.edges)])) {
    const p = prev.edges[id];
    const n = next.edges[id];
    if (!p && n) edgesAdded.add(id);
    else if (p && !n) edgesRemoved.add(id);
    else if (p && n && !edgeContentEqual(p, n)) edgesChanged.add(id);
  }

  const groupsAdded = new Set<string>();
  const groupsRemoved = new Set<string>();
  const groupsChanged = new Set<string>();
  for (const id of new Set([...Object.keys(prev.groups), ...Object.keys(next.groups)])) {
    const p = prev.groups[id];
    const n = next.groups[id];
    if (!p && n) groupsAdded.add(id);
    else if (p && !n) groupsRemoved.add(id);
    else if (p && n && !groupContentEqual(p, n)) groupsChanged.add(id);
  }

  return {
    entitiesAdded,
    entitiesRemoved,
    entitiesChanged,
    edgesAdded,
    edgesRemoved,
    edgesChanged,
    groupsAdded,
    groupsRemoved,
    groupsChanged,
  };
};

export const computeDetailedRevisionDiff = (
  prev: TPDocument,
  next: TPDocument
): DetailedRevisionDiff => {
  let inner = detailedDiffCache.get(prev);
  if (!inner) {
    inner = new WeakMap<TPDocument, DetailedRevisionDiff>();
    detailedDiffCache.set(prev, inner);
  }
  let cached = inner.get(next);
  if (cached === undefined) {
    cached = computeDetailedRevisionDiffUncached(prev, next);
    inner.set(next, cached);
  }
  return cached;
};

/** Resolve one entity id's status against a precomputed detailed diff. */
export const entityStatusFromDiff = (
  diff: DetailedRevisionDiff,
  entityId: string
): EntityDiffStatus => {
  if (diff.entitiesAdded.has(entityId)) return 'added';
  if (diff.entitiesRemoved.has(entityId)) return 'removed';
  if (diff.entitiesChanged.has(entityId)) return 'changed';
  return 'unchanged';
};

/** Resolve one edge id's status against a precomputed detailed diff. */
export const edgeStatusFromDiff = (
  diff: DetailedRevisionDiff,
  edgeId: string
): EntityDiffStatus => {
  if (diff.edgesAdded.has(edgeId)) return 'added';
  if (diff.edgesRemoved.has(edgeId)) return 'removed';
  if (diff.edgesChanged.has(edgeId)) return 'changed';
  return 'unchanged';
};

/** True when every count is zero — the two docs are equivalent for diff purposes. */
export const isEmptyDiff = (d: RevisionDiff): boolean =>
  d.entitiesAdded === 0 &&
  d.entitiesRemoved === 0 &&
  d.entitiesChanged === 0 &&
  d.edgesAdded === 0 &&
  d.edgesRemoved === 0 &&
  d.edgesChanged === 0 &&
  d.groupsAdded === 0 &&
  d.groupsRemoved === 0 &&
  d.groupsChanged === 0;

const pluralize = (n: number, singular: string, plural?: string): string =>
  `${n} ${n === 1 ? singular : (plural ?? `${singular}s`)}`;

/**
 * Compact human summary of a diff for the history panel — e.g.
 * `"+2 entities, −1 edge"`, `"+1 group"`, `"3 entities changed"`, or
 * `"No changes"` for a no-op revision.
 *
 * Order: additions, then removals, then changes. Each category groups
 * entities / edges / groups. Empty buckets are omitted; the resulting
 * comma-separated string never has trailing punctuation or empty slots.
 */
export const summarizeRevisionDiff = (d: RevisionDiff): string => {
  if (isEmptyDiff(d)) return 'No changes';
  const parts: string[] = [];

  // Additions
  const addedBits: string[] = [];
  if (d.entitiesAdded > 0) addedBits.push(pluralize(d.entitiesAdded, 'entity', 'entities'));
  if (d.edgesAdded > 0) addedBits.push(pluralize(d.edgesAdded, 'edge'));
  if (d.groupsAdded > 0) addedBits.push(pluralize(d.groupsAdded, 'group'));
  if (addedBits.length > 0) parts.push(`+${addedBits.join(', +')}`);

  // Removals (using minus sign U+2212 for visual symmetry with `+`)
  const removedBits: string[] = [];
  if (d.entitiesRemoved > 0) removedBits.push(pluralize(d.entitiesRemoved, 'entity', 'entities'));
  if (d.edgesRemoved > 0) removedBits.push(pluralize(d.edgesRemoved, 'edge'));
  if (d.groupsRemoved > 0) removedBits.push(pluralize(d.groupsRemoved, 'group'));
  if (removedBits.length > 0) parts.push(`−${removedBits.join(', −')}`);

  // Changes
  const changedBits: string[] = [];
  if (d.entitiesChanged > 0)
    changedBits.push(`${pluralize(d.entitiesChanged, 'entity', 'entities')} changed`);
  if (d.edgesChanged > 0) changedBits.push(`${pluralize(d.edgesChanged, 'edge')} changed`);
  if (d.groupsChanged > 0) changedBits.push(`${pluralize(d.groupsChanged, 'group')} changed`);
  if (changedBits.length > 0) parts.push(changedBits.join(', '));

  return parts.join(', ');
};
