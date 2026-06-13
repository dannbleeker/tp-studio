import { ReactFlowProvider } from '@xyflow/react';
import clsx from 'clsx';
import { lazy, Suspense, useEffect } from 'react';
import { BlocksRail } from './components/canvas/BlocksRail';
import { Canvas } from './components/canvas/Canvas';
import { CompareBanner } from './components/canvas/overlays/CompareBanner';
import { ContextMenu } from './components/canvas/overlays/ContextMenu';
import { PresentationStepThrough } from './components/canvas/overlays/PresentationStepThrough';
import { SelectionToolbar } from './components/canvas/overlays/SelectionToolbar';
import { SpeculationBanner } from './components/canvas/overlays/SpeculationBanner';
import { DocumentMeta } from './components/DocumentMeta';
import { CLRPanel } from './components/inspector/CLRPanel';
import { Inspector } from './components/inspector/Inspector';
import { PrintLegend } from './components/print/PrintLegend';
import { Toaster } from './components/toast/Toaster';
import { CommandSearch } from './components/toolbar/CommandSearch';
import { HomeLogo } from './components/toolbar/HomeLogo';
import { TabStrip } from './components/toolbar/TabStrip';
import { TitleBadge } from './components/toolbar/TitleBadge';
import { TopBar } from './components/toolbar/TopBar';
import { ConfirmDialog } from './components/ui/ConfirmDialog';
import { ErrorBoundary } from './components/ui/ErrorBoundary';
import { useGlobalKeyboard } from './hooks/useGlobalKeyboard';
import { usePrintCanvas } from './hooks/usePrintCanvas';
import { useThemeClass } from './hooks/useThemeClass';
import { useDocumentStore } from './store';
import { bootRecoveryStatus } from './store/documentSlice/docMetaSlice';
import { currentDoc } from './store/selectors';

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
const ThreeCloudWizard = lazy(() =>
  import('./components/three-cloud/ThreeCloudWizard').then((m) => ({
    default: m.ThreeCloudWizard,
  }))
);
const RevisionPanel = lazy(() =>
  import('./components/history/RevisionPanel').then((m) => ({ default: m.RevisionPanel }))
);
const CommentsPanel = lazy(() =>
  import('./components/comments/CommentsPanel').then((m) => ({ default: m.CommentsPanel }))
);
const ReadAllAtOnceDialog = lazy(() =>
  import('./components/walkthrough/ReadAllAtOnceDialog').then((m) => ({
    default: m.ReadAllAtOnceDialog,
  }))
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
const PrintReasoning = lazy(() =>
  import('./components/print/PrintReasoning').then((m) => ({ default: m.PrintReasoning }))
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
const ImportPickerDialog = lazy(() =>
  import('./components/import/ImportPickerDialog').then((m) => ({
    default: m.ImportPickerDialog,
  }))
);
const ImportEntityPickerDialog = lazy(() =>
  import('./components/import/ImportEntityPickerDialog').then((m) => ({
    default: m.ImportEntityPickerDialog,
  }))
);
const LinkEntityPickerDialog = lazy(() =>
  import('./components/import/LinkEntityPickerDialog').then((m) => ({
    default: m.LinkEntityPickerDialog,
  }))
);
const EdgeScrutinyDialog = lazy(() =>
  import('./components/inspector/EdgeScrutinyDialog').then((m) => ({
    default: m.EdgeScrutinyDialog,
  }))
);
const InjectionFlowerDialog = lazy(() =>
  import('./components/inspector/InjectionFlowerDialog').then((m) => ({
    default: m.InjectionFlowerDialog,
  }))
);
const WhiteboardPasteDialog = lazy(() =>
  import('./components/import/WhiteboardPasteDialog').then((m) => ({
    default: m.WhiteboardPasteDialog,
  }))
);
const PatternLibraryDialog = lazy(() =>
  import('./components/patterns/PatternLibraryDialog').then((m) => ({
    default: m.PatternLibraryDialog,
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
  const title = useDocumentStore((s) => currentDoc(s).title);
  const author = useDocumentStore((s) => currentDoc(s).author);
  const description = useDocumentStore((s) => currentDoc(s).description);
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
  usePrintCanvas();
  const showToast = useDocumentStore((s) => s.showToast);
  const openDocInTab = useDocumentStore((s) => s.openDocInTab);
  const setBrowseLocked = useDocumentStore((s) => s.setBrowseLocked);
  // Session 135 / spec gap #9 Phase 1B — read the app-mode at the
  // root so per-mode chrome conditions live next to the components
  // they gate. `'presentation'` hides every chrome surface except
  // the canvas; `'workshop'` adds a body class that bumps text
  // sizes via the stylesheet (see `styles/index.css` for the
  // workshop class rules); `'guided'` is reserved for the next
  // phase (auto-open method checklist + creation wizards).
  const appMode = useDocumentStore((s) => s.appMode);
  const isPresentation = appMode === 'presentation';
  // Session 180 / E6 — reader mode hides the inspector (like presentation),
  // but keeps the tab strip + header visible so the user can navigate docs.
  const isReader = appMode === 'reader';
  // Session 182 — the Logic-check (CLR) panel takes over the right dock from the
  // Inspector when open (mutually exclusive).
  const clrPanelOpen = useDocumentStore((s) => s.clrPanelOpen);

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
  // receiver can't accidentally edit it. Routed through `openDocInTab`
  // so the shared doc opens in a NEW tab by default (the receiver's own
  // work stays in its own tab); in opt-out "replace" mode `setDocument`'s
  // built-in safety snapshot preserves the outgoing doc as a revision.
  useEffect(() => {
    if (shareLinkBootHandled) return;
    shareLinkBootHandled = true;
    if (typeof window === 'undefined') return;
    const hash = window.location.hash;
    if (!hash.startsWith('#!share=')) return;
    let cancelled = false;
    void (async () => {
      // Lazy — `shareLink` (CompressionStream + the doc decoder) only loads on the
      // <1% `#!share=` boot path, so it leaves the main `index` chunk (bundle #6).
      const { clearShareHash, parseShareHash } = await import('./services/shareLink');
      try {
        const shared = await parseShareHash(hash);
        if (cancelled || !shared) return;
        openDocInTab(shared);
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
  }, [openDocInTab, setBrowseLocked, showToast]);

  return (
    <main
      // Session 135 — name the main landmark so screen readers announce
      // "main, TP Studio canvas" when entering, not just "main." Part of
      // the canvas a11y push (slice 3).
      aria-label="TP Studio canvas"
      className={clsx(
        'flex h-screen w-screen flex-col overflow-hidden',
        appMode === 'workshop' && 'app-mode-workshop',
        appMode === 'presentation' && 'app-mode-presentation',
        appMode === 'reader' && 'app-mode-reader'
      )}
    >
      <DocumentMeta />
      <PrintHeader />
      <PrintLegend />
      {/* Chrome header — the tab strip + a (title · toolbar) band. A real
          flex-column header now, not floating `absolute` overlays, so it
          never overlaps the canvas or the Inspector. Hidden in presentation
          mode (full-bleed canvas). */}
      {!isPresentation && (
        <header className="relative z-30 shrink-0" data-component="app-chrome">
          <TabStrip />
          {/* Session 182 — three-zone band: home/logo + doc title (left) ·
              command/search (centre) · action clusters (right). */}
          <div className="flex items-center gap-2 border-neutral-200 border-b bg-white px-3 py-1.5 dark:border-neutral-800 dark:bg-neutral-950">
            <div className="flex min-w-0 shrink items-center gap-2">
              <HomeLogo />
              <TitleBadge />
            </div>
            <div className="flex min-w-0 flex-1 justify-center">
              <CommandSearch />
            </div>
            <TopBar />
          </div>
        </header>
      )}
      {/* The canvas, its overlays, and the Inspector live in a flex-1
          content row beneath the header. The Inspector is `absolute` within
          this `relative` row, so it starts below the header — no overlap with
          the TopBar / tab strip. `data-print-canvas` lets print.css pin this
          row to a fixed box while `body.printing` is set (see usePrintCanvas). */}
      <div className="flex flex-1 flex-row overflow-hidden">
        {/* Session 182 — Building Blocks rail: type-led entity creation, left of
            the canvas. Hidden in presentation / reader (chrome). Sibling of the
            print-canvas row so `data-print-canvas` + the Inspector's positioning
            context are untouched. */}
        {!isPresentation && !isReader && <BlocksRail />}
        <div className="relative min-w-0 flex-1 overflow-hidden" data-print-canvas>
          {/* Session 95 — `ReactFlowProvider` hoisted here so the
            SelectionToolbar + future canvas overlays can read React Flow's
            state via `useRFStore` from outside the Canvas component. */}
          <ReactFlowProvider>
            {/* Session 113 — Canvas wrapped in its own ErrorBoundary. React
            Flow is a third-party renderer; an internal crash there
            previously surfaced through the root boundary and froze the
            entire app on the crash screen. Scoped here so a Canvas
            crash leaves the TopBar / Inspector / palette usable and
            the user can at least save / export / load a different
            doc. */}
            <ErrorBoundary label="Canvas">
              <Canvas />
            </ErrorBoundary>
            {/* Session 95 — selection-anchored floating toolbar.
            Mounted inside the provider but outside Canvas's render
            tree so it doesn't get re-mounted on Canvas re-renders.
            ErrorBoundary scopes any crash so the canvas stays
            usable. */}
            {!isPresentation && (
              <ErrorBoundary label="Selection toolbar">
                <SelectionToolbar />
              </ErrorBoundary>
            )}
            {/* Session 135 / spec gap #9 Phase 1C — Presentation
            step-through control. Self-gated on `appMode ===
            'presentation'` inside the component, so it only mounts
            chrome when the mode is active. Lives inside the
            ReactFlowProvider so `useReactFlow().fitView({...})` is
            available for the focus-on-step behaviour. */}
            <ErrorBoundary label="Presentation step-through">
              <PresentationStepThrough />
            </ErrorBoundary>
          </ReactFlowProvider>
          <ErrorBoundary label="Compare banner">
            <CompareBanner />
          </ErrorBoundary>
          <ErrorBoundary label="Speculation banner">
            <SpeculationBanner />
          </ErrorBoundary>
          {/* Nested ErrorBoundaries scope a crash to a single panel — the
          canvas stays usable if (say) the Inspector blows up on a bad
          warning derivation, and vice versa. The root boundary wrapping
          all of <App /> still catches anything that escapes a panel. */}
          {!isPresentation &&
            !isReader &&
            (clrPanelOpen ? (
              <ErrorBoundary label="Logic check">
                <CLRPanel />
              </ErrorBoundary>
            ) : (
              <ErrorBoundary label="Inspector">
                <Inspector />
              </ErrorBoundary>
            ))}
        </div>
      </div>
      <ContextMenu />
      <Suspense fallback={null}>
        {/* Session 113 — wrap the remaining lazy dialogs / overlays in
            their own ErrorBoundaries so a render fault in any one
            doesn't escape to the root crash screen. Settings /
            Document-details / Revision-history / Side-by-side /
            Print-preview / Template-picker / Diagram-picker /
            Export-picker already had boundaries; the seven below
            (palette / help / about / search / quick-capture /
            walkthrough) were the remaining gap. Each is a self-
            contained dialog or overlay so the boundary scope matches
            the natural failure boundary. */}
        <ErrorBoundary label="Command palette">
          <CommandPalette />
        </ErrorBoundary>
        <ErrorBoundary label="Help dialog">
          <HelpDialog />
        </ErrorBoundary>
        <ErrorBoundary label="About dialog">
          <AboutDialog />
        </ErrorBoundary>
        <ErrorBoundary label="Settings">
          <SettingsDialog />
        </ErrorBoundary>
        <ErrorBoundary label="Document details">
          <DocumentInspector />
        </ErrorBoundary>
        <ErrorBoundary label="Search panel">
          <SearchPanel />
        </ErrorBoundary>
        <ErrorBoundary label="Quick capture">
          <QuickCaptureDialog />
        </ErrorBoundary>
        <ErrorBoundary label="3-cloud wizard">
          <ThreeCloudWizard />
        </ErrorBoundary>
        <ErrorBoundary label="Revision history">
          <RevisionPanel />
        </ErrorBoundary>
        <ErrorBoundary label="Comments panel">
          <CommentsPanel />
        </ErrorBoundary>
        <ErrorBoundary label="Walkthrough overlay">
          <WalkthroughOverlay />
        </ErrorBoundary>
        <ErrorBoundary label="Read-all-at-once dialog">
          <ReadAllAtOnceDialog />
        </ErrorBoundary>
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
        <ErrorBoundary label="Import picker">
          <ImportPickerDialog />
        </ErrorBoundary>
        <ErrorBoundary label="Import-entity picker">
          <ImportEntityPickerDialog />
        </ErrorBoundary>
        <ErrorBoundary label="Link-entity picker">
          <LinkEntityPickerDialog />
        </ErrorBoundary>
        <ErrorBoundary label="Edge scrutiny dialog">
          <EdgeScrutinyDialog />
        </ErrorBoundary>
        <ErrorBoundary label="Injection flower dialog">
          <InjectionFlowerDialog />
        </ErrorBoundary>
        <ErrorBoundary label="Whiteboard paste dialog">
          <WhiteboardPasteDialog />
        </ErrorBoundary>
        <ErrorBoundary label="Pattern library dialog">
          <PatternLibraryDialog />
        </ErrorBoundary>
      </Suspense>
      <ConfirmDialog />
      <Toaster />
      <Suspense fallback={null}>
        <PrintAppendix />
        <PrintReasoning />
      </Suspense>
      <PrintFooter />
    </main>
  );
}
