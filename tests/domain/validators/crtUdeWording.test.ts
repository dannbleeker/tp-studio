import { beforeEach, describe, expect, it } from 'vitest';
import { validate } from '@/domain/validators';
import { makeDoc, makeEdge, makeEntity, resetIds } from '../helpers';

beforeEach(() => {
  resetIds();
});

const RULE = 'crt-ude-wording';

const wordingWarnings = (warnings: ReturnType<typeof validate>) =>
  warnings.filter((w) => w.ruleId === RULE);

/** Build a single-UDE CRT doc and return only crt-ude-wording warnings. */
const wordingForUde = (title: string) => {
  const ude = makeEntity({ type: 'ude', title });
  return wordingWarnings(validate(makeDoc([ude], [], 'crt')));
};

describe('crt-ude-wording: positive (absence phrasing fires)', () => {
  // Each keyword in ABSENCE_PATTERN should independently trigger the rule.
  const triggers = [
    'lack of clear ownership',
    'team lacks ownership',
    'lacking a clear process',
    'absence of clear ownership',
    'not enough staff on the floor',
    'insufficient staffing',
    'inadequate tooling',
    "we haven't documented the process",
    'we havent documented the process',
    "the team hasn't shipped",
    'the team hasnt shipped',
    "we don't have a runbook",
    'we dont have a runbook',
    "the team doesn't have a runbook",
    'the team doesnt have a runbook',
  ];

  for (const title of triggers) {
    it(`fires for "${title}"`, () => {
      expect(wordingForUde(title)).toHaveLength(1);
    });
  }

  it('fires on a leading "No " (absence signal)', () => {
    expect(wordingForUde('No documented process')).toHaveLength(1);
  });

  it('is case-insensitive (uppercase keyword still fires)', () => {
    expect(wordingForUde('LACK OF clear ownership')).toHaveLength(1);
  });

  it('matches the keyword mid-sentence, not just at the start', () => {
    expect(wordingForUde('The plant has insufficient capacity')).toHaveLength(1);
  });
});

describe('crt-ude-wording: warning shape', () => {
  it('targets the offending UDE entity with kind "entity" and the right message', () => {
    const ude = makeEntity({ type: 'ude', title: 'lack of clear ownership' });
    const warnings = wordingWarnings(validate(makeDoc([ude], [], 'crt')));
    expect(warnings).toHaveLength(1);
    const w = warnings[0]!;
    expect(w.ruleId).toBe(RULE);
    expect(w.target).toEqual({ kind: 'entity', id: ude.id });
    expect(w.message).toBe(
      'UDE "lack of clear ownership" may describe the absence of a solution rather than an observable effect — try restating it as a concrete, present-tense fact.'
    );
    // Clarity-tier rule: tier is stamped by the composer.
    expect(w.tier).toBe('clarity');
    expect(w.resolved).toBe(false);
  });

  it('embeds the exact UDE title in the message', () => {
    const warnings = wordingForUde('absence of a maintenance schedule');
    expect(warnings[0]!.message).toContain('"absence of a maintenance schedule"');
  });

  it('reflects resolvedWarnings into resolved:true', () => {
    const ude = makeEntity({ type: 'ude', title: 'lack of clear ownership' });
    const doc = makeDoc([ude], [], 'crt', {
      [`${RULE}:entity:${ude.id}`]: true,
    });
    const warnings = wordingWarnings(validate(doc));
    expect(warnings).toHaveLength(1);
    expect(warnings[0]!.resolved).toBe(true);
  });
});

describe('crt-ude-wording: one warning per offending UDE', () => {
  it('fires once per UDE and only for the absence-phrased ones', () => {
    const bad1 = makeEntity({ type: 'ude', title: 'lack of training' });
    const good = makeEntity({ type: 'ude', title: 'Defects reach the customer' });
    const bad2 = makeEntity({ type: 'ude', title: 'No escalation path' });
    const warnings = wordingWarnings(validate(makeDoc([bad1, good, bad2], [], 'crt')));
    expect(warnings).toHaveLength(2);
    const ids = warnings.map((w) => (w.target.kind === 'entity' ? w.target.id : null)).sort();
    expect(ids).toEqual([bad1.id, bad2.id].sort());
  });
});

describe('crt-ude-wording: negative (must NOT fire)', () => {
  it('does not fire on a clean observable effect', () => {
    expect(wordingForUde('Defects reach the customer')).toHaveLength(0);
  });

  it('does not fire on "missing deadlines" (legitimate effect, not solution-absence)', () => {
    // Documented as a deliberate non-match in the rule's comment.
    expect(wordingForUde('Teams keep missing deadlines')).toHaveLength(0);
  });

  it('does not match "Nobody" (word boundary guards leading-No)', () => {
    expect(wordingForUde('Nobody owns quality')).toHaveLength(0);
  });

  it('does not match "Nothing" (word boundary guards leading-No)', () => {
    expect(wordingForUde('Nothing gets shipped on time')).toHaveLength(0);
  });

  it('does not match a non-leading "no" inside the title', () => {
    // LEADING_NO is anchored at the start; "no" later in the sentence
    // must not trigger it (and "say no" isn't an absence keyword).
    expect(wordingForUde('Operators say no to overtime')).toHaveLength(0);
  });

  it('does not match the substring "lack" inside another word', () => {
    // \b boundaries mean "blacklist"/"slack" must not match "lack".
    expect(wordingForUde('Slack adoption is widespread')).toHaveLength(0);
  });

  it('does not fire on an empty title', () => {
    expect(wordingForUde('   ')).toHaveLength(0);
  });
});

describe('crt-ude-wording: scoping', () => {
  it('only scans UDE entities, not other types with absence phrasing', () => {
    const effect = makeEntity({ type: 'effect', title: 'lack of training' });
    const rootCause = makeEntity({ type: 'rootCause', title: 'No escalation path' });
    const warnings = wordingWarnings(validate(makeDoc([effect, rootCause], [], 'crt')));
    expect(warnings).toHaveLength(0);
  });

  it('does not run on a non-CRT diagram even with an absence-phrased UDE', () => {
    const ude = makeEntity({ type: 'ude', title: 'lack of clear ownership' });
    // 'frt' does not register this clarity rule.
    const warnings = wordingWarnings(validate(makeDoc([ude], [], 'frt')));
    expect(warnings).toHaveLength(0);
  });
});

describe('crt-ude-wording: leading-No boundary', () => {
  it('fires for a bare "No X" but the absence keyword path stays independent', () => {
    // Leading "No " alone (no ABSENCE_PATTERN keyword) still fires via LEADING_NO.
    const ude = makeEntity({ type: 'ude', title: 'No spare parts on hand' });
    const warnings = wordingWarnings(validate(makeDoc([ude], [], 'crt')));
    expect(warnings).toHaveLength(1);
    expect(warnings[0]!.target).toEqual({ kind: 'entity', id: ude.id });
  });

  it('allows leading whitespace before "No" (anchor tolerates \\s*)', () => {
    expect(wordingForUde('   No documented process')).toHaveLength(1);
  });

  it('makeEdge stays unused-safe: an edge between UDEs does not change the result', () => {
    const a = makeEntity({ type: 'ude', title: 'lack of training' });
    const b = makeEntity({ type: 'ude', title: 'Defects reach the customer' });
    const edge = makeEdge(a.id, b.id);
    const warnings = wordingWarnings(validate(makeDoc([a, b], [edge], 'crt')));
    expect(warnings).toHaveLength(1);
    expect(warnings[0]!.target).toEqual({ kind: 'entity', id: a.id });
  });
});
