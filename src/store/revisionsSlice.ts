import { newRevisionId } from '@/domain/ids';
import type { Revision } from '@/domain/revisions';
import type { TPDocument } from '@/domain/types';
import { STORAGE_KEYS, readJSON, writeJSON } from '@/services/storage';
import type { StateCreator } from 'zustand';
import type { RootStore } from './types';

/**
 * H1 — Revision history. A new slice that keeps a per-document list of
 * snapshots in localStorage. Snapshots are captured manually (palette
 * command, panel button) or automatically (on `setDocument` /
 * `newDocument` to preserve the doc that's being swapped out).
 *
 * Designed so H2 (visual diff), H3 (named branches), and H4 (side-by-side
 * compare) can build on it later — each revision carries the full doc,
 * an optional label, and an optional `parentRevisionId` pointer that
 * future branch / restore logic threads through.
 *
 * Source of truth is localStorage. The in-memory `revisions` array is a
 * derived view of the *active doc's* history, kept fresh by the slice's
 * actions and by `reloadRevisionsForActiveDoc` (called after a doc swap).
 * Hitting disk on every action keeps the auto-snapshot path
 * (`autoSnapshotOutgoing` below, called by docMetaSlice during a doc
 * swap) consistent with the slice's reads without a shared mutable
 * cache.
 */

/** Hard cap on revisions retained per document. Older snapshots are
 *  dropped first when this is hit. ~5 KB per revision × 50 = ~250 KB per
 *  doc, comfortably under the localStorage 5–10 MB budget shared across
 *  all keys. */
export const REVISIONS_PER_DOC_CAP = 50;

type RevisionsByDoc = Record<string, Revision[]>;

export type RevisionsSlice = {
  /** Active doc's history. Newest first. Derived from per-doc storage on
   *  every doc swap so the panel can iterate without filtering. */
  revisions: Revision[];

  /**
   * Capture the current `doc` as a new revision. Returns the revision id.
   * When `label` is omitted the revision still appears in the panel but
   * with a relative-timestamp label instead.
   *
   * Captures even when nothing has changed since the previous snapshot —
   * the panel surfaces that as "No changes" so the user can intentionally
   * mark a moment.
   */
  captureSnapshot: (label?: string) => string;

  /**
   * Roll the document back to a revision. Captures a safety snapshot of
   * the *current* doc first (labelled "Auto: before restore of …") so
   * the user can undo via the panel.
   */
  restoreSnapshot: (revisionId: string) => void;

  /** Drop a revision from history. The active doc is unaffected. */
  deleteSnapshot: (revisionId: string) => void;

  /** Rename a revision in place. Empty / whitespace-only labels clear back to undefined. */
  renameSnapshot: (revisionId: string, label: string) => void;

  /** Re-read the active doc's revisions list. Called by the documentSlice
   *  when the doc id changes (newDocument / setDocument) so the panel
   *  always shows the right doc's history. */
  reloadRevisionsForActiveDoc: () => void;

  /**
   * H3 (Session 62) — fork a new revision from an existing one with a
   * named branch tag. The new revision is a clone of `sourceRevisionId`'s
   * doc, gets `parentRevisionId: sourceRevisionId`, and is labelled with
   * `branchName`. The live doc is untouched — branching is record-keeping,
   * not a doc swap. Restoring to the branch's revision is a separate
   * action (the existing `restoreSnapshot`).
   *
   * Returns the new revision id, or null when the source isn't found.
   */
  branchFromRevision: (sourceRevisionId: string, branchName: string) => string | null;
};

export type RevisionsDataKeys = 'revisions';

export const revisionsDefaults = (): Pick<RevisionsSlice, RevisionsDataKeys> => ({
  revisions: [],
});

/**
 * Session 108 / Tier 3 — fast doc clone for revision snapshots.
 *
 * Replaces the previous `JSON.parse(JSON.stringify(doc))` deep clone
 * with a single-pass shallow-of-each-Record clone. The deep clone was
 * O(N × M) (entities × fields per entity, serialized to JSON and back);
 * the shallow-of-each-Record approach is O(N) (just copies the
 * top-level Record shapes) and shares the underlying Entity / Edge /
 * Group / Assumption object references.
 *
 * Why this is safe: TP Studio's store uses immutable updates throughout.
 * Editing an entity replaces its record with a new reference; the old
 * reference is never mutated. So sharing entity references between the
 * snapshot and the live doc cannot leak edits — the snapshot's
 * `entities[id]` continues to point at the OLD Entity record even
 * after the live doc replaces its slot with a new record.
 *
 * The shallow-copy of each Record gives the snapshot its own MAP, so
 * adding / removing a slot from the snapshot's map (none of which
 * the codebase does today, but defensive) wouldn't affect the live
 * doc.
 *
 * At 200 entities the previous deep clone was ~10–15 ms on a typical
 * laptop. The new path is sub-millisecond at the same size, scaling
 * linearly with field count rather than total entity content size.
 */
