import { Dices, Pause, Play, RotateCcw, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import {
  createDiceGame,
  DIE_MEAN,
  type DiceGameState,
  expectedThroughput,
  playRound,
  totalWip,
} from '@/domain/diceGame';
import { useDocumentStore } from '@/store';
import { Button } from '../ui/Button';
import { Modal } from '../ui/Modal';

/**
 * Session 195 easter egg — Goldratt's dice game (the match-bowl game from
 * *The Goal*, ch. 14), playable. Five stations in a line, one die each per
 * round, each station passes `min(roll, upstream inventory)` downstream.
 * Every station AVERAGES 3.5 — the line does not. Dependent events +
 * statistical fluctuation, live.
 *
 * Reached via the hidden palette command (type "dice" / "herbie") or five
 * clicks on the About dialog's version line. Lazy-loaded from App.tsx so
 * none of this ships in the eager `index` chunk.
 */

const STATIONS = 5;
const INITIAL_WIP = 4;
const PUNCHLINE_ROUND = 20;
/** History is unbounded state in a dialog — cap the game well past the
 *  point the lesson has landed. */
const MAX_ROUNDS = 99;
const AUTO_PLAY_MS = 550;

const freshGame = (): DiceGameState =>
  createDiceGame({ stations: STATIONS, initialWip: INITIAL_WIP, seed: Date.now() });

export function DiceGameDialog() {
  const open = useDocumentStore((s) => s.diceGameOpen);
  const close = useDocumentStore((s) => s.closeDiceGame);
  const [game, setGame] = useState<DiceGameState>(freshGame);
  const [auto, setAuto] = useState(false);

  const done = game.round >= MAX_ROUNDS;

  // Fresh dice every time the dialog opens; also parks auto-play so a
  // re-open doesn't start rolling on its own.
  useEffect(() => {
    if (!open) return;
    setGame(freshGame());
    setAuto(false);
  }, [open]);

  useEffect(() => {
    if (!open || !auto || done) return undefined;
    const t = setInterval(() => setGame((g) => playRound(g)), AUTO_PLAY_MS);
    return () => clearInterval(t);
  }, [open, auto, done]);

  const expected = expectedThroughput(game.round);
  const deficit = expected - game.completed;
  const lastRound = game.history[game.history.length - 1];

  if (!open) return null;

  return (
    <Modal open={open} onDismiss={close} widthClass="max-w-2xl" labelledBy="dice-game-title">
      <header className="flex items-center justify-between border-neutral-200 border-b px-4 py-3 dark:border-neutral-800">
        <h2
          id="dice-game-title"
          className="flex items-center gap-2 font-semibold text-neutral-900 text-sm dark:text-neutral-100"
        >
          <Dices className="h-4 w-4 text-accent-500" aria-hidden />
          The Dice Game
        </h2>
        <Button variant="ghost" size="icon" onClick={close} aria-label="Close dice game">
          <X className="h-4 w-4" />
        </Button>
      </header>

      <div className="max-h-[75vh] space-y-4 overflow-y-auto px-4 py-4">
        <p className="text-neutral-600 text-xs leading-relaxed dark:text-neutral-400">
          The match-bowl game from <em>The Goal</em>. Five stations, one die each per round. A
          station can only pass on what its upstream buffer holds — station 1 draws from an
          unlimited bowl. Every station averages {DIE_MEAN} a round, so the line should too&hellip;
          right?
        </p>

        {/* The production line */}
        <div className="flex items-stretch gap-1 overflow-x-auto pb-1" aria-label="Stations">
          <WipBadge label="∞" hint="Unlimited raw material" />
          {Array.from({ length: STATIONS }, (_, i) => (
            <StationCard
              // Stations are a fixed line — the index IS the identity.
              key={`station-${i + 1}`}
              index={i}
              roll={lastRound?.rolls[i]}
              moved={lastRound?.moved[i]}
              isLast={i === STATIONS - 1}
            />
          )).flatMap((card, i) =>
            i < STATIONS - 1
              ? [
                  card,
                  <WipBadge
                    key={`wip-${card.key}`}
                    label={String(game.wip[i] ?? 0)}
                    hint={`Inventory waiting for station ${i + 2}`}
                  />,
                ]
              : [card]
          )}
        </div>

        {/* Scoreboard */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-neutral-700 text-xs dark:text-neutral-300">
          <span>
            Round <strong>{game.round}</strong>
          </span>
          <span>
            Throughput <strong>{game.completed}</strong>
          </span>
          <span>
            &ldquo;Should be&rdquo; <strong>{expected.toFixed(1)}</strong>
          </span>
          {game.round > 0 && (
            <span className={deficit > 0 ? 'text-rose-600 dark:text-rose-400' : ''}>
              Behind by <strong>{deficit.toFixed(1)}</strong>
            </span>
          )}
          <span>
            Stuck in line <strong>{totalWip(game)}</strong>
          </span>
        </div>

        <ThroughputChart game={game} />

        {/* Controls */}
        <div className="flex items-center gap-2">
          <Button
            variant="primary"
            size="md"
            disabled={done}
            onClick={() => setGame((g) => playRound(g))}
          >
            <Dices className="h-3.5 w-3.5" /> Roll
          </Button>
          <Button variant="softViolet" size="md" disabled={done} onClick={() => setAuto(!auto)}>
            {auto ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
            {auto ? 'Pause' : 'Auto-roll'}
          </Button>
          <Button
            variant="ghost"
            size="md"
            onClick={() => {
              setGame(freshGame());
              setAuto(false);
            }}
          >
            <RotateCcw className="h-3.5 w-3.5" /> Reset
          </Button>
        </div>

        {game.round >= PUNCHLINE_ROUND && (
          <div className="rounded-md border border-accent-200 bg-accent-50/60 p-3 text-neutral-700 text-xs leading-relaxed dark:border-accent-900/40 dark:bg-accent-950/30 dark:text-neutral-300">
            <p className="mb-1 font-semibold text-neutral-900 dark:text-neutral-100">
              The line never averages {DIE_MEAN}.
            </p>
            <p>
              Each station&rsquo;s <em>capacity</em> averages {DIE_MEAN}, but a station can never
              pass on more than it received — a bad roll upstream caps everyone downstream, and a
              good roll can&rsquo;t make up for it, it just piles up inventory. Dependent events
              plus statistical fluctuation: the deficit only accumulates. That&rsquo;s why balancing
              capacity doesn&rsquo;t work, and why the constraint — not the average — governs the
              system. Now go find your Herbie.
            </p>
          </div>
        )}
      </div>
    </Modal>
  );
}

function StationCard({
  index,
  roll,
  moved,
  isLast,
}: {
  index: number;
  roll: number | undefined;
  moved: number | undefined;
  isLast: boolean;
}) {
  // A station that rolled more than it could move was starved by its
  // upstream buffer — tint it: this is the round's dependency bite.
  const starved = roll !== undefined && moved !== undefined && moved < roll;
  return (
    <div
      className={`flex min-w-[76px] flex-1 flex-col items-center gap-0.5 rounded-lg border px-2 py-2 ${
        starved
          ? 'border-rose-300 bg-rose-50/60 dark:border-rose-900/50 dark:bg-rose-950/20'
          : 'border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900'
      }`}
    >
      <span className="text-[10px] text-neutral-500 uppercase tracking-wide dark:text-neutral-400">
        {isLast ? 'Ship' : `Stn ${index + 1}`}
      </span>
      <span className="font-bold text-2xl text-neutral-900 tabular-nums dark:text-neutral-100">
        {roll ?? '–'}
      </span>
      <span
        className={`text-[10px] tabular-nums ${starved ? 'font-semibold text-rose-600 dark:text-rose-400' : 'text-neutral-500 dark:text-neutral-400'}`}
      >
        moved {moved ?? '–'}
      </span>
    </div>
  );
}

function WipBadge({ label, hint }: { label: string; hint: string }) {
  return (
    <div
      className="flex flex-col items-center justify-center gap-0.5 self-center px-0.5"
      title={hint}
    >
      <span className="rounded-full border border-neutral-200 bg-neutral-50 px-1.5 py-0.5 font-medium text-[10px] text-neutral-600 tabular-nums dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-300">
        {label}
      </span>
    </div>
  );
}

/** Cumulative actual throughput vs the 3.5/round "should be" line — the gap
 *  between them IS the lesson, so it gets the visual centre of the dialog. */
function ThroughputChart({ game }: { game: DiceGameState }) {
  const W = 560;
  const H = 120;
  const PAD = 6;
  const points = useMemo(() => {
    const rounds = Math.max(PUNCHLINE_ROUND, game.round);
    const yMax = Math.max(expectedThroughput(rounds), 1);
    const x = (r: number) => PAD + (r / rounds) * (W - 2 * PAD);
    const y = (v: number) => H - PAD - (v / yMax) * (H - 2 * PAD);
    let cumulative = 0;
    const actual = [`${x(0)},${y(0)}`];
    for (let r = 0; r < game.history.length; r++) {
      cumulative += game.history[r]?.completed ?? 0;
      actual.push(`${x(r + 1)},${y(cumulative)}`);
    }
    const expectedLine = `${x(0)},${y(0)} ${x(rounds)},${y(expectedThroughput(rounds))}`;
    return { actual: actual.join(' '), expected: expectedLine };
  }, [game.history, game.round]);

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="h-28 w-full rounded-md border border-neutral-200 bg-neutral-50/60 dark:border-neutral-800 dark:bg-neutral-900/60"
      role="img"
      aria-label="Cumulative throughput versus the 3.5-per-round average"
    >
      <polyline
        points={points.expected}
        fill="none"
        strokeDasharray="4 4"
        className="stroke-neutral-400 dark:stroke-neutral-600"
        strokeWidth="1.5"
      />
      <polyline points={points.actual} fill="none" className="stroke-accent-500" strokeWidth="2" />
      <text x={W - PAD - 2} y={12} textAnchor="end" className="fill-neutral-400 text-[9px]">
        dashed = every station&apos;s average
      </text>
    </svg>
  );
}
