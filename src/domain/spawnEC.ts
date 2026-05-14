import { newDocumentId, newEdgeId, newEntityId } from './ids';
import type { Edge, Entity, EntityId, TPDocument } from './types';

/**
 * Spawn a fresh Evaporating Cloud document seeded from a CRT entity (typically
 * the identified Core Driver). The book's prescription: "after producing a
 * CRT, recast the Core Driver as the Core Conflict and explore it with an
 * EC." This action does that without forcing the user into multi-document
 * tab plumbing — the spawned doc fully replaces the current one via the
 * existing `setDocument` action, which auto-snapshots the outgoing CRT as
 * a revision (Session 41's H1 work).
 *
 * Layout uses the same canonical 5-box coordinates as `INITIAL_DOC_BY_DIAGRAM.ec`
 * and `buildExampleEC` so the new doc looks like every other freshly-opened
 * EC. The seed entity is copied into the **Want 1** slot — under the book's
 * framing, the Core Driver IS one side of the conflict. The user fills in
 * Goal / Need 1 / Need 2 / Want 2 to complete the diagnostic.
 *
 * The new doc's `id` is freshly generated so the autosnapshot key on the
 * outgoing doc doesn't get mixed up with the new one.
 */

const EC_SEED_POSITIONS = {
  goal: { x: 100, y: 250 },
  need1: { x: 450, y: 100 },
  need2: { x: 450, y: 400 },
  want1: { x: 800, y: 100 },
  want2: { x: 800, y: 400 },
} as const;

const buildEntity = (
  type: Entity['type'],
  title: string,
  t: number,
  annotationNumber: number,
  position: { x: number; y: number }
): Entity => ({
  id: newEntityId(),
  type,
  title,
  annotationNumber,
  createdAt: t,
  updatedAt: t,
  position,
});

const buildEdge = (sourceId: EntityId, targetId: EntityId): Edge => ({
  id: newEdgeId(),
  sourceId,
  targetId,
  kind: 'sufficiency',
});

export const spawnECFromConflict = (
  sourceDoc: TPDocument,
  conflictEntityId: string
): TPDocument => {
  const source = sourceDoc.entities[conflictEntityId];
  const conflictTitle = source?.title?.trim() || 'Want 1 — name this strategy';
  const t = Date.now();

  const goal = buildEntity(
    'goal',
    'Common goal — what both sides ultimately serve',
    t,
    1,
    EC_SEED_POSITIONS.goal
  );
  const need1 = buildEntity(
    'need',
    'Need 1 — what does Want 1 satisfy?',
    t,
    2,
    EC_SEED_POSITIONS.need1
  );
  const need2 = buildEntity(
    'need',
    'Need 2 — what does Want 2 satisfy?',
    t,
    3,
    EC_SEED_POSITIONS.need2
  );
  const want1 = buildEntity('want', conflictTitle, t, 4, EC_SEED_POSITIONS.want1);
  const want2 = buildEntity(
    'want',
    'Want 2 — the conflicting strategy',
    t,
    5,
    EC_SEED_POSITIONS.want2
  );

  const entities = [goal, need1, need2, want1, want2];
  const edges: Edge[] = [
    // Wants → Needs they satisfy
    buildEdge(want1.id, need1.id),
    buildEdge(want2.id, need2.id),
    // Needs → Goal they support
    buildEdge(need1.id, goal.id),
    buildEdge(need2.id, goal.id),
  ];

  // Title prefix the source title so the user can tell which CRT the EC
  // came from in the revisions panel. Capped at 40 chars to keep the title
  // bar readable.
  const titlePrefix = conflictTitle.slice(0, 40);
  const title = source ? `EC from "${titlePrefix}"` : 'New Evaporating Cloud';

  return {
    id: newDocumentId(),
    diagramType: 'ec',
    title,
    entities: Object.fromEntries(entities.map((e) => [e.id, e])),
    edges: Object.fromEntries(edges.map((e) => [e.id, e])),
    groups: {},
    resolvedWarnings: {},
    nextAnnotationNumber: 6,
    createdAt: t,
    updatedAt: t,
    schemaVersion: 7,
  };
};
