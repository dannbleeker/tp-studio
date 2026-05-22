import clsx from 'clsx';
import { FileDown, Printer } from 'lucide-react';
import { useEffect, useState } from 'react';
import { structuralEntities } from '@/domain/graph';
import type { TPDocument } from '@/domain/types';
import { getCanvasNodes } from '@/services/canvasRef';
import { exportToVectorPdf } from '@/services/exporters/pdfExport';
import { log } from '@/services/logger';
import { useDocumentStore } from '@/store';
import { TextInput } from '../settings/formPrimitives';
import { Button } from '../ui/Button';
import { SELECTED_BUTTON_CLASS, UNSELECTED_BUTTON_CLASS } from '../ui/buttonClasses';
import { LargeDialog } from '../ui/LargeDialog';
import { EYEBROW } from '../ui/textClasses';
import { MODE_HINT, MODE_LABEL, ModeThumbnail, type PrintMode } from './PrintModeThumbnail';

/**
 * Session 77 / brief §10 — Print preview dialog.
 *
 * Surfaces the print mode + options before handing off to
 * `window.print()`. Sets two body-level classes that `print.css`
 * branches on:
 *
 *   - `print-mode-standard` / `print-mode-workshop` /
 *     `print-mode-inksaving` — selects the visual treatment.
 *   - `print-include-appendix` — when set, the printed output includes
 *     a numbered annotation appendix after the diagram.
 *
 * Header + footer text supports five merge fields: `{title}`,
 * `{date}`, `{author}`, `{pageNumber}`, `{pageCount}`,
 * `{diagramType}`. The fields are resolved at print time (the doc
 * title / author / date / type are static; pageNumber / pageCount
 * come from the browser's running headers if available, but the most
 * portable behaviour is to render a printed header/footer band INSIDE
 * the document and let the browser's own running-headers handle the
 * page-N-of-M case).
 */

// Session 135 — print-mode presentation (type / labels / hints /
// thumbnails) extracted to `PrintModeThumbnail.tsx` (file split).

const setBodyPrintMode = (
  mode: PrintMode,
  includeAppendix: boolean,
  selectionOnly: boolean
): void => {
  if (typeof document === 'undefined') return;
  const body = document.body;
  body.classList.remove('print-mode-standard', 'print-mode-workshop', 'print-mode-inksaving');
  body.classList.add(`print-mode-${mode}`);
  body.classList.toggle('print-include-appendix', includeAppendix);
  body.classList.toggle('print-selection-only', selectionOnly);
};

const clearBodyPrintMode = (): void => {
  if (typeof document === 'undefined') return;
  const body = document.body;
  body.classList.remove(
    'print-mode-standard',
    'print-mode-workshop',
    'print-mode-inksaving',
    'print-include-appendix',
    'print-selection-only'
  );
};

const resolveMergeFields = (template: string, doc: TPDocument): string => {
  const date = new Date().toISOString().slice(0, 10);
  // Session 87 (S2) — `{pageNumber}` / `{pageCount}` removed from the
  // resolver. Pre-fix, they silently stripped to empty (browsers
  // control running headers, not app JS) but the help text claimed
  // they worked, so a user typing them saw the literal placeholder
  // vanish without explanation. The help-text row also no longer
  // lists them.
  return template
    .replace(/\{title\}/g, doc.title || 'Untitled')
    .replace(/\{date\}/g, date)
    .replace(/\{author\}/g, doc.author ?? '')
    .replace(/\{diagramType\}/g, doc.diagramType);
};

