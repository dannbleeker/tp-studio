import { SHORTCUT_BY_ID, shortcutToAria } from '@/domain/shortcuts';
import { useDocumentStore } from '@/store';
import {
  HelpCircle,
  History,
  Lock,
  Moon,
  Network,
  Orbit,
  Redo2,
  Search,
  Sun,
  Undo2,
} from 'lucide-react';
import { Button } from '../ui/Button';
import { KebabMenu } from './KebabMenu';
import { useToolbarActions } from './useToolbarActions';

export function TopBar() {
  // Subscriptions shared with the `<sm`-only KebabMenu (theme, layout
  // mode, history, help, layout-toggle visibility) live in the shared hook
  // so both surfaces stay in sync and we register a single shallow-equal
  // selector for the cluster instead of one per primitive.
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
        <kbd className="ml-1 rounded border border-neutral-200 bg-neutral-50 px-1.5 py-0.5 font-mono text-[10px] text-neutral-500 dark:border-neutral-800 dark:bg-neutral-900">
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
      {/* Session 92 UI tidy S1 — single icon (Lock) at all times; the
          state is carried by the color variant alone. The previous
          Lock ↔ Unlock icon swap competed visually with the violet ↔
          neutral background swap — two signals for one piece of state
          made the toggle harder to scan, especially mid-glance. The
          padlock metaphor reads the same regardless of state; users
          look at the chip color to know if the lock is engaged. */}
      <Button
        variant={browseLocked ? 'softViolet' : 'softNeutral'}
        size="icon"
        onClick={() => setBrowseLocked(!browseLocked)}
        className="pointer-events-auto"
        aria-label={browseLocked ? 'Unlock document' : 'Lock document for browsing'}
        title={browseLocked ? 'Browse Lock on — click to unlock' : 'Lock for read-only browsing'}
        aria-pressed={browseLocked}
      >
        <Lock className="h-3.5 w-3.5" />
      </Button>
      {/* F5 layout-mode picker. Session 87 UX fix #3 — was a single
          icon-toggle that swapped Orbit ↔ Network on click; replaced
          with an explicit two-option dropdown so the available modes
          are discoverable without trial-and-error. Hidden for
          manual-layout diagrams (EC) where layout mode is meaningless.
          The icon to the left of the select stays as a state-glance
          cue; the select itself is the canonical control. */}
      {showLayoutToggle && (
        <label
          className="pointer-events-auto hidden h-7 items-center gap-1 rounded-md border border-neutral-200 bg-neutral-50 px-1.5 py-0.5 font-medium text-neutral-700 text-xs transition hover:bg-neutral-100 md:inline-flex dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-200 dark:hover:bg-neutral-900"
          title="Layout mode"
        >
          {layoutMode === 'flow' ? (
            <Network className="h-3.5 w-3.5" aria-hidden />
          ) : (
            <Orbit className="h-3.5 w-3.5" aria-hidden />
          )}
          <span className="sr-only">Layout mode</span>
          <select
            value={layoutMode}
            onChange={(e) => setLayoutMode(e.target.value as 'flow' | 'radial')}
            aria-label="Layout mode"
            className="cursor-pointer border-none bg-transparent pr-0 font-medium text-neutral-700 text-xs outline-none dark:text-neutral-200"
          >
            <option value="flow">Flow</option>
            <option value="radial">Radial</option>
          </select>
        </label>
      )}
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
