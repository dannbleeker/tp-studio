import clsx from 'clsx';
import { Plus, X } from 'lucide-react';
import { createDocument } from '@/domain/factory';
import type { DocumentId } from '@/domain/types';
import { useDocumentStore } from '@/store';
import { arrayShallowEqualByKeys } from '@/store/equality';
import { useDocumentStoreWith } from '@/store/useDocumentStoreWithEquality';

/**
 * Multi-doc tabs Phase 5, Batch 5.2 — the visible tab strip.
 *
 * A full-width bar of chips, one per open document, pinned to the top of
 * the canvas (locked decision #1). Click a chip to switch; the X closes a
 * tab; the trailing `+` opens a fresh CRT in a new tab. Drag-to-reorder
 * and the Cmd+T/W/1–9 keyboard map land in a follow-up (5.2b); the store
 * already supports them (`reorderTabs`, etc.).
 *
 * The bar floats `absolute top-0` over the canvas at `z-20` (below the
 * TopBar's `z-30`); `TitleBadge` + `TopBar` are nudged down to `top-12`
 * so they clear it. Hidden in presentation mode (gated by the App).
 *
 * Re-render discipline: the chip list is derived through
 * `useDocumentStoreWith` + an array-by-keys equality so a plain entity
 * edit (which re-refs `docs`) doesn't churn the strip — it re-renders
 * only when a tab's id / title / active-flag actually changes.
 */
type TabChip = { id: DocumentId; title: string; active: boolean };

const tabChipsEqual = arrayShallowEqualByKeys<TabChip>(['id', 'title', 'active']);

export function TabStrip() {
  const chips = useDocumentStoreWith<TabChip[]>(
    (s) =>
      s.tabOrder.map((id) => ({
        id,
        title: s.docs[id]?.title?.trim() || 'Untitled',
        active: id === s.activeDocId,
      })),
    tabChipsEqual
  );
  const switchTab = useDocumentStore((s) => s.switchTab);
  const closeTab = useDocumentStore((s) => s.closeTab);
  const openTab = useDocumentStore((s) => s.openTab);

  const canClose = chips.length > 1;

  return (
    <div
      // A labelled toolbar of buttons rather than a strict ARIA tablist: a
      // closeable-tab strip (tab + per-tab close + a trailing "new tab")
      // can't satisfy `tablist`'s aria-required-children (which wants ONLY
      // `role="tab"` children), and axe flags it critically. `toolbar` has
      // no required children + no native-element equivalent (so Biome's
      // useSemanticElements is happy); the buttons are self-labelling and
      // the active chip carries `aria-current`.
      role="toolbar"
      aria-label="Open documents"
      data-component="tab-strip"
      className="absolute inset-x-0 top-0 z-20 flex h-9 items-stretch gap-0.5 overflow-x-auto border-neutral-200 border-b bg-neutral-100/95 px-1 backdrop-blur-sm dark:border-neutral-800 dark:bg-neutral-900/95"
    >
      {chips.map((chip) => (
        <div
          key={chip.id}
          className={clsx(
            'group flex min-w-0 max-w-[14rem] items-center gap-1 self-end rounded-t-md border border-b-0 px-2 py-1 text-xs transition',
            chip.active
              ? 'border-neutral-200 bg-white text-neutral-900 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100'
              : 'border-transparent bg-transparent text-neutral-500 hover:bg-neutral-200/60 hover:text-neutral-800 dark:text-neutral-400 dark:hover:bg-neutral-800/60 dark:hover:text-neutral-200'
          )}
        >
          <button
            type="button"
            data-component="tab"
            aria-current={chip.active || undefined}
            onClick={() => switchTab(chip.id)}
            className="min-w-0 flex-1 truncate text-left outline-hidden"
            title={chip.title}
          >
            {chip.title}
          </button>
          {canClose && (
            <button
              type="button"
              aria-label={`Close ${chip.title}`}
              onClick={() => closeTab(chip.id)}
              className="shrink-0 rounded-sm p-0.5 text-neutral-400 opacity-0 transition hover:bg-neutral-300/60 hover:text-neutral-700 focus:opacity-100 group-hover:opacity-100 dark:hover:bg-neutral-700/60 dark:hover:text-neutral-200"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </div>
      ))}
      <button
        type="button"
        aria-label="New tab"
        onClick={() => openTab(createDocument('crt'))}
        className="my-1 shrink-0 self-center rounded-sm p-1 text-neutral-500 transition hover:bg-neutral-200/70 hover:text-neutral-800 dark:text-neutral-400 dark:hover:bg-neutral-800/70 dark:hover:text-neutral-200"
      >
        <Plus className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
