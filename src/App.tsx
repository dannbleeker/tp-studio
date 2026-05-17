import { ReactFlowProvider } from '@xyflow/react';
import { Suspense, lazy, useEffect } from 'react';
import { Canvas } from './components/canvas/Canvas';
import { CompareBanner } from './components/canvas/CompareBanner';
import { ContextMenu } from './components/canvas/ContextMenu';
import { SelectionToolbar } from './components/canvas/SelectionToolbar';
import { Inspector } from './components/inspector/Inspector';
import { Toaster } from './components/toast/Toaster';
import { TitleBadge } from './components/toolbar/TitleBadge';
import { TopBar } from './components/toolbar/TopBar';
import { ConfirmDialog } from './components/ui/ConfirmDialog';
import { ErrorBoundary } from './components/ui/ErrorBoundary';
import { useGlobalKeyboard } from './hooks/useGlobalKeyboard';
import { useThemeClass } from './hooks/useThemeClass';
import { clearShareHash, parseShareHash } from './services/shareLink';
import { useDocumentStore } from './store';
import { bootRecoveryStatus } from './store/documentSlice/docMetaSlice';

// Modal dialogs and the find panel are mounted at the app root but rarely
// open. Defer their code via React.lazy so the initial bundle ships only
// what the user sees on first paint. Suspense fallback is `null` because
// these mount invisible — there's no skeleton to draw.
const HelpDialog = lazy(() =>
  import('./components/help/HelpDialog').then((m) => ({ default: m.HelpDialog }))
);
const AboutDialog = lazy(() =>
  import('./components/about/AboutDialog').then((m) => ({ default: m.AboutDialog }))
);
const SettingsDialog = lazy(() =>
  import('./components/settings/SettingsDialog').then((m) => ({ default: m.SettingsDialog }))
);
const DocumentInspector = lazy(() =>
  import('./components/settings/DocumentInspector').then((m) => ({
    default: m.DocumentInspector,
  }))
);
const SearchPanel = lazy(() =>
  import('./components/search/SearchPanel').then((m) => ({ default: m.SearchPanel }))
);
const QuickCaptureDialog = lazy(() =>
  import('./components/quick-capture/QuickCaptureDialog').then((m) => ({
    default: m.QuickCaptureDialog,
  }))
);
const RevisionPanel = lazy(() =>
  import('./components/history/RevisionPanel').then((m) => ({ default: m.RevisionPanel }))
);
const WalkthroughOverlay = lazy(() =>
  import('./components/walkthrough/WalkthroughOverlay').then((m) => ({
    default: m.WalkthroughOverlay,
  }))
);
const SideBySideDialog = lazy(() =>
  import('./components/history/SideBySideDialog').then((m) => ({
    default: m.SideBySideDialog,
  }))
);
const PrintPreviewDialog = lazy(() =>
  import('./components/print/PrintPreviewDialog').then((m) => ({
    default: m.PrintPreviewDialog,
  }))
);
// Session 105 / Tier 1 #5 — `PrintAppendix` only renders during
// browser print (it's `display: none` on screen via `print.css`).
// Was previously eager-loaded, pulling 124 LOC + the
// `structuralEntities` traversal into the index chunk. Lazy-load
// it so the chunk only materializes when print preview / Cmd+P
// fires. Suspense fallback is `null` — the appendix is invisible
// on screen anyway, and by the time the browser print dialog
// opens, the chunk will have loaded.
const PrintAppendix = lazy(() =>
  import('./components/print/PrintAppendix').then((m) => ({ default: m.PrintAppendix }))
);
const TemplatePickerDialog = lazy(() =>
  import('./components/templates/TemplatePickerDialog').then((m) => ({
    default: m.TemplatePickerDialog,
  }))
);
// Session 90 — diagram-type + export pickers replace 14 + 17 palette
// commands respectively. Both are lazy because they only appear via
// explicit palette commands; their dependency trees (entityTypeMeta,
// EXAMPLE_BY_DIAGRAM, the full exporter list) shouldn't load on first
// paint.
const DiagramTypePickerDialog = lazy(() =>
  import('./components/diagrams/DiagramTypePickerDialog').then((m) => ({
    default: m.DiagramTypePickerDialog,
  }))
);
const ExportPickerDialog = lazy(() =>
  import('./components/export/ExportPickerDialog').then((m) => ({
    default: m.ExportPickerDialog,
  }))
);
// Session 88 (Batch 2) — CommandPalette was eagerly imported; its tree
// pulls in every command file (9 files of `*Commands` arrays) plus the
// new icon map. None of that is needed on first paint — the palette
// only renders when the user hits Cmd/Ctrl+K, by which point the
// chunk has had several seconds to lazy-load in the background.
const CommandPalette = lazy(() =>
  import('./components/command-palette/CommandPalette').then((m) => ({
    default: m.CommandPalette,
  }))
);

/**
 * Print-only header. Hidden in normal view by the print.css `.print-only`
 * default; the print stylesheet flips it on. Inserts the document title,
 * optional author, and optional description so a "Save as PDF" capture
 * carries the doc metadata at the top of the first page.
 */
function PrintHeader() {
  const title = useDocumentStore((s) => s.doc.title);
  const author = useDocumentStore((s) => s.doc.author);
  const description = useDocumentStore((s) => s.doc.description);
  return (
    <div className="print-only">
      <h1>{title || 'Untitled'}</h1>
      {author && <div className="print-author">by {author}</div>}
      {description && <div className="print-description">{description}</div>}
    </div>
  );
}

