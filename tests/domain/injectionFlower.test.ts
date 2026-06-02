import { describe, expect, it } from 'vitest';
import { createEntity } from '@/domain/factory';
import {
  buildInjectionFlower,
  CANONICAL_FLOWER_PETALS,
  FLOWER_PETAL_ORDER,
  type FlowerPetalRole,
  petalRoleForDiagram,
} from '@/domain/injectionFlower';
import { importFromJSON } from '@/domain/persistence';
import type { DiagramType, DocumentId, Entity, EntityId, TPDocument } from '@/domain/types';

const did = (id: string): DocumentId => id as unknown as DocumentId;
const eid = (id: string): EntityId => id as unknown as EntityId;

const buildDoc = (
  docId: string,
  diagramType: DiagramType,
  entityId: string,
  entityType: string,
  title: string
): TPDocument =>
  importFromJSON(
    JSON.stringify({
      schemaVersion: 9,
      id: docId,
      diagramType,
      title: `Doc ${docId}`,
      nextAnnotationNumber: 2,
      entities: {
        [entityId]: {
          id: entityId,
          type: entityType,
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

const injectionWith = (links: { docId: string; entityId: string }[]): Entity => ({
  ...createEntity({ type: 'injection', annotationNumber: 1 }),
  title: 'Run a bootcamp',
  links: links.map((l) => ({ docId: did(l.docId), entityId: eid(l.entityId) })),
});

const petalOf = (flower: ReturnType<typeof buildInjectionFlower>, role: FlowerPetalRole) =>
  flower.petals.find((p) => p.role === role);

describe('petalRoleForDiagram', () => {
  it('maps FRT / NBR / PRT to the canonical petals and everything else to related', () => {
    expect(petalRoleForDiagram('frt')).toBe('desiredEffect');
    expect(petalRoleForDiagram('nbr')).toBe('negativeBranch');
    expect(petalRoleForDiagram('prt')).toBe('plan');
    expect(petalRoleForDiagram('crt')).toBe('related');
    expect(petalRoleForDiagram('ec')).toBe('related');
    expect(petalRoleForDiagram(null)).toBe('related');
  });
});

describe('CLR flower constants', () => {
  it('orders the petals canonically with related last', () => {
    expect(FLOWER_PETAL_ORDER).toEqual(['desiredEffect', 'negativeBranch', 'plan', 'related']);
  });
  it('treats the three production/risk/plan petals as canonical', () => {
    expect(CANONICAL_FLOWER_PETALS).toEqual(['desiredEffect', 'negativeBranch', 'plan']);
  });
});

describe('buildInjectionFlower', () => {
  const docs: Record<string, TPDocument> = {
    'doc-frt': buildDoc('doc-frt', 'frt', 'de1', 'desiredEffect', 'Faster onboarding'),
    'doc-nbr': buildDoc('doc-nbr', 'nbr', 'ud1', 'ude', 'Team burns out'),
    'doc-prt': buildDoc('doc-prt', 'prt', 'io1', 'effect', 'Hire a trainer'),
    'doc-crt': buildDoc('doc-crt', 'crt', 'rc1', 'rootCause', 'Some root cause'),
  };

  it('returns four empty petals for an injection with no links', () => {
    const flower = buildInjectionFlower(injectionWith([]), docs);
    expect(flower.linkCount).toBe(0);
    expect(flower.petals).toHaveLength(4);
    expect(flower.petals.every((p) => p.links.length === 0)).toBe(true);
  });

  it('buckets each link by its target document’s diagram type', () => {
    const flower = buildInjectionFlower(
      injectionWith([
        { docId: 'doc-frt', entityId: 'de1' },
        { docId: 'doc-nbr', entityId: 'ud1' },
        { docId: 'doc-prt', entityId: 'io1' },
        { docId: 'doc-crt', entityId: 'rc1' },
      ]),
      docs
    );
    expect(flower.linkCount).toBe(4);
    expect(petalOf(flower, 'desiredEffect')?.links).toHaveLength(1);
    expect(petalOf(flower, 'negativeBranch')?.links).toHaveLength(1);
    expect(petalOf(flower, 'plan')?.links).toHaveLength(1);
    expect(petalOf(flower, 'related')?.links).toHaveLength(1);

    const de = petalOf(flower, 'desiredEffect')?.links[0];
    expect(de?.entityTitle).toBe('Faster onboarding');
    expect(de?.diagramType).toBe('frt');
    expect(de?.reachable).toBe(true);
  });

  it('keeps a link to a closed tab under related, marked unreachable', () => {
    const flower = buildInjectionFlower(
      injectionWith([{ docId: 'doc-closed', entityId: 'x1' }]),
      docs
    );
    const related = petalOf(flower, 'related')?.links ?? [];
    expect(related).toHaveLength(1);
    expect(related[0]).toMatchObject({
      reachable: false,
      entityTitle: null,
      docTitle: null,
      diagramType: null,
    });
  });
});
