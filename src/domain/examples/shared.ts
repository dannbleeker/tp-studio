import { newEdgeId, newEntityId } from '../ids';
import type { Edge, EdgeKind, Entity, EntityId, EntityType } from '../types';

/**
 * Small entity / edge builder helpers used by every example file. Lifted
 * out of the monolith so each per-diagram builder file imports them
 * directly rather than re-implementing the id + timestamp boilerplate.
 *
 * Session 87 hotfix: extended both builders to surface the v6 → v7
 * schema additions (Entity.ecSlot, Edge.kind = 'necessity',
 * Edge.isMutualExclusion). Pre-hotfix the EC example loader produced a
 * diagram with no ecSlot bindings, sufficiency-typed edges, and no
 * mutex arrow — which made the Session 87 verbalisation / per-slot
 * guiding-question / completeness-rule features look unimplemented to
 * any first-time user evaluating the new chrome via the "Load example
 * Evaporating Cloud" path.
 */

export const buildEntity = (
  type: EntityType,
  title: string,
  t: number,
  annotationNumber: number,
  extras: Partial<
    Pick<Entity, 'ordering' | 'position' | 'unspecified' | 'description' | 'ecSlot'>
  > = {}
): Entity => ({
  id: newEntityId(),
  type,
  title,
  annotationNumber,
  createdAt: t,
  updatedAt: t,
  ...extras,
});

/**
 * Edge options for examples. Kept narrow on purpose — examples don't
 * need (and shouldn't carry) the full `Edge` field surface; what they
 * do need is the structural-typing knobs (`andGroupId` for AND junctors,
 * `kind` for the v7 sufficiency/necessity distinction,
 * `isMutualExclusion` for the EC D↔D′ arrow). Anything else stays in
 * the per-diagram builder file via a plain spread.
 */
type BuildEdgeOpts = {
  andGroupId?: string;
  kind?: EdgeKind;
  isMutualExclusion?: boolean;
};

export const buildEdge = (sourceId: EntityId, targetId: EntityId, opts?: BuildEdgeOpts): Edge => ({
  id: newEdgeId(),
  sourceId,
  targetId,
  kind: opts?.kind ?? 'sufficiency',
  ...(opts?.andGroupId ? { andGroupId: opts.andGroupId } : {}),
  ...(opts?.isMutualExclusion ? { isMutualExclusion: opts.isMutualExclusion } : {}),
});
