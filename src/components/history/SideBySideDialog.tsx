import { NODE_HALF_HEIGHT, NODE_HALF_WIDTH, NODE_MIN_HEIGHT, NODE_WIDTH } from '@/domain/constants';
import { resolveEntityTypeMeta } from '@/domain/entityTypeMeta';
import { structuralEntities } from '@/domain/graph';
import {
  type DetailedRevisionDiff,
  type EntityDiffStatus,
  computeDetailedRevisionDiff,
  entityStatusFromDiff,
} from '@/domain/revisions';
import type { Entity, TPDocument } from '@/domain/types';
import { useDocumentStore } from '@/store';
import { X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';

// Outer padding around the laid-out content so cards near the edge don't
// clip the panel's scroll container. Card dimensions themselves come from
// the central `@/domain/constants` module so a tweak to NODE_WIDTH /
// NODE_MIN_HEIGHT propagates here without manual sync.
const PANEL_PAD = 50;

/**
 * H4 — side-by-side compare dialog. Two read-only panels render the
 * compared revision (left) and the live doc (right). Each entity is
 * tinted by its diff status (added / removed / changed / unchanged) so
 * the user can spot what shifted at a glance. Esc closes; clicking the
 * backdrop closes; the X button closes.
 *
 * Implementation note — rather than mount two `<ReactFlowProvider>`
 * instances (heavy + their internal stores can race), each panel runs
 * `computeLayout` once for its doc and renders entities as plain
 * absolute-positioned cards inside a scrollable container. Edges render
 * as straight SVG lines between card centers. Read-only by construction.
 */
export function SideBySideDialog() {
  const sideBySideRevisionId = useDocumentStore((s) => s.sideBySideRevisionId);
  const closeSideBySide = useDocumentStore((s) => s.closeSideBySide);
  const revisions = useDocumentStore((s) => s.revisions);
  const liveDoc = useDocumentStore((s) => s.doc);
  const dialogRef = useRef<HTMLDialogElement>(null);

  const rev = revisions.find((r) => r.id === sideBySideRevisionId);
  const diff = useMemo(
    () => (rev ? computeDetailedRevisionDiff(rev.doc, liveDoc) : null),
    [rev, liveDoc]
  );

  // Sync native <dialog> open state with the store cursor. `showModal()`
  // gives us Esc handling and focus trap for free, removing the manual
  // keydown listener we used to maintain. The feature check (`typeof
  // showModal === 'function'`) is for jsdom and older browsers where
  // `<dialog>` exists but `showModal` isn't implemented — the rendered
  // `<dialog open>` attribute is the fallback so the panel is still
  // visible in those environments.
  useEffect(() => {
    const el = dialogRef.current;
    if (!el) return;
    const supportsModal = typeof el.showModal === 'function';
    if (sideBySideRevisionId && rev && diff) {
      if (supportsModal && !el.open) el.showModal();
    } else {
      if (supportsModal && el.open) el.close();
    }
  }, [sideBySideRevisionId, rev, diff]);

  if (!sideBySideRevisionId || !rev || !diff) return null;

  const revLabel =
    rev.label?.trim() || `Snapshot from ${new Date(rev.capturedAt).toLocaleString()}`;

  return (
    // biome-ignore lint/a11y/useKeyWithClickEvents: native <dialog> handles Esc itself; the `onClose` prop receives that and fires `closeSideBySide`. The `onClick` is only here for the backdrop-click dismissal niceness.
    <dialog
      ref={dialogRef}
      aria-label="Side-by-side compare"
      // `onClose` fires on Esc or on `el.close()`. Wiring it here means
      // a single source of truth handles all close paths.
      onClose={closeSideBySide}
      // Backdrop-click dismissal — native <dialog> doesn't do this on its
      // own. The check `e.target === e.currentTarget` ensures only clicks
      // on the dialog's own backdrop area (not its child content)
      // trigger close.
      onClick={(e) => {
        if (e.target === e.currentTarget) closeSideBySide();
      }}
      // The `open` attribute is the fallback for environments where
      // `showModal()` isn't available (jsdom, very old browsers); the
      // useEffect above prefers `showModal()` when supported.
      open
      className="fixed inset-0 z-50 m-0 flex h-screen max-h-screen w-screen max-w-none flex-col bg-black/40 p-0 backdrop-blur-sm"
    >
      <div className="flex flex-1 flex-col bg-white shadow-2xl dark:bg-neutral-950">
        <header className="flex items-center justify-between border-b border-neutral-200 px-4 py-3 dark:border-neutral-800">
          <h2 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
            Side-by-side: {revLabel}{' '}
            <span className="ml-2 font-normal text-neutral-500 dark:text-neutral-400">
              vs. live
            </span>
          </h2>
          <button
            type="button"
            onClick={closeSideBySide}
            className="rounded-full p-1.5 text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800"
            aria-label="Close side-by-side"
          >
            <X className="h-4 w-4" />
          </button>
        </header>
        <div className="flex flex-1 overflow-hidden">
          <Panel label="Snapshot" doc={rev.doc} diff={diff} sideKind="prev" />
          <div className="w-px bg-neutral-200 dark:bg-neutral-800" aria-hidden />
          <Panel label="Live" doc={liveDoc} diff={diff} sideKind="next" />
        </div>
      </div>
    </dialog>
  );
}

function Panel({
  label,
  doc,
  diff,
  sideKind,
}: {
  label: string;
  doc: TPDocument;
  diff: DetailedRevisionDiff;
  /** Which side of the diff this panel represents. The snapshot side
   *  shows removed-not-added entities (entities that existed in `prev`);
   *  the live side shows added-and-changed (entities that exist in `next`). */
  sideKind: 'prev' | 'next';
}) {
  const entities = useMemo(() => structuralEntities(doc), [doc]);
  // Session 81 — dagre is lazy-loaded; useGraphPositions and this panel
  // share the same dynamically-imported `@/domain/layout` chunk. The
  // initial render shows an empty panel for ~1 paint frame while the
  // module loads; once it arrives, positions appear.
  const [layout, setLayout] = useState<{
    positions: Record<string, { x: number; y: number }>;
    width: number;
    height: number;
  }>({ positions: {}, width: 0, height: 0 });
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const mod = await import('@/domain/layout');
      if (cancelled) return;
      const opts = mod.layoutConfigToOptions(doc.layoutConfig);
      const { nodes, edges } = mod.docToLayoutModel(doc);
      const positions = mod.computeLayout(nodes, edges, opts);
      let maxX = 0;
      let maxY = 0;
      for (const p of Object.values(positions)) {
        if (p.x + NODE_WIDTH > maxX) maxX = p.x + NODE_WIDTH;
        if (p.y + NODE_MIN_HEIGHT > maxY) maxY = p.y + NODE_MIN_HEIGHT;
      }
      if (cancelled) return;
      setLayout({ positions, width: maxX, height: maxY });
    })();
    return () => {
      cancelled = true;
    };
  }, [doc]);

  return (
    <div className="relative flex-1 overflow-auto">
      <div className="sticky top-0 z-10 border-b border-neutral-200 bg-neutral-50/95 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-neutral-500 backdrop-blur dark:border-neutral-800 dark:bg-neutral-900/95 dark:text-neutral-400">
        {label}
      </div>
      <div
        className="relative"
        style={{ width: layout.width + 2 * PANEL_PAD, height: layout.height + 2 * PANEL_PAD }}
      >
        {/* Edges first so cards layer over them. */}
        <svg
          className="pointer-events-none absolute inset-0"
          width={layout.width + 2 * PANEL_PAD}
          height={layout.height + 2 * PANEL_PAD}
        >
          <title>{`${label} edges`}</title>
          {Object.values(doc.edges).map((edge) => {
            const src = layout.positions[edge.sourceId];
            const tgt = layout.positions[edge.targetId];
            if (!src || !tgt) return null;
            // Center the line on each box.
            const x1 = src.x + NODE_HALF_WIDTH + PANEL_PAD;
            const y1 = src.y + NODE_HALF_HEIGHT + PANEL_PAD;
            const x2 = tgt.x + NODE_HALF_WIDTH + PANEL_PAD;
            const y2 = tgt.y + NODE_HALF_HEIGHT + PANEL_PAD;
            const isAdded = diff.edgesAdded.has(edge.id);
            const isRemoved = diff.edgesRemoved.has(edge.id);
            const isChanged = diff.edgesChanged.has(edge.id);
            const stroke = isAdded
              ? '#10b981'
              : isRemoved
                ? '#ef4444'
                : isChanged
                  ? '#f59e0b'
                  : '#a3a3a3';
            return (
              <line
                key={edge.id}
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                stroke={stroke}
                strokeWidth={isAdded || isRemoved || isChanged ? 2 : 1}
                strokeDasharray={isRemoved ? '4 4' : undefined}
              />
            );
          })}
        </svg>
        {entities.map((e) => {
          const pos = layout.positions[e.id];
          if (!pos) return null;
          const status = entityStatusFromDiff(diff, e.id);
          // Filter what to render per side: snapshot panel skips entities
          // *added* in live (they don't exist in this snapshot); live
          // panel skips entities *removed* from live (they don't exist
          // here either). Catch-all `unchanged` shows on both.
          if (sideKind === 'prev' && status === 'added') return null;
          if (sideKind === 'next' && status === 'removed') return null;
          return (
            <EntityCard
              key={e.id}
              entity={e}
              x={pos.x + PANEL_PAD}
              y={pos.y + PANEL_PAD}
              status={status}
              customClasses={doc.customEntityClasses}
            />
          );
        })}
      </div>
    </div>
  );
}

