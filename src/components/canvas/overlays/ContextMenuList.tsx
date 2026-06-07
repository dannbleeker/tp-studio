import { ChevronRight } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useOutsideAndEscape } from '@/hooks/useOutsideAndEscape';
import { guardWriteOrToast } from '@/services/browseLock';
import type { MenuItem } from './contextMenuItems';

/**
 * Session 135 — extracted from `ContextMenu.tsx` (file split). The
 * presentational list — the role="menu" surface, the
 * separator/header/action/submenu row rendering, and the keyboard navigation
 * (ArrowUp/Down, Home/End, focus-first-on-open) — is self-contained.
 * `ContextMenu.tsx` owns building the `items` array (the branch logic that
 * needs the store closure); this component renders + drives focus. Esc /
 * outside-click close stays on the parent via `useOutsideAndEscape`.
 *
 * Session 138 — `submenu` items render as a "label ▸" row that reveals a
 * nested flyout (used to fold the long "Convert to" type list into one row).
 */

const ACTION_ROW =
  'flex w-full items-center justify-between px-3 py-1.5 text-left text-sm transition';
const rowClass = (destructive?: boolean): string =>
  destructive
    ? `${ACTION_ROW} text-red-700 hover:bg-red-50 dark:text-red-300 dark:hover:bg-red-950/30`
    : `${ACTION_ROW} text-neutral-700 hover:bg-neutral-100 dark:text-neutral-200 dark:hover:bg-neutral-900`;

/**
 * A "label ▸" row that reveals a nested flyout of action rows. Opens on
 * **hover** (the primary path) and on **click** (a just-in-case fallback —
 * hover almost always fires first). Keyboard: `→` / Enter opens + focuses the
 * first sub-item; `←` closes + returns focus to the row; the flyout's own
 * ArrowUp/Down walk its items. `flipLeft` opens the flyout to the LEFT when
 * the menu is near the right viewport edge so it never runs off-screen.
 */
function ContextSubmenuRow({
  label,
  items,
  flipLeft,
  onRun,
}: {
  label: string;
  items: MenuItem[];
  flipLeft: boolean;
  onRun: (run: () => void) => void;
}) {
  const [open, setOpen] = useState(false);
  const rowRef = useRef<HTMLButtonElement | null>(null);
  const flyoutRef = useRef<HTMLDivElement | null>(null);

  const actions = items.filter(
    (i): i is Extract<MenuItem, { kind: 'action' }> => i.kind === 'action'
  );

  const focusFirst = (): void => {
    queueMicrotask(() =>
      flyoutRef.current?.querySelector<HTMLButtonElement>('button[role="menuitem"]')?.focus()
    );
  };

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: the wrapper is a pure hover region (positioning + open/close on enter/leave); keyboard users open the submenu via the row button's ArrowRight/Enter handler below.
    <div
      className="relative"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        ref={rowRef}
        type="button"
        role="menuitem"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowRight' || e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setOpen(true);
            focusFirst();
          }
        }}
        className={rowClass(false)}
      >
        <span>{label}</span>
        <ChevronRight className="-mr-0.5 h-3.5 w-3.5 shrink-0 text-neutral-400" aria-hidden />
      </button>
      {open && (
        <div
          ref={flyoutRef}
          role="menu"
          className={`absolute top-0 ${flipLeft ? 'right-full mr-1' : 'left-full ml-1'} max-h-[60vh] min-w-[180px] overflow-y-auto rounded-md border border-neutral-200 bg-white py-1 shadow-lg dark:border-neutral-800 dark:bg-neutral-950`}
          onKeyDown={(e) => {
            const btns = Array.from(
              flyoutRef.current?.querySelectorAll<HTMLButtonElement>('button[role="menuitem"]') ??
                []
            );
            if (btns.length === 0) return;
            const active = document.activeElement as HTMLButtonElement | null;
            const idx = active ? btns.indexOf(active) : -1;
            const focus = (i: number) => {
              btns[((i % btns.length) + btns.length) % btns.length]?.focus();
              e.preventDefault();
            };
            if (e.key === 'ArrowDown') focus(idx + 1);
            else if (e.key === 'ArrowUp') focus(idx - 1);
            else if (e.key === 'ArrowLeft') {
              e.preventDefault();
              setOpen(false);
              rowRef.current?.focus();
            }
          }}
        >
          {actions.map((sub, i) => {
            // Positional + ephemeral like the parent list — index is the correct
            // identity (type labels are distinct today, but a future submenu
            // could repeat one). Local var keeps `key={key}` lint-clean.
            const key = `${i}:${sub.label}`;
            return (
              <button
                key={key}
                type="button"
                role="menuitem"
                data-submenu-item=""
                onClick={() => onRun(sub.run)}
                className={rowClass(sub.destructive)}
              >
                <span>{sub.label}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

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
    // `:not([data-submenu-item])` keeps top-level arrow-key nav on the
    // top-level rows even while a submenu flyout (whose rows are tagged) is
    // open — the flyout drives its own ArrowUp/Down.
    const buttons = Array.from(
      ref.current.querySelectorAll<HTMLButtonElement>(
        'button[role="menuitem"]:not([data-submenu-item])'
      )
    );
    if (buttons.length === 0) return;
    const active = document.activeElement as HTMLButtonElement | null;
    const idx = active ? buttons.indexOf(active) : -1;
    // While the flyout has focus (active is a submenu item), leave nav to it.
    if (active?.hasAttribute('data-submenu-item')) return;
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

  // Open submenus to the LEFT when the menu sits near the right viewport edge
  // (~a menu width + a flyout width) so the flyout never runs off-screen.
  const viewportWidth = typeof window === 'undefined' ? 1024 : window.innerWidth;
  const flipLeft = x + 360 > viewportWidth;

  const runAction = (run: () => void): void => {
    onClose();
    if (!guardWriteOrToast()) return;
    run();
  };

  return (
    <div
      ref={ref}
      className="fixed z-40 min-w-[180px] rounded-md border border-neutral-200 bg-white py-1 shadow-lg dark:border-neutral-800 dark:bg-neutral-950"
      style={{ top: y, left: x }}
      role="menu"
      // Session 88 (S15) — tabIndex makes the container focusable so focus
      // inside the menu doesn't escape on the first Tab.
      tabIndex={-1}
      onKeyDown={onMenuKeyDown}
    >
      {items.map((item, idx) => {
        // Menu items are positional and ephemeral — the items array is rebuilt
        // fresh on every open and never reordered, so the array index is the
        // correct React identity. A label-based key collides when two items
        // share a label (several untitled edges in the edge-picker, or two
        // "Delete" rows). Binding to a local keeps `key={key}` correct without
        // tripping the index-key lint.
        const key = `${item.kind}:${idx}`;
        if (item.kind === 'separator') {
          return <div key={key} className="my-1 h-px bg-neutral-200 dark:bg-neutral-800" />;
        }
        if (item.kind === 'header') {
          return (
            <div
              key={key}
              className="px-3 pt-1.5 pb-1 font-semibold text-[10px] text-neutral-500 uppercase tracking-wider dark:text-neutral-400"
            >
              {item.label}
            </div>
          );
        }
        if (item.kind === 'submenu') {
          return (
            <ContextSubmenuRow
              key={key}
              label={item.label}
              items={item.items}
              flipLeft={flipLeft}
              onRun={runAction}
            />
          );
        }
        return (
          <button
            key={key}
            type="button"
            role="menuitem"
            onClick={() => runAction(item.run)}
            className={rowClass(item.destructive)}
          >
            <span>{item.label}</span>
          </button>
        );
      })}
    </div>
  );
}
