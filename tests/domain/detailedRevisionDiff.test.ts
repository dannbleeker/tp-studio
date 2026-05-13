import {
  computeDetailedRevisionDiff,
  edgeStatusFromDiff,
  entityStatusFromDiff,
} from '@/domain/revisions';
import { beforeEach, describe, expect, it } from 'vitest';
import { makeDoc, makeEdge, makeEntity, resetIds } from './helpers';

beforeEach(() => resetIds());

describe('computeDetailedRevisionDiff', () => {
  it('returns empty sets when the docs are equal', () => {
    const e = makeEntity({ title: 'A' });
    const doc = makeDoc([e], []);
    const diff = computeDetailedRevisionDiff(doc, doc);
    expect(diff.entitiesAdded.size).toBe(0);
    expect(diff.entitiesRemoved.size).toBe(0);
    expect(diff.entitiesChanged.size).toBe(0);
  });

  it('flags added entities by id', () => {
    const a = makeEntity({ title: 'A' });
    const b = makeEntity({ title: 'B' });
    const prev = makeDoc([a], []);
    const next = makeDoc([a, b], []);
    const diff = computeDetailedRevisionDiff(prev, next);
    expect(diff.entitiesAdded.has(b.id)).toBe(true);
    expect(diff.entitiesAdded.has(a.id)).toBe(false);
  });

  it('flags removed entities by id', () => {
    const a = makeEntity({ title: 'A' });
    const b = makeEntity({ title: 'B' });
    const prev = makeDoc([a, b], []);
    const next = makeDoc([a], []);
    const diff = computeDetailedRevisionDiff(prev, next);
    expect(diff.entitiesRemoved.has(b.id)).toBe(true);
  });

  it('flags changed entities (title change)', () => {
    const a = makeEntity({ title: 'A' });
    const prev = makeDoc([a], []);
    const next = makeDoc([{ ...a, title: 'A renamed' }], []);
    const diff = computeDetailedRevisionDiff(prev, next);
    expect(diff.entitiesChanged.has(a.id)).toBe(true);
  });

  it('flags edges by id with added/removed/changed', () => {
    const a = makeEntity({ title: 'A' });
    const b = makeEntity({ title: 'B' });
    const edge = makeEdge(a.id, b.id);
    const newEdge = makeEdge(a.id, b.id);
    const prev = makeDoc([a, b], [edge]);
    const next = makeDoc([a, b], [{ ...edge, label: 'because' }, newEdge]);
    const diff = computeDetailedRevisionDiff(prev, next);
    expect(diff.edgesChanged.has(edge.id)).toBe(true);
    expect(diff.edgesAdded.has(newEdge.id)).toBe(true);
  });
});

describe('entityStatusFromDiff / edgeStatusFromDiff', () => {
  it('returns the expected status per entity id', () => {
    const a = makeEntity({ title: 'A' });
    const b = makeEntity({ title: 'B' });
    const c = makeEntity({ title: 'C' });
    const prev = makeDoc([a, b], []);
    const next = makeDoc([a, { ...b, title: 'B new' }, c], []);
    const diff = computeDetailedRevisionDiff(prev, next);
    expect(entityStatusFromDiff(diff, a.id)).toBe('unchanged');
    expect(entityStatusFromDiff(diff, b.id)).toBe('changed');
    expect(entityStatusFromDiff(diff, c.id)).toBe('added');
  });

  it('edgeStatusFromDiff returns added for a brand-new edge', () => {
    const a = makeEntity({ title: 'A' });
    const b = makeEntity({ title: 'B' });
    const edge = makeEdge(a.id, b.id);
    const prev = makeDoc([a, b], []);
    const next = makeDoc([a, b], [edge]);
    const diff = computeDetailedRevisionDiff(prev, next);
    expect(edgeStatusFromDiff(diff, edge.id)).toBe('added');
  });
});
