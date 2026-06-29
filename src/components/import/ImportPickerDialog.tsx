import clsx from 'clsx';
import { getCanvasInstance } from '@/services/canvasRef';
import { applyCsvRows, parseEntitiesCsv, pickCsvFile } from '@/services/exporters/csvImport';
// Session 135 / Perf #32 — import the picker fns directly from their
// source modules instead of the `@/services/exporters` barrel, which
// re-exports the whole exporter graph (pptxExport, image, riskRegister,
// ttTasks…). Keeps this lazy dialog's chunk from referencing the heavier
// export-only siblings it never uses.
import { pickFlyingLogic } from '@/services/exporters/flyingLogic';
import { pickMermaid } from '@/services/exporters/markup';
import { pickJSON } from '@/services/exporters/text';
import { type RootStore, useDocumentStore } from '@/store';
import { CARD_FOCUS } from '../ui/focusClasses';
import { LargeDialog } from '../ui/LargeDialog';

/**
 * Session 133 — single Import… picker.
 *
 * Mirror of the Session 90 ExportPickerDialog. Replaces the four
 * separate "Import from X" palette commands (JSON / Mermaid / CSV /
 * Flying Logic) with one Import… palette entry that opens this
 * dialog. Each card calls the same underlying file picker the old
 * palette command did — no behaviour change — and closes the dialog
 * on pick.
 *
 * The underlying pickers (`pickJSON`, `pickMermaid`, etc.) each open
 * a browser file dialog. If the user cancels there, the picker
 * resolves to `null` and this dialog stays closed (closing happens
 * synchronously before the `await`).
 */

type ImportAction = {
  id: string;
  label: string;
  hint: string;
  run: (s: RootStore) => Promise<void>;
};

/**
 * Auto-fit-view helper duplicated from `commands/document.ts` to avoid
 * a cross-import. Two animation frames let React Flow reconcile the
 * imported node set + finalize layout before the fit-to-bounds call.
 */
const fitViewAfterLoad = (): void => {
  if (typeof window === 'undefined') return;
  window.requestAnimationFrame(() => {
    window.requestAnimationFrame(() => {
      getCanvasInstance()?.fitView({ padding: 0.4, maxZoom: 1.2 });
    });
  });
};

const IMPORT_ACTIONS: ImportAction[] = [
  {
    id: 'json',
    label: 'TP Studio JSON',
    hint: 'Open a .tps.json file. Full fidelity round-trip — every entity, edge, group, assumption, revision.',
    run: async (s) => {
      const doc = await pickJSON();
      if (doc) {
        s.openDocInTab(doc);
        fitViewAfterLoad();
      }
    },
  },
  {
    id: 'flying-logic',
    label: 'Flying Logic file',
    hint: 'Open a .fll diagram exported from Flying Logic. Entity types + edges + groups map across.',
    run: async (s) => {
      const doc = await pickFlyingLogic();
      if (doc) {
        s.openDocInTab(doc);
        s.showToast('success', `Opened ${doc.title}.`);
        fitViewAfterLoad();
      }
    },
  },
  {
    id: 'mermaid',
    label: 'Mermaid diagram',
    hint: 'Open a Mermaid .mmd flowchart. Reverses the Mermaid export — node labels become entity titles.',
    run: async (s) => {
      const doc = await pickMermaid();
      if (doc) {
        s.openDocInTab(doc);
        s.showToast(
          'success',
          `Imported ${Object.keys(doc.entities).length} entities from Mermaid.`
        );
        fitViewAfterLoad();
      }
    },
  },
  {
    id: 'csv',
    label: 'Entities CSV',
    hint: 'Append entities (and optional edges) from a CSV file. Adds to the current doc rather than replacing.',
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
  },
  {
    // Session 134 — Miro/Mural escape hatch. Neither tool exposes
    // connectors in a client-accessible format, so this fronts a paste
    // dialog (one entity per line) rather than a file picker.
    id: 'whiteboard',
    label: 'Paste from whiteboard',
    hint: 'Miro / Mural / FigJam / any text source. One entity per pasted line; bullet markers stripped. Connectors aren’t inferred.',
    run: async (s) => {
      s.openWhiteboardPaste();
    },
  },
];

export function ImportPickerDialog() {
  const open = useDocumentStore((s) => s.importPickerOpen);
  const close = useDocumentStore((s) => s.closeImportPicker);

  if (!open) return null;

  const handlePick = async (action: ImportAction): Promise<void> => {
    close();
    await action.run(useDocumentStore.getState());
  };

  return (
    <LargeDialog
      open={open}
      onClose={close}
      title="Import"
      subtitle="Pick a source to import. CSV appends to the current document; the rest open the imported diagram."
      closeAriaLabel="Close import picker"
      widthClass="w-[min(640px,94vw)]"
    >
      <ul className="grid grid-cols-1 gap-1.5 overflow-y-auto pr-1 sm:grid-cols-2">
        {IMPORT_ACTIONS.map((it) => (
          <li key={it.id}>
            <button
              type="button"
              onClick={() => void handlePick(it)}
              className={clsx(
                'group flex h-full w-full flex-col gap-0.5 rounded-md border border-neutral-200 bg-white px-3 py-2 text-left transition',
                'hover:border-accent-400 hover:bg-accent-50/40',
                CARD_FOCUS,
                'dark:border-neutral-800 dark:bg-neutral-900 dark:hover:border-accent-500 dark:hover:bg-accent-950/40'
              )}
            >
              <span className="font-medium text-neutral-900 text-sm dark:text-neutral-100">
                {it.label}
              </span>
              <span className="text-[11px] text-neutral-500 leading-snug dark:text-neutral-400">
                {it.hint}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </LargeDialog>
  );
}
