import clsx from 'clsx';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useDocumentStore } from '../../store';
import { COMMANDS, type Command } from './commands';

const score = (cmd: Command, query: string): number => {
  if (!query) return 0;
  const q = query.toLowerCase();
  const l = cmd.label.toLowerCase();
  if (l === q) return 100;
  if (l.startsWith(q)) return 80;
  if (l.includes(q)) return 50;
  // letter-by-letter subsequence
  let i = 0;
  for (const ch of l) {
    if (i < q.length && ch === q[i]) i++;
  }
  return i === q.length ? 20 : -1;
};

export function CommandPalette() {
  const open = useDocumentStore((s) => s.paletteOpen);
  const initialQuery = useDocumentStore((s) => s.paletteInitialQuery);
  const close = useDocumentStore((s) => s.closePalette);
  const store = useDocumentStore;

  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const filtered = useMemo(() => {
    if (!query) return COMMANDS;
    return COMMANDS.map((c) => ({ c, s: score(c, query) }))
      .filter(({ s }) => s >= 0)
      .sort((a, b) => b.s - a.s)
      .map(({ c }) => c);
  }, [query]);

  useEffect(() => {
    if (open) {
      setQuery(initialQuery);
      setActiveIndex(0);
      // Focus on next tick after the dialog renders
      const t = setTimeout(() => inputRef.current?.focus(), 0);
      return () => clearTimeout(t);
    }
    return undefined;
  }, [open, initialQuery]);

  useEffect(() => {
    if (activeIndex >= filtered.length) setActiveIndex(0);
  }, [filtered.length, activeIndex]);

  if (!open) return null;

  const runActive = () => {
    const cmd = filtered[activeIndex];
    if (!cmd) return;
    close();
    cmd.run(store.getState());
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-neutral-900/30 px-4 pt-[15vh] backdrop-blur-sm"
      onClick={close}
      onKeyDown={(e) => {
        if (e.key === 'Escape') close();
      }}
      role="presentation"
    >
      <dialog
        open
        className="w-full max-w-lg overflow-hidden rounded-xl border border-neutral-200 bg-white p-0 shadow-2xl dark:border-neutral-800 dark:bg-neutral-950"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
        aria-modal="true"
      >
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              e.preventDefault();
              close();
            } else if (e.key === 'ArrowDown') {
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
          className="w-full border-b border-neutral-200 bg-transparent px-4 py-3 text-sm text-neutral-900 outline-none placeholder:text-neutral-400 dark:border-neutral-800 dark:text-neutral-100"
        />
        <ul className="max-h-[60vh] overflow-y-auto py-1.5">
          {filtered.length === 0 && (
            <li className="px-4 py-3 text-sm text-neutral-500">No matches.</li>
          )}
          {filtered.map((cmd, idx) => (
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
                <span className="flex flex-col">
                  <span>{cmd.label}</span>
                  <span className="text-[10px] uppercase tracking-wider text-neutral-400">
                    {cmd.group}
                  </span>
                </span>
                {cmd.shortcut && (
                  <kbd className="rounded border border-neutral-200 bg-neutral-50 px-1.5 py-0.5 font-mono text-[10px] text-neutral-500 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-400">
                    {cmd.shortcut}
                  </kbd>
                )}
              </button>
            </li>
          ))}
        </ul>
      </dialog>
    </div>
  );
}
