// Forward-only schema migration framework. A migration takes a parsed-but-not-yet-
// validated document and bumps its `schemaVersion` by exactly one. `importFromJSON`
// calls `migrateToCurrent` before its strict shape check, so today's importer can
// continue to assume `schemaVersion === CURRENT_SCHEMA_VERSION`.
//
// Today the registry is empty — every saved document already targets v1. The
// framework is here so Phase 3 (groups), Phase 6 (edge labels), and Phase 1 / 13
// (annotation numbers) can land their own migrations without re-inventing the
// loop.

export type SchemaVersion = number;
export type RawDocument = unknown;

export type Migration = {
  fromVersion: SchemaVersion;
  toVersion: SchemaVersion;
  description: string;
  migrate: (doc: RawDocument) => RawDocument;
};

/** Bump this constant when a new migration is registered. */
export const CURRENT_SCHEMA_VERSION: SchemaVersion = 7;

const isPlainObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

/**
 * v1 → v2: introduce stable per-document annotation numbers and the
 * `nextAnnotationNumber` counter. Walks entities in (createdAt asc, id asc)
 * order and numbers them 1..N. Older docs predate the field; new docs
 * created post-v2 carry it from the start. Also adds the optional
 * `author` / `description` fields on the document (no defaults required).
 */
const v1ToV2: Migration = {
  fromVersion: 1,
  toVersion: 2,
  description: 'Assign Entity.annotationNumber, add TPDocument.nextAnnotationNumber.',
  migrate: (raw) => {
    if (!isPlainObject(raw)) return raw;
    const entitiesRaw = isPlainObject(raw.entities) ? raw.entities : {};
    const entries = Object.entries(entitiesRaw).filter(
      (entry): entry is [string, Record<string, unknown>] => isPlainObject(entry[1])
    );
    // Order numbers by createdAt then id so the assignment is deterministic
    // for any given input doc.
    entries.sort(([aId, a], [bId, b]) => {
      const aCreated = typeof a.createdAt === 'number' ? a.createdAt : 0;
      const bCreated = typeof b.createdAt === 'number' ? b.createdAt : 0;
      if (aCreated !== bCreated) return aCreated - bCreated;
      return aId < bId ? -1 : aId > bId ? 1 : 0;
    });
    const nextEntities: Record<string, Record<string, unknown>> = {};
    let n = 0;
    for (const [id, entity] of entries) {
      n += 1;
      nextEntities[id] = { ...entity, annotationNumber: n };
    }
    return {
      ...raw,
      entities: nextEntities,
      nextAnnotationNumber: n + 1,
      schemaVersion: 2,
    };
  },
};

/**
 * v2 → v3: introduce the Group system. Adds an empty `groups: {}` map; no
 * existing entity / edge data needs to change. Future docs that contain
 * groups will round-trip through this migration unchanged when re-loaded.
 */
const v2ToV3: Migration = {
  fromVersion: 2,
  toVersion: 3,
  description: 'Add TPDocument.groups (empty map).',
  migrate: (raw) => {
    if (!isPlainObject(raw)) return raw;
    return {
      ...raw,
      groups: isPlainObject(raw.groups) ? raw.groups : {},
      schemaVersion: 3,
    };
  },
};

/**
 * v3 → v4: introduce optional `Edge.label`. No edges need to change shape;
 * the migration is purely a schema-version bump so future readers know how
 * to interpret the field.
 */
const v3ToV4: Migration = {
  fromVersion: 3,
  toVersion: 4,
  description: 'Allow Edge.label (no data shape change).',
  migrate: (raw) => {
    if (!isPlainObject(raw)) return raw;
    return { ...raw, schemaVersion: 4 };
  },
};

/**
 * v4 → v5: introduce optional `Entity.attestation` (Bucket E source /
 * evidence citation) and optional `TPDocument.layoutConfig` (Bundle 4
 * per-doc dagre knobs). Like v3→v4, both are purely additive optional
 * fields — no existing data shape changes. The migration is a version
 * bump so future readers know which fields they can expect.
 */
const v4ToV5: Migration = {
  fromVersion: 4,
  toVersion: 5,
  description: 'Allow Entity.attestation and TPDocument.layoutConfig (no data shape change).',
  migrate: (raw) => {
    if (!isPlainObject(raw)) return raw;
    return { ...raw, schemaVersion: 5 };
  },
};

/**
 * v5 → v6: introduce optional `Entity.attributes` (B7 — user-defined
 * attributes) and optional `TPDocument.customEntityClasses` (B10 —
 * user-defined entity classes). Both are purely additive optional
 * fields — no existing data shape changes. Docs that don't use them
 * round-trip unchanged.
 */
const v5ToV6: Migration = {
  fromVersion: 5,
  toVersion: 6,
  description:
    'Allow Entity.attributes (B7) and TPDocument.customEntityClasses (B10) — no data change.',
  migrate: (raw) => {
    if (!isPlainObject(raw)) return raw;
    return { ...raw, schemaVersion: 6 };
  },
};

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

const v6ToV7: Migration = {
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
      const edgeId = edgeEntry ? edgeEntry[0] : '';
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

/** Production migration registry. Populated in version order. */
export const MIGRATIONS: readonly Migration[] = [v1ToV2, v2ToV3, v3ToV4, v4ToV5, v5ToV6, v6ToV7];

const readVersion = (doc: RawDocument): SchemaVersion => {
  if (typeof doc === 'object' && doc !== null && !Array.isArray(doc)) {
    const v = (doc as Record<string, unknown>).schemaVersion;
    if (typeof v === 'number') return v;
  }
  return 1;
};

/**
 * Pure migration loop. Walks `doc` forward through `migrations` until its
 * schemaVersion equals `target`. Exposed (rather than only `migrateToCurrent`)
 * so tests can apply fixture migrations without mutating the global registry.
 */
export const applyMigrations = (
  doc: RawDocument,
  migrations: readonly Migration[],
  target: SchemaVersion
): RawDocument => {
  let current = doc;
  let version = readVersion(current);

  if (version > target) {
    throw new Error(
      `Document schemaVersion ${version} is newer than this app supports (${target}). Update the app.`
    );
  }

  let guard = 0;
  while (version < target) {
    const next = migrations.find((m) => m.fromVersion === version);
    if (!next) {
      throw new Error(
        `No migration registered from schemaVersion ${version}; cannot reach ${target}.`
      );
    }
    current = next.migrate(current);
    version = next.toVersion;
    if (++guard > 100) throw new Error('Migration loop exceeded 100 steps; possible cycle.');
  }

  return current;
};

/** Convenience: apply the production registry to reach CURRENT_SCHEMA_VERSION. */
export const migrateToCurrent = (doc: RawDocument): RawDocument =>
  applyMigrations(doc, MIGRATIONS, CURRENT_SCHEMA_VERSION);
