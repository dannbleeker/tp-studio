import { describe, expect, it } from 'vitest';
import { v1ToV2 } from '@/domain/migrations/v1ToV2';

type EntityMap = Record<string, { annotationNumber?: number } | undefined>;

describe('v1ToV2 migration', () => {
  it('returns non-object input unchanged', () => {
    expect(v1ToV2.migrate(42)).toBe(42);
    expect(v1ToV2.migrate(null)).toBeNull();
  });

  it('treats a missing entities map as empty and stamps the version', () => {
    const out = v1ToV2.migrate({ schemaVersion: 1 }) as Record<string, unknown>;
    expect(out.entities).toEqual({});
    expect(out.nextAnnotationNumber).toBe(1);
    expect(out.schemaVersion).toBe(2);
  });

  it('numbers entities by createdAt, breaking ties on id', () => {
    const out = v1ToV2.migrate({
      schemaVersion: 1,
      entities: {
        zeta: { createdAt: 100 },
        alpha: { createdAt: 100 }, // same timestamp → alpha sorts before zeta by id
        early: { createdAt: 50 },
      },
    }) as { entities: EntityMap };
    expect(out.entities.early?.annotationNumber).toBe(1);
    expect(out.entities.alpha?.annotationNumber).toBe(2);
    expect(out.entities.zeta?.annotationNumber).toBe(3);
  });

  it('defaults a missing createdAt to 0 and skips non-object entity values', () => {
    const out = v1ToV2.migrate({
      schemaVersion: 1,
      entities: {
        noTime: { title: 'x' }, // no createdAt → treated as 0 → ordered first
        timed: { createdAt: 10 },
        junk: 'not an object', // filtered out by isPlainObject
      },
    }) as { entities: EntityMap };
    expect(out.entities.noTime?.annotationNumber).toBe(1);
    expect(out.entities.timed?.annotationNumber).toBe(2);
    expect(out.entities.junk).toBeUndefined();
  });
});
