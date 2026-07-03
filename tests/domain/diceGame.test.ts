import { describe, expect, it } from 'vitest';
import {
  createDiceGame,
  DIE_MEAN,
  type DiceGameState,
  expectedThroughput,
  playRound,
  totalWip,
} from '@/domain/diceGame';

const play = (state: DiceGameState, rounds: number): DiceGameState => {
  let s = state;
  for (let i = 0; i < rounds; i++) s = playRound(s);
  return s;
};

describe('diceGame', () => {
  it('is deterministic for a given seed', () => {
    const a = play(createDiceGame({ stations: 5, initialWip: 4, seed: 42 }), 30);
    const b = play(createDiceGame({ stations: 5, initialWip: 4, seed: 42 }), 30);
    expect(a.history).toEqual(b.history);
    expect(a.completed).toBe(b.completed);
    expect(a.wip).toEqual(b.wip);
  });

  it('produces different games for different seeds', () => {
    const a = play(createDiceGame({ stations: 5, initialWip: 4, seed: 1 }), 10);
    const b = play(createDiceGame({ stations: 5, initialWip: 4, seed: 2 }), 10);
    expect(a.history).not.toEqual(b.history);
  });

  it('never moves more than the roll or the upstream inventory', () => {
    let s = createDiceGame({ stations: 5, initialWip: 2, seed: 7 });
    for (let r = 0; r < 50; r++) {
      const before = s.wip;
      s = playRound(s);
      const round = s.history[s.history.length - 1];
      if (!round) throw new Error('round missing');
      round.moved.forEach((m, i) => {
        const roll = round.rolls[i];
        if (roll === undefined) throw new Error('roll missing');
        expect(m).toBeLessThanOrEqual(roll);
        expect(m).toBeGreaterThanOrEqual(0);
        // Downstream stations are capped by what the buffer held at the start
        // of the round PLUS what the previous station just passed on.
        if (i > 0) {
          const prevMoved = round.moved[i - 1] ?? 0;
          expect(m).toBeLessThanOrEqual((before[i - 1] ?? 0) + prevMoved);
        }
      });
    }
  });

  it('conserves matches: input = throughput + WIP delta', () => {
    const initial = createDiceGame({ stations: 5, initialWip: 4, seed: 99 });
    const s = play(initial, 40);
    const fedIn = s.history.reduce((sum, r) => sum + (r.moved[0] ?? 0), 0);
    expect(fedIn).toBe(s.completed + totalWip(s) - totalWip(initial));
  });

  it('dice are always 1..6', () => {
    const s = play(createDiceGame({ stations: 5, initialWip: 4, seed: 123 }), 60);
    for (const round of s.history) {
      for (const roll of round.rolls) {
        expect(roll).toBeGreaterThanOrEqual(1);
        expect(roll).toBeLessThanOrEqual(6);
      }
    }
  });

  it("teaches the lesson: the line's throughput falls below the per-station average", () => {
    // Not a statistical fluke assertion — with a fixed seed this is exact and
    // stable. 100 rounds is deep enough that dependency drag dominates the
    // head start the initial WIP provides.
    const s = play(createDiceGame({ stations: 5, initialWip: 4, seed: 2026 }), 100);
    expect(s.completed).toBeLessThan(expectedThroughput(s.round));
    // And inventory piles up between stations — the other half of the lesson.
    expect(totalWip(s)).toBeGreaterThan(0);
  });

  it('expectedThroughput is rounds × the die mean', () => {
    expect(expectedThroughput(20)).toBe(20 * DIE_MEAN);
  });
});
