/**
 * AND / OR / XOR junctor grouping + the add-co-cause gesture. An edge belongs to
 * AT MOST ONE junctor kind at a time; these actions enforce that exclusivity.
 * Split out of `edgesSlice.ts`.
 */

import { nanoid } from 'nanoid';
import { createEdge } from '@/domain/factory';
import { hasEdge } from '@/domain/graph';
import type { Edge } from '@/domain/types';
import { touch } from '../docMutate';
import type { EdgesFactoryDeps } from './shared';

/**
 * Bundle 8 / FL-ED3 + FL-ED4 — the three mutually-exclusive junctor kinds an
 * edge can belong to. The store actions refuse cross-kind grouping and the
 * persistence validator trims conflicting fields on import.
 */
export type JunctorKind = 'and' | 'or' | 'xor';
const KIND_FIELD: Record<JunctorKind, 'andGroupId' | 'orGroupId' | 'xorGroupId'> = {
  and: 'andGroupId',
  or: 'orGroupId',
  xor: 'xorGroupId',
};
const OTHER_KIND_FIELDS = (kind: JunctorKind): ('andGroupId' | 'orGroupId' | 'xorGroupId')[] =>
  (['and', 'or', 'xor'] as JunctorKind[]).filter((k) => k !== kind).map((k) => KIND_FIELD[k]);
const KIND_LABEL: Record<JunctorKind, string> = {
  and: 'AND',
  or: 'OR',
  xor: 'XOR',
};

export type JunctorActions = {
  groupAsAnd: (edgeIds: string[]) => { ok: true; groupId: string } | { ok: false; reason: string };
  ungroupAnd: (edgeIds: string[]) => void;
  /** Bundle 8 / FL-ED4 — same shape as `groupAsAnd`, stamps `orGroupId`
   *  instead. Refuses when any selected edge is already in an AND or
   *  XOR group (one junctor per edge). */
  groupAsOr: (edgeIds: string[]) => { ok: true; groupId: string } | { ok: false; reason: string };
  ungroupOr: (edgeIds: string[]) => void;
  /** Bundle 8 / FL-ED3 — same shape as `groupAsAnd`, stamps `xorGroupId`
   *  instead. Refuses when any selected edge is already in an AND or OR
   *  group. */
  groupAsXor: (edgeIds: string[]) => { ok: true; groupId: string } | { ok: false; reason: string };
  ungroupXor: (edgeIds: string[]) => void;

  /** TOC-reading direct-manipulation: add a co-cause to an existing edge's
   *  target by junctor-grouping a new `source → target` edge with the
   *  existing one. The book treats dragging from an entity onto an edge
   *  (or onto an existing junctor circle) as the canonical way to
   *  introduce an additional cause — "this also has to hold for the
   *  effect to happen" (AND), "this is an alternative path" (OR), or
   *  "exactly one of these holds" (XOR).
   *
   *  Behavior:
   *    - Source entity must exist, be structural (not assumption / note),
   *      and differ from the existing edge's source / target.
   *    - `kind` defaults to `'and'`. Pass `'or'` / `'xor'` to join those
   *      junctor kinds instead.
   *    - If the existing edge already belongs to a junctor of the
   *      REQUESTED kind, the new edge joins that same group.
   *    - If the existing edge belongs to a DIFFERENT kind (e.g. asking
   *      OR on an AND-grouped edge), refuse and return null — one
   *      junctor per edge, enforced.
   *    - If the existing edge is solo, a fresh group id is minted for
   *      the requested kind and stamped on BOTH the existing edge and
   *      the new edge.
   *    - Duplicate detection: if source already feeds target, no-op.
   *  Returns the new edge, or `null` on any of the failure paths. */
  addCoCauseToEdge: (
    existingEdgeId: string,
    sourceEntityId: string,
    kind?: JunctorKind
  ) => Edge | null;
};

