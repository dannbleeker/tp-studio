import { structuralEntities } from '@/domain/graph';
import type { TPDocument } from '@/domain/types';
import { useFocusTrap } from '@/hooks/useFocusTrap';
import { getCanvasNodes } from '@/services/canvasRef';
import { log } from '@/services/logger';
import { exportToVectorPdf } from '@/services/pdfExport';
import { useDocumentStore } from '@/store';
import clsx from 'clsx';
import { FileDown, Printer, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Button } from '../ui/Button';

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

type PrintMode = 'standard' | 'workshop' | 'inksaving';

const MODE_LABEL: Record<PrintMode, string> = {
  standard: 'Standard PDF',
  workshop: 'Workshop print',
  inksaving: 'Ink-saving',
};

const MODE_HINT: Record<PrintMode, string> = {
  standard:
    'Default vector PDF via the browser. Letter / A4, auto-tiled across pages with the print stylesheet.',
  workshop:
    'High-contrast, large-font, designed to be readable across a meeting room. Group rectangles render as wide bands; entity titles bump to 18pt.',
  inksaving:
    "Group shading removed, edges thinner, blacks softened to grey. Saves toner when you're printing dozens of copies for a workshop handout.",
};

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
  return (
    template
      .replace(/\{title\}/g, doc.title || 'Untitled')
      .replace(/\{date\}/g, date)
      .replace(/\{author\}/g, doc.author ?? '')
      .replace(/\{diagramType\}/g, doc.diagramType)
      // pageNumber / pageCount aren't trivially injectable from app
      // JS — browsers control running headers. Leave them as-is so the
      // user understands the merge happened.
      .replace(/\{pageNumber\}/g, '')
      .replace(/\{pageCount\}/g, '')
  );
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

  const dialogRef = useRef<HTMLDivElement | null>(null);
  useFocusTrap(dialogRef, open);

  const hasSelection =
    (selection.kind === 'entities' || selection.kind === 'edges') && selection.ids.length > 0;
  // Reset the selection-only flag when the selection vanishes —
  // printing "selection only" with no selection would print
  // nothing.
  useEffect(() => {
    if (!hasSelection && selectionOnly) setSelectionOnly(false);
  }, [hasSelection, selectionOnly]);

  // Esc closes (in addition to the X button and the focus trap's
  // tab cycling).
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        close();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, close]);

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
    <dialog
      open
      className="fixed inset-0 z-50 m-0 flex h-screen max-h-screen w-screen max-w-none items-center justify-center bg-black/40 p-0"
      aria-modal="true"
      aria-labelledby="print-preview-title"
    >
      <div
        ref={dialogRef}
        tabIndex={-1}
        className="flex w-[min(640px,92vw)] flex-col gap-4 rounded-lg border border-neutral-200 bg-white p-5 shadow-xl outline-none dark:border-neutral-800 dark:bg-neutral-950"
      >
        <header className="flex items-center justify-between">
          <h2 id="print-preview-title" className="text-base font-semibold">
            Print / Save as PDF
          </h2>
          <Button variant="ghost" size="icon" onClick={close} aria-label="Close print preview">
            <X className="h-4 w-4" />
          </Button>
        </header>

        <div className="flex flex-col gap-3">
          <fieldset className="flex flex-col gap-2 text-sm">
            <legend className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
              Mode
            </legend>
            <div className="grid grid-cols-3 gap-2">
              {(['standard', 'workshop', 'inksaving'] satisfies PrintMode[]).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMode(m)}
                  className={clsx(
                    'rounded-md border px-3 py-2 text-left text-xs transition',
                    mode === m
                      ? 'border-indigo-400 bg-indigo-50 text-indigo-900 dark:border-indigo-500 dark:bg-indigo-950/40 dark:text-indigo-200'
                      : 'border-neutral-200 hover:bg-neutral-50 dark:border-neutral-800 dark:hover:bg-neutral-900'
                  )}
                >
                  <div className="font-medium">{MODE_LABEL[m]}</div>
                </button>
              ))}
            </div>
            <p className="text-[11px] italic text-neutral-500 dark:text-neutral-400">
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

          <label className="flex flex-col gap-1 text-xs">
            <span className="text-neutral-600 dark:text-neutral-300">
              Header template — merge fields: <code>{'{title}'}</code> <code>{'{date}'}</code>{' '}
              <code>{'{author}'}</code> <code>{'{diagramType}'}</code>
            </span>
            <input
              type="text"
              value={headerTemplate}
              onChange={(e) => setHeaderTemplate(e.target.value)}
              className="rounded-md border border-neutral-200 bg-white px-2 py-1 text-xs outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400 dark:border-neutral-700 dark:bg-neutral-900"
            />
            <span className="text-[10px] italic text-neutral-500 dark:text-neutral-400">
              Preview: {resolveMergeFields(headerTemplate, doc) || '(empty)'}
            </span>
          </label>

          <label className="flex flex-col gap-1 text-xs">
            <span className="text-neutral-600 dark:text-neutral-300">Footer template</span>
            <input
              type="text"
              value={footerTemplate}
              onChange={(e) => setFooterTemplate(e.target.value)}
              className="rounded-md border border-neutral-200 bg-white px-2 py-1 text-xs outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400 dark:border-neutral-700 dark:bg-neutral-900"
            />
            <span className="text-[10px] italic text-neutral-500 dark:text-neutral-400">
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
      </div>
    </dialog>
  );
}
