import { Download } from 'lucide-react';
import { useId } from 'react';
import { Button } from '@/components/ui/Button';
import {
  type OfflineExtrasState,
  type TopUpPhase,
  useOfflineExtras,
} from '@/hooks/useOfflineExtras';
import {
  type OfflineReadiness,
  type ReadinessTriState,
  useOfflineReadiness,
} from '@/hooks/useOfflineReadiness';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import type { Messages } from '@/i18n/types';
import { useT } from '@/i18n/useT';

/**
 * Offline-readiness diagnostics, inside the About dialog.
 *
 * This is evidence, not decoration. The reported failure was the *browser's*
 * "No internet access" page — meaning the service worker never served the
 * navigation at all — and there was no way to tell from inside the app whether
 * the worker had installed, whether the precache had populated, or whether the
 * browser had evicted the whole origin. One screenshot of these four rows
 * answers all three.
 *
 * It lives in About rather than Settings because it is a read-only build/runtime
 * fact, like the version line it sits under. The one exception is the extras
 * row's download control: the other four report facts the user cannot change
 * from here, while the on-demand tier is exactly what a short window of wifi
 * can fix.
 */

type OfflineMessages = Messages['about']['offline'];

/** Bytes → "12.3 MB". Fixed to MB (not adaptive units) so two screenshots from
 *  different sessions compare at a glance. */
function formatMegabytes(bytes: number): string {
  return (bytes / (1024 * 1024)).toFixed(1);
}

/**
 * The same units for the pending download, floored at 0.1 — a file the panel
 * is offering to fetch is never "0.0 MB", and rounding a real download to zero
 * is the one direction this number must not err in.
 */
function approxMegabytes(bytes: number): string {
  return Math.max(bytes / (1024 * 1024), 0.1).toFixed(1);
}

function serviceWorkerText(status: OfflineReadiness['serviceWorker'], o: OfflineMessages): string {
  switch (status) {
    case 'active':
      return o.swActive;
    case 'waiting':
      return o.swWaiting;
    case 'unregistered':
      return o.swUnregistered;
    default:
      return o.swUnsupported;
  }
}

function readyText(entries: number | null, o: OfflineMessages): string {
  if (entries === null) return o.readyUnknown;
  if (entries === 0) return o.readyNo;
  return o.readyYes({ count: entries });
}

function persistedText(state: ReadinessTriState, o: OfflineMessages): string {
  switch (state) {
    case 'yes':
      return o.persistedYes;
    case 'no':
      return o.persistedNo;
    default:
      return o.persistedUnknown;
  }
}

/**
 * The on-demand tier, in one line.
 *
 * Precedence is load-bearing, top down:
 *
 *   1. `probed` first, because the UNPROBED default reports
 *      `serviceWorker: 'unsupported'` — check the worker before the probe has
 *      landed and a healthy install flashes the no-worker line on every dialog
 *      open.
 *   2. No Service Worker API at all is its own answer. It is not a "not yet",
 *      and saying "no service worker is serving yet" under a row that already
 *      says "Not supported in this browser" reads as a contradiction.
 *   3. Without an ACTIVE worker, never show a number. Fetches bypass the worker,
 *      so the manifest comes from the network and names the *next* deploy's
 *      content hashes; every `caches.match` misses and the row would report
 *      "none cached" about assets this page will never request. "Unknown" is
 *      the honest answer, and this panel's whole value is being evidence.
 *
 * That gate sits here rather than in the hook on purpose: it is a rule about
 * what we are willing to claim, not about counting.
 */
function extrasText(
  readiness: OfflineReadiness,
  extras: OfflineExtrasState,
  o: OfflineMessages
): string {
  if (!readiness.probed) return o.checking;
  if (readiness.serviceWorker === 'unsupported') return o.extrasNoSwSupport;
  if (readiness.serviceWorker !== 'active') return o.extrasNoWorker;
  switch (extras.phase) {
    case 'checking':
      return o.checking;
    case 'unreadable':
      return o.extrasUnknown;
    case 'listUnavailable':
      return o.extrasListUnavailable;
    case 'empty':
      return o.extrasNone;
    default:
      if (extras.cached === extras.total) return o.extrasYes({ total: extras.total });
      if (extras.cached === 0) return o.extrasNo({ total: extras.total });
      return o.extrasSome({ cached: extras.cached, total: extras.total });
  }
}

