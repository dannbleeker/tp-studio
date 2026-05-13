import { isEntityType } from '../guards';

/**
 * Flying Logic interop (best-effort).
 *
 * Reads / writes the XML format described in Flying Logic 4/5's public
 * scripting docs (`<flyingLogic>` root, `<vertex>` for entities + junctors,
 * `<edge>` with `source` / `target`, group membership via a `grouped`
 * attribute on a host vertex, attributes as keyed `<attribute>` children).
 *
 * Split across:
 *   - `typeMaps.ts` — the EntityType ↔ FL entityClass maps, used by both
 *     directions, plus small helpers (`escapeXml`, `mapEntityType`,
 *     `VALID_GROUP_COLORS`).
 *   - `writer.ts` — `exportToFlyingLogic` (TS → XML).
 *   - `reader.ts` — `importFromFlyingLogic` (XML → TS).
 *
 * What's preserved on round-trip:
 *   - Entities (title, type/entityClass, description)
 *   - Edges
 *   - AND grouping: TP Studio `andGroupId` ↔ FL junctor with `type="junctor"`
 *   - Groups (membership; title; expanded/collapsed)
 *
 * What we preserve via TP-Studio-custom attributes (a real FL app will read
 * the document fine but won't surface these): internal IDs, annotation
 * numbers, group colors, edge labels, diagram-type tag.
 *
 * What we DON'T model: position data, FL canvas/display settings, junctor
 * types beyond AND.
 *
 * Container: the writer/reader operates on raw XML strings. Some real
 * `.logicx` files may be ZIP archives; callers should extract the inner
 * XML before feeding it in.
 */

export { exportToFlyingLogic } from './writer';
export { importFromFlyingLogic } from './reader';
export { __ENTITY_TYPE_TO_FL_FOR_TEST } from './typeMaps';

/** Re-export so callers using `EntityType` (e.g. test helpers) can resolve the mapping. */
export { isEntityType };