// Captured once at module load. The footer reflects when the app session
// started; that's accurate enough for "Exported on" — re-computing on every
// render is wasted work since the date won't change inside a session, and
// the user can always reload before printing across midnight.
const PRINT_DATE_STAMP = (() => {
  const today = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;
})();

function PrintFooter() {
  return <div className="print-footer">Exported {PRINT_DATE_STAMP} · TP Studio</div>;
}

// FL-EX9 / FL-CO1 — boot-time effects. Both fire exactly once per
// module load (StrictMode double-invokes `App` but never the module
// init); we guard with module-level flags so a hard refresh resets the
// state but a StrictMode remount doesn't duplicate.
let recoveryToastShown = false;
let shareLinkBootHandled = false;

export function App() {
  useThemeClass();
  useGlobalKeyboard();
  const showToast = useDocumentStore((s) => s.showToast);
  const setDocument = useDocumentStore((s) => s.setDocument);
  const setBrowseLocked = useDocumentStore((s) => s.setBrowseLocked);

  // FL-EX9: surface a recovery toast when the previous session ended
  // unexpectedly.
  useEffect(() => {
    if (recoveryToastShown) return;
    recoveryToastShown = true;
    if (bootRecoveryStatus.recoveredFromBackup) {
      showToast(
        'info',
        'Recovered from backup — the previous session ended unexpectedly. The latest saved snapshot was used.'
      );
    } else if (bootRecoveryStatus.recoveredFromLiveDraftOnly) {
      showToast(
        'info',
        'Recovered unsaved edits — the committed snapshot was unreadable, but your live draft was intact.'
      );
    }
  }, [showToast]);

  // FL-CO1: if the URL fragment carries a share payload, load the
  // shared doc into the store and auto-engage Browse Lock so the
  // receiver can't accidentally edit it. The original autosaved doc
  // is preserved as a revision via `setDocument`'s built-in safety
  // snapshot, so the receiver can roll back to it from the revision
  // panel if they want their own working copy back.
  useEffect(() => {
    if (shareLinkBootHandled) return;
    shareLinkBootHandled = true;
    if (typeof window === 'undefined') return;
    const hash = window.location.hash;
    if (!hash.startsWith('#!share=')) return;
    let cancelled = false;
    void (async () => {
      try {
        const shared = await parseShareHash(hash);
        if (cancelled || !shared) return;
        setDocument(shared);
        setBrowseLocked(true);
        clearShareHash();
        showToast(
          'success',
          'Loaded from share link. Browse Lock is on — toggle it off to edit your own copy.'
        );
      } catch (err) {
        if (cancelled) return;
        clearShareHash();
        showToast('error', err instanceof Error ? err.message : 'Share link could not be opened.');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [setDocument, setBrowseLocked, showToast]);

  return (
    <main className="relative h-screen w-screen overflow-hidden">
      <PrintHeader />
      <TitleBadge />
      <TopBar />
      {/* Session 95 — `ReactFlowProvider` hoisted here (was inside
          `<Canvas />` until Phase 2) so the SelectionToolbar and any
          future canvas-aware overlay can read React Flow's state via
          `useRFStore` from outside the Canvas component. */}
      <ReactFlowProvider>
        <Canvas />
        {/* Session 95 — selection-anchored floating toolbar.
            Mounted inside the provider but outside Canvas's render
            tree so it doesn't get re-mounted on Canvas re-renders.
            ErrorBoundary scopes any crash so the canvas stays
            usable. */}
        <ErrorBoundary label="Selection toolbar">
          <SelectionToolbar />
        </ErrorBoundary>
      </ReactFlowProvider>
      <CompareBanner />
      {/* Nested ErrorBoundaries scope a crash to a single panel — the
          canvas stays usable if (say) the Inspector blows up on a bad
          warning derivation, and vice versa. The root boundary wrapping
          all of <App /> still catches anything that escapes a panel. */}
      <ErrorBoundary label="Inspector">
        <Inspector />
      </ErrorBoundary>
      <ContextMenu />
      <Suspense fallback={null}>
        <CommandPalette />
        <HelpDialog />
        <AboutDialog />
        <ErrorBoundary label="Settings">
          <SettingsDialog />
        </ErrorBoundary>
        <ErrorBoundary label="Document details">
          <DocumentInspector />
        </ErrorBoundary>
        <SearchPanel />
        <QuickCaptureDialog />
        <ErrorBoundary label="Revision history">
          <RevisionPanel />
        </ErrorBoundary>
        <WalkthroughOverlay />
        <ErrorBoundary label="Side-by-side compare">
          <SideBySideDialog />
        </ErrorBoundary>
        <ErrorBoundary label="Print preview">
          <PrintPreviewDialog />
        </ErrorBoundary>
        <ErrorBoundary label="Template picker">
          <TemplatePickerDialog />
        </ErrorBoundary>
        <ErrorBoundary label="Diagram-type picker">
          <DiagramTypePickerDialog />
        </ErrorBoundary>
        <ErrorBoundary label="Export picker">
          <ExportPickerDialog />
        </ErrorBoundary>
      </Suspense>
      <ConfirmDialog />
      <Toaster />
      <Suspense fallback={null}>
        <PrintAppendix />
      </Suspense>
      <PrintFooter />
    </main>
  );
}
