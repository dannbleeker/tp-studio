import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { exportToJSON, importFromJSON } from '@/domain/persistence';
import { resetStoreForTest, useDocumentStore } from '@/store';
import { seedEntity } from '../helpers/seedDoc';

/**
 * Session 179 (Theme D2) — optional per-entity icon override. Covers the
 * persistence shape (set / clear / round-trip) and the emit-or-omit + strict
 * validation contract on import.
 */
const s = () => useDocumentStore.getState();

beforeEach(resetStoreForTest);
afterEach(resetStoreForTest);

describe('entity.icon — first-class optional field', () => {
  it('updateEntity persists icon when set and clears it when undefined', () => {
    const e = seedEntity('Root cause', 'rootCause');
    s().updateEntity(e.id, { icon: 'Star' });
    expect(s().doc.entities[e.id]?.icon).toBe('Star');
    s().updateEntity(e.id, { icon: undefined });
    expect(s().doc.entities[e.id]?.icon).toBeUndefined();
  });

  it('round-trips icon through export/import', () => {
    const e = seedEntity('Root cause', 'rootCause');
    s().updateEntity(e.id, { icon: 'Rocket' });
    const restored = importFromJSON(exportToJSON(s().doc));
    expect(restored.entities[e.id]?.icon).toBe('Rocket');
  });

  it('drops an empty-string icon on import', () => {
    const e = seedEntity('Root cause', 'rootCause');
    const parsed = JSON.parse(exportToJSON(s().doc));
    parsed.entities[e.id].icon = '';
    const restored = importFromJSON(JSON.stringify(parsed));
    expect(restored.entities[e.id]?.icon).toBeUndefined();
  });

  it('rejects a non-string icon on import', () => {
    const e = seedEntity('Root cause', 'rootCause');
    const parsed = JSON.parse(exportToJSON(s().doc));
    parsed.entities[e.id].icon = 123;
    expect(() => importFromJSON(JSON.stringify(parsed))).toThrow(/icon/);
  });
});
