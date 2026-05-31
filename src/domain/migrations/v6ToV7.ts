import { isPlainObject, type Migration } from './shared';

/**
 * v6 → v7: brief §4 — first-class Assumption records, explicit
 * `Edge.kind: 'sufficiency' | 'necessity'`, explicit `Entity.ecSlot`,
 * and a new `'goalTree'` diagram type. The migration:
 *
 *   1. **Edge.kind**: every edge in an EC document becomes
 *      `'necessity'`; all other diagram types keep `'sufficiency'`.
 *      Goal Tree didn't exist as a diagram type pre-v7 so no pre-v7
 *      doc has one to migrate.
 *
 *   2. **Entity.ecSlot**: for each EC doc, walk the entities; map
 *      the 5 canonical seed coordinates to `'a' | 'b' | 'c' | 'd' |
 *      'dPrime'`. Coordinates that don't match a canonical position
 *      get no slot binding (the entity stays in the diagram but
 *      isn't pinned to a slot). The seed coordinates are constants
 *      shared with `factory.ts`'s `EC_POSITIONS`.
 *
 *   3. **Assumption records**: for each Entity with
 *      `type: 'assumption'`, create a matching `Assumption` record
 *      keyed by the same id, with `status: 'unexamined'` and `edgeId`
 *      copied from the first edge whose `assumptionIds` list contains
 *      this entity. The Entity record itself stays (back-compat shim)
 *      — only the new `assumptions` map is populated. Inspector code
 *      reads status from `doc.assumptions[id]`, text from
 *      `doc.entities[id].title`.
 *
 *   4. **`assumptions` field initialisation**: add an empty map when
 *      there are no assumption entities; populated otherwise.
 */
const EC_SEED_POSITIONS: Record<string, 'a' | 'b' | 'c' | 'd' | 'dPrime'> = {
  '100,250': 'a',
  '450,100': 'b',
  '450,400': 'c',
  '800,100': 'd',
  '800,400': 'dPrime',
};

export const v6ToV7: Migration = {
  fromVersion: 6,
  toVersion: 7,
  description:
    'First-class Assumption records, Edge.kind sufficiency/necessity, Entity.ecSlot, goalTree diagram type.',
  migrate: (raw) => {
    if (!isPlainObject(raw)) return raw;
    const diagramType = typeof raw.diagramType === 'string' ? raw.diagramType : '';
    const isEC = diagramType === 'ec';
    // 1. + 2. Edge.kind + Entity.ecSlot.
    const entitiesRaw = isPlainObject(raw.entities) ? raw.entities : {};
    const edgesRaw = isPlainObject(raw.edges) ? raw.edges : {};
    const nextEntities: Record<string, Record<string, unknown>> = {};
    for (const [id, ent] of Object.entries(entitiesRaw)) {
      if (!isPlainObject(ent)) {
        nextEntities[id] = ent as Record<string, unknown>;
        continue;
      }
      let nextEnt: Record<string, unknown> = { ...ent };
      if (isEC && isPlainObject(ent.position)) {
        const x = typeof ent.position.x === 'number' ? ent.position.x : Number.NaN;
        const y = typeof ent.position.y === 'number' ? ent.position.y : Number.NaN;
        const slot = EC_SEED_POSITIONS[`${x},${y}`];
        if (slot && nextEnt.ecSlot === undefined) {
          nextEnt = { ...nextEnt, ecSlot: slot };
        }
      }
      nextEntities[id] = nextEnt;
    }
    const nextEdges: Record<string, Record<string, unknown>> = {};
    for (const [id, edge] of Object.entries(edgesRaw)) {
      if (!isPlainObject(edge)) {
        nextEdges[id] = edge as Record<string, unknown>;
        continue;
      }
      const hadKind = typeof edge.kind === 'string';
      // Pre-v7 the only stored kind was 'sufficiency'; EC docs become
      // 'necessity' on migration. Anything else stays whatever it had.
      const nextKind = isEC ? 'necessity' : hadKind ? edge.kind : 'sufficiency';
      nextEdges[id] = { ...edge, kind: nextKind };
    }
    // 3. Assumption records — find every assumption-Entity, locate its
    // edge via reverse-walk of edges[*].assumptionIds, mint an
    // Assumption record with status 'unexamined'.
    const nextAssumptions: Record<string, Record<string, unknown>> = isPlainObject(raw.assumptions)
      ? (raw.assumptions as Record<string, Record<string, unknown>>)
      : {};
    for (const [id, ent] of Object.entries(nextEntities)) {
      if (!isPlainObject(ent) || ent.type !== 'assumption') continue;
      if (nextAssumptions[id]) continue; // already migrated
      const edgeEntry = Object.entries(nextEdges).find(
        ([, e]) =>
          isPlainObject(e) && Array.isArray(e.assumptionIds) && e.assumptionIds.includes(id)
      );
      // Orphaned assumption-Entity (referenced by no edge's `assumptionIds`):
      // skip minting a first-class record. A record with `edgeId: ''` would
      // never match a real edge — it just dangles, invisible in the
      // AssumptionWell. The legacy assumption-Entity is left as-is.
      if (!edgeEntry) continue;
      const edgeId = edgeEntry[0];
      const text = typeof ent.title === 'string' ? ent.title : '';
      const now = typeof ent.createdAt === 'number' ? ent.createdAt : Date.now();
      nextAssumptions[id] = {
        id,
        edgeId,
        text,
        status: 'unexamined',
        createdAt: now,
        updatedAt: now,
      };
    }
    return {
      ...raw,
      entities: nextEntities,
      edges: nextEdges,
      assumptions: nextAssumptions,
      schemaVersion: 7,
    };
  },
};