export function PrintPreviewDialog() {
  const open = useDocumentStore((s) => s.printOpen);
  const close = useDocumentStore((s) => s.closePrintPreview);
  const doc = useDocumentStore((s) => s.doc);
  const selection = useDocumentStore((s) => s.selection);
  const showToast = useDocumentStore((s) => s.showToast);

  const [mode, setMode] = useState<PrintMode>('standard');
  const [includeAppendix, setIncludeAppendix] = useState(false);
  const [pdfBusy, setPdfBusy] = useState(false);
  // Session 79 / brief §10 — "Print selection only" toggle. Only
  // surfaced when something is selected; otherwise the option is
  // disabled with a hint.
  const [selectionOnly, setSelectionOnly] = useState(false);
  const [headerTemplate, setHeaderTemplate] = useState('{title} · {diagramType}');
  const [footerTemplate, setFooterTemplate] = useState('Exported {date} · TP Studio');

  const hasSelection =
    (selection.kind === 'entities' || selection.kind === 'edges') && selection.ids.length > 0;
  // Reset the selection-only flag when the selection vanishes —
  // printing "selection only" with no selection would print
  // nothing.
  useEffect(() => {
    if (!hasSelection && selectionOnly) setSelectionOnly(false);
  }, [hasSelection, selectionOnly]);

  // Keep the body-mode class in sync with the chosen mode while the
  // dialog is open. The classes only affect `@media print` rules, so
  // the canvas behind the dialog isn't visually disturbed.
  useEffect(() => {
    if (open) setBodyPrintMode(mode, includeAppendix, selectionOnly);
    else clearBodyPrintMode();
    return clearBodyPrintMode;
  }, [open, mode, includeAppendix, selectionOnly]);

  // Stash the resolved header/footer text into `data-` attributes
  // print.css reads via `content: attr(...)`. Easier than injecting
  // DOM nodes for the printed header.
  useEffect(() => {
    if (!open || typeof document === 'undefined') return;
    document.body.dataset.printHeader = resolveMergeFields(headerTemplate, doc);
    document.body.dataset.printFooter = resolveMergeFields(footerTemplate, doc);
    return () => {
      if (typeof document === 'undefined') return;
      delete document.body.dataset.printHeader;
      delete document.body.dataset.printFooter;
    };
  }, [open, headerTemplate, footerTemplate, doc]);

  if (!open) return null;

  const handlePrint = (): void => {
    // window.print is synchronous in spec but asynchronous in
    // practice — the dialog stays open during the print preview;
    // closing it after the call is correct.
    window.print();
    close();
  };

  // Session 80 / brief §8.1 + §8.6 + §8.8 — true vector PDF download.
  // Captures the live canvas as SVG, hands it to jspdf + svg2pdf, and
  // triggers a file download. Multi-page when the diagram exceeds one
  // page-height; appendix appended afterward when the toggle is on.
  const handleVectorPdf = async (): Promise<void> => {
    if (pdfBusy) return;
    setPdfBusy(true);
    try {
      const nodes = getCanvasNodes();
      // For "selection only", filter nodes to those whose id is in the
      // current selection — same semantics as the print-selection-only
      // body class but applied to the PDF source instead of CSS.
      const filtered =
        selectionOnly && hasSelection && selection.kind === 'entities'
          ? nodes.filter((n) => selection.ids.includes(n.id as never))
          : nodes;
      const ok = await exportToVectorPdf(doc, filtered, {
        pageSize: 'a4',
        mode,
        includeAppendix,
        header: resolveMergeFields(headerTemplate, doc),
        footer: resolveMergeFields(footerTemplate, doc),
      });
      if (!ok) {
        showToast('info', 'Nothing to export — add some entities first.');
        return;
      }
      showToast('success', 'Vector PDF saved.');
      close();
    } catch (err) {
      log.error('vector-pdf-export-failed', err);
      showToast(
        'error',
        `PDF export failed: ${err instanceof Error ? err.message : 'unknown error'}`
      );
    } finally {
      setPdfBusy(false);
    }
  };

  const annotationCount = structuralEntities(doc).filter((e) => e.description).length;

  return (
    <LargeDialog
      open={open}
      onClose={close}
      title="Print / Save as PDF"
      closeAriaLabel="Close print preview"
      widthClass="w-[min(640px,92vw)]"
    >
      <div className="flex flex-col gap-3">
        <fieldset className="flex flex-col gap-2 text-sm">
          <legend className={EYEBROW}>Mode</legend>
          <div className="grid grid-cols-3 gap-2">
            {(['standard', 'workshop', 'inksaving'] satisfies PrintMode[]).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                className={clsx(
                  // Design audit #5 — was paired with `_PLAIN` (no text
                  // colour), fading the unselected MODE_LABEL on dark.
                  'flex flex-col items-start gap-1.5 rounded-md border px-3 py-2 text-left text-xs transition',
                  mode === m ? SELECTED_BUTTON_CLASS : UNSELECTED_BUTTON_CLASS
                )}
              >
                {/* Session 88 (S20) — inline mode thumbnail. The
                      previews telegraph each mode's visual style
                      (colour stripes / bold high-contrast / no fills)
                      before the user commits. */}
                <ModeThumbnail mode={m} />
                <div className="font-medium">{MODE_LABEL[m]}</div>
              </button>
            ))}
          </div>
          <p className="text-[11px] text-neutral-500 italic dark:text-neutral-400">
            {MODE_HINT[mode]}
          </p>
        </fieldset>

        <label className="flex items-start gap-2 text-xs">
          <input
            type="checkbox"
            checked={includeAppendix}
            onChange={(e) => setIncludeAppendix(e.target.checked)}
            className="mt-0.5"
          />
          <span>
            Include <b>annotation appendix</b>{' '}
            <span className="text-neutral-500 dark:text-neutral-400">
              ({annotationCount} entit{annotationCount === 1 ? 'y' : 'ies'} with descriptions)
            </span>{' '}
            — a numbered list of every entity's description rendered after the diagram.
          </span>
        </label>

        <label className="flex items-start gap-2 text-xs">
          <input
            type="checkbox"
            checked={selectionOnly}
            onChange={(e) => setSelectionOnly(e.target.checked)}
            disabled={!hasSelection}
            className="mt-0.5 disabled:opacity-40"
          />
          <span className={hasSelection ? '' : 'opacity-60'}>
            <b>Print selection only</b>{' '}
            <span className="text-neutral-500 dark:text-neutral-400">
              {hasSelection
                ? '— only the entities + edges currently selected on the canvas will print.'
                : '(select one or more entities / edges first to enable this)'}
            </span>
          </span>
        </label>

        <label htmlFor="print-header-template" className="flex flex-col gap-1 text-xs">
          <span className="text-neutral-600 dark:text-neutral-300">
            Header template — merge fields: <code>{'{title}'}</code> <code>{'{date}'}</code>{' '}
            <code>{'{author}'}</code> <code>{'{diagramType}'}</code>
          </span>
          <TextInput
            id="print-header-template"
            value={headerTemplate}
            onChange={setHeaderTemplate}
            size="sm"
          />
          <span className="text-[10px] text-neutral-500 italic dark:text-neutral-400">
            Preview: {resolveMergeFields(headerTemplate, doc) || '(empty)'}
          </span>
        </label>

        <label htmlFor="print-footer-template" className="flex flex-col gap-1 text-xs">
          {/* Session 87 (S7) — surfaced the merge-field row above the
                input, matching the Header field's pattern. Same fields
                apply to both header and footer; documenting once at
                the header and leaving the footer label bare misled
                users into thinking footer had a different set. */}
          <span className="text-neutral-600 dark:text-neutral-300">
            Footer template — merge fields: <code>{'{title}'}</code> <code>{'{date}'}</code>{' '}
            <code>{'{author}'}</code> <code>{'{diagramType}'}</code>
          </span>
          <TextInput
            id="print-footer-template"
            value={footerTemplate}
            onChange={setFooterTemplate}
            size="sm"
          />
          <span className="text-[10px] text-neutral-500 italic dark:text-neutral-400">
            Preview: {resolveMergeFields(footerTemplate, doc) || '(empty)'}
          </span>
        </label>
      </div>

      <footer className="flex flex-wrap justify-end gap-2">
        <Button variant="ghost" onClick={close}>
          Cancel
        </Button>
        <Button variant="ghost" onClick={handlePrint}>
          <Printer className="h-3.5 w-3.5" />
          Open print dialog
        </Button>
        <Button
          variant="primary"
          onClick={handleVectorPdf}
          disabled={pdfBusy}
          aria-label="Save as vector PDF"
        >
          <FileDown className="h-3.5 w-3.5" />
          {pdfBusy ? 'Saving…' : 'Save as PDF'}
        </Button>
      </footer>
    </LargeDialog>
  );
}
