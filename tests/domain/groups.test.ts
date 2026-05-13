import {
  ancestorChain,
  computeCollapseProjection,
  descendantIds,
  findParentGroup,
  visibleEntityIdsForHoist,
  wouldCreateCycle,
} from '@/domain/groups';
import type { Group, GroupId, TPDocument } from '@/domain/types';
import { beforeEach, describe, expect, it } from 'vitest';
import { makeDoc, makeEntity, resetIds } from './helpers';

const g = (id: string, members: string[], collapsed = false): Group => ({
  id: id as GroupId,
  title: id,
  color: 'indigo',
  memberIds: members,
  collapsed,
  createdAt: 1,
  updatedAt: 1,
});

const docWith = (groups: Group[], extraEntities = 0): TPDocument => {
  const entities = Array.from({ length: extraEntities }, () => makeEntity());
  const base = makeDoc(entities, []);
  return { ...base, groups: Object.fromEntries(groups.map((gr) => [gr.id, gr])) };
};

beforeEach(resetIds);

describe('findParentGroup / ancestorChain / descendantIds', () => {
  it('findParentGroup returns the direct parent', () => {
    const a = makeEntity();
    const doc = docWith([g('G1', [a.id])], 0);
    doc.entities[a.id] = a;
    expect(findParentGroup(doc, a.id)?.id).toBe('G1');
  });

  it('ancestorChain walks up from direct parent to outermost', () => {
    const inner = g('inner', ['e1']);
    const outer = g('outer', ['inner']);
    const doc = docWith([inner, outer]);
    const chain = ancestorChain(doc, 'e1').map((x) => x.id);
    expect(chain).toEqual(['inner', 'outer']);
  });

  it('descendantIds returns every transitively-contained id', () => {
    const inner = g('inner', ['e1', 'e2']);
    const outer = g('outer', ['inner', 'e3']);
    const doc = docWith([inner, outer]);
    expect([...descendantIds(doc, 'outer')].sort()).toEqual(['e1', 'e2', 'e3', 'inner']);
  });
});

describe('wouldCreateCycle', () => {
  it('flags self-add as a cycle', () => {
    const doc = docWith([g('G1', [])]);
    expect(wouldCreateCycle(doc, 'G1', 'G1')).toBe(true);
  });

  it('flags ancestor-into-descendant as a cycle', () => {
    const inner = g('inner', []);
    const outer = g('outer', ['inner']);
    const doc = docWith([inner, outer]);
    // Adding `outer` inside `inner` would close the loop outer→inner→outer.
    expect(wouldCreateCycle(doc, 'inner', 'outer')).toBe(true);
  });

  it('allows adding a sibling group', () => {
    const a = g('A', []);
    const b = g('B', []);
    const doc = docWith([a, b]);
    expect(wouldCreateCycle(doc, 'A', 'B')).toBe(false);
  });

  it('treats an entity id as not a cycle', () => {
    const doc = docWith([g('G1', [])]);
    expect(wouldCreateCycle(doc, 'G1', 'someEntity')).toBe(false);
  });
});

describe('computeCollapseProjection', () => {
  it('returns empty sets when nothing is collapsed', () => {
    const a = makeEntity();
    const doc = docWith([g('G1', [a.id])]);
    doc.entities[a.id] = a;
    const p = computeCollapseProjection(doc);
    expect(p.collapsedRoots.size).toBe(0);
    expect(p.hiddenEntityIds.size).toBe(0);
  });

  it('hides direct member entities when a group is collapsed', () => {
    const a = makeEntity();
    const b = makeEntity();
    const doc = docWith([g('G1', [a.id, b.id], true)]);
    doc.entities[a.id] = a;
    doc.entities[b.id] = b;
    const p = computeCollapseProjection(doc);
    expect(p.collapsedRoots).toEqual(new Set(['G1']));
    expect(p.hiddenEntityIds).toEqual(new Set([a.id, b.id]));
    expect(p.entityToCollapsedRoot.get(a.id)).toBe('G1');
  });

  it('treats a collapsed group inside an already-collapsed parent as non-root', () => {
    const a = makeEntity();
    const inner = g('inner', [a.id], true);
    const outer = g('outer', ['inner'], true);
    const doc = docWith([inner, outer]);
    doc.entities[a.id] = a;
    const p = computeCollapseProjection(doc);
    expect(p.collapsedRoots).toEqual(new Set(['outer']));
    expect(p.hiddenGroupIds.has('inner')).toBe(true);
    expect(p.entityToCollapsedRoot.get(a.id)).toBe('outer');
  });
});

describe('visibleEntityIdsForHoist', () => {
  it('returns all entities when no hoist is active', () => {
    const a = makeEntity();
    const b = makeEntity();
    const doc = makeDoc([a, b], []);
    expect([...visibleEntityIdsForHoist(doc, null)].sort()).toEqual([a.id, b.id].sort());
  });

  it('returns only entities transitively inside the hoisted group', () => {
    const a = makeEntity();
    const b = makeEntity();
    const c = makeEntity();
    const inner = g('inner', [a.id]);
    const outer = g('outer', ['inner', b.id]);
    const doc = makeDoc([a, b, c], []);
    doc.groups = { inner, outer };
    const visible = visibleEntityIdsForHoist(doc, 'outer');
    expect(visible.has(a.id)).toBe(true);
    expect(visible.has(b.id)).toBe(true);
    expect(visible.has(c.id)).toBe(false);
  });
});