const cloneDoc = (doc: TPDocument): TPDocument => ({
  ...doc,
  entities: { ...doc.entities },
  edges: { ...doc.edges },
  groups: { ...doc.groups },
  resolvedWarnings: { ...doc.resolvedWarnings },
  ...(doc.layoutConfig ? { layoutConfig: { ...doc.layoutConfig } } : {}),
  ...(doc.systemScope ? { systemScope: { ...doc.systemScope } } : {}),
  ...(doc.methodChecklist ? { methodChecklist: { ...doc.methodChecklist } } : {}),
  ...(doc.customEntityClasses ? { customEntityClasses: { ...doc.customEntityClasses } } : {}),
  ...(doc.assumptions ? { assumptions: { ...doc.assumptions } } : {}),
});

/** Read the per-doc revisions map from localStorage. Returns an empty map
 *  if nothing has been saved yet or the JSON failed to parse. */
const loadRevisionsByDoc = (): RevisionsByDoc => {
  const raw = readJSON<RevisionsByDoc>(STORAGE_KEYS.revisions);
  if (!raw || typeof raw !== 'object') return {};
  return raw;
};

/** Write the map back. Storage errors surface via the existing toast listener. */
const saveRevisionsByDoc = (byDoc: RevisionsByDoc): void => {
  writeJSON(STORAGE_KEYS.revisions, byDoc);
};

const trim = (list: Revision[]): Revision[] =>
  list.length <= REVISIONS_PER_DOC_CAP ? list : list.slice(0, REVISIONS_PER_DOC_CAP);

