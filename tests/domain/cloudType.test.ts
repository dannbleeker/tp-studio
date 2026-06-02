import { describe, expect, it } from 'vitest';
import { CLOUD_TYPE_LABEL, CLOUD_TYPES, isCloudType } from '@/domain/cloudType';
import { buildPatternCloudCore } from '@/domain/patterns/cloud-core';
import { buildPatternCloudFirefighting } from '@/domain/patterns/cloud-firefighting';
import { buildPatternCloudUDE } from '@/domain/patterns/cloud-ude';
import { exportToJSON, importFromJSON } from '@/domain/persistence';

describe('cloudType — guard + labels', () => {
  it('isCloudType accepts the six cloud types and rejects everything else', () => {
    for (const ct of CLOUD_TYPES) expect(isCloudType(ct)).toBe(true);
    for (const bad of ['', 'CORE', 'nimbus', null, undefined, 5, {}]) {
      expect(isCloudType(bad)).toBe(false);
    }
  });

  it('has a human label for every cloud type (and exactly six)', () => {
    expect(CLOUD_TYPES).toHaveLength(6);
    for (const ct of CLOUD_TYPES) expect(CLOUD_TYPE_LABEL[ct]).toBeTruthy();
  });
});

describe('cloud-type library patterns', () => {
  it('build EC docs pre-tagged with their cloud type', () => {
    expect(buildPatternCloudUDE().cloudType).toBe('ude');
    expect(buildPatternCloudCore().cloudType).toBe('core');
    expect(buildPatternCloudFirefighting().cloudType).toBe('firefighting');
  });

  it('are valid 5-box clouds (goal + 2 needs + 2 wants, with the D↔D′ mutex)', () => {
    const doc = buildPatternCloudCore();
    expect(doc.diagramType).toBe('ec');
    expect(Object.keys(doc.entities)).toHaveLength(5);
    expect(Object.values(doc.edges).some((e) => e.isMutualExclusion)).toBe(true);
  });
});

describe('cloudType — persistence round-trip', () => {
  it('survives export → import', () => {
    const restored = importFromJSON(exportToJSON(buildPatternCloudCore()));
    expect(restored.cloudType).toBe('core');
  });

  it('is absent for an untyped EC doc', () => {
    const { cloudType: _drop, ...untyped } = buildPatternCloudCore();
    const restored = importFromJSON(
      exportToJSON(untyped as ReturnType<typeof buildPatternCloudCore>)
    );
    expect(restored.cloudType).toBeUndefined();
  });

  it('drops an unrecognized cloudType on import (soft validation)', () => {
    const json = JSON.parse(exportToJSON(buildPatternCloudCore()));
    json.cloudType = 'nimbus'; // not one of the six
    const restored = importFromJSON(JSON.stringify(json));
    expect(restored.cloudType).toBeUndefined();
  });
});
