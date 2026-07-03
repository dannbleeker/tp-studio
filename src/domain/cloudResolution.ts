import { isOfBuiltin } from './entityTypeMeta';
import { assumptionsForEdge } from './graph';
import type { Entity, EntityId, TPDocument } from './types';

/**
 * "Did this Evaporating Cloud actually evaporate?" — the doc-level predicate
 * behind the canvas celebration (Session 195 easter egg) and any future
 * "cloud broken" badge.
 *
 * TOC-correct definition: a cloud evaporates when ONE assumption under the
 * D↔D′ conflict arrow is invalidated by an implemented injection — not when
 * every assumption is addressed. This deliberately reuses the Injection
 * Workbench's existing semantic (implemented injection → linked assumptions
 * + edge render as "evaporated") rather than inventing a stricter rule, so
 * the two surfaces can't disagree about what "resolved" means.
 */
export type CloudResolution =
  | { resolved: false }
  | {
      resolved: true;
      conflictEdgeId: string;
      /** The two Want entities on the conflict arrow — the boxes the canvas
       *  effect dissolves. */
      wantIds: EntityId[];
    };

const UNRESOLVED: CloudResolution = { resolved: false };

const isImplementedInjection = (doc: TPDocument, entity: Entity | undefined): boolean => {
  if (!entity || !isOfBuiltin(entity.type, 'injection', doc.customEntityClasses)) return false;
  const attr = entity.attributes?.implemented;
  return attr?.kind === 'bool' && attr.value === true;
};

export const resolveCloudState = (doc: TPDocument): CloudResolution => {
  if (doc.diagramType !== 'ec') return UNRESOLVED;
  // The conflict arrow is the mutual-exclusion edge between the two Wants —
  // `isOfBuiltin` so custom classes count, matching ec-missing-conflict's
  // definition of "this really is a cloud".
  const conflictEdge = Object.values(doc.edges).find((e) => {
    if (e.isMutualExclusion !== true) return false;
    const source = doc.entities[e.sourceId];
    const target = doc.entities[e.targetId];
    return (
      source !== undefined &&
      target !== undefined &&
      isOfBuiltin(source.type, 'want', doc.customEntityClasses) &&
      isOfBuiltin(target.type, 'want', doc.customEntityClasses)
    );
  });
  if (!conflictEdge) return UNRESOLVED;
  const broken = assumptionsForEdge(doc, conflictEdge.id).some((a) =>
    (a.injectionIds ?? []).some((id) => isImplementedInjection(doc, doc.entities[id]))
  );
  if (!broken) return UNRESOLVED;
  return {
    resolved: true,
    conflictEdgeId: conflictEdge.id,
    wantIds: [conflictEdge.sourceId, conflictEdge.targetId],
  };
};
