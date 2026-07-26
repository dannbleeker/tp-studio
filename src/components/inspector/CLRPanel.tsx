import clsx from 'clsx';
import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Crosshair,
  ListFilter,
  Lock,
  ScanSearch,
  Wand2,
  X,
} from 'lucide-react';
import { useState } from 'react';
import { displayTitle } from '@/domain/entityTypeMeta';
import type { ClrTier, TPDocument, Warning, WarningTarget } from '@/domain/types';
import { useDocWarnings } from '@/hooks/useDocWarnings';
import { useClrText } from '@/i18n/useClrText';
import { getCanvasInstance } from '@/services/canvasRef';
import { runWarningAction } from '@/services/warningActions';
import { useDocumentStore } from '@/store';
import { currentDoc } from '@/store/selectors';
import { TIER_META, TIER_ORDER } from './WarningsList';

/**
 * Logic-check panel — the tree-level CLR audit promoted to first class. Lists
 * EVERY open/resolved reservation for the active diagram (grouped by tier), not
 * just the one selected element. Shares `useDocWarnings()` with the TopBar Logic
 * chip and the Inspector's WarningsList, so the open count can't drift. Mutually
 * exclusive with the Inspector in the right dock (`clrPanelOpen`).
 */

const targetLabel = (target: WarningTarget, doc: TPDocument): string => {
  if (target.kind === 'document') return 'Whole document';
  if (target.kind === 'entity') {
    const e = doc.entities[target.id];
    return e ? displayTitle(e) : '(deleted entity)';
  }
  const edge = doc.edges[target.id];
  if (!edge) return '(deleted edge)';
  const s = doc.entities[edge.sourceId];
  const t = doc.entities[edge.targetId];
  return `${s ? displayTitle(s) : '?'} → ${t ? displayTitle(t) : '?'}`;
};

