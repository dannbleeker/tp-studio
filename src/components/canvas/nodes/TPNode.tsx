// Session 119 — note on React Compiler interaction:
// `TPNodeImpl` is wrapped in `memo(impl, tpNodePropsEqual)` (see the
// bottom of this file). The custom comparator from Session 105 does
// shallow-equality on `data`'s enumerable keys rather than referential
// equality (which would always fail because `data` is rebuilt by
// spread every emission run).
//
// The Compiler recognises explicit `memo()` calls and skips
// auto-memoization for the wrapped component. The file-level
// `'use no memo'` directive was tried but Rollup strips file-level
// directives at bundle time ("use no memo" only works at function-
// body level). Relying on the Compiler's memo-recognition is
// sufficient for now; if a future Compiler version regresses on this
// guarantee, move the directive inside the `TPNodeImpl` function body
// or wrap the export differently.

import { Handle, type NodeProps, NodeToolbar, Position, useConnection } from '@xyflow/react';
import clsx from 'clsx';
import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { useShallow } from 'zustand/shallow';
import { NODE_MIN_HEIGHT, NODE_WIDTH, ST_NODE_HEIGHT, ZOOM_UP_THRESHOLD } from '@/domain/constants';
import { CUSTOM_CLASS_ICONS, type CustomClassIconName } from '@/domain/entityTypeIcons';
import { resolveEntityTypeMeta } from '@/domain/entityTypeMeta';
import { isStNodeFormat, ST_FACET_KEYS } from '@/domain/graph';
import { HANDLE_ORIENTATION } from '@/domain/layoutStrategy';
// Session 135 — sibling-file extractions of the StFacetRow sub-component
// and the corner-badge JSX. Pulled out of TPNode.tsx to keep this file
// focused on the everyday-card render + edit machinery; see those
// files for the per-piece rationale.
import { ENTITY_TYPE_COACHING } from '@/domain/readerModeCoaching';
import { useZoomLevel } from '@/hooks/useZoomLevel';
import { guardWriteOrToast } from '@/services/browseLock';
import { useDocumentStore } from '@/store';
import { currentDoc } from '@/store/selectors';
import type { TPNode as TPNodeType } from '../edges/flow-types';
import { EntityCoachingTooltip } from './EntityCoachingTooltip';
import { StFacetRow } from './StFacetRow';
import {
  AnnotationBadge,
  CollapsedExpandButton,
  CommentCountBadge,
  EligibilityBadge,
  LocusPill,
  PinBadge,
  ReachForwardBadge,
  ReachReverseBadge,
  StateBadge,
  StepBadge,
} from './TPNodeBadges';

// B5 — zoom-up annotation threshold lives in `@/domain/constants` so UI/UX
// tweaks happen in one place alongside the other canvas tunables.

