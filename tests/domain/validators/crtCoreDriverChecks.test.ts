import { beforeEach, describe, expect, it } from 'vitest';
import { validate } from '@/domain/validators';
import { makeDoc, makeEdge, makeEntity, resetIds } from '../helpers';

/**
 * Tests for the two CRT Core Driver nudges in
 * `src/domain/validators/crtCoreDriverChecks.ts`:
 *   - `crt-low-core-driver-coverage` — fires when the top root cause reaches
 *     fewer than half of ≥3 UDEs.
 *   - `crt-tied-core-drivers` — fires when the top two root causes reach an
 *     equal number of UDEs (≥2 each).
 *
 * Both reuse `findCoreDrivers`, whose candidate pool is the explicit
 * `rootCause`-typed entities when any exist. Every scenario below seeds
 * explicit root causes so the candidate set (and its forward UDE reach) is
 * fully deterministic.
 */

const LOW_COVERAGE = 'crt-low-core-driver-coverage';
const TIED = 'crt-tied-core-drivers';

type Warnings = ReturnType<typeof validate>;
const ofRule = (warnings: Warnings, ruleId: string): Warnings =>
  warnings.filter((w) => w.ruleId === ruleId);

beforeEach(() => {
  resetIds();
});

describe('crt-low-core-driver-coverage', () => {
  it('fires when the leading root cause reaches a minority of UDEs', () => {
    // rc reaches only ude1; ude2/ude3/ude4 are unconnected → 1 of 4 = 25%.
    const rc = makeEntity({ type: 'rootCause', title: 'Root cause' });
    const ude1 = makeEntity({ type: 'ude', title: 'UDE one' });
    const ude2 = makeEntity({ type: 'ude', title: 'UDE two' });
    const ude3 = makeEntity({ type: 'ude', title: 'UDE three' });
    const ude4 = makeEntity({ type: 'ude', title: 'UDE four' });
    const warnings = ofRule(
      validate(makeDoc([rc, ude1, ude2, ude3, ude4], [makeEdge(rc.id, ude1.id)], 'crt')),
      LOW_COVERAGE
    );

    expect(warnings).toHaveLength(1);
    const w = warnings[0]!;
    expect(w.target).toEqual({ kind: 'entity', id: rc.id });
    expect(w.tier).toBe('clarity');
    // Exact counts + percentage in the message.
    expect(w.message).toContain('explains only 1 of 4 UDEs (25%)');
    expect(w.message).toContain('two independent clusters');
    // This nudge carries no one-click action.
    expect(w.action).toBeUndefined();
  });

  it('does NOT fire when coverage is exactly at the 50% threshold (boundary)', () => {
    // rc reaches ude1+ude2 of 4 UDEs = 50%, which is >= COVERAGE_THRESHOLD.
    const rc = makeEntity({ type: 'rootCause', title: 'Root cause' });
    const ude1 = makeEntity({ type: 'ude', title: 'UDE one' });
    const ude2 = makeEntity({ type: 'ude', title: 'UDE two' });
    const ude3 = makeEntity({ type: 'ude', title: 'UDE three' });
    const ude4 = makeEntity({ type: 'ude', title: 'UDE four' });
    const warnings = ofRule(
      validate(
        makeDoc(
          [rc, ude1, ude2, ude3, ude4],
          [makeEdge(rc.id, ude1.id), makeEdge(rc.id, ude2.id)],
          'crt'
        )
      ),
      LOW_COVERAGE
    );

    expect(warnings).toHaveLength(0);
  });

  it('fires just below the threshold with the minimum 3 UDEs', () => {
    // rc reaches ude1 of 3 = 33% (< 50%); MIN_UDES_FOR_COVERAGE is exactly 3.
    const rc = makeEntity({ type: 'rootCause', title: 'Root cause' });
    const ude1 = makeEntity({ type: 'ude', title: 'UDE one' });
    const ude2 = makeEntity({ type: 'ude', title: 'UDE two' });
    const ude3 = makeEntity({ type: 'ude', title: 'UDE three' });
    const warnings = ofRule(
      validate(makeDoc([rc, ude1, ude2, ude3], [makeEdge(rc.id, ude1.id)], 'crt')),
      LOW_COVERAGE
    );

    expect(warnings).toHaveLength(1);
    expect(warnings[0]!.message).toContain('explains only 1 of 3 UDEs (33%)');
  });

  it('does NOT fire with only 2 UDEs (just below the MIN_UDES gate)', () => {
    // Same shape that WOULD be low coverage, but 2 UDEs (< 3) suppresses it.
    const rc = makeEntity({ type: 'rootCause', title: 'Root cause' });
    const ude1 = makeEntity({ type: 'ude', title: 'UDE one' });
    const ude2 = makeEntity({ type: 'ude', title: 'UDE two' });
    const warnings = ofRule(
      validate(makeDoc([rc, ude1, ude2], [makeEdge(rc.id, ude1.id)], 'crt')),
      LOW_COVERAGE
    );

    expect(warnings).toHaveLength(0);
  });

  it('does NOT fire when the leading root cause reaches every UDE', () => {
    const rc = makeEntity({ type: 'rootCause', title: 'Root cause' });
    const ude1 = makeEntity({ type: 'ude', title: 'UDE one' });
    const ude2 = makeEntity({ type: 'ude', title: 'UDE two' });
    const ude3 = makeEntity({ type: 'ude', title: 'UDE three' });
    const warnings = ofRule(
      validate(
        makeDoc(
          [rc, ude1, ude2, ude3],
          [makeEdge(rc.id, ude1.id), makeEdge(rc.id, ude2.id), makeEdge(rc.id, ude3.id)],
          'crt'
        )
      ),
      LOW_COVERAGE
    );

    expect(warnings).toHaveLength(0);
  });

  it('does NOT fire on a non-CRT diagram even with low coverage', () => {
    // FRT does not register this rule; the same fragmented shape must be silent.
    const rc = makeEntity({ type: 'rootCause', title: 'Root cause' });
    const ude1 = makeEntity({ type: 'ude', title: 'UDE one' });
    const ude2 = makeEntity({ type: 'ude', title: 'UDE two' });
    const ude3 = makeEntity({ type: 'ude', title: 'UDE three' });
    const warnings = ofRule(
      validate(makeDoc([rc, ude1, ude2, ude3], [makeEdge(rc.id, ude1.id)], 'frt')),
      LOW_COVERAGE
    );

    expect(warnings).toHaveLength(0);
  });
});

