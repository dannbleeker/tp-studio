import { computeRevisionDiff, isEmptyDiff } from '@/domain/revisions';
import type { Edge, Entity, Patch, TPDocument } from '@/domain/types';
import { persistDebounced } from '@/services/storage/persistDebounced';
import { setActiveDoc } from '../activeDoc';
import { pushHistoryEntry } from '../historySlice';
import { currentDoc } from '../selectors';
import type { RootStore } from '../types';

/** How long since the newest snapshot before an edit triggers an auto-snapshot. */
export const AUTO_SNAPSHOT_INTERVAL_MS = 3 * 60 * 1000;

/**
 * Auto-snapshot the active doc after a committed edit when: the user is on the
 * default (opt-out) `autoSnapshot` setting; ≥ AUTO_SNAPSHOT_INTERVAL_MS has
 * passed since the newest snapshot; and the doc actually differs from it. The
 * cheap time gate runs on every edit (one Date.now() compare); the heavier diff
 * runs only once the window elapses. Keyed on the newest revision's
 * `capturedAt` so it survives reloads and respects manual snapshots too, and a
 * long single-tab session accrues rollback points (previously snapshots only
 * fired on doc swap). `captureSnapshot` writes to the separate revisions store
 * (no `applyDocChange` recursion).
 */
const maybeAutoSnapshot = (get: () => RootStore): void => {
  const state = get();
  if (!state.autoSnapshot) return;
  const latest = state.revisions[0]; // newest-first, scoped to the active doc
  if (latest && Date.now() - latest.capturedAt < AUTO_SNAPSHOT_INTERVAL_MS) return;
  if (latest && isEmptyDiff(computeRevisionDiff(latest.doc, currentDoc(state)))) return;
  state.captureSnapshot('Auto');
};

/**
 * Shared mutation infrastructure for the document sub-slices.
 *
 * The original `documentSlice.ts` kept `applyDocChange` and friends as
 * closures inside one giant `createDocumentSlice`. Splitting into four
 * sub-slices means each sub-slice needs the same closure surface — so
 * the helpers got extracted here. Each sub-slice creator does:
 *
 *     const apply = makeApplyDocChange(get, set);
 *
 * and then `apply(mutator, opts)` exactly as before.
 */

export type ApplyDocChange = (
  mutator: (prev: TPDocument) => TPDocument,
  opts?: { coalesceKey?: string }
) => void;

type DocSetState = (partial: Partial<RootStore>) => void;

/**
 * Build the `applyDocChange` closure bound to a specific slice's
 * `get` / `set`. Wraps a mutator with persistence + history-push +
 * future-clear, and bails out if the mutator returns the same reference
 * (no-op detection — every mutator in the slice should return `prev`
 * unchanged when nothing actually changed so this short-circuit works).
 */
export const makeApplyDocChange = (get: () => RootStore, set: DocSetState): ApplyDocChange => {
  return (mutator, opts = {}) => {
    const prev = currentDoc(get());
    const next = mutator(prev);
    if (next === prev) return;
    persistDebounced(next);
    // Batch 5.1 — content edits keep the same doc id, so `setActiveDoc`
    // replaces the ACTIVE tab's doc in place (refreshes `doc` +
    // `docs[activeDocId]`) and leaves every OTHER open tab untouched. The
    // tab identity / order are unchanged.
    set({
      ...setActiveDoc(get(), next),
      past: pushHistoryEntry(get().past, {
        doc: prev,
        // Conditional spread to avoid passing `coalesceKey: undefined`
        // through to a `HistoryEntry` whose `coalesceKey?: string` field
        // would reject the explicit undefined under exactOptional.
        ...(opts.coalesceKey !== undefined ? { coalesceKey: opts.coalesceKey } : {}),
        t: Date.now(),
      }),
      future: [],
    });
    // After the edit is committed, consider an auto-snapshot (gated by time +
    // real-diff + the opt-out setting).
    maybeAutoSnapshot(get);
  };
};

/**
 * Stamp `updatedAt` on a document. Called at the end of every mutator
 * that produces a new document reference. Keeps the freshness of the
 * doc honest for live-draft auto-recovery and any future "modified
 * since N" features.
 */
export const touch = (doc: TPDocument): TPDocument => ({ ...doc, updatedAt: Date.now() });

/**
 * Apply a shallow patch to one entity, returning a new document — or the
 * untouched original if every patched field already matches (so
 * `applyDocChange`'s `next === prev` no-op detection short-circuits).
 *
 * Mutators that just need "merge these fields onto entity X" should use
 * this rather than the open-coded `{ ...prev.entities, [id]: { ...cur,
 * ...patch } }` so they don't accidentally bump `updatedAt` and dirty the
 * history stack for nothing.
 */
