import { beforeEach, describe, expect, it } from 'vitest';
import { createDocument } from '@/domain/factory';
import { exportToJSON, importFromJSON } from '@/domain/persistence';
import { resetStoreForTest, useDocumentStore } from '@/store';
import { seedEntity } from '../helpers/seedDoc';

beforeEach(() => {
  resetStoreForTest();
  localStorage.clear();
});
const s = () => useDocumentStore.getState();

describe('reverseEdge on a junctor-grouped edge (bug-hunt #1)', () => {
  it('strips junctor membership and prunes the group left with one member', () => {
    const a = seedEntity('A');
    const b = seedEntity('B');
    const c = seedEntity('C');
    const eAC = s().connect(a.id, c.id);
    const eBC = s().connect(b.id, c.id);
    if (!eAC || !eBC) throw new Error('setup');
    s().groupAsAnd([eAC.id, eBC.id]);
    expect(s().doc.edges[eAC.id]?.andGroupId).toBeDefined();

    s().reverseEdge(eAC.id);

    // The reversed edge (now C→A) dropped its junctor membership...
    const rev = s().doc.edges[eAC.id];
    expect(rev?.sourceId).toBe(c.id);
    expect(rev?.targetId).toBe(a.id);
    expect(rev?.andGroupId).toBeUndefined();
    // ...and the lone remaining member collapsed back to a plain edge (no
    // mixed-target group survives).
    expect(s().doc.edges[eBC.id]?.andGroupId).toBeUndefined();
  });
});

describe('openTab guard against a duplicate id (bug-hunt #2)', () => {
  it('replaces the active tab in place when its own id is re-opened', () => {
    s().setTitle('Original');
    const id = s().activeDocId;
    const before = s().tabOrder.length;

    s().openTab({ ...createDocument('crt'), id, title: 'Re-imported' });

    expect(s().tabOrder.filter((t) => t === id)).toHaveLength(1); // no duplicate
    expect(s().tabOrder.length).toBe(before);
    expect(s().doc.id).toBe(id);
    expect(s().doc.title).toBe('Re-imported'); // body replaced
  });

  it('replaces a background tab in place and switches to it', () => {
    s().setTitle('D');
    const dId = s().activeDocId;
    s().openTab(createDocument('frt')); // active is now the FRT; D is a background tab
    const before = s().tabOrder.length;

    s().openTab({ ...createDocument('crt'), id: dId, title: 'D-reimported' });

    expect(s().tabOrder.filter((t) => t === dId)).toHaveLength(1);
    expect(s().tabOrder.length).toBe(before);
    expect(s().activeDocId).toBe(dId);
    expect(s().doc.title).toBe('D-reimported');
  });
});

describe('cascade delete prunes assumption-anchored comments (bug-hunt #7)', () => {
  it('drops a comment anchored to an assumption whose edge is deleted', () => {
    const a = seedEntity('A');
    const b = seedEntity('B');
    const edge = s().connect(a.id, b.id);
    if (!edge) throw new Error('setup');
    const assumption = s().addAssumptionToEdge(edge.id, 'because X');
    if (!assumption) throw new Error('setup');
    const comment = s().addComment(
      { kind: 'assumption', assumptionId: assumption.id },
      'note on the assumption'
    );
    expect(comment).not.toBeNull();
    expect(Object.keys(s().doc.comments ?? {})).toHaveLength(1);

    s().deleteEdge(edge.id);

    // The assumption orphaned and was pruned; its comment must be pruned in
    // lockstep, not left dangling.
    expect(Object.keys(s().doc.comments ?? {})).toHaveLength(0);
  });
});

describe('nextAnnotationNumber rebuild includes assumptions (bug-hunt #13)', () => {
  it('does not re-mint a number an assumption already holds', () => {
    const a = seedEntity('A'); // annotation 1
    const b = seedEntity('B'); // annotation 2
    const edge = s().connect(a.id, b.id);
    if (!edge) throw new Error('setup');
    const assumption = s().addAssumptionToEdge(edge.id); // annotation 3 — the max
    const annNum = assumption?.annotationNumber;
    if (annNum === undefined) throw new Error('setup');

    // Re-import a copy whose nextAnnotationNumber was dropped (a tolerated-absent
    // field → the importer recomputes it).
    const raw = JSON.parse(exportToJSON(s().doc));
    delete raw.nextAnnotationNumber;
    const reimported = importFromJSON(JSON.stringify(raw));

    // Must clear the assumption's number, not collide with it.
    expect(reimported.nextAnnotationNumber).toBe(annNum + 1);
  });
});

describe('deleteSavedDoc Undo restores journey membership (bug-hunt #14)', () => {
  it('re-enrols a deleted member tree when the delete is undone', () => {
    s().newDocument('crt');
    s().startJourney(); // enrols the active CRT under 'what'
    const id = s().activeDocId;
    s().openTab(createDocument('frt')); // FRT active; the CRT is now a background tab
    expect(s().journey?.members.some((m) => m.docId === id)).toBe(true);

    s().deleteSavedDoc(id);
    expect(s().journey?.members.some((m) => m.docId === id)).toBe(false);

    s()
      .toasts.find((t) => t.action?.label === 'Undo')
      ?.action?.run();

    expect(s().journey?.members.some((m) => m.docId === id)).toBe(true);
  });
});
