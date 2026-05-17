import { NODE_MIN_HEIGHT, NODE_WIDTH, ST_NODE_HEIGHT, ZOOM_UP_THRESHOLD } from '@/domain/constants';
import { resolveEntityTypeMeta } from '@/domain/entityTypeMeta';
import { ST_FACET_KEYS, isStNodeFormat } from '@/domain/graph';
import { HANDLE_ORIENTATION, LAYOUT_STRATEGY } from '@/domain/layoutStrategy';
import { useZoomLevel } from '@/hooks/useZoomLevel';
import { guardWriteOrToast } from '@/services/browseLock';
import { useDocumentStore } from '@/store';
import { Handle, type NodeProps, NodeToolbar, Position } from '@xyflow/react';
import clsx from 'clsx';
import { Pin } from 'lucide-react';
import { memo, useEffect, useRef, useState } from 'react';
import { useShallow } from 'zustand/shallow';
import type { TPNode as TPNodeType } from './flow-types';

// B5 — zoom-up annotation threshold lives in `@/domain/constants` so UI/UX
// tweaks happen in one place alongside the other canvas tunables.

function TPNodeImpl({ data, selected }: NodeProps<TPNodeType>) {
  const { entity, hiddenDescendantCount, udeReachCount, rootCauseReachCount, diffStatus } = data;
  // One shallow-equal selector — the previous 7 individual `useDocumentStore`
  // calls each registered their own subscription that fired on every store
  // change. The `editingEntityId === entity.id` derived boolean stays
  // primitive, so React only re-renders when it actually flips.
  const {
    isEditing,
    updateEntity,
    endEditing,
    beginEditing,
    toggleEntityCollapsed,
    showAnnotationNumbers,
    showEntityIds,
    showReachBadges,
    showReverseReachBadges,
    diagramType,
    customEntityClasses,
  } = useDocumentStore(
    useShallow((s) => ({
      isEditing: s.editingEntityId === entity.id,
      updateEntity: s.updateEntity,
      endEditing: s.endEditing,
      beginEditing: s.beginEditing,
      toggleEntityCollapsed: s.toggleEntityCollapsed,
      showAnnotationNumbers: s.showAnnotationNumbers,
      showEntityIds: s.showEntityIds,
      showReachBadges: s.showReachBadges,
      showReverseReachBadges: s.showReverseReachBadges,
      diagramType: s.doc.diagramType,
      customEntityClasses: s.doc.customEntityClasses,
    }))
  );
  // B10 — resolve through the doc-aware lookup so custom entity
  // classes pick up their label / colour / icon. Built-ins resolve
  // identically to the previous direct `ENTITY_TYPE_META[type]` lookup.
  const meta = resolveEntityTypeMeta(entity.type, customEntityClasses);
  // FL-ET7: Notes sit outside the causal graph. We hide the React Flow
  // handles so the user can't drag a connection into / out of a note,
  // and we tint the body yellow so the card reads as a sticky annotation
  // rather than a TOC-typed entity.
  const isNoteEntity = entity.type === 'note';
  // Session 76: first-class S&T 5-facet rendering. An injection with
  // any of the four reserved facet attributes renders as a multi-row
  // card; everything else uses the standard one-line layout.
  const isStFormat = isStNodeFormat(entity);
  const stStrategy = entity.attributes?.[ST_FACET_KEYS.strategy];
  const stNa = entity.attributes?.[ST_FACET_KEYS.necessaryAssumption];
  const stPa = entity.attributes?.[ST_FACET_KEYS.parallelAssumption];
  const stSa = entity.attributes?.[ST_FACET_KEYS.sufficiencyAssumption];
  const stStrategyText = stStrategy?.kind === 'string' ? stStrategy.value : undefined;
  const stNaText = stNa?.kind === 'string' ? stNa.value : undefined;
  const stPaText = stPa?.kind === 'string' ? stPa.value : undefined;
  const stSaText = stSa?.kind === 'string' ? stSa.value : undefined;
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const isCollapsed = entity.collapsed === true;

  // B5: hover state + live zoom. When the user is zoomed out far enough
  // that the in-node title is hard to read, hovering or selecting the
  // node surfaces a larger overlay card. We only subscribe to zoom here
  // (one subscription per visible node) because the overlay's mount /
  // unmount is the only thing that depends on zoom — the node body itself
  // doesn't care.
  const [isHovered, setIsHovered] = useState(false);
  const zoom = useZoomLevel();
  const showZoomUp = zoom < ZOOM_UP_THRESHOLD && (selected || isHovered);
  // Handle orientation is per-diagram-type — vertical for the auto-layout
  // trees (edges flow up via `BT` dagre), horizontal for Evaporating Cloud
  // (edges flow right-to-left across the hand-positioned 5-box layout).
  const isHorizontal = HANDLE_ORIENTATION[diagramType] === 'horizontal';
  const targetPosition = isHorizontal ? Position.Right : Position.Bottom;
  const sourcePosition = isHorizontal ? Position.Left : Position.Top;

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  return (
    <div
      data-component="tp-node"
      className={clsx(
        'group relative flex items-stretch rounded-lg shadow-sm',
        'border',
        // FL-ET7: post-it tint for note entities; subtler card chrome for
        // everything else so a Note reads as annotation, not causality.
        isNoteEntity
          ? 'border-yellow-300 bg-yellow-50 dark:border-yellow-700/50 dark:bg-yellow-950/30'
          : 'border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900',
        selected && 'ring-2 ring-indigo-500/60 ring-offset-1',
        // H2 visual-diff tints. `'added'` greens the card so the user can
        // scan for "what's new since the snapshot." `'changed'` ambers
        // entities whose content drifted. Removed entities (only in the
        // snapshot, not the live doc) are handled by a separate "ghost"
        // overlay surfaced in the compare banner.
        diffStatus === 'added' &&
          'ring-2 ring-emerald-400/70 ring-offset-1 dark:ring-emerald-500/70',
        diffStatus === 'changed' && 'ring-2 ring-amber-400/70 ring-offset-1 dark:ring-amber-500/70'
      )}
      style={{ width: NODE_WIDTH, minHeight: isStFormat ? ST_NODE_HEIGHT : NODE_MIN_HEIGHT }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onDoubleClick={(e) => {
        e.stopPropagation();
        if (isEditing) return;
        if (!guardWriteOrToast()) return;
        beginEditing(entity.id);
      }}
      // FL-AN1: full multi-line title shown as a native tooltip on hover.
      // Browsers handle newlines inside the title attribute themselves.
      title={!isEditing && entity.title ? entity.title : undefined}
    >
      {/*
        B5: zoom-up overlay. `NodeToolbar` renders in screen coordinates
        regardless of canvas zoom, so the card stays readable when the
        underlying node body has shrunk past legibility. We show it only
        when (zoom is low) AND (the user is interacting with this node) —
        always-on at low zoom would clutter the canvas.
      */}
      <NodeToolbar
        isVisible={showZoomUp && !isEditing}
        position={Position.Top}
        offset={12}
        className="pointer-events-none"
      >
        <div
          data-component="zoom-up-card"
          className="pointer-events-auto max-w-sm rounded-lg border border-neutral-200 bg-white/95 px-3 py-2 shadow-lg backdrop-blur dark:border-neutral-800 dark:bg-neutral-900/95"
        >
          {/* Session 87 (V4) — entity-type label bumped from
              text-[10px] tracking-wide to text-[11px] tracking-
              [0.06em]. At default Fit View zoom the previous size was
              ~6 px on screen and hard to scan; the bump improves
              legibility without changing layout. */}
          <span className="flex items-center gap-1 font-medium text-[11px] text-neutral-500 uppercase tracking-[0.06em] dark:text-neutral-400">
            <meta.icon
              className="h-3 w-3 shrink-0"
              style={{ color: meta.stripeColor }}
              aria-hidden
            />
            <span>{meta.label}</span>
          </span>
          <p className="mt-0.5 whitespace-pre-line font-medium text-neutral-900 text-sm dark:text-neutral-100">
            {entity.title || <span className="text-neutral-400 italic">Untitled entity</span>}
          </p>
          {entity.description && (
            <p className="mt-1 line-clamp-4 whitespace-pre-line text-neutral-600 text-xs dark:text-neutral-300">
              {entity.description}
            </p>
          )}
        </div>
      </NodeToolbar>
      {!isNoteEntity && (
        <Handle
          type="target"
          position={targetPosition}
          className="!h-2 !w-2 !border-neutral-300 !bg-white dark:!border-neutral-700 dark:!bg-neutral-900"
        />
      )}
      <div
        className="w-1.5 shrink-0 rounded-l-lg"
        style={{ backgroundColor: meta.stripeColor }}
        aria-hidden
      />
      <div className="flex flex-1 flex-col gap-1 px-3 py-2.5">
        {/* Session 87 (V4) — see comment on the zoom-up card variant
            above; same legibility bump for the main card label. */}
        <span className="flex items-center gap-1 font-medium text-[11px] text-neutral-500 uppercase tracking-[0.06em] dark:text-neutral-400">
          {/* B3: per-type icon. Stripe colour duplicated on the icon so the
              two visual cues read together rather than competing. `aria-hidden`
              because the label text already announces the type. */}
          <meta.icon className="h-3 w-3 shrink-0" style={{ color: meta.stripeColor }} aria-hidden />
          <span>{meta.label}</span>
          {/*
            Span-of-control (TOC-reading): single-letter pill after the
            type label. Color encodes the level: emerald for control
            (act-on-it), amber for influence (affect-it), neutral for
            external (observe-only). Unset entities show nothing.
          */}
          {entity.spanOfControl === 'control' && (
            <span
              className="ml-1 rounded bg-emerald-100 px-1 font-bold text-[9px] text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-200"
              title="Span of control: I can act on this directly"
              aria-label="Span of control: control"
            >
              C
            </span>
          )}
          {entity.spanOfControl === 'influence' && (
            <span
              className="ml-1 rounded bg-amber-100 px-1 font-bold text-[9px] text-amber-800 dark:bg-amber-900/50 dark:text-amber-200"
              title="Span of control: I can influence this indirectly"
              aria-label="Span of control: influence"
            >
              I
            </span>
          )}
          {entity.spanOfControl === 'external' && (
            <span
              className="ml-1 rounded bg-neutral-200 px-1 font-bold text-[9px] text-neutral-700 dark:bg-neutral-700 dark:text-neutral-200"
              title="Span of control: external — outside my control"
              aria-label="Span of control: external"
            >
              E
            </span>
          )}
        </span>
        {isEditing ? (
          <textarea
            ref={inputRef}
            className="resize-none border-none bg-transparent p-0 text-neutral-900 text-node leading-snug outline-none placeholder:text-neutral-400 dark:text-neutral-100"
            rows={2}
            defaultValue={entity.title}
            placeholder={isNoteEntity ? 'Type a note…' : 'State the effect…'}
            onBlur={(e) => {
              const next = e.currentTarget.value.trim();
              if (next !== entity.title) updateEntity(entity.id, { title: next });
              endEditing();
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && e.altKey) {
                // FL-AN1: Alt+Enter inserts a newline at the caret. Default
                // textarea behavior would do this for plain Enter, but we
                // commit on plain Enter — so wire it up explicitly.
                e.preventDefault();
                const t = e.currentTarget;
                const { selectionStart, selectionEnd, value } = t;
                const next = `${value.slice(0, selectionStart)}\n${value.slice(selectionEnd)}`;
                t.value = next;
                const caret = selectionStart + 1;
                t.setSelectionRange(caret, caret);
              } else if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                e.currentTarget.blur();
              } else if (e.key === 'Escape') {
                e.preventDefault();
                endEditing();
              }
              e.stopPropagation();
            }}
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <span
            className={clsx(
              'line-clamp-2 whitespace-pre-line text-neutral-900 leading-snug dark:text-neutral-100',
              // F3: per-entity title size. Default ('md') falls back to the
              // app-wide `text-node` token; sm/lg shrink or grow from there.
              entity.titleSize === 'sm' && 'text-xs',
              entity.titleSize === 'lg' && 'text-base',
              (!entity.titleSize || entity.titleSize === 'md') && 'text-node'
            )}
          >
            {entity.unspecified === true && (
              // Deliberate placeholder — render a help-circle glyph + italic
              // hint so the slot reads "yes, something belongs here, the
              // user just hasn't said what yet."
              <span className="mr-1 inline-flex items-baseline gap-1 text-neutral-500 italic dark:text-neutral-400">
                <span aria-hidden>?</span>
                {!entity.title && <span>Unspecified — fill in later</span>}
              </span>
            )}
            {entity.title ||
              (entity.unspecified === true ? null : (
                <span className="text-neutral-400 italic">Untitled — double-click to edit</span>
              ))}
          </span>
        )}
        {/*
          Session 76: first-class S&T 5-facet rows. The entity title (= the
          tactic) renders above; below it we lay out the four other facets
          as labeled rows. Each row truncates to one line so the card's
          height stays predictable for dagre. Empty facets render an
          italic placeholder so the user sees the structural slot.
        */}
        {isStFormat && !isEditing && (
          <div className="mt-1 flex flex-col gap-0.5 text-[10px] text-neutral-700 leading-tight dark:text-neutral-300">
            <StFacetRow
              entityId={entity.id}
              attrKey={ST_FACET_KEYS.necessaryAssumption}
              label="NA"
              value={stNaText}
            />
            <StFacetRow
              entityId={entity.id}
              attrKey={ST_FACET_KEYS.strategy}
              label="Strategy"
              value={stStrategyText}
              accent
            />
            <StFacetRow
              entityId={entity.id}
              attrKey={ST_FACET_KEYS.parallelAssumption}
              label="PA"
              value={stPaText}
            />
            <StFacetRow
              entityId={entity.id}
              attrKey={ST_FACET_KEYS.sufficiencyAssumption}
              label="SA"
              value={stSaText}
            />
          </div>
        )}
        {showEntityIds && !isEditing && (
          <span
            className="truncate font-mono text-[10px] text-neutral-400 dark:text-neutral-500"
            title={entity.id}
          >
            {entity.id}
          </span>
        )}
      </div>
      {showAnnotationNumbers && (
        <span
          className="-right-1.5 -top-1.5 pointer-events-none absolute rounded-full border border-neutral-200 bg-white px-1.5 py-0.5 font-semibold text-[10px] text-neutral-600 shadow-sm dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-300"
          aria-label={`Annotation number ${entity.annotationNumber}`}
        >
          #{entity.annotationNumber}
        </span>
      )}
      {typeof entity.ordering === 'number' && (
        <span
          className="-left-1.5 -top-1.5 pointer-events-none absolute rounded-full border border-cyan-200 bg-cyan-50 px-1.5 py-0.5 font-semibold text-[10px] text-cyan-800 shadow-sm dark:border-cyan-900 dark:bg-cyan-950 dark:text-cyan-200"
          aria-label={`Step ${entity.ordering}`}
        >
          Step {entity.ordering}
        </span>
      )}
      {/*
        LA5 (Session 63): pin indicator. Surfaces only on auto-layout
        diagrams when this entity has been pinned by a drag — manual-
        layout diagrams (EC) always read entity.position, so the icon
        there would be meaningless ("they're all pinned, all the time").
        Position: bottom-right corner, distinct from the bottom-left
        reach badge and the top-corner ordering / annotation badges.
      */}
      {entity.position && LAYOUT_STRATEGY[diagramType] !== 'manual' && (
        <span
          className="-right-1.5 -bottom-1.5 pointer-events-none absolute rounded-full border border-violet-300 bg-violet-50 p-0.5 text-violet-700 shadow-sm dark:border-violet-700 dark:bg-violet-950 dark:text-violet-200"
          aria-label="Pinned position"
          title="Pinned position — right-click → Unpin to let auto-layout reclaim it"
        >
          <Pin className="h-2.5 w-2.5" />
        </span>
      )}
      {showReachBadges && typeof udeReachCount === 'number' && udeReachCount > 0 && (
        // Cheap continuous version of the Core Driver finder — the higher
        // this number on a root cause, the stronger the Core Driver
        // candidate. Rendered bottom-left so it doesn't collide with the
        // top-left step badge or the top-right annotation/ID stack.
        <span
          className="-bottom-2 -left-1.5 pointer-events-none absolute rounded-full border border-amber-300 bg-amber-50 px-1.5 py-0.5 font-semibold text-[10px] text-amber-800 shadow-sm dark:border-amber-700 dark:bg-amber-950 dark:text-amber-200"
          aria-label={`Reaches ${udeReachCount} undesirable effect${udeReachCount === 1 ? '' : 's'}`}
          title={`Reaches ${udeReachCount} UDE${udeReachCount === 1 ? '' : 's'}`}
        >
          →{udeReachCount} UDE{udeReachCount === 1 ? '' : 's'}
        </span>
      )}
      {showReverseReachBadges &&
        typeof rootCauseReachCount === 'number' &&
        rootCauseReachCount > 0 && (
          // E2: reverse-reach badge. Sky-blue palette so the two
          // counters don't collide visually — amber for "→N UDEs"
          // forward, sky for "←N roots" backward. Bottom-right so it
          // doesn't fight the forward badge for screen real estate.
          <span
            className="-bottom-2 -right-1.5 pointer-events-none absolute rounded-full border border-sky-300 bg-sky-50 px-1.5 py-0.5 font-semibold text-[10px] text-sky-800 shadow-sm dark:border-sky-700 dark:bg-sky-950 dark:text-sky-200"
            aria-label={`Fed by ${rootCauseReachCount} root cause${rootCauseReachCount === 1 ? '' : 's'}`}
            title={`Fed by ${rootCauseReachCount} root cause${rootCauseReachCount === 1 ? '' : 's'}`}
          >
            ←{rootCauseReachCount} root{rootCauseReachCount === 1 ? '' : 's'}
          </span>
        )}
      {isCollapsed && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            if (!guardWriteOrToast()) return;
            toggleEntityCollapsed(entity.id);
          }}
          className="-bottom-2 -translate-x-1/2 absolute left-1/2 flex items-center gap-1 rounded-full border border-neutral-200 bg-white px-2 py-0.5 font-medium text-[10px] text-neutral-600 shadow-sm transition hover:bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-300 dark:hover:bg-neutral-800"
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
      )}
      {!isNoteEntity && (
        <Handle
          type="source"
          position={sourcePosition}
          className="!h-2 !w-2 !border-neutral-300 !bg-white dark:!border-neutral-700 dark:!bg-neutral-900"
        />
      )}
    </div>
  );
}