export function CLRPanel() {
  const clr = useClrText();
  const doc = useDocumentStore((s) => currentDoc(s));
  const warnings = useDocWarnings();
  const resolveWarning = useDocumentStore((s) => s.resolveWarning);
  const unresolveWarning = useDocumentStore((s) => s.unresolveWarning);
  const closeClrPanel = useDocumentStore((s) => s.closeClrPanel);
  const selectEntity = useDocumentStore((s) => s.selectEntity);
  const selectEdge = useDocumentStore((s) => s.selectEdge);
  const showToast = useDocumentStore((s) => s.showToast);
  const [walkIdx, setWalkIdx] = useState(0);
  // Session 199 (A4) — progressive gating (opt-in, local, default off): focus one
  // tier at a time (Clarity → Existence → Sufficiency), de-emphasising a later
  // tier until the earlier ones are clear. Never hides — a gated tier keeps its
  // header + count and expands on click.
  const [focusMode, setFocusMode] = useState(false);
  const [expandedTiers, setExpandedTiers] = useState<ReadonlySet<ClrTier>>(() => new Set());

  const open = warnings.filter((w) => !w.resolved);
  const resolvedCount = warnings.length - open.length;

  const byTier: Record<ClrTier, Warning[]> = { clarity: [], existence: [], sufficiency: [] };
  for (const w of warnings) byTier[w.tier].push(w);

  const openByTier: Record<ClrTier, number> = {
    clarity: byTier.clarity.filter((w) => !w.resolved).length,
    existence: byTier.existence.filter((w) => !w.resolved).length,
    sufficiency: byTier.sufficiency.filter((w) => !w.resolved).length,
  };
  // A tier is unlocked when gating is off, or every EARLIER tier has no open
  // reservations left. Clarity is always unlocked (nothing precedes it).
  const tierUnlocked = (tier: ClrTier): boolean => {
    if (!focusMode) return true;
    const idx = TIER_ORDER.indexOf(tier);
    return TIER_ORDER.slice(0, idx).every((t) => openByTier[t] === 0);
  };

  // Select + centre the warning's target on the canvas (CommentsPanel pattern).
  // Document-targeted reservations have no canvas location — they only highlight
  // in the list.
  const locate = (target: WarningTarget): void => {
    const inst = getCanvasInstance();
    if (!inst) return;
    if (target.kind === 'entity') {
      selectEntity(target.id);
      const n = inst.getNode(target.id);
      if (n) {
        window.requestAnimationFrame(() =>
          inst.setCenter(n.position.x + 140, n.position.y + 40, {
            zoom: inst.getZoom(),
            duration: 250,
          })
        );
      }
    } else if (target.kind === 'edge') {
      selectEdge(target.id);
      const edge = doc.edges[target.id];
      const a = edge ? inst.getNode(edge.sourceId) : undefined;
      const b = edge ? inst.getNode(edge.targetId) : undefined;
      if (a && b) {
        const cx = (a.position.x + b.position.x) / 2 + 140;
        const cy = (a.position.y + b.position.y) / 2 + 40;
        window.requestAnimationFrame(() =>
          inst.setCenter(cx, cy, { zoom: inst.getZoom(), duration: 250 })
        );
      }
    }
  };

  const runAction = (w: Warning): void => {
    if (!w.action) return;
    const state = useDocumentStore.getState();
    const ok = runWarningAction(state, currentDoc(state), w);
    showToast(
      ok ? 'success' : 'info',
      ok ? `Applied: ${clr.actionLabel(w.action)}` : `No handler for "${w.action.actionId}".`
    );
  };

  // Guided walk — step focus through the open reservations one at a time,
  // locating each on the canvas while the panel stays open.
  const stepTo = (idx: number): void => {
    if (open.length === 0) return;
    const i = ((idx % open.length) + open.length) % open.length;
    setWalkIdx(i);
    const w = open[i];
    if (w) locate(w.target);
  };

  return (
    <aside
      aria-label="Logic check"
      className="absolute top-0 right-0 z-20 flex h-full w-[min(85vw,320px)] flex-col border-neutral-200 border-l bg-white md:w-[320px] dark:border-neutral-800 dark:bg-neutral-950"
    >
      <div className="flex items-start justify-between gap-2 border-neutral-200 border-b px-3 py-2 dark:border-neutral-800">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 font-semibold text-neutral-800 text-sm dark:text-neutral-100">
            <ScanSearch className="h-4 w-4 text-accent-500" aria-hidden />
            Logic check
          </div>
          <p className="mt-0.5 text-[11px] text-neutral-500 leading-snug dark:text-neutral-400">
            Every cause-and-effect link is checked against Goldratt's Categories of Legitimate
            Reservation — walk them tier by tier.
          </p>
          <p className="mt-1 text-[11px] text-neutral-500 dark:text-neutral-400">
            {open.length} to review{resolvedCount > 0 ? ` · ${resolvedCount} resolved` : ''}
          </p>
        </div>
        <div className="flex items-center gap-1">
          {warnings.length > 0 && (
            <button
              type="button"
              onClick={() => setFocusMode((v) => !v)}
              aria-pressed={focusMode}
              title="Focus mode — work one tier at a time (Clarity → Existence → Sufficiency)"
              className={clsx(
                'rounded-md border p-1 transition',
                focusMode
                  ? 'border-accent-300 bg-accent-50 text-accent-700 dark:border-accent-500 dark:bg-accent-950/40 dark:text-accent-200'
                  : 'border-neutral-200 text-neutral-500 hover:bg-neutral-100 dark:border-neutral-800 dark:hover:bg-neutral-800'
              )}
            >
              <ListFilter className="h-3.5 w-3.5" aria-hidden />
            </button>
          )}
          {open.length > 0 && (
            <div
              className="flex items-center rounded-md border border-neutral-200 dark:border-neutral-800"
              title="Guided walk — step through open reservations"
            >
              <button
                type="button"
                onClick={() => stepTo(walkIdx - 1)}
                aria-label="Previous reservation"
                className="rounded-l-md p-1 text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800"
              >
                <ChevronUp className="h-3.5 w-3.5" />
              </button>
              <span className="px-1 text-[10px] text-neutral-500 tabular-nums">
                {Math.min(walkIdx + 1, open.length)}/{open.length}
              </span>
              <button
                type="button"
                onClick={() => stepTo(walkIdx + 1)}
                aria-label="Next reservation"
                className="rounded-r-md p-1 text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800"
              >
                <ChevronDown className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
          <button
            type="button"
            onClick={closeClrPanel}
            aria-label="Close logic check"
            title="Close"
            className="rounded-md p-1 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700 dark:hover:bg-neutral-800"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
        {warnings.length === 0 ? (
          <div className="rounded-md border border-emerald-200 bg-emerald-50 px-2.5 py-2 text-emerald-700 text-xs dark:border-emerald-900/40 dark:bg-emerald-950/40 dark:text-emerald-300">
            <CheckCircle2 className="-mt-0.5 mr-1 inline h-3.5 w-3.5" />
            All clear — no Categories of Legitimate Reservation concerns on this tree.
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {TIER_ORDER.map((tier) => {
              const ws = byTier[tier];
              if (ws.length === 0) return null;
              const meta = TIER_META[tier];
              const openCount = openByTier[tier];
              // Gated: earlier tiers still have open reservations, and the user
              // hasn't manually expanded this one. Collapse (never hide) it.
              const gated = openCount > 0 && !tierUnlocked(tier) && !expandedTiers.has(tier);
              if (gated) {
                const priorLabels = TIER_ORDER.slice(0, TIER_ORDER.indexOf(tier))
                  .filter((t) => openByTier[t] > 0)
                  .map((t) => TIER_META[t].label)
                  .join(' & ');
                return (
                  <section key={tier}>
                    <button
                      type="button"
                      onClick={() => setExpandedTiers((prev) => new Set(prev).add(tier))}
                      className="flex w-full items-center justify-between gap-2 rounded-md border border-neutral-200 border-dashed px-2.5 py-2 text-left opacity-70 transition hover:opacity-100 dark:border-neutral-800"
                    >
                      <span className="flex items-center gap-1.5 font-semibold text-[10px] text-neutral-500 uppercase tracking-wider dark:text-neutral-400">
                        <Lock className="h-3 w-3" aria-hidden />
                        {meta.label}
                      </span>
                      <span className="flex items-center gap-1 text-[10px] text-neutral-500 normal-case tracking-normal dark:text-neutral-400">
                        {openCount} to review · clears after {priorLabels}
                        <ChevronDown className="h-3.5 w-3.5" aria-hidden />
                      </span>
                    </button>
                  </section>
                );
              }
              const sorted = [...ws].sort((a, b) => Number(a.resolved) - Number(b.resolved));
              return (
                <section key={tier} className="flex flex-col gap-1.5">
                  <span className="flex items-baseline gap-2 font-semibold text-[10px] text-neutral-500 uppercase tracking-wider dark:text-neutral-400">
                    <span>{meta.label}</span>
                    <span className="font-normal text-neutral-400 normal-case tracking-normal dark:text-neutral-500">
                      {meta.hint}
                    </span>
                  </span>
                  <ul className="flex flex-col gap-1.5">
                    {sorted.map((w) => {
                      const locatable = w.target.kind !== 'document';
                      return (
                        <li
                          key={w.id}
                          className={clsx(
                            'group rounded-md border px-2.5 py-2 text-xs transition',
                            w.resolved
                              ? 'border-neutral-200 bg-neutral-50 text-neutral-500 dark:border-neutral-800 dark:bg-neutral-900'
                              : 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900/40 dark:bg-amber-950/40 dark:text-amber-200'
                          )}
                        >
                          <div className="flex items-start gap-2">
                            {w.resolved ? (
                              <CheckCircle2 className="h-3.5 w-3.5 shrink-0 translate-y-0.5" />
                            ) : (
                              <AlertCircle className="h-3.5 w-3.5 shrink-0 translate-y-0.5" />
                            )}
                            <div className="min-w-0 flex-1">
                              <button
                                type="button"
                                disabled={!locatable}
                                onClick={() => locate(w.target)}
                                title={locatable ? 'Find on canvas' : undefined}
                                className={clsx(
                                  'flex max-w-full items-center gap-1 font-medium',
                                  locatable && 'hover:underline'
                                )}
                              >
                                {locatable && (
                                  <Crosshair className="h-3 w-3 shrink-0 opacity-60" aria-hidden />
                                )}
                                <span className="truncate">{targetLabel(w.target, doc)}</span>
                              </button>
                              <p
                                className={clsx(
                                  'mt-0.5',
                                  w.resolved && 'line-through decoration-neutral-400'
                                )}
                              >
                                {clr.message(w)}
                              </p>
                              <p className="mt-0.5 text-[10px] uppercase tracking-wider opacity-60">
                                {w.ruleId}
                              </p>
                              {w.action && !w.resolved && (
                                <button
                                  type="button"
                                  onClick={() => runAction(w)}
                                  aria-label={`${clr.actionLabel(w.action)} (one-click remedy)`}
                                  className="mt-1.5 inline-flex items-center gap-1 rounded-md bg-amber-100 px-2 py-0.5 font-semibold text-[10px] text-amber-900 transition hover:bg-amber-200 dark:bg-amber-900/40 dark:text-amber-100 dark:hover:bg-amber-900/60"
                                >
                                  <Wand2 className="h-3 w-3" aria-hidden />
                                  {w.action.label}
                                </button>
                              )}
                            </div>
                            <button
                              type="button"
                              onClick={() =>
                                w.resolved ? unresolveWarning(w.id) : resolveWarning(w.id)
                              }
                              aria-label={
                                w.resolved
                                  ? `Reopen: ${clr.message(w)}`
                                  : `Resolve: ${clr.message(w)}`
                              }
                              className="shrink-0 rounded-sm px-1.5 py-0.5 font-medium text-[10px] text-neutral-600 opacity-0 transition hover:bg-white/60 focus:opacity-100 group-hover:opacity-100 dark:text-neutral-300 dark:hover:bg-neutral-800/60"
                            >
                              {w.resolved ? 'Reopen' : 'Resolve'}
                            </button>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </section>
              );
            })}
          </div>
        )}
      </div>
    </aside>
  );
}
