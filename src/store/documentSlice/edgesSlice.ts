import { defaultEntityType } from '@/domain/entityTypeMeta';
import { createEdge, createEntity } from '@/domain/factory';
import { hasEdge } from '@/domain/graph';
import type { AttrValue, Edge, EdgeWeight, Entity } from '@/domain/types';
import { nanoid } from 'nanoid';
import type { StateCreator } from 'zustand';
import type { RootStore } from '../types';
import { edgePatch, makeApplyDocChange, touch } from './docMutate';

/**
 * Bundle 8 / FL-ED3 + FL-ED4 — the three mutually-exclusive junctor
 * kinds an edge can belong to. An edge is in AT MOST ONE group at a
 * time; the store actions refuse cross-kind grouping and the
 * persistence validator trims conflicting fields on import.
 */
type JunctorKind = 'and' | 'or' | 'xor';
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

/**
 * Edge-level mutations: connect / update / delete / reverse plus
 * AND-grouping (a structural edge property — `andGroupId` — that lives on
 * the edge model). `addAssumptionToEdge` is in `entitiesSlice` because its
 * primary mutation creates a new entity; the assumption-id list on the
 * edge is a follower update.
 */
export type EdgesSlice = {
  connect: (sourceId: string, targetId: string) => Edge | null;
  updateEdge: (id: string, patch: Partial<Omit<Edge, 'id'>>) => void;
  deleteEdge: (id: string) => void;
  /** A6: swap an edge's source and target. Useful when a user has built the
   *  arrow in the wrong direction (mis-attributing cause to effect). */
  reverseEdge: (id: string) => void;

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

  /** Bundle 8 / FL-ED1 — set or clear the polarity tag on an edge. */
  setEdgeWeight: (edgeId: string, weight: EdgeWeight | undefined) => void;

  /** TOC-reading direct-manipulation: insert a fresh entity into the middle
   *  of an existing edge. The edge is removed, a new entity is created at
   *  the diagram's default type, and two new edges (source → new, new →
   *  target) replace the original. Edge label, assumptions, and back-edge
   *  flag stick to the downstream half (closer to the effect). AND grouping
   *  on the original edge is intentionally dropped — the new entity changes
   *  the AND structure, and the cleanest default is "you'll have to re-AND
   *  if you want." Returns the new entity (with `editingEntityId` set on
   *  it) or null when the edge / endpoints can't be resolved. */
  spliceEdge: (edgeId: string) => Entity | null;

  /** TOC-reading direct-manipulation: add a co-cause to an existing edge's
   *  target by AND-grouping a new `source → target` edge with the
   *  existing one. The book treats dragging from an entity onto an edge as
   *  the canonical way to introduce an additional sufficient cause —
   *  "this also has to hold for the effect to happen."
   *
   *  Behavior:
   *    - Source entity must exist, be structural (not assumption), and
   *      differ from the existing edge's source / target.
   *    - If the existing edge already has an `andGroupId`, the new edge
   *      joins that same group.
   *    - If the existing edge is solo, a fresh `andGroupId` is minted and
   *      stamped on BOTH the existing edge and the new edge.
   *    - Duplicate detection: if source already feeds target, no-op.
   *  Returns the new edge, or `null` on any of the failure paths. */
  addCoCauseToEdge: (existingEdgeId: string, sourceEntityId: string) => Edge | null;

  /** B1 — user-defined edge attributes (mirror of `setEntityAttribute`). */
  setEdgeAttribute: (edgeId: string, key: string, value: AttrValue) => void;
  removeEdgeAttribute: (edgeId: string, key: string) => void;
};

