import { describe, expect, it } from 'vitest';
import { importFromJSON } from '@/domain/persistence';

/**
 * Phase 2a (TP completeness #2) — `Entity.links` persistence. Links are
 * navigation metadata, so a malformed entry is dropped (not fatal) while a
 * non-array throws; an all-invalid / absent list round-trips as no field.
 */

type RawEntity = Record<string, unknown>;
const baseEntity = (id: string, extra: RawEntity): RawEntity => ({
  id,
  type: 'ude',
  title: id,
  annotationNumber: 1,
  createdAt: 1,
  updatedAt: 1,
  ...extra,
});
const docJSON = (entities: Record<string, RawEntity>): string =>
  JSON.stringify({
    schemaVersion: 9,
    id: 'doc-a',
    diagramType: 'crt',
    title: 'A',
    nextAnnotationNumber: 2,
    entities,
    edges: {},
    groups: {},
    resolvedWarnings: {},
    createdAt: 1,
    updatedAt: 1,
  });

describe('Entity.links — persistence round-trip', () => {
  it('round-trips a valid links array', () => {
    const doc = importFromJSON(
      docJSON({ e1: baseEntity('e1', { links: [{ docId: 'doc-b', entityId: 'e2' }] }) })
    );
    expect(doc.entities.e1?.links).toEqual([{ docId: 'doc-b', entityId: 'e2' }]);
  });

  it('drops malformed entries but keeps the valid ones', () => {
    const doc = importFromJSON(
      docJSON({
        e1: baseEntity('e1', {
          links: [
            { docId: 'doc-b', entityId: 'e2' }, // valid
            { docId: '', entityId: 'e3' }, // empty docId → drop
            { entityId: 'e4' }, // missing docId → drop
            'nope', // not an object → drop
          ],
        }),
      })
    );
    expect(doc.entities.e1?.links).toEqual([{ docId: 'doc-b', entityId: 'e2' }]);
  });

  it('omits the field entirely when every entry is invalid (no empty array)', () => {
    const doc = importFromJSON(docJSON({ e1: baseEntity('e1', { links: [{ docId: '' }] }) }));
    expect(doc.entities.e1?.links).toBeUndefined();
  });

  it('omits the field when links is absent', () => {
    const doc = importFromJSON(docJSON({ e1: baseEntity('e1', {}) }));
    expect(doc.entities.e1?.links).toBeUndefined();
  });

  it('throws when links is not an array', () => {
    expect(() => importFromJSON(docJSON({ e1: baseEntity('e1', { links: 'nope' }) }))).toThrow();
  });
});
