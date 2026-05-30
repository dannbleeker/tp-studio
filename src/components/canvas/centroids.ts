/**
 * Session 135 / Perf #6 — populate a centroid buffer in-place.
 *
 * Both drag handlers in `Canvas.tsx` need an entity-id → centre-of-node map
 * for the splice-target hit-test. Allocating a fresh `Record<>` per
 * `onNodeDrag` call (which fires per pointer frame during a drag) generated
 * ~6k small-object allocations per second on a 100-entity graph.
 *
 * This helper mutates a caller-owned `buf` object: drops the keys no longer
 * present this call, then writes one centroid per node, reusing (mutating)
 * the existing inner objects where possible. The buffer lives in a `useRef`
 * inside `CanvasInner` so React doesn't track it and the same shape is reused
 * frame-to-frame (helping V8's hidden-class tracking).
 *
 * Returns the same `buf` reference for chained calls, e.g.
 * `findSpliceTargetEdge({ entityPositions: populateCentroidsInto(buf, nodes) })`.
 *
 * Pulled out of `Canvas.tsx` (Session 138) so it can be unit-tested without
 * importing the whole React Flow host.
 */
export type Centroid = { x: number; y: number };
export type CentroidBuf = Record<string, Centroid>;
export type CanvasNodeSlim = {
  id: string;
  position: { x: number; y: number };
  measured?: { width?: number; height?: number };
};

export const populateCentroidsInto = (
  buf: CentroidBuf,
  nodes: readonly CanvasNodeSlim[]
): CentroidBuf => {
  // Drop stale entries from a previous (possibly larger) drag without
  // re-allocating the whole object — keeping the same buffer shape helps
  // V8's hidden-class tracking.
  const ids = new Set<string>();
  for (const n of nodes) ids.add(n.id);
  for (const key of Object.keys(buf)) {
    if (!ids.has(key)) delete buf[key];
  }
  for (const n of nodes) {
    const cx = n.position.x + (n.measured?.width ?? 0) / 2;
    const cy = n.position.y + (n.measured?.height ?? 0) / 2;
    const existing = buf[n.id];
    if (existing) {
      existing.x = cx;
      existing.y = cy;
    } else {
      buf[n.id] = { x: cx, y: cy };
    }
  }
  return buf;
};
