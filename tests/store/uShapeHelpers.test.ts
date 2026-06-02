import { beforeEach, describe, expect, it } from 'vitest';
import { importFromJSON } from '@/domain/persistence';
import type { DocumentId, EntityId, TPDocument } from '@/domain/types';
import { resetStoreForTest, useDocumentStore } from '@/store';

/**
 * Phase 2b (TP completeness #2 — U-Shape) — the core-problem marker + the two
 * guided "build the next step" helpers (each spawns the next doc in a new tab,
 * reciprocally linked to the source entity).
 */

const buildCRT = (docId: string, entityId: string, title: string): TPDocument =>
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
          title,
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

beforeEach(resetStoreForTest);

describe('toggleCoreProblem', () => {
  it('marks then unmarks the entity (and drops the field on unmark)', () => {
    s().setDocument(buildCRT('crt-1', 'e1', 'Churn'));
    s().toggleCoreProblem(eid('e1'));
    expect(s().doc.entities.e1?.coreProblem).toBe(true);
    s().toggleCoreProblem(eid('e1'));
    expect(s().doc.entities.e1?.coreProblem).toBeUndefined();
  });
});

describe('createCoreCloudFromSelection', () => {
  it('opens a linked Core Cloud (EC, cloudType=core) in a new tab, reciprocally linked', () => {
    s().setDocument(buildCRT('crt-1', 'e1', 'Late deliveries'));
    s().selectEntity(eid('e1'));
    const tabsBefore = s().tabOrder.length;
    s().createCoreCloudFromSelection();

    expect(s().tabOrder.length).toBe(tabsBefore + 1);
    expect(s().doc.diagramType).toBe('ec'); // the cloud is now active
    expect(s().doc.cloudType).toBe('core');

    const boxA = Object.values(s().doc.entities).find((e) => e.ecSlot === 'a');
    expect(boxA?.links).toEqual([{ docId: 'crt-1', entityId: 'e1' }]);

    const crt = s().docs[did('crt-1')];
    expect(crt?.entities.e1?.links?.[0]).toEqual({ docId: s().doc.id, entityId: boxA?.id });
  });

  it('nudges + opens nothing when no entity is selected', () => {
    s().setDocument(buildCRT('crt-1', 'e1', 'x'));
    useDocumentStore.setState({ selection: { kind: 'none' } });
    const tabsBefore = s().tabOrder.length;
    s().createCoreCloudFromSelection();
    expect(s().tabOrder.length).toBe(tabsBefore);
    expect(s().toasts.some((t) => /core problem/i.test(t.message))).toBe(true);
  });
});

describe('carryInjectionToFRT', () => {
  it('opens a linked FRT with the entity as an injection', () => {
    s().setDocument(buildCRT('crt-1', 'e1', 'Two L2 agents'));
    s().selectEntity(eid('e1'));
    s().carryInjectionToFRT();

    expect(s().doc.diagramType).toBe('frt');
    const inj = Object.values(s().doc.entities)[0];
    expect(inj?.type).toBe('injection');
    expect(inj?.links).toEqual([{ docId: 'crt-1', entityId: 'e1' }]);
    expect(s().docs[did('crt-1')]?.entities.e1?.links?.[0]).toEqual({
      docId: s().doc.id,
      entityId: inj?.id,
    });
  });
});