function EntityCard({
  entity,
  x,
  y,
  status,
  customClasses,
}: {
  entity: Entity;
  x: number;
  y: number;
  status: EntityDiffStatus;
  customClasses?: TPDocument['customEntityClasses'];
}) {
  const meta = resolveEntityTypeMeta(entity.type, customClasses);
  const ring =
    status === 'added'
      ? 'ring-2 ring-emerald-400 dark:ring-emerald-500'
      : status === 'removed'
        ? 'ring-2 ring-red-400 dark:ring-red-500 opacity-70'
        : status === 'changed'
          ? 'ring-2 ring-amber-400 dark:ring-amber-500'
          : '';
  return (
    <div
      className={`absolute flex items-stretch rounded-lg border border-neutral-200 bg-white shadow-sm dark:border-neutral-800 dark:bg-neutral-900 ${ring}`}
      style={{ left: x, top: y, width: NODE_WIDTH, minHeight: NODE_MIN_HEIGHT }}
    >
      <div
        className="w-1.5 shrink-0 rounded-l-lg"
        style={{ backgroundColor: meta.stripeColor }}
        aria-hidden
      />
      <div className="flex flex-1 flex-col gap-1 px-3 py-2">
        <span className="text-[10px] font-medium uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
          {meta.label}
          {status !== 'unchanged' && (
            <span className="ml-2 rounded px-1 text-[9px] font-bold uppercase">
              {status === 'added' && (
                <span className="text-emerald-700 dark:text-emerald-300">added</span>
              )}
              {status === 'removed' && (
                <span className="text-red-700 dark:text-red-300">removed</span>
              )}
              {status === 'changed' && (
                <span className="text-amber-700 dark:text-amber-300">changed</span>
              )}
            </span>
          )}
        </span>
        <span
          className={`line-clamp-2 text-sm leading-snug text-neutral-900 dark:text-neutral-100 ${status === 'removed' ? 'line-through' : ''}`}
        >
          {entity.title || <span className="italic text-neutral-400">Untitled</span>}
        </span>
      </div>
    </div>
  );
}
