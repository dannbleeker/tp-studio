import { paletteScore } from '@/domain/paletteScore';
import { paletteKbdForCommand } from '@/domain/shortcuts';
import { getRecentCommandIds, recordRecentCommand } from '@/services/recentCommands';
import { useDocumentStore } from '@/store';
import clsx from 'clsx';
import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { Modal } from '../ui/Modal';
import { iconForCommandId } from './commandIcons';
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
  // Session 88 (S17) — snapshot the recent-command id list on every
  // open. We don't subscribe; the list is small and only the active
  // tab needs to see it. Re-snapping on open means a command run in
  // a previous open shows up the next time the palette opens.
  const [recentIds, setRecentIds] = useState<string[]>([]);

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
   * Session 88 (S17) — recent commands rendered above the per-group
   * sections in the unfiltered view. Filter out any id that's no
   * longer a real command (id renames / removals between sessions)
   * so the row doesn't render a dead label.
   *
   * Returns the resolved Command list (most-recent first) or an
   * empty array if there's nothing to show.
   */
  const recentCommands = useMemo<Command[]>(() => {
    if (query) return [];
    if (recentIds.length === 0) return [];
    const byId = new Map(COMMANDS.map((c) => [c.id, c]));
    const list: Command[] = [];
    for (const id of recentIds) {
      const cmd = byId.get(id);
      if (cmd) list.push(cmd);
    }
    return list;
  }, [query, recentIds]);

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
    // Snapshot recents on open so a command run since the previous
    // open is visible. Reading from localStorage is cheap.
    setRecentIds(getRecentCommandIds());
    const t = setTimeout(() => inputRef.current?.focus(), 0);
    return () => clearTimeout(t);
  }, [open, initialQuery]);

  // Session 88 (S17) — the visible row order when no query is set:
  //   [recent commands] + [unfiltered grouped sections]
  // The active-index arrow-key handler needs a flat list to walk;
  // we build it once per render so the index→command mapping is
  // unambiguous regardless of which section a row appears in.
  const flatList = useMemo<Command[]>(() => {
    if (sections === null) return filtered;
    const rows: Command[] = [];
    for (const cmd of recentCommands) rows.push(cmd);
    for (const section of sections) for (const cmd of section.items) rows.push(cmd);
    return rows;
  }, [filtered, sections, recentCommands]);

  useEffect(() => {
    if (activeIndex >= flatList.length) setActiveIndex(0);
  }, [flatList.length, activeIndex]);

  const runCommand = (cmd: Command): void => {
    // Record before close — close clears state we'd otherwise rely on.
    recordRecentCommand(cmd.id);
    close();
    cmd.run(store.getState());
  };

  const runActive = () => {
    const cmd = flatList[activeIndex];
    if (!cmd) return;
    runCommand(cmd);
  };

  /**
   * Render one command row. The active row's index drives the violet
   * highlight + arrow-key target; mouse-enter snaps the active index to
   * the hovered row so keyboard and mouse don't fight over the cursor.
   *
   * The `idx` parameter is the index into the *flat* list (above) so
   * `runActive` and the arrow-key handler keep working unchanged
   * whether or not the list is currently sectioned.
   *
   * Session 88 (S16) — optional icon at the left. Icons are looked
   * up by command id from a central map (commandIcons.ts), not by
   * per-command annotation, so the visual identity stays auditable
   * in one place.
   */
  const renderRow = (cmd: Command, idx: number) => {
    const kbd = paletteKbdForCommand(cmd.id);
    const Icon = iconForCommandId(cmd.id);
    return (
      <li key={`${idx}-${cmd.id}`}>
        <button
          type="button"
          className={clsx(
            'flex w-full items-center justify-between gap-3 px-4 py-2 text-left text-sm transition',
            idx === activeIndex
              ? 'bg-indigo-50 text-indigo-900 dark:bg-indigo-950/50 dark:text-indigo-200'
              : 'text-neutral-700 hover:bg-neutral-50 dark:text-neutral-200 dark:hover:bg-neutral-900'
          )}
          onMouseEnter={() => setActiveIndex(idx)}
          onClick={() => runCommand(cmd)}
        >
          <span className="flex items-center gap-2">
            {Icon ? (
              <Icon
                className="h-3.5 w-3.5 shrink-0 text-neutral-400 dark:text-neutral-500"
                aria-hidden
              />
            ) : (
              <span className="h-3.5 w-3.5 shrink-0" aria-hidden />
            )}
            <span>{cmd.label}</span>
          </span>
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
            setActiveIndex((i) => Math.min(flatList.length - 1, i + 1));
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
        {flatList.length === 0 && (
          <li className="px-4 py-3 text-neutral-500 text-sm">No matches.</li>
        )}
        {sections === null
          ? // Filtered view: flat, sorted by score.
            filtered.map((cmd, idx) => renderRow(cmd, idx))
          : (() => {
              // Unfiltered view: recents (if any) + per-group sections.
              // The running `flatIdx` keeps the row's index in sync
              // with the `flatList` indices so the active-row arrow
              // keys continue to work across section boundaries.
              let flatIdx = 0;
              return (
                <>
                  {/* Session 88 (S17) — Recent section. Sticky-top
                      so the affordance is consistent regardless of
                      the rest of the palette's length. Hidden when
                      empty (no signal yet) or when the user starts
                      typing (filtered view takes over). */}
                  {recentCommands.length > 0 && (
                    <Fragment key="recent-section">
                      <li
                        role="presentation"
                        className="select-none px-4 pt-3 pb-1 font-semibold text-[10px] text-violet-500 uppercase tracking-wider dark:text-violet-400"
                      >
                        Recent
                      </li>
                      {recentCommands.map((cmd) => renderRow(cmd, flatIdx++))}
                    </Fragment>
                  )}
                  {sections.map((section) => (
                    <Fragment key={section.group}>
                      {/* Session 87 (S4) — `aria-hidden` removed so screen
                          readers announce category transitions when the
                          user walks the unfiltered palette. `role="presentation"`
                          keeps the header out of the listitem-count for
                          assistive tech without hiding it from the
                          accessibility tree entirely. */}
                      <li
                        role="presentation"
                        className="select-none px-4 pt-3 pb-1 font-semibold text-[10px] text-neutral-400 uppercase tracking-wider dark:text-neutral-500"
                      >
                        {section.group}
                      </li>
                      {section.items.map((cmd) => renderRow(cmd, flatIdx++))}
                    </Fragment>
                  ))}
                </>
              );
            })()}
      </ul>
    </Modal>
  );
}
