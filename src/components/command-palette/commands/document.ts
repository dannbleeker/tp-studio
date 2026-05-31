import { MessageSquare, MessageSquarePlus } from 'lucide-react';
import { importFromJSON } from '@/domain/persistence';
import { pickFile } from '@/services/exporters/picker';
import { currentDoc } from '@/store/selectors';
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
  // Phase 6 (Session 138) — reclaim storage held by documents you've closed.
  // Open tabs keep their full revision history; everything else is forgotten.
  // Irreversible, so it confirms first. Not a write to the active doc, so no
  // write guard.
  {
    id: 'forget-closed-docs',
    label: 'Forget closed documents…',
    group: 'File',
    run: async (s) => {
      const ok = await s.confirm(
        'Permanently delete the saved revision history of every document you have closed? Your open tabs keep their full history. This cannot be undone.',
        { confirmLabel: 'Forget closed docs' }
      );
      if (!ok) return;
      const { docsForgotten, revisionsDropped } = s.forgetClosedDocs();
      s.showToast(
        docsForgotten > 0 ? 'success' : 'info',
        docsForgotten > 0
          ? `Forgot ${docsForgotten} closed document${docsForgotten === 1 ? '' : 's'} (${revisionsDropped} revision${revisionsDropped === 1 ? '' : 's'} freed).`
          : 'No closed documents to forget — every saved document is currently open.'
      );
    },
  },
  // Session 135 / spec major gap #3 Phase 1B — cross-diagram entity
  // import. User picks a TP Studio JSON file, then picks one entity
  // from it; the new entity in the current doc carries an
  // `importedFrom` ref back to the source. The doc-level import
  // path (replace current doc) is the existing `Import…` command
  // above; this one is the per-entity copy-with-traceability path.
  withWriteGuard({
    id: 'import-entity-from-doc',
    label: 'Import entity from another doc…',
    group: 'File',
    run: async (s) => {
      const sourceDoc = await pickFile({
        accept: 'application/json,.json',
        label: 'JSON',
        parse: importFromJSON,
      });
      if (!sourceDoc) return; // user cancelled or parse failed (toast already shown)
      if (sourceDoc.id === currentDoc(s).id) {
        s.showToast(
          'info',
          'That file is this same document — pick a different one to import from.'
        );
        return;
      }
      s.openImportEntityPicker(sourceDoc);
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
    // Review comments — open / close the threads panel. Not write-guarded:
    // commenting is an annotation layer, useful even on a browse-locked
    // (read-only-shared) document.
    id: 'toggle-comments-panel',
    label: 'Comments',
    group: 'Review',
    icon: MessageSquare,
    run: (s) => s.toggleCommentsPanel(),
  },
  {
    // Opens the comments panel with the composer ready; it anchors to the
    // current selection (a single entity/edge) or the whole diagram.
    id: 'add-comment-on-selection',
    label: 'Add comment on selection',
    group: 'Review',
    icon: MessageSquarePlus,
    run: (s) => s.openCommentsPanel(),
  },
  {
    // Session 78 — manually reopen the creation wizard for the current
    // doc. Works when the diagram type is Goal Tree, EC, or (Session 136)
    // CRT; no-op (with a friendly toast) on any other type.
    id: 'reopen-creation-wizard',
    label: 'Reopen creation wizard',
    group: 'Review',
    run: (s) => {
      const kind = currentDoc(s).diagramType;
      if (kind === 'goalTree' || kind === 'ec') {
        s.openCreationWizard(kind);
      } else if (kind === 'crt') {
        s.openCreationWizard('crt');
      } else {
        s.showToast(
          'info',
          'Creation wizard is only available on Goal Tree / Evaporating Cloud / CRT.'
        );
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
      if (currentDoc(s).diagramType !== 'ec') {
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
