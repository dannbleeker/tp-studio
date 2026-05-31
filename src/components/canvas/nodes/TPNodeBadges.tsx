import clsx from 'clsx';
import { MessageSquare, Pin } from 'lucide-react';
import { memo } from 'react';
import type { EligibilityStatus } from '@/domain/actionEligibility';
import { LAYOUT_STRATEGY } from '@/domain/layoutStrategy';
import type { DiagramType, Entity, EntityState, SpanOfControl } from '@/domain/types';
import { guardWriteOrToast } from '@/services/browseLock';

/**
 * Session 135 — extracted from `TPNode.tsx`. The corner badges
 * (annotation number, step number, pin, reach forward / reverse,
 * collapsed-descendants expand button) plus the inline Locus pill
 * are self-contained: each takes a small set of props and returns
 * either a JSX element or `null`. Pulling them out shrinks TPNode
 * by ~120 lines and lets the badge layer evolve without dragging
 * the everyday-card render code through git blame.
 *
 * Each helper is a tiny pure render — no state, no store access
 * (the parent supplies the props), so they slot in identically to
 * how they were inlined before. Render placement (corner anchoring
 * via `absolute -top-1.5 -right-1.5` etc.) is preserved verbatim.
 *
 * Session 135 / Perf #5 — each badge is wrapped in `memo`. They only
 * render when `TPNode` (their memoized parent) re-renders; once it
 * does, a badge whose own props are unchanged (the common case — e.g.
 * a title edit doesn't touch the annotation number) skips its own
 * re-render. Cheap insurance: the props are all primitives, so the
 * default shallow comparison is exactly right.
 */

/**
 * TOC-reading inline pill — `C / I / E` after the entity-type label.
 * The colour encodes the level: emerald for control (act-on-it),
 * amber for influence (affect-it), neutral for external
 * (observe-only). Unset entities render nothing.
 */
export const LocusPill = memo(function LocusPill({
  spanOfControl,
}: {
  spanOfControl: SpanOfControl | undefined;
}) {
  if (spanOfControl === 'control') {
    return (
      <span
        className="ml-1 rounded-sm bg-emerald-100 px-1 font-bold text-[9px] text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-200"
        title="Locus: I can act on this directly"
        role="img"
        aria-label="Locus: control"
      >
        C
      </span>
    );
  }
  if (spanOfControl === 'influence') {
    return (
      <span
        className="ml-1 rounded-sm bg-amber-100 px-1 font-bold text-[9px] text-amber-800 dark:bg-amber-900/50 dark:text-amber-200"
        title="Locus: I can influence this indirectly"
        role="img"
        aria-label="Locus: influence"
      >
        I
      </span>
    );
  }
  if (spanOfControl === 'external') {
    return (
      <span
        className="ml-1 rounded-sm bg-neutral-200 px-1 font-bold text-[9px] text-neutral-700 dark:bg-neutral-700 dark:text-neutral-200"
        title="Locus: external — outside my control"
        role="img"
        aria-label="Locus: external"
      >
        E
      </span>
    );
  }
  return null;
});

/**
 * Annotation number badge — top-right corner. Persistent per-doc
 * integer assigned at entity creation; used for `[link to #42]`
 * markdown cross-references in entity descriptions.
 */
export const AnnotationBadge = memo(function AnnotationBadge({
  annotationNumber,
}: {
  annotationNumber: number;
}) {
  return (
    <span
      className="pointer-events-none absolute -top-1.5 -right-1.5 rounded-full border border-neutral-200 bg-white px-1.5 py-0.5 font-semibold text-[10px] text-neutral-600 shadow-xs dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-300"
      role="img"
      aria-label={`Annotation number ${annotationNumber}`}
    >
      #{annotationNumber}
    </span>
  );
});

/**
 * Step number badge — top-left corner. Surfaces only on entities
 * carrying `entity.ordering` (TT actions today; generic for any
 * future ordered entity).
 */
export const StepBadge = memo(function StepBadge({ ordering }: { ordering: number }) {
  return (
    <span
      className="pointer-events-none absolute -top-1.5 -left-1.5 rounded-full border border-cyan-200 bg-cyan-50 px-1.5 py-0.5 font-semibold text-[10px] text-cyan-800 shadow-xs dark:border-cyan-900 dark:bg-cyan-950 dark:text-cyan-200"
      role="img"
      aria-label={`Step ${ordering}`}
    >
      Step {ordering}
    </span>
  );
});

