import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildRiskRegisterCsv } from '@/services/exporters/riskRegister';
import { resetStoreForTest, useDocumentStore } from '@/store';
import { seedEntity } from '../helpers/seedDoc';

/**
 * Session 134 / spec major gap #6 — entity ownership field.
 *
 * Tests cover the persistence shape (set / clear / present-after-read),
 * the lastValidatedAt audit-trail field, and the risk-register
 * exporter's prefer-dedicated-field-over-legacy-attributes-fallback
 * behaviour.
 *
 * The structured `evidence[]` array half of the spec gap (#6) is
 * deferred to a follow-up — see NEXT_STEPS. This session ships only
 * the single `owner` + `lastValidatedAt` fields.
 */

const s = () => useDocumentStore.getState();

beforeEach(resetStoreForTest);
afterEach(resetStoreForTest);

describe('entity.owner — first-class field', () => {
  it('updateEntity persists owner when set', () => {
    const e = seedEntity('Customer churn', 'ude');
    useDocumentStore.getState().updateEntity(e.id, { owner: 'Alice' });
    expect(s().doc.entities[e.id]?.owner).toBe('Alice');
  });

  it('updateEntity clears owner when set to undefined', () => {
    const e = seedEntity('Customer churn', 'ude');
    useDocumentStore.getState().updateEntity(e.id, { owner: 'Alice' });
    useDocumentStore.getState().updateEntity(e.id, { owner: undefined });
    expect(s().doc.entities[e.id]?.owner).toBeUndefined();
  });
});

describe('entity.lastValidatedAt — audit trail', () => {
  it('updateEntity persists a numeric timestamp', () => {
    const e = seedEntity('Effect A');
    const t = Date.now();
    useDocumentStore.getState().updateEntity(e.id, { lastValidatedAt: t });
    expect(s().doc.entities[e.id]?.lastValidatedAt).toBe(t);
  });
});

describe('risk register — owner field plumbing', () => {
  it('reads the dedicated entity.owner field for the owner column', () => {
    const ude = seedEntity('Customer churn', 'ude');
    useDocumentStore.getState().updateEntity(ude.id, { owner: 'Alice' });
    const csv = buildRiskRegisterCsv(s().doc);
    expect(csv).toContain('Alice');
  });

  it('falls back to the legacy attributes.owner.value when the dedicated field is empty', () => {
    const ude = seedEntity('Customer churn', 'ude');
    useDocumentStore.getState().setEntityAttribute(ude.id, 'owner', {
      kind: 'string',
      value: 'Bob (legacy)',
    });
    const csv = buildRiskRegisterCsv(s().doc);
    expect(csv).toContain('Bob (legacy)');
  });

  it('prefers entity.owner over the legacy attributes.owner.value when both are set', () => {
    const ude = seedEntity('Customer churn', 'ude');
    useDocumentStore.getState().updateEntity(ude.id, { owner: 'Alice (current)' });
    useDocumentStore.getState().setEntityAttribute(ude.id, 'owner', {
      kind: 'string',
      value: 'Bob (legacy)',
    });
    const csv = buildRiskRegisterCsv(s().doc);
    expect(csv).toContain('Alice (current)');
    expect(csv).not.toContain('Bob (legacy)');
  });

  it('whitespace-only entity.owner falls through to the legacy fallback', () => {
    const ude = seedEntity('Customer churn', 'ude');
    useDocumentStore.getState().updateEntity(ude.id, { owner: '   ' });
    useDocumentStore.getState().setEntityAttribute(ude.id, 'owner', {
      kind: 'string',
      value: 'Bob (legacy)',
    });
    const csv = buildRiskRegisterCsv(s().doc);
    expect(csv).toContain('Bob (legacy)');
  });
});
