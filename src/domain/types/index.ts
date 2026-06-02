/**
 * Domain types for TP Studio.
 *
 * Session 130 — finally executed the split deferred by Session 94. Each
 * cohesive concept now sits in its own file under `types/`; this barrel
 * re-exports the full surface so existing `import from '@/domain/types'`
 * call sites continue working unchanged. New code can pull from a
 * specific module (e.g. `import { EntityId } from '@/domain/types/ids'`)
 * when only one concept is needed.
 *
 * Files:
 *   - `ids.ts`         — Brand helper + branded ID types + Patch<T>
 *   - `entity.ts`      — EntityType, SpanOfControl, AttrValue, Entity
 *   - `edge.ts`        — EdgeKind, EdgeWeight, Edge
 *   - `assumption.ts`  — AssumptionStatus, Assumption
 *   - `clr.ts`         — DiagramType, ClrRuleId, ClrTier, Warning
 *   - `group.ts`       — GroupColor, Group
 *   - `customClass.ts` — CustomEntityClass
 *   - `document.ts`    — LayoutConfig, SystemScope, TPDocument
 */

export type { Assumption, AssumptionKind, AssumptionStatus } from './assumption';
export type {
  ClrRuleId,
  ClrTier,
  DiagramType,
  Warning,
  WarningAction,
  WarningTarget,
} from './clr';
export type { Comment, CommentAnchor } from './comment';
export type { CustomEntityClass } from './customClass';
export type { CloudType, LayoutConfig, SystemScope, TPDocument } from './document';
export type { Edge, EdgeKind, EdgeWeight } from './edge';
export type {
  AttrKind,
  AttrValue,
  Entity,
  EntityLink,
  EntityState,
  EntityTitleSize,
  EntityType,
  EvidenceItem,
  EvidenceSource,
  EvidenceStrength,
  ImportedFromRef,
  SpanOfControl,
} from './entity';
export type { Group, GroupColor } from './group';
export type {
  Brand,
  DocumentId,
  EdgeId,
  EntityId,
  GroupId,
  Patch,
  RevisionId,
} from './ids';
