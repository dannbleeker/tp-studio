import type { Edge, Entity, Group, TPDocument } from './types';

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
    // Session 117 — destructured-rest pattern to actually omit the
    // description field (rather than set it to undefined, which
    // exactOptionalPropertyTypes rejects on the optional `Entity.description`).
    const { description: _drop, ...rest } = e;
    entities[e.id] = { ...rest, title: `#${e.annotationNumber}` };
  }

  const edges = Object.fromEntries(
    Object.values(doc.edges).map((edge) => {
      // Same emit-or-omit pattern for `label`.
      const { label: _drop, ...rest } = edge;
      return [edge.id, rest as Edge];
    })
  );

  const groups: Record<string, Group> = {};
  for (const [i, g] of Object.values(doc.groups).entries()) {
    groups[g.id] = { ...g, title: `Group ${i + 1}` };
  }

  // Author + description omitted at the doc level too.
  const { author: _dropAuthor, description: _dropDesc, ...docRest } = doc;
  return {
    ...docRest,
    title: 'Untitled',
    entities,
    edges,
    groups,
  };
};
