import type { Edge, Entity } from '@/domain/types';

/**
 * Session 83 — geometry helpers for the drag-to-splice gesture.
 *
 * Given a drop point (in canvas coordinates) and a set of edges with
 * known endpoint positions, find the edge whose centerline runs closest
 * to the drop point. Used by `Canvas`'s `onNodeDragStop` handler: when
 * the user Alt-drops an entity, we ask "is this entity close enough to
 * an edge body to splice into it?"
 *
 * Pulled into its own module so the math is unit-testable without
 * mounting React Flow.
 */

export type Point = { x: number; y: number };

/**
 * Squared distance from point `p` to the line segment running from `a`
 * to `b`. Squared (not the actual distance) because callers compare it
 * to a tolerance squared — avoids the sqrt on every check.
 *
 * Exported for direct test coverage of the geometry edge cases.
 */
export const pointToSegmentDistanceSq = (p: Point, a: Point, b: Point): number => {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) {
    // Degenerate segment — `a` and `b` are the same point.
    const px = p.x - a.x;
    const py = p.y - a.y;
    return px * px + py * py;
  }
  // Parametric `t` along ab; clamp to [0, 1] so we measure to the
  // segment, not the infinite line.
  let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / lenSq;
  if (t < 0) t = 0;
  else if (t > 1) t = 1;
  const projX = a.x + t * dx;
  const projY = a.y + t * dy;
  const dxp = p.x - projX;
  const dyp = p.y - projY;
  return dxp * dxp + dyp * dyp;
};

export type EdgeCandidate = {
  edgeId: string;
  /** Squared distance from the drop point to the edge centerline. */
  distanceSq: number;
};

/**
 * Find the edge whose centerline runs closest to `point` AND is within
 * `tolerance` pixels of it. Returns `null` if no edge qualifies.
 *
 * Edges whose endpoints reference an entity that's the dragged entity
 * itself are filtered out — splicing into one of your own edges is a
 * no-op (the store action rejects it anyway, but excluding here saves
 * a needless cache miss and avoids confusing visual feedback).
 *
 * Exported for direct test coverage.
 */
export const findSpliceTargetEdge = (opts: {
  point: Point;
  draggedEntityId: string;
  // Session 105 — `readonly` so callers can pass the cached
  // `edgesArray(doc)` result without a cast. The function doesn't
  // mutate the array.
  edges: readonly Edge[];
  entityPositions: Record<string, Point>;
  /** Maximum centerline-distance in canvas coords. ~30 is a reasonable
   *  default for the standard node-width / font-size combo. */
  tolerance: number;
}): EdgeCandidate | null => {
  const { point, draggedEntityId, edges, entityPositions, tolerance } = opts;
  const toleranceSq = tolerance * tolerance;
  let best: EdgeCandidate | null = null;
  for (const edge of edges) {
    if (edge.sourceId === draggedEntityId || edge.targetId === draggedEntityId) continue;
    const a = entityPositions[edge.sourceId];
    const b = entityPositions[edge.targetId];
    if (!a || !b) continue;
    const distSq = pointToSegmentDistanceSq(point, a, b);
    if (distSq > toleranceSq) continue;
    if (best === null || distSq < best.distanceSq) {
      best = { edgeId: edge.id, distanceSq: distSq };
    }
  }
  return best;
};

/** Marker re-export so the canvas wiring doesn't need to know about the
 * geometry helpers individually. */
export type { Entity };
