import { createDocument } from '@/domain/factory';
import { computeRevisionDiff, isEmptyDiff, summarizeRevisionDiff } from '@/domain/revisions';
import type { Edge, EdgeId, Entity, EntityId, TPDocument } from '@/domain/types';
import { describe, expect, it } from 'vitest';

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
