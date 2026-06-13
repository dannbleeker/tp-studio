import { beforeEach, describe, expect, it } from 'vitest';
import { documentCommands } from '@/components/command-palette/commands/document';
import { importFromJSON } from '@/domain/persistence';
import type { DocumentId, EntityId, TPDocument } from '@/domain/types';
import { resetStoreForTest, useDocumentStore } from '@/store';

/**
 * Phase 2a (TP completeness #2 — U-Shape linkage) — the reciprocal cross-tab
 * link store actions + the "Link to entity in another tab…" command guards.
 */

const buildDoc = (docId: string, entityId: string): TPDocument =>
  importFromJSON(
    JSON.stringify({
      schemaVersion: 9,
      id: docId,
      diagramType: 'crt',
      title: docId,
      nextAnnotationNumber: 2,
      entities: {
        [entityId]: {
          id: entityId,
          type: 'ude',
          title: entityId,
          annotationNumber: 1,
          createdAt: 1,
          updatedAt: 1,
        },
      },
      edges: {},
      groups: {},
      resolvedWarnings: {},
      createdAt: 1,
      updatedAt: 1,
    })
  );

const s = () => useDocumentStore.getState();
const did = (id: string): DocumentId => id as unknown as DocumentId;
const eid = (id: string): EntityId => id as unknown as EntityId;

/** docA + docB in two tabs; active = docA with entity a1 selected. */
const setupTwoTabs = (): void => {
  s().setDocument(buildDoc('doc-a', 'a1'));
  s().openTab(buildDoc('doc-b', 'b1'));
  s().switchTab(did('doc-a'));
  s().selectEntity(eid('a1'));
};

beforeEach(resetStoreForTest);

describe('linkSelectedEntityTo — reciprocal cross-tab links', () => {
  it('writes a mirror link on both the source and the target entity', () => {
    setupTwoTabs();
    s().linkSelectedEntityTo(did('doc-b'), eid('b1'));
    expect(s().docs[did('doc-a')]?.entities.a1?.links).toEqual([
      { docId: 'doc-b', entityId: 'b1' },
    ]);
    expect(s().docs[did('doc-b')]?.entities.b1?.links).toEqual([
      { docId: 'doc-a', entityId: 'a1' },
    ]);
  });

  it('is a dedup no-op when the same pair is linked twice', () => {
    setupTwoTabs();
    s().linkSelectedEntityTo(did('doc-b'), eid('b1'));
    s().linkSelectedEntityTo(did('doc-b'), eid('b1'));
    expect(s().docs[did('doc-a')]?.entities.a1?.links).toHaveLength(1);
    expect(s().toasts.some((t) => /already linked/i.test(t.message))).toBe(true);
  });

  it('no-ops when no single entity is selected', () => {
    setupTwoTabs();
    useDocumentStore.setState({ selection: { kind: 'none' } });
    s().linkSelectedEntityTo(did('doc-b'), eid('b1'));
    expect(s().docs[did('doc-b')]?.entities.b1?.links).toBeUndefined();
  });

  it('no-ops when the target is the same (active) document', () => {
    setupTwoTabs();
    s().linkSelectedEntityTo(did('doc-a'), eid('a1'));
    expect(s().docs[did('doc-a')]?.entities.a1?.links).toBeUndefined();
  });
});

describe('unlinkEntity — reciprocal removal', () => {
  it('removes the link from both entities (dropping the empty array)', () => {
    setupTwoTabs();
    s().linkSelectedEntityTo(did('doc-b'), eid('b1'));
    s().unlinkEntity(eid('a1'), { docId: did('doc-b'), entityId: eid('b1') });
    expect(s().docs[did('doc-a')]?.entities.a1?.links).toBeUndefined();
    expect(s().docs[did('doc-b')]?.entities.b1?.links).toBeUndefined();
  });
});

