import { useOutsideAndEscape } from '@/hooks/useOutsideAndEscape';
import {
  HelpCircle,
  History,
  Moon,
  MoreVertical,
  Network,
  Orbit,
  Redo2,
  Sun,
  Undo2,
} from 'lucide-react';
import {
  type KeyboardEvent as ReactKeyboardEvent,
  useEffect,
  useId,
  useRef,
  useState,
} from 'react';
import { Button } from '../ui/Button';
import { useToolbarActions } from './useToolbarActions';

/**
 * Phone-narrow (`< sm`, 640 px) kebab menu — surfaces the toolbar buttons
 * that hide on narrow viewports (Layout Mode, History, Help, Theme) behind
 * a single icon. Without this, those actions are only reachable via the
 * command palette, which is awkward on touch devices without a hardware
 * keyboard.
 *
 * Hidden at `sm:` and above where the buttons render directly in the
 * TopBar. Browse Lock and the Commands button live outside the kebab
 * because they're the primary CTAs and remain visible at every width.
 */
export function KebabMenu() {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuId = useId();

  const {
    theme,
    layoutMode,
    historyPanelOpen,
    showLayoutToggle,
    canUndo,
    canRedo,
    toggleTheme,
    openHelp,
    toggleHistoryPanel,
    setLayoutMode,
    undo,
    redo,
  } = useToolbarActions();

  useOutsideAndEscape(containerRef, () => setOpen(false), open);

  // When the menu opens, focus the first ENABLED item so a keyboard user
  // lands inside the menu instead of staying on the trigger. Disabled
  // items (e.g. Undo when there's nothing to undo) can't accept focus
  // and would otherwise leave the trigger as activeElement. When the
  // menu closes, restore focus to the trigger so Tab continues from
  // where the user was. Matches the WAI-ARIA menu pattern.
  useEffect(() => {
    if (open) {
      const items = menuRef.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]');
      const firstEnabled = items ? Array.from(items).find((el) => !el.disabled) : undefined;
      firstEnabled?.focus();
    } else {
      triggerRef.current?.focus({ preventScroll: true });
    }
  }, [open]);

  const close = () => setOpen(false);
  const runAndClose = (fn: () => void) => () => {
    fn();
    close();
  };

  // ArrowUp/ArrowDown move focus between menuitems; Home/End jump to the
  // ends; Tab closes the menu (and the useEffect above restores focus to
  // the trigger). Enter / Space activate the focused item — which the
  // native <button> already handles.
  //
  // Session 92 — skip disabled items in the walk (the Undo/Redo rows
  // are disabled when there's no history to undo/redo). Walking past
  // them by stepping `(idx ± 1)` mod-length would land on a button
  // that can't actually accept focus, leaving activeElement on the
  // previous item and looking like the key did nothing.
  const onMenuKeyDown = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    const items = Array.from(
      menuRef.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]') ?? []
    );
    if (items.length === 0) return;
    const enabled = items.filter((el) => !el.disabled);
    if (enabled.length === 0) return;
    const active = document.activeElement as HTMLButtonElement | null;
    const idx = active ? enabled.indexOf(active) : -1;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      const next = enabled[(idx + 1) % enabled.length];
      next?.focus();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      const next = enabled[(idx - 1 + enabled.length) % enabled.length];
      next?.focus();
    } else if (e.key === 'Home') {
      e.preventDefault();
      enabled[0]?.focus();
    } else if (e.key === 'End') {
      e.preventDefault();
      enabled[enabled.length - 1]?.focus();
    } else if (e.key === 'Tab') {
      // Tab away closes the menu. Let the browser's natural Tab handler
      // move focus to the next focusable element on the page.
      close();
    }
  };

  // Single-item layout helper: lucide icon + text label, padded for touch.
  const itemClass =
    'flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-neutral-700 hover:bg-neutral-100 dark:text-neutral-200 dark:hover:bg-neutral-800';

  return (
    <div ref={containerRef} className="relative sm:hidden">
      <Button
        ref={triggerRef}
        variant={open ? 'softViolet' : 'softNeutral'}
        size="icon"
        onClick={() => setOpen((v) => !v)}
        className="pointer-events-auto"
        aria-label="More actions"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
      >
        <MoreVertical className="h-3.5 w-3.5" />
      </Button>
      {open && (
        <div
          id={menuId}
          ref={menuRef}
          role="menu"
          aria-label="More actions"
          onKeyDown={onMenuKeyDown}
          className="absolute top-full right-0 z-30 mt-1 w-48 overflow-hidden rounded-md border border-neutral-200 bg-white shadow-lg dark:border-neutral-800 dark:bg-neutral-950"
        >
          {/* Session 92 — Undo / Redo in the kebab so the affordance
              isn't hidden from narrow viewports. The sm+ TopBar
              already surfaces these as standalone icons (Session 87).
              Disabled states mirror the TopBar buttons. */}
          <button
            type="button"
            role="menuitem"
            className={itemClass}
            onClick={runAndClose(undo)}
            disabled={!canUndo}
            aria-disabled={!canUndo}
          >
            <Undo2 className="h-3.5 w-3.5" />
            <span>Undo</span>
          </button>
          <button
            type="button"
            role="menuitem"
            className={itemClass}
            onClick={runAndClose(redo)}
            disabled={!canRedo}
            aria-disabled={!canRedo}
          >
            <Redo2 className="h-3.5 w-3.5" />
            <span>Redo</span>
          </button>
          {showLayoutToggle && (
            <button
              type="button"
              role="menuitem"
              className={itemClass}
              onClick={runAndClose(() => setLayoutMode(layoutMode === 'flow' ? 'radial' : 'flow'))}
            >
              {layoutMode === 'flow' ? (
                <Orbit className="h-3.5 w-3.5" />
              ) : (
                <Network className="h-3.5 w-3.5" />
              )}
              <span>{layoutMode === 'flow' ? 'Radial layout' : 'Flow layout'}</span>
            </button>
          )}
          <button
            type="button"
            role="menuitem"
            className={itemClass}
            onClick={runAndClose(toggleHistoryPanel)}
            aria-pressed={historyPanelOpen}
          >
            <History className="h-3.5 w-3.5" />
            <span>{historyPanelOpen ? 'Close history' : 'Open history'}</span>
          </button>
          <button
            type="button"
            role="menuitem"
            className={itemClass}
            onClick={runAndClose(openHelp)}
          >
            <HelpCircle className="h-3.5 w-3.5" />
            <span>Keyboard shortcuts</span>
          </button>
          <button
            type="button"
            role="menuitem"
            className={itemClass}
            onClick={runAndClose(toggleTheme)}
          >
            {theme === 'dark' ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
            <span>{theme === 'dark' ? 'Light mode' : 'Dark mode'}</span>
          </button>
        </div>
      )}
    </div>
  );
}
