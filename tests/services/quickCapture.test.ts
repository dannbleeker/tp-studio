import { beforeEach, describe, expect, it } from 'vitest';
import { parseQuickCapture } from '@/domain/quickCapture';
import { applyQuickCapture } from '@/services/quickCapture';
import { resetStoreForTest, useDocumentStore } from '@/store';
import { currentDoc } from '@/store/selectors';
import { seedEntity } from '../helpers/seedDoc';

// `applyQuickCapture` is the store-integration glue between the pure parser
// (`parseQuickCapture`, tested separately) and the document: it mints an entity
// per captured node, turns the tree's parent/child links into edges, optionally
// anchors free roots, and re-selects the whole pasted set. It was at ~4%
// coverage — none of those behaviours were pinned. These drive it through the
// live store (no mocks), the same way the seedDoc helpers do.

beforeEach(resetStoreForTest);

const doc = () => currentDoc(useDocumentStore.getState());
const entities = () => Object.values(doc().entities);
const edges = () => Object.values(doc().edges);
const idByTitle = () => Object.fromEntries(entities().map((e) => [e.title, e.id]));

describe('applyQuickCapture', () => {
  it('no-ops on an empty parse result (nothing pasted)', () => {
    const summary = applyQuickCapture(parseQuickCapture(''), null);
    expect(summary).toEqual({ entities: 0, edges: 0 });
    expect(entities()).toHaveLength(0);
    expect(edges()).toHaveLength(0);
  });

  it('creates one entity per line for a flat list and no edges when unattached', () => {
    const summary = applyQuickCapture(parseQuickCapture('Alpha\nBravo\nCharlie'), null);
    expect(summary).toEqual({ entities: 3, edges: 0 });
    expect(
      entities()
        .map((e) => e.title)
        .sort()
    ).toEqual(['Alpha', 'Bravo', 'Charlie']);
    expect(edges()).toHaveLength(0);
  });

  it('turns indentation into parent→child edges leaving the parent entity', () => {
    const summary = applyQuickCapture(parseQuickCapture('Parent\n  Child One\n  Child Two'), null);
    expect(summary).toEqual({ entities: 3, edges: 2 });

    const id = idByTitle();
    const es = edges();
    expect(es).toHaveLength(2);
    expect(es.every((e) => e.sourceId === id.Parent)).toBe(true);
    expect(es.map((e) => e.targetId).sort()).toEqual([id['Child One'], id['Child Two']].sort());
  });

  it('attaches free-floating roots to the given anchor entity', () => {
    const anchor = seedEntity('Anchor', 'effect');
    const summary = applyQuickCapture(parseQuickCapture('Root A\nRoot B'), anchor.id);
    expect(summary).toEqual({ entities: 2, edges: 2 });
    // 1 seeded anchor + 2 captured roots.
    expect(entities()).toHaveLength(3);
    const es = edges();
    expect(es).toHaveLength(2);
    expect(es.every((e) => e.sourceId === anchor.id)).toBe(true);
  });

  it('leaves the entire captured set selected, not just the last entity created', () => {
    applyQuickCapture(parseQuickCapture('One\nTwo\nThree'), null);
    const sel = useDocumentStore.getState().selection;
    expect(sel.kind).toBe('entities');
    if (sel.kind !== 'entities') return;
    const captured = entities()
      .map((e) => String(e.id))
      .sort();
    expect([...sel.ids].map(String).sort()).toEqual(captured);
  });

  it('adds every captured entity to a selected group (Session 193)', () => {
    const seed = seedEntity('Seed', 'effect');
    useDocumentStore.getState().createGroupFromSelection([seed.id], { title: 'Cluster' });
    const groupId = Object.keys(doc().groups)[0]!;
    expect(doc().groups[groupId]?.memberIds).toEqual([seed.id]);

    const summary = applyQuickCapture(parseQuickCapture('Alpha\n  Beta'), null, groupId);
    expect(summary).toEqual({ entities: 2, edges: 1 });

    const group = doc().groups[groupId];
    // seed + Alpha + Beta all live in the group now.
    expect(group?.memberIds).toHaveLength(3);
    const byTitle = idByTitle();
    expect(group?.memberIds).toContain(byTitle.Alpha);
    expect(group?.memberIds).toContain(byTitle.Beta);
    // The internal parent→child edge is still created (indentation preserved).
    expect(edges()).toHaveLength(1);
  });
});
