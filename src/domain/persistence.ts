import { errorMessage } from '@/services/errors';
import {
  docBackupKey,
  docCommittedKey,
  docLiveKey,
  tabsManifestKey,
} from '@/services/storage/keys';
import { readString, removeKey, STORAGE_KEYS, writeString } from '@/services/storage/storage';
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
 *
 * Multi-doc tabs (Batch 2.2) — per-doc slots + tab manifest, dual-written
 * with the legacy single-doc slots above (see the banner lower in the file):
 *   - `persistActiveDoc` — save the active doc to per-doc + manifest + legacy
 *   - `saveDocToLocalStorage` — per-doc committed write + backup rotation
 *   - `loadAllTabsWithStatus` — boot loader (manifest → per-doc; legacy migrate)
 *   - `persistTabsManifest` / `readTabsManifest` — the tab manifest
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
    createdAt: typeof parsed.createdAt === 'number' ? parsed.createdAt : Date.now(),
    updatedAt: typeof parsed.updatedAt === 'number' ? parsed.updatedAt : Date.now(),
    schemaVersion: 9,
  };
};

/**
 * Session 135 / Perf #27 — in-memory copy of the last committed
 * serialized doc. The backup-slot write needs the *prior* committed
 * payload; keeping it here avoids a full `localStorage` read (and JSON
 * re-parse-free string fetch) on every save. `null` until the first
 * save of the session, where we fall back to reading the slot once.
 */
let lastCommittedRaw: string | null = null;

