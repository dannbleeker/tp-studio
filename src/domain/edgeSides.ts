/**
 * Edge side selection — pick which of the four sides (top/bottom/left/
 * right) each end of an edge should exit / enter so the connector takes
 * the shortest sensible path between two node boxes.
 *
 * Session 138 / Feature #5. The smart router (`useEdgeRoutes`) used to
 * hard-code source = box-bottom, target = box-top. But the main canvas
 * lays out with dagre `rankdir: 'BT'`, so the cause (source) sits BELOW
 * and the effect (target) ABOVE — the old fixed anchors land on the
 * *away-facing* sides, making connectors loop the long way round. This
 * helper instead chooses the facing sides by relative position, and can
 * switch to a different side-pair when one is clearly shorter or needed
 * to dodge a node.
 *
 * Policy ("prefer flow direction", locked with the user):
 *   1. The PREFERRED pair is the facing sides along the layout's main
 *      axis (vertical for trees, horizontal for Evaporating Cloud),
 *      chosen by the two boxes' relative centres.
 *   2. Three alternatives are also scored: the cross-axis facing pair
 *      and the two "L-shaped" mixed pairs (so a diagonally-placed node
 *      can anchor on its nearer corner-ish sides — this is what makes
 *      "exit and enter on all four sides" actually happen).
 *   3. The preferred pair wins UNLESS an alternative is unblocked AND
 *      (the preferred straight shot is blocked OR the alternative is
 *      shorter by at least {@link SIDE_SWITCH_MARGIN}px). Ties break
 *      deterministically: shorter → more-facing → fixed side order.
 *
 * This is intentionally COARSE: it only decides the two anchor points.
 * The visibility-graph + A\* router still does the fine obstacle
 * avoidance between them. Pure geometry — no store, no React.
 *
 * The radial layout keeps its own router and does NOT use this.
 */

import { type Box, OBSTACLE_PADDING, type Point, segmentIntersectsBox } from './edgeRouting';

/** Which side of a node box an edge endpoint attaches to. */
export type Side = 'top' | 'bottom' | 'left' | 'right';

/** The layout's dominant flow axis. Mirrors `HandleOrientation` from
 *  `layoutStrategy.ts` (vertical for the dagre trees, horizontal for EC). */
export type Axis = 'vertical' | 'horizontal';

/** The chosen sides + their anchor points for one edge. */
export type SideSelection = {
  readonly sourceSide: Side;
  readonly sourceAnchor: Point;
  readonly targetSide: Side;
  readonly targetAnchor: Point;
};

export type SelectSidesInput = {
  readonly sourceBox: Box;
  readonly targetBox: Box;
  /** Layout's main axis — the preferred pair lies along this. */
  readonly axis: Axis;
  /** Bounding boxes of every OTHER visible node (source/target already
   *  excluded by the caller). Used only to detect a blocked straight shot. */
  readonly obstacles: readonly Box[];
  /**
   * Junctor edges terminate at the junctor circle's bottom perimeter
   * (a fixed point below the target node), not on a target side. When
   * set, the target side is forced to `'bottom'` and only the source
   * side is chosen.
   */
  readonly targetAnchorOverride?: Point;
};

/**
 * An alternative side-pair must beat the preferred pair by at least this
 * many pixels to justify leaving the layout's main axis. At ~2× a node's
 * short side (NODE_MIN_HEIGHT = 72) the flow axis (vertical for trees) wins
 * for any normally-spaced sibling: a node one column over saves only
 * ~100–120px by cornering to a side, which no longer clears the bar, so its
 * connector stays vertical. A node two-plus columns offset (saving >150px)
 * can still corner, and a *blocked* straight shot still switches regardless
 * — that branch isn't gated by this margin, so obstacle-dodging is intact.
 * Raised 60 → 150 (Session 146, Dann's call) to keep tree connectors
 * entering on the flow axis; EC is unaffected (its preferred axis is
 * horizontal).
 */
export const SIDE_SWITCH_MARGIN = 150;

const ALL_SIDES: readonly Side[] = ['top', 'bottom', 'left', 'right'];

/** Tie-break ordering when two candidates are otherwise equal. */
const SIDE_ORDER: Record<Side, number> = { bottom: 0, top: 1, right: 2, left: 3 };

/** Mid-point of a box side, in flow coordinates. */
export const sideAnchor = (b: Box, side: Side): Point => {
  switch (side) {
    case 'top':
      return { x: b.x + b.width / 2, y: b.y };
    case 'bottom':
      return { x: b.x + b.width / 2, y: b.y + b.height };
    case 'left':
      return { x: b.x, y: b.y + b.height / 2 };
    case 'right':
      return { x: b.x + b.width, y: b.y + b.height / 2 };
  }
};

const boxCenter = (b: Box): Point => ({ x: b.x + b.width / 2, y: b.y + b.height / 2 });

const otherAxis = (a: Axis): Axis => (a === 'vertical' ? 'horizontal' : 'vertical');

const sideAxis = (s: Side): Axis => (s === 'top' || s === 'bottom' ? 'vertical' : 'horizontal');

/** A straight facing pair sits on the same axis, opposite sides. */
const isFacingPair = (s: Side, t: Side): boolean => sideAxis(s) === sideAxis(t) && s !== t;

/**
 * The facing sides for a given axis, decided by the two reference points'
 * relative position. Vertical: if the target is below the source, the
 * source exits its bottom and the target is entered at its top; mirror
 * otherwise. Horizontal likewise on left/right.
 */
