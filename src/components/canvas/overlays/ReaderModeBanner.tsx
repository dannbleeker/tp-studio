import { X } from 'lucide-react';
import { useState } from 'react';
import { printLegendFor } from '@/domain/printLegend';
import type { DiagramType } from '@/domain/types';

/**
 * Session 180 / E6 — Reader mode orientation banner.
 *
 * Floats at the top-centre of the canvas when reader mode is active.
 * Shows the diagram-type name and a short reading-direction hint so a
 * non-expert knows which way to read the tree before diving in. Reuses
 * the existing `printLegendFor` copy from `@/domain/printLegend` so
 * there is a single source of truth for reading-direction prose.
 *
 * Dismissible via the × button (session-local state only — returning
 * to reader mode re-shows it). Freeform diagrams have no fixed reading
 * rule (`printLegendFor` returns `''`), so the banner renders nothing.
 */
export function ReaderModeBanner({ diagramType }: { diagramType: DiagramType }) {
  const [dismissed, setDismissed] = useState(false);

  const legend = printLegendFor(diagramType);
  // No reading rule for freeform, or user dismissed — render nothing.
  if (!legend || dismissed) return null;

  // Trim to the first sentence so the banner stays compact.
  const dotIndex = legend.indexOf('.');
  const shortLegend = dotIndex !== -1 ? legend.slice(0, dotIndex + 1) : legend;

  return (
    <div
      data-component="reader-mode-banner"
      className="pointer-events-auto absolute top-3 left-1/2 z-30 flex max-w-sm -translate-x-1/2 items-start gap-2 rounded-full border border-accent-200/70 bg-white/95 px-4 py-1.5 shadow-sm backdrop-blur-sm dark:border-accent-800/50 dark:bg-neutral-900/95"
      role="note"
      aria-label="How to read this diagram"
    >
      <p className="flex-1 text-center text-accent-700 text-xs leading-relaxed dark:text-accent-300">
        {shortLegend}
      </p>
      <button
        type="button"
        onClick={() => setDismissed(true)}
        className="mt-0.5 shrink-0 rounded-full text-accent-400 transition hover:text-accent-600 dark:text-accent-500 dark:hover:text-accent-300"
        aria-label="Dismiss reading guide"
        title="Dismiss"
      >
        <X className="h-3 w-3" />
      </button>
    </div>
  );
}
