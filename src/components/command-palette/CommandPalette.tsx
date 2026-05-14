import { paletteScore } from '@/domain/paletteScore';
import { paletteKbdForCommand } from '@/domain/shortcuts';
import { useDocumentStore } from '@/store';
import clsx from 'clsx';
import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { Modal } from '../ui/Modal';
import { COMMANDS, type Command } from './commands';
import type { CommandGroup } from './commands/types';

/**
 * Order in which section headers appear when the palette is unfiltered.
 * Follows user mental model: bring docs in → mutate → look around →
 * inspect/validate → send out → learn. A command whose `group` isn't in
 * this list falls through to the end (defensive; the type union should
 * make that impossible).
 */
const GROUP_ORDER: CommandGroup[] = ['File', 'Edit', 'View', 'Review', 'Export', 'Help'];

export function CommandPalette() {
  const open = useDocumentStore((s) => s.paletteOpen);
  const initialQuery = useDocumentStore((s) => s.paletteInitialQuery);
  const close = useDocumentStore((s) => s.closePalette);
  const store = useDocumentStore;

  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);

  /**
   * Filtered + ordered command list.
   *
   *   - **No query** → group by `cmd.group` in `GROUP_ORDER` and emit section
   *     headers between groups. Within each group, commands keep their
   *     definition order (which the per-file `*Commands` arrays control).
   *   - **Query set** → flatten by paletteScore so the top match is always
   *     at row 0. Headers would lie when the best match jumps groups, so
   *     they're suppressed here.
   */
  const filtered = useMemo(() => {
    if (!query) return COMMANDS;
    return COMMANDS.map((c) => ({ c, s: paletteScore(c.label, query) }))
      .filter(({ s }) => s >= 0)
      .sort((a, b) => b.s - a.s)
      .map(({ c }) => c);
  }, [query]);

  /**
   * Group the filtered list by `cmd.group` in `GROUP_ORDER` for the
   * unfiltered render. Returns `null` (single flat section, no headers)
   * when a query is active so the score sort isn't broken up.
   */
  const sections = useMemo((): { group: CommandGroup; items: Command[] }[] | null => {
    if (query) return null;
    const byGroup = new Map<CommandGroup, Command[]>();
    for (const cmd of filtered) {
      const bucket = byGroup.get(cmd.group);
      if (bucket) bucket.push(cmd);
      else byGroup.set(cmd.group, [cmd]);
    }
    const ordered: { group: CommandGroup; items: Command[] }[] = [];
    for (const g of GROUP_ORDER) {
      const items = byGroup.get(g);
      if (items && items.length > 0) ordered.push({ group: g, items });
    }
    return ordered;
  }, [query, filtered]);

  useEffect(() => {
    if (!open) return undefined;
    setQuery(initialQuery);
    setActiveIndex(0);
    const t = setTimeout(() => inputRef.current?.focus(), 0);
    return () => clearTimeout(t);
  }, [open, initialQuery]);

  useEffect(() => {
    if (activeIndex >= filtered.length) setActiveIndex(0);
  }, [filtered.length, activeIndex]);

  const runActive = () => {
    const cmd = filtered[activeIndex];
    if (!cmd) return;
    close();
    cmd.run(store.getState());
  };

  /**
   * Render one command row. The active row's index drives the violet
   * highlight + arrow-key target; mouse-enter snaps the active index to
   * the hovered row so keyboard and mouse don't fight over the cursor.
   *
   * The `idx` parameter is the index into the *flat* `filtered` list (not
   * the section), so `runActive` and the arrow-key handler keep working
   * unchanged whether or not the list is currently sectioned.
   */
  const renderRow = (cmd: Command, idx: number) => {
    const kbd = paletteKbdForCommand(cmd.id);
    return (
      <li key={cmd.id}>
        <button
          type="button"
          className={clsx(
            'flex w-full items-center justify-between gap-3 px-4 py-2 text-left text-sm transition',
            idx === activeIndex
              ? 'bg-indigo-50 text-indigo-900 dark:bg-indigo-950/50 dark:text-indigo-200'
              : 'text-neutral-700 hover:bg-neutral-50 dark:text-neutral-200 dark:hover:bg-neutral-900'
          )}
          onMouseEnter={() => setActiveIndex(idx)}
          onClick={() => {
            close();
            cmd.run(store.getState());
          }}
        >
          <span>{cmd.label}</span>
          {kbd && (
            <kbd className="rounded border border-neutral-200 bg-neutral-50 px-1.5 py-0.5 font-mono text-[10px] text-neutral-500 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-400">
              {kbd}
            </kbd>
          )}
        </button>
      </li>
    );
  };

  return (
    <Modal open={open} onDismiss={close} align="top" widthClass="max-w-lg">
      <input
        ref={inputRef}
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') {
            e.preventDefault();
            setActiveIndex((i) => Math.min(filtered.length - 1, i + 1));
          } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setActiveIndex((i) => Math.max(0, i - 1));
          } else if (e.key === 'Enter') {
            e.preventDefault();
            runActive();
          }
        }}
        placeholder="Type a command…"
        className="w-full border-neutral-200 border-b bg-transparent px-4 py-3 text-neutral-900 text-sm outline-none placeholder:text-neutral-400 dark:border-neutral-800 dark:text-neutral-100"
      />
      <ul className="max-h-[60vh] overflow-y-auto py-1.5">
        {filtered.length === 0 && (
          <li className="px-4 py-3 text-neutral-500 text-sm">No matches.</li>
        )}
        {sections === null
          ? // Filtered view: flat, sorted by score.
            filtered.map((cmd, idx) => renderRow(cmd, idx))
          : // Unfiltered view: per-group sections with a header before each
            // bucket. The running `flatIdx` keeps the row's index in sync
            // with the flat `filtered` list so the active-row arrow keys
            // continue to work across section boundaries.
            (() => {
              let flatIdx = 0;
              return sections.map((section) => (
                <Fragment key={section.group}>
                  <li
                    aria-hidden="true"
                    className="select-none px-4 pt-3 pb-1 font-semibold text-[10px] text-neutral-400 uppercase tracking-wider dark:text-neutral-500"
                  >
                    {section.group}
                  </li>
                  {section.items.map((cmd) => renderRow(cmd, flatIdx++))}
                </Fragment>
              ));
            })()}
      </ul>
    </Modal>
  );
}
