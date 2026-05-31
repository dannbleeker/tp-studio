import { useConnection, useStore as useRFStore } from '@xyflow/react';
import { useState } from 'react';
import { JUNCTOR_CENTER_OFFSET_Y, JUNCTOR_HIT_RADIUS, JUNCTOR_RADIUS } from '@/domain/constants';
import type { TPDocument } from '@/domain/types';
import { setHoveredJunctor } from '@/services/canvasRef';
import { arrayShallowEqualByKeys } from '@/store/equality';
import { currentDoc } from '@/store/selectors';
import { useDocumentStoreWith } from '@/store/useDocumentStoreWithEquality';

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

// Session 101 — `JUNCTOR_CENTER_OFFSET_Y` + `JUNCTOR_RADIUS` now live
// in `@/domain/constants` so this file and `TPEdge.tsx` can't silently
// drift. The circle's center sits at `targetY + JUNCTOR_CENTER_OFFSET_Y`;
// source-side beziers in TPEdge terminate at the bottom perimeter
// (center + radius).

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

type JunctorGroup = { id: string; kind: JunctorKind; targetId: string };

// Session 135 / Perf #7 — equality fn skips re-renders when the
// junctor group set is unchanged. Unrelated edge mutations (label,
// weight, attestation, assumptionIds) no longer churn this overlay.
const junctorGroupsEqual = arrayShallowEqualByKeys<JunctorGroup>(['id', 'kind', 'targetId']);

/**
 * Session 135 / Perf #39 — WeakMap-cached on the `edges` reference.
 * This overlay is always mounted; previously its store selector walked
 * every edge on *every* store change (even a title keystroke) to derive
 * the junctor groups, then leaned on the equality fn to avoid the
 * re-render. Caching on `doc.edges` (a fresh ref only on edge mutation)
 * turns the steady-state selector into an O(1) lookup that returns the
 * same array reference, so the equality fn short-circuits on identity.
 */
const junctorGroupsCache = new WeakMap<TPDocument['edges'], JunctorGroup[]>();

const computeJunctorGroups = (edges: TPDocument['edges']): JunctorGroup[] => {
  const cached = junctorGroupsCache.get(edges);
  if (cached) return cached;
  const byGroup = new Map<string, { kind: JunctorKind; targetId: string }>();
  for (const edge of Object.values(edges)) {
    for (const { kind, field } of KIND_FIELDS) {
      const gid = edge[field];
      if (gid && !byGroup.has(gid)) {
        byGroup.set(gid, { kind, targetId: edge.targetId });
      }
    }
  }
  const result = [...byGroup.entries()].map(([id, v]) => ({
    id,
    kind: v.kind,
    targetId: v.targetId,
  }));
  junctorGroupsCache.set(edges, result);
  return result;
};

/** The slice of a React Flow internal node `computeJunctors` reads. Kept
 *  minimal so the helper is trivially unit-testable with a plain object. */
type TargetNodeGeometry = {
  readonly internals: { readonly positionAbsolute: { readonly x: number; readonly y: number } };
  readonly measured?: { readonly width?: number; readonly height?: number } | undefined;
};

/**
 * Pure junctor-geometry: place each group's circle centered just below its
 * target node, using the target's LIVE absolute position + measured size.
 * `getNode` is the live lookup (React Flow's `nodeLookup`), so the geometry
 * recomputes whenever the target moves. Exported for unit testing.
 */
export const computeJunctors = (
  groups: readonly JunctorGroup[],
  getNode: (id: string) => TargetNodeGeometry | undefined
): Junctor[] => {
  const out: Junctor[] = [];
  for (const g of groups) {
    const target = getNode(g.targetId);
    if (!target) continue;
    const tPos = target.internals.positionAbsolute;
    const tWidth = target.measured?.width ?? 220;
    const tHeight = target.measured?.height ?? 72;
    const tX = tPos.x + tWidth / 2;
    const tY = tPos.y + tHeight;
    out.push({ id: g.id, kind: g.kind, cx: tX, cy: tY + JUNCTOR_CENTER_OFFSET_Y, tx: tX, ty: tY });
  }
  return out;
};

