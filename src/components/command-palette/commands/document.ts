import { DIAGRAM_TYPE_LABEL } from '@/domain/entityTypeMeta';
import { EXAMPLE_BY_DIAGRAM } from '@/domain/examples';
import type { DiagramType } from '@/domain/types';
import { applyCsvRows, parseEntitiesCsv, pickCsvFile } from '@/services/csvImport';
import { pickFlyingLogic, pickJSON, pickMermaid } from '@/services/exporters';
import { type Command, withWriteGuard } from './types';

/**
 * Per-diagram-type "New …" and "Load example …" command pairs, generated
 * from {@link EXAMPLE_BY_DIAGRAM} so a new diagram type gets its pair the
 * moment it's added to the registry — no need to append matching blocks
 * here.
 */
const diagramCommands = (Object.keys(EXAMPLE_BY_DIAGRAM) as DiagramType[]).flatMap<Command>(
  (type) => {
    const label = DIAGRAM_TYPE_LABEL[type];
    return [
      withWriteGuard({
        id: `new-${type}`,
        label: `New ${label}`,
        group: 'File',
        run: (s) => {
          s.newDocument(type);
        },
      }),
      withWriteGuard({
        id: `load-example-${type}`,
        label: `Load example ${label}`,
        group: 'File',
        run: (s) => {
          s.setDocument(EXAMPLE_BY_DIAGRAM[type]());
          s.showToast('info', `Loaded example ${type.toUpperCase()}.`);
        },
      }),
    ];
  }
);

export const documentCommands: Command[] = [
  ...diagramCommands,
  withWriteGuard({
    id: 'import-json',
    label: 'Import from JSON…',
    group: 'File',
    run: async (s) => {
      const doc = await pickJSON();
      if (doc) s.setDocument(doc);
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
    id: 'open-document-inspector',
    label: 'Document details…',
    group: 'Review',
    run: (s) => s.openDocSettings(),
  },
  {
    id: 'open-history-panel',
    label: 'Open history…',
    group: 'Review',
    run: (s) => s.openHistoryPanel(),
  },
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
];
