/**
 * Per-doc storage key generators.
 *
 * Session 137 / multi-doc tabs Batch 1 — see
 * `docs/MULTI_DOC_TABS_PLAN.md`.
 *
 * Wired into the per-doc persistence layer (`persistenceStorage.ts`,
 * `persistDebounced.ts`), which writes each open doc to its own committed /
 * live / backup slot plus the tab manifest.
 *
 * Today's single-doc keys (in `storage.ts`):
 *   - `tp-studio:active-document:v1`        (committed, debounced)
 *   - `tp-studio:active-document-live:v1`   (live draft, sync per keystroke)
 *   - `tp-studio:active-document-backup:v1` (prior-commit rotation)
 *
 * Phase 2's per-doc keys:
 *   - `tp-studio:doc:${id}:committed:v2`
 *   - `tp-studio:doc:${id}:live:v2`
 *   - `tp-studio:doc:${id}:backup:v2`
 *
 * The `:v2` suffix bumps the schema version so a future migration has a
 * hook. The leading `tp-studio:doc:` prefix lets storage-introspection
 * code filter to "all doc bodies" without needing the manifest.
 *
 * The tab manifest lives at `tp-studio:tabs:v1` and holds
 * `{ activeDocId, tabOrder }`. Tiny payload; written synchronously on
 * tab open / close / reorder / switch (rare events; no debounce).
 *
 * Why these are functions (not template-literal constants):
 *  - DocumentId-typed inputs catch the "passed an EntityId by accident"
 *    bug class at compile time.
 *  - The function indirection makes it easy to evolve the key shape
 *    once (e.g. `:v3` if a later phase needs it) without grepping every
 *    call site.
 */

import type { DocumentId } from '@/domain/types';

/** Committed doc body for a single tab — debounced write target. */
export const docCommittedKey = (id: DocumentId): string => `tp-studio:doc:${id}:committed:v2`;

/** Live-draft doc body for a single tab — sync write per keystroke. */
export const docLiveKey = (id: DocumentId): string => `tp-studio:doc:${id}:live:v2`;

/** Backup-slot doc body for a single tab — written before every committed
 *  write so a crash in the middle of a write doesn't lose data. */
export const docBackupKey = (id: DocumentId): string => `tp-studio:doc:${id}:backup:v2`;

/** Tab manifest — `{ activeDocId, tabOrder }`. The boot path reads this
 *  first; if it's missing, fall back to the legacy single-doc keys (the
 *  migration path defined in the plan). */
export const tabsManifestKey = 'tp-studio:tabs:v1' as const;

/** Schema version pointer — `{ version: number }`. Lets a future
 *  *layout-level* schema change have a clean migration hook. The
 *  per-doc `TPDocument.schemaVersion` field stays the source of truth
 *  for doc-internal schema. */
export const schemaVersionKey = 'tp-studio:schema:v1' as const;
