import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildRiskRegisterCsv } from '@/services/exporters/riskRegister';
import { resetStoreForTest, useDocumentStore } from '@/store';
import { seedEntity } from '../helpers/seedDoc';

/**
 * Session 134 / spec major gap #5 — risk-register CSV export tests.
 *
 * The exporter aggregates a doc's UDEs into a register CSV. Tests
 * cover: empty doc (header only), single UDE with no trigger /
 * mitigation (the open-risk state), UDE with a trigger entity
 * upstream, UDE with an injection mitigation (mitigated status),
 * owner-attribute pickup, and the sort-by-annotation-number contract.
 */

const doc = () => useDocumentStore.getState().doc;

beforeEach(resetStoreForTest);
afterEach(resetStoreForTest);

describe('buildRiskRegisterCsv', () => {
  it('emits just the header when the doc has no UDEs', () => {
    seedEntity('not a ude', 'effect');
    const csv = buildRiskRegisterCsv(doc());
    const lines = csv.split('\n').filter((l) => l.length > 0);
    expect(lines).toHaveLength(1);
    expect(lines[0]).toBe('risk_id,risk,trigger,consequence,mitigation,evidence,owner,status');
  });

  it('emits an "open" row for a UDE with no mitigation', () => {
    const ude = seedEntity('Customer churn', 'ude');
    const csv = buildRiskRegisterCsv(doc());
    const lines = csv.split('\n').filter((l) => l.length > 0);
    expect(lines).toHaveLength(2);
    const row = lines[1]!;
    expect(row).toContain(ude.id);
    expect(row).toContain('Customer churn');
    expect(row).toContain('(no trigger drawn)');
    expect(row).toContain('(no mitigation)');
    expect(row.endsWith(',open')).toBe(true);
  });

  it('surfaces upstream entities in the trigger column', () => {
    const cause = seedEntity('Pricing change', 'effect');
    const ude = seedEntity('Customer churn', 'ude');
    useDocumentStore.getState().connect(cause.id, ude.id);
    const csv = buildRiskRegisterCsv(doc());
    expect(csv).toContain('Pricing change');
    // Status remains 'open' since the upstream isn't an injection /
    // desired effect — it's the trigger, not the mitigation.
    expect(csv).toMatch(/,open\b/);
    // ude variable used by the assertion above (silence unused-var).
    expect(ude.id.length).toBeGreaterThan(0);
  });

  it('walks backward to find an injection mitigation and flips status to "mitigated"', () => {
    const inj = seedEntity('Win-back outreach', 'injection');
    const effect = seedEntity('Outreach campaign launches', 'effect');
    const ude = seedEntity('Customer churn', 'ude');
    useDocumentStore.getState().connect(inj.id, effect.id);
    useDocumentStore.getState().connect(effect.id, ude.id);
    const csv = buildRiskRegisterCsv(doc());
    expect(csv).toContain('Win-back outreach');
    expect(csv).toMatch(/,mitigated\b/);
    expect(ude.id.length).toBeGreaterThan(0);
  });

  it("picks up the entity's owner attribute when present", () => {
    const ude = seedEntity('Customer churn', 'ude');
    useDocumentStore.getState().setEntityAttribute(ude.id, 'owner', {
      kind: 'string',
      value: 'Alice',
    });
    const csv = buildRiskRegisterCsv(doc());
    expect(csv).toContain('Alice');
  });

  it('orders rows by annotation number ascending', () => {
    const u1 = seedEntity('First UDE', 'ude');
    const u2 = seedEntity('Second UDE', 'ude');
    const u3 = seedEntity('Third UDE', 'ude');
    const csv = buildRiskRegisterCsv(doc());
    const i1 = csv.indexOf('First UDE');
    const i2 = csv.indexOf('Second UDE');
    const i3 = csv.indexOf('Third UDE');
    expect(i1).toBeLessThan(i2);
    expect(i2).toBeLessThan(i3);
    expect([u1.id, u2.id, u3.id].every((id) => id.length > 0)).toBe(true);
  });

  it('escapes cells containing commas / quotes per RFC 4180', () => {
    const ude = seedEntity('Drop, then plateau', 'ude');
    useDocumentStore
      .getState()
      .updateEntity(ude.id, { description: 'Includes a "scare quote" and a comma, mid-line.' });
    const csv = buildRiskRegisterCsv(doc());
    // Comma-containing title gets quoted.
    expect(csv).toContain('"Drop, then plateau"');
    // Embedded double-quote gets doubled.
    expect(csv).toContain('""scare quote""');
  });
});
