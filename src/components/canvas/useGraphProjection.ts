import {
  computeCollapseProjection,
  descendantIds,
  visibleEntityIdsForHoist,
} from '@/domain/groups';
import type { TPDocument } from '@/domain/types';
import { useDocumentStore } from '@/store';
import { useMemo } from 'react';

/** The shape returned by `computeCollapseProjection` — derived rather than
 *  imported because the domain function inlines its return type. */
type CollapseProjection = ReturnType<typeof computeCollapseProjection>;

/**
 * Stage 1 of the three-stage `useGraphView` pipeline.
 *
 * Compute the *visibility* layer: given the current document plus the UI's
 * hoist state (single hoisted group, if any) plus the per-group and
 * per-entity collapse state, which entities and groups should the layout
 * even consider? Edges from outside the hoisted scope or inside a collapsed
 * subtree need to be remapped to their collapsed-root stand-in; the
 * `remap` callback in the result does that lookup.
 *
 * This stage is O(N) in groups + entities and is independent of layout.
 * `useGraphPositions` consumes it, and so does `useGraphEmission`.
 */
export type GraphProjection = {
  /** Raw group-collapse projection from the domain layer. */
  proj: CollapseProjection;
  /** Entity ids the user should see — passes both hoist filter AND group
   *  collapse AND per-entity (F7) collapse. */
  visibleEntityIds: Set<string>;
  /** Group ids that have collapsed-root cards in the visible scope. */
  visibleCollapsedRoots: string[];
  /** Group ids inside the hoisted scope (includes the hoisted group itself
   *  when one is set). When nothing is hoisted, this is all groups. */
  hoistVisibleGroups: Set<string>;
  /** Map an entity/group id to the id of the visible thing that should
   *  stand in for it — itself, a collapsed-root, or null when both
   *  endpoints of an edge are inside the same collapsed subtree (drop). */
  remap: (id: string) => string | null;
  /** For F7 entity collapsers, the count of descendants hidden behind
   *  that entity. Drives the "+N" badge on TPNode. */
  hiddenCountByCollapser: Map<string, number>;
};

export const useGraphProjection = (doc: TPDocument): GraphProjection => {
  const hoistedGroupId = useDocumentStore((s) => s.hoistedGroupId);

  return useMemo(() => {
    const proj = computeCollapseProjection(doc);
    const hoistVisibleEntities = visibleEntityIdsForHoist(doc, hoistedGroupId);
    const hoistVisibleGroups = (() => {
      if (!hoistedGroupId) return new Set(Object.keys(doc.groups));
      const inside = descendantIds(doc, hoistedGroupId);
      const set = new Set<string>();
      for (const id of inside) if (doc.groups[id]) set.add(id);
      set.add(hoistedGroupId); // self
      return set;
    })();
    const visibleEntityIds = new Set<string>();
    for (const id of hoistVisibleEntities) {
      if (!proj.hiddenEntityIds.has(id)) visibleEntityIds.add(id);
    }

    // F7: per-entity disclosure-triangle collapse. Walk forward from every
    // entity with `collapsed: true`; everything reachable is hidden. The
    // collapser itself stays visible and renders a "+N" badge so the user
    // can re-expand. This is simpler than the group collapse model (no
    // junctor remapping) because a single entity stands in for its subtree.
    const entityCollapsers = new Set<string>();
    for (const e of Object.values(doc.entities)) {
      if (e.collapsed && visibleEntityIds.has(e.id)) entityCollapsers.add(e.id);
    }
    const hiddenByEntityCollapse = new Set<string>();
    const hiddenCountByCollapser = new Map<string, number>();
    if (entityCollapsers.size > 0) {
      // Build outgoing adjacency once for O(V+E) BFS per collapser.
      const outAdj = new Map<string, string[]>();
      for (const edge of Object.values(doc.edges)) {
        const list = outAdj.get(edge.sourceId) ?? [];
        list.push(edge.targetId);
        outAdj.set(edge.sourceId, list);
      }
      for (const id of entityCollapsers) {
        const reached = new Set<string>();
        const queue: string[] = [...(outAdj.get(id) ?? [])];
        while (queue.length) {
          const cur = queue.shift()!;
          if (reached.has(cur)) continue;
          if (cur === id) continue; // never hide the collapser itself
          reached.add(cur);
          for (const next of outAdj.get(cur) ?? []) queue.push(next);
        }
        hiddenCountByCollapser.set(id, reached.size);
        for (const r of reached) hiddenByEntityCollapse.add(r);
      }
      for (const id of hiddenByEntityCollapse) visibleEntityIds.delete(id);
    }

    const visibleCollapsedRoots = [...proj.collapsedRoots].filter((id) =>
      hoistVisibleGroups.has(id)
    );
    const remap = (id: string): string | null => {
      if (visibleEntityIds.has(id)) return id;
      const root = proj.entityToCollapsedRoot.get(id);
      if (root && visibleCollapsedRoots.includes(root)) return root;
      return null;
    };
    return {
      proj,
      visibleEntityIds,
      visibleCollapsedRoots,
      hoistVisibleGroups,
      remap,
      hiddenCountByCollapser,
    };
  }, [doc, hoistedGroupId]);
};
