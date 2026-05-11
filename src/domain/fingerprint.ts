import type { TPDocument } from './types';

/**
 * A short string that changes only when something that affects layout or
 * validation changes — entity set, edge set, edge endpoints, AND-grouping,
 * entity types, and titles (the validators depend on titles).
 *
 * Title edits go through this fingerprint too because the clarity / tautology
 * rules read titles. Title-only edits to ONE entity do still change the
 * fingerprint and re-run validation, but that's correct — clarity is
 * per-entity. The win is that pure UI mutations (selection, palette, theme,
 * resolvedWarnings changes) don't churn the layout cache.
 */
export const layoutFingerprint = (doc: TPDocument): string => {
  const entityIds = Object.keys(doc.entities).sort();
  const edgeKeys = Object.values(doc.edges)
    .map((e) => `${e.id}:${e.sourceId}>${e.targetId}:${e.andGroupId ?? ''}`)
    .sort();
  return `${entityIds.join(',')}|${edgeKeys.join(',')}`;
};

export const validationFingerprint = (doc: TPDocument): string => {
  const entitySig = Object.values(doc.entities)
    .map((e) => `${e.id}:${e.type}:${e.title}`)
    .sort()
    .join('|');
  const edgeSig = Object.values(doc.edges)
    .map((e) => `${e.id}:${e.sourceId}>${e.targetId}:${e.andGroupId ?? ''}`)
    .sort()
    .join('|');
  const resolvedSig = Object.keys(doc.resolvedWarnings).sort().join(',');
  return `${doc.diagramType}|${entitySig}|${edgeSig}|${resolvedSig}`;
};
