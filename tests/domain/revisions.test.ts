import { describe, expect, it } from 'vitest';
import { createDocument } from '@/domain/factory';
import {
  computeDetailedRevisionDiff,
  computeRevisionDiff,
  edgeStatusFromDiff,
  entityStatusFromDiff,
  isEmptyDiff,
  summarizeRevisionDiff,
} from '@/domain/revisions';
import type { Edge, EdgeId, Entity, EntityId, Group, GroupId, TPDocument } from '@/domain/types';

/**
 * Domain tests for the revision diff. `computeRevisionDiff` is a pure
 * function over two `TPDocument`s — every test here builds the two docs
 * by hand and asserts on the resulting counts. The summarizer is
 * exercised through `summarizeRevisionDiff` for the user-facing string.
 */

const baseEntity = (id: string, title = 'A', type: Entity['type'] = 'effect'): Entity => ({
  id: id as EntityId,
  type,
  title,
  annotationNumber: 1,
  createdAt: 0,
  updatedAt: 0,
});

const baseEdge = (id: string, sourceId: string, targetId: string): Edge => ({
  id: id as EdgeId,
  sourceId: sourceId as EntityId,
  targetId: targetId as EntityId,
  kind: 'sufficiency',
});

const docWith = (overrides: Partial<TPDocument>): TPDocument => ({
  ...createDocument('crt'),
  ...overrides,
});

describe('computeRevisionDiff', () => {
  it('returns all-zero counts for two identical docs', () => {
    const a = docWith({});
    const b = docWith({ id: a.id });
    const d = computeRevisionDiff(a, b);
    expect(isEmptyDiff(d)).toBe(true);
  });

  it('counts entity adds and removes', () => {
    const e1 = baseEntity('e1', 'one');
    const e2 = baseEntity('e2', 'two');
    const a = docWith({ entities: { e1 } });
    const b = docWith({ entities: { e2 } });
    const d = computeRevisionDiff(a, b);
    expect(d.entitiesAdded).toBe(1);
    expect(d.entitiesRemoved).toBe(1);
    expect(d.entitiesChanged).toBe(0);
  });

  it('counts entity content change when the title differs', () => {
    const a = docWith({ entities: { e1: baseEntity('e1', 'before') } });
    const b = docWith({ entities: { e1: baseEntity('e1', 'after') } });
    const d = computeRevisionDiff(a, b);
    expect(d.entitiesChanged).toBe(1);
    expect(d.entitiesAdded).toBe(0);
    expect(d.entitiesRemoved).toBe(0);
  });

  it('counts entity change when the type differs', () => {
    const a = docWith({ entities: { e1: baseEntity('e1', 'x', 'effect') } });
    const b = docWith({ entities: { e1: baseEntity('e1', 'x', 'rootCause') } });
    expect(computeRevisionDiff(a, b).entitiesChanged).toBe(1);
  });

  it('ignores position changes on auto-layout diagrams', () => {
    const e1a = { ...baseEntity('e1'), position: { x: 0, y: 0 } };
    const e1b = { ...baseEntity('e1'), position: { x: 100, y: 100 } };
    const a = docWith({ entities: { e1: e1a } });
    const b = docWith({ entities: { e1: e1b } });
    expect(computeRevisionDiff(a, b).entitiesChanged).toBe(0);
  });

  it('counts position changes on manual-layout (EC) diagrams', () => {
    const e1a = { ...baseEntity('e1'), position: { x: 0, y: 0 } };
    const e1b = { ...baseEntity('e1'), position: { x: 100, y: 100 } };
    const a = docWith({ diagramType: 'ec', entities: { e1: e1a } });
    const b = docWith({ diagramType: 'ec', entities: { e1: e1b } });
    expect(computeRevisionDiff(a, b).entitiesChanged).toBe(1);
  });

  it('counts edge add / remove / endpoint change', () => {
    const e1 = baseEntity('e1');
    const e2 = baseEntity('e2');
    const e3 = baseEntity('e3');
    const a = docWith({ entities: { e1, e2 }, edges: { ed1: baseEdge('ed1', 'e1', 'e2') } });
    const b = docWith({
      entities: { e1, e2, e3 },
      edges: { ed1: baseEdge('ed1', 'e1', 'e3'), ed2: baseEdge('ed2', 'e2', 'e3') },
    });
    const d = computeRevisionDiff(a, b);
    expect(d.entitiesAdded).toBe(1);
    expect(d.edgesAdded).toBe(1);
    expect(d.edgesChanged).toBe(1); // ed1's target moved
  });
});

