import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { useGraphNodeEmission } from '@/components/canvas/hooks/useGraphNodeEmission';
import { useGraphProjection } from '@/components/canvas/hooks/useGraphProjection';
import type { DetailedRevisionDiff } from '@/domain/revisions';
import type { Group, GroupId, TPDocument } from '@/domain/types';
import { resetStoreForTest } from '@/store';
import { makeDoc, makeEdge, makeEntity, resetIds } from '../../domain/helpers';

const group = (id: string, memberIds: string[], over: Partial<Group> = {}): Group => ({
  id: id as GroupId,
  title: id,
  color: 'indigo',
  memberIds,
  collapsed: false,
  createdAt: 1,
  updatedAt: 1,
  ...over,
});

const emptyDiff = (): DetailedRevisionDiff => ({
  entitiesAdded: new Set(),
  entitiesRemoved: new Set(),
  entitiesChanged: new Set(),
  edgesAdded: new Set(),
  edgesRemoved: new Set(),
  edgesChanged: new Set(),
  groupsAdded: new Set(),
  groupsRemoved: new Set(),
  groupsChanged: new Set(),
});

const emit = (
  doc: TPDocument,
  positions: Record<string, { x: number; y: number }>,
  opts: { compareDiff?: DetailedRevisionDiff | null; showEligibility?: boolean } = {}
) =>
  renderHook(() => {
    const projection = useGraphProjection(doc);
    return useGraphNodeEmission(
      doc,
      projection,
      positions,
      opts.compareDiff ?? null,
      {},
      null,
      opts.showEligibility ?? false
    );
  }).result.current;

beforeEach(() => {
  resetStoreForTest();
  resetIds();
});

describe('useGraphNodeEmission', () => {
  it('emits a tp node per visible entity at its position', () => {
    const a = makeEntity();
    const b = makeEntity();
    const doc = makeDoc([a, b], [makeEdge(a.id, b.id)]);
    const nodes = emit(doc, { [a.id]: { x: 0, y: 0 }, [b.id]: { x: 200, y: 0 } });
    const tp = nodes.filter((n) => n.type === 'tp');
    expect(tp.map((n) => n.id).sort()).toEqual([a.id, b.id].sort());
    expect(tp.find((n) => n.id === a.id)?.position).toEqual({ x: 0, y: 0 });
  });

  it('emits a tpAssumption node from its record (no entity in doc.entities)', () => {
    const a = makeEntity({ title: 'Cause' });
    const b = makeEntity({ title: 'Effect' });
    const e = makeEdge(a.id, b.id);
    const doc: TPDocument = {
      ...makeDoc([a, b], [e]),
      assumptions: {
        asm1: {
          id: 'asm1',
          edgeId: e.id,
          text: 'Because budget holds',
          status: 'unexamined',
          annotationNumber: 9,
          createdAt: 1,
          updatedAt: 1,
        },
      },
    };
    const nodes = emit(doc, {
      [a.id]: { x: 0, y: 0 },
      [b.id]: { x: 0, y: 400 },
      asm1: { x: 300, y: 200 },
    });
    const node = nodes.find((n) => n.id === 'asm1');
    // Dedicated assumption node type — renders from the record, not an entity.
    expect(node?.type).toBe('tpAssumption');
    expect(node?.position).toEqual({ x: 300, y: 200 });
    expect(node?.selectable).toBe(false);
    const rec = (node?.data as { assumption: { text: string; annotationNumber: number } })
      .assumption;
    expect(rec.text).toBe('Because budget holds');
    expect(rec.annotationNumber).toBe(9);
  });

  it('omits an assumption node when placement gave it no position', () => {
    const a = makeEntity();
    const b = makeEntity();
    const e = makeEdge(a.id, b.id);
    const doc: TPDocument = {
      ...makeDoc([a, b], [e]),
      assumptions: {
        asm1: {
          id: 'asm1',
          edgeId: e.id,
          text: 't',
          status: 'unexamined',
          createdAt: 1,
          updatedAt: 1,
        },
      },
    };
    // No position for asm1 (e.g. its host edge is in a collapsed group).
    const nodes = emit(doc, { [a.id]: { x: 0, y: 0 }, [b.id]: { x: 0, y: 400 } });
    expect(nodes.find((n) => n.id === 'asm1')).toBeUndefined();
  });

  it('emits a tpGroup rectangle spanning its members', () => {
    const a = makeEntity();
    const b = makeEntity();
    const doc = makeDoc([a, b], []);
    doc.groups = { g1: group('g1', [a.id, b.id]) };
    const nodes = emit(doc, { [a.id]: { x: 0, y: 0 }, [b.id]: { x: 300, y: 100 } });
    const rect = nodes.find((n) => n.type === 'tpGroup');
    expect(rect?.id).toBe('g1');
    expect(rect?.width ?? 0).toBeGreaterThan(300);
  });

  it('emits a tpCollapsedGroup card for a collapsed group (members hidden)', () => {
    const a = makeEntity();
    const b = makeEntity();
    const doc = makeDoc([a, b], []);
    doc.groups = { g1: group('g1', [a.id, b.id], { collapsed: true }) };
    const nodes = emit(doc, { g1: { x: 10, y: 20 } });
    expect(nodes.filter((n) => n.type === 'tp')).toHaveLength(0);
    const card = nodes.find((n) => n.type === 'tpCollapsedGroup');
    expect(card?.id).toBe('g1');
    expect(card?.position).toEqual({ x: 10, y: 20 });
  });

  it('stamps diffStatus from a compare diff', () => {
    const a = makeEntity();
    const doc = makeDoc([a], []);
    const diff = { ...emptyDiff(), entitiesAdded: new Set([a.id]) };
    const nodes = emit(doc, { [a.id]: { x: 0, y: 0 } }, { compareDiff: diff });
    const node = nodes.find((n) => n.id === a.id);
    expect((node?.data as { diffStatus?: string }).diffStatus).toBe('added');
  });

  it('runs the action-eligibility branch when enabled', () => {
    const a = makeEntity({ type: 'action' });
    const doc = makeDoc([a], [], 'tt');
    const nodes = emit(doc, { [a.id]: { x: 0, y: 0 } }, { showEligibility: true });
    expect(nodes.find((n) => n.id === a.id)).toBeDefined();
  });
});
