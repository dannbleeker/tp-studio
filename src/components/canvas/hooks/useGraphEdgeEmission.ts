import { MarkerType } from '@xyflow/react';
import { useMemo } from 'react';
import { edgesArray } from '@/domain/graph';
import { EDGE_MARKER_AND, EDGE_MARKER_DEFAULT } from '@/domain/tokens';
import type { TPDocument } from '@/domain/types';
import type { TPEdge } from '../edges/flow-types';
import { edgeAriaLabel } from './nodeAriaLabels';
import type { EdgeRouteMap } from './useEdgeRoutes';
import type { GraphProjection } from './useGraphProjection';

/**
 * Stage 3b of the graph-view pipeline: bucket-aggregate edges by remapped
 * endpoint pair and emit the React Flow `edges` array.
 *
 * **Key dependency property:** this hook does NOT depend on `positions`.
 * Edge geometry (the bezier path) is computed by React Flow at render
 * time from the live node positions; the only data this layer carries is
 * the source / target ids + style metadata. So a drag-to-reposition on a
 * manual-layout diagram changes positions without invalidating this
 * memo — only `doc.edges` or `projection.remap` can re-run it.
 *
 * Aggregation rules:
 *   - A single visible edge keeps its real id so the EdgeInspector can
 *     target it.
 *   - Multiple underlying edges sharing a remapped endpoint pair (e.g.
 *     two parallel edges to/from a collapsed-root) collapse into one
 *     synthetic `agg:src->tgt` edge that's not selectable.
 *   - AND-grouped non-aggregated edges drop their arrowhead — the junctor
 *     circle (ANDOverlay) owns the arrow into the target. Aggregated AND
 *     edges keep their arrowhead because they don't get junctor treatment.
 */
export const useGraphEdgeEmission = (
  doc: TPDocument,
  projection: GraphProjection,
  // Phase A — `routes` is always `{}` because `useEdgeRoutes` short-
  // circuits behind a hard-coded gate. Phase C flips that gate; when
  // populated, each real (non-aggregated) edge picks up its
  // precomputed path string from the map and stamps it into `data.route`.
  // Defaulting to `{}` keeps the existing two-argument call sites
  // working (tests that import this hook directly, etc.).
  routes: EdgeRouteMap = {}
): TPEdge[] => {
  return useMemo(() => {
    const { remap } = projection;

    // Session 135 / Perf #17 — one pass over the first-class assumption
    // records to build an `edgeId → count` map, instead of TPEdge
    // iterating `doc.assumptions` inside its per-edge store selector on
    // every store change (was O(E·M)). Stamped into edge `data` below.
    const assumptionCountByEdge = new Map<string, number>();
    if (doc.assumptions) {
      for (const a of Object.values(doc.assumptions)) {
        if (a.edgeId)
          assumptionCountByEdge.set(a.edgeId, (assumptionCountByEdge.get(a.edgeId) ?? 0) + 1);
      }
    }

    type Bucket = {
      sourceId: string;
      targetId: string;
      count: number;
      sample: TPDocument['edges'][string];
      isSyntheticEndpoint: boolean;
    };
    const buckets = new Map<string, Bucket>();
    for (const edge of edgesArray(doc)) {
      const s = remap(edge.sourceId);
      const t = remap(edge.targetId);
      if (!s || !t || s === t) continue;
      const synthetic = s !== edge.sourceId || t !== edge.targetId;
      const k = `${s}->${t}`;
      const cur = buckets.get(k);
      if (cur) {
        cur.count += 1;
        cur.isSyntheticEndpoint = cur.isSyntheticEndpoint || synthetic;
      } else {
        buckets.set(k, {
          sourceId: s,
          targetId: t,
          count: 1,
          sample: edge,
          isSyntheticEndpoint: synthetic,
        });
      }
    }

    const edges: TPEdge[] = [];
    for (const b of buckets.values()) {
      const isAggregated = b.count > 1 || b.isSyntheticEndpoint;
      const andGroupId = b.sample.andGroupId;
      const orGroupId = b.sample.orGroupId;
      const xorGroupId = b.sample.xorGroupId;
      // E6 + Bundle 8: junctor-grouped non-aggregated edges feed into a
      // junctor circle rendered by JunctorOverlay; their visible segment
      // ends at the junctor, not at the target node. We drop the arrowhead
      // here so the junctor's own short outgoing line owns the arrow —
      // otherwise we'd render an arrowhead-into-the-junctor on every
      // sibling, which looks like arrows piling onto the same point.
      // Aggregated junctor edges keep their arrowhead because they don't
      // get the junctor treatment (one synthetic edge representing a
      // collapsed group has nothing to converge with).
      const anyJunctorGroup = Boolean(andGroupId || orGroupId || xorGroupId);
      const isJunctorEdge = anyJunctorGroup && !isAggregated;
      // Assumption count only applies to real (non-aggregated) edges —
      // a synthetic `agg:` edge has no single underlying edge id, so it
      // never carries an assumption badge (matches prior behaviour).
      const assumptionCount = isAggregated
        ? 0
        : Math.max(
            b.sample.assumptionIds?.length ?? 0,
            assumptionCountByEdge.get(b.sample.id) ?? 0
          );
      // Session 135 — accessible name for screen readers. Source/target
      // are already remapped to VISIBLE node ids (real entities or
      // collapsed-root groups), so look up the user-facing title from
      // either map. Falls back to the id if neither resolves (paranoid).
      const visibleTitle = (id: string): string =>
        doc.entities[id]?.title || doc.groups[id]?.title || id;
      const ariaLabel = edgeAriaLabel({
        sourceTitle: visibleTitle(b.sourceId),
        targetTitle: visibleTitle(b.targetId),
        ...(b.count > 1 ? { aggregateCount: b.count } : {}),
        ...(b.sample.isBackEdge ? { isBackEdge: true } : {}),
        ...(b.sample.isMutualExclusion ? { isMutex: true } : {}),
        ...(assumptionCount > 0 ? { assumptionCount } : {}),
      });
      // Phase A — `route` only attaches to real (non-aggregated) edges
      // for the same reason as `assumptionCount`: an aggregated `agg:`
      // edge has no single underlying edge id to key the route map on.
      // In Phase A this is always undefined because `routes` is `{}`.
      const route = isAggregated ? undefined : routes[b.sample.id];
      const edge: TPEdge = {
        id: isAggregated ? `agg:${b.sourceId}->${b.targetId}` : b.sample.id,
        source: b.sourceId,
        target: b.targetId,
        type: 'tp',
        ariaLabel,
        data: {
          ...(andGroupId ? { andGroupId } : {}),
          ...(orGroupId ? { orGroupId } : {}),
          ...(xorGroupId ? { xorGroupId } : {}),
          ...(b.count > 1 ? { aggregateCount: b.count } : {}),
          ...(assumptionCount > 0 ? { assumptionCount } : {}),
          ...(route ? { route } : {}),
        },
        ...(isJunctorEdge
          ? {}
          : {
              markerEnd: {
                type: MarkerType.ArrowClosed,
                color: anyJunctorGroup ? EDGE_MARKER_AND : EDGE_MARKER_DEFAULT,
              },
            }),
        selectable: !isAggregated,
      };
      edges.push(edge);
    }

    return edges;
  }, [doc, projection, routes]);
};