describe('summarizeRevisionDiff', () => {
  it('says "No changes" for a no-op diff', () => {
    const a = docWith({});
    const b = docWith({ id: a.id });
    expect(summarizeRevisionDiff(computeRevisionDiff(a, b))).toBe('No changes');
  });

  it('joins adds, removes, and changes with comma separators', () => {
    const e1 = baseEntity('e1', 'before');
    const e2 = baseEntity('e2');
    const e3 = baseEntity('e3');
    const a = docWith({ entities: { e1, e2 } });
    const b = docWith({
      entities: { e1: baseEntity('e1', 'after'), e3 },
    });
    const summary = summarizeRevisionDiff(computeRevisionDiff(a, b));
    expect(summary).toContain('+1 entity');
    expect(summary).toContain('−1 entity');
    expect(summary).toContain('1 entity changed');
  });

  it('pluralizes correctly', () => {
    const a = docWith({});
    const b = docWith({
      entities: { e1: baseEntity('e1'), e2: baseEntity('e2'), e3: baseEntity('e3') },
    });
    expect(summarizeRevisionDiff(computeRevisionDiff(a, b))).toBe('+3 entities');
  });
});

describe('computeDetailedRevisionDiff', () => {
  it('returns the actual id sets for added / removed / changed entities', () => {
    const e1 = baseEntity('e1', 'before');
    const e2 = baseEntity('e2');
    const e3 = baseEntity('e3');
    const a = docWith({ entities: { e1, e2 } });
    const b = docWith({ entities: { e1: baseEntity('e1', 'after'), e3 } });
    const d = computeDetailedRevisionDiff(a, b);
    expect([...d.entitiesAdded]).toEqual(['e3']);
    expect([...d.entitiesRemoved]).toEqual(['e2']);
    expect([...d.entitiesChanged]).toEqual(['e1']);
  });

  it('tracks edge add / remove / endpoint-change id sets', () => {
    const e1 = baseEntity('e1');
    const e2 = baseEntity('e2');
    const e3 = baseEntity('e3');
    const a = docWith({
      entities: { e1, e2, e3 },
      edges: { ed1: baseEdge('ed1', 'e1', 'e2'), ed2: baseEdge('ed2', 'e2', 'e3') },
    });
    const b = docWith({
      entities: { e1, e2, e3 },
      edges: { ed1: baseEdge('ed1', 'e1', 'e3'), ed3: baseEdge('ed3', 'e1', 'e2') },
    });
    const d = computeDetailedRevisionDiff(a, b);
    expect(d.edgesAdded.has('ed3')).toBe(true);
    expect(d.edgesRemoved.has('ed2')).toBe(true);
    expect(d.edgesChanged.has('ed1')).toBe(true); // ed1's target moved e2 → e3
  });

  it('returns the same cached object for an unchanged (prev, next) reference pair', () => {
    const a = docWith({ entities: { e1: baseEntity('e1') } });
    const b = docWith({ entities: { e1: baseEntity('e1'), e2: baseEntity('e2') } });
    const first = computeDetailedRevisionDiff(a, b);
    const second = computeDetailedRevisionDiff(a, b);
    expect(second).toBe(first); // two-level WeakMap cache hit
  });
});

