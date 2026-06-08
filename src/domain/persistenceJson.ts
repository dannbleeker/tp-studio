import { errorMessage } from '@/services/errors';
import { isCloudType } from './cloudType';
import { pruneSingletonJunctors } from './graphPrune';
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
  // Validation runs in two tiers. NON-RECOVERABLE fields (id, diagramType,
  // schemaVersion, and the entity / edge / group records) throw and reject the
  // doc. RECOVERABLE / cosmetic fields (title, metadata + style toggles, the
  // dismissed-warning set, the annotation counter) soft-degrade to a sane
  // default so one bad value never costs the user the whole document on load
  // (`tryParseDoc` would otherwise drop it and fall back to a backup slot).
  if (!isObject(parsed)) throw new Error('Invalid document: not an object.');
  if (parsed.schemaVersion !== CURRENT_SCHEMA_VERSION) {
    throw new Error(`Unsupported schemaVersion: ${String(parsed.schemaVersion)}`);
  }
  if (typeof parsed.id !== 'string') throw new Error('Invalid document: missing id.');
  if (!isDiagramType(parsed.diagramType)) {
    throw new Error('Invalid document: bad diagramType.');
  }
  const entities = validateRecord(parsed.entities, validateEntity, 'entities');
  // Tidy any junctor group left with a single input — an older doc or import
  // can carry a logically-vacuous "AND of one"; collapse it to a plain edge.
  const edges = pruneSingletonJunctors(validateRecord(parsed.edges, validateEdge, 'edges'));
  const groups = validateRecord(parsed.groups ?? {}, validateGroup, 'groups');

  // Cosmetic feature-state (which warnings the user dismissed): a malformed
  // value soft-degrades to "none dismissed" rather than failing the whole load.
  // `isTrueMap(undefined)` is false, so an absent map still yields `{}`.
  const resolvedWarnings: Record<string, true> = isTrueMap(parsed.resolvedWarnings)
    ? parsed.resolvedWarnings
    : {};

  // Recoverable: a non-number counter is rebuilt from the entities (max
  // annotation + 1) rather than failing the load. `author` / `description` are
  // cosmetic — a non-string value is simply dropped by the conditional spread in
  // the returned object below, so no guard (and no hard-fail) is needed here.
  const nextAnnotationNumber: number =
    typeof parsed.nextAnnotationNumber === 'number'
      ? parsed.nextAnnotationNumber
      : Object.values(entities).reduce((m, e) => Math.max(m, e.annotationNumber), 0) + 1;
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
    nextAnnotationNumber,
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
