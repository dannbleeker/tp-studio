import { errorMessage } from '@/services/errors';
import { STORAGE_KEYS, readString, removeKey, writeString } from '@/services/storage';
import { isDiagramType, isObject, isTrueMap } from './guards';
import { CURRENT_SCHEMA_VERSION, migrateToCurrent } from './migrations';
import {
  validateAssumption,
  validateCustomEntityClasses,
  validateEdge,
  validateEntity,
  validateGroup,
  validateLayoutConfig,
  validateMethodChecklist,
  validateRecord,
  validateSystemScope,
} from './persistenceValidators';
import type { DocumentId, TPDocument } from './types';

/**
 * Document I/O — JSON round-trip and localStorage read/write. The
 * field-by-field shape guards live in `persistenceValidators.ts`; this
 * file is the I/O surface every other module imports from.
 *
 * Public API (also re-exported by tests via `@/domain/persistence`):
 *
 *   - `exportToJSON` / `importFromJSON` — string ↔ TPDocument
 *   - `saveToLocalStorage` / `loadFromLocalStorage` / `clearLocalStorage`
 *   - `STORAGE_KEY` — re-export of the canonical localStorage key
 */

/** Re-exported for tests and any consumer that needs the literal key. */
export const STORAGE_KEY = STORAGE_KEYS.doc;

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
  // Session 87: EC verbal-style toggle. Soft validation — unrecognized
  // values fall back to `undefined` (interpreted as `'neutral'` at the
  // verbalisation layer) so a corrupt import still loads.
  const ecVerbalStyle: 'neutral' | 'twoSided' | undefined =
    parsed.ecVerbalStyle === 'neutral' || parsed.ecVerbalStyle === 'twoSided'
      ? parsed.ecVerbalStyle
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
    ...(ecVerbalStyle ? { ecVerbalStyle } : {}),
    createdAt: typeof parsed.createdAt === 'number' ? parsed.createdAt : Date.now(),
    updatedAt: typeof parsed.updatedAt === 'number' ? parsed.updatedAt : Date.now(),
    schemaVersion: 8,
  };
};

export const saveToLocalStorage = (doc: TPDocument): void => {
  // FL-EX9: copy the prior committed doc into the backup slot BEFORE
  // overwriting the main slot. If the new write fails mid-flight (quota
  // error, mid-write tab kill, partial JSON), the backup still points at
  // the last known-good state. The cost is one extra localStorage read +
  // write per save (~negligible — both slots are the same size).
  const prior = readString(STORAGE_KEYS.doc);
  if (prior !== null) writeString(STORAGE_KEYS.docBackup, prior);
  writeString(STORAGE_KEYS.doc, exportToJSON(doc));
};

/**
 * FL-EX9 — load result surfaces how the document was reconstructed so the
 * boot path can show a recovery toast when something unusual happened.
 *
 *   - `recoveredFromBackup` — main slot was unreadable; we loaded the
 *     previous-save snapshot from `docBackup`. The user lost at most one
 *     save's worth of changes.
 *   - `recoveredFromLiveDraftOnly` — both main and backup were unreadable;
 *     the synchronously-written live-draft slot was the only thing left.
 *     The user kept their edits but the committed snapshot was lost.
 *
 * `doc` is the reconstructed document or `null` when nothing usable
 * survived. At most one of the recovery flags is set.
 */
export type LoadResult = {
  doc: TPDocument | null;
  recoveredFromBackup: boolean;
  recoveredFromLiveDraftOnly: boolean;
};

/**
 * Load the active document from localStorage with recovery metadata.
 *
 * A5 auto-recovery (live draft): if a live draft is present and parses to
 * a newer `updatedAt` than the committed doc, the draft wins — it
 * represents work that was typed but not yet committed when the previous
 * session ended (tab crash, browser kill, OS shutdown).
 *
 * FL-EX9 (backup slot): if the committed doc fails to parse (rare, but
 * mid-write crashes or external tampering can corrupt it), fall back to
 * the backup slot. Both slots can be parsed independently; whichever
 * yields a doc with the newer `updatedAt` wins among the survivors. The
 * boot path surfaces a toast when recovery from the backup happens so
 * the user knows the prior session ended unexpectedly.
 *
 * Returns `{ doc: null, ... }` when nothing usable is stored; the caller
 * falls back to a fresh blank document.
 */
export const loadFromLocalStorageWithStatus = (): LoadResult => {
  const committedRaw = readString(STORAGE_KEYS.doc);
  const liveRaw = readString(STORAGE_KEYS.docLive);
  const backupRaw = readString(STORAGE_KEYS.docBackup);

  const tryParse = (raw: string | null): TPDocument | null => {
    if (raw === null) return null;
    try {
      return importFromJSON(raw);
    } catch {
      return null;
    }
  };

  const committed = tryParse(committedRaw);
  const live = tryParse(liveRaw);
  const backup = tryParse(backupRaw);

  // Happy path: committed doc is intact.
  if (committed) {
    if (live && live.updatedAt > committed.updatedAt) {
      return { doc: live, recoveredFromBackup: false, recoveredFromLiveDraftOnly: false };
    }
    return { doc: committed, recoveredFromBackup: false, recoveredFromLiveDraftOnly: false };
  }

  // Committed unreadable. Try backup; the live draft is also a candidate
  // and may carry newer (unsaved) edits than the backup.
  if (backup) {
    if (live && live.updatedAt > backup.updatedAt) {
      // Both exist; live is newer than the backup. Treat this as a
      // backup-tier recovery (we still lost the most recent committed
      // snapshot) but surface the newer live-draft content.
      return { doc: live, recoveredFromBackup: true, recoveredFromLiveDraftOnly: false };
    }
    return { doc: backup, recoveredFromBackup: true, recoveredFromLiveDraftOnly: false };
  }

  // Last resort: only the live draft survived.
  if (live) {
    return { doc: live, recoveredFromBackup: false, recoveredFromLiveDraftOnly: true };
  }
  return { doc: null, recoveredFromBackup: false, recoveredFromLiveDraftOnly: false };
};

/**
 * Backwards-compatible wrapper that drops the recovery metadata. New
 * code should prefer {@link loadFromLocalStorageWithStatus}; tests and
 * legacy callers can keep using this.
 */
export const loadFromLocalStorage = (): TPDocument | null => loadFromLocalStorageWithStatus().doc;

export const clearLocalStorage = (): void => {
  removeKey(STORAGE_KEYS.doc);
  removeKey(STORAGE_KEYS.docBackup);
};