/**
 * What the line says, and what a screen reader hears — which are deliberately
 * not always the same string.
 *
 * Per-file progress is useful to look at and useless to listen to: a polite
 * live region re-announces on every change, so a nine-file top-up interrupted
 * the reader nine times. The announced text moves on meaningful transitions
 * only (a tier starting, a run ending, a reason appearing).
 */
interface StatusLine {
  visible: string;
  announced: string;
}

const sameLine = (text: string): StatusLine => ({ visible: text, announced: text });

/**
 * Whether the control can be pressed, and — inseparably — why not.
 *
 * One computation returns both. They were two before: `disabled` was derived
 * from the readiness probe and the online flag, while the line beside it came
 * from a different chain of `if`s, so the panel could show an enabled button
 * next to "Connect to a network". A verdict and its stated reason cannot
 * disagree when neither exists without the other.
 */
type TopUpGate = { enabled: true } | { enabled: false; reason: StatusLine };

function topUpGate(
  readiness: OfflineReadiness,
  extras: OfflineExtrasState,
  topUp: TopUpPhase,
  online: boolean,
  o: OfflineMessages
): TopUpGate {
  if (topUp.kind === 'preparing') return { enabled: false, reason: sameLine(o.topUpPreparing) };
  if (topUp.kind === 'running') {
    const counts = { done: topUp.done, total: topUp.total };
    const onAssets = topUp.tier === 'assets';
    return {
      enabled: false,
      reason: {
        visible: onAssets ? o.topUpAssets(counts) : o.topUpBook(counts),
        announced: onAssets ? o.topUpAssetsTier : o.topUpBookTier,
      },
    };
  }
  // "We have not looked yet" is a reason too. The probe window used to render
  // a disabled button next to an empty line, which is the one thing this
  // panel's own rule says never to do.
  if (!readiness.probed || extras.phase === 'checking') {
    return { enabled: false, reason: sameLine(o.checking) };
  }
  if (readiness.serviceWorker === 'unsupported') {
    // Never "refresh, then download": there is no worker to refresh into.
    return { enabled: false, reason: sameLine(o.topUpNoWorkerSupport) };
  }
  if (readiness.serviceWorker !== 'active') {
    return { enabled: false, reason: sameLine(o.topUpNeedsWorker) };
  }
  if (!online) return { enabled: false, reason: sameLine(o.topUpNeedsNetwork) };
  if (extras.phase === 'empty') return { enabled: false, reason: sameLine(o.topUpNothingToGet) };
  return { enabled: true };
}

/**
 * The line shown when the control IS pressable: the last run's result, or —
 * before any press — what pressing would cost.
 *
 * The size is the point of the idle line. Someone with two minutes of wifi
 * needs the number before they commit to it, and the build manifest is the
 * only honest place to get it: a `HEAD` per file would spend the metered
 * bytes this figure exists to protect.
 */
function resultLine(topUp: TopUpPhase, extras: OfflineExtrasState, o: OfflineMessages): StatusLine {
  switch (topUp.kind) {
    case 'done':
      return sameLine(o.topUpDone);
    case 'incomplete':
      return sameLine(o.topUpIncomplete);
    case 'nothing':
      return sameLine(o.topUpNothing);
    case 'unverified':
      return sameLine(o.topUpUnverified);
    case 'unavailable':
      return sameLine(o.topUpUnavailable);
    case 'failed':
      return sameLine(o.topUpFailed);
    case 'uncontrolled':
      return sameLine(o.topUpUncontrolled);
    case 'blocked':
      return sameLine(o.topUpBlocked);
    default:
      if (extras.phase !== 'counted' || extras.cached === extras.total) return sameLine('');
      // `null` where the deploy predates build-time sizes: no number beats a
      // made-up one, and the row already says how many files are missing.
      if (extras.missingBytes === null) return sameLine('');
      return sameLine(o.topUpSize({ mb: approxMegabytes(extras.missingBytes) }));
  }
}

