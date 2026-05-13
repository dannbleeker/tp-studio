import { useDocumentStore } from '@/store';
import { useStore as useRFStore, useReactFlow } from '@xyflow/react';
import { useMemo } from 'react';

/**
 * E6 (AND) + Bundle 8 / FL-ED3 + FL-ED4 — Flying-Logic-style junctors.
 *
 * For each junctor-grouped set of edges sharing a target, render a small
 * circle labelled `AND` / `OR` / `XOR` sitting just below the target.
 * TPEdge redirects each junctor-grouped non-aggregated edge's bezier
 * endpoint to this junctor position (via `JUNCTOR_OFFSET_Y`), so visually
 * all the causes converge INTO the circle from below. One short line
 * continues from the junctor up into the target's bottom handle with
 * the arrow marker — that line is the only place an arrowhead appears
 * for a junctor group, no matter how many causes feed it.
 *
 * The junctor lives inside `<ReactFlow>` so it pans / zooms with the
 * viewport. Node positions are read via the live React Flow instance so
 * the junctor tracks the layout (including dagre animation).
 *
 * Single-edge junctor groups still render a junctor for visual
 * consistency. It looks slightly silly ("AND of one") but never leaves
 * an edge ending in mid-air — which is what would happen if we filtered
 * single-source groups out here while TPEdge unconditionally redirected.
 *
 * Cross-kind exclusivity: each edge belongs to at most one of
 * `andGroupId` / `orGroupId` / `xorGroupId`. The store actions enforce
 * this; the overlay reads them one-of-three. If a target somehow ended
 * up with two junctors of different kinds (e.g. corrupt import), they'd
 * visually stack — the store guards prevent the situation.
 */

/** Distance from the target node's bottom edge to the junctor CIRCLE'S
 *  CENTER. Must equal `JUNCTOR_CENTER_OFFSET_Y` in TPEdge.tsx so the
 *  circle aligns with where the source-side bezier curves expect it. */
const JUNCTOR_CENTER_OFFSET_Y = 35;
/** Junctor circle radius. Must equal `JUNCTOR_RADIUS` in TPEdge.tsx —
 *  source-side bezier curves terminate at the circle's bottom perimeter
 *  (center + radius), keeping strokes outside the opaque white fill. */
const JUNCTOR_RADIUS = 14;

type JunctorKind = 'AND' | 'OR' | 'XOR';

/** Visual treatment per junctor kind. AND keeps the existing violet
 *  (matches the historical `EDGE_STROKE_AND` token to avoid churning
 *  every existing AND test snapshot). OR uses indigo (matches the app's
 *  accent), XOR uses rose (warm, exclusionary — pairs visually with the
 *  mutex edge stroke without colliding with it). */
const KIND_STROKE: Record<JunctorKind, string> = {
  AND: '#8b5cf6', // violet-500 — same as EDGE_STROKE_AND
  OR: '#6366f1', // indigo-500
  XOR: '#f43f5e', // rose-500
};

type Junctor = {
  id: string;
  kind: JunctorKind;
  cx: number; // junctor center X (== target top-handle X)
  cy: number; // junctor center Y (target top + offset)
  tx: number; // target top-handle X
  ty: number; // target top-handle Y
};

const KIND_FIELDS: { kind: JunctorKind; field: 'andGroupId' | 'orGroupId' | 'xorGroupId' }[] = [
  { kind: 'AND', field: 'andGroupId' },
  { kind: 'OR', field: 'orGroupId' },
  { kind: 'XOR', field: 'xorGroupId' },
];

export function JunctorOverlay() {
  const edgesMap = useDocumentStore((s) => s.doc.edges);
  const flow = useReactFlow();
  const transform = useRFStore((s) => s.transform);

  const groups = useMemo(() => {
    const byGroup = new Map<string, { kind: JunctorKind; targetId: string }>();
    for (const edge of Object.values(edgesMap)) {
      for (const { kind, field } of KIND_FIELDS) {
        const gid = edge[field];
        if (gid && !byGroup.has(gid)) {
          byGroup.set(gid, { kind, targetId: edge.targetId });
        }
      }
    }
    return [...byGroup.entries()].map(([id, v]) => ({ id, kind: v.kind, targetId: v.targetId }));
  }, [edgesMap]);

  const [tx, ty, scale] = transform;

  // No memo: `flow.getInternalNode` returns null until React Flow has
  // measured the target node, and `groups` / `flow` don't change when
  // that measurement lands.
  const junctors: Junctor[] = [];
  for (const g of groups) {
    const target = flow.getInternalNode(g.targetId);
    if (!target) continue;
    const tPos = target.internals.positionAbsolute;
    const tWidth = target.measured?.width ?? 220;
    const tHeight = target.measured?.height ?? 72;
    const tX = tPos.x + tWidth / 2;
    const tY = tPos.y + tHeight;
    junctors.push({
      id: g.id,
      kind: g.kind,
      cx: tX,
      cy: tY + JUNCTOR_CENTER_OFFSET_Y,
      tx: tX,
      ty: tY,
    });
  }

  if (junctors.length === 0) return null;

  return (
    <svg
      className="pointer-events-none absolute inset-0 h-full w-full"
      style={{ overflow: 'visible' }}
      role="presentation"
      aria-hidden="true"
    >
      <title>Junctors</title>
      <defs>
        {/* One arrowhead marker per kind (different fill colors).
            `refX=10` puts the tip a couple of units short of the line
            endpoint so it doesn't pierce the target node's border. */}
        {(['AND', 'OR', 'XOR'] as JunctorKind[]).map((kind) => (
          <marker
            key={kind}
            id={`tp-junctor-arrow-${kind.toLowerCase()}`}
            markerWidth="12"
            markerHeight="12"
            refX="10"
            refY="6"
            orient="auto"
            markerUnits="userSpaceOnUse"
          >
            <path d="M 0 0 L 10 6 L 0 12 z" fill={KIND_STROKE[kind]} />
          </marker>
        ))}
      </defs>
      <g style={{ transform: `translate(${tx}px, ${ty}px) scale(${scale})` }}>
        {junctors.map((j) => {
          const stroke = KIND_STROKE[j.kind];
          return (
            <g key={j.id}>
              {/* Short line from junctor center to target top handle. */}
              <line
                x1={j.cx}
                y1={j.cy}
                x2={j.tx}
                y2={j.ty}
                stroke={stroke}
                strokeWidth={1.75}
                markerEnd={`url(#tp-junctor-arrow-${j.kind.toLowerCase()})`}
              />
              <circle
                cx={j.cx}
                cy={j.cy}
                r={JUNCTOR_RADIUS}
                fill="white"
                stroke={stroke}
                strokeWidth={1.5}
              />
              <text
                x={j.cx}
                y={j.cy}
                textAnchor="middle"
                dominantBaseline="central"
                fontSize="9"
                fontWeight="600"
                fill={stroke}
                style={{ userSelect: 'none' }}
              >
                {j.kind}
              </text>
            </g>
          );
        })}
      </g>
    </svg>
  );
}
