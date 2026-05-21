import { edgesArray, entitiesArray, pinnedEntities } from './graph';
import type { TPDocument } from './types';

/**
 * A short string that changes only when something that affects layout or
 * validation changes — entity set, edge set, edge endpoints, AND-grouping,
 * entity types, titles (the validators depend on titles), and hand-positioned
 * coordinates (manual-layout diagrams render off `Entity.position`).
 *
 * Title edits go through this fingerprint too because the clarity / tautology
 * rules read titles. Title-only edits to ONE entity do still change the
 * fingerprint and re-run validation, but that's correct — clarity is
 * per-entity. The win is that pure UI mutations (selection, palette, theme,
 * resolvedWarnings changes) don't churn the layout cache.
 *
 * `Entity.position` is hashed unconditionally even though auto-layout
 * diagrams ignore it at runtime: the cost is one number-pair per entity,
 * and including it keeps the manual-layout branch of `useGraphView`
 * reactive without a parallel fingerprint.
 */
export const layoutFingerprint = (doc: TPDocument): string => {
  // Session 76: encode S&T-format state per entity so toggling an
  // injection into / out of the 5-facet card height triggers a
  // relayout. The flag is "any reserved S&T facet attribute is set"
  // — same trigger as `isStNodeFormat` in `graph.ts`. Kept inline
  // rather than imported to avoid a layering cycle (graph.ts already
  // imports from types.ts which is fine, but fingerprint.ts wants
  // to stay leaf-level).
  const stFacetKeys = [
    'stStrategy',
    'stNecessaryAssumption',
    'stParallelAssumption',
    'stSufficiencyAssumption',
  ];
  const entityIds = entitiesArray(doc)
    .map((e) => {
      const hasFacet =
        e.type === 'injection' &&
        e.attributes !== undefined &&
        stFacetKeys.some((k) => e.attributes?.[k] !== undefined);
      return `${e.id}${hasFacet ? ':st' : ''}`;
    })
    .sort();
  const edgeKeys = edgesArray(doc)
    .map(
      (e) =>
        `${e.id}:${e.sourceId}>${e.targetId}:${e.andGroupId ?? ''}:${e.orGroupId ?? ''}:${e.xorGroupId ?? ''}`
    )
    .sort();
  const positions = pinnedEntities(doc)
    .map((e) => `${e.id}@${e.position?.x},${e.position?.y}`)
    .sort();
  return `${entityIds.join(',')}|${edgeKeys.join(',')}|${positions.join(',')}`;
};

/**
 * Session 135 / Perf #5 — used by the validator cache in
 * `validators/index.ts` to short-circuit re-runs when a mutation
 * didn't change any input the rules actually read. Must include
 * every entity / edge field any rule reads; an omission would
 * silently return stale warnings on a fingerprint hit.
 *
 * Currently encoded:
 *   - diagram type
 *   - per-entity: id, type, title, unspecified, spanOfControl,
 *     ecSlot, S&T facet presence (via the `:st` suffix used by
 *     `layoutFingerprint` so toggling a facet attribute counts)
 *   - per-edge: id, source, target, andGroupId
 *   - resolved-warning ids (so "resolve" / "un-resolve" flips
 *     re-validate)
 *
 * NOT encoded (mutating these is free):
 *   - position, attestation, owner, lastValidatedAt, evidence,
 *     description, attributes other than S&T facets, collapsed,
 *     titleSize, ordering, annotationNumber, edge weights / labels /
 *     descriptions / assumptionIds, OR/XOR group ids, group memberships.
 *
 * Note: a future rule that reads any of the "free" fields needs to
 * either add the field here or invalidate the cache another way.
 */
const ST_FACET_FINGERPRINT_KEYS: readonly string[] = [
  'stStrategy',
  'stNecessaryAssumption',
  'stParallelAssumption',
  'stSufficiencyAssumption',
];

export const validationFingerprint = (doc: TPDocument): string => {
  const entitySig = entitiesArray(doc)
    .map((e) => {
      const u = e.unspecified === true ? 'u' : '';
      const s = e.spanOfControl ? `:${e.spanOfControl[0]}` : '';
      const slot = e.ecSlot ? `:${e.ecSlot}` : '';
      const st =
        e.type === 'injection' &&
        e.attributes !== undefined &&
        ST_FACET_FINGERPRINT_KEYS.some((k) => e.attributes?.[k] !== undefined)
          ? ':st'
          : '';
      return `${e.id}:${e.type}:${e.title}:${u}${s}${slot}${st}`;
    })
    .sort()
    .join('|');
  const edgeSig = edgesArray(doc)
    .map((e) => `${e.id}:${e.sourceId}>${e.targetId}:${e.andGroupId ?? ''}`)
    .sort()
    .join('|');
  const resolvedSig = Object.keys(doc.resolvedWarnings).sort().join(',');
  return `${doc.diagramType}|${entitySig}|${edgeSig}|${resolvedSig}`;
};