describe('computeRevisionDiff — entityContentEqual optional-field branches', () => {
  it('counts entity as changed when description differs', () => {
    const base = baseEntity('e1', 'X');
    const a = docWith({ entities: { e1: { ...base, description: 'old' } } });
    const b = docWith({ entities: { e1: { ...base, description: 'new' } } });
    expect(computeRevisionDiff(a, b).entitiesChanged).toBe(1);
  });

  it('treats missing description as empty string (equal)', () => {
    const base = baseEntity('e1', 'X');
    const a = docWith({ entities: { e1: { ...base } } });
    const b = docWith({ entities: { e1: { ...base, description: '' } } });
    expect(computeRevisionDiff(a, b).entitiesChanged).toBe(0);
  });

  it('counts entity as changed when titleSize differs', () => {
    const base = baseEntity('e1', 'X');
    const a = docWith({ entities: { e1: { ...base, titleSize: 'sm' } } });
    const b = docWith({ entities: { e1: { ...base, titleSize: 'lg' } } });
    expect(computeRevisionDiff(a, b).entitiesChanged).toBe(1);
  });

  it('treats missing titleSize as "md" (equal)', () => {
    const base = baseEntity('e1', 'X');
    const a = docWith({ entities: { e1: { ...base } } });
    const b = docWith({ entities: { e1: { ...base, titleSize: 'md' } } });
    expect(computeRevisionDiff(a, b).entitiesChanged).toBe(0);
  });

  it('counts entity as changed when ordering differs', () => {
    const base = baseEntity('e1', 'X');
    const a = docWith({ entities: { e1: { ...base, ordering: 1 } } });
    const b = docWith({ entities: { e1: { ...base, ordering: 2 } } });
    expect(computeRevisionDiff(a, b).entitiesChanged).toBe(1);
  });

  it('treats missing ordering as -1 (equal)', () => {
    const base = baseEntity('e1', 'X');
    const a = docWith({ entities: { e1: { ...base } } });
    const b = docWith({ entities: { e1: { ...base, ordering: -1 } } });
    expect(computeRevisionDiff(a, b).entitiesChanged).toBe(0);
  });

  it('counts entity as changed when collapsed differs', () => {
    const base = baseEntity('e1', 'X');
    const a = docWith({ entities: { e1: { ...base, collapsed: false } } });
    const b = docWith({ entities: { e1: { ...base, collapsed: true } } });
    expect(computeRevisionDiff(a, b).entitiesChanged).toBe(1);
  });

  it('treats missing collapsed as false (equal)', () => {
    const base = baseEntity('e1', 'X');
    const a = docWith({ entities: { e1: { ...base } } });
    const b = docWith({ entities: { e1: { ...base, collapsed: false } } });
    expect(computeRevisionDiff(a, b).entitiesChanged).toBe(0);
  });

  it('counts EC entity as changed when one side has position and the other does not', () => {
    const base = baseEntity('e1', 'X');
    const a = docWith({
      diagramType: 'ec',
      entities: { e1: { ...base, position: { x: 0, y: 0 } } },
    });
    const b = docWith({ diagramType: 'ec', entities: { e1: { ...base } } });
    expect(computeRevisionDiff(a, b).entitiesChanged).toBe(1);
  });

  it('treats equal positions on EC as unchanged', () => {
    const base = baseEntity('e1', 'X');
    const pos = { x: 42, y: 99 };
    const a = docWith({ diagramType: 'ec', entities: { e1: { ...base, position: pos } } });
    const b = docWith({ diagramType: 'ec', entities: { e1: { ...base, position: { ...pos } } } });
    expect(computeRevisionDiff(a, b).entitiesChanged).toBe(0);
  });

  it('counts EC entity as changed when positions differ in x', () => {
    const base = baseEntity('e1', 'X');
    const a = docWith({
      diagramType: 'ec',
      entities: { e1: { ...base, position: { x: 0, y: 0 } } },
    });
    const b = docWith({
      diagramType: 'ec',
      entities: { e1: { ...base, position: { x: 1, y: 0 } } },
    });
    expect(computeRevisionDiff(a, b).entitiesChanged).toBe(1);
  });

  it('counts EC entity as changed when positions differ in y', () => {
    const base = baseEntity('e1', 'X');
    const a = docWith({
      diagramType: 'ec',
      entities: { e1: { ...base, position: { x: 0, y: 0 } } },
    });
    const b = docWith({
      diagramType: 'ec',
      entities: { e1: { ...base, position: { x: 0, y: 5 } } },
    });
    expect(computeRevisionDiff(a, b).entitiesChanged).toBe(1);
  });

  it('positionMatters when prev is EC and next is not', () => {
    // prev is EC (manual), next is CRT (auto) — position still matters because either side is manual
    const base = baseEntity('e1', 'X');
    const a = docWith({
      diagramType: 'ec',
      entities: { e1: { ...base, position: { x: 0, y: 0 } } },
    });
    const b = docWith({
      diagramType: 'crt',
      entities: { e1: { ...base, position: { x: 50, y: 50 } } },
    });
    expect(computeRevisionDiff(a, b).entitiesChanged).toBe(1);
  });
});

