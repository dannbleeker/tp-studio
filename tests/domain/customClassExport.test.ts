import { beforeEach, describe, expect, it } from 'vitest';
import { exportToFlyingLogic } from '@/domain/flyingLogic';
import { exportToOpml } from '@/domain/opmlExport';
import { exportToJSON, importFromJSON } from '@/domain/persistence';
import { exportReasoningOutline } from '@/domain/reasoningExport';
import type { EntityType } from '@/domain/types';
import { exportToVgl } from '@/domain/vglExport';
import { exportAnnotationsMarkdown } from '@/services/exporters/annotationsExport';
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

  // Session 205 closed the three exporters above; these two kept the direct
  // `ENTITY_TYPE_META[type]` index and so still threw.
  it('annotations export emits the custom class label', () => {
    seedCustomEntity();
    expect(() => exportAnnotationsMarkdown(s().doc)).not.toThrow();
    expect(exportAnnotationsMarkdown(s().doc)).toContain('Site Risk');
  });

  it('reasoning outline emits the custom class label', () => {
    seedCustomEntity();
    expect(() => exportReasoningOutline(s().doc)).not.toThrow();
    expect(exportReasoningOutline(s().doc)).toContain('Site Risk');
  });
});

/**
 * The load side of the same hazard, and by far the worse half: `validateEntity`
 * hard-threw on any type outside the 14 built-ins, so a document that used a
 * custom class could not be read back at all. With backup rotation, the second
 * save left every storage slot unparseable and the tree disappeared from both
 * the tab strip and Start → All trees with no message.
 */
describe('a document using a custom entity class round-trips', () => {
  it('survives exportToJSON → importFromJSON with the type intact', () => {
    seedCustomEntity();
    const back = importFromJSON(exportToJSON(s().doc));
    const entity = Object.values(back.entities).find((e) => e.title === 'Ground is unstable');
    expect(entity?.type).toBe('site-risk');
    expect(back.customEntityClasses?.['site-risk']?.label).toBe('Site Risk');
  });

  it('still loads when the class definition is gone — the type is preserved verbatim', () => {
    seedCustomEntity();
    const { customEntityClasses: _dropped, ...withoutClasses } = s().doc;
    const back = importFromJSON(JSON.stringify(withoutClasses));
    const entity = Object.values(back.entities).find((e) => e.title === 'Ground is unstable');
    expect(entity?.type).toBe('site-risk');
  });
});
