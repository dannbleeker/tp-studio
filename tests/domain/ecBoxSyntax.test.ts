import { beforeEach, describe, expect, it } from 'vitest';
import { ecBoxCausalWordsRule, validate } from '@/domain/validators';
import { makeDoc, makeEntity, resetIds } from './helpers';

beforeEach(() => {
  resetIds();
});

const hasRule = (warnings: ReturnType<typeof validate>, id: string) =>
  warnings.some((w) => w.ruleId === id);

describe('CLR: EC box-syntax (causal-word) rule', () => {
  it('fires on an EC box whose title reads as a cause-and-effect sentence', () => {
    const b = makeEntity({ type: 'need', title: 'Protect margin because costs rose', ecSlot: 'b' });
    const doc = makeDoc([b], [], 'ec');
    const out = ecBoxCausalWordsRule(doc);
    expect(out.length).toBe(1);
    expect(out[0]?.target).toEqual({ kind: 'entity', id: b.id });
  });

  it('catches each of Cohen’s causal connectors', () => {
    const words = [
      'Ship if the roadmap allows',
      'Grow because demand is high',
      'Cut scope, therefore we hit the date',
      'Hire in order to scale',
      'Say yes, sure to please them',
    ];
    for (const [i, title] of words.entries()) {
      resetIds();
      const e = makeEntity({ type: 'want', title, ecSlot: 'd' });
      const doc = makeDoc([e], [], 'ec');
      expect(ecBoxCausalWordsRule(doc).length, `case ${i}: "${title}"`).toBe(1);
    }
  });

  it('stays silent on a clean statement box', () => {
    const a = makeEntity({ type: 'goal', title: 'Run a healthy business', ecSlot: 'a' });
    const b = makeEntity({ type: 'need', title: 'Protect margin', ecSlot: 'b' });
    const doc = makeDoc([a, b], [], 'ec');
    expect(ecBoxCausalWordsRule(doc)).toEqual([]);
  });

  it('ignores entities that are not EC slot boxes even if they contain causal words', () => {
    const loose = makeEntity({ type: 'effect', title: 'Sales fall because prices rose' });
    const doc = makeDoc([loose], [], 'ec');
    expect(ecBoxCausalWordsRule(doc)).toEqual([]);
  });

  it('matches whole words only — "gift" does not trigger on "if"', () => {
    const e = makeEntity({ type: 'want', title: 'Send a gift', ecSlot: 'd' });
    const doc = makeDoc([e], [], 'ec');
    expect(ecBoxCausalWordsRule(doc)).toEqual([]);
  });

  it('registers on EC diagrams via validate(); CRT stays silent', () => {
    const b = makeEntity({ type: 'need', title: 'Win because it matters', ecSlot: 'b' });
    const ec = makeDoc([b], [], 'ec');
    expect(hasRule(validate(ec), 'ec-box-causal-words')).toBe(true);
    const crt = makeDoc([b], [], 'crt');
    expect(hasRule(validate(crt), 'ec-box-causal-words')).toBe(false);
  });
});