export const saveToLocalStorage = (doc: TPDocument, serialized?: string): void => {
  // Perf #26 — store the COMPACT serialization (no `null, 2`
  // indentation). Pretty-printing is for human-facing file exports
  // (`exportToJSON`); the localStorage payload is machine-read only, so
  // indentation just doubles the string size and serialize time on a
  // path that runs on every committed save. `importFromJSON` parses
  // compact and pretty identically.
  // Session 144 — accept a pre-built body so `persistActiveDoc` can stringify
  // the doc ONCE and feed both this and the per-doc writer; standalone callers
  // omit it and serialize here (unchanged behaviour, byte-identical output).
  const raw = serialized ?? JSON.stringify(doc);
  // FL-EX9: copy the prior committed doc into the backup slot BEFORE
  // overwriting the main slot. If the new write fails mid-flight (quota
  // error, mid-write tab kill, partial JSON), the backup still points at
  // the last known-good state. Perf #27: prefer the in-memory prior over
  // a fresh slot read.
  const prior = lastCommittedRaw ?? readString(STORAGE_KEYS.doc);
  if (prior !== null) writeString(STORAGE_KEYS.docBackup, prior);
  writeString(STORAGE_KEYS.doc, raw);
  lastCommittedRaw = raw;
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
/** Parse a stored doc payload, returning `null` on absent or invalid JSON. */
const tryParseDoc = (raw: string | null): TPDocument | null => {
  if (raw === null) return null;
  try {
    return importFromJSON(raw);
  } catch {
    return null;
  }
};

/**
 * Pure committed / live / backup precedence resolver. Extracted in
 * Batch 2.2 so the legacy single-doc loader and the per-doc loader
 * (`loadDocByIdWithStatus`) share ONE proven recovery policy instead of
 * duplicating it. Precedence:
 *
 *   1. committed intact → committed, unless a live draft has a newer
 *      `updatedAt` (un-committed edits from the previous session win).
 *   2. committed unreadable → backup (recoveredFromBackup), unless the
 *      live draft is newer than the backup → live (still a backup-tier
 *      recovery: the most recent committed snapshot was lost).
 *   3. only the live draft survived → live (recoveredFromLiveDraftOnly).
 *   4. nothing usable → `{ doc: null }`.
 */
const pickBestDoc = (
  committedRaw: string | null,
  liveRaw: string | null,
  backupRaw: string | null
): LoadResult => {
  const committed = tryParseDoc(committedRaw);
  const live = tryParseDoc(liveRaw);
  const backup = tryParseDoc(backupRaw);

  if (committed) {
    if (live && live.updatedAt > committed.updatedAt) {
      return { doc: live, recoveredFromBackup: false, recoveredFromLiveDraftOnly: false };
    }
    return { doc: committed, recoveredFromBackup: false, recoveredFromLiveDraftOnly: false };
  }
  if (backup) {
    if (live && live.updatedAt > backup.updatedAt) {
      return { doc: live, recoveredFromBackup: true, recoveredFromLiveDraftOnly: false };
    }
    return { doc: backup, recoveredFromBackup: true, recoveredFromLiveDraftOnly: false };
  }
  if (live) {
    return { doc: live, recoveredFromBackup: false, recoveredFromLiveDraftOnly: true };
  }
  return { doc: null, recoveredFromBackup: false, recoveredFromLiveDraftOnly: false };
};

export const loadFromLocalStorageWithStatus = (): LoadResult =>
  pickBestDoc(
    readString(STORAGE_KEYS.doc),
    readString(STORAGE_KEYS.docLive),
    readString(STORAGE_KEYS.docBackup)
  );

/**
 * Backwards-compatible wrapper that drops the recovery metadata. New
 * code should prefer {@link loadFromLocalStorageWithStatus}; tests and
 * legacy callers can keep using this.
 */
export const loadFromLocalStorage = (): TPDocument | null => loadFromLocalStorageWithStatus().doc;

export const clearLocalStorage = (): void => {
  removeKey(STORAGE_KEYS.doc);
  removeKey(STORAGE_KEYS.docBackup);
  // Session 135 security audit — also drop the in-memory Perf #27 cache.
  // Otherwise a subsequent `saveToLocalStorage` would write the stale
  // pre-clear payload to the backup slot (the canonical state at that
  // point is empty, not the cached prior value). Currently unreachable
  // from the UI (no production caller), but the cache should match the
  // canonical storage state for future-safety + test correctness.
  lastCommittedRaw = null;
  // Batch 2.2 — also drop the per-doc slots the manifest knows about, plus
  // the manifest itself, so a clear leaves no stale per-doc body that the
  // multi-doc boot path (`loadAllTabsWithStatus`) would resurrect.
  // (Phase 5: enumerate by the `tp-studio:doc:` key prefix once tabs can
  // exist beyond a single-entry manifest.)
  const manifest = readTabsManifest();
  if (manifest) {
    for (const id of manifest.tabOrder) {
      removeKey(docCommittedKey(id));
      removeKey(docLiveKey(id));
      removeKey(docBackupKey(id));
    }
  }
  removeKey(tabsManifestKey);
};

// ───────────────────────────────────────────────────────────────────────
// Multi-doc tabs — Phase 2, Batch 2.2: per-doc persistence + tab manifest.
// See docs/MULTI_DOC_TABS_PLAN.md.
//
// Storage model (the app is still SINGLE-TAB in Phase 2, so `tabOrder`
// always holds exactly one id — the plumbing is exercised under single-tab
// before Phase 5 turns on the real tab strip):
//
//   tp-studio:doc:<id>:committed:v2   per-doc committed body (debounced)
//   tp-studio:doc:<id>:live:v2        per-doc live draft (sync / keystroke)
//   tp-studio:doc:<id>:backup:v2      per-doc prior-commit rotation
//   tp-studio:tabs:v1                 manifest { activeDocId, tabOrder }
//
// DUAL-WRITE: every committed save ALSO writes the legacy single-doc slots
// (via `saveToLocalStorage`). That keeps a pre-2.2 build (a rollback, or an
// older cached PWA shell) bootable from the same browser — eliminating the
// downgrade-data-loss risk of a hard format switch. Phase 5 drops the
// legacy write (one line in `persistActiveDoc`) once tabs ship for real.
// ───────────────────────────────────────────────────────────────────────

/** Tab manifest payload — which docs are open and which one is active. */
export type TabsManifest = {
  activeDocId: DocumentId;
  tabOrder: DocumentId[];
};

/**
 * Per-doc committed write with backup rotation — the per-doc analogue of
 * `saveToLocalStorage`. Copies the prior committed body into the per-doc
 * backup slot BEFORE overwriting committed, so a mid-write failure (quota,
 * tab kill) leaves the last good snapshot intact.
 *
 * Reads the prior body straight from storage rather than caching it in
 * memory: this runs on the debounced path (not per-keystroke), so one
 * extra `getItem` is negligible, and it sidesteps the stale-cache bug
 * class that a per-doc `lastCommitted` map would introduce across doc
 * swaps / tab closes.
 */
export const saveDocToLocalStorage = (doc: TPDocument, serialized?: string): void => {
  const committedKey = docCommittedKey(doc.id);
  const prior = readString(committedKey);
  if (prior !== null) writeString(docBackupKey(doc.id), prior);
  // Session 144 — accept a pre-built body so `persistActiveDoc` serializes once
  // for both slots; standalone callers (docMetaSlice rename / create / swap)
  // omit it and serialize here.
  writeString(committedKey, serialized ?? JSON.stringify(doc));
};

/**
 * Drop a single doc's per-doc slots (committed / live / backup) — Batch 5.1,
 * used by `closeTab` so a closed tab leaves no orphaned body in storage.
 * The tab manifest is rewritten separately by the calling tab action.
 */
export const removeDocFromStorage = (id: DocumentId): void => {
  removeKey(docCommittedKey(id));
  removeKey(docLiveKey(id));
  removeKey(docBackupKey(id));
};

/**
 * Phase 6 quota mitigation — drop ONLY the backup slot for one doc (the
 * lowest-value per-doc data; its committed + live bodies remain). Returns
 * whether a backup slot actually existed, so callers can count what they
 * freed.
 */
export const removeDocBackup = (id: DocumentId): boolean => {
  const key = docBackupKey(id);
  const existed = readString(key) !== null;
  removeKey(key);
  return existed;
};

/** Per-doc loader — committed / live / backup precedence for ONE doc id. */
const loadDocByIdWithStatus = (id: DocumentId): LoadResult =>
  pickBestDoc(
    readString(docCommittedKey(id)),
    readString(docLiveKey(id)),
    readString(docBackupKey(id))
  );

/** Validate a parsed manifest shape. Returns `null` if absent / malformed. */
const parseTabsManifest = (raw: string | null): TabsManifest | null => {
  if (raw === null) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!isObject(parsed)) return null;
  const { activeDocId, tabOrder } = parsed as { activeDocId?: unknown; tabOrder?: unknown };
  if (typeof activeDocId !== 'string') return null;
  if (!Array.isArray(tabOrder) || !tabOrder.every((t) => typeof t === 'string')) return null;
  return { activeDocId: activeDocId as DocumentId, tabOrder: tabOrder as DocumentId[] };
};