/** One label/value line. `mono` on the value keeps numbers easy to read off a screenshot. */
function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-0.5">
      <dt className="shrink-0 text-neutral-500 dark:text-neutral-400">{label}</dt>
      <dd className="text-right text-neutral-700 tabular-nums dark:text-neutral-300">{value}</dd>
    </div>
  );
}

export function OfflineReadinessSection() {
  const a = useT().about;
  const o = a.offline;
  const { extras, topUp, runTopUp } = useOfflineExtras();
  // Re-probe whenever the top-up phase changes. The readiness probe stops once
  // a worker is `active`, which is the right answer to "is one serving me" and
  // the wrong one for the byte counts beside it: a finished download moves both
  // "Cached size" and the precache count, and the panel used to keep quoting
  // the pre-download figures next to an extras row it had just refreshed —
  // two numbers in one panel disagreeing about the download it had performed.
  const readiness = useOfflineReadiness(topUp.kind);
  // `useSyncExternalStore` over the `online`/`offline` events, so the button
  // re-enables itself the moment the wifi window opens — no reopen needed,
  // which is literally the scenario this control exists for.
  const online = useOnlineStatus();
  const statusId = useId();
  const gate = topUpGate(readiness, extras, topUp, online, o);
  const status = gate.enabled ? resultLine(topUp, extras, o) : gate.reason;
  // Two forms only, and neither changes mid-run: the extras count cannot move
  // while a run is in flight, so this can never mutate under a press.
  const label =
    extras.phase === 'counted' && extras.cached === extras.total ? o.topUpRecheck : o.topUpDownload;

  return (
    <section>
      <h3 className="mb-1.5 font-semibold text-[10px] text-neutral-500 uppercase tracking-wider dark:text-neutral-400">
        {o.heading}
      </h3>
      {/* `aria-busy` rather than swapping in a spinner: the rows keep their
          shape, so the dialog does not reflow when the probes land. */}
      <dl aria-busy={!readiness.probed} className="text-[11px] leading-relaxed">
        <Row
          label={o.serviceWorker}
          value={readiness.probed ? serviceWorkerText(readiness.serviceWorker, o) : o.checking}
        />
        <Row
          label={o.ready}
          value={readiness.probed ? readyText(readiness.precachedEntries, o) : o.checking}
        />
        <Row label={o.extras} value={extrasText(readiness, extras, o)} />
        <Row
          label={o.persisted}
          value={readiness.probed ? persistedText(readiness.persisted, o) : o.checking}
        />
        <Row
          label={o.cachedSize}
          value={
            !readiness.probed
              ? o.checking
              : readiness.usageBytes === null
                ? o.cachedSizeUnknown
                : o.bytes({ mb: formatMegabytes(readiness.usageBytes) })
          }
        />
      </dl>
      {/* Status line and control, not a heading-line control: that `<h3>` class
          string is byte-identical in six places, and a button next to 10px
          uppercase micro-copy reads as noise. `min-h-4` on an always-present
          `<p>` keeps the panel from reflowing as the status changes, which is
          also why every result string here is short enough for one line.

          The live region is a separate, visually-hidden node carrying the
          throttled wording, and it is what `aria-describedby` points at: the
          visible line's per-file counts would otherwise be re-announced on
          every file. Present from first paint so its first message is heard. */}
      <div className="mt-2 flex items-center justify-between gap-3">
        <p
          aria-hidden="true"
          className="min-h-4 flex-1 text-[11px] text-neutral-500 dark:text-neutral-400"
        >
          {status.visible}
        </p>
        <span aria-live="polite" className="sr-only" id={statusId} role="status">
          {status.announced}
        </span>
        {/* `aria-disabled`, NOT the `disabled` attribute: a natively disabled
            button is skipped by keyboard navigation and its `aria-describedby`
            is never read — so the reason was unreachable in exactly the states
            it was written for. The click handler is the real guard. */}
        <Button
          variant="softNeutral"
          size="xs"
          aria-describedby={statusId}
          aria-disabled={!gate.enabled}
          className="aria-disabled:cursor-not-allowed aria-disabled:opacity-50"
          onClick={() => {
            if (gate.enabled) runTopUp();
          }}
        >
          <Download className="h-3.5 w-3.5" />
          {label}
        </Button>
      </div>
    </section>
  );
}
