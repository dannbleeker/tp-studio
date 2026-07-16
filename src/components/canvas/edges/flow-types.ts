import type { Edge as RFEdge, Node as RFNode } from '@xyflow/react';
import type { EligibilityStatus } from '@/domain/actionEligibility';
import type { EdgeRoute } from '@/domain/edgeRouting';
import type { LoopPolarity } from '@/domain/loopAnalysis';
import type { Assumption, Entity, EntityState, Group } from '@/domain/types';

export type TPNodeData = {
  entity: Entity;
  /** Session 135 / spec gap #4 — the entity's effective state for the
   *  small canvas badge: speculative override (Phase 1C) ?? manual
   *  `entity.state` ?? propagation-derived. Stamped by
   *  `useGraphNodeEmission`. Absent (`'unknown'`) renders no badge —
   *  the canvas stays clean on diagrams nobody has state-tagged. */
  effectiveState?: EntityState;
  /** Phase 1C — true when `effectiveState` comes from an active
   *  speculation override (not the persisted doc). The badge renders
   *  with a dashed ring so a hypothetical reads as "not committed". */
  speculated?: boolean;
  /** F7: when this entity has `collapsed: true` AND its downstream is hidden
   *  by useGraphView, this carries the number of descendants currently
   *  hidden so the TPNode can render a "+N" badge next to its chevron. */
  hiddenDescendantCount?: number;
  /** Number of UDE entities this entity transitively reaches via outgoing
   *  edges. Stamped by `useGraphNodeEmission` from `udeReachCounts(doc)`;
   *  rendered as a small "→N UDEs" badge when `showReachBadges` is on.
   *  Absent for diagrams without UDEs (PRT / TT / EC) and for entities
   *  that reach no UDE. */
  udeReachCount?: number;
  /** E2: number of `rootCause` entities that transitively feed this
   *  entity via incoming edges. Stamped by `useGraphNodeEmission` from
   *  `rootCauseReachCounts(doc)`; rendered as a "←N roots" badge when
   *  `showReverseReachBadges` is on. Absent on diagrams without root
   *  causes (PRT / TT / EC) and on root-cause entities themselves. */
  rootCauseReachCount?: number;
  /** H2 visual-diff status. Set only when `compareRevisionId` is active.
   *  TPNode reads this to tint the node accordingly (added/removed/changed).
   *  Absent in normal viewing mode. */
  diffStatus?: 'added' | 'removed' | 'changed';
  /** Session 135 — TT action-eligibility status for the at-a-glance
   *  canvas badge (eligible / blocked / pending). Stamped by
   *  `useGraphNodeEmission` only when `showActionEligibility` is on and
   *  the entity is an Action with a precondition slot (status !==
   *  `'na'`); absent otherwise. The full readout lives in the inspector. */
  eligibility?: Exclude<EligibilityStatus, 'na'>;
  /** Number of OPEN (unresolved) top-level review comments anchored to
   *  this entity. Stamped by `useGraphNodeEmission` from
   *  `openCommentCountsByAnchor(doc.comments)`; rendered as a clickable
   *  speech-bubble badge that opens the Comments panel. Omitted when 0. */
  openCommentCount?: number;
};

