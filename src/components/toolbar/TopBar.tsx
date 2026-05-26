import { HelpCircle, History, Lock, LockOpen, Moon, Redo2, Search, Sun, Undo2 } from 'lucide-react';
import { SHORTCUT_BY_ID, shortcutToAria } from '@/domain/shortcuts';
import { useDocumentStore } from '@/store';
import { Button } from '../ui/Button';
import { KebabMenu } from './KebabMenu';
import { useToolbarActions } from './useToolbarActions';

/**
 * Session 93 — Tailwind breakpoint reference for this codebase.
 *
 * Standard Tailwind breakpoints (min-width):
 *   - `xs:`  480 px — custom breakpoint added Session 83. Used by
 *     TitleBadge to keep the Info button visible at phone-narrow.
 *   - `sm:`  640 px — default Tailwind. Most TopBar features unhide
 *     here (Commands kbd hint, Undo/Redo, History, Help, Theme).
 *     Below `sm` they collapse into the KebabMenu.
 *   - `md:`  768 px — default Tailwind. Inspector becomes pinned
 *     (vs. modal-style overlay below). Layout-mode select unhides.
 *   - `lg:`  1024 px — default Tailwind. Currently unused; the
 *     brief said "responsive down to 1024 px is enough," so this
 *     is the lower bound, not a hide-threshold.
 *
 * Picking which breakpoint to hide a feature at: ask "is this
 * feature reachable via another surface (palette, kebab) at smaller
 * widths?" If yes, hide at `sm`. If no, keep visible across widths.
 */
