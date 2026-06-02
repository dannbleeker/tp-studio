import { describe, expect, it } from 'vitest';
import { importFromJSON } from '@/domain/persistence';
import { buildCoreCloudSeed, buildInjectionFRTSeed } from '@/domain/uShape';

describe('buildCoreCloudSeed', () => {
  it('builds a 5-box EC tagged "core", titled after the problem, anchored on box A', () => {
    const { doc, anchorId } = buildCoreCloudSeed('Late deliveries');
    expect(doc.diagramType).toBe('ec');
    expect(doc.cloudType).toBe('core');
    expect(doc.title).toContain('Late deliveries');
    expect(Object.keys(doc.entities)).toHaveLength(5);
    expect(doc.entities[anchorId]?.ecSlot).toBe('a');
  });
});

describe('buildInjectionFRTSeed', () => {
  it('builds an FRT with a single injection entity as the anchor', () => {
    const { doc, anchorId } = buildInjectionFRTSeed('Two L2 agents handle the hard tickets');
    expect(doc.diagramType).toBe('frt');
    expect(doc.title).toContain('Two L2 agents');
    expect(Object.keys(doc.entities)).toHaveLength(1);
    const anchor = doc.entities[anchorId];
    expect(anchor?.type).toBe('injection');
    expect(anchor?.title).toBe('Two L2 agents handle the hard tickets');
  });
});

describe('coreProblem flag — persistence', () => {
  const docJSON = (extra: Record<string, unknown>): string =>
    JSON.stringify({
      schemaVersion: 9,
      id: 'd',
      diagramType: 'crt',
      title: 'd',
      nextAnnotationNumber: 2,
      entities: {
        e1: {
          id: 'e1',
          type: 'ude',
          title: 'x',
          annotationNumber: 1,
          createdAt: 1,
          updatedAt: 1,
          ...extra,
        },
      },
      edges: {},
      groups: {},
      resolvedWarnings: {},
      createdAt: 1,
      updatedAt: 1,
    });

  it('round-trips coreProblem=true', () => {
    expect(importFromJSON(docJSON({ coreProblem: true })).entities.e1?.coreProblem).toBe(true);
  });

  it('omits coreProblem when false or absent', () => {
    expect(
      importFromJSON(docJSON({ coreProblem: false })).entities.e1?.coreProblem
    ).toBeUndefined();
    expect(importFromJSON(docJSON({})).entities.e1?.coreProblem).toBeUndefined();
  });

  it('rejects a non-boolean coreProblem', () => {
    expect(() => importFromJSON(docJSON({ coreProblem: 'yes' }))).toThrow();
  });
});
