import { useConnection, useStore as useRFStore } from '@xyflow/react';
import { useState } from 'react';
import {
  JUNCTOR_CENTER_OFFSET_Y,
  JUNCTOR_HIT_RADIUS,
  JUNCTOR_RADIUS,
  JUNCTOR_RADIUS_X,
  NODE_MIN_HEIGHT,
  NODE_WIDTH,
} from '@/domain/constants';
import { ACCENT, EDGE_PALETTES } from '@/domain/tokens';
import type { TPDocument } from '@/domain/types';
import { setHoveredJunctor } from '@/services/canvasRef';
import { useDocumentStore } from '@/store';
import { arrayShallowEqualByKeys } from '@/store/equality';
import { currentDoc } from '@/store/selectors';
import { useDocumentStoreWith } from '@/store/useDocumentStoreWithEquality';
import { junctorCenterX, junctorOutputPath } from './junctorGeometry';

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

/** Default visual treatment per junctor kind. The AND color is overridden at
 *  render time by the live edge palette (`EDGE_PALETTES[edgePalette].strokeAnd`)
 *  so it tracks Settings → Appearance; OR (indigo, the app accent) and XOR
 *  (rose, exclusionary — pairs with the mutex stroke) stay fixed. The AND
 *  default below equals the default palette's AND, so untouched diagrams look
 *  identical. */
const KIND_STROKE: Record<JunctorKind, string> = {
  AND: '#8b5cf6', // violet-500 — default-palette AND (assumption stripe)
  OR: ACCENT, // the app accent
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

// `sourceIds` — the cause entities feeding this group, so the circle can center
// over them (see `junctorCenterX`). `sourceKey` is their sorted join, a scalar
// the equality fn can compare cheaply without deep-walking the array.
type JunctorGroup = {
  id: string;
  kind: JunctorKind;
  targetId: string;
  sourceIds: string[];
  sourceKey: string;
};

// Session 135 / Perf #7 — equality fn skips re-renders when the
// junctor group set is unchanged. Unrelated edge mutations (label,
// weight, attestation) no longer churn this overlay.
// `sourceKey` is included so adding/removing a cause to an existing group (same
// id/kind/target) still re-derives the geometry.
const junctorGroupsEqual = arrayShallowEqualByKeys<JunctorGroup>([
  'id',
  'kind',
  'targetId',
  'sourceKey',
]);

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
  const byGroup = new Map<string, { kind: JunctorKind; targetId: string; sourceIds: string[] }>();
  for (const edge of Object.values(edges)) {
    for (const { kind, field } of KIND_FIELDS) {
      const gid = edge[field];
      if (!gid) continue;
      // All edges in a junctor group share the target; the first edge fixes
      // kind + targetId, and every edge contributes its source so the circle
      // can center over the causes.
      const existing = byGroup.get(gid);
      if (existing) existing.sourceIds.push(edge.sourceId);
      else byGroup.set(gid, { kind, targetId: edge.targetId, sourceIds: [edge.sourceId] });
    }
  }
  const result = [...byGroup.entries()].map(([id, v]) => ({
    id,
    kind: v.kind,
    targetId: v.targetId,
    sourceIds: v.sourceIds,
    sourceKey: [...v.sourceIds].sort().join(','),
  }));
  junctorGroupsCache.set(edges, result);
  return result;
};

/** The slice of a React Flow internal node `computeJunctors` reads. Kept
 *  minimal so the helper is trivially unit-testable with a plain object. */