export function TopBar() {
  // Subscriptions shared with the `<sm`-only KebabMenu (theme, layout
  // mode, history, help, layout-toggle visibility) live in the shared hook
  // so both surfaces stay in sync and we register a single shallow-equal
  // selector for the cluster instead of one per primitive.
  // Session 136 — `layoutMode` / `setLayoutMode` / `showLayoutToggle`
  // dropped from the topbar's destructure because the standalone Flow
  // ↔ Radial picker moved into the kebab menu. The KebabMenu still
  // subscribes via the same hook, so the shared selector stays in
  // place; we just don't read those fields here anymore.
  const {
    theme,
    historyPanelOpen,
    canUndo,
    canRedo,
    toggleTheme,
    openHelp,
    toggleHistoryPanel,
    undo,
    redo,
  } = useToolbarActions();
  // The remaining three are TopBar-specific (KebabMenu doesn't surface
  // them) so they stay as individual selectors.
  const togglePalette = useDocumentStore((s) => s.togglePalette);
  const browseLocked = useDocumentStore((s) => s.browseLocked);
  const setBrowseLocked = useDocumentStore((s) => s.setBrowseLocked);

  const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);
  const cmdKey = isMac ? '⌘' : 'Ctrl';

  // `aria-keyshortcuts` lets screen readers announce the available
  // keyboard shortcut alongside the button label. Derived from the
  // shortcut registry so a future key remap propagates here.
  const paletteAria = shortcutToAria(SHORTCUT_BY_ID.palette?.keys ?? '');

  return (
    <div data-component="top-bar" className="absolute top-4 right-4 z-10 flex items-center gap-2">
      {/* Below sm we collapse the Commands button to an icon to free up
          horizontal space; above sm, the full text + kbd hint shows. The
          full label is always reachable via the title tooltip. */}
      <Button
        variant="softNeutral"
        onClick={togglePalette}
        className="pointer-events-auto sm:hidden"
        size="icon"
        title={`Commands  ${cmdKey}+K`}
        aria-label="Commands"
        aria-keyshortcuts={paletteAria}
      >
        <Search className="h-3.5 w-3.5" />
      </Button>
      <Button
        variant="softNeutral"
        onClick={togglePalette}
        className="pointer-events-auto hidden sm:inline-flex"
        title={`${cmdKey}+K`}
        aria-keyshortcuts={paletteAria}
      >
        <Search className="h-3.5 w-3.5" />
        <span>Commands</span>
        <kbd className="ml-1 rounded-sm border border-neutral-200 bg-neutral-50 px-1.5 py-0.5 font-mono text-[10px] text-neutral-500 dark:border-neutral-800 dark:bg-neutral-900">
          {cmdKey}+K
        </kbd>
      </Button>
      {/* Session 87 (S26) — Undo / Redo affordances. Cmd+Z / Cmd+Shift+Z
          already work via the global shortcut registry; these buttons
          surface the same actions visually so users who don't know
          the keyboard shortcut can still reach them. Disabled state
          reads `past.length` / `future.length` from the history slice.
          sm+ only — kebab handles narrower viewports. */}
      <Button
        variant="softNeutral"
        size="icon"
        onClick={undo}
        disabled={!canUndo}
        className="pointer-events-auto hidden sm:inline-flex"
        aria-label="Undo"
        title={canUndo ? `Undo  ${cmdKey}+Z` : 'Nothing to undo'}
      >
        <Undo2 className="h-3.5 w-3.5" />
      </Button>
      <Button
        variant="softNeutral"
        size="icon"
        onClick={redo}
        disabled={!canRedo}
        className="pointer-events-auto hidden sm:inline-flex"
        aria-label="Redo"
        title={canRedo ? `Redo  ${cmdKey}+Shift+Z` : 'Nothing to redo'}
      >
        <Redo2 className="h-3.5 w-3.5" />
      </Button>
      {/* Session 133 — reverts the Session 92 single-icon decision per
          user feedback. The Lock ↔ LockOpen swap now joins the violet ↔
          neutral color variant: redundant cues are an accessibility
          win (icon-only viewers + color-blind users get the same
          signal twice), and the closed-padlock glyph reads as
          "locked NOW" more decisively than a single static icon. */}
      <Button
        variant={browseLocked ? 'softViolet' : 'softNeutral'}
        size="icon"
        onClick={() => setBrowseLocked(!browseLocked)}
        className="pointer-events-auto"
        aria-label={browseLocked ? 'Unlock document' : 'Lock document for browsing'}
        title={browseLocked ? 'Browse Lock on — click to unlock' : 'Lock for read-only browsing'}
        aria-pressed={browseLocked}
      >
        {browseLocked ? <Lock className="h-3.5 w-3.5" /> : <LockOpen className="h-3.5 w-3.5" />}
      </Button>
      {/* Session 136 — layout-mode picker removed from the topbar per
          Dann's usage feedback ("the [Flow] button on the canvas
          should be put into a menu"). The control lives in the kebab
          menu now, which Session 136 also makes visible at every
          viewport width (was sm:hidden). Trade-off: one extra click
          to switch Flow ↔ Radial on desktop, but the canvas chrome
          loses a 100-px-wide element that the user was rarely
          changing. The Cmd+K palette command still reaches the
          toggle for keyboard-driven flows. */}
      {/* H1 history panel toggle. Visible at sm+ (like Help / Theme); the
          palette command "Open history…" still reaches it on phone-narrow.
          aria-pressed reflects the open state so screen readers announce
          the toggle state correctly. */}
      <Button
        variant={historyPanelOpen ? 'softViolet' : 'softNeutral'}
        size="icon"
        onClick={toggleHistoryPanel}
        className="pointer-events-auto hidden sm:inline-flex"
        aria-label={historyPanelOpen ? 'Close history' : 'Open history'}
        title={historyPanelOpen ? 'Close history' : 'Open revision history'}
        aria-pressed={historyPanelOpen}
      >
        <History className="h-3.5 w-3.5" />
      </Button>
      {/* Help + Theme buttons appear from `sm` upward (640 px+). Below that
          they're hidden to keep the toolbar from wrapping; the palette
          ("Show keyboard shortcuts", "Toggle dark mode") still reaches both
          on phone-narrow viewports. Previously gated at `md` (768 px), which
          left the buttons off-screen on common ~720 px tablets in portrait. */}
      <Button
        variant="softNeutral"
        size="icon"
        onClick={openHelp}
        className="pointer-events-auto hidden sm:inline-flex"
        aria-label="Keyboard shortcuts"
      >
        <HelpCircle className="h-3.5 w-3.5" />
      </Button>
      <Button
        variant="softNeutral"
        size="icon"
        onClick={toggleTheme}
        className="pointer-events-auto hidden sm:inline-flex"
        aria-label="Toggle dark mode"
      >
        {theme === 'dark' ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
      </Button>
      {/* Phone-narrow kebab. Self-hides at `sm:` and above (see KebabMenu).
          Surfaces Layout / History / Help / Theme so they're reachable on
          touch without a hardware keyboard for the palette. */}
      <KebabMenu />
    </div>
  );
}