export type TPEdgeData = {
  andGroupId?: string;
  /** Bundle 8 / FL-ED3 — XOR junctor membership. Mutually exclusive with
   *  `andGroupId` / `orGroupId`; only one of the three is set at a time. */
  xorGroupId?: string;
  /** Bundle 8 / FL-ED4 — explicit OR junctor membership. */
  orGroupId?: string;
  /** When >1, this edge represents N aggregated edges across a collapsed-group
   *  boundary. Rendered with a small count badge; not selectable for editing. */
  aggregateCount?: number;
  /** Session 206 — the emission layer's OWN verdicts, stamped rather than
   *  re-derived downstream.
   *
   *  `TPEdge` used to recompute both from `aggregateCount`, which it cannot do
   *  correctly: an edge is aggregated when it bundles several edges **or** when
   *  an endpoint is a collapsed-group stand-in (`isSyntheticEndpoint`), and the
   *  second half never reaches `TPEdge` — `aggregateCount` isn't even stamped
   *  when the count is 1. So a junctor edge crossing a collapsed-group boundary
   *  read as a junctor edge here while emission had already (correctly) decided
   *  it wasn't, and the two disagreed: emission gave it an arrowhead, `TPEdge`
   *  redirected its endpoint onto a junctor circle drawn for the hidden target —
   *  an arrow into empty canvas.
   *
   *  Both are omitted when false, so a plain edge's `data` is unchanged (the
   *  memo comparator shallow-compares `data`'s keys).
   *
   *  True when this edge stands in for something other than one real edge:
   *  several bundled edges, or an endpoint remapped to a collapsed group. Such
   *  an edge has no single underlying edge to speak for, so per-edge adornments
   *  (assumptions, route, badges, the causality label) don't apply to it. */
  isAggregated?: true;
  /** True when this edge terminates at an AND/OR/XOR junctor circle rather than
   *  at its target node — i.e. junctor-grouped AND not {@link isAggregated}.
   *  Drives the endpoint redirection in `TPEdge`; complements `markerEnd`, which
   *  emission drops on exactly these edges so the junctor's own outgoing line
   *  owns the arrow. */
  isJunctorEdge?: true;
  /** Session 135 / Perf #17 — number of assumptions attached to this edge
   *  (the first-class `Assumption` records keyed to it via `record.edgeId`),
   *  precomputed once in `useGraphEdgeEmission`. Lets `TPEdge` read an O(1)
   *  count from `data` instead of iterating `doc.assumptions` inside its
   *  per-edge store selector on every store change. Omitted when 0. */
  assumptionCount?: number;
  /** Obstacle-aware routed path. When present, `TPEdge` consumes this precomputed
   *  SVG path instead of computing a bezier from React Flow's source / target
   *  handles. Stamped per edge by `useEdgeRoutes` (smart routing); omitted when the
   *  user opts into `'direct'` routing, so the edge falls back to the bezier. */
  route?: EdgeRoute;
  /** Wave 3 — true when this edge is a back-edge (manual tag ∪ the flow-aware
   *  auto-detected loop-closer). Stamped centrally by `useGraphEdgeEmission` from
   *  the set `useGraphView` computes with positions, so `TPEdge` reads it here
   *  rather than re-deriving (a per-edge component can't see the whole graph's
   *  positions to make the against-flow pick). Omitted (falsy) when not a back-edge. */
  isBackEdge?: boolean;
  /** Number of OPEN (unresolved) top-level review comments anchored to
   *  this edge. Stamped by `useGraphEdgeEmission` from
   *  `openCommentCountsByAnchor(doc.comments)`; rendered as a clickable
   *  speech-bubble badge that opens the Comments panel. Real (non-
   *  aggregated) edges only; omitted when 0. */
  openCommentCount?: number;
  /** True when this edge can be re-targeted by dragging an endpoint (a real,
   *  non-aggregated edge with real endpoints). Mirrors the top-level React Flow
   *  `reconnectable` flag so `TPEdge` can gate the visible re-target knobs
   *  without re-deriving aggregation / synthetic-endpoint state. Omitted (falsy)
   *  for aggregated and collapsed-group-synthetic edges. */
  reconnectable?: boolean;
  /** System-Dynamics lens (Session 179) — when this edge is the loop-closing
   *  back-edge of a detected cycle, its Reinforcing / Balancing classification
   *  (the product of the loop's edge polarities). Stamped by
   *  `useGraphEdgeEmission` from `loopsWithPolarity(doc)`; drives the R/B badge
   *  in `TPEdge`. Omitted on non-closing edges and on loops we can't classify. */
  loopPolarity?: LoopPolarity;
  /** Theme A / A4 (Session 180) — true when `Edge.delay` is set; drives the `//`
   *  delay marker in `TPEdge`. Stamped by `useGraphEdgeEmission`. Omitted when
   *  the edge carries no delay. */
  delay?: boolean;
  /** Theme A / A3 (Session 180) — the name of the loop this back-edge closes
   *  (`Edge.loopName`); drives the loop-name label in `TPEdge`. Stamped by
   *  `useGraphEdgeEmission`. Omitted when unnamed. */
  loopName?: string;
  /** Hover-fan (Session 185) — the source ids of the real, non-junctor edges
   *  converging on the same target as this edge (including its own source),
   *  in a stable sourceId sort. Stamped by `useGraphEdgeEmission` only when the
   *  group has 2+ members; omitted for an edge with no converging sibling.
   *  `TPEdge` reads it on hover to spread the converging edges apart so one can
   *  be grabbed. This layer is position-free, so the sourceId order is only a
   *  deterministic fallback — `TPEdge` refines the left-to-right slot order from
   *  live node positions at hover time (crossing-free), which needs no positions
   *  here. Group size (the old `fanCount`) is just `fanSiblings.length`. */
  fanSiblings?: string[];
  /** Session 199 (backlog E) — NBR readability. `onBackbone: false` marks an
   *  edge OFF the injection→UDE spine (a side branch) so `TPEdge` dims it;
   *  backbone edges and all non-NBR edges leave it undefined (no dimming).
   *  `isTurningPoint` marks the spine edge where the branch turns negative.
   *  Both stamped NBR-only by `useGraphEdgeEmission` from `nbrBackbone(doc)`. */
  onBackbone?: boolean;
  isTurningPoint?: boolean;
};

/**
 * Record-canonical: an assumption renders from its `doc.assumptions` record, NOT
 * from a `doc.entities` entity (it isn't one). Its own React Flow node type keeps
 * it out of the entity-typed `TPNode` and lets the EntityType union drop
 * `'assumption'`. Position is derived (`placeAssumptionsNearEdges`); the card is
 * non-selectable / non-draggable (set at emission) — an edge annotation, not a node.
 */
export type TPAssumptionNodeData = {
  assumption: Assumption;
  /** Open (unresolved) comments anchored to this assumption — stamped by
   *  `useGraphNodeEmission` from `openCommentCountsByAnchor`; omitted when 0. */
  openCommentCount?: number;
  /** H2 visual-diff tint, when a compare revision is active. Omitted otherwise. */
  diffStatus?: 'added' | 'removed' | 'changed';
};

export type TPGroupNodeData = {
  group: Group;
  width: number;
  height: number;
};

export type TPCollapsedGroupNodeData = {
  group: Group;
  memberCount: number;
  width: number;
  height: number;
};

export type TPNode = RFNode<TPNodeData, 'tp'>;
export type TPAssumptionNode = RFNode<TPAssumptionNodeData, 'tpAssumption'>;
export type TPEdge = RFEdge<TPEdgeData, 'tp'>;
export type TPGroupNode = RFNode<TPGroupNodeData, 'tpGroup'>;
export type TPCollapsedGroupNode = RFNode<TPCollapsedGroupNodeData, 'tpCollapsedGroup'>;

export type AnyTPNode = TPNode | TPAssumptionNode | TPGroupNode | TPCollapsedGroupNode;