// Session 138 — content equality so the React Flow store subscription only
// re-renders the overlay when a junctor's geometry actually changed (a
// target moved / resized), not on every unrelated store tick.
const junctorsEqual = arrayShallowEqualByKeys<Junctor>(['id', 'kind', 'cx', 'cy', 'tx', 'ty']);

export function JunctorOverlay() {
  const transform = useRFStore((s) => s.transform);

  // Derive (groupId, kind, targetId) triples from the cached helper —
  // the selector is now a WeakMap lookup keyed on `doc.edges`, so an
  // unrelated mutation returns the same array ref and the equality fn
  // short-circuits.
  const groups = useDocumentStoreWith(
    (s) => computeJunctorGroups(currentDoc(s).edges),
    junctorGroupsEqual
  );

  const [tx, ty, scale] = transform;

  // Subscribe to the LIVE node geometry so each junctor tracks its target
  // through layout shifts + drags — not just pan/zoom + group edits. The
  // previous version read positions imperatively via `flow.getInternalNode`
  // with no position subscription, so the circle stuck to wherever the
  // target sat when the junctor group last changed — the "AND circle floats
  // off on its own after a re-layout / drag" bug. `useStore` re-runs this
  // selector on every React Flow store change; `junctorsEqual` keeps it from
  // re-rendering unless a junctor's geometry actually moved. `nodeLookup`
  // entries appear once React Flow has measured the node, so the overlay
  // also fills in correctly on first paint instead of reading a stale slot.
  const junctors = useRFStore(
    (s) => computeJunctors(groups, (id) => s.nodeLookup.get(id)),
    junctorsEqual
  );
  // Goal #2 — light up a junctor circle while a connection is dragged over it
  // ("release to join this junctor"). `useConnection` re-renders the overlay
  // only when the drag starts/stops; `hoveredGroup` tracks which circle the
  // cursor is on (set by the transparent hit circle below).
  const connecting = useConnection((c) => c.inProgress);
  const [hoveredGroup, setHoveredGroup] = useState<string | null>(null);

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
              {/* Session 136 + 137 / Goal #2 — drag-to-junctor hit target.
                  A larger TRANSPARENT circle (JUNCTOR_HIT_RADIUS) owns the
                  pointer so dropping a connection onto the junctor (to
                  AND/OR/XOR-join it) is forgiving. `setHoveredJunctor` writes
                  the singleton ref in `canvasRef.ts` that
                  `useGraphMutations.onConnectEnd` reads; `setHoveredGroup`
                  drives the reactive highlight. The parent <svg> stays
                  `pointer-events-none` so only this circle catches the drag.
                  Keyboard path: the "Group as AND/OR/XOR" palette commands. */}
              {/* biome-ignore lint/a11y/noStaticElementInteractions: SVG hit target for drag-to-junctor (AND/OR/XOR); keyboard path is the "Group as <kind>" palette commands */}
              <circle
                cx={j.cx}
                cy={j.cy}
                r={JUNCTOR_HIT_RADIUS}
                fill="transparent"
                style={{ pointerEvents: 'auto' }}
                onMouseEnter={() => {
                  setHoveredJunctor({ groupId: j.id, kind: j.kind });
                  setHoveredGroup(j.id);
                }}
                onMouseLeave={() => {
                  setHoveredJunctor(null);
                  setHoveredGroup(null);
                }}
              />
              {/* Visible circle — decorative (the hit circle above owns the
                  pointer; visible radius is unchanged so the bezier terminus
                  is too). Lights up while a connection is dragged over it. */}
              <circle
                cx={j.cx}
                cy={j.cy}
                r={JUNCTOR_RADIUS}
                fill="white"
                stroke={stroke}
                strokeWidth={connecting && hoveredGroup === j.id ? 3 : 1.5}
                style={
                  connecting && hoveredGroup === j.id
                    ? { pointerEvents: 'none', filter: `drop-shadow(0 0 5px ${stroke}cc)` }
                    : { pointerEvents: 'none' }
                }
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
