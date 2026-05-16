import { edgesArray } from '@/domain/graph';
import { EDGE_MARKER_AND, EDGE_MARKER_DEFAULT } from '@/domain/tokens';
import type { TPDocument } from '@/domain/types';
import { MarkerType } from '@xyflow/react';
import { useMemo } from 'react';
import type { TPEdge } from './flow-types';
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
export const useGraphEdgeEmission = (doc: TPDocument, projection: GraphProjection): TPEdge[] => {
  return useMemo(() => {
    const { remap } = projection;

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
      const edge: TPEdge = {
        id: isAggregated ? `agg:${b.sourceId}->${b.targetId}` : b.sample.id,
        source: b.sourceId,
        target: b.targetId,
        type: 'tp',
        data: {
          ...(andGroupId ? { andGroupId } : {}),
          ...(orGroupId ? { orGroupId } : {}),
          ...(xorGroupId ? { xorGroupId } : {}),
          ...(b.count > 1 ? { aggregateCount: b.count } : {}),
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
  }, [doc, projection]);
};
