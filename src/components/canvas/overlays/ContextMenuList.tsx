import { useEffect, useRef } from 'react';
import { useOutsideAndEscape } from '@/hooks/useOutsideAndEscape';
import { guardWriteOrToast } from '@/services/browseLock';
import type { MenuItem } from './contextMenuItems';

/**
 * Session 135 — extracted from `ContextMenu.tsx` (file split). The
 * presentational list — the role="menu" surface, the
 * separator/header/action row rendering, and the keyboard navigation
 * (ArrowUp/Down, Home/End, focus-first-on-open) — is self-contained.
 * `ContextMenu.tsx` owns building the `items` array (the branch logic
 * that needs the store closure); this component just renders + drives
 * focus. Esc / outside-click close stays on the parent via
 * `useOutsideAndEscape`.
 */
export function ContextMenuList({
  items,
  x,
  y,
  onClose,
}: {
  items: MenuItem[];
  x: number;
  y: number;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  // The menu only mounts while open, so close-on-outside-click / Esc is
  // always active here. Lives with the ref it watches.
  useOutsideAndEscape(ref, onClose, true);

  // Session 88 (S15) — focus the first menuitem on open so ArrowDown /
  // ArrowUp work immediately without requiring Tab. Microtask delay so
  // React mounts the menu children before we query for them.
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    queueMicrotask(() => {
      const first = node.querySelector<HTMLButtonElement>('button[role="menuitem"]');
      first?.focus();
    });
  }, []);

  const onMenuKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (!ref.current) return;
    const buttons = Array.from(
      ref.current.querySelectorAll<HTMLButtonElement>('button[role="menuitem"]')
    );
    if (buttons.length === 0) return;
    const active = document.activeElement as HTMLButtonElement | null;
    const idx = active ? buttons.indexOf(active) : -1;
    const focus = (i: number) => {
      const n = ((i % buttons.length) + buttons.length) % buttons.length;
      buttons[n]?.focus();
      e.preventDefault();
    };
    if (e.key === 'ArrowDown') focus(idx + 1);
    else if (e.key === 'ArrowUp') focus(idx - 1);
    else if (e.key === 'Home') focus(0);
    else if (e.key === 'End') focus(buttons.length - 1);
  };

  return (
    <div
      ref={ref}
      className="fixed z-40 min-w-[180px] overflow-hidden rounded-md border border-neutral-200 bg-white py-1 shadow-lg dark:border-neutral-800 dark:bg-neutral-950"
      style={{ top: y, left: x }}
      role="menu"
      // Session 88 (S15) — tabIndex makes the container focusable so
      // focus inside the menu doesn't escape on the first Tab.
      tabIndex={-1}
      onKeyDown={onMenuKeyDown}
    >
      {items.map((item, idx) => {
        const stableKey =
          item.kind === 'separator'
            ? `sep:${idx}`
            : item.kind === 'header'
              ? `hdr:${item.label}`
              : `act:${item.label}`;
        if (item.kind === 'separator') {
          return <div key={stableKey} className="my-1 h-px bg-neutral-200 dark:bg-neutral-800" />;
        }
        if (item.kind === 'header') {
          return (
            <div
              key={stableKey}
              className="px-3 pt-1.5 pb-1 font-semibold text-[10px] text-neutral-500 uppercase tracking-wider dark:text-neutral-400"
            >
              {item.label}
            </div>
          );
        }
        return (
          <button
            key={stableKey}
            type="button"
            role="menuitem"
            onClick={() => {
              onClose();
              if (!guardWriteOrToast()) return;
              item.run();
            }}
            className={
              item.destructive
                ? 'flex w-full items-center justify-between px-3 py-1.5 text-left text-red-700 text-sm transition hover:bg-red-50 dark:text-red-300 dark:hover:bg-red-950/30'
                : 'flex w-full items-center justify-between px-3 py-1.5 text-left text-neutral-700 text-sm transition hover:bg-neutral-100 dark:text-neutral-200 dark:hover:bg-neutral-900'
            }
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}
