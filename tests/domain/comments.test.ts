import { describe, expect, it } from 'vitest';
import { pruneComments } from '@/domain/graph';
import { exportToJSON, importFromJSON } from '@/domain/persistence';
import { validateComment } from '@/domain/persistenceValidators';
import type { Comment } from '@/domain/types';
import { makeDoc, makeEdge, makeEntity } from './helpers';

// validateComment takes `unknown`, so plain objects (no branded ids) are fine.
const VALID = {
  id: 'c1',
  anchor: { kind: 'document' },
  body: 'Looks off here',
  author: 'Dann',
  createdAt: 1,
  updatedAt: 1,
};

describe('validateComment', () => {
  it('accepts a well-formed comment + each anchor kind', () => {
    expect(() => validateComment(VALID, 'l')).not.toThrow();
    expect(
      validateComment({ ...VALID, anchor: { kind: 'entity', entityId: 'e1' } }, 'l').anchor.kind
    ).toBe('entity');
    expect(
      validateComment({ ...VALID, anchor: { kind: 'edge', edgeId: 'ed1' } }, 'l').anchor.kind
    ).toBe('edge');
  });

  it('rejects an invalid / incomplete anchor', () => {
    expect(() => validateComment({ ...VALID, anchor: { kind: 'bogus' } }, 'l')).toThrow(/anchor/);
    expect(() => validateComment({ ...VALID, anchor: { kind: 'entity' } }, 'l')).toThrow(/anchor/);
  });

  it('rejects non-string body / author and non-finite timestamps', () => {
    expect(() => validateComment({ ...VALID, body: 5 }, 'l')).toThrow(/body/);
    expect(() => validateComment({ ...VALID, author: 5 }, 'l')).toThrow(/author/);
    expect(() => validateComment({ ...VALID, createdAt: Number.NaN }, 'l')).toThrow(/createdAt/);
  });

  it('keeps parentId + resolved (type-or-omit) and strips them when absent/false', () => {
    const withExtras = validateComment({ ...VALID, parentId: 'p1', resolved: true }, 'l');
    expect(withExtras.parentId).toBe('p1');
    expect(withExtras.resolved).toBe(true);
    const bare = validateComment({ ...VALID, resolved: false }, 'l');
    expect(bare.resolved).toBeUndefined();
    expect('parentId' in bare).toBe(false);
  });
});

describe('pruneComments', () => {
  const e = makeEntity({ title: 'A' });
  const mk = (over: Partial<Comment>): Comment => ({
    id: 'x',
    anchor: { kind: 'document' },
    body: 'b',
    author: 'D',
    createdAt: 1,
    updatedAt: 1,
    ...over,
  });

  it('keeps an entity-anchored comment when the entity survives', () => {
    const map = { c1: mk({ id: 'c1', anchor: { kind: 'entity', entityId: e.id } }) };
    expect(pruneComments(map, {}, { [e.id]: e })).toBe(map);
  });

  it('drops an entity-anchored comment when the entity is gone', () => {
    const map = { c1: mk({ id: 'c1', anchor: { kind: 'entity', entityId: e.id } }) };
    expect(pruneComments(map, {}, {})).toEqual({});
  });

  it('always keeps document-anchored comments', () => {
    const map = { d1: mk({ id: 'd1', anchor: { kind: 'document' } }) };
    expect(pruneComments(map, {}, {})).toBe(map);
  });

  it('drops replies orphaned when their parent dies', () => {
    const map = {
      p1: mk({ id: 'p1', anchor: { kind: 'entity', entityId: e.id } }),
      r1: mk({ id: 'r1', anchor: { kind: 'entity', entityId: e.id }, parentId: 'p1' }),
    };
    expect(pruneComments(map, {}, {})).toEqual({});
  });

  it('returns the same reference when nothing changed', () => {
    const map = { d1: mk({ id: 'd1', anchor: { kind: 'document' } }) };
    expect(pruneComments(map, {}, {})).toBe(map);
    expect(pruneComments(undefined, {}, {})).toBeUndefined();
  });
});

describe('comments round-trip + migration', () => {
  it('round-trips comments through export/import', () => {
    const a = makeEntity({ title: 'A' });
    const b = makeEntity({ title: 'B' });
    const edge = makeEdge(a.id, b.id);
    const comment: Comment = {
      id: 'c1',
      anchor: { kind: 'entity', entityId: a.id },
      body: 'why this?',
      author: 'Dann',
      createdAt: 1,
      updatedAt: 1,
    };
    const doc = { ...makeDoc([a, b], [edge]), comments: { c1: comment } };
    const restored = importFromJSON(exportToJSON(doc));
    expect(restored.comments?.c1).toEqual(comment);
  });

  it('omits an empty comments map on persist', () => {
    const doc = { ...makeDoc([], []), comments: {} };
    expect(importFromJSON(exportToJSON(doc)).comments).toBeUndefined();
  });

  it('migrates a v8 document to v9 (additive, no data change)', () => {
    const restored = importFromJSON(JSON.stringify({ ...makeDoc([], []), schemaVersion: 8 }));
    expect(restored.schemaVersion).toBe(9);
  });
});
