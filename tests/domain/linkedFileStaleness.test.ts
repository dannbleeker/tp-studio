import { describe, expect, it } from 'vitest';
import { isDirtySinceSave } from '@/domain/linkedFileStaleness';

/** Session 193 — the pure predicate behind the linked-file "unsaved" chip. */
describe('isDirtySinceSave', () => {
  it('is dirty when the doc was edited after the last save', () => {
    expect(isDirtySinceSave(200, 100)).toBe(true);
  });

  it('is clean when the doc has not changed since the last save', () => {
    expect(isDirtySinceSave(100, 100)).toBe(false);
    expect(isDirtySinceSave(50, 100)).toBe(false);
  });

  it('treats a missing savedAt (pre-upgrade link) as never-saved', () => {
    expect(isDirtySinceSave(1, undefined)).toBe(true);
    // updatedAt 0 vs savedAt 0 → not strictly greater → clean.
    expect(isDirtySinceSave(0, undefined)).toBe(false);
  });
});
