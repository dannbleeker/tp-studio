import { errorMessage } from '@/services/errors';
import { isCloudType } from './cloudType';
import { isDiagramType, isObject, isTrueMap } from './guards';
import { CURRENT_SCHEMA_VERSION, migrateToCurrent } from './migrations';
import {
  validateAssumption,
  validateComment,
  validateCustomEntityClasses,
  validateEdge,
  validateEntity,
  validateGroup,
  validateLayoutConfig,
  validateMethodChecklist,
  validateRecord,
  validateSystemScope,
} from './persistenceValidators';
import type { CloudType, DocumentId, TPDocument } from './types';

/**
 * Document JSON round-trip — the pure `string ↔ TPDocument` transform. No
 * localStorage, no store, no React. The localStorage / multi-doc persistence
 * built on top of this lives in `persistenceStorage.ts`; both are re-exported
 * from `persistence.ts` so `@/domain/persistence` stays the single import site.
 *
 * Split out of `persistence.ts` (Session 165). The field-by-field shape guards
 * live in `persistenceValidators.ts`.
 */

export const exportToJSON = (doc: TPDocument): string => JSON.stringify(doc, null, 2);

export const importFromJSON = (raw: string): TPDocument => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    throw new Error(`Invalid document: not valid JSON (${errorMessage(err)}).`);
  }
  // Run forward migrations before validation so downstream guards can assume
  // the document is at CURRENT_SCHEMA_VERSION. Today the registry is empty;
  // this is the plumbing for future versions.
  parsed = migrateToCurrent(parsed);
  if (!isObject(parsed)) throw new Error('Invalid document: not an object.');
  if (parsed.schemaVersion !== CURRENT_SCHEMA_VERSION) {
    throw new Error(`Unsupported schemaVersion: ${String(parsed.schemaVersion)}`);
  }
  if (typeof parsed.id !== 'string') throw new Error('Invalid document: missing id.');
  if (!isDiagramType(parsed.diagramType)) {
    throw new Error('Invalid document: bad diagramType.');
  }
  const entities = validateRecord(parsed.entities, validateEntity, 'entities');
  const edges = validateRecord(parsed.edges, validateEdge, 'edges');
  const groups = validateRecord(parsed.groups ?? {}, validateGroup, 'groups');

  let resolvedWarnings: Record<string, true> = {};
  if (parsed.resolvedWarnings !== undefined) {
    if (!isTrueMap(parsed.resolvedWarnings)) {
      throw new Error('Invalid document: resolvedWarnings must map strings to literal true.');
    }
    resolvedWarnings = parsed.resolvedWarnings;
  }

  if (typeof parsed.nextAnnotationNumber !== 'number') {
    throw new Error('Invalid document: nextAnnotationNumber must be a number.');
  }
  if (parsed.author !== undefined && typeof parsed.author !== 'string') {
    throw new Error('Invalid document: author must be a string.');
  }
  if (parsed.description !== undefined && typeof parsed.description !== 'string') {
    throw new Error('Invalid document: description must be a string.');
  }
  const layoutConfig = validateLayoutConfig(parsed.layoutConfig);
  const systemScope = validateSystemScope(parsed.systemScope);
  const methodChecklist = validateMethodChecklist(parsed.methodChecklist);
  const customEntityClasses = validateCustomEntityClasses(parsed.customEntityClasses);
  // Session 77: first-class Assumption records. The map is optional —
  // pre-migration docs (or docs with no assumptions) ship without it.
  const assumptions =
    parsed.assumptions !== undefined
      ? validateRecord(parsed.assumptions, validateAssumption, 'assumptions')
      : undefined;
  // Review comments — optional, validated like the assumptions map.
  const comments =
    parsed.comments !== undefined
      ? validateRecord(parsed.comments, validateComment, 'comments')
      : undefined;
  // Session 87: EC verbal-style toggle. Soft validation — unrecognized
  // values fall back to `undefined` (interpreted as `'neutral'` at the
  // verbalisation layer) so a corrupt import still loads.
  const ecVerbalStyle: 'neutral' | 'twoSided' | undefined =
    parsed.ecVerbalStyle === 'neutral' || parsed.ecVerbalStyle === 'twoSided'
      ? parsed.ecVerbalStyle
      : undefined;
  // TP Basics #1 — Cloud progression label. Soft validation: an unrecognized
  // value drops to undefined (untyped) so a corrupt import still loads.
  const cloudType: CloudType | undefined = isCloudType(parsed.cloudType)
    ? parsed.cloudType
    : undefined;
  // TP Basics #5 — gap-analysis performance anchors. Soft validation: keep a
  // non-blank string, otherwise drop (an absent / corrupt value still loads).
  const performanceLow =
    typeof parsed.performanceLow === 'string' && parsed.performanceLow.trim().length > 0
      ? parsed.performanceLow
      : undefined;
  const performanceHigh =
    typeof parsed.performanceHigh === 'string' && parsed.performanceHigh.trim().length > 0
      ? parsed.performanceHigh
      : undefined;

  return {
    id: parsed.id as DocumentId,
    title: typeof parsed.title === 'string' ? parsed.title : 'Untitled',
    diagramType: parsed.diagramType,
    entities,
    edges,
    groups,
    resolvedWarnings,
    nextAnnotationNumber: parsed.nextAnnotationNumber,
    ...(typeof parsed.author === 'string' ? { author: parsed.author } : {}),
    ...(typeof parsed.description === 'string' ? { description: parsed.description } : {}),
    ...(layoutConfig ? { layoutConfig } : {}),
    ...(systemScope ? { systemScope } : {}),
    // Session 83 — boolean flag set once the one-time CRT System Scope
    // nudge toast has fired. Persisted so the nudge doesn't re-show
    // for the same doc after a reload / JSON round-trip / share-link.
    ...(parsed.systemScopeNudgeShown === true ? { systemScopeNudgeShown: true } : {}),
    ...(methodChecklist ? { methodChecklist } : {}),
    ...(customEntityClasses ? { customEntityClasses } : {}),
    ...(assumptions && Object.keys(assumptions).length > 0 ? { assumptions } : {}),
    ...(comments && Object.keys(comments).length > 0 ? { comments } : {}),
    ...(ecVerbalStyle ? { ecVerbalStyle } : {}),
    ...(cloudType ? { cloudType } : {}),
    ...(performanceLow ? { performanceLow } : {}),
    ...(performanceHigh ? { performanceHigh } : {}),
    createdAt: typeof parsed.createdAt === 'number' ? parsed.createdAt : Date.now(),
    updatedAt: typeof parsed.updatedAt === 'number' ? parsed.updatedAt : Date.now(),
    schemaVersion: 9,
  };
};