export const entityPatch = (
  doc: TPDocument,
  id: string,
  patch: Patch<Omit<Entity, 'id' | 'createdAt'>>
): TPDocument => {
  const cur = doc.entities[id];
  if (!cur) return doc;
  // Shallow no-op check: every key in `patch` already equals the current
  // value. JSON.stringify would be heavier; for a handful of primitive +
  // small-object fields a key-by-key compare is fine.
  let changed = false;
  // Iterate by `keyof typeof patch` (not `keyof Entity`) so the cast can't
  // synthesize `'id'` / `'createdAt'` keys — those are `Omit`-ed out of the
  // patch shape and would otherwise produce a "Property 'id' does not exist
  // on type Partial<…>" indexed-access error.
  for (const key of Object.keys(patch) as (keyof typeof patch)[]) {
    const a = patch[key];
    const b = cur[key];
    // Compare nested {x, y} position objects field-by-field; everything
    // else is a primitive or a string and `===` is the right call.
    if (key === 'position') {
      const ap = a as Entity['position'];
      const bp = b as Entity['position'];
      const same = (!ap && !bp) || (!!ap && !!bp && ap.x === bp.x && ap.y === bp.y);
      if (!same) {
        changed = true;
        break;
      }
    } else if (a !== b) {
      changed = true;
      break;
    }
  }
  if (!changed) return doc;
  // Patch<T> permits explicit `undefined` for any field (the "clear this
  // optional field" idiom); `as Entity` re-asserts the merged shape
  // matches Entity since cur supplies all required fields and patch can
  // only nullify optional ones.
  const next = { ...cur, ...patch, id: cur.id, updatedAt: Date.now() } as Entity;
  return touch({ ...doc, entities: { ...doc.entities, [id]: next } });
};

/**
 * Same as `entityPatch`, but for an edge. Used for label updates, AND-group
 * tagging, and any other shallow merge that should be a no-op when the
 * patched fields already match.
 */
export const edgePatch = (
  doc: TPDocument,
  id: string,
  patch: Patch<Omit<Edge, 'id'>>
): TPDocument => {
  const cur = doc.edges[id];
  if (!cur) return doc;
  let changed = false;
  // See `entityPatch` above for the rationale on keying by `typeof patch`
  // rather than `keyof Edge` — same "no `id` key in the Omit'd patch shape"
  // issue otherwise surfaces here.
  for (const key of Object.keys(patch) as (keyof typeof patch)[]) {
    if (patch[key] !== cur[key]) {
      changed = true;
      break;
    }
  }
  if (!changed) return doc;
  // See entityPatch above for the rationale on the `as Edge` cast.
  const next = { ...cur, ...patch, id: cur.id } as Edge;
  return touch({ ...doc, edges: { ...doc.edges, [id]: next } });
};

/**
 * Remove the given member IDs from every group's `memberIds` array. Empty
 * groups are NOT auto-deleted — the user may still want a placeholder.
 * Returns a fresh `groups` map; original reference is preserved when nothing
 * matched (to keep `applyDocChange` no-op detection working).
 */
export const scrubFromGroups = (
  groups: TPDocument['groups'],
  ids: string[]
): TPDocument['groups'] => {
  const idSet = new Set(ids);
  let changed = false;
  const out: TPDocument['groups'] = {};
  for (const [k, g] of Object.entries(groups)) {
    const filtered = g.memberIds.filter((m) => !idSet.has(m));
    if (filtered.length !== g.memberIds.length) {
      out[k] = { ...g, memberIds: filtered, updatedAt: Date.now() };
      changed = true;
    } else {
      out[k] = g;
    }
  }
  return changed ? out : groups;
};

/**
 * Conditional spread for prune / re-home results when rebuilding a document.
 *
 * The graph-prune helpers (`pruneAssumptions`, `pruneComments`,
 * `rehomeAssumptions`, `reanchorEdgeComments`) return the SAME reference when
 * nothing changed and a fresh map otherwise. Splicing an UNCHANGED map back
 * into a doc update would needlessly break reference-equality — the WeakMap
 * caches and identity-based memos keyed on `doc.comments` / `doc.assumptions`
 * would invalidate for nothing. So each field is included ONLY when the prune
 * actually produced a new reference, and an explicit `undefined` is never
 * passed (which `exactOptionalPropertyTypes` would reject anyway).
 *
 * Extracted from five mutation sites — deleteEntity, deleteEntitiesAndEdges,
 * deleteEdge, spliceEdge, spliceEntityIntoEdge — that open-coded the identical
 * two-line spread (see git history for the duplicated form).
 */
export const prunedSpread = (
  prev: TPDocument,
  pruned: {
    assumptions?: TPDocument['assumptions'];
    comments?: TPDocument['comments'];
  }
): Partial<Pick<TPDocument, 'assumptions' | 'comments'>> => ({
  ...(pruned.assumptions !== undefined && pruned.assumptions !== prev.assumptions
    ? { assumptions: pruned.assumptions }
    : {}),
  ...(pruned.comments !== undefined && pruned.comments !== prev.comments
    ? { comments: pruned.comments }
    : {}),
});