export const createEdgesSlice: StateCreator<RootStore, [], [], EdgesSlice> = (set, get) => {
  const applyDocChange = makeApplyDocChange(get, set);

  return {
    connect: (sourceId, targetId) => {
      if (sourceId === targetId) return null;
      const { doc } = get();
      const source = doc.entities[sourceId];
      const target = doc.entities[targetId];
      if (!source || !target) return null;
      // FL-ET7: Notes sit outside the causal graph — silently refuse to
      // make them an endpoint of a causal edge. Same posture as the
      // implicit "assumptions don't get connected this way" rule (the UI
      // never exposes the gesture; this is the defense-in-depth guard).
      if (source.type === 'note' || target.type === 'note') return null;
      if (hasEdge(doc, sourceId, targetId)) return null;
      const edge = createEdge({ sourceId, targetId });
      applyDocChange((prev) => touch({ ...prev, edges: { ...prev.edges, [edge.id]: edge } }));
      return edge;
    },

    updateEdge: (id, patch) => {
      applyDocChange((prev) => edgePatch(prev, id, patch));
    },

    deleteEdge: (id) => {
      applyDocChange((prev) => {
        if (!prev.edges[id]) return prev;
        const { [id]: _removed, ...rest } = prev.edges;
        return touch({ ...prev, edges: rest });
      });
      set({ selection: { kind: 'none' } });
    },

    reverseEdge: (id) => {
      applyDocChange((prev) => {
        const current = prev.edges[id];
        if (!current) return prev;
        // Refuse to reverse if the flipped direction would duplicate an
        // existing edge — that would create two parallel edges between the
        // same endpoints, which we don't model.
        if (hasEdge(prev, current.targetId, current.sourceId)) return prev;
        const next: Edge = { ...current, sourceId: current.targetId, targetId: current.sourceId };
        return touch({ ...prev, edges: { ...prev.edges, [id]: next } });
      });
    },

    // ── Bundle 8: AND / OR / XOR junctors share the same shape.
    //    The three public actions thin-wrap `groupAs` + `ungroup`.
    ...((): {
      groupAsAnd: EdgesSlice['groupAsAnd'];
      ungroupAnd: EdgesSlice['ungroupAnd'];
      groupAsOr: EdgesSlice['groupAsOr'];
      ungroupOr: EdgesSlice['ungroupOr'];
      groupAsXor: EdgesSlice['groupAsXor'];
      ungroupXor: EdgesSlice['ungroupXor'];
    } => {
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
      };
    })(),

    setEdgeWeight: (edgeId, weight) => {
      applyDocChange((prev) => {
        const cur = prev.edges[edgeId];
        if (!cur) return prev;
        if ((cur.weight ?? undefined) === weight) return prev;
        if (weight === undefined) {
          const { weight: _drop, ...rest } = cur;
          return touch({ ...prev, edges: { ...prev.edges, [edgeId]: rest as Edge } });
        }
        return touch({ ...prev, edges: { ...prev.edges, [edgeId]: { ...cur, weight } } });
      });
    },

    addCoCauseToEdge: (existingEdgeId, sourceEntityId) => {
      const { doc } = get();
      const existing = doc.edges[existingEdgeId];
      if (!existing) return null;
      const source = doc.entities[sourceEntityId];
      // FL-ET7: same as `connect()` — notes can't be source of a causal
      // edge. Assumptions are already filtered (they attach via
      // `Edge.assumptionIds`, not as endpoints).
      if (!source || source.type === 'assumption' || source.type === 'note') return null;
      // Self / duplicate guards.
      if (sourceEntityId === existing.sourceId || sourceEntityId === existing.targetId) return null;
      if (hasEdge(doc, sourceEntityId, existing.targetId)) return null;

      // Determine the andGroupId for both edges.
      const groupId = existing.andGroupId ?? `and_${nanoid(8)}`;
      const newEdgeBase = createEdge({
        sourceId: sourceEntityId,
        targetId: existing.targetId,
        andGroupId: groupId,
      });

      applyDocChange((prev) => {
        const cur = prev.edges[existingEdgeId];
        if (!cur) return prev;
        const nextEdges = { ...prev.edges };
        if (cur.andGroupId !== groupId) {
          nextEdges[existingEdgeId] = { ...cur, andGroupId: groupId };
        }
        nextEdges[newEdgeBase.id] = newEdgeBase;
        return touch({ ...prev, edges: nextEdges });
      });
      return newEdgeBase;
    },

    spliceEdge: (edgeId) => {
      const { doc } = get();
      const edge = doc.edges[edgeId];
      if (!edge) return null;
      const source = doc.entities[edge.sourceId];
      const target = doc.entities[edge.targetId];
      if (!source || !target) return null;

      const annotationNumber = doc.nextAnnotationNumber;
      const newEntity = createEntity({
        type: defaultEntityType(doc.diagramType),
        annotationNumber,
      });

      // Upstream half: source → new entity. Always clean — no label,
      // assumptions, or back-edge flag inherited.
      const upstreamEdge = createEdge({
        sourceId: edge.sourceId,
        targetId: newEntity.id,
      });
      // Downstream half: new entity → target. Inherits the edge's label,
      // assumption list, and back-edge flag (the half closer to the effect
      // carries the semantic baggage of the original step).
      const downstreamBase = createEdge({ sourceId: newEntity.id, targetId: edge.targetId });
      const downstreamEdge: Edge = {
        ...downstreamBase,
        ...(edge.label ? { label: edge.label } : {}),
        ...(edge.assumptionIds && edge.assumptionIds.length > 0
          ? { assumptionIds: edge.assumptionIds }
          : {}),
        ...(edge.isBackEdge === true ? { isBackEdge: true as const } : {}),
      };

      applyDocChange((prev) => {
        if (!prev.edges[edgeId]) return prev;
        const { [edgeId]: _removed, ...remainingEdges } = prev.edges;
        return touch({
          ...prev,
          entities: { ...prev.entities, [newEntity.id]: newEntity },
          edges: {
            ...remainingEdges,
            [upstreamEdge.id]: upstreamEdge,
            [downstreamEdge.id]: downstreamEdge,
          },
          nextAnnotationNumber: annotationNumber + 1,
        });
      });
      // Select + enter inline-edit on the new entity so the user can type a
      // title immediately. Mirrors the Tab / right-click "Add child" flows.
      set({
        selection: { kind: 'entities', ids: [newEntity.id] },
        editingEntityId: newEntity.id,
      });
      return newEntity;
    },

    // ── B1: user-defined attributes on edges ────────────────────────
    setEdgeAttribute: (edgeId, key, value) => {
      applyDocChange((prev) => {
        const cur = prev.edges[edgeId];
        if (!cur) return prev;
        const existing = cur.attributes?.[key];
        if (existing && existing.kind === value.kind && existing.value === value.value) {
          return prev;
        }
        const nextAttrs: Record<string, AttrValue> = { ...(cur.attributes ?? {}), [key]: value };
        const nextEdge: Edge = { ...cur, attributes: nextAttrs };
        return touch({ ...prev, edges: { ...prev.edges, [edgeId]: nextEdge } });
      });
    },

    removeEdgeAttribute: (edgeId, key) => {
      applyDocChange((prev) => {
        const cur = prev.edges[edgeId];
        if (!cur || !cur.attributes || !(key in cur.attributes)) return prev;
        const { [key]: _drop, ...rest } = cur.attributes;
        const nextEdge: Edge = {
          ...cur,
          attributes: Object.keys(rest).length > 0 ? rest : undefined,
        };
        return touch({ ...prev, edges: { ...prev.edges, [edgeId]: nextEdge } });
      });
    },
  };
};
