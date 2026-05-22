/**
 * Session 135 — extracted from `PrintPreviewDialog.tsx` (file split).
 * Everything "print mode presentation": the `PrintMode` union, its
 * label + hint copy, the per-layer fill palettes, and the inline-SVG
 * `ModeThumbnail` previews (~120 lines of pure presentational SVG).
 * The dialog imports these; it owns the option state + the
 * window.print() / PDF handoff.
 */

export type PrintMode = 'standard' | 'workshop' | 'inksaving';

export const MODE_LABEL: Record<PrintMode, string> = {
  standard: 'Standard PDF',
  workshop: 'Workshop print',
  inksaving: 'Ink-saving',
};

export const MODE_HINT: Record<PrintMode, string> = {
  standard:
    'Default vector PDF via the browser. Letter / A4, auto-tiled across pages with the print stylesheet.',
  workshop:
    'High-contrast, large-font, designed to be readable across a meeting room. Group rectangles render as wide bands; entity titles bump to 18pt.',
  inksaving:
    "Group shading removed, edges thinner, blacks softened to grey. Saves toner when you're printing dozens of copies for a workshop handout.",
};

/**
 * Session 88 (S20) — inline SVG thumbnails for each print mode.
 * Tiny 60×40 previews that telegraph the visual treatment a mode
 * applies: colourful entity stripes (standard), bigger high-
 * contrast cards (workshop), greyscale with no fills (ink-saving).
 *
 * Pure presentational SVG — no layout calculation, no React Flow.
 *
 * Session 94 (Top-30 #26) — colour hex strings pulled into named
 * constants per visual layer so the thumbnail visibly tracks any
 * future theme change. The tokens still hard-code Tailwind palette
 * values rather than reading CSS vars — these previews intentionally
 * show the LIGHT-mode entity stripe palette regardless of the live
 * app theme (the print output is always intended for ink-on-white),
 * but pulling them to named refs means a tweak to the palette is a
 * one-place change.
 */

// Standard-mode previews mirror the canonical entity stripe palette
// (UDE amber, root-cause indigo/blue, effect green) from
// `src/domain/tokens.ts` at the time of print. Pinned values; the
// thumbnail is an artist's impression of what'll print, not a live
// preview, so out-of-sync palette tweaks here are harmless.
const STANDARD_FILLS = {
  cardA: '#fef3c7', // amber-100
  stripeA: '#f59e0b', // amber-500
  cardB: '#dbeafe', // blue-100
  stripeB: '#3b82f6', // blue-500
  cardC: '#dcfce7', // green-100
  stripeC: '#10b981', // emerald-500
  edge: '#94a3b8', // slate-400
  cardStroke: '#d4d4d4', // neutral-300
} as const;

const WORKSHOP_FILLS = {
  // Workshop = max contrast; everything reduces to black + the
  // same fill tints to keep entity-type recognition.
  cardA: STANDARD_FILLS.cardA,
  cardB: STANDARD_FILLS.cardB,
  cardC: STANDARD_FILLS.cardC,
  stroke: '#000000',
  edge: '#000000',
} as const;

const INKSAVING_FILLS = {
  // Ink-saving = no fills, greyscale strokes.
  card: '#ffffff',
  stripe: '#737373', // neutral-500
  stroke: '#404040', // neutral-700
  edge: '#a3a3a3', // neutral-400
} as const;

export function ModeThumbnail({ mode }: { mode: PrintMode }) {
  const t = STANDARD_FILLS;
  if (mode === 'standard') {
    return (
      <svg
        viewBox="0 0 60 40"
        role="img"
        aria-label="Standard print preview"
        className="h-8 w-12 shrink-0 rounded-sm border border-neutral-200 dark:border-neutral-700"
      >
        <title>Standard print preview</title>
        <rect width="60" height="40" fill="#ffffff" />
        <rect x="6" y="6" width="20" height="10" rx="1.5" fill={t.cardA} stroke={t.cardStroke} />
        <rect x="6" y="6" width="2" height="10" fill={t.stripeA} />
        <rect x="34" y="6" width="20" height="10" rx="1.5" fill={t.cardB} stroke={t.cardStroke} />
        <rect x="34" y="6" width="2" height="10" fill={t.stripeB} />
        <rect x="20" y="22" width="20" height="10" rx="1.5" fill={t.cardC} stroke={t.cardStroke} />
        <rect x="20" y="22" width="2" height="10" fill={t.stripeC} />
        <line x1="16" y1="16" x2="30" y2="22" stroke={t.edge} strokeWidth="1" />
        <line x1="44" y1="16" x2="30" y2="22" stroke={t.edge} strokeWidth="1" />
      </svg>
    );
  }
  if (mode === 'workshop') {
    const w = WORKSHOP_FILLS;
    return (
      <svg
        viewBox="0 0 60 40"
        role="img"
        aria-label="Workshop print preview"
        className="h-8 w-12 shrink-0 rounded-sm border border-neutral-200 dark:border-neutral-700"
      >
        <title>Workshop print preview</title>
        <rect width="60" height="40" fill="#ffffff" />
        {/* Larger high-contrast cards with bolder strokes */}
        <rect
          x="4"
          y="6"
          width="22"
          height="12"
          rx="1.5"
          fill={w.cardA}
          stroke={w.stroke}
          strokeWidth="1.2"
        />
        <rect x="4" y="6" width="3" height="12" fill={w.stroke} />
        <rect
          x="34"
          y="6"
          width="22"
          height="12"
          rx="1.5"
          fill={w.cardB}
          stroke={w.stroke}
          strokeWidth="1.2"
        />
        <rect x="34" y="6" width="3" height="12" fill={w.stroke} />
        <rect
          x="19"
          y="22"
          width="22"
          height="12"
          rx="1.5"
          fill={w.cardC}
          stroke={w.stroke}
          strokeWidth="1.2"
        />
        <rect x="19" y="22" width="3" height="12" fill={w.stroke} />
        <line x1="15" y1="18" x2="30" y2="22" stroke={w.edge} strokeWidth="1.2" />
        <line x1="45" y1="18" x2="30" y2="22" stroke={w.edge} strokeWidth="1.2" />
      </svg>
    );
  }
  // ink-saving — greyscale, no fills, thinner edges
  const i = INKSAVING_FILLS;
  return (
    <svg
      viewBox="0 0 60 40"
      role="img"
      aria-label="Ink-saving print preview"
      className="h-8 w-12 shrink-0 rounded-sm border border-neutral-200 dark:border-neutral-700"
    >
      <title>Ink-saving print preview</title>
      <rect width="60" height="40" fill="#ffffff" />
      <rect
        x="6"
        y="6"
        width="20"
        height="10"
        rx="1.5"
        fill={i.card}
        stroke={i.stroke}
        strokeWidth="0.6"
      />
      <rect x="6" y="6" width="2" height="10" fill={i.stripe} />
      <rect
        x="34"
        y="6"
        width="20"
        height="10"
        rx="1.5"
        fill={i.card}
        stroke={i.stroke}
        strokeWidth="0.6"
      />
      <rect x="34" y="6" width="2" height="10" fill={i.stripe} />
      <rect
        x="20"
        y="22"
        width="20"
        height="10"
        rx="1.5"
        fill={i.card}
        stroke={i.stroke}
        strokeWidth="0.6"
      />
      <rect x="20" y="22" width="2" height="10" fill={i.stripe} />
      <line x1="16" y1="16" x2="30" y2="22" stroke={i.edge} strokeWidth="0.5" />
      <line x1="44" y1="16" x2="30" y2="22" stroke={i.edge} strokeWidth="0.5" />
    </svg>
  );
}