describe('computeRevisionDiff — edgeContentEqual newly-compared fields', () => {
  it('counts edge as changed when weight differs (negative vs unset)', () => {
    const e1 = baseEntity('e1');
    const e2 = baseEntity('e2');
    const edgeA = { ...baseEdge('ed1', 'e1', 'e2'), weight: 'negative' as const };
    const edgeB = baseEdge('ed1', 'e1', 'e2');
    const a = docWith({ entities: { e1, e2 }, edges: { ed1: edgeA } });
    const b = docWith({ entities: { e1, e2 }, edges: { ed1: edgeB } });
    expect(computeRevisionDiff(a, b).edgesChanged).toBe(1);
  });

  it('counts edge as changed when isBackEdge differs (true vs unset)', () => {
    const e1 = baseEntity('e1');
    const e2 = baseEntity('e2');
    const edgeA = { ...baseEdge('ed1', 'e1', 'e2'), isBackEdge: true };
    const edgeB = baseEdge('ed1', 'e1', 'e2');
    const a = docWith({ entities: { e1, e2 }, edges: { ed1: edgeA } });
    const b = docWith({ entities: { e1, e2 }, edges: { ed1: edgeB } });
    expect(computeRevisionDiff(a, b).edgesChanged).toBe(1);
  });

  it('counts edge as changed when delay differs (true vs unset)', () => {
    const e1 = baseEntity('e1');
    const e2 = baseEntity('e2');
    const edgeA = { ...baseEdge('ed1', 'e1', 'e2'), delay: true };
    const edgeB = baseEdge('ed1', 'e1', 'e2');
    const a = docWith({ entities: { e1, e2 }, edges: { ed1: edgeA } });
    const b = docWith({ entities: { e1, e2 }, edges: { ed1: edgeB } });
    expect(computeRevisionDiff(a, b).edgesChanged).toBe(1);
  });

  it('counts edge as changed when orGroupId differs (set vs unset)', () => {
    const e1 = baseEntity('e1');
    const e2 = baseEntity('e2');
    const edgeA = { ...baseEdge('ed1', 'e1', 'e2'), orGroupId: 'g' };
    const edgeB = baseEdge('ed1', 'e1', 'e2');
    const a = docWith({ entities: { e1, e2 }, edges: { ed1: edgeA } });
    const b = docWith({ entities: { e1, e2 }, edges: { ed1: edgeB } });
    expect(computeRevisionDiff(a, b).edgesChanged).toBe(1);
  });

  it('counts edge as changed when kind differs (necessity vs sufficiency)', () => {
    const e1 = baseEntity('e1');
    const e2 = baseEntity('e2');
    const edgeA = { ...baseEdge('ed1', 'e1', 'e2'), kind: 'necessity' as const };
    const edgeB = baseEdge('ed1', 'e1', 'e2'); // kind: 'sufficiency'
    const a = docWith({ entities: { e1, e2 }, edges: { ed1: edgeA } });
    const b = docWith({ entities: { e1, e2 }, edges: { ed1: edgeB } });
    expect(computeRevisionDiff(a, b).edgesChanged).toBe(1);
  });
});