describe('crt-tied-core-drivers', () => {
  it('fires when the top two root causes each reach an equal number of UDEs (≥2)', () => {
    // rc1 → ude1, ude2 ; rc2 → ude3, ude4 — both reach 2 UDEs.
    const rc1 = makeEntity({ type: 'rootCause', title: 'Root cause one' });
    const rc2 = makeEntity({ type: 'rootCause', title: 'Root cause two' });
    const ude1 = makeEntity({ type: 'ude', title: 'UDE one' });
    const ude2 = makeEntity({ type: 'ude', title: 'UDE two' });
    const ude3 = makeEntity({ type: 'ude', title: 'UDE three' });
    const ude4 = makeEntity({ type: 'ude', title: 'UDE four' });
    const warnings = ofRule(
      validate(
        makeDoc(
          [rc1, rc2, ude1, ude2, ude3, ude4],
          [
            makeEdge(rc1.id, ude1.id),
            makeEdge(rc1.id, ude2.id),
            makeEdge(rc2.id, ude3.id),
            makeEdge(rc2.id, ude4.id),
          ],
          'crt'
        )
      ),
      TIED
    );

    expect(warnings).toHaveLength(1);
    const w = warnings[0]!;
    // Tie is anchored on the first candidate (lowest annotationNumber).
    expect(w.target).toEqual({ kind: 'entity', id: rc1.id });
    expect(w.tier).toBe('clarity');
    expect(w.message).toContain('Two root causes each reach 2 UDEs');
    expect(w.message).toContain('spawn an Evaporating Cloud');
    // One-click remedy action is attached.
    expect(w.action).toEqual({
      actionId: 'spawn-ec-from-conflict',
      label: 'Spawn Evaporating Cloud',
    });
  });

  it('does NOT fire when the tie is only 1 UDE each (below the ≥2 guard)', () => {
    // rc1 → ude1 ; rc2 → ude2 — tie at 1, which is the trivial scaffold case.
    const rc1 = makeEntity({ type: 'rootCause', title: 'Root cause one' });
    const rc2 = makeEntity({ type: 'rootCause', title: 'Root cause two' });
    const ude1 = makeEntity({ type: 'ude', title: 'UDE one' });
    const ude2 = makeEntity({ type: 'ude', title: 'UDE two' });
    const ude3 = makeEntity({ type: 'ude', title: 'UDE three' });
    const warnings = ofRule(
      validate(
        makeDoc(
          [rc1, rc2, ude1, ude2, ude3],
          [makeEdge(rc1.id, ude1.id), makeEdge(rc2.id, ude2.id)],
          'crt'
        )
      ),
      TIED
    );

    expect(warnings).toHaveLength(0);
  });

  it('does NOT fire when the top two root causes reach different counts', () => {
    // rc1 → ude1, ude2, ude3 (3) ; rc2 → ude2, ude3 (2) — no tie.
    const rc1 = makeEntity({ type: 'rootCause', title: 'Root cause one' });
    const rc2 = makeEntity({ type: 'rootCause', title: 'Root cause two' });
    const ude1 = makeEntity({ type: 'ude', title: 'UDE one' });
    const ude2 = makeEntity({ type: 'ude', title: 'UDE two' });
    const ude3 = makeEntity({ type: 'ude', title: 'UDE three' });
    const warnings = ofRule(
      validate(
        makeDoc(
          [rc1, rc2, ude1, ude2, ude3],
          [
            makeEdge(rc1.id, ude1.id),
            makeEdge(rc1.id, ude2.id),
            makeEdge(rc1.id, ude3.id),
            makeEdge(rc2.id, ude2.id),
            makeEdge(rc2.id, ude3.id),
          ],
          'crt'
        )
      ),
      TIED
    );

    expect(warnings).toHaveLength(0);
  });

  it('does NOT fire when there is only a single core driver candidate', () => {
    // One root cause reaching 2 UDEs → no `second`, so no tie.
    const rc = makeEntity({ type: 'rootCause', title: 'Root cause' });
    const ude1 = makeEntity({ type: 'ude', title: 'UDE one' });
    const ude2 = makeEntity({ type: 'ude', title: 'UDE two' });
    const warnings = ofRule(
      validate(
        makeDoc([rc, ude1, ude2], [makeEdge(rc.id, ude1.id), makeEdge(rc.id, ude2.id)], 'crt')
      ),
      TIED
    );

    expect(warnings).toHaveLength(0);
  });

  it('does NOT fire on a non-CRT diagram even with a tie', () => {
    const rc1 = makeEntity({ type: 'rootCause', title: 'Root cause one' });
    const rc2 = makeEntity({ type: 'rootCause', title: 'Root cause two' });
    const ude1 = makeEntity({ type: 'ude', title: 'UDE one' });
    const ude2 = makeEntity({ type: 'ude', title: 'UDE two' });
    const ude3 = makeEntity({ type: 'ude', title: 'UDE three' });
    const ude4 = makeEntity({ type: 'ude', title: 'UDE four' });
    const warnings = ofRule(
      validate(
        makeDoc(
          [rc1, rc2, ude1, ude2, ude3, ude4],
          [
            makeEdge(rc1.id, ude1.id),
            makeEdge(rc1.id, ude2.id),
            makeEdge(rc2.id, ude3.id),
            makeEdge(rc2.id, ude4.id),
          ],
          'frt'
        )
      ),
      TIED
    );

    expect(warnings).toHaveLength(0);
  });
});
