import clsx from 'clsx';
import {
  BookOpen,
  Download,
  HelpCircle,
  History,
  MessageSquare,
  Redo2,
  Share2,
  Undo2,
  X,
} from 'lucide-react';
import { shareCurrentDoc } from '@/services/shareCurrentDoc';
import { useDocumentStore } from '@/store';
import { Button } from '../ui/Button';
import { KebabMenu } from './KebabMenu';
import { LogicChip } from './LogicChip';
import { useToolbarActions } from './useToolbarActions';

/** Thin vertical divider between top-bar clusters. */
function Divider({ className }: { className?: string }) {
  return (
    <div
      className={clsx('mx-0.5 h-5 w-px shrink-0 bg-neutral-200 dark:bg-neutral-800', className)}
      aria-hidden
    />
  );
}

/**
 * Session 182 — the top bar's RIGHT zone, regrouped into labelled clusters with
 * dividers (App.tsx owns the 3-zone band: home/logo + title · search · this).
 * Order: Logic chip · undo/redo · history/comments · Share · Export · overflow.
 *
 * Content-priority responsive collapse (no wrap, no h-scroll, ~1024–1920px): the
 * undo/redo + history/comments clusters drop below `lg`, Share's label below `xl`
 * (then the icon below `md`) — all of them stay reachable in the overflow ▾,
 * which also absorbs theme / lock / help / inspector-toggle / layout.
 */
export function TopBar() {
  const {
    historyPanelOpen,
    commentsPanelOpen,
    canUndo,
    canRedo,
    openHelp,
    toggleHistoryPanel,
    toggleCommentsPanel,
    undo,
    redo,
  } = useToolbarActions();
  const openExportPicker = useDocumentStore((s) => s.openExportPicker);
  const appMode = useDocumentStore((s) => s.appMode);
  const setAppMode = useDocumentStore((s) => s.setAppMode);
  const isReaderMode = appMode === 'reader';

  const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);
  const cmdKey = isMac ? '⌘' : 'Ctrl';

  // Reader mode shows a minimal toolbar — a label pill + exit + help. All edit
  // affordances are hidden; Browse Lock already blocks writes.
  if (isReaderMode) {
    return (
      <div data-component="top-bar" className="flex shrink-0 items-center gap-2">
        <span className="flex items-center gap-1.5 rounded-full border border-indigo-300 bg-indigo-50 px-3 py-1 font-medium text-indigo-700 text-xs dark:border-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">
          <BookOpen className="h-3 w-3" aria-hidden />
          Reader mode
        </span>
        <Button
          variant="softNeutral"
          size="sm"
          onClick={() => setAppMode('expert')}
          title="Exit reader mode"
          aria-label="Exit reader mode"
        >
          <X className="h-3.5 w-3.5" />
          Exit
        </Button>
        <Button
          variant="softNeutral"
          size="icon"
          onClick={openHelp}
          className="pointer-events-auto"
          aria-label="Help"
          title="Help"
        >
          <HelpCircle className="h-3.5 w-3.5" />
        </Button>
      </div>
    );
  }

  return (
    <div data-component="top-bar" className="flex shrink-0 items-center gap-1.5">
      <LogicChip />
      <Divider />
      {/* Undo / Redo cluster — lg+ (folds into the overflow below lg). */}
      <div className="hidden items-center gap-1 lg:flex">
        <Button
          variant="softNeutral"
          size="icon"
          onClick={undo}
          disabled={!canUndo}
          className="pointer-events-auto"
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
          className="pointer-events-auto"
          aria-label="Redo"
          title={canRedo ? `Redo  ${cmdKey}+Shift+Z` : 'Nothing to redo'}
        >
          <Redo2 className="h-3.5 w-3.5" />
        </Button>
      </div>
      <Divider className="hidden lg:block" />
      {/* History / Comments cluster — lg+. */}
      <div className="hidden items-center gap-1 lg:flex">
        <Button
          variant={historyPanelOpen ? 'softViolet' : 'softNeutral'}
          size="icon"
          onClick={toggleHistoryPanel}
          className="pointer-events-auto"
          aria-label={historyPanelOpen ? 'Close history' : 'Open history'}
          title={historyPanelOpen ? 'Close history' : 'Open revision history'}
          aria-pressed={historyPanelOpen}
        >
          <History className="h-3.5 w-3.5" />
        </Button>
        <Button
          variant={commentsPanelOpen ? 'softViolet' : 'softNeutral'}
          size="icon"
          onClick={toggleCommentsPanel}
          className="pointer-events-auto"
          aria-label={commentsPanelOpen ? 'Close comments' : 'Open comments'}
          title={commentsPanelOpen ? 'Close comments' : 'Open review comments'}
          aria-pressed={commentsPanelOpen}
        >
          <MessageSquare className="h-3.5 w-3.5" />
        </Button>
      </div>
      <Divider className="hidden md:block" />
      {/* Share — bordered secondary. Icon at md, +label at xl. */}
      <Button
        variant="softNeutral"
        size="sm"
        onClick={() => void shareCurrentDoc()}
        className="pointer-events-auto hidden md:inline-flex"
        aria-label="Copy share link"
        title="Copy a read-only share link"
      >
        <Share2 className="h-3.5 w-3.5" />
        <span className="hidden xl:inline">Share</span>
      </Button>
      {/* Export — filled primary. Always visible. */}
      <Button
        variant="primary"
        size="sm"
        onClick={openExportPicker}
        className="pointer-events-auto"
        aria-label="Export"
        title="Export (PNG / SVG / PDF / PPTX / …)"
      >
        <Download className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">Export</span>
      </Button>
      {/* Overflow ▾ — always visible; absorbs theme / lock / help / inspector /
          layout, plus undo-redo / history / comments at narrow widths. */}
      <KebabMenu />
    </div>
  );
}
