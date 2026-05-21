import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Entity } from '@/domain/types';
import { resetStoreForTest, useDocumentStore } from '@/store';
import { makeEntity, resetIds as resetTestIds } from '../domain/helpers';

/**
 * Session 135 / spec major gap #3 Phase 1B — cross-diagram entity
 * import tests.
 *
 * Covers `addImportedEntity`: takes a source-doc id + a source
 * Entity, mints a new entity in the current doc carrying an
 * `importedFrom` ref. The new entity copies type + title +
 * description so it reads sensibly from day one.
 */

const s = () => useDocumentStore.getState();

beforeEach(() => {
  resetTestIds();
  resetStoreForTest();
});
afterEach(resetStoreForTest);

describe('addImportedEntity', () => {
  it('mints a new entity in the current doc with importedFrom set', () => {
    const sourceEntity: Entity = makeEntity({
      type: 'ude',
      title: 'Customer churn',
      description: 'Customers dropping at 15%/mo',
    });
    const before = Object.keys(s().doc.entities).length;
    const minted = s().addImportedEntity({
      sourceDocId: 'src-doc-abc',
      sourceEntity,
    });
    expect(minted).not.toBeNull();
    if (!minted) return;
    expect(Object.keys(s().doc.entities).length).toBe(before + 1);
    const stored = s().doc.entities[minted.id];
    expect(stored).toBeDefined();
    expect(stored?.type).toBe('ude');
    expect(stored?.title).toBe('Customer churn');
    expect(stored?.description).toBe('Customers dropping at 15%/mo');
    expect(stored?.importedFrom).toEqual({
      docId: 'src-doc-abc',
      entityId: sourceEntity.id,
      sourceTitle: 'Customer churn',
      // importedAt is a Date.now() ISO string at mint time — assert
      // shape, not exact value.
      importedAt: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/),
    });
  });

  it('selects the newly imported entity', () => {
    const sourceEntity = makeEntity({ type: 'effect', title: 'Slow onboarding' });
    const minted = s().addImportedEntity({
      sourceDocId: 'src-doc-abc',
      sourceEntity,
    });
    if (!minted) return;
    const sel = s().selection;
    expect(sel.kind).toBe('entities');
    if (sel.kind === 'entities') {
      expect(sel.ids).toEqual([minted.id]);
    }
  });

  it('mints a fresh id — does NOT reuse the source entity id', () => {
    const sourceEntity = makeEntity({ type: 'effect', title: 'X' });
    const minted = s().addImportedEntity({
      sourceDocId: 'src-doc-abc',
      sourceEntity,
    });
    if (!minted) return;
    expect(minted.id).not.toBe(sourceEntity.id);
  });

  it('skips description when the source entity has none', () => {
    const sourceEntity = makeEntity({ type: 'effect', title: 'Plain' });
    const minted = s().addImportedEntity({
      sourceDocId: 'src-doc-abc',
      sourceEntity,
    });
    if (!minted) return;
    expect(s().doc.entities[minted.id]?.description).toBeUndefined();
  });

  it('skips sourceTitle when the source entity has empty title', () => {
    const sourceEntity = makeEntity({ type: 'effect', title: '' });
    const minted = s().addImportedEntity({
      sourceDocId: 'src-doc-abc',
      sourceEntity,
    });
    if (!minted) return;
    expect(s().doc.entities[minted.id]?.importedFrom?.sourceTitle).toBeUndefined();
  });

  it('returns null when sourceDocId is empty', () => {
    const sourceEntity = makeEntity({ type: 'effect', title: 'X' });
    expect(s().addImportedEntity({ sourceDocId: '', sourceEntity })).toBeNull();
  });

  it('the next annotation number advances after import', () => {
    const next = s().doc.nextAnnotationNumber;
    const sourceEntity = makeEntity({ type: 'effect', title: 'X' });
    s().addImportedEntity({ sourceDocId: 'src-doc-abc', sourceEntity });
    expect(s().doc.nextAnnotationNumber).toBe(next + 1);
  });
});
