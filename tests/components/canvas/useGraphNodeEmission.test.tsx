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
