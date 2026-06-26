import { beforeEach, describe, expect, it } from 'vitest';
import { validate } from '@/domain/validators';
import { makeDoc, makeEdge, makeEntity, resetIds } from '../helpers';

beforeEach(resetIds);

/** The `ec-completeness` warning messages on a given EC doc. */
const ecMessages = (
  entities: Parameters<typeof makeDoc>[0],
  edges: Parameters<typeof makeDoc>[1]
) =>
  validate(makeDoc(entities, edges, 'ec'))
    .filter((w) => w.ruleId === 'ec-completeness')
    .map((w) => w.message);

const has = (msgs: string[], substr: string) => msgs.some((m) => m.includes(substr));

/**
 * `ecCompletenessRule` (Session 77, brief §6) — five EC structural/soft checks,
 * all under the one `ec-completeness` ruleId. Slot entities are tagged via
 * `ecSlot` ('a'|'b'|'c'|'d'|'dPrime'). Each rule fires independently, so these
 * assert on message content rather than total count.
 */
describe('CLR: ec-completeness', () => {
  it('Rule 1 — fires on an empty Objective (A)', () => {
    const a = makeEntity({ ecSlot: 'a', title: '   ' });
    const inj = makeEntity({ type: 'injection', title: 'Inj' }); // suppress Rule 5 noise
    expect(has(ecMessages([a, inj], []), 'Objective (A) is empty')).toBe(true);
  });

  it('Rule 1 — does NOT fire when A has a title', () => {
    const a = makeEntity({ ecSlot: 'a', title: 'Run a healthy business' });
    const inj = makeEntity({ type: 'injection', title: 'Inj' });
    expect(has(ecMessages([a, inj], []), 'Objective (A) is empty')).toBe(false);
  });

  it('Rule 1 — does NOT fire on an empty-but-unspecified A slot', () => {
    const a = makeEntity({ ecSlot: 'a', title: '', unspecified: true });
    const inj = makeEntity({ type: 'injection', title: 'Inj' });
    expect(has(ecMessages([a, inj], []), 'Objective (A) is empty')).toBe(false);
  });

  it('Rule 2 — fires when a Need (B) connects to something other than A', () => {
    const a = makeEntity({ ecSlot: 'a', title: 'A' });
    const b = makeEntity({ ecSlot: 'b', title: 'B' });
    const stray = makeEntity({ title: 'Stray' });
    const inj = makeEntity({ type: 'injection', title: 'Inj' });
    // B → stray (not A) → fires; B → A would be fine.
    const msgs = ecMessages([a, b, stray, inj], [makeEdge(b.id, stray.id)]);
    expect(has(msgs, 'Need B connects to something other than A')).toBe(true);
  });

  it('Rule 2 — does NOT fire when a Need only supports A', () => {
    const a = makeEntity({ ecSlot: 'a', title: 'A' });
    const b = makeEntity({ ecSlot: 'b', title: 'B' });
    const inj = makeEntity({ type: 'injection', title: 'Inj' });
    const msgs = ecMessages([a, b, inj], [makeEdge(b.id, a.id)]);
    expect(has(msgs, 'connects to something other than A')).toBe(false);
  });

  it('Rule 3 — fires when a Want (D) feeds the wrong Need', () => {
    const a = makeEntity({ ecSlot: 'a', title: 'A' });
    const b = makeEntity({ ecSlot: 'b', title: 'B' });
    const c = makeEntity({ ecSlot: 'c', title: 'C' });
    const d = makeEntity({ ecSlot: 'd', title: 'D' });
    const inj = makeEntity({ type: 'injection', title: 'Inj' });
    // D should feed B; here it feeds C → unexpected target.
    const msgs = ecMessages([a, b, c, d, inj], [makeEdge(d.id, c.id)]);
    expect(has(msgs, 'supports an unexpected target')).toBe(true);
  });

  it('Rule 4 — fires when a canonical arrow (B → A) carries no assumption', () => {
    const a = makeEntity({ ecSlot: 'a', title: 'A' });
    const b = makeEntity({ ecSlot: 'b', title: 'B' });
    const inj = makeEntity({ type: 'injection', title: 'Inj' });
    const msgs = ecMessages([a, b, inj], [makeEdge(b.id, a.id)]);
    expect(has(msgs, 'No assumption recorded on B → A')).toBe(true);
  });

  it('Rule 5 — fires when an Objective exists but there is no injection', () => {
    const a = makeEntity({ ecSlot: 'a', title: 'A' });
    expect(has(ecMessages([a], []), 'No injection yet')).toBe(true);
  });

  it('Rule 5 — does NOT fire once an injection is present', () => {
    const a = makeEntity({ ecSlot: 'a', title: 'A' });
    const inj = makeEntity({ type: 'injection', title: 'Challenge the assumption' });
    expect(has(ecMessages([a, inj], []), 'No injection yet')).toBe(false);
  });

  it('does not run on a non-EC diagram', () => {
    const a = makeEntity({ ecSlot: 'a', title: '' });
    const warns = validate(makeDoc([a], [], 'crt')).filter((w) => w.ruleId === 'ec-completeness');
    expect(warns).toHaveLength(0);
  });
});
