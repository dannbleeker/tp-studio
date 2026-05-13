import type { Entity, Group, TPDocument } from './types';

/**
 * Strip user-supplied text from a document so it can be safely shared
 * outside the organization (A7).
 *
 * Replaces:
 *   - Entity titles → "#N" (the entity's annotation number, stable).
 *   - Entity descriptions → empty.
 *   - Group titles → "Group N".
 *   - Edge labels → empty.
 *   - Document title → "Untitled".
 *   - Document author / description → empty.
 *
 * Preserves structure: every entity, edge, group, AND-grouping, and
 * annotation number stays exactly where it was so the redacted file is
 * structurally identical to the original. This is purely a content scrub.
 *
 * The function is pure — it does NOT mutate the input. Callers wrap their
 * export pipeline with `redactDocument(doc)` to share without leaking.
 */
export const redactDocument = (doc: TPDocument): TPDocument => {
  const entities: Record<string, Entity> = {};
  for (const e of Object.values(doc.entities)) {
    entities[e.id] = {
      ...e,
      title: `#${e.annotationNumber}`,
      // The `description` field is omitted entirely when redacted (rather
      // than blanked) so consumers that switch on its presence don't see
      // a stray empty-string description.
      description: undefined,
    };
  }

  const edges = Object.fromEntries(
    Object.values(doc.edges).map((edge) => [
      edge.id,
      // Drop edge labels but keep the structural andGroupId / assumptionIds.
      { ...edge, label: undefined },
    ])
  );

  const groups: Record<string, Group> = {};
  for (const [i, g] of Object.values(doc.groups).entries()) {
    groups[g.id] = { ...g, title: `Group ${i + 1}` };
  }

  return {
    ...doc,
    title: 'Untitled',
    author: undefined,
    description: undefined,
    entities,
    edges,
    groups,
  };
};
