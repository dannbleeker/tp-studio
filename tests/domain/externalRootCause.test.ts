import { externalRootCauseRule, validate } from '@/domain/validators';
import { resetStoreForTest, useDocumentStore } from '@/store';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { seedEntity } from '../helpers/seedDoc';

beforeEach(resetStoreForTest);
afterEach(resetStoreForTest);

const doc = () => useDocumentStore.getState().doc;

describe('CLR: external-root-cause rule', () => {
  it('fires on a rootCause flagged spanOfControl=external', () => {
    const rc = seedEntity('Market crash', 'rootCause');
    useDocumentStore.getState().updateEntity(rc.id, { spanOfControl: 'external' });
    const out = externalRootCauseRule(doc());
    expect(out).toHaveLength(1);
    expect(out[0]?.target).toEqual({ kind: 'entity', id: rc.id });
  });

  it('does not fire when the rootCause is flagged control or influence', () => {
    const rc = seedEntity('Manual entry', 'rootCause');
    useDocumentStore.getState().updateEntity(rc.id, { spanOfControl: 'control' });
    expect(externalRootCauseRule(doc())).toHaveLength(0);
    useDocumentStore.getState().updateEntity(rc.id, { spanOfControl: 'influence' });
    expect(externalRootCauseRule(doc())).toHaveLength(0);
  });

  it('does not fire when the spanOfControl flag is unset', () => {
    seedEntity('Plain root cause', 'rootCause');
    expect(externalRootCauseRule(doc())).toHaveLength(0);
  });

  it('only applies to rootCause entities, not other types flagged external', () => {
    const e = seedEntity('Some effect', 'effect');
    useDocumentStore.getState().updateEntity(e.id, { spanOfControl: 'external' });
    expect(externalRootCauseRule(doc())).toHaveLength(0);
  });

  it('registers in the CRT rule set (with clarity tier)', () => {
    const rc = seedEntity('Market crash', 'rootCause');
    useDocumentStore.getState().updateEntity(rc.id, { spanOfControl: 'external' });
    const warnings = validate(doc()).filter((w) => w.ruleId === 'external-root-cause');
    expect(warnings).toHaveLength(1);
    expect(warnings[0]?.tier).toBe('clarity');
  });

  it('does not fire on FRT or other diagram types (CRT-specific)', () => {
    useDocumentStore.getState().newDocument('frt');
    const rc = seedEntity('External factor', 'rootCause');
    useDocumentStore.getState().updateEntity(rc.id, { spanOfControl: 'external' });
    const warnings = validate(doc()).filter((w) => w.ruleId === 'external-root-cause');
    expect(warnings).toHaveLength(0);
  });

  it('flag survives a JSON round-trip', async () => {
    const { exportToJSON, importFromJSON } = await import('@/domain/persistence');
    const rc = seedEntity('Market crash', 'rootCause');
    useDocumentStore.getState().updateEntity(rc.id, { spanOfControl: 'external' });
    const json = exportToJSON(doc());
    const restored = importFromJSON(json);
    expect(restored.entities[rc.id]?.spanOfControl).toBe('external');
  });
});