describe('deleteEntity / deleteEntitiesAndEdges — sweep reciprocal mirror links', () => {
  it('removes the mirror from the other tab when a linked entity is deleted', () => {
    setupTwoTabs();
    s().linkSelectedEntityTo(did('doc-b'), eid('b1'));
    expect(s().docs[did('doc-b')]?.entities.b1?.links).toHaveLength(1);
    s().deleteEntity('a1');
    expect(s().docs[did('doc-b')]?.entities.b1?.links).toBeUndefined();
  });

  it('bulk delete sweeps mirror links too', () => {
    setupTwoTabs();
    s().linkSelectedEntityTo(did('doc-b'), eid('b1'));
    s().deleteEntitiesAndEdges(['a1'], []);
    expect(s().docs[did('doc-b')]?.entities.b1?.links).toBeUndefined();
  });

  it('sweeps in the reverse direction (delete the entity in the target tab)', () => {
    setupTwoTabs();
    s().linkSelectedEntityTo(did('doc-b'), eid('b1'));
    s().switchTab(did('doc-b'));
    s().deleteEntity('b1');
    expect(s().docs[did('doc-a')]?.entities.a1?.links).toBeUndefined();
  });
});

describe('closeTab — keeps links into the (reopenable) closed doc', () => {
  it('keeps links pointing into a closed BACKGROUND tab', () => {
    setupTwoTabs();
    s().linkSelectedEntityTo(did('doc-b'), eid('b1'));
    expect(s().doc.entities.a1?.links).toHaveLength(1);
    s().closeTab(did('doc-b'));
    // doc-b is reopenable from the library, so doc-a's link to it survives — the
    // inspector renders it as a muted "tab closed" chip that revives on reopen.
    expect(s().docs[did('doc-a')]?.entities.a1?.links).toEqual([
      { docId: 'doc-b', entityId: 'b1' },
    ]);
  });

  it('keeps links when the closed doc is the ACTIVE tab', () => {
    setupTwoTabs();
    s().linkSelectedEntityTo(did('doc-b'), eid('b1'));
    s().closeTab(did('doc-a')); // close the active doc → doc-b becomes active
    expect(s().activeDocId).toBe(did('doc-b'));
    expect(s().doc.entities.b1?.links).toEqual([{ docId: 'doc-a', entityId: 'a1' }]);
  });
});

describe('deleteSavedDoc — sweeps links into the forgotten doc', () => {
  it('sweeps links pointing into a deleted (still-open) tab', () => {
    setupTwoTabs();
    s().linkSelectedEntityTo(did('doc-b'), eid('b1'));
    expect(s().doc.entities.a1?.links).toHaveLength(1);
    s().deleteSavedDoc(did('doc-b'));
    // Deleting forgets the doc for good → doc-a's now-dangling link is swept.
    expect(s().docs[did('doc-a')]?.entities.a1?.links).toBeUndefined();
  });

  it('sweeps links into a doc that was closed first, then deleted', () => {
    setupTwoTabs();
    s().linkSelectedEntityTo(did('doc-b'), eid('b1'));
    s().closeTab(did('doc-b')); // closed but reopenable → link kept
    expect(s().docs[did('doc-a')]?.entities.a1?.links).toHaveLength(1);
    s().deleteSavedDoc(did('doc-b')); // now truly gone → link swept
    expect(s().docs[did('doc-a')]?.entities.a1?.links).toBeUndefined();
  });
});

describe('"Link to entity in another tab…" command guards', () => {
  const linkCmd = documentCommands.find((c) => c.id === 'link-entity-cross-tab');
  if (!linkCmd) throw new Error('link-entity-cross-tab command not found');

  it('nudges + leaves the picker closed with no entity selected', async () => {
    await linkCmd.run(s());
    expect(s().linkEntityPickerOpen).toBe(false);
    expect(s().toasts.some((t) => /select a single entity/i.test(t.message))).toBe(true);
  });

  it('nudges when only one tab is open', async () => {
    s().selectEntity(eid('whatever'));
    await linkCmd.run(s());
    expect(s().linkEntityPickerOpen).toBe(false);
    expect(s().toasts.some((t) => /second tab/i.test(t.message))).toBe(true);
  });

  it('opens the picker with one entity selected and ≥2 tabs open', async () => {
    setupTwoTabs();
    await linkCmd.run(s());
    expect(s().linkEntityPickerOpen).toBe(true);
  });
});
