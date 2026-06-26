/**
 * Splice gestures — insert a fresh or existing entity into the middle of an
 * edge, replacing it with two halves and re-homing the original's label /
 * comments / assumptions onto the downstream half. Split out of `edgesSlice.ts`.
 */

import { defaultEntityType } from '@/domain/entityTypeMeta';
import { createEdge, createEntity } from '@/domain/factory';
import {
  pruneAssumptions,
  pruneComments,
  reanchorEdgeComments,
  rehomeAssumptions,
} from '@/domain/graph';
import type { Edge, Entity } from '@/domain/types';
import { prunedSpread, touch } from '../docMutate';
import type { EdgesFactoryDeps } from './shared';

export type SpliceActions = {
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
  /** Session 83 — splice an EXISTING entity into an edge. Drops the
   *  entity's own incoming/outgoing edges, replaces the target edge with
   *  (edge.source → entity) + (entity → edge.target). Returns `false`
   *  when the entity / edge don't exist, when the entity is already an
   *  endpoint of the edge, or when the resulting wiring would be a
   *  self-loop. Tests live in `tests/domain/spliceEntityIntoEdge.test.ts`. */
  spliceEntityIntoEdge: (entityId: string, edgeId: string) => boolean;
};

export function createSpliceActions({ get, set, applyDocChange }: EdgesFactoryDeps): SpliceActions {
  return {
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
      // Downstream half: new entity → target. Inherits the edge's label + back-edge
      // flag (the half closer to the effect carries the semantic baggage of the
      // original step). Its assumptions follow via `rehomeAssumptions` below
      // (record-canonical — attachment is `record.edgeId`, not an edge field).
      const downstreamBase = createEdge({ sourceId: newEntity.id, targetId: edge.targetId });
      const downstreamEdge: Edge = {
        ...downstreamBase,
        ...(edge.label ? { label: edge.label } : {}),
        ...(edge.isBackEdge === true ? { isBackEdge: true as const } : {}),
      };

      applyDocChange((prev) => {
        if (!prev.edges[edgeId]) return prev;
        const { [edgeId]: _removed, ...remainingEdges } = prev.edges;
        const nextEdges = {
          ...remainingEdges,
          [upstreamEdge.id]: upstreamEdge,
          [downstreamEdge.id]: downstreamEdge,
        };
        // The downstream half is the semantic continuation (it inherited the
        // edge's label), so the spliced edge's comments +
        // assumption records follow it onto `downstreamEdge` rather than orphan
        // on the now-deleted id. (prune is a no-op here — no other edge was
        // removed — but keeps the shape identical to spliceEntityIntoEdge.)
        const comments = pruneComments(
          reanchorEdgeComments(prev.comments, edgeId, downstreamEdge.id),
          nextEdges,
          prev.entities
        );
        const assumptions = pruneAssumptions(
          rehomeAssumptions(prev.assumptions, edgeId, downstreamEdge.id),
          nextEdges,
          prev.entities
        );
        return touch({
          ...prev,
          entities: { ...prev.entities, [newEntity.id]: newEntity },
          edges: nextEdges,
          nextAnnotationNumber: annotationNumber + 1,
          ...prunedSpread(prev, { assumptions, comments }),
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

    spliceEntityIntoEdge: (entityId, edgeId) => {
      const { doc } = get();
      const entity = doc.entities[entityId];
      const edge = doc.edges[edgeId];
      if (!entity || !edge) return false;
      // Reject splicing the entity into an edge it already belongs to —
      // would either reduce to a no-op or create a self-loop (e.g.
      // entity A on edge A→B: source half would be A→A).
      if (edge.sourceId === entityId || edge.targetId === entityId) return false;
      // Reject if removing the entity's existing edges + adding the
      // splice halves would still leave a self-loop (source === target
      // already on this edge — shouldn't happen, defense in depth).
      if (edge.sourceId === edge.targetId) return false;

      // Drop every edge that touches this entity — its old wiring is
      // about to be replaced by the splice halves. Note: this is
      // destructive; the caller's UI surface should make the gesture
      // intentional (e.g. Alt-modifier on drag).
      const remainingEdges: typeof doc.edges = {};
      for (const [id, e] of Object.entries(doc.edges)) {
        if (id === edgeId) continue;
        if (e.sourceId === entityId || e.targetId === entityId) continue;
        remainingEdges[id] = e;
      }
      // Upstream half: edge.source → entity. Clean — no inherited
      // metadata (label, assumptions, back-edge stay on the downstream
      // half, matching `spliceEdge`'s asymmetric distribution).
      const upstream = createEdge({ sourceId: edge.sourceId, targetId: entityId });
      const downstreamBase = createEdge({ sourceId: entityId, targetId: edge.targetId });
      const downstream: Edge = {
        ...downstreamBase,
        ...(edge.label ? { label: edge.label } : {}),
        ...(edge.isBackEdge === true ? { isBackEdge: true as const } : {}),
      };
      applyDocChange((prev) => {
        if (!prev.entities[entityId] || !prev.edges[edgeId]) return prev;
        const nextEdges = {
          ...remainingEdges,
          [upstream.id]: upstream,
          [downstream.id]: downstream,
        };
        // Re-home the spliced edge's comments + assumption records onto the
        // downstream half, then prune anything anchored
        // to the OTHER edges this splice dropped (the entity's old wiring).
        const comments = pruneComments(
          reanchorEdgeComments(prev.comments, edgeId, downstream.id),
          nextEdges,
          prev.entities
        );
        const assumptions = pruneAssumptions(
          rehomeAssumptions(prev.assumptions, edgeId, downstream.id),
          nextEdges,
          prev.entities
        );
        return touch({
          ...prev,
          edges: nextEdges,
          ...prunedSpread(prev, { assumptions, comments }),
        });
      });
      return true;
    },
  };
}
