/**
 * Session 195 easter egg — Goldratt's dice game (the match-bowl game from
 * *The Goal*, ch. 14). A line of stations each rolls a die per round but can
 * only pass on `min(roll, upstream inventory)` — dependent events plus
 * statistical fluctuation drag throughput below the 3.5/round average even
 * though every station's *capacity* averages 3.5. The playable dialog lives
 * in `components/dice-game/`; this module is the pure, deterministic sim.
 *
 * Dice come from a seeded PRNG (mulberry32) carried in the state, so a game
 * is a pure fold: same seed → same rolls, no `Math.random` in domain code.
 */

export type DiceGameConfig = {
  /** Number of stations in the line. */
  stations: number;
  /** Starting inventory in each between-station buffer. The book starts the
   *  bowls empty; a small buffer makes the demo readable from round one
   *  without hiding the effect. */
  initialWip: number;
  /** PRNG seed. Same seed → identical game. */
  seed: number;
};

export type RoundResult = {
  /** Die roll per station, in line order. */
  rolls: number[];
  /** Matches actually moved by each station — `min(roll, available)`. */
  moved: number[];
  /** Output of the last station this round. */
  completed: number;
};

export type DiceGameState = {
  config: DiceGameConfig;
  /** Inventory sitting in front of stations 2..N (`wip[i]` feeds station
   *  `i + 1`). Station 1 draws from an unlimited raw-material bowl. */
  wip: number[];
  round: number;
  /** Total throughput so far (sum of last-station output). */
  completed: number;
  history: RoundResult[];
  /** mulberry32 state word — advanced by one step per die rolled. */
  rngState: number;
};

/** The average of one fair die — what naive intuition says each round of the
 *  whole LINE should also produce. */
export const DIE_MEAN = 3.5;

export const expectedThroughput = (rounds: number): number => rounds * DIE_MEAN;

/** mulberry32 step: advance the state word. */
const stepRng = (state: number): number => (state + 0x6d2b79f5) | 0;

/** mulberry32 output for a given state word, as a float in [0, 1). */
const rngValue = (state: number): number => {
  let t = Math.imul(state ^ (state >>> 15), 1 | state);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

export const createDiceGame = (config: DiceGameConfig): DiceGameState => ({
  config,
  wip: new Array(Math.max(0, config.stations - 1)).fill(config.initialWip),
  round: 0,
  completed: 0,
  history: [],
  rngState: config.seed | 0,
});

/**
 * Play one round: stations act in line order, so matches passed by station N
 * this round ARE available to station N+1 this round — the book's passing
 * rule, which is exactly what makes the events *dependent*.
 */
export const playRound = (state: DiceGameState): DiceGameState => {
  const { stations } = state.config;
  const wip = [...state.wip];
  const rolls: number[] = [];
  const moved: number[] = [];
  let rngState = state.rngState;
  let completedThisRound = 0;
  for (let i = 0; i < stations; i++) {
    rngState = stepRng(rngState);
    const roll = Math.floor(rngValue(rngState) * 6) + 1;
    // Station 1 draws from unlimited raw material; everyone else is capped
    // by whatever their upstream buffer holds right now.
    const upstream = wip[i - 1];
    const m = i === 0 ? roll : Math.min(roll, upstream ?? 0);
    if (i > 0 && upstream !== undefined) wip[i - 1] = upstream - m;
    if (i < stations - 1) wip[i] = (wip[i] ?? 0) + m;
    else completedThisRound = m;
    rolls.push(roll);
    moved.push(m);
  }
  const result: RoundResult = { rolls, moved, completed: completedThisRound };
  return {
    ...state,
    wip,
    round: state.round + 1,
    completed: state.completed + completedThisRound,
    history: [...state.history, result],
    rngState,
  };
};

/** Total inventory stuck between stations — the pile-up the game teaches. */
export const totalWip = (state: DiceGameState): number => state.wip.reduce((a, b) => a + b, 0);