/**
 * Pin indicator — bottom-right corner. Surfaces only on auto-layout
 * diagrams when this entity carries a stored `entity.position`
 * (set by drag). Manual-layout diagrams (EC) suppress because every
 * entity is pinned by definition there.
 */
export const PinBadge = memo(function PinBadge({ diagramType }: { diagramType: DiagramType }) {
  if (LAYOUT_STRATEGY[diagramType] === 'manual') return null;
  return (
    <span
      className="pointer-events-none absolute -right-1.5 -bottom-1.5 rounded-full border border-violet-300 bg-violet-50 p-0.5 text-violet-700 shadow-xs dark:border-violet-700 dark:bg-violet-950 dark:text-violet-200"
      role="img"
      aria-label="Pinned position"
      title="Pinned position — right-click → Unpin to let auto-layout reclaim it"
    >
      <Pin className="h-2.5 w-2.5" />
    </span>
  );
});

/**
 * Forward-reach badge — "this root cause reaches N UDEs." Bottom-left
 * corner. The higher the count, the stronger the Core Driver
 * candidate. Suppressed when count is 0 or undefined.
 */
export const ReachForwardBadge = memo(function ReachForwardBadge({ count }: { count: number }) {
  return (
    <span
      className="pointer-events-none absolute -bottom-2 -left-1.5 rounded-full border border-amber-300 bg-amber-50 px-1.5 py-0.5 font-semibold text-[10px] text-amber-800 shadow-xs dark:border-amber-700 dark:bg-amber-950 dark:text-amber-200"
      role="img"
      aria-label={`Reaches ${count} undesirable effect${count === 1 ? '' : 's'}`}
      title={`Reaches ${count} UDE${count === 1 ? '' : 's'}`}
    >
      →{count} UDE{count === 1 ? '' : 's'}
    </span>
  );
});

/**
 * Reverse-reach badge — "fed by N root causes." Bottom-right corner.
 * Sky-blue palette so it doesn't visually collide with the
 * amber forward-reach badge.
 */
export const ReachReverseBadge = memo(function ReachReverseBadge({ count }: { count: number }) {
  return (
    <span
      className="pointer-events-none absolute -right-1.5 -bottom-2 rounded-full border border-sky-300 bg-sky-50 px-1.5 py-0.5 font-semibold text-[10px] text-sky-800 shadow-xs dark:border-sky-700 dark:bg-sky-950 dark:text-sky-200"
      role="img"
      aria-label={`Fed by ${count} root cause${count === 1 ? '' : 's'}`}
      title={`Fed by ${count} root cause${count === 1 ? '' : 's'}`}
    >
      ←{count} root{count === 1 ? '' : 's'}
    </span>
  );
});

/**
 * Entity-state badge — left-centre edge (the only edge not used by
 * the four corner badges). Surfaces the effective state computed by
 * the propagation engine: green T (true), red F (false), amber ?
 * (disputed). `'unknown'` renders nothing — untagged diagrams stay
 * clean. When `speculated` is set, the value is a Phase 1C what-if
 * override (not committed) so the badge gets a dashed ring + an
 * "(speculative)" suffix in its label.
 */
const STATE_BADGE_META: Record<
  Exclude<EntityState, 'unknown'>,
  { glyph: string; label: string; cls: string }
> = {
  true: {
    glyph: 'T',
    label: 'true',
    cls: 'border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-700 dark:bg-emerald-950 dark:text-emerald-200',
  },
  false: {
    glyph: 'F',
    label: 'false',
    cls: 'border-red-400 bg-red-50 text-red-700 dark:border-red-700 dark:bg-red-950 dark:text-red-200',
  },
  disputed: {
    glyph: '?',
    label: 'disputed',
    cls: 'border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-200',
  },
};

export const StateBadge = memo(function StateBadge({
  state,
  speculated,
}: {
  state: EntityState;
  speculated?: boolean;
}) {
  if (state === 'unknown') return null;
  const meta = STATE_BADGE_META[state];
  const label = speculated ? `State: ${meta.label} (speculative)` : `State: ${meta.label}`;
  return (
    <span
      className={clsx(
        'pointer-events-none absolute top-1/2 -left-2 -translate-y-1/2 rounded-full border px-1.5 py-0.5 font-bold text-[10px] shadow-xs',
        meta.cls,
        speculated && 'border-dashed ring-2 ring-indigo-400/50'
      )}
      role="img"
      aria-label={label}
      title={label}
    >
      {meta.glyph}
    </span>
  );
});

