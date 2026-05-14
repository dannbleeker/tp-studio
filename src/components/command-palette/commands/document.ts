import { getCanvasInstance } from '@/services/canvasRef';
import { applyCsvRows, parseEntitiesCsv, pickCsvFile } from '@/services/csvImport';
import { pickFlyingLogic, pickJSON, pickMermaid } from '@/services/exporters';
import { type Command, withWriteGuard } from './types';

/**
 * Session 87 (V3) — auto-fit-view after a doc load. Examples use
 * canonical seed coordinates (Goal at x=100, Wants at x=800 on EC)
 * that overflow narrower viewports; without fit-view, the user lands
 * on a panned-off canvas and has to manually press the Fit button to
 * see the loaded diagram. Two animation-frame ticks let React Flow
 * reconcile the new node set and finalize layout positions before
 * the fit-to-bounds calculation runs.
 *
 * Pulled into a helper because the import paths all want the same
 * behaviour. The diagram-type picker (Session 90) calls fitView
 * inline so this stays scoped to the import-from-X commands here.
 */
const fitViewAfterLoad = (): void => {
  if (typeof window === 'undefined') return;
  window.requestAnimationFrame(() => {
    window.requestAnimationFrame(() => {
      getCanvasInstance()?.fitView({ padding: 0.4, maxZoom: 1.2 });
    });
  });
};

export const documentCommands: Command[] = [
  // Session 90 — replaces the 14 per-diagram `New X` + `Load example X`
  // palette rows with two picker-fronted commands. The picker shows
  // all 7 diagram types as cards with "use this when…" cues, fanning
  // out the choice without dominating the unfiltered palette.
  withWriteGuard({
    id: 'new-diagram',
    label: 'New diagram…',
    group: 'File',
    run: (s) => s.openDiagramPicker('new'),
  }),
  withWriteGuard({
    // FL-EX8 — open the diagram-type picker in **tab** mode: instead
    // of replacing the current doc, the picker spins up a new tab
    // alongside the existing one. The picker dispatches through
    // `openNewTab(type)` rather than `newDocument(type)`. Visible in
    // the palette so the multi-tab feature is discoverable; the
    // diagram-type picker dialog reads `diagramPickerOpen` to know
    // which dispatcher to call.
    id: 'new-tab',
    label: 'New tab…',
    group: 'File',
    run: (s) => s.openDiagramPicker('tab'),
  }),
  withWriteGuard({
    id: 'load-example',
    label: 'Load example…',
    group: 'File',
    run: (s) => s.openDiagramPicker('example'),
  }),
  withWriteGuard({
    id: 'import-json',
    label: 'Import from JSON…',
    group: 'File',
    run: async (s) => {
      const doc = await pickJSON();
      if (doc) {
        s.setDocument(doc);
        fitViewAfterLoad();
      }
    },
  }),
  withWriteGuard({
    id: 'import-flying-logic',
    label: 'Open Flying Logic file…',
    group: 'File',
    run: async (s) => {
      const doc = await pickFlyingLogic();
      if (doc) {
        s.setDocument(doc);
        s.showToast('success', `Opened ${doc.title}.`);
        fitViewAfterLoad();
      }
    },
  }),
  withWriteGuard({
    // N3 (Session 64): Mermaid IMPORT. Reverse of the Block D export.
    id: 'import-mermaid',
    label: 'Import from Mermaid diagram…',
    group: 'File',
    run: async (s) => {
      const doc = await pickMermaid();
      if (doc) {
        s.setDocument(doc);
        s.showToast(
          'success',
          `Imported ${Object.keys(doc.entities).length} entities from Mermaid.`
        );
        fitViewAfterLoad();
      }
    },
  }),
  withWriteGuard({
    id: 'import-csv',
    label: 'Import entities from CSV…',
    group: 'File',
    run: async (s) => {
      const text = await pickCsvFile();
      if (!text) return;
      const result = parseEntitiesCsv(text);
      if (!result.ok) {
        const first = result.errors[0];
        const more = result.errors.length > 1 ? ` (+${result.errors.length - 1} more)` : '';
        s.showToast(
          'error',
          first ? `CSV line ${first.line}: ${first.message}${more}` : 'CSV import failed.'
        );
        return;
      }
      const summary = applyCsvRows(result.rows);
      s.showToast(
        'success',
        `Imported ${summary.entities} entit${summary.entities === 1 ? 'y' : 'ies'}, ${summary.edges} edge${summary.edges === 1 ? '' : 's'}.`
      );
    },
  }),
  withWriteGuard({
    id: 'open-quick-capture',
    label: 'Quick Capture…',
    group: 'File',
    run: (s) => {
      s.openQuickCapture();
    },
  }),
  withWriteGuard({
    // Session 79 / brief §12 — pick from the curated templates library.
    id: 'new-from-template',
    label: 'New from template…',
    group: 'File',
    run: (s) => {
      s.openTemplatePicker();
    },
  }),
  {
    // Session 90 — `Document details…` kept in the palette by Dann's
    // explicit direction (the TitleBadge Info button is small + only
    // appears at xs+; palette stays as the keyboard-driven route).
    id: 'open-document-inspector',
    label: 'Document details…',
    group: 'Review',
    run: (s) => s.openDocSettings(),
  },
  // Session 90 — `Open history…` removed from the palette: it's
  // already reachable via the History icon-button in the TopBar (sm+)
  // and the KebabMenu (xs). Duplicate entry was just visual noise.
  {
    id: 'capture-snapshot',
    label: 'Capture snapshot',
    group: 'Review',
    run: (s) => {
      s.captureSnapshot();
      s.showToast('success', 'Snapshot captured.');
      s.openHistoryPanel();
    },
  },
  {
    // Session 78 — manually reopen the creation wizard for the current
    // doc. Works when the diagram type is Goal Tree or EC; no-op
    // (with a friendly toast) on any other type.
    id: 'reopen-creation-wizard',
    label: 'Reopen creation wizard',
    group: 'Review',
    run: (s) => {
      const kind = s.doc.diagramType;
      if (kind === 'goalTree' || kind === 'ec') {
        s.openCreationWizard(kind);
      } else {
        s.showToast('info', 'Creation wizard is only available on Goal Tree + Evaporating Cloud.');
      }
    },
  },
  {
    // Session 89 EC chrome cleanup — palette toggle for the EC reading
    // guide (the combined ECReadingInstructions + VerbalisationStrip
    // pair). Defaults to hidden on fresh installs so the EC canvas is
    // visually clean; this command opts the user back in. Label flips
    // based on current state so the action verb is always accurate.
    id: 'toggle-ec-reading-guide',
    label: 'Toggle EC reading guide',
    group: 'View',
    run: (s) => {
      if (s.doc.diagramType !== 'ec') {
        s.showToast(
          'info',
          'The EC reading guide is only available on Evaporating Cloud diagrams.'
        );
        return;
      }
      const next = !s.ecChromeCollapsed;
      s.setECChromeCollapsed(next);
      s.showToast('info', next ? 'EC reading guide hidden.' : 'EC reading guide shown.');
    },
  },
];
