/**
 * Document I/O — the public entry point (`@/domain/persistence`) for JSON
 * round-trip + localStorage persistence. The field-by-field shape guards live
 * in `persistenceValidators.ts`.
 *
 * Session 165 — split into two modules to tame the file size; this file
 * re-exports their public surface so every consumer imports unchanged:
 *   - `persistenceJson.ts` — the pure `string ↔ TPDocument` transform
 *     (`exportToJSON` / `importFromJSON`).
 *   - `persistenceStorage.ts` — localStorage read/write + the multi-doc tab
 *     slots (`saveToLocalStorage` / `loadFromLocalStorage*` / `persistActiveDoc`
 *     / `loadAllTabsWithStatus` / the tab-manifest helpers / `STORAGE_KEY`).
 */

export { exportToJSON, importFromJSON } from './persistenceJson';
export type { LoadResult, TabsLoadResult, TabsManifest } from './persistenceStorage';
export {
  clearLocalStorage,
  evictOldestClosedTrees,
  listSavedDocIds,
  loadAllTabsWithStatus,
  loadFromLocalStorage,
  loadFromLocalStorageWithStatus,
  loadSavedDoc,
  persistActiveDoc,
  persistTabsManifest,
  readTabsManifest,
  removeDocBackup,
  removeDocFromStorage,
  STORAGE_KEY,
  saveDocToLocalStorage,
  saveToLocalStorage,
} from './persistenceStorage';