/**
 * Session 76 — one row of the first-class S&T 5-facet card. Renders the
 * facet's label (uppercased, small caps) above its value. `accent`
 * highlights the Strategy row (the parent objective the tactic serves)
 * so it stands out from the three assumption rows.
 *
 * Session 81 — inline edit. Double-click the row's value to swap it for
 * a small textarea; Enter / blur commits to `setEntityAttribute`; Esc
 * cancels. Empty input clears the facet entirely (via `clearEntityAttribute`).
 * Browse Lock blocks the edit entry — same guard as the title.
 */
function StFacetRow({
  entityId,
  attrKey,
  label,
  value,
  accent,
}: {
  entityId: string;
  attrKey: string;
  label: string;
  value: string | undefined;
  accent?: boolean;
}) {
  const setEntityAttribute = useDocumentStore((s) => s.setEntityAttribute);
  const removeEntityAttribute = useDocumentStore((s) => s.removeEntityAttribute);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value ?? '');
  const taRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    if (editing) {
      // Sync the draft to the latest stored value when the user enters
      // edit mode, then focus + select for fast overwrite. Tab/Enter
      // commits; Esc cancels.
      setDraft(value ?? '');
      taRef.current?.focus();
      taRef.current?.select();
    }
  }, [editing, value]);

  const commit = (): void => {
    const next = draft.trim();
    if (next === (value ?? '').trim()) {
      // No-op — short-circuit so the store doesn't fire an undo entry.
      setEditing(false);
      return;
    }
    if (next.length === 0) {
      removeEntityAttribute(entityId, attrKey);
    } else {
      setEntityAttribute(entityId, attrKey, { kind: 'string', value: next });
    }
    setEditing(false);
  };

  const cancel = (): void => {
    setDraft(value ?? '');
    setEditing(false);
  };

  return (
    <div className="flex items-baseline gap-1">
      <span
        className={clsx(
          'shrink-0 font-semibold uppercase tracking-wide',
          accent ? 'text-indigo-700 dark:text-indigo-300' : 'text-neutral-500 dark:text-neutral-400'
        )}
        style={{ width: 48 }}
      >
        {label}
      </span>
      {editing ? (
        <textarea
          ref={taRef}
          value={draft}
          rows={1}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onClick={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
          onKeyDown={(e) => {
            e.stopPropagation();
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              commit();
            } else if (e.key === 'Escape') {
              e.preventDefault();
              cancel();
            }
          }}
          aria-label={`Edit ${label} facet`}
          className="flex-1 resize-none rounded border border-indigo-300 bg-white px-1 py-0 text-[10px] text-neutral-900 leading-tight outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-400 dark:border-indigo-700 dark:bg-neutral-950 dark:text-neutral-100"
        />
      ) : (
        <button
          type="button"
          // Double-click matches the title's edit gesture. Click alone
          // would conflict with React Flow's drag/select handling, and
          // single-click-to-edit would surprise users navigating around
          // the canvas.
          onDoubleClick={(e) => {
            e.stopPropagation();
            if (!guardWriteOrToast()) return;
            setEditing(true);
          }}
          aria-label={`Edit ${label} facet (double-click)`}
          className={clsx(
            'flex-1 cursor-text truncate rounded px-0.5 text-left transition hover:bg-indigo-50 dark:hover:bg-indigo-950/30',
            value ? '' : 'text-neutral-400 italic dark:text-neutral-500'
          )}
          title={value ? `${value} — double-click to edit` : 'Double-click to set'}
        >
          {value || '(unset)'}
        </button>
      )}
    </div>
  );
}