/** Read + validate the tab manifest. `null` when absent or malformed. */
export const readTabsManifest = (): TabsManifest | null =>
  parseTabsManifest(readString(tabsManifestKey));

/** Write the tab manifest (tiny payload — callers write synchronously). */
export const persistTabsManifest = (manifest: TabsManifest): void => {
  writeString(tabsManifestKey, JSON.stringify(manifest));
};

/**
 * Persist the active document's BODY on the debounce scheduler's committed
 * write: per-doc committed + backup rotation (`saveDocToLocalStorage`) plus
 * the legacy single-doc dual-write (downgrade safety; drop in a later
 * cleanup).
 *
 * It deliberately does NOT touch the tab manifest. The manifest is owned by
 * the tab actions (openTab / switchTab / closeTab / reorderTabs /
 * duplicateTab), which know the real `tabOrder`. Writing a single-tab
 * manifest here (as Batch 2.2 did, when single-tab) would clobber a
 * multi-tab manifest on the very next committed edit — which silently
 * dropped every tab but the active one on reload (Batch 5.4 fix).
 */
export const persistActiveDoc = (doc: TPDocument): void => {
  // Serialize ONCE and feed both writers. The per-doc committed slot and the
  // legacy single-doc slot store the byte-identical compact body, so a single
  // `JSON.stringify` (the costly part on a large doc — ~30–50 ms at 200
  // entities) replaces the two this used to do. Mirrors the live-draft path,
  // which already serializes once and writes both its slots.
  const serialized = JSON.stringify(doc);
  saveDocToLocalStorage(doc, serialized);
  saveToLocalStorage(doc, serialized);
};

