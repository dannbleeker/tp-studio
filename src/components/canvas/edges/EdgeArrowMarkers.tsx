/**
 * Tags for the cause→effect arrowhead an edge carries. `useGraphEdgeEmission`
 * stamps one of these onto a non-junctor edge's `markerEnd`, and `TPEdge` reads
 * it purely as a "this edge gets an arrowhead" signal — it then draws the
 * arrowhead itself as a custom oriented `<path>` (see `TPEdge`).
 *
 * Why not React Flow's SVG `<marker>`: a `markerEnd` marker always orients to
 * the path's ENDPOINT tangent (the target handle's fixed normal — vertical for
 * a `Position.Bottom` handle), but the routed/bezier curve approaches the box
 * diagonally, so an offset marker pointed the wrong way and read as "not on the
 * line". Rendering the arrowhead in `TPEdge` lets it follow the actual
 * source→target direction and sit flush on the stroke. These two ids stay as
 * the emission↔render contract (and let the AND-aggregated edge be told apart
 * from a plain causal one); they no longer reference any rendered `<marker>`.
 */
export const EDGE_ARROW_MARKER_ID = 'tp-edge-arrow';
export const EDGE_ARROW_AND_MARKER_ID = 'tp-edge-arrow-and';
