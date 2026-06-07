import type { LucideIcon } from 'lucide-react';
import type { CoachingEntry } from '@/domain/readerModeCoaching';

/**
 * Session 180 / E6 — Reader mode entity coaching card.
 *
 * Rendered inside a `NodeToolbar` (Position.Bottom) on hover when
 * reader mode is active. Shows the entity type icon, a bold label,
 * and a 1–2 sentence coaching tip that orients a non-expert reader.
 *
 * Intentionally kept narrow (w-56 / 224 px) so it fits cleanly next to
 * nodes on a typical 1280-px canvas without covering adjacent content.
 */
export function EntityCoachingTooltip({
  Icon,
  stripeColor,
  coaching,
}: {
  Icon: LucideIcon;
  stripeColor: string;
  coaching: CoachingEntry;
}) {
  return (
    <div
      data-component="entity-coaching-tooltip"
      className="pointer-events-none w-56 rounded-lg border border-neutral-200 bg-white/97 px-3 py-2.5 shadow-lg backdrop-blur-sm dark:border-neutral-700 dark:bg-neutral-900/97"
    >
      <span className="mb-1 flex items-center gap-1.5">
        <Icon className="h-3.5 w-3.5 shrink-0" style={{ color: stripeColor }} aria-hidden />
        <span className="font-semibold text-neutral-800 text-xs dark:text-neutral-100">
          {coaching.label}
        </span>
      </span>
      <p className="text-[11px] text-neutral-600 leading-relaxed dark:text-neutral-300">
        {coaching.tip}
      </p>
    </div>
  );
}