describe('computeRevisionDiff — edgeContentEqual branches', () => {
  it('counts edge as changed when andGroupId differs', () => {
    const e1 = baseEntity('e1');
    const e2 = baseEntity('e2');
    const edgeA = { ...baseEdge('ed1', 'e1', 'e2'), andGroupId: 'g1' };
    const edgeB = { ...baseEdge('ed1', 'e1', 'e2'), andGroupId: 'g2' };
    const a = docWith({ entities: { e1, e2 }, edges: { ed1: edgeA } });
    const b = docWith({ entities: { e1, e2 }, edges: { ed1: edgeB } });
    expect(computeRevisionDiff(a, b).edgesChanged).toBe(1);
  });

  it('treats missing andGroupId as empty string (equal)', () => {
    const e1 = baseEntity('e1');
    const e2 = baseEntity('e2');
    const edgeA = baseEdge('ed1', 'e1', 'e2');
    const edgeB = { ...baseEdge('ed1', 'e1', 'e2'), andGroupId: '' };
    const a = docWith({ entities: { e1, e2 }, edges: { ed1: edgeA } });
    const b = docWith({ entities: { e1, e2 }, edges: { ed1: edgeB } });
    expect(computeRevisionDiff(a, b).edgesChanged).toBe(0);
  });

  it('counts edge as changed when label differs', () => {
    const e1 = baseEntity('e1');
    const e2 = baseEntity('e2');
    const edgeA = { ...baseEdge('ed1', 'e1', 'e2'), label: 'because' };
    const edgeB = { ...baseEdge('ed1', 'e1', 'e2'), label: 'therefore' };
    const a = docWith({ entities: { e1, e2 }, edges: { ed1: edgeA } });
    const b = docWith({ entities: { e1, e2 }, edges: { ed1: edgeB } });
    expect(computeRevisionDiff(a, b).edgesChanged).toBe(1);
  });

  it('treats missing label as empty string (equal)', () => {
    const e1 = baseEntity('e1');
    const e2 = baseEntity('e2');
    const edgeA = baseEdge('ed1', 'e1', 'e2');
    const edgeB = { ...baseEdge('ed1', 'e1', 'e2'), label: '' };
    const a = docWith({ entities: { e1, e2 }, edges: { ed1: edgeA } });
    const b = docWith({ entities: { e1, e2 }, edges: { ed1: edgeB } });
    expect(computeRevisionDiff(a, b).edgesChanged).toBe(0);
  });

  it('counts edge sourceId change', () => {
    const e1 = baseEntity('e1');
    const e2 = baseEntity('e2');
    const e3 = baseEntity('e3');
    const a = docWith({ entities: { e1, e2, e3 }, edges: { ed1: baseEdge('ed1', 'e1', 'e2') } });
    const b = docWith({ entities: { e1, e2, e3 }, edges: { ed1: baseEdge('ed1', 'e3', 'e2') } });
    expect(computeRevisionDiff(a, b).edgesChanged).toBe(1);
  });
});

const baseGroup = (id: string, title = 'G', memberIds: string[] = []): Group => ({
  id: id as GroupId,
  title,
  color: 'slate',
  memberIds,
  collapsed: false,
  createdAt: 0,
  updatedAt: 0,
});

describe('computeRevisionDiff — group diffs', () => {
  it('counts group adds', () => {
    const g1 = baseGroup('g1', 'Group 1');
    const a = docWith({ groups: {} });
    const b = docWith({ groups: { g1 } });
    const d = computeRevisionDiff(a, b);
    expect(d.groupsAdded).toBe(1);
    expect(d.groupsRemoved).toBe(0);
    expect(d.groupsChanged).toBe(0);
  });

  it('counts group removals', () => {
    const g1 = baseGroup('g1', 'Group 1');
    const a = docWith({ groups: { g1 } });
    const b = docWith({ groups: {} });
    const d = computeRevisionDiff(a, b);
    expect(d.groupsRemoved).toBe(1);
    expect(d.groupsAdded).toBe(0);
    expect(d.groupsChanged).toBe(0);
  });

  it('counts group title change', () => {
    const g1a = baseGroup('g1', 'Before');
    const g1b = baseGroup('g1', 'After');
    const a = docWith({ groups: { g1: g1a } });
    const b = docWith({ groups: { g1: g1b } });
    expect(computeRevisionDiff(a, b).groupsChanged).toBe(1);
  });

  it('counts group color change', () => {
    const g1a = { ...baseGroup('g1'), color: 'slate' } as Group;
    const g1b = { ...baseGroup('g1'), color: 'indigo' } as Group;
    const a = docWith({ groups: { g1: g1a } });
    const b = docWith({ groups: { g1: g1b } });
    expect(computeRevisionDiff(a, b).groupsChanged).toBe(1);
  });

  it('counts group collapsed change', () => {
    const g1a = { ...baseGroup('g1'), collapsed: false };
    const g1b = { ...baseGroup('g1'), collapsed: true };
    const a = docWith({ groups: { g1: g1a } });
    const b = docWith({ groups: { g1: g1b } });
    expect(computeRevisionDiff(a, b).groupsChanged).toBe(1);
  });

  it('counts group memberIds length change', () => {
    const g1a = baseGroup('g1', 'G', ['e1']);
    const g1b = baseGroup('g1', 'G', ['e1', 'e2']);
    const a = docWith({ groups: { g1: g1a } });
    const b = docWith({ groups: { g1: g1b } });
    expect(computeRevisionDiff(a, b).groupsChanged).toBe(1);
  });

  it('counts group memberIds content change (same length)', () => {
    const g1a = baseGroup('g1', 'G', ['e1']);
    const g1b = baseGroup('g1', 'G', ['e2']);
    const a = docWith({ groups: { g1: g1a } });
    const b = docWith({ groups: { g1: g1b } });
    expect(computeRevisionDiff(a, b).groupsChanged).toBe(1);
  });

  it('treats equal groups as unchanged', () => {
    const g1 = baseGroup('g1', 'Same', ['e1', 'e2']);
    const a = docWith({ groups: { g1 } });
    const b = docWith({ groups: { g1: { ...g1 } } });
    expect(computeRevisionDiff(a, b).groupsChanged).toBe(0);
    expect(isEmptyDiff(computeRevisionDiff(a, b))).toBe(true);
  });
});