/**
 * Action-eligibility badge — right-centre edge (mirrors the StateBadge
 * on the left). Surfaces the TT action-eligibility readout at a glance:
 * emerald ✓ (eligible — every precondition true), rose ✗ (blocked — a
 * precondition is false), amber … (pending — preconditions undecided).
 * Only rendered on Action nodes with a precondition slot, and only when
 * the `showActionEligibility` preference is on (so a fresh, state-less
 * TT — where everything reads "pending" — stays uncluttered). The full
 * readout always lives in the Entity Inspector.
 */
const ELIGIBILITY_BADGE_META: Record<
  Exclude<EligibilityStatus, 'na'>,
  { glyph: string; label: string; cls: string }
> = {
  eligible: {
    glyph: '✓',
    label: 'eligible — ready to fire',
    cls: 'border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-700 dark:bg-emerald-950 dark:text-emerald-200',
  },
  blocked: {
    glyph: '✗',
    label: 'blocked — a precondition is false',
    cls: 'border-red-400 bg-red-50 text-red-700 dark:border-red-700 dark:bg-red-950 dark:text-red-200',
  },
  pending: {
    glyph: '…',
    label: 'pending — preconditions undecided',
    cls: 'border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-200',
  },
};

export const EligibilityBadge = memo(function EligibilityBadge({
  status,
}: {
  status: Exclude<EligibilityStatus, 'na'>;
}) {
  const meta = ELIGIBILITY_BADGE_META[status];
  const label = `Action ${meta.label}`;
  return (
    <span
      className={clsx(
        'pointer-events-none absolute top-1/2 -right-2 -translate-y-1/2 rounded-full border px-1.5 py-0.5 font-bold text-[10px] shadow-xs',
        meta.cls
      )}
      role="img"
      aria-label={label}
      title={label}
    >
      {meta.glyph}
    </span>
  );
});

/**
 * Open-comment badge — top-left corner. Surfaces the count of OPEN
 * (unresolved) top-level review comments anchored to this entity, and
 * opens the Comments panel on click. Interactive (unlike the pure-render
 * corner badges), so `pointer-events` stay on; `stopPropagation` keeps the
 * click from also toggling node selection. Only the rare TT-action step
 * badge shares this corner — comments-on-a-numbered-action is an edge case.
 */
export const CommentCountBadge = memo(function CommentCountBadge({
  count,
  onOpen,
}: {
  count: number;
  onOpen: () => void;
}) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onOpen();
      }}
      className="absolute -top-1.5 -left-1.5 flex items-center gap-0.5 rounded-full border border-indigo-300 bg-indigo-50 px-1.5 py-0.5 font-semibold text-[10px] text-indigo-700 shadow-xs transition hover:bg-indigo-100 dark:border-indigo-700 dark:bg-indigo-950 dark:text-indigo-200 dark:hover:bg-indigo-900"
      aria-label={`${count} open comment${count === 1 ? '' : 's'} — open the Comments panel`}
      title={`${count} open comment${count === 1 ? '' : 's'} — click to review`}
    >
      <MessageSquare className="h-2.5 w-2.5" aria-hidden />
      {count}
    </button>
  );
});

/**
 * Collapsed-downstream chip — bottom-centre. Click expands the
 * hidden descendants. Shown only when the entity is currently
 * collapsed (`entity.collapsed === true`).
 */
export const CollapsedExpandButton = memo(function CollapsedExpandButton({
  entity,
  hiddenDescendantCount,
  onToggle,
}: {
  entity: Entity;
  hiddenDescendantCount: number | undefined;
  onToggle: (id: string) => void;
}) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        if (!guardWriteOrToast()) return;
        onToggle(entity.id);
      }}
      className="absolute -bottom-2 left-1/2 flex -translate-x-1/2 items-center gap-1 rounded-full border border-neutral-200 bg-white px-2 py-0.5 font-medium text-[10px] text-neutral-600 shadow-xs transition hover:bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-300 dark:hover:bg-neutral-800"
      aria-label={
        hiddenDescendantCount
          ? `Expand ${hiddenDescendantCount} hidden descendant${hiddenDescendantCount === 1 ? '' : 's'}`
          : 'Expand downstream'
      }
      title={
        hiddenDescendantCount ? `Expand (${hiddenDescendantCount} hidden)` : 'Expand downstream'
      }
    >
      <span aria-hidden>▸</span>
      {hiddenDescendantCount ? <span>+{hiddenDescendantCount}</span> : null}
    </button>
  );
});
