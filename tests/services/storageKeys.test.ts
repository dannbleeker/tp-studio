/**
 * Session 137 / multi-doc tabs Batch 1 — see
 * `docs/MULTI_DOC_TABS_PLAN.md`.
 *
 * Tests the per-doc storage-key generators. The helpers are dormant
 * infrastructure today (no call sites use them); Phase 2's persistence
 * rewrite will wire them up. The test pins the exact key strings so a
 * later phase can't accidentally rename them and break the migration
 * path from single-doc storage.
 */

import { describe, expect, it } from 'vitest';
import type { DocumentId } from '@/domain/types';
import {
  docBackupKey,
  docCommittedKey,
  docLiveKey,
  schemaVersionKey,
  tabsManifestKey,
} from '@/services/storage/keys';

const TEST_ID = 'doc_abc123xy' as DocumentId;

describe('per-doc storage key generators', () => {
  it('emits the expected committed-slot key shape', () => {
    expect(docCommittedKey(TEST_ID)).toBe('tp-studio:doc:doc_abc123xy:committed:v2');
  });

  it('emits the expected live-draft key shape', () => {
    expect(docLiveKey(TEST_ID)).toBe('tp-studio:doc:doc_abc123xy:live:v2');
  });

  it('emits the expected backup key shape', () => {
    expect(docBackupKey(TEST_ID)).toBe('tp-studio:doc:doc_abc123xy:backup:v2');
  });

  it('exposes the tabs manifest key as a stable constant', () => {
    expect(tabsManifestKey).toBe('tp-studio:tabs:v1');
  });

  it('exposes the schema-version pointer key as a stable constant', () => {
    expect(schemaVersionKey).toBe('tp-studio:schema:v1');
  });

  it('generates distinct keys per doc id', () => {
    const a = 'doc_aaaa1111' as DocumentId;
    const b = 'doc_bbbb2222' as DocumentId;
    expect(docCommittedKey(a)).not.toBe(docCommittedKey(b));
    expect(docLiveKey(a)).not.toBe(docLiveKey(b));
    expect(docBackupKey(a)).not.toBe(docBackupKey(b));
  });
});