export const createRevisionsSlice: StateCreator<RootStore, [], [], RevisionsSlice> = (set, get) => {
  // The active doc isn't reachable via `get()` from inside a slice creator
  // — slice spreads happen left-to-right and `get()` resolves against the
  // not-yet-final state. Boot with an empty list; `src/store/index.ts`
  // calls `reloadRevisionsForActiveDoc()` once after store construction
  // to populate the active-doc's history from disk.
  return {
    revisions: [],

    captureSnapshot: (label) => {
      const doc = get().doc;
      const docId = doc.id;
      const revision: Revision = {
        id: newRevisionId(),
        docId,
        capturedAt: Date.now(),
        doc: cloneDoc(doc),
        ...(label?.trim() ? { label: label.trim() } : {}),
      };
      const byDoc = loadRevisionsByDoc();
      const existing = byDoc[docId] ?? [];
      const nextList = trim([revision, ...existing]);
      saveRevisionsByDoc({ ...byDoc, [docId]: nextList });
      set({ revisions: nextList });
      return revision.id;
    },

    restoreSnapshot: (revisionId) => {
      const doc = get().doc;
      const docId = doc.id;
      const byDoc = loadRevisionsByDoc();
      const list = byDoc[docId] ?? [];
      const target = list.find((r) => r.id === revisionId);
      if (!target) return;
      // Safety net: capture the current doc first so the user can undo via
      // the panel. Label references the revision being restored to so the
      // history reads as a clear pair of events.
      const safetyLabel = target.label
        ? `Auto: before restoring "${target.label}"`
        : 'Auto: before restoring snapshot';
      const safety: Revision = {
        id: newRevisionId(),
        docId,
        capturedAt: Date.now(),
        doc: cloneDoc(doc),
        label: safetyLabel,
        // H3: wire `parentRevisionId` so the panel can show the lineage
        // ("this was created when we restored snapshot X"). Inherits the
        // target's branch name so the safety record lives in the same
        // bucket as what was restored.
        //
        // Session 113 — `target.id` is the branded RevisionId; use it
        // directly rather than the plain-string `revisionId` parameter
        // so the type checks without a cast.
        parentRevisionId: target.id,
        ...(target.branchName ? { branchName: target.branchName } : {}),
      };
      const nextList = trim([safety, ...list]);
      saveRevisionsByDoc({ ...byDoc, [docId]: nextList });
      // Swap the doc. setDocument's auto-snapshot would normally fire here,
      // but we already captured the safety snapshot — set the suppression
      // flag so docMetaSlice skips its hook for this one swap.
      suppressNextAutoSnapshot = true;
      get().setDocument(cloneDoc(target.doc));
      set({ revisions: nextList });
    },

    deleteSnapshot: (revisionId) => {
      const docId = get().doc.id;
      const byDoc = loadRevisionsByDoc();
      const list = byDoc[docId] ?? [];
      const next = list.filter((r) => r.id !== revisionId);
      if (next.length === list.length) return;
      saveRevisionsByDoc({ ...byDoc, [docId]: next });
      set({ revisions: next });
    },

    renameSnapshot: (revisionId, label) => {
      const docId = get().doc.id;
      const byDoc = loadRevisionsByDoc();
      const list = byDoc[docId] ?? [];
      const trimmedLabel = label.trim();
      let changed = false;
      const next = list.map((r) => {
        if (r.id !== revisionId) return r;
        if (trimmedLabel) {
          if (r.label === trimmedLabel) return r;
          changed = true;
          return { ...r, label: trimmedLabel };
        }
        if (r.label === undefined) return r;
        changed = true;
        const { label: _drop, ...rest } = r;
        return rest as Revision;
      });
      if (!changed) return;
      saveRevisionsByDoc({ ...byDoc, [docId]: next });
      set({ revisions: next });
    },

    reloadRevisionsForActiveDoc: () => {
      const docId = get().doc.id;
      const byDoc = loadRevisionsByDoc();
      set({ revisions: byDoc[docId] ?? [] });
    },

    branchFromRevision: (sourceRevisionId, branchName) => {
      const docId = get().doc.id;
      const byDoc = loadRevisionsByDoc();
      const list = byDoc[docId] ?? [];
      const source = list.find((r) => r.id === sourceRevisionId);
      if (!source) return null;
      const tag = branchName.trim();
      if (!tag) return null;
      // The new revision is a clone of the source's doc with a branch tag
      // and parent pointer. The live doc is unchanged — the user has to
      // actively `restoreSnapshot` on the branched revision (or any later
      // snapshot they make on it) to switch the canvas state.
      const branched: Revision = {
        id: newRevisionId(),
        docId,
        capturedAt: Date.now(),
        doc: cloneDoc(source.doc),
        label: `${tag} (forked from "${source.label ?? 'snapshot'}")`,
        // Session 113 — use the branded `source.id` rather than the
        // plain-string `sourceRevisionId` action parameter so the type
        // checks without a cast at the boundary.
        parentRevisionId: source.id,
        branchName: tag,
      };
      const nextList = trim([branched, ...list]);
      saveRevisionsByDoc({ ...byDoc, [docId]: nextList });
      set({ revisions: nextList });
      return branched.id;
    },
  };
};

/**
 * Module-private flag read by `docMetaSlice` to suppress the next
 * auto-snapshot. Set by `restoreSnapshot` (which captures its own safety
 * snapshot) and cleared once the doc swap completes.
 */
let suppressNextAutoSnapshot = false;

/** Read-and-clear: consume the suppression flag exactly once. */
export const consumeAutoSnapshotSuppression = (): boolean => {
  const was = suppressNextAutoSnapshot;
  suppressNextAutoSnapshot = false;
  return was;
};

/**
 * Auto-snapshot path invoked by `docMetaSlice.setDocument` /
 * `docMetaSlice.newDocument` BEFORE swapping the doc. Captures the
 * outgoing doc with a contextual label so the user can roll back to it.
 *
 * Lives at module level (rather than as a method on the slice) so
 * docMetaSlice can call it during its own setState without the
 * recursive `set()` that a regular action would introduce. Reads / writes
 * localStorage directly to stay consistent with the slice's mutations.
 */
export const autoSnapshotOutgoing = (outgoing: TPDocument, reason: string): void => {
  if (consumeAutoSnapshotSuppression()) return;
  const byDoc = loadRevisionsByDoc();
  const list = byDoc[outgoing.id] ?? [];
  const revision: Revision = {
    id: newRevisionId(),
    docId: outgoing.id,
    capturedAt: Date.now(),
    doc: cloneDoc(outgoing),
    label: `Auto: ${reason}`,
  };
  const next = trim([revision, ...list]);
  saveRevisionsByDoc({ ...byDoc, [outgoing.id]: next });
};
