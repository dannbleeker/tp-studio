/**
 * Z-3 — place an *anchored* assumption card beside the edge it annotates.
 *
 * An assumption renders as a card on the canvas but has no causal edges of its
 * own (the first-class record names its host edge via `edgeId`, drawn as a
 * dashed connector by `AssumptionAnchorOverlay`). dagre lays out by edges, so an
 * assumption is an isolated 1-node component and gets packed into a far corner —
 * which reads as "the assumption is rendered very very far away" (Dann's Z-3).
 *
 * The fix: exclude anchored assumptions from the dagre input (they contribute
 * nothing to the structural layout, so the real graph is unchanged), then place
 * each one beside the midpoint of the edge it annotates — pushed perpendicular
 * to the edge, on the side farther from the structural centroid so it lands in
 * open space rather than back over the diagram.
 *
 * Pure geometry: same TOP-LEFT position convention as the dagre output it
 * augments (`{x,y}` is a card's top-left). No React, no DOM.
 */

import type { TPDocument } from '@/domain/types';

type XY = { x: number; y: number };

/** Perpendicular push (px, midpoint→card-centre) of an assumption off its edge. */
export const ASSUMPTION_EDGE_OFFSET = 220;
/** Along-edge stagger (px) for multiple assumptions sharing one anchor edge. */
const ASSUMPTION_STACK_STEP = 130;

type AssumptionAnchor = { sourceId: string; targetId: string; index: number };

/**
 * Map each anchored assumption id → its host edge's endpoints, plus a per-edge
 * `index` (0-based) used to stagger multiple assumptions sharing one anchor edge.
 * Record-canonical: walks `doc.assumptions` (each record names its host `edgeId`);
 * records whose host edge no longer exists are skipped.
 */
export const anchoredAssumptionEdges = (doc: TPDocument): Map<string, AssumptionAnchor> => {
  const out = new Map<string, AssumptionAnchor>();
  const perEdge = new Map<string, number>();
  for (const a of Object.values(doc.assumptions ?? {})) {
    const edge = doc.edges[a.edgeId];
    if (!edge) continue;
    const key = `${edge.sourceId}>${edge.targetId}`;
    const index = perEdge.get(key) ?? 0;
    perEdge.set(key, index + 1);
    out.set(a.id, { sourceId: edge.sourceId, targetId: edge.targetId, index });
  }
  return out;
};

/** The set of assumption ids that {@link placeAssumptionsNearEdges} will place —
 *  exclude exactly these from the dagre input so they aren't dumped in a corner. */
export const anchoredAssumptionIds = (doc: TPDocument): Set<string> =>
  new Set(anchoredAssumptionEdges(doc).keys());

/**
 * Top-left positions for the anchored assumption cards, each beside the midpoint
 * of the edge it annotates. `structural` is the laid-out top-left map (with
 * assumptions excluded); `sizeOf` returns a node's box size. Assumptions whose
 * anchor endpoints aren't in `structural` (e.g. inside a collapsed group) are
 * skipped — the caller leaves those to the default layout.
 */
export const placeAssumptionsNearEdges = (
  doc: TPDocument,
  structural: Record<string, XY>,
  sizeOf: (id: string) => { width: number; height: number }
): Record<string, XY> => {
  const anchors = anchoredAssumptionEdges(doc);
  if (anchors.size === 0) return {};

  const centreOf = (id: string): XY | null => {
    const p = structural[id];
    if (!p) return null;
    const s = sizeOf(id);
    return { x: p.x + s.width / 2, y: p.y + s.height / 2 };
  };

  // Structural centroid — the perpendicular push goes to whichever side of the
  // edge is farther from it, so the card lands outward into open space.
  let gx = 0;
  let gy = 0;
  let gn = 0;
  for (const id of Object.keys(structural)) {
    const c = centreOf(id);
    if (!c) continue;
    gx += c.x;
    gy += c.y;
    gn += 1;
  }
  const cgx = gn > 0 ? gx / gn : 0;
  const cgy = gn > 0 ? gy / gn : 0;
  const dist2 = (x: number, y: number): number => (x - cgx) ** 2 + (y - cgy) ** 2;

  const out: Record<string, XY> = {};
  for (const [aid, anchor] of anchors) {
    const sc = centreOf(anchor.sourceId);
    const tc = centreOf(anchor.targetId);
    if (!sc || !tc) continue;
    const midX = (sc.x + tc.x) / 2;
    const midY = (sc.y + tc.y) / 2;
    const len = Math.hypot(tc.x - sc.x, tc.y - sc.y) || 1;
    const dx = (tc.x - sc.x) / len;
    const dy = (tc.y - sc.y) / len;
    // Unit perpendicular to the edge.
    const px = -dy;
    const py = dx;
    const off = ASSUMPTION_EDGE_OFFSET;
    const outward =
      dist2(midX + px * off, midY + py * off) >= dist2(midX - px * off, midY - py * off) ? 1 : -1;
    const stagger = anchor.index * ASSUMPTION_STACK_STEP;
    const cx = midX + outward * px * off + dx * stagger;
    const cy = midY + outward * py * off + dy * stagger;
    const size = sizeOf(aid);
    out[aid] = { x: cx - size.width / 2, y: cy - size.height / 2 };
  }
  return out;
};
