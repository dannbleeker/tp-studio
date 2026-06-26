import { beforeEach, describe, expect, it } from 'vitest';
import { validate } from '@/domain/validators';
import { makeDoc, makeEdge, makeEntity, resetIds } from '../helpers';

const RULE_ID = 'external-root-cause';

const ofRule = (warnings: ReturnType<typeof validate>) =>
  warnings.filter((w) => w.ruleId === RULE_ID);

beforeEach(() => {
  resetIds();
});

describe('CLR: external-root-cause', () => {
  it('fires on a rootCause flagged spanOfControl=external', () => {
    const rc = makeEntity({ type: 'rootCause', spanOfControl: 'external' });
    const warnings = validate(makeDoc([rc], [], 'crt'));
    const hits = ofRule(warnings);

    expect(hits.length).toBe(1);
    const w = hits[0]!;
    expect(w.target.kind).toBe('entity');
    expect(w.target).toMatchObject({ kind: 'entity', id: rc.id });
    expect(w.tier).toBe('clarity');
    // Distinctive substrings of the exact message text.
    expect(w.message).toContain('Root cause flagged as external');
    expect(w.message).toContain('Keep digging toward something you control or influence');
    // No action is attached by this rule.
    expect(w.action).toBeUndefined();
  });

  it('marks the warning resolved when the user has dismissed it', () => {
    const rc = makeEntity({ type: 'rootCause', spanOfControl: 'external' });
    const warningId = `${RULE_ID}:entity:${rc.id}`;
    const doc = makeDoc([rc], [], 'crt', { [warningId]: true });
    const hits = ofRule(validate(doc));

    expect(hits.length).toBe(1);
    expect(hits[0]!.resolved).toBe(true);
  });

  it('is unresolved by default', () => {
    const rc = makeEntity({ type: 'rootCause', spanOfControl: 'external' });
    const hits = ofRule(validate(makeDoc([rc], [], 'crt')));
    expect(hits[0]!.resolved).toBe(false);
  });

  it('emits one warning per external rootCause', () => {
    const a = makeEntity({ type: 'rootCause', spanOfControl: 'external' });
    const b = makeEntity({ type: 'rootCause', spanOfControl: 'external' });
    const hits = ofRule(validate(makeDoc([a, b], [], 'crt')));

    expect(hits.length).toBe(2);
    expect(new Set(hits.map((w) => (w.target.kind === 'entity' ? w.target.id : '')))).toEqual(
      new Set([a.id, b.id])
    );
  });

  it('does NOT fire when the rootCause is spanOfControl=control', () => {
    const rc = makeEntity({ type: 'rootCause', spanOfControl: 'control' });
    expect(ofRule(validate(makeDoc([rc], [], 'crt'))).length).toBe(0);
  });

  it('does NOT fire when the rootCause is spanOfControl=influence', () => {
    const rc = makeEntity({ type: 'rootCause', spanOfControl: 'influence' });
    expect(ofRule(validate(makeDoc([rc], [], 'crt'))).length).toBe(0);
  });

  it('does NOT fire when spanOfControl is unset on a rootCause', () => {
    const rc = makeEntity({ type: 'rootCause' });
    expect(rc.spanOfControl).toBeUndefined();
    expect(ofRule(validate(makeDoc([rc], [], 'crt'))).length).toBe(0);
  });

  it('does NOT fire on a non-rootCause entity that is external', () => {
    // Being external is sometimes the point for other types — only
    // rootCause is policed.
    const ude = makeEntity({ type: 'ude', spanOfControl: 'external' });
    const effect = makeEntity({ type: 'effect', spanOfControl: 'external' });
    const injection = makeEntity({ type: 'injection', spanOfControl: 'external' });
    const hits = ofRule(validate(makeDoc([ude, effect, injection], [], 'crt')));
    expect(hits.length).toBe(0);
  });

  it('only counts the external rootCause among a mix of entities', () => {
    const external = makeEntity({ type: 'rootCause', spanOfControl: 'external' });
    const controlled = makeEntity({ type: 'rootCause', spanOfControl: 'control' });
    const externalEffect = makeEntity({ type: 'effect', spanOfControl: 'external' });
    const ude = makeEntity({ type: 'ude' });
    const edge = makeEdge(external.id, ude.id);

    const hits = ofRule(
      validate(makeDoc([external, controlled, externalEffect, ude], [edge], 'crt'))
    );

    expect(hits.length).toBe(1);
    expect(hits[0]!.target).toMatchObject({ kind: 'entity', id: external.id });
  });

  it('does NOT fire on a non-crt diagram even with an external rootCause', () => {
    // The rule is only registered for crt; an external rootCause in an
    // frt doc must not produce the warning.
    const rc = makeEntity({ type: 'rootCause', spanOfControl: 'external' });
    expect(ofRule(validate(makeDoc([rc], [], 'frt'))).length).toBe(0);
  });
});
