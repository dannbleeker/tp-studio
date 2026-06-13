import {
  HelpCircle,
  History,
  Lock,
  LockOpen,
  MessageSquare,
  Moon,
  MoreVertical,
  Network,
  Orbit,
  PanelRight,
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
import { useAutoFocusFirstEnabled } from '@/hooks/useAutoFocusFirstEnabled';
import { useOutsideAndEscape } from '@/hooks/useOutsideAndEscape';
import { useDocumentStore } from '@/store';
import { Button } from '../ui/Button';
import { useToolbarActions } from './useToolbarActions';

/**
 * Overflow "More actions" menu — a single ▾ trigger, visible at EVERY width
 * (Session 182). It absorbs the secondary toolbar controls the redesign moved
 * off the bar: Browse Lock, Inspector toggle, Layout mode, Help, and Theme are
 * always here. Undo / Redo / History / Comments ALSO appear here, but only below
 * `lg` — where the TopBar collapses their clusters — so they stay reachable
 * without duplicating at desktop widths.
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
    commentsPanelOpen,
    inspectorHidden,
    showLayoutToggle,
    canUndo,
    canRedo,
    toggleTheme,
    openHelp,
    toggleHistoryPanel,
    toggleCommentsPanel,
    toggleInspector,
    setLayoutMode,
    undo,
    redo,
  } = useToolbarActions();
  const browseLocked = useDocumentStore((s) => s.browseLocked);
  const setBrowseLocked = useDocumentStore((s) => s.setBrowseLocked);

  useOutsideAndEscape(containerRef, () => setOpen(false), open);
  useAutoFocusFirstEnabled(menuRef, open, '[role="menuitem"], [role="menuitemcheckbox"]');
  // Restore focus to the trigger ONLY when the menu closes (open: true → false),
  // never on initial mount. Before Session 182 the kebab was `sm:hidden`, so a
  // mount-time `.focus()` was a no-op on desktop (can't focus a display:none
  // element); now that the overflow is always shown, focusing on mount would
  // steal focus on load and swallow bare-key shortcuts (e.g. `e` → Quick
  // Capture, `+/-/0` → zoom, which defer to a focused control).
  const wasOpen = useRef(false);
  useEffect(() => {
    if (!open && wasOpen.current) triggerRef.current?.focus({ preventScroll: true });
    wasOpen.current = open;
  }, [open]);

  const close = () => setOpen(false);
  const runAndClose = (fn: () => void) => () => {
    fn();
    close();
  };

  // ArrowUp/Down + Home/End move between items; Tab closes. Skip both disabled
  // AND responsively-hidden items (`offsetParent === null`) so the walk never
  // lands on a `lg:hidden` row at desktop widths.
  const onMenuKeyDown = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    const items = Array.from(
      menuRef.current?.querySelectorAll<HTMLButtonElement>(
        '[role="menuitem"], [role="menuitemcheckbox"]'
      ) ?? []
    );
    // Skip both disabled AND responsively-hidden (`lg:hidden`) items so the walk
    // never lands on a `display:none` row at desktop widths. `getComputedStyle`
    // (not `offsetParent`, which is always null under jsdom) keeps this correct
    // in the browser and inert in tests, where no stylesheet sets `display`.
    const enabled = items.filter((el) => !el.disabled && getComputedStyle(el).display !== 'none');
    if (enabled.length === 0) return;
    const active = document.activeElement as HTMLButtonElement | null;
    const idx = active ? enabled.indexOf(active) : -1;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      enabled[(idx + 1) % enabled.length]?.focus();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      enabled[(idx - 1 + enabled.length) % enabled.length]?.focus();
    } else if (e.key === 'Home') {
      e.preventDefault();
      enabled[0]?.focus();
    } else if (e.key === 'End') {
      e.preventDefault();
      enabled[enabled.length - 1]?.focus();
    } else if (e.key === 'Tab') {
      close();
    }
  };

  const itemClass =
    'flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-neutral-700 hover:bg-neutral-100 dark:text-neutral-200 dark:hover:bg-neutral-800';

  return (
    <div ref={containerRef} className="relative">
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
          {/* Undo / Redo / History / Comments — only below lg (the TopBar shows
              them as standalone buttons at lg+). */}
          <button
            type="button"
            role="menuitem"
            className={`${itemClass} lg:hidden`}
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
            className={`${itemClass} lg:hidden`}
            onClick={runAndClose(redo)}
            disabled={!canRedo}
            aria-disabled={!canRedo}
          >
            <Redo2 className="h-3.5 w-3.5" />
            <span>Redo</span>
          </button>
          <button
            type="button"
            role="menuitemcheckbox"
            className={`${itemClass} lg:hidden`}
            onClick={runAndClose(toggleHistoryPanel)}
            aria-checked={historyPanelOpen}
          >
            <History className="h-3.5 w-3.5" />
            <span>{historyPanelOpen ? 'Close history' : 'Open history'}</span>
          </button>
          <button
            type="button"
            role="menuitemcheckbox"
            className={`${itemClass} lg:hidden`}
            onClick={runAndClose(toggleCommentsPanel)}
            aria-checked={commentsPanelOpen}
          >
            <MessageSquare className="h-3.5 w-3.5" />
            <span>{commentsPanelOpen ? 'Close comments' : 'Open comments'}</span>
          </button>
          {/* Always-in-overflow controls. */}
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
            role="menuitemcheckbox"
            className={itemClass}
            onClick={runAndClose(toggleInspector)}
            aria-checked={!inspectorHidden}
          >
            <PanelRight className="h-3.5 w-3.5" />
            <span>{inspectorHidden ? 'Show inspector' : 'Hide inspector'}</span>
          </button>
          <button
            type="button"
            role="menuitemcheckbox"
            className={itemClass}
            onClick={runAndClose(() => setBrowseLocked(!browseLocked))}
            aria-checked={browseLocked}
          >
            {browseLocked ? <Lock className="h-3.5 w-3.5" /> : <LockOpen className="h-3.5 w-3.5" />}
            <span>{browseLocked ? 'Unlock document' : 'Lock for browsing'}</span>
          </button>
          <button
            type="button"
            role="menuitem"
            className={itemClass}
            onClick={runAndClose(openHelp)}
          >
            <HelpCircle className="h-3.5 w-3.5" />
            <span>Help</span>
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