/**
 * Boot loader for the multi-doc world. The result mirrors the store's
 * Batch-2.1 fields (`docs` / `activeDocId` / `tabOrder`) plus the
 * active-doc recovery flags.
 *
 *   - Manifest present → load each listed doc from its per-doc slots (the
 *     new canonical path, exercised here under single-tab before Phase 5
 *     depends on it). Tabs whose body was lost are dropped from the order.
 *   - Manifest absent → legacy single-doc format (pre-2.2) or a first-ever
 *     run. Load via the legacy slots and, if a doc survived, MIGRATE it
 *     into the per-doc format + write the manifest so the next boot takes
 *     the manifest path.
 *
 * Phase 5 will (a) build true multi-tab state from `docs` / `tabOrder`
 * rather than collapsing to the active doc at the boot call site, and
 * (b) lazy-parse non-active bodies (locked decision #3). In single-tab
 * there is at most one body, so the eager load here is already optimal.
 */
export type TabsLoadResult = {
  docs: Record<DocumentId, TPDocument>;
  activeDocId: DocumentId | null;
  tabOrder: DocumentId[];
  recoveredFromBackup: boolean;
  recoveredFromLiveDraftOnly: boolean;
  migratedFromLegacy: boolean;
};

export const loadAllTabsWithStatus = (): TabsLoadResult => {
  const manifest = readTabsManifest();
  if (manifest) {
    const docs: Record<DocumentId, TPDocument> = {};
    let recoveredFromBackup = false;
    let recoveredFromLiveDraftOnly = false;
    for (const id of manifest.tabOrder) {
      const res = loadDocByIdWithStatus(id);
      if (res.doc) {
        docs[id] = res.doc;
        if (id === manifest.activeDocId) {
          recoveredFromBackup = res.recoveredFromBackup;
          recoveredFromLiveDraftOnly = res.recoveredFromLiveDraftOnly;
        }
      }
    }
    // Resolve the active id: the manifest's choice if its body survived,
    // else the first surviving tab so a lost active body still boots to
    // something the user had open.
    const survivingOrder = manifest.tabOrder.filter((id) => docs[id]);
    const activeDocId =
      manifest.activeDocId && docs[manifest.activeDocId]
        ? manifest.activeDocId
        : (survivingOrder[0] ?? null);
    return {
      docs,
      activeDocId,
      tabOrder: survivingOrder,
      recoveredFromBackup,
      recoveredFromLiveDraftOnly,
      migratedFromLegacy: false,
    };
  }

  // No manifest — legacy single-doc format or a first-ever run.
  const legacy = loadFromLocalStorageWithStatus();
  if (legacy.doc) {
    const { doc } = legacy;
    // One-time migration: establish the per-doc format + a single-tab
    // manifest so the next boot takes the manifest path above. The manifest
    // write is explicit here because `persistActiveDoc` no longer touches it
    // (it's the tab actions' job). Idempotent for this doc.
    persistActiveDoc(doc);
    persistTabsManifest({ activeDocId: doc.id, tabOrder: [doc.id] });
    return {
      docs: { [doc.id]: doc },
      activeDocId: doc.id,
      tabOrder: [doc.id],
      recoveredFromBackup: legacy.recoveredFromBackup,
      recoveredFromLiveDraftOnly: legacy.recoveredFromLiveDraftOnly,
      migratedFromLegacy: true,
    };
  }

  // Nothing stored at all.
  return {
    docs: {},
    activeDocId: null,
    tabOrder: [],
    recoveredFromBackup: false,
    recoveredFromLiveDraftOnly: false,
    migratedFromLegacy: false,
  };
};
