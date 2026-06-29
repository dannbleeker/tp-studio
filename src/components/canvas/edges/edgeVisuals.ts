import { ACCENT, type EdgePaletteTokens } from '@/domain/tokens';

/** Mutex edges paint red regardless of AND/selection — the red is the
 *  *semantic* signal ("these two Wants conflict") and dominates the diagram's
 *  colour vocabulary on the rare edges that carry it. */
const MUTEX_STROKE = '#dc2626';
/** Splice-target indigo (the "release lands on this edge" cue) — the same hue
 *  family as the app accent, so it introduces no new colour. */
const SPLICE_TARGET_STROKE = ACCENT;
/** A TOC back-edge (feedback-loop closer) paints a distinct amber-orange so the
 *  loop stands apart from the grey causal edges and the junctor purple. Hardcoded
 *  (palette-independent) like the mutex red — the colour is the semantic signal. */
const BACK_EDGE_STROKE = '#ea580c';

/** The boolean edge states that drive its stroke / width / dash / glow, in the
 *  priority order {@link resolveEdgeVisuals} applies them. */
export type EdgeStyleFlags = {
  /** A connection-drag or splice "drop here" target — wins the colour + glow. */
  readonly isDropTarget: boolean;
  /** A bidirectional EC conflict (D ↔ D′). */
  readonly isMutex: boolean;
  readonly selected: boolean;
  /** Belongs to an AND/OR/XOR junctor group. */
  readonly isJunctorGroup: boolean;
  /** A TOC-reading back-edge (loop closer). */
  readonly isBackEdge: boolean;
  /** Touches a note entity (ancillary annotation). */
  readonly isNoteEdge: boolean;
  /** Hovered with no stronger state owning the visual. */
  readonly isHoverActive: boolean;
};

export type EdgeVisualStyle = {
  readonly stroke: string;
  readonly strokeWidth: number;
  readonly strokeDasharray: string | undefined;
  readonly filter: string | undefined;
};

/**
 * Resolve an edge's stroke colour, width, dash pattern, and glow filter from
 * its boolean state + the active edge palette. Pulled out of TPEdge's render so
 * the priority order lives in one declarative, testable place (no React), and a
 * new edge style is a single case here rather than five entangled conditional
 * chains in the component. Behaviour identical to the inlined version.
 *
 * Priority: drop-target → mutex → selected → back-edge → junctor → default.
 */
export const resolveEdgeVisuals = (
  flags: EdgeStyleFlags,
  palette: EdgePaletteTokens
): EdgeVisualStyle => {
  const { isDropTarget, isMutex, selected, isJunctorGroup, isBackEdge, isNoteEdge, isHoverActive } =
    flags;

  const stroke = isDropTarget
    ? SPLICE_TARGET_STROKE
    : isMutex
      ? MUTEX_STROKE
      : selected
        ? palette.strokeSelected
        : isBackEdge
          ? BACK_EDGE_STROKE
          : isJunctorGroup
            ? palette.strokeAnd
            : palette.stroke;

  // Selected 3 · junctor 1.75 · note 1.25 · default 1.5; back-edge / drop-target
  // add +1.5, an active hover adds +1 (selection feedback wins over both).
  const baseWidth = selected ? 3 : isJunctorGroup ? 1.75 : isNoteEdge ? 1.25 : 1.5;
  const strokeWidth =
    isBackEdge || isDropTarget ? baseWidth + 1.5 : isHoverActive ? baseWidth + 1 : baseWidth;

  // Back-edge dashed ("6 4"), note-edge dotted ("2 3"); back-edge wins if both.
  const strokeDasharray = isBackEdge ? '6 4' : isNoteEdge ? '2 3' : undefined;

  // Drop-target glow wins over selected (the drag is the time-sensitive signal).
  const filter = isDropTarget
    ? `drop-shadow(0 0 6px ${SPLICE_TARGET_STROKE}88)`
    : selected
      ? `drop-shadow(0 0 5px ${palette.strokeSelected}aa)`
      : isHoverActive
        ? 'drop-shadow(0 0 3px #73737366)'
        : undefined;

  return { stroke, strokeWidth, strokeDasharray, filter };
};