describe('isEmptyDiff — individual field coverage', () => {
  it('returns false when only edgesAdded is non-zero', () => {
    const d = {
      entitiesAdded: 0,
      entitiesRemoved: 0,
      entitiesChanged: 0,
      edgesAdded: 1,
      edgesRemoved: 0,
      edgesChanged: 0,
      groupsAdded: 0,
      groupsRemoved: 0,
      groupsChanged: 0,
    };
    expect(isEmptyDiff(d)).toBe(false);
  });

  it('returns false when only edgesRemoved is non-zero', () => {
    const d = {
      entitiesAdded: 0,
      entitiesRemoved: 0,
      entitiesChanged: 0,
      edgesAdded: 0,
      edgesRemoved: 1,
      edgesChanged: 0,
      groupsAdded: 0,
      groupsRemoved: 0,
      groupsChanged: 0,
    };
    expect(isEmptyDiff(d)).toBe(false);
  });

  it('returns false when only edgesChanged is non-zero', () => {
    const d = {
      entitiesAdded: 0,
      entitiesRemoved: 0,
      entitiesChanged: 0,
      edgesAdded: 0,
      edgesRemoved: 0,
      edgesChanged: 1,
      groupsAdded: 0,
      groupsRemoved: 0,
      groupsChanged: 0,
    };
    expect(isEmptyDiff(d)).toBe(false);
  });

  it('returns false when only groupsAdded is non-zero', () => {
    const d = {
      entitiesAdded: 0,
      entitiesRemoved: 0,
      entitiesChanged: 0,
      edgesAdded: 0,
      edgesRemoved: 0,
      edgesChanged: 0,
      groupsAdded: 1,
      groupsRemoved: 0,
      groupsChanged: 0,
    };
    expect(isEmptyDiff(d)).toBe(false);
  });

  it('returns false when only groupsRemoved is non-zero', () => {
    const d = {
      entitiesAdded: 0,
      entitiesRemoved: 0,
      entitiesChanged: 0,
      edgesAdded: 0,
      edgesRemoved: 0,
      edgesChanged: 0,
      groupsAdded: 0,
      groupsRemoved: 1,
      groupsChanged: 0,
    };
    expect(isEmptyDiff(d)).toBe(false);
  });

  it('returns false when only groupsChanged is non-zero', () => {
    const d = {
      entitiesAdded: 0,
      entitiesRemoved: 0,
      entitiesChanged: 0,
      edgesAdded: 0,
      edgesRemoved: 0,
      edgesChanged: 0,
      groupsAdded: 0,
      groupsRemoved: 0,
      groupsChanged: 1,
    };
    expect(isEmptyDiff(d)).toBe(false);
  });
});

