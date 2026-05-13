import type { Entity, Group } from '@/domain/types';
import type { Edge as RFEdge, Node as RFNode } from '@xyflow/react';

export type TPNodeData = {
  entity: Entity;
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
