import { WifiOff } from 'lucide-react';
import { DataComponent } from '@/components/dataComponentNames';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { useT } from '@/i18n/useT';

/**
 * Ambient chip that appears only while the browser is offline.
 *
 * Mounted once at the App root rather than inside the TopBar. The TopBar is
 * part of the editor chrome, and the Start surface *replaces* that chrome
 * wholesale (`startSection !== null` in `App.tsx`) — so a chip living there is
 * invisible on Start, which is precisely where a cold launch with no network
 * lands. Being told "offline" only after you have already opened a document is
 * the one place this chip cannot afford to be missing.
 *
 * Fixed to the bottom-right, which is the one corner free on every surface:
 * the toast layer is bottom-centre (`Toaster`), `CanvasNav` sits bottom-centre
 * on the canvas, and bottom-left carries the Start sidebar's "Local & private"
 * card. It is `pointer-events-none` so it can never take a click from whatever
 * is underneath it.
 *
 * Why the wrapper is always mounted: a live region has to exist in the DOM
 * *before* its contents change for screen readers to announce reliably —
 * inserting the region itself is the flaky case. While online the wrapper is
 * an empty, fixed, non-interactive box, so it costs no layout and no input.
 */
export function OfflineIndicator() {
  const t = useT();
  const online = useOnlineStatus();

  return (
    <div
      data-component={DataComponent.OfflineIndicator}
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed right-3 bottom-3 z-40"
    >
      {online ? null : (
        <span
          title={t.toolbar.offlineTitle}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-amber-300 bg-amber-50 px-2.5 py-1.5 font-medium text-amber-700 text-xs dark:border-amber-800/50 dark:bg-amber-950/40 dark:text-amber-300"
        >
          <WifiOff className="h-3.5 w-3.5" aria-hidden />
          <span>{t.toolbar.offlineLabel}</span>
          {/* The reassurance half is the first thing to go at narrow widths —
              the label alone already carries the meaning. */}
          <span className="hidden text-[11px] md:inline">{t.toolbar.offlineNote}</span>
        </span>
      )}
    </div>
  );
}
