import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { exportToJSON, importFromJSON } from '@/domain/persistence';
import type { EvidenceItem } from '@/domain/types';
// exportToJSON is used by the round-trip tests below.
import { buildRiskRegisterCsv } from '@/services/exporters/riskRegister';
import { resetStoreForTest, useDocumentStore } from '@/store';
import { seedEntity } from '../helpers/seedDoc';

/**
 * Session 134 / spec major gap #6 (structured half) — `evidence[]` array.
 *
 * Tests cover:
 *   1. Store actions (add / update / remove) including default seeds and
 *      no-op detection.
 *   2. Persistence round-trip — `evidence[]` survives JSON export +
 *      re-import unchanged (and pairs with the owner / lastValidatedAt
 *      round-trip fix that was missing from the earlier owner-field
 *      ship).
 *   3. Risk-register CSV — the new `evidence` column renders the
 *      `[strength/source] description (url)` shape correctly.
 *   4. Edge cases — clearing optional fields, empty-array collapse,
 *      missing-entity bail.
 */

const s = () => useDocumentStore.getState();
const ent = (id: string) => s().doc.entities[id];

beforeEach(resetStoreForTest);
afterEach(resetStoreForTest);

describe('entity.evidence — store actions', () => {
  it('addEvidence appends an item with default source + strength', () => {
    const e = seedEntity('Customer churn', 'ude');
    const id = s().addEvidence(e.id);
    expect(id).not.toBeNull();
    const list = ent(e.id)?.evidence;
    expect(list).toHaveLength(1);
    expect(list?.[0]?.source).toBe('observed');
    expect(list?.[0]?.strength).toBe('moderate');
    expect(list?.[0]?.description).toBe('');
    expect(list?.[0]?.id).toBe(id);
  });

  it('addEvidence accepts a partial seed object', () => {
    const e = seedEntity('Effect');
    const id = s().addEvidence(e.id, {
      description: 'p95 = 740ms',
      source: 'metric',
      strength: 'strong',
      url: 'https://example.com/dashboard',
    });
    const item = ent(e.id)?.evidence?.[0];
    expect(item?.id).toBe(id);
    expect(item?.description).toBe('p95 = 740ms');
    expect(item?.source).toBe('metric');
    expect(item?.strength).toBe('strong');
    expect(item?.url).toBe('https://example.com/dashboard');
  });

  it('addEvidence returns null when the entity is missing', () => {
    expect(s().addEvidence('nonexistent-id')).toBeNull();
  });

  it('updateEvidence patches a single field', () => {
    const e = seedEntity('Effect');
    const id = s().addEvidence(e.id)!;
    s().updateEvidence(e.id, id, { description: 'I saw the queue grow' });
    expect(ent(e.id)?.evidence?.[0]?.description).toBe('I saw the queue grow');
    expect(ent(e.id)?.evidence?.[0]?.source).toBe('observed'); // unchanged
  });

  it('updateEvidence cycles source + strength independently', () => {
    const e = seedEntity('Effect');
    const id = s().addEvidence(e.id)!;
    s().updateEvidence(e.id, id, { source: 'policy', strength: 'strong' });
    const item = ent(e.id)?.evidence?.[0];
    expect(item?.source).toBe('policy');
    expect(item?.strength).toBe('strong');
  });

  it('updateEvidence clears an optional field when passed undefined', () => {
    const e = seedEntity('Effect');
    const id = s().addEvidence(e.id, { url: 'https://example.com' })!;
    expect(ent(e.id)?.evidence?.[0]?.url).toBe('https://example.com');
    s().updateEvidence(e.id, id, { url: undefined });
    expect(ent(e.id)?.evidence?.[0]?.url).toBeUndefined();
  });

  it('updateEvidence stamps validatedAt + validatedBy', () => {
    const e = seedEntity('Effect');
    const id = s().addEvidence(e.id)!;
    const t = Date.now();
    s().updateEvidence(e.id, id, { validatedAt: t, validatedBy: 'Alice' });
    expect(ent(e.id)?.evidence?.[0]?.validatedAt).toBe(t);
    expect(ent(e.id)?.evidence?.[0]?.validatedBy).toBe('Alice');
  });

  it('updateEvidence is a no-op when every patched field matches', () => {
    const e = seedEntity('Effect');
    const id = s().addEvidence(e.id, { description: 'same' })!;
    const before = ent(e.id);
    s().updateEvidence(e.id, id, { description: 'same' });
    // No-op: entity reference should stay the same (no updatedAt bump).
    expect(ent(e.id)).toBe(before);
  });

  it('updateEvidence bails when the entity does not exist', () => {
    // No throw — exit cleanly via the bail-out path.
    expect(() => s().updateEvidence('missing-entity', 'x', { description: 'y' })).not.toThrow();
  });

  it('updateEvidence bails when the evidence id is not in the list', () => {
    const e = seedEntity('Effect');
    s().addEvidence(e.id);
    const before = ent(e.id);
    s().updateEvidence(e.id, 'missing-evidence-id', { description: 'x' });
    expect(ent(e.id)).toBe(before);
  });

  it('removeEvidence drops one item by id', () => {
    const e = seedEntity('Effect');
    const id1 = s().addEvidence(e.id, { description: 'first' })!;
    const id2 = s().addEvidence(e.id, { description: 'second' })!;
    s().removeEvidence(e.id, id1);
    const list = ent(e.id)?.evidence;
    expect(list).toHaveLength(1);
    expect(list?.[0]?.id).toBe(id2);
  });

  it('removeEvidence omits the field entirely when the last item is removed', () => {
    const e = seedEntity('Effect');
    const id = s().addEvidence(e.id)!;
    s().removeEvidence(e.id, id);
    // Field omitted — not `[]`. Matches the rest of the optional-array
    // fields' "omit when empty" convention.
    expect(ent(e.id)?.evidence).toBeUndefined();
  });
});

