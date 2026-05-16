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

export const validationFingerprint = (doc: TPDocument): string => {
  const entitySig = entitiesArray(doc)
    .map((e) => `${e.id}:${e.type}:${e.title}`)
    .sort()
    .join('|');
  const edgeSig = edgesArray(doc)
    .map((e) => `${e.id}:${e.sourceId}>${e.targetId}:${e.andGroupId ?? ''}`)
    .sort()
    .join('|');
  const resolvedSig = Object.keys(doc.resolvedWarnings).sort().join(',');
  return `${doc.diagramType}|${entitySig}|${edgeSig}|${resolvedSig}`;
};
