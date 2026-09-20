import { useCallback, useEffect, useRef, useState } from 'react';
import { log } from '@/services/logger';
import {
  countCachedOfflineExtras,
  type OfflineExtrasCount,
  type OfflineTopUpOutcome,
  type OfflineTopUpProgress,
  topUpOfflineAssets,
} from '@/services/pwa/offlineWarmup';

/**
 * How much of the on-demand tier is cached, and the one control that changes
 * the answer.
 *
 * A **sibling** of `useOfflineReadiness`, not an extension of it. That hook's
 * doc comment commits it in writing to being read-only — the repair side
 * effects live in `services/pwa/offlineReadiness.ts` — and a top-up is a side
 * effect. Keeping them apart also keeps one question per hook: that one answers
 * "did the shell install", this one answers "are the extras here".
 */

export type OfflineExtrasState =
  | { phase: 'checking' }
  /** Cache Storage absent, or a read threw (private window, managed profile). */
  | { phase: 'unreadable' }
  /** The list of extras could not be fetched — a dev build, or a live redeploy. */
  | { phase: 'listUnavailable' }
  /** The list was read and names nothing. Different from not reading it. */
  | { phase: 'empty' }
  | { phase: 'counted'; cached: number; total: number; missingBytes: number | null };

export type TopUpPhase =
  | { kind: 'idle' }
  | { kind: 'preparing' }
  | { kind: 'running'; tier: OfflineTopUpProgress['tier']; done: number; total: number }
  | { kind: 'done' }
  /** Some files landed, some did not. The row carries the numbers. */
  | { kind: 'incomplete' }
  /** The re-count found nothing cached at all. */
  | { kind: 'nothing' }
  /** The run finished but Cache Storage would not say what it kept. */
  | { kind: 'unverified' }
  | { kind: 'unavailable' }
  /** Offline or no worker by the time the run actually started. */
  | { kind: 'blocked' }
  | { kind: 'uncontrolled' }
  /** Something rejected. Terminal, because a stuck `preparing` disables the button forever. */
  | { kind: 'failed' };

export interface OfflineExtras {
  extras: OfflineExtrasState;
  topUp: TopUpPhase;
  runTopUp: () => void;
}

function mapCount(count: OfflineExtrasCount): OfflineExtrasState {
  if (count.status === 'counted') {
    return {
      phase: 'counted',
      cached: count.cached,
      total: count.total,
      missingBytes: count.missingBytes,
    };
  }
  return { phase: count.status };
}

/**
 * The verdict for a finished run, taken from the RE-COUNT rather than from the
 * fetch tally.
 *
 * Both numbers were on screen at once before this, from two different sources:
 * the status line said "Partly done — 7 of 7 cached" (fetch tally) directly
 * under a row saying "Yes — all 7 files cached" (re-count). A `response.ok`
 * proves the network answered, not that the worker kept anything —
 * `vite.config.ts` carries the shipped bug where a broken route cached nothing
 * while every response read `ok`. So the cache read is the only source of
 * truth here, and the two lines cannot disagree because they now come from one
 * read.
 */
function settle(outcome: OfflineTopUpOutcome, count: OfflineExtrasCount): TopUpPhase {
  // The one thing the count genuinely cannot say: there was no run at all.
  if (outcome.status === 'offline' || outcome.status === 'unsupported') return { kind: 'blocked' };
  // A worker can be *registered and active* while not serving THIS tab — with no
  // `clientsClaim`, a first load never gets claimed. Nothing can be cached from
  // such a page, so the press really did nothing; saying "nothing was cached,
  // try again" would send the user round the same loop forever. A reload is what
  // hands the page over, so that is what the copy asks for.
  if (outcome.status === 'uncontrolled') return { kind: 'uncontrolled' };
  switch (count.status) {
    case 'counted':
      if (count.cached === count.total) return { kind: 'done' };
      return count.cached === 0 ? { kind: 'nothing' } : { kind: 'incomplete' };
    case 'empty':
      // Nothing to download, so there is no result to report. The row says
      // "None — this build has no extras" and the button carries the same
      // reason; a "Done — everything is cached" here contradicted both.
      return { kind: 'idle' };
    case 'listUnavailable':
      return { kind: 'unavailable' };
    default:
      return { kind: 'unverified' };
  }
}

export function useOfflineExtras(): OfflineExtras {
  const [extras, setExtras] = useState<OfflineExtrasState>({ phase: 'checking' });
  const [topUp, setTopUp] = useState<TopUpPhase>({ kind: 'idle' });
  // A top-up outlives the panel — the About dialog unmounts on close — and the
  // fetches are deliberately NOT aborted, because throwing away a short wifi
  // window is worse than an orphaned promise. So every post-await write is
  // guarded instead.
  const cancelled = useRef(false);

  useEffect(() => {
    cancelled.current = false;
    void countCachedOfflineExtras()
      .then(mapCount)
      // A browser that blocks site data can make the `caches` accessor itself
      // throw; "we could not look" is the honest row, and an unhandled
      // rejection here would leave the row on "Checking…" forever.
      .catch((err): OfflineExtrasState => {
        log.warn('Offline extras: count failed', err);
        return { phase: 'unreadable' };
      })
      .then((next) => {
        if (!cancelled.current) setExtras(next);
      });
    return () => {
      cancelled.current = true;
    };
  }, []);

  const runTopUp = useCallback(() => {
    void (async () => {
      setTopUp({ kind: 'preparing' });
      const outcome = await topUpOfflineAssets((progress) => {
        if (!cancelled.current) setTopUp({ kind: 'running', ...progress });
      });
      // Always re-read Cache Storage. What the fetches returned proves only
      // that the network answered, not that the worker kept anything.
      const next = await countCachedOfflineExtras();
      if (cancelled.current) return;
      setExtras(mapCount(next));
      setTopUp(settle(outcome, next));
    })().catch((err) => {
      // Nothing above is meant to reject, which is exactly why this is here: a
      // rejection used to leave the phase at `preparing`, and a `preparing`
      // that never ends disables the button for the rest of the dialog's life
      // — the worst outcome for a control whose whole job is to be pressable
      // inside a two-minute window.
      log.warn('Offline extras: top-up failed', err);
      if (!cancelled.current) setTopUp({ kind: 'failed' });
    });
  }, []);

  return { extras, topUp, runTopUp };
}
