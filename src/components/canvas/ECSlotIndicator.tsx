/**
 * Session 93 / EC PPT comparison #32 — small inline SVG showing the
 * canonical 5-box Evaporating Cloud layout with one slot highlighted.
 *
 * Sits inside the CreationWizardPanel on EC wizards so a first-time
 * user can SEE which of the five pre-seeded boxes the current step
 * targets. The prompt text mentions slot letters ("Need B", "Want
 * D′") but a new user doesn't yet know which letter corresponds to
 * which box position; the indicator closes that gap visually.
 *
 * Coordinates match the canonical seed positions from
 * `domain/examples/ec.ts` (A left-center, B top-middle, C bottom-
 * middle, D top-right, D′ bottom-right) rescaled into a 120×60
 * viewBox. The four conflict-cone edges (A→B, A→C, B→D, C→D′) are
 * drawn as light lines so the EC shape reads as the recognized
 * 5-box arrow tree, not just five disconnected rectangles.
 */
import type { ECSlot } from '@/domain/ecGuiding';
import clsx from 'clsx';

type SlotGeom = { x: number; y: number; label: string };

// 120×60 viewBox. Box width 26, height 12. Layout mirrors the
// canonical seed coordinates from `EC_POSITIONS` in
// `domain/examples/ec.ts`. The slot letter sits centered inside.
const BOX_W = 26;
const BOX_H = 12;
const SLOTS: Record<ECSlot, SlotGeom> = {
  a: { x: 6, y: 24, label: 'A' },
  b: { x: 47, y: 4, label: 'B' },
  c: { x: 47, y: 44, label: 'C' },
  d: { x: 88, y: 4, label: 'D' },
  dPrime: { x: 88, y: 44, label: 'D′' },
};

const ALL_SLOTS = ['a', 'b', 'c', 'd', 'dPrime'] as const;

export function ECSlotIndicator({
  targetSlot,
  className,
}: {
  targetSlot: ECSlot | null;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 120 60"
      className={clsx('h-12 w-24', className)}
      role="img"
      aria-label={
        targetSlot
          ? `Evaporating Cloud shape — current step targets slot ${SLOTS[targetSlot].label}`
          : 'Evaporating Cloud 5-box shape'
      }
    >
      <title>
        {targetSlot ? `Step targets slot ${SLOTS[targetSlot].label}` : 'Evaporating Cloud shape'}
      </title>
      {/* Edges: A→B, A→C, B↔D (mutex), C→D′. Light strokes so the
          highlighted box dominates the visual read. */}
      <line
        x1={SLOTS.a.x + BOX_W}
        y1={SLOTS.a.y + BOX_H / 2}
        x2={SLOTS.b.x}
        y2={SLOTS.b.y + BOX_H / 2}
        stroke="currentColor"
        strokeOpacity="0.25"
        strokeWidth="0.8"
      />
      <line
        x1={SLOTS.a.x + BOX_W}
        y1={SLOTS.a.y + BOX_H / 2}
        x2={SLOTS.c.x}
        y2={SLOTS.c.y + BOX_H / 2}
        stroke="currentColor"
        strokeOpacity="0.25"
        strokeWidth="0.8"
      />
      <line
        x1={SLOTS.b.x + BOX_W}
        y1={SLOTS.b.y + BOX_H / 2}
        x2={SLOTS.d.x}
        y2={SLOTS.d.y + BOX_H / 2}
        stroke="currentColor"
        strokeOpacity="0.25"
        strokeWidth="0.8"
      />
      <line
        x1={SLOTS.c.x + BOX_W}
        y1={SLOTS.c.y + BOX_H / 2}
        x2={SLOTS.dPrime.x}
        y2={SLOTS.dPrime.y + BOX_H / 2}
        stroke="currentColor"
        strokeOpacity="0.25"
        strokeWidth="0.8"
      />
      {/* D ↔ D′ conflict edge — dashed to evoke the mutex visual. */}
      <line
        x1={SLOTS.d.x + BOX_W / 2}
        y1={SLOTS.d.y + BOX_H}
        x2={SLOTS.dPrime.x + BOX_W / 2}
        y2={SLOTS.dPrime.y}
        stroke="currentColor"
        strokeOpacity="0.4"
        strokeWidth="0.8"
        strokeDasharray="2 1.5"
      />
      {ALL_SLOTS.map((slot) => {
        const geom = SLOTS[slot];
        const active = slot === targetSlot;
        return (
          <g key={slot}>
            <rect
              x={geom.x}
              y={geom.y}
              width={BOX_W}
              height={BOX_H}
              rx="1.5"
              ry="1.5"
              className={clsx(
                'transition',
                active
                  ? 'fill-indigo-500 stroke-indigo-600 dark:fill-indigo-400 dark:stroke-indigo-300'
                  : 'fill-neutral-100 stroke-neutral-300 dark:fill-neutral-800 dark:stroke-neutral-600'
              )}
              strokeWidth="0.8"
            />
            <text
              x={geom.x + BOX_W / 2}
              y={geom.y + BOX_H / 2 + 3}
              textAnchor="middle"
              className={clsx(
                'select-none font-semibold text-[8px]',
                active ? 'fill-white' : 'fill-neutral-500 dark:fill-neutral-400'
              )}
            >
              {geom.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