describe('summarizeRevisionDiff — edge and group summaries', () => {
  it('reports edge additions with singular form', () => {
    const e1 = baseEntity('e1');
    const e2 = baseEntity('e2');
    const a = docWith({ entities: { e1, e2 }, edges: {} });
    const b = docWith({ entities: { e1, e2 }, edges: { ed1: baseEdge('ed1', 'e1', 'e2') } });
    expect(summarizeRevisionDiff(computeRevisionDiff(a, b))).toBe('+1 edge');
  });

  it('reports multiple edge additions with plural form', () => {
    const e1 = baseEntity('e1');
    const e2 = baseEntity('e2');
    const e3 = baseEntity('e3');
    const a = docWith({ entities: { e1, e2, e3 }, edges: {} });
    const b = docWith({
      entities: { e1, e2, e3 },
      edges: { ed1: baseEdge('ed1', 'e1', 'e2'), ed2: baseEdge('ed2', 'e2', 'e3') },
    });
    expect(summarizeRevisionDiff(computeRevisionDiff(a, b))).toBe('+2 edges');
  });

  it('reports edge removals', () => {
    const e1 = baseEntity('e1');
    const e2 = baseEntity('e2');
    const a = docWith({ entities: { e1, e2 }, edges: { ed1: baseEdge('ed1', 'e1', 'e2') } });
    const b = docWith({ entities: { e1, e2 }, edges: {} });
    expect(summarizeRevisionDiff(computeRevisionDiff(a, b))).toContain('−1 edge');
  });

  it('reports edge changes', () => {
    const e1 = baseEntity('e1');
    const e2 = baseEntity('e2');
    const e3 = baseEntity('e3');
    const a = docWith({ entities: { e1, e2, e3 }, edges: { ed1: baseEdge('ed1', 'e1', 'e2') } });
    const b = docWith({ entities: { e1, e2, e3 }, edges: { ed1: baseEdge('ed1', 'e1', 'e3') } });
    expect(summarizeRevisionDiff(computeRevisionDiff(a, b))).toContain('1 edge changed');
  });

  it('reports multiple edge changes with plural form', () => {
    const e1 = baseEntity('e1');
    const e2 = baseEntity('e2');
    const e3 = baseEntity('e3');
    const a = docWith({
      entities: { e1, e2, e3 },
      edges: { ed1: baseEdge('ed1', 'e1', 'e2'), ed2: baseEdge('ed2', 'e2', 'e3') },
    });
    const b = docWith({
      entities: { e1, e2, e3 },
      edges: { ed1: baseEdge('ed1', 'e1', 'e3'), ed2: baseEdge('ed2', 'e1', 'e3') },
    });
    expect(summarizeRevisionDiff(computeRevisionDiff(a, b))).toContain('2 edges changed');
  });

  it('reports group additions with singular form', () => {
    const g1 = baseGroup('g1', 'Group 1');
    const a = docWith({ groups: {} });
    const b = docWith({ groups: { g1 } });
    expect(summarizeRevisionDiff(computeRevisionDiff(a, b))).toBe('+1 group');
  });

  it('reports multiple group additions with plural form', () => {
    const g1 = baseGroup('g1', 'Group 1');
    const g2 = baseGroup('g2', 'Group 2');
    const a = docWith({ groups: {} });
    const b = docWith({ groups: { g1, g2 } });
    expect(summarizeRevisionDiff(computeRevisionDiff(a, b))).toBe('+2 groups');
  });

  it('reports group removals', () => {
    const g1 = baseGroup('g1', 'Group 1');
    const a = docWith({ groups: { g1 } });
    const b = docWith({ groups: {} });
    expect(summarizeRevisionDiff(computeRevisionDiff(a, b))).toContain('−1 group');
  });

  it('reports group changes', () => {
    const g1a = baseGroup('g1', 'Before');
    const g1b = baseGroup('g1', 'After');
    const a = docWith({ groups: { g1: g1a } });
    const b = docWith({ groups: { g1: g1b } });
    expect(summarizeRevisionDiff(computeRevisionDiff(a, b))).toContain('1 group changed');
  });

  it('combines entity + edge + group additions in one summary', () => {
    const e1 = baseEntity('e1');
    const e2 = baseEntity('e2');
    const g1 = baseGroup('g1');
    const a = docWith({ groups: {} });
    const b = docWith({
      entities: { e1, e2 },
      edges: { ed1: baseEdge('ed1', 'e1', 'e2') },
      groups: { g1 },
    });
    const summary = summarizeRevisionDiff(computeRevisionDiff(a, b));
    expect(summary).toContain('+2 entities');
    expect(summary).toContain('+1 edge');
    expect(summary).toContain('+1 group');
  });

  it('combines additions and removals across all categories', () => {
    const e1 = baseEntity('e1');
    const e2 = baseEntity('e2');
    const g1 = baseGroup('g1');
    const a = docWith({
      entities: { e1 },
      edges: { ed1: baseEdge('ed1', 'e1', 'e1') },
      groups: { g1 },
    });
    const b = docWith({
      entities: { e2 },
      edges: {},
      groups: {},
    });
    const summary = summarizeRevisionDiff(computeRevisionDiff(a, b));
    expect(summary).toContain('+1 entity');
    expect(summary).toContain('−1 entity');
    expect(summary).toContain('−1 edge');
    expect(summary).toContain('−1 group');
  });
});

