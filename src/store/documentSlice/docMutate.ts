import type { Edge, Entity, TPDocument } from '@/domain/types';
import { persistDebounced } from '@/services/persistDebounced';
import { pushHistoryEntry } from '../historySlice';
import type { RootStore } from '../types';

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
    const prev = get().doc;
    const next = mutator(prev);
    if (next === prev) return;
    persistDebounced(next);
    set({
      doc: next,
      past: pushHistoryEntry(get().past, {
        doc: prev,
        coalesceKey: opts.coalesceKey,
        t: Date.now(),
      }),
      future: [],
    });
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
  patch: Partial<Omit<Entity, 'id' | 'createdAt'>>
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
  const next: Entity = { ...cur, ...patch, id: cur.id, updatedAt: Date.now() };
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
  patch: Partial<Omit<Edge, 'id'>>
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
  const next: Edge = { ...cur, ...patch, id: cur.id };
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
