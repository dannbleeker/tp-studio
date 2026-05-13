import { entityMeta, paletteForDoc, resolveEntityTypeMeta } from '@/domain/entityTypeMeta';
import type { CustomEntityClass, EntityType } from '@/domain/types';
import { resetStoreForTest, useDocumentStore } from '@/store';
import { beforeEach, describe, expect, it } from 'vitest';
import { seedEntity } from '../helpers/seedDoc';

beforeEach(resetStoreForTest);

const getDoc = () => useDocumentStore.getState().doc;

/**
 * B10 — user-defined entity classes. Tests cover:
 *
 *   - Store CRUD: upsert / remove / no-op on identical replace.
 *   - Resolver: built-in beats custom; custom beats unknown; unknown
 *     produces the placeholder meta.
 *   - paletteForDoc: built-ins first, custom classes appended.
 *   - JSON round-trip preserves custom classes.
 */

describe('upsertCustomEntityClass / removeCustomEntityClass', () => {
  it('adds a new class', () => {
    const cls: CustomEntityClass = { id: 'evidence', label: 'Evidence' };
    useDocumentStore.getState().upsertCustomEntityClass(cls);
    expect(getDoc().customEntityClasses?.evidence).toEqual(cls);
  });

  it('replaces an existing class with the same id', () => {
    const { upsertCustomEntityClass } = useDocumentStore.getState();
    upsertCustomEntityClass({ id: 'evidence', label: 'Evidence' });
    upsertCustomEntityClass({ id: 'evidence', label: 'Citation', color: '#ff0000' });
    expect(getDoc().customEntityClasses?.evidence).toEqual({
      id: 'evidence',
      label: 'Citation',
      color: '#ff0000',
    });
  });

  it('is a no-op when upserting the same value (history coalescing)', () => {
    const { upsertCustomEntityClass } = useDocumentStore.getState();
    upsertCustomEntityClass({ id: 'evidence', label: 'Evidence' });
    const past1 = useDocumentStore.getState().past.length;
    upsertCustomEntityClass({ id: 'evidence', label: 'Evidence' });
    const past2 = useDocumentStore.getState().past.length;
    expect(past2).toBe(past1);
  });

  it('removes a class and collapses customEntityClasses to undefined when empty', () => {
    const { upsertCustomEntityClass, removeCustomEntityClass } = useDocumentStore.getState();
    upsertCustomEntityClass({ id: 'evidence', label: 'Evidence' });
    expect(getDoc().customEntityClasses?.evidence).toBeDefined();
    removeCustomEntityClass('evidence');
    expect(getDoc().customEntityClasses).toBeUndefined();
  });

  it('keeps other classes when removing one', () => {
    const { upsertCustomEntityClass, removeCustomEntityClass } = useDocumentStore.getState();
    upsertCustomEntityClass({ id: 'a', label: 'A' });
    upsertCustomEntityClass({ id: 'b', label: 'B' });
    removeCustomEntityClass('a');
    expect(getDoc().customEntityClasses?.a).toBeUndefined();
    expect(getDoc().customEntityClasses?.b).toBeDefined();
  });
});

describe('resolveEntityTypeMeta', () => {
  it('returns the built-in meta when the type is a known EntityType', () => {
    const meta = resolveEntityTypeMeta('ude');
    expect(meta.label).toBe('Undesirable Effect');
    expect(meta.type).toBe('ude');
  });

  it('returns the custom-class meta when the type matches a custom class', () => {
    const meta = resolveEntityTypeMeta('evidence', {
      evidence: { id: 'evidence', label: 'Evidence', color: '#abcdef' },
    });
    expect(meta.label).toBe('Evidence');
    expect(meta.stripeColor).toBe('#abcdef');
  });

  it('returns the placeholder meta when the type is unknown', () => {
    const meta = resolveEntityTypeMeta('mystery-id');
    expect(meta.label).toBe('mystery-id');
    // Neutral fallback colour — not undefined.
    expect(meta.stripeColor).toBeTruthy();
  });

  it('built-ins win over a custom class that tries to shadow them', () => {
    // The persistence validator rejects this at load time, but the
    // resolver itself defends against in-memory shadowing too.
    const meta = resolveEntityTypeMeta('ude', {
      ude: { id: 'ude', label: 'Shadow' },
    });
    expect(meta.label).toBe('Undesirable Effect');
  });
});

describe('entityMeta (doc convenience)', () => {
  it('forwards customEntityClasses from the doc', () => {
    seedEntity('Source A');
    useDocumentStore.getState().upsertCustomEntityClass({ id: 'evidence', label: 'Evidence' });
    const doc = getDoc();
    const meta = entityMeta('evidence', doc);
    expect(meta.label).toBe('Evidence');
  });
});

describe('paletteForDoc', () => {
  it('built-ins come first, custom classes appended in id order', () => {
    useDocumentStore.getState().upsertCustomEntityClass({ id: 'zeta', label: 'Z' });
    useDocumentStore.getState().upsertCustomEntityClass({ id: 'alpha', label: 'A' });
    const palette = paletteForDoc(getDoc());
    // CRT palette begins with 'ude'
    expect(palette[0]).toBe('ude');
    expect(palette).toContain('alpha');
    expect(palette).toContain('zeta');
    // alpha comes before zeta (sorted).
    expect(palette.indexOf('alpha')).toBeLessThan(palette.indexOf('zeta'));
  });
});

describe('custom-class persistence round-trip', () => {
  it('survives exportToJSON / importFromJSON', async () => {
    useDocumentStore.getState().upsertCustomEntityClass({
      id: 'evidence',
      label: 'Evidence',
      color: '#abcdef',
      hint: 'A citation',
      supersetOf: 'effect' as EntityType,
    });
    const { exportToJSON, importFromJSON } = await import('@/domain/persistence');
    const json = exportToJSON(getDoc());
    const round = importFromJSON(json);
    expect(round.customEntityClasses?.evidence).toEqual({
      id: 'evidence',
      label: 'Evidence',
      color: '#abcdef',
      hint: 'A citation',
      supersetOf: 'effect',
    });
  });

  it('drops a malformed custom class on import (soft validator)', async () => {
    const { importFromJSON } = await import('@/domain/persistence');
    const doc = JSON.parse(
      JSON.stringify({
        ...getDoc(),
        customEntityClasses: {
          ok: { id: 'ok', label: 'OK' },
          // id mismatch with map key → dropped.
          mismatched: { id: 'different', label: 'X' },
          // slug rule violation → dropped.
          'BAD ID': { id: 'BAD ID', label: 'X' },
          // empty label → dropped.
          empty: { id: 'empty', label: '' },
        },
      })
    );
    const round = importFromJSON(JSON.stringify(doc));
    expect(round.customEntityClasses).toEqual({
      ok: { id: 'ok', label: 'OK' },
    });
  });
});