describe('computeDetailedRevisionDiff — group tracking', () => {
  it('returns group id sets for added / removed / changed groups', () => {
    const g1 = baseGroup('g1', 'Before');
    const g2 = baseGroup('g2', 'Stable');
    const g3 = baseGroup('g3', 'New');
    const a = docWith({ groups: { g1, g2 } });
    const b = docWith({ groups: { g1: baseGroup('g1', 'After'), g3 } });
    const d = computeDetailedRevisionDiff(a, b);
    expect(d.groupsAdded.has('g3')).toBe(true);
    expect(d.groupsRemoved.has('g2')).toBe(true);
    expect(d.groupsChanged.has('g1')).toBe(true);
    expect(d.groupsAdded.has('g1')).toBe(false);
    expect(d.groupsRemoved.has('g1')).toBe(false);
  });

  it('returns empty group sets when groups are identical', () => {
    const g1 = baseGroup('g1', 'Same');
    const a = docWith({ groups: { g1 } });
    const b = docWith({ groups: { g1: { ...g1 } } });
    const d = computeDetailedRevisionDiff(a, b);
    expect(d.groupsAdded.size).toBe(0);
    expect(d.groupsRemoved.size).toBe(0);
    expect(d.groupsChanged.size).toBe(0);
  });
});

describe('entityStatusFromDiff / edgeStatusFromDiff', () => {
  it('resolves each entity id to its diff status', () => {
    const e1 = baseEntity('e1', 'before');
    const e2 = baseEntity('e2');
    const e3 = baseEntity('e3');
    const a = docWith({ entities: { e1, e2 } });
    const b = docWith({ entities: { e1: baseEntity('e1', 'after'), e3 } });
    const d = computeDetailedRevisionDiff(a, b);
    expect(entityStatusFromDiff(d, 'e3')).toBe('added');
    expect(entityStatusFromDiff(d, 'e2')).toBe('removed');
    expect(entityStatusFromDiff(d, 'e1')).toBe('changed');
    expect(entityStatusFromDiff(d, 'missing')).toBe('unchanged');
  });

  it('resolves each edge id to its diff status', () => {
    const e1 = baseEntity('e1');
    const e2 = baseEntity('e2');
    const e3 = baseEntity('e3');
    const a = docWith({
      entities: { e1, e2, e3 },
      edges: { ed1: baseEdge('ed1', 'e1', 'e2'), ed2: baseEdge('ed2', 'e2', 'e3') },
    });
    const b = docWith({
      entities: { e1, e2, e3 },
      edges: { ed1: baseEdge('ed1', 'e1', 'e3'), ed3: baseEdge('ed3', 'e1', 'e2') },
    });
    const d = computeDetailedRevisionDiff(a, b);
    expect(edgeStatusFromDiff(d, 'ed3')).toBe('added');
    expect(edgeStatusFromDiff(d, 'ed2')).toBe('removed');
    expect(edgeStatusFromDiff(d, 'ed1')).toBe('changed');
    expect(edgeStatusFromDiff(d, 'missing')).toBe('unchanged');
  });
});
