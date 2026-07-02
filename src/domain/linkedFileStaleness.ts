/**
 * Session 193 — the pure predicate behind the linked-file "unsaved since last
 * save" chip. A document is dirty relative to its on-disk file when it has been
 * edited (its `updatedAt` advanced) since the last successful write (`savedAt`).
 *
 * Kept as a leaf domain function — plain numbers in, boolean out, zero browser
 * API surface — so it's unit-testable without the Chromium-only File System
 * Access machinery it ultimately drives. A missing `savedAt` (a pre-upgrade
 * link that never recorded one) reads as `0`, i.e. "never saved" → dirty.
 */
export const isDirtySinceSave = (updatedAt: number, savedAt: number | undefined): boolean =>
  updatedAt > (savedAt ?? 0);
