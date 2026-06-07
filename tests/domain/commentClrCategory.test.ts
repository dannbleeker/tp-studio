import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { exportToJSON, importFromJSON } from '@/domain/persistence';
import { resetStoreForTest, useDocumentStore } from '@/store';
import { seedEntity } from '../helpers/seedDoc';

/**
 * Session 179 (Theme C) — CLR-labelled review comments. A comment can carry an
 * optional CLR category, turning it into a named "legitimate reservation".
 */
const s = () => useDocumentStore.getState();

beforeEach(resetStoreForTest);
afterEach(resetStoreForTest);

describe('comment.clrCategory', () => {
  it('addComment stores the CLR category when provided', () => {
    const e = seedEntity('UDE', 'ude');
    const c = s().addComment(
      { kind: 'entity', entityId: e.id },
      'This reads as correlation, not cause',
      'causality-existence'
    );
    expect(c?.clrCategory).toBe('causality-existence');
  });

  it('addComment omits clrCategory when not provided', () => {
    const e = seedEntity('UDE', 'ude');
    const c = s().addComment({ kind: 'entity', entityId: e.id }, 'plain comment');
    expect(c?.clrCategory).toBeUndefined();
  });

  it('round-trips clrCategory through export/import', () => {
    const e = seedEntity('UDE', 'ude');
    const c = s().addComment({ kind: 'entity', entityId: e.id }, 'reservation', 'clarity');
    const restored = importFromJSON(exportToJSON(s().doc));
    expect(restored.comments?.[c?.id ?? '']?.clrCategory).toBe('clarity');
  });

  it('rejects an invalid clrCategory on import', () => {
    const e = seedEntity('UDE', 'ude');
    const c = s().addComment({ kind: 'entity', entityId: e.id }, 'reservation', 'clarity');
    const parsed = JSON.parse(exportToJSON(s().doc));
    parsed.comments[c?.id ?? ''].clrCategory = 'not-a-category';
    expect(() => importFromJSON(JSON.stringify(parsed))).toThrow(/clrCategory/);
  });
});
