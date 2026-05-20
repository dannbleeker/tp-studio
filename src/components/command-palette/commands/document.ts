import { type Command, withWriteGuard } from './types';

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
    id: 'load-example',
    label: 'Load example…',
    group: 'File',
    run: (s) => s.openDiagramPicker('example'),
  }),
  // Session 134 — pattern library: a many-per-type curated starter
  // registry. Closes minor gap #4A from the spec gap analysis.
  // Distinct from `load-example` which loads the one canonical example
  // per diagram type; this dialog lists every pattern in
  // `src/domain/patterns/index.ts` with a filter chip row.
  withWriteGuard({
    id: 'open-pattern-library',
    label: 'Pattern library…',
    group: 'File',
    run: (s) => s.openPatternLibrary(),
  }),
  // Session 133 — replaces the four prior per-source import palette
  // rows (Import from JSON / Mermaid / CSV / Open Flying Logic file)
  // with a single Import… picker that fans them out as cards. The
  // dialog (ImportPickerDialog) owns the file-picker dispatch + the
  // setDocument call; this command just opens it.
  withWriteGuard({
    id: 'import',
    label: 'Import…',
    group: 'File',
    run: (s) => s.openImportPicker(),
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
