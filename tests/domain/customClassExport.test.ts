import { beforeEach, describe, expect, it } from 'vitest';
import { exportToFlyingLogic } from '@/domain/flyingLogic';
import { exportToOpml } from '@/domain/opmlExport';
import type { EntityType } from '@/domain/types';
import { exportToVgl } from '@/domain/vglExport';
import { resetStoreForTest, useDocumentStore } from '@/store';
import { seedEntity } from '../helpers/seedDoc';

/**
 * Bug-hunt cluster A (Session 205) — text exporters used to read the built-in-only
 * `ENTITY_TYPE_META[e.type]`, which is `undefined` for a user-defined custom entity
 * class → `Cannot read properties of undefined (reading 'label')`, aborting the
 * export with no file. They now resolve through `resolveEntityTypeMeta`, which falls
 * back to the custom class's label (and to a graceful placeholder for an unknown
 * type). These regression tests export a doc containing a custom-class entity.
 */

beforeEach(resetStoreForTest);
const s = () => useDocumentStore.getState();

const seedCustomEntity = () => {
  s().upsertCustomEntityClass({ id: 'site-risk', label: 'Site Risk' });
  return seedEntity('Ground is unstable', 'site-risk' as EntityType);
};

describe('exporters resolve custom entity classes without crashing', () => {
  it('VGL export emits the custom class label', () => {
    seedCustomEntity();
    expect(() => exportToVgl(s().doc)).not.toThrow();
    expect(exportToVgl(s().doc)).toContain('class:"Site Risk"');
  });

  it('OPML export emits the custom class label', () => {
    seedCustomEntity();
    expect(() => exportToOpml(s().doc)).not.toThrow();
    expect(exportToOpml(s().doc)).toContain('_type="Site Risk"');
  });

  it('Flying Logic export emits the custom class label (symbols + vertex)', () => {
    seedCustomEntity();
    expect(() => exportToFlyingLogic(s().doc)).not.toThrow();
    const xml = exportToFlyingLogic(s().doc);
    expect(xml).toContain('<entityClass name="Site Risk"/>');
    expect(xml).toContain('entityClass="Site Risk"');
  });
});
