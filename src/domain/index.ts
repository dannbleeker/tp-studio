/**
 * Domain barrel — selective public re-export of the domain layer.
 *
 * Session 130 — added so callers that pull multiple types can write
 *   `import type { Entity, EntityType, TPDocument } from '@/domain';`
 * instead of three separate `from '@/domain/types/...'` lines, AND so
 * a future rename of an underlying domain file (e.g.
 * `entityTypeMeta.ts` → `entityMeta.ts`) only updates the barrel, not
 * the dozens of consumer call sites.
 *
 * **Convention.** The barrel re-exports:
 *   1. The full `@/domain/types/index.ts` surface (every type used
 *      across the rest of the codebase).
 *   2. Nothing else, intentionally. Helpers, validators, exporters,
 *      and other behaviour-bearing modules keep their own per-module
 *      import paths. Re-exporting them here would:
 *      - bloat the barrel
 *      - make tree-shaking less obvious (Rolldown handles it fine but
 *        some downstream tooling doesn't)
 *      - create a one-import-per-feature norm that hides which module
 *        a call site actually depends on
 *
 * If a domain helper becomes pervasive (10+ imports) and worth
 * shortening, add it to the explicit list below — but prefer the
 * specific path until then.
 */

export type {
  Assumption,
  AssumptionStatus,
  AttrValue,
  Brand,
  ClrRuleId,
  ClrTier,
  CustomEntityClass,
  DiagramType,
  DocumentId,
  Edge,
  EdgeId,
  EdgeKind,
  EdgeWeight,
  Entity,
  EntityId,
  EntityTitleSize,
  EntityType,
  Group,
  GroupColor,
  GroupId,
  LayoutConfig,
  Patch,
  RevisionId,
  SpanOfControl,
  SystemScope,
  TPDocument,
  Warning,
  WarningAction,
  WarningTarget,
} from './types';
