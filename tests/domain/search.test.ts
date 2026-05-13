import { findMatches } from '@/domain/search';
import type { Group, GroupId } from '@/domain/types';
import { beforeEach, describe, expect, it } from 'vitest';
import { makeDoc, makeEntity, resetIds } from './helpers';

beforeEach(resetIds);

describe('findMatches', () => {
  it('returns an empty list for an empty query', () => {
    const a = makeEntity({ title: 'Alpha' });
    const doc = makeDoc([a], []);
    expect(findMatches(doc, '')).toEqual([]);
  });

  it('matches entity titles case-insensitively by default', () => {
    const a = makeEntity({ title: 'Order entry is manual' });
    const b = makeEntity({ title: 'Warehouse is understaffed' });
    const doc = makeDoc([a, b], []);
    const matches = findMatches(doc, 'WAREHOUSE');
    expect(matches).toHaveLength(1);
    expect(matches[0]!.id).toBe(b.id);
    expect(matches[0]!.field).toBe('title');
  });

  it('matches in descriptions in addition to titles', () => {
    const a = makeEntity({ title: 'A', description: 'mentions Warehouse here' });
    const doc = makeDoc([a], []);
    const matches = findMatches(doc, 'warehouse');
    expect(matches.map((m) => m.field)).toEqual(['description']);
  });

  it('respects case-sensitive option', () => {
    const a = makeEntity({ title: 'Alpha' });
    const doc = makeDoc([a], []);
    expect(findMatches(doc, 'alpha', { caseSensitive: true })).toEqual([]);
    expect(findMatches(doc, 'Alpha', { caseSensitive: true })).toHaveLength(1);
  });

  it('respects whole-word option', () => {
    const a = makeEntity({ title: 'tabletop' });
    const b = makeEntity({ title: 'table top' });
    const doc = makeDoc([a, b], []);
    const matches = findMatches(doc, 'table', { wholeWord: true });
    expect(matches.map((m) => m.id)).toEqual([b.id]);
  });

  it('accepts a regex pattern', () => {
    const a = makeEntity({ title: 'ABC-001 production' });
    const b = makeEntity({ title: 'staging-only' });
    const doc = makeDoc([a, b], []);
    const matches = findMatches(doc, 'ABC-\\d+', { regex: true });
    expect(matches.map((m) => m.id)).toEqual([a.id]);
  });

  it('accepts the /pattern/flags regex shorthand', () => {
    const a = makeEntity({ title: 'Alpha' });
    const doc = makeDoc([a], []);
    expect(findMatches(doc, '/alpha/i', { regex: true })).toHaveLength(1);
  });

  it('returns nothing for an invalid regex', () => {
    const a = makeEntity({ title: 'Alpha' });
    const doc = makeDoc([a], []);
    expect(findMatches(doc, '[', { regex: true })).toEqual([]);
  });

  it('matches group titles', () => {
    const a = makeEntity();
    const group: Group = {
      id: 'G' as GroupId,
      title: 'Operational issues',
      color: 'amber',
      memberIds: [],
      collapsed: false,
      createdAt: 1,
      updatedAt: 1,
    };
    const doc = { ...makeDoc([a], []), groups: { G: group } };
    const matches = findMatches(doc, 'operational');
    expect(matches.map((m) => m.kind)).toEqual(['group']);
    expect(matches[0]!.id).toBe('G');
  });

  it('matches edge labels', () => {
    const a = makeEntity();
    const b = makeEntity();
    const doc = makeDoc([a, b], []);
    // Inject an edge with a label by constructing a minimal one.
    doc.edges = {
      e1: {
        id: 'e1' as never,
        sourceId: a.id,
        targetId: b.id,
        kind: 'sufficiency',
        label: 'within 30 days',
      },
    };
    const matches = findMatches(doc, '30 days');
    expect(matches.map((m) => m.kind)).toEqual(['edge']);
    expect(matches[0]!.field).toBe('label');
  });
});
