import type { Edge as RFEdge, Node as RFNode } from '@xyflow/react';
import type { EligibilityStatus } from '@/domain/actionEligibility';
import type { EdgeRoute } from '@/domain/edgeRouting';
import type { Entity, EntityState, Group } from '@/domain/types';

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
  /** Session 135 / Perf #17 — number of assumptions attached to this edge
   *  (legacy `assumptionIds` ∪ first-class `Assumption` records keyed to it),
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
export type TPEdge = RFEdge<TPEdgeData, 'tp'>;
export type TPGroupNode = RFNode<TPGroupNodeData, 'tpGroup'>;
export type TPCollapsedGroupNode = RFNode<TPCollapsedGroupNodeData, 'tpCollapsedGroup'>;

export type AnyTPNode = TPNode | TPGroupNode | TPCollapsedGroupNode;