const facingSides = (from: Point, to: Point, axis: Axis): { source: Side; target: Side } => {
  if (axis === 'vertical') {
    return to.y >= from.y
      ? { source: 'bottom', target: 'top' }
      : { source: 'top', target: 'bottom' };
  }
  return to.x >= from.x ? { source: 'right', target: 'left' } : { source: 'left', target: 'right' };
};

/** Widen a box by `pad` on every side (no-fly margin for the block test). */
const inflate = (b: Box, pad: number): Box => ({
  x: b.x - pad,
  y: b.y - pad,
  width: b.width + 2 * pad,
  height: b.height + 2 * pad,
});

const isBlocked = (a: Point, t: Point, obstacles: readonly Box[]): boolean =>
  obstacles.some((o) => segmentIntersectsBox(a, t, inflate(o, OBSTACLE_PADDING)));

type Candidate = { readonly sourceSide: Side; readonly targetSide: Side };

type Scored = Candidate & {
  readonly sourceAnchor: Point;
  readonly targetAnchor: Point;
  readonly len: number;
  readonly blocked: boolean;
};

/**
 * Build the candidate side-pairs. Non-junctor edges get four: the
 * preferred (flow-axis facing) pair, the cross-axis facing pair, and
 * the two L-shaped mixed pairs. Junctor edges fix the target at the
 * circle override and vary only the source side. The preferred
 * candidate is always first.
 */
const buildCandidates = (
  sc: Point,
  tc: Point,
  axis: Axis,
  isJunctor: boolean
): readonly Candidate[] => {
  if (isJunctor) {
    const pref = facingSides(sc, tc, axis).source;
    return [pref, ...ALL_SIDES.filter((s) => s !== pref)].map((s) => ({
      sourceSide: s,
      targetSide: 'bottom' as Side,
    }));
  }
  const pref = facingSides(sc, tc, axis);
  const cross = facingSides(sc, tc, otherAxis(axis));
  return [
    { sourceSide: pref.source, targetSide: pref.target }, // preferred (index 0)
    { sourceSide: cross.source, targetSide: cross.target }, // cross-axis facing
    { sourceSide: pref.source, targetSide: cross.target }, // L-shaped
    { sourceSide: cross.source, targetSide: pref.target }, // L-shaped
  ];
};

const compareScored = (a: Scored, b: Scored): number => {
  if (Math.abs(a.len - b.len) > 1e-6) return a.len - b.len;
  const fa = isFacingPair(a.sourceSide, a.targetSide) ? 0 : 1;
  const fb = isFacingPair(b.sourceSide, b.targetSide) ? 0 : 1;
  if (fa !== fb) return fa - fb;
  return SIDE_ORDER[a.sourceSide] - SIDE_ORDER[b.sourceSide];
};

/** Do the two boxes overlap along the given axis (i.e. share a rank)? When they
 *  don't — the usual tree parent/child case — the flow-axis facing is the real
 *  one, so we keep the target entered on it rather than cornering to a side. */
const overlapsOnAxis = (a: Box, b: Box, axis: Axis): boolean =>
  axis === 'vertical'
    ? a.y < b.y + b.height && b.y < a.y + a.height
    : a.x < b.x + b.width && b.x < a.x + a.width;

/**
 * Choose the source/target sides + anchor points for one edge. See the
 * module header for the policy. Always returns a usable selection — if
 * every candidate's straight shot is blocked it falls back to the
 * preferred pair and lets A\* detour.
 */
export const selectEdgeSides = (input: SelectSidesInput): SideSelection => {
  const { sourceBox, targetBox, axis, obstacles, targetAnchorOverride } = input;
  const sc = boxCenter(sourceBox);
  const tc = targetAnchorOverride ?? boxCenter(targetBox);
  const isJunctor = targetAnchorOverride != null;

  const candidates = buildCandidates(sc, tc, axis, isJunctor);
  const scored: Scored[] = candidates.map((c) => {
    const sourceAnchor = sideAnchor(sourceBox, c.sourceSide);
    const targetAnchor = targetAnchorOverride ?? sideAnchor(targetBox, c.targetSide);
    const len = Math.hypot(targetAnchor.x - sourceAnchor.x, targetAnchor.y - sourceAnchor.y);
    return {
      ...c,
      sourceAnchor,
      targetAnchor,
      len,
      blocked: isBlocked(sourceAnchor, targetAnchor, obstacles),
    };
  });

  // Preferred is index 0 by construction.
  const preferred = scored[0];
  if (!preferred) throw new Error('selectEdgeSides: no candidates');

  // An alternative qualifies only when it is unblocked AND either the preferred
  // shot is blocked or it's meaningfully shorter. PLUS: a different-rank edge —
  // the usual tree parent/child — must ENTER the target on the flow axis. A
  // far-offset parent entered on its left/right "just because it's shorter"
  // reads as wrong (Dann: "it looks wrong that this enters in the side"), so a
  // cross-axis TARGET side is allowed for a shortness switch only when the two
  // boxes share a rank (same-level neighbours, where the cross axis IS the real
  // facing). A blocked preferred still dodges to any side.
  const sameRank = overlapsOnAxis(sourceBox, targetBox, axis);
  const qualifying = scored.filter((c) => {
    if (c === preferred || c.blocked) return false;
    if (preferred.blocked) return true;
    const targetSwitchOk = c.targetSide === preferred.targetSide || sameRank;
    return targetSwitchOk && c.len + SIDE_SWITCH_MARGIN < preferred.len;
  });
  const winner = qualifying.length > 0 ? [...qualifying].sort(compareScored)[0]! : preferred;

  return {
    sourceSide: winner.sourceSide,
    sourceAnchor: winner.sourceAnchor,
    targetSide: winner.targetSide,
    targetAnchor: winner.targetAnchor,
  };
};
