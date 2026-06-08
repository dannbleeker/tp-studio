import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { spawnECFromConflict } from '@/domain/spawnEC';
import { resetStoreForTest, useDocumentStore } from '@/store';
import { seedEntity } from '../helpers/seedDoc';

beforeEach(resetStoreForTest);
afterEach(resetStoreForTest);

const sourceDoc = () => useDocumentStore.getState().doc;

describe('spawnECFromConflict', () => {
  it('produces an EC document with the canonical 5-box shape', () => {
    const rc = seedEntity('Root cause title', 'rootCause');
    const ec = spawnECFromConflict(sourceDoc(), rc.id);
    expect(ec.diagramType).toBe('ec');
    const entities = Object.values(ec.entities);
    expect(entities).toHaveLength(5);
    const counts: Record<string, number> = {};
    for (const e of entities) counts[e.type] = (counts[e.type] ?? 0) + 1;
    expect(counts.goal).toBe(1);
    expect(counts.need).toBe(2);
    expect(counts.want).toBe(2);
  });

  it("seeds the source entity's title into the Want 1 slot", () => {
    const rc = seedEntity('Manual order entry', 'rootCause');
    const ec = spawnECFromConflict(sourceDoc(), rc.id);
    const want1 = Object.values(ec.entities).find(
      (e) => e.type === 'want' && e.title === 'Manual order entry'
    );
    expect(want1).toBeDefined();
  });

  it('wires the four canonical EC edges (Want→Need, Need→Goal)', () => {
    const rc = seedEntity('Conflict', 'rootCause');
    const ec = spawnECFromConflict(sourceDoc(), rc.id);
    expect(Object.values(ec.edges)).toHaveLength(4);
    // Two edges into the goal, two into the needs, none into wants.
    const goal = Object.values(ec.entities).find((e) => e.type === 'goal');
    expect(goal).toBeDefined();
    const incomingToGoal = Object.values(ec.edges).filter((e) => e.targetId === goal?.id);
    expect(incomingToGoal).toHaveLength(2);
  });

  it('places each box at its canonical EC coordinate', () => {
    const rc = seedEntity('Conflict', 'rootCause');
    const ec = spawnECFromConflict(sourceDoc(), rc.id);
    const goal = Object.values(ec.entities).find((e) => e.type === 'goal');
    // Goal at left (x=100); wants at right (x=800).
    expect(goal?.position).toEqual({ x: 100, y: 250 });
    const wants = Object.values(ec.entities).filter((e) => e.type === 'want');
    for (const w of wants) {
      expect(w.position?.x).toBe(800);
    }
  });

  it('uses a sensible fallback when the source entity is missing or has no title', () => {
    // Pass a non-existent id — the function should still produce a valid EC.
    const ec = spawnECFromConflict(sourceDoc(), 'no-such-id');
    expect(ec.diagramType).toBe('ec');
    expect(Object.keys(ec.entities)).toHaveLength(5);
  });

  it('writes title that references the source entity (no quotes when source missing)', () => {
    const rc = seedEntity('My conflict', 'rootCause');
    const ecWithSource = spawnECFromConflict(sourceDoc(), rc.id);
    expect(ecWithSource.title).toContain('My conflict');
    const ecWithoutSource = spawnECFromConflict(sourceDoc(), 'no-such-id');
    expect(ecWithoutSource.title).not.toContain('"');
  });

  it('produces a TPDocument with a fresh id distinct from the source', () => {
    const rc = seedEntity('Conflict', 'rootCause');
    const ec = spawnECFromConflict(sourceDoc(), rc.id);
    expect(ec.id).not.toBe(sourceDoc().id);
  });

  it('binds the canonical ecSlot to each box (a=goal, b/c=needs, d/dPrime=wants)', () => {
    // Verbalisation, the ec-completeness rule, and the EC workshop PDF all key
    // off ecSlot — a spawned EC with no slots silently produced placeholder
    // verbal text and a permanently-skipped completeness rule.
    const rc = seedEntity('Conflict', 'rootCause');
    const ec = spawnECFromConflict(sourceDoc(), rc.id);
    const bySlot = (slot: string) => Object.values(ec.entities).find((e) => e.ecSlot === slot);
    expect(bySlot('a')?.type).toBe('goal');
    expect(bySlot('b')?.type).toBe('need');
    expect(bySlot('c')?.type).toBe('need');
    expect(bySlot('d')?.type).toBe('want');
    expect(bySlot('dPrime')?.type).toBe('want');
    // The source title lands in the 'd' (Want 1) slot, and every box has a slot.
    expect(bySlot('d')?.title).toBe('Conflict');
    expect(Object.values(ec.entities).every((e) => e.ecSlot !== undefined)).toBe(true);
  });

  it('wires necessity-typed edges (EC reads "in order to A, we must B")', () => {
    const rc = seedEntity('Conflict', 'rootCause');
    const ec = spawnECFromConflict(sourceDoc(), rc.id);
    expect(Object.values(ec.edges).every((e) => e.kind === 'necessity')).toBe(true);
  });
});