export function createJunctorActions({ get, applyDocChange }: EdgesFactoryDeps): JunctorActions {
  const groupAs = (
    kind: JunctorKind,
    edgeIds: string[]
  ): { ok: true; groupId: string } | { ok: false; reason: string } => {
    const label = KIND_LABEL[kind];
    if (edgeIds.length < 2) {
      return { ok: false, reason: `Select at least two edges to group as ${label}.` };
    }
    const { doc } = get();
    const edges = edgeIds.map((id) => doc.edges[id]).filter((e): e is Edge => Boolean(e));
    if (edges.length !== edgeIds.length || edges.length === 0) {
      return { ok: false, reason: 'One or more selected edges no longer exist.' };
    }
    const targetId = edges[0]!.targetId;
    if (!edges.every((e) => e.targetId === targetId)) {
      return { ok: false, reason: `${label}-grouped edges must share the same target.` };
    }
    // Cross-kind exclusivity: refuse if any selected edge already
    // belongs to a different junctor kind.
    const otherFields = OTHER_KIND_FIELDS(kind);
    const conflict = edges.find((e) => otherFields.some((f) => e[f]));
    if (conflict) {
      return {
        ok: false,
        reason: 'One or more selected edges already belong to a different junctor group.',
      };
    }
    const field = KIND_FIELD[kind];
    const existingGroup = edges.find((e) => e[field])?.[field];
    const groupId = existingGroup ?? nanoid(8);
    applyDocChange((prev) => {
      const nextEdges = { ...prev.edges };
      for (const id of edgeIds) {
        const e = nextEdges[id];
        if (e) nextEdges[id] = { ...e, [field]: groupId };
      }
      return touch({ ...prev, edges: nextEdges });
    });
    return { ok: true, groupId };
  };

  const ungroup = (kind: JunctorKind, edgeIds: string[]): void => {
    const field = KIND_FIELD[kind];
    applyDocChange((prev) => {
      const nextEdges = { ...prev.edges };
      let changed = false;
      for (const id of edgeIds) {
        const e = nextEdges[id];
        if (e?.[field]) {
          const { [field]: _drop, ...rest } = e;
          nextEdges[id] = rest as Edge;
          changed = true;
        }
      }
      return changed ? touch({ ...prev, edges: nextEdges }) : prev;
    });
  };

  return {
    groupAsAnd: (edgeIds) => groupAs('and', edgeIds),
    ungroupAnd: (edgeIds) => ungroup('and', edgeIds),
    groupAsOr: (edgeIds) => groupAs('or', edgeIds),
    ungroupOr: (edgeIds) => ungroup('or', edgeIds),
    groupAsXor: (edgeIds) => groupAs('xor', edgeIds),
    ungroupXor: (edgeIds) => ungroup('xor', edgeIds),

    addCoCauseToEdge: (existingEdgeId, sourceEntityId, kind = 'and') => {
      const { doc } = get();
      const existing = doc.edges[existingEdgeId];
      if (!existing) return null;
      const source = doc.entities[sourceEntityId];
      // FL-ET7: notes can't be the source of a causal edge. (Assumptions can't
      // either, but they're not entities -- they attach via their record's edgeId.)
      if (!source || source.type === 'note') return null;
      // Self / duplicate guards.
      if (sourceEntityId === existing.sourceId || sourceEntityId === existing.targetId) return null;
      if (hasEdge(doc, sourceEntityId, existing.targetId)) return null;
      // Cross-kind exclusivity: an edge belongs to at most one junctor
      // kind at a time. Trying to add an OR co-cause to an AND-grouped
      // edge (or any other mismatch) returns null rather than silently
      // converting. Matches `groupAs`'s exclusivity check.
      const otherFields = OTHER_KIND_FIELDS(kind);
      if (otherFields.some((f) => existing[f])) return null;

      // Determine the group id for the requested kind. Reuse the
      // existing group when the edge already belongs to one of the
      // matching kind; mint a fresh `<kind>_<nanoid>` otherwise so the
      // id encodes the junctor kind for grep-friendliness.
      const kindField = KIND_FIELD[kind];
      const groupId = existing[kindField] ?? `${kind}_${nanoid(8)}`;
      const newEdgeBase = createEdge({
        sourceId: sourceEntityId,
        targetId: existing.targetId,
        [kindField]: groupId,
      });

      applyDocChange((prev) => {
        const cur = prev.edges[existingEdgeId];
        if (!cur) return prev;
        const nextEdges = { ...prev.edges };
        if (cur[kindField] !== groupId) {
          nextEdges[existingEdgeId] = { ...cur, [kindField]: groupId };
        }
        nextEdges[newEdgeBase.id] = newEdgeBase;
        return touch({ ...prev, edges: nextEdges });
      });
      return newEdgeBase;
    },
  };
}
