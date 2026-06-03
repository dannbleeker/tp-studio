import { EDGE_PALETTES } from '@/domain/tokens';
import { useDocumentStore } from '@/store';

/** Marker ids referenced by `useGraphEdgeEmission` via `markerEnd: url(#…)`. */
export const EDGE_ARROW_MARKER_ID = 'tp-edge-arrow';
export const EDGE_ARROW_AND_MARKER_ID = 'tp-edge-arrow-and';

/**
 * The cause→effect arrowhead markers every non-junctor causal / necessity edge
 * points at. The arrowhead IS the TP logic — it tells the reader which end is
 * the cause and which the effect — so it has to read clearly.
 *
 * Why custom markers instead of React Flow's `MarkerType.ArrowClosed`: that
 * built-in marker can't be offset (no `refX`), so its tip lands ON the target
 * handle and hides under the handle dot, and its geometry scales with the thin
 * ~1.5px stroke so it renders nearly invisible. These mirror the junctor arrow
 * (which DOES read) — a real triangle at a fixed canvas size (`userSpaceOnUse`)
 * and `orient="auto"` to follow the edge. The `refX` (16) sits PAST the tip
 * (at x=10), which pulls the whole arrowhead a few units back along the edge so
 * it clears the target handle dot that would otherwise bury it — verified: at
 * the connection point the arrow renders but reads as nothing under the dot.
 * Colour tracks the live edge palette (Settings → Appearance); the marker ids
 * stay stable so a palette switch recolours in place without re-emitting edges.
 * SVG marker refs resolve document-wide, so this 0-size `<svg>` can live
 * anywhere on the canvas.
 */
export function EdgeArrowMarkers() {
  const edgePalette = useDocumentStore((s) => s.edgePalette);
  const pal = EDGE_PALETTES[edgePalette];
  return (
    <svg width={0} height={0} aria-hidden="true" style={{ position: 'absolute' }}>
      <defs>
        {[
          { id: EDGE_ARROW_MARKER_ID, color: pal.marker },
          { id: EDGE_ARROW_AND_MARKER_ID, color: pal.markerAnd },
        ].map(({ id, color }) => (
          <marker
            key={id}
            id={id}
            markerWidth="20"
            markerHeight="20"
            refX="16"
            refY="6"
            orient="auto"
            markerUnits="userSpaceOnUse"
          >
            <path d="M 0 0 L 10 6 L 0 12 z" fill={color} />
          </marker>
        ))}
      </defs>
    </svg>
  );
}