function TPNodeImpl({ data, selected }: NodeProps<TPNodeType>) {
  const { entity, hiddenDescendantCount, udeReachCount, rootCauseReachCount, diffStatus } = data;
  const openCommentCount = data.openCommentCount;
  // Stable callback for the open-comment badge. `CommentCountBadge` is `memo`'d,
  // so an inline arrow here would give it a fresh `onOpen` on every TPNode render
  // and defeat the memo (the badge would re-render on every node re-render, not
  // just when its count changes). `entity.id` is the only dependency; the store
  // actions are read imperatively via `getState()`.
  const handleOpenComments = useCallback(() => {
    const st = useDocumentStore.getState();
    st.selectEntity(entity.id);
    st.openCommentsPanel();
  }, [entity.id]);
  // Session 135 / spec gap #4 — effective state for the canvas badge
  // (stamped by emission; folds in the speculation overlay when active).
  const effectiveState = data.effectiveState;
  const speculated = data.speculated;
  // Session 135 — opt-in at-a-glance action-eligibility badge (stamped
  // by emission only for Action nodes when `showActionEligibility` is on).
  const eligibility = data.eligibility;
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
    growCardsToFitText,
    diagramType,
    customEntityClasses,
    isReaderMode,
  } = useDocumentStore(
    useShallow((s) => {
      const doc = currentDoc(s);
      return {
        isEditing: s.editingEntityId === entity.id,
        updateEntity: s.updateEntity,
        endEditing: s.endEditing,
        beginEditing: s.beginEditing,
        toggleEntityCollapsed: s.toggleEntityCollapsed,
        showAnnotationNumbers: s.showAnnotationNumbers,
        showEntityIds: s.showEntityIds,
        showReachBadges: s.showReachBadges,
        showReverseReachBadges: s.showReverseReachBadges,
        growCardsToFitText: s.growCardsToFitText,
        diagramType: doc.diagramType,
        customEntityClasses: doc.customEntityClasses,
        // Session 180 / E6 — reader mode coaching tooltip.
        isReaderMode: s.appMode === 'reader',
      };
    })
  );
  // Goal #2 — while a connection is dragged onto THIS node, ring it to signal
  // "release to connect here" (rose if the drop would be rejected — self-loop
  // / duplicate). React Flow tracks the in-progress `toNode` + `isValid`; the
  // selector returns a stable `null` for every non-target node, so only the
  // hovered node re-renders.
  const connDrop = useConnection((c) =>
    c.inProgress && c.toNode?.id === entity.id && c.fromNode?.id !== entity.id
      ? c.isValid === false
        ? 'invalid'
        : 'valid'
      : null
  );
  // B10 — resolve through the doc-aware lookup so custom entity
  // classes pick up their label / colour / icon. Built-ins resolve
  // identically to the previous direct `ENTITY_TYPE_META[type]` lookup.
  const meta = resolveEntityTypeMeta(entity.type, customEntityClasses);
  // Session 179 (Theme D2) — optional per-entity icon override layered on the
  // class/type default; an unknown name falls back to the resolved meta icon.
  const EntityIcon =
    (entity.icon ? CUSTOM_CLASS_ICONS[entity.icon as CustomClassIconName] : undefined) ?? meta.icon;
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
  // Perf #18 — only subscribe to live zoom while interacting; otherwise
  // the constant selector means pan/zoom frames don't re-render this node.
  const interacting = selected === true || isHovered;
  const zoom = useZoomLevel(interacting);
  const showZoomUp = zoom < ZOOM_UP_THRESHOLD && interacting;
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

  // Feature #1 (Session 147) — node hover affordance, at parity with the
  // edge hover cue (Session 138). Reuse the existing local `isHovered` (already
  // wired to the card's mouse-enter/leave for the zoom-up overlay), gated so it
  // never fights a more specific ring: selection (indigo), the visual-diff
  // tints, and the connection-drop target ring all win. So the neutral hover
  // lift shows only on a plain, unselected node.
  const isHoverActive =
    isHovered &&
    !selected &&
    connDrop === null &&
    diffStatus !== 'added' &&
    diffStatus !== 'changed';

  // React Flow node wrapper. React Flow owns keyboard navigation between nodes at
  // the canvas level (Tab cycles selectable elements; Enter activates). The
  // double-click here is a "begin editing" shortcut; the equivalent keyboard path
  // is Enter while focused, dispatched by React Flow's own focus handler.
  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: see comment above the return.
    <div
      data-component="tp-node"
      className={clsx(
        'group relative flex items-stretch rounded-lg shadow-xs',
        'border',
        // FL-ET7: post-it tint for note entities; subtler card chrome for
        // everything else so a Note reads as annotation, not causality.
        isNoteEntity
          ? 'border-yellow-300 bg-yellow-50 dark:border-yellow-700/50 dark:bg-yellow-950/30'
          : 'border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900',
        // Feature #1 — beefed-up selection: full-opacity indigo ring + a soft
        // indigo glow (was a faint `/60` ring), so "selected" is unmistakable
        // and clearly distinct from the neutral hover lift below.
        selected && 'shadow-accent-500/30 shadow-lg ring-2 ring-accent-500 ring-offset-1',
        // H2 visual-diff tints. `'added'` greens the card so the user can
        // scan for "what's new since the snapshot." `'changed'` ambers
        // entities whose content drifted. Removed entities (only in the
        // snapshot, not the live doc) are handled by a separate "ghost"
        // overlay surfaced in the compare banner.
        diffStatus === 'added' &&
          'ring-2 ring-emerald-400/70 ring-offset-1 dark:ring-emerald-500/70',
        diffStatus === 'changed' && 'ring-2 ring-amber-400/70 ring-offset-1 dark:ring-amber-500/70',
        // Goal #2 — connection-drop target ring (indigo = will connect, rose = rejected).
        connDrop === 'valid' && 'ring-2 ring-accent-400/80 ring-offset-1',
        connDrop === 'invalid' && 'ring-2 ring-rose-400/70 ring-offset-1',
        // Feature #1 — neutral hover lift on a plain, unselected node (lowest
        // precedence; suppressed above whenever any other ring is active).
        // Reads as "hover", visually distinct from the indigo "selected" ring.
        isHoverActive && 'shadow-md ring-1 ring-neutral-300/80 dark:ring-neutral-600/80'
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
      {/* Session 180 / E6 — Reader mode coaching card. Appears below the node
          on hover when reader mode is active. Uses the same NodeToolbar pattern
          as the zoom-up overlay above but at Position.Bottom. Note entities
          are outside the causal graph (no type metadata in the coaching
          registry for them beyond the fallback label), so we still show the
          tooltip — the coaching entry for 'note' explains this. Custom entity
          classes that aren't in ENTITY_TYPE_COACHING fall back gracefully to
          nothing (the registry only covers built-in types). */}
      {isReaderMode && (
        <NodeToolbar
          isVisible={isHovered && !isEditing}
          position={Position.Bottom}
          offset={8}
          className="pointer-events-none"
        >
          {ENTITY_TYPE_COACHING[entity.type as keyof typeof ENTITY_TYPE_COACHING] && (
            <EntityCoachingTooltip
              Icon={EntityIcon}
              stripeColor={meta.stripeColor}
              coaching={ENTITY_TYPE_COACHING[entity.type as keyof typeof ENTITY_TYPE_COACHING]}
            />
          )}
        </NodeToolbar>
      )}
      <NodeToolbar
        isVisible={showZoomUp && !isEditing}
        position={Position.Top}
        offset={12}
        className="pointer-events-none"
      >
        <div
          data-component="zoom-up-card"
          className="pointer-events-auto max-w-sm rounded-lg border border-neutral-200 bg-white/95 px-3 py-2 shadow-lg backdrop-blur-sm dark:border-neutral-800 dark:bg-neutral-900/95"
        >
          {/* Session 87 (V4) — entity-type label bumped from
              text-[10px] tracking-wide to text-[11px] tracking-
              [0.06em]. At default Fit View zoom the previous size was
              ~6 px on screen and hard to scan; the bump improves
              legibility without changing layout. */}
          <span className="flex items-center gap-1 font-medium text-[11px] text-neutral-500 uppercase tracking-[0.06em] dark:text-neutral-400">
            <EntityIcon
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
      {/* Session 136 — Notes used to render NO handles at all (FL-ET7
          philosophy: notes sit outside the causal graph and the user
          can't drag connections into / out of them). Side-effect: any
          edge whose endpoint was a Note silently failed to render
          because React Flow needs a handle to anchor to. That broke
          Flying Logic imports — `.xlogic` files where Notes are
          tethered to nearby entities (Dann's "retail goal map"
          repro) lost every such edge on import.
          Session 136 follow-up: Dann opted to lift the create-via-
          drag block entirely. Notes now render the same handle
          treatment as causal entities (visible dot, connectable) so
          the affordance is symmetric. The visual differentiator
          moved to the edge itself — note-touching edges paint dotted
          + thinner (see `TPEdge.tsx`'s `isNoteEdge` branch). The
          validators + propagation engine still treat notes as
          non-causal, so the edge's existence has no effect on CLR /
          state derivation. */}
      <Handle
        type="target"
        position={targetPosition}
        className="!h-5 !w-5 !min-h-0 !min-w-0 !border-0 !bg-transparent before:pointer-events-none before:absolute before:top-1/2 before:left-1/2 before:h-2 before:w-2 before:-translate-x-1/2 before:-translate-y-1/2 before:rounded-full before:border before:border-neutral-300 before:bg-transparent before:content-[''] group-hover:before:border-accent-400 dark:before:border-neutral-700"
      />
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
          <EntityIcon
            className="h-3 w-3 shrink-0"
            style={{ color: meta.stripeColor }}
            aria-hidden
          />
          <span>{meta.label}</span>
          {/*
            Locus (TOC-reading; previously "Span of control"):
            single-letter pill after the type label. See
            `TPNodeBadges.tsx → LocusPill` for the per-variant
            details + colour palette.
          */}
          <LocusPill spanOfControl={entity.spanOfControl} />
        </span>
        {isEditing ? (
          <textarea
            ref={inputRef}
            className="resize-none border-none bg-transparent p-0 text-neutral-900 text-node leading-snug outline-hidden placeholder:text-neutral-400 dark:text-neutral-100"
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
              'whitespace-pre-line text-neutral-900 leading-snug dark:text-neutral-100',
              // Session 181 — grow-to-fit lets the title use up to 6 lines (the
              // card grows with it); off keeps the 2-line clamp. Both clamps are
              // static literals so Tailwind emits them.
              growCardsToFitText ? 'line-clamp-6' : 'line-clamp-2',
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
      {/* Session 135 — corner badges extracted to `TPNodeBadges.tsx`.
          Each helper takes the minimum props it needs and renders
          either its JSX or null; the conditional logic that decides
          whether to render lives here (closest to the props it
          inspects). */}
      {effectiveState && <StateBadge state={effectiveState} speculated={speculated ?? false} />}
      {eligibility && <EligibilityBadge status={eligibility} />}
      {showAnnotationNumbers && <AnnotationBadge annotationNumber={entity.annotationNumber} />}
      {typeof entity.ordering === 'number' && <StepBadge ordering={entity.ordering} />}
      {entity.position && <PinBadge diagramType={diagramType} />}
      {showReachBadges && typeof udeReachCount === 'number' && udeReachCount > 0 && (
        <ReachForwardBadge count={udeReachCount} />
      )}
      {showReverseReachBadges &&
        typeof rootCauseReachCount === 'number' &&
        rootCauseReachCount > 0 && <ReachReverseBadge count={rootCauseReachCount} />}
      {typeof openCommentCount === 'number' && openCommentCount > 0 && (
        <CommentCountBadge count={openCommentCount} onOpen={handleOpenComments} />
      )}
      {isCollapsed && (
        <CollapsedExpandButton
          entity={entity}
          hiddenDescendantCount={hiddenDescendantCount}
          onToggle={toggleEntityCollapsed}
        />
      )}
      {/* See the target-handle comment above. Source handle is also
          identical to the causal-entity styling now — notes are full
          drag-from / drag-to citizens. */}
      <Handle
        type="source"
        position={sourcePosition}
        className="!h-5 !w-5 !min-h-0 !min-w-0 !border-0 !bg-transparent before:pointer-events-none before:absolute before:top-1/2 before:left-1/2 before:h-2 before:w-2 before:-translate-x-1/2 before:-translate-y-1/2 before:rounded-full before:border before:border-neutral-300 before:bg-transparent before:content-[''] group-hover:before:border-accent-400 dark:before:border-neutral-700"
      />
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
// test imports (`import { tpNodePropsEqual } from '@/components/canvas/nodes/TPNode'`)
// keep working unchanged.
import { shallowEqualNodeData, tpNodePropsEqual } from './tpNodeComparator';

export { shallowEqualNodeData, tpNodePropsEqual };

export const TPNode = memo(TPNodeImpl, tpNodePropsEqual);
TPNode.displayName = 'TPNode';