describe('entity.evidence — JSON round-trip', () => {
  it('persists evidence items across export + import', () => {
    const e = seedEntity('Customer churn', 'ude');
    s().addEvidence(e.id, {
      description: 'p95 = 740ms last week',
      source: 'metric',
      strength: 'strong',
      url: 'https://example.com/dashboard',
    });
    s().updateEvidence(e.id, ent(e.id)!.evidence![0]!.id, {
      validatedAt: 1700000000000,
      validatedBy: 'Alice',
    });

    const json = exportToJSON(s().doc);
    const reimported = importFromJSON(json);
    const item: EvidenceItem | undefined = reimported.entities[e.id]?.evidence?.[0];
    expect(item).toBeDefined();
    expect(item?.description).toBe('p95 = 740ms last week');
    expect(item?.source).toBe('metric');
    expect(item?.strength).toBe('strong');
    expect(item?.url).toBe('https://example.com/dashboard');
    expect(item?.validatedAt).toBe(1700000000000);
    expect(item?.validatedBy).toBe('Alice');
  });

  it('persists entity.owner + lastValidatedAt across export + import', () => {
    // Regression: round-trip was previously broken — the validator
    // dropped both fields silently. This guards the fix.
    const e = seedEntity('Customer churn', 'ude');
    s().updateEntity(e.id, { owner: 'Alice', lastValidatedAt: 1700000000000 });
    const json = exportToJSON(s().doc);
    const reimported = importFromJSON(json);
    expect(reimported.entities[e.id]?.owner).toBe('Alice');
    expect(reimported.entities[e.id]?.lastValidatedAt).toBe(1700000000000);
  });

  it('rejects an evidence item with an unknown source', () => {
    // Construct a minimal doc with a malformed evidence row. We use
    // `JSON.stringify` directly rather than reusing `exportToJSON(s().doc)`
    // because the test only needs the persistence path's strict
    // validators to fire on the bad row.
    const malformed = JSON.stringify({
      schemaVersion: 8,
      id: 'doc-test',
      diagramType: 'crt',
      title: 'malformed',
      nextAnnotationNumber: 2,
      groups: {},
      resolvedWarnings: {},
      createdAt: 1,
      updatedAt: 1,
      entities: {
        e1: {
          id: 'e1',
          type: 'ude',
          title: 'risk',
          annotationNumber: 1,
          createdAt: 1,
          updatedAt: 1,
          evidence: [
            {
              id: 'ev1',
              description: 'x',
              source: 'rumor', // invalid
              strength: 'moderate',
              createdAt: 1,
              updatedAt: 1,
            },
          ],
        },
      },
      edges: {},
    });
    expect(() => importFromJSON(malformed)).toThrow(/invalid source/);
  });
});

describe('entity.evidence — risk register column', () => {
  it('formats one evidence item as [strength/source] description (url)', () => {
    const ude = seedEntity('Customer churn', 'ude');
    s().addEvidence(ude.id, {
      description: 'p95 = 740ms',
      source: 'metric',
      strength: 'strong',
      url: 'https://example.com/dash',
    });
    const csv = buildRiskRegisterCsv(s().doc);
    expect(csv).toContain('[strong/metric] p95 = 740ms (https://example.com/dash)');
  });

  it('joins multiple evidence items with semicolons', () => {
    const ude = seedEntity('Customer churn', 'ude');
    s().addEvidence(ude.id, { description: 'first', source: 'observed', strength: 'weak' });
    s().addEvidence(ude.id, { description: 'second', source: 'policy', strength: 'moderate' });
    const csv = buildRiskRegisterCsv(s().doc);
    expect(csv).toContain('[weak/observed] first; [moderate/policy] second');
  });

  it('leaves the evidence cell blank when the UDE has no evidence', () => {
    seedEntity('Customer churn', 'ude');
    const csv = buildRiskRegisterCsv(s().doc);
    const lines = csv.split('\n').filter((l) => l.length > 0);
    // 8-column row with evidence between mitigation and owner → two
    // consecutive commas where the empty cell sits.
    expect(lines[1]).toContain('(no mitigation),,');
  });
});