/**
 * Session 105 / Tier 1 #6 — custom comparator for `React.memo`.
 *
 * The default shallow-equal compared NodeProps as a whole, including
 * `data`. But `useGraphNodeEmission` rebuilds the `data` object on
 * every emission run (line ~118 of that file: `data: { entity,
 * ...hidden, ...reach, ...diffStatus }` is a fresh literal). The
 * default memo's referential compare on `data` therefore failed for
 * every node on every emission, defeating the purpose.
 *
 * This custom comparator shallow-compares the *contents* of `data`
 * (and a small set of other React Flow props), letting the memo bail
 * when the entity reference, the optional badge counts, and the
 * compare-diff status are all unchanged.
 *
 * Trade-off: shallow comparing 5 fields costs ~5 strict-equality
 * checks; about the same as the default compare and an order of
 * magnitude cheaper than re-rendering the node.
 */
// Session 113 — memo comparator + `shallowEqualNodeData` extracted to
// `./tpNodeComparator.ts` (parallel to the same-session extraction in
// TPEdge.tsx). Pure functions; easier to unit-test in isolation; the
// component file stays focused on render. Re-exported here so existing
// test imports (`import { tpNodePropsEqual } from '@/components/canvas/TPNode'`)
// keep working unchanged.
import { shallowEqualNodeData, tpNodePropsEqual } from './tpNodeComparator';
export { shallowEqualNodeData, tpNodePropsEqual };

export const TPNode = memo(TPNodeImpl, tpNodePropsEqual);
TPNode.displayName = 'TPNode';