type TargetNodeGeometry = {
  readonly internals: {
    readonly positionAbsolute: { readonly x: number; readonly y: number };
    // React Flow's measured handle bounds. The bottom target handle's
    // connection point (where cause-edges terminate) sits a little below the
    // measured box, so the junctor anchors to it rather than the box bottom.
    readonly handleBounds?: {
      readonly target?:
        | readonly { readonly position?: string; readonly y: number; readonly height: number }[]
        | null;
    } | null;
  };
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
    const tWidth = target.measured?.width ?? NODE_WIDTH;
    const tHeight = target.measured?.height ?? NODE_MIN_HEIGHT;
    const tX = tPos.x + tWidth / 2;
    // Anchor to the bottom target handle's ACTUAL connection point — where
    // React Flow terminates the converging cause-edges — not the measured box
    // bottom. The Bottom handle sits ~its own height below the box, so the
    // box-bottom anchor left the cause-edges stopping short of the circle.
    // Falls back to the box bottom before handle bounds are measured.
    const bottomHandle = target.internals.handleBounds?.target?.find(
      (h) => h.position === 'bottom'
    );
    const tY = bottomHandle ? tPos.y + bottomHandle.y + bottomHandle.height : tPos.y + tHeight;
    // Center the circle over the group's CAUSES (not pinned under the target),
    // so each cause rises into it from below instead of sweeping in from the
    // side. `tx`/`ty` stay at the target, so the short line up to the effect
    // becomes a clean diagonal. Falls back to `tX` until the sources measure.
    const sourceXs: number[] = [];
    for (const sid of g.sourceIds) {
      const sn = getNode(sid);
      if (!sn) continue;
      sourceXs.push(sn.internals.positionAbsolute.x + (sn.measured?.width ?? NODE_WIDTH) / 2);
    }
    const cx = junctorCenterX(sourceXs, tX);
    out.push({ id: g.id, kind: g.kind, cx, cy: tY + JUNCTOR_CENTER_OFFSET_Y, tx: tX, ty: tY });
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
  // Edge-color palette (Settings → Appearance). The AND junctor shares the AND
  // edge color, so it follows the live palette (colorblind-safe / mono); OR and
  // XOR keep their fixed semantic hues — the palette only defines an AND color.
  const edgePalette = useDocumentStore((s) => s.edgePalette);
  const kindStroke: Record<JunctorKind, string> = {
    ...KIND_STROKE,
    AND: EDGE_PALETTES[edgePalette].strokeAnd,
  };

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
        {/* One arrowhead marker per kind (different fill colors). `refX` sits the
            arrowhead just short of the target so its tip nears the effect while
            its base keeps clear space above the AND/OR/XOR circle. 20 → 15 pulls
            the arrow up off the circle (Dann: "needs a bit of space there"); the
            short output line into a directly-above effect is only ~21px, so the
            arrow base was landing right on the circle. */}
        {(['AND', 'OR', 'XOR'] as JunctorKind[]).map((kind) => (
          <marker
            key={kind}
            id={`tp-junctor-arrow-${kind.toLowerCase()}`}
            markerWidth="30"
            markerHeight="20"
            refX="15"
            refY="8"
            orient="auto"
            markerUnits="userSpaceOnUse"
          >
            <path d="M 0 0 L 13 8 L 0 16 z" fill={kindStroke[kind]} />
          </marker>
        ))}
      </defs>
      <g style={{ transform: `translate(${tx}px, ${ty}px) scale(${scale})` }}>
        {junctors.map((j) => {
          const stroke = kindStroke[j.kind];
          // Output arrow from the junctor up into the effect — a rounded "L" that
          // rises STRAIGHT UP into the card so the arrowhead reads as perpendicular,
          // not along the offset diagonal a straight line drew (Dann). Full
          // rationale + the geometry live in `junctorOutputPath`.
          const outPath = junctorOutputPath(j.cx, j.cy, j.tx, j.ty);
          return (
            <g key={j.id}>
              <path
                d={outPath}
                fill="none"
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
              {/* Visible marker — an ELLIPSE (classic TP / Flying-Logic
                  AND-connector shape). Decorative: the hit circle above owns
                  the pointer, and the vertical radius (`ry`) is unchanged so
                  the bezier terminus still lands on it. Lights up while a
                  connection is dragged over it. */}
              <ellipse
                cx={j.cx}
                cy={j.cy}
                rx={JUNCTOR_RADIUS_X}
                ry={JUNCTOR_RADIUS}
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
