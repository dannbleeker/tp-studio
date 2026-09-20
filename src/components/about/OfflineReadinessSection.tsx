import {
  type OfflineReadiness,
  type ReadinessTriState,
  useOfflineReadiness,
} from '@/hooks/useOfflineReadiness';
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
 * fact, like the version line it sits under — there is nothing to toggle here.
 */

type OfflineMessages = Messages['about']['offline'];

/** Bytes → "12.3 MB". Fixed to MB (not adaptive units) so two screenshots from
 *  different sessions compare at a glance. */
function formatMegabytes(bytes: number): string {
  return (bytes / (1024 * 1024)).toFixed(1);
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
  const readiness = useOfflineReadiness();

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
    </section>
  );
}
