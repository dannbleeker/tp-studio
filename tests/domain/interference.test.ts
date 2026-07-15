import { describe, expect, it } from 'vitest';
import { createEntity } from '@/domain/factory';
import { INTERFERENCE_IMPACT_KEY, interferenceImpact } from '@/domain/interference';
import { importFromJSON } from '@/domain/persistence';
import type { AttrValue, Entity } from '@/domain/types';

// Build a properly-branded obstacle entity via the factory, optionally carrying
// the reserved impact attribute (avoids hand-branding EntityId in the test).
const obstacleWith = (attr?: AttrValue): Entity => {
  const e = createEntity({
    type: 'obstacle',
    title: 'Parts are not available to work',
    annotationNumber: 1,
  });
  return attr ? { ...e, attributes: { [INTERFERENCE_IMPACT_KEY]: attr } } : e;
};

describe('interferenceImpact', () => {
  it('is undefined when no impact attribute is set', () => {
    expect(interferenceImpact(obstacleWith())).toBeUndefined();
  });

  it('reads the int value stored under the reserved key', () => {
    expect(interferenceImpact(obstacleWith({ kind: 'int', value: 75 }))).toBe(75);
  });

  it('accepts zero (a real, if unusual, magnitude) distinctly from unset', () => {
    expect(interferenceImpact(obstacleWith({ kind: 'int', value: 0 }))).toBe(0);
  });

  it('ignores a wrong-kind attribute (defensive against hand-edited JSON)', () => {
    expect(interferenceImpact(obstacleWith({ kind: 'string', value: '75' }))).toBeUndefined();
  });

  it('round-trips the impact value through import JSON', () => {
    const raw = JSON.stringify({
      schemaVersion: 10,
      id: 'id-roundtrip',
      diagramType: 'id',
      title: 'round-trip',
      nextAnnotationNumber: 3,
      createdAt: 0,
      updatedAt: 0,
      groups: {},
      resolvedWarnings: {},
      entities: {
        obj: {
          id: 'obj',
          type: 'goal',
          title: 'More throughput',
          annotationNumber: 1,
          createdAt: 0,
          updatedAt: 0,
        },
        i1: {
          id: 'i1',
          type: 'obstacle',
          title: 'Parts are not available to work',
          annotationNumber: 2,
          createdAt: 0,
          updatedAt: 0,
          attributes: { [INTERFERENCE_IMPACT_KEY]: { kind: 'int', value: 90 } },
        },
      },
      edges: {
        e1: { id: 'e1', sourceId: 'i1', targetId: 'obj', kind: 'sufficiency' },
      },
    });
    const reloaded = importFromJSON(raw);
    const reloadedObstacle = reloaded.entities.i1;
    expect(reloadedObstacle).toBeDefined();
    expect(reloadedObstacle && interferenceImpact(reloadedObstacle)).toBe(90);
  });
});
