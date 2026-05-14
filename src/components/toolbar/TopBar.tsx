import { SHORTCUT_BY_ID, shortcutToAria } from '@/domain/shortcuts';
import { useDocumentStore } from '@/store';
import { HelpCircle, History, Lock, Moon, Network, Orbit, Search, Sun, Unlock } from 'lucide-react';
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
    toggleTheme,
    openHelp,
    toggleHistoryPanel,
    setLayoutMode,
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
      <Button
        variant={browseLocked ? 'softViolet' : 'softNeutral'}
        size="icon"
        onClick={() => setBrowseLocked(!browseLocked)}
        className="pointer-events-auto"
        aria-label={browseLocked ? 'Unlock document' : 'Lock document for browsing'}
        title={browseLocked ? 'Browse Lock on — click to unlock' : 'Lock for read-only browsing'}
        aria-pressed={browseLocked}
      >
        {browseLocked ? <Lock className="h-3.5 w-3.5" /> : <Unlock className="h-3.5 w-3.5" />}
      </Button>
      {/* F5 layout-mode toggle. Icon shows the destination: Orbit when
          currently flow (click → radial), Network when currently radial
          (click → flow). Hidden for manual-layout diagrams. */}
      {showLayoutToggle && (
        <Button
          variant="softNeutral"
          size="icon"
          onClick={() => setLayoutMode(layoutMode === 'flow' ? 'radial' : 'flow')}
          className="pointer-events-auto hidden md:inline-flex"
          aria-label={layoutMode === 'flow' ? 'Switch to radial layout' : 'Switch to flow layout'}
          title={layoutMode === 'flow' ? 'Radial layout' : 'Flow layout'}
          aria-pressed={layoutMode === 'radial'}
        >
          {layoutMode === 'flow' ? (
            <Orbit className="h-3.5 w-3.5" />
          ) : (
            <Network className="h-3.5 w-3.5" />
          )}
        </Button>
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
