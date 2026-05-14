import { redactDocument } from '@/domain/redact';
import { useEscapeKey } from '@/hooks/useEscapeKey';
import { useFocusTrap } from '@/hooks/useFocusTrap';
import { getCanvasNodes } from '@/services/canvasRef';
import { exportECWorkshopSheet } from '@/services/ecWorkshopExport';
import {
  exportAnnotationsMd,
  exportAnnotationsTxt,
  exportCSV,
  exportDOT,
  exportFlyingLogic,
  exportHTMLViewer,
  exportJPEG,
  exportJSON,
  exportMermaid,
  exportOPML,
  exportPNG,
  exportReasoningNarrativeMd,
  exportReasoningOutlineMd,
  exportSVG,
  exportVGL,
} from '@/services/exporters';
import { SHARE_LINK_SOFT_WARN_BYTES, generateShareLink } from '@/services/shareLink';
import { type RootStore, useDocumentStore } from '@/store';
import clsx from 'clsx';
import { X } from 'lucide-react';
import { useRef } from 'react';
import { Button } from '../ui/Button';

/**
 * Session 90 — Single Export… picker.
 *
 * Replaces the ~17 individual `Export as X` palette commands with a
 * single `Export…` command that opens this dialog. Items are grouped
 * by category (Images / Documents / Data / Annotations / Share) so
 * the user finds the format they want in 1-2 visual scans rather
 * than scrolling through 17 palette rows.
 *
 * Each button dispatches the same underlying exporter the palette
 * command used to call — no behavior change. The picker closes on
 * pick; toasts are surfaced by the exporter itself (or by the
 * `onClick` wrapper here for ones that don't auto-toast).
 *
 * EC-specific items (Workshop sheet) only render on EC docs.
 */

type ExportAction = {
  id: string;
  label: string;
  hint: string;
  /** Optional filter — only render when the current diagram matches. */
  onlyOnECDoc?: boolean;
  run: (s: RootStore) => void | Promise<void>;
};

type ExportCategory = {
  title: string;
  items: ExportAction[];
};

const EXPORT_CATEGORIES: ExportCategory[] = [
  {
    title: 'Images',
    items: [
      {
        id: 'png',
        label: 'PNG (2×)',
        hint: 'Raster, 2× density, theme-aware. Best for slides.',
        run: async (s) => {
          await exportPNG(s.doc, getCanvasNodes());
        },
      },
      {
        id: 'jpeg',
        label: 'JPEG (2×)',
        hint: 'Smaller file than PNG, no transparency.',
        run: async (s) => {
          await exportJPEG(s.doc, getCanvasNodes());
        },
      },
      {
        id: 'svg',
        label: 'SVG',
        hint: 'Vector, sharp at any zoom. Best for design tools.',
        run: async (s) => {
          await exportSVG(s.doc, getCanvasNodes());
        },
      },
    ],
  },
  {
    title: 'Documents',
    items: [
      {
        id: 'print-pdf',
        label: 'Print / Save as PDF…',
        hint: 'Opens the print preview with mode + appendix + header/footer.',
        run: (s) => s.openPrintPreview(),
      },
      {
        id: 'html-viewer',
        label: 'Self-contained HTML viewer',
        hint: 'Single .html file, no network. Opens in any browser, works offline.',
        run: (s) => exportHTMLViewer(s.doc),
      },
      {
        id: 'ec-workshop-sheet',
        label: 'EC workshop sheet (PDF)',
        hint: 'One-page A4 landscape handout matching the BESTSELLER PPT layout.',
        onlyOnECDoc: true,
        run: async (s) => {
          const ok = await exportECWorkshopSheet(s.doc);
          if (ok) s.showToast('success', 'EC workshop sheet saved.');
          else s.showToast('error', 'Workshop sheet export failed.');
        },
      },
    ],
  },
  {
    title: 'Data',
    items: [
      {
        id: 'json',
        label: 'JSON',
        hint: 'Full round-trip: re-import via Import from JSON…',
        run: (s) => exportJSON(s.doc),
      },
      {
        id: 'json-redacted',
        label: 'JSON (redacted)',
        hint: 'Titles → #N, descriptions / labels stripped. For sharing a structural sample.',
        run: (s) => {
          exportJSON(redactDocument(s.doc));
          s.showToast(
            'info',
            'Exported with titles replaced by #N and descriptions / labels stripped.'
          );
        },
      },
      {
        id: 'flying-logic',
        label: 'Flying Logic',
        hint: 'Native FL file format. Round-trips with Open Flying Logic file.',
        run: (s) => exportFlyingLogic(s.doc),
      },
      {
        id: 'opml',
        label: 'OPML outline',
        hint: 'Opens in OmniOutliner, Bike, Logseq, etc.',
        run: (s) => exportOPML(s.doc),
      },
      {
        id: 'dot',
        label: 'Graphviz DOT',
        hint: 'Re-render via Graphviz tooling.',
        run: (s) => exportDOT(s.doc),
      },
      {
        id: 'mermaid',
        label: 'Mermaid',
        hint: 'Markdown-embeddable diagram source. Round-trips with Import from Mermaid…',
        run: (s) => exportMermaid(s.doc),
      },
      {
        id: 'vgl',
        label: 'VGL (declarative)',
        hint: 'Vector Graph Language-flavored file. One-way; no companion import.',
        run: (s) => exportVGL(s.doc),
      },
      {
        id: 'csv',
        label: 'CSV',
        hint: 'Entities + edges + groups in one RFC-4180 file. Re-import via Import entities from CSV…',
        run: (s) => exportCSV(s.doc),
      },
    ],
  },
  {
    title: 'Annotations & reasoning',
    items: [
      {
        id: 'annotations-md',
        label: 'Annotations (Markdown)',
        hint: 'Numbered list of entity descriptions + edge notes + assumptions.',
        run: (s) => exportAnnotationsMd(s.doc),
      },
      {
        id: 'annotations-txt',
        label: 'Annotations (plain text)',
        hint: 'Same content as the Markdown variant, without formatting.',
        run: (s) => exportAnnotationsTxt(s.doc),
      },
      {
        id: 'reasoning-narrative',
        label: 'Reasoning as narrative (Markdown)',
        hint: 'Prose write-up of the causal chain. Best for emails / briefs.',
        run: (s) => exportReasoningNarrativeMd(s.doc),
      },
      {
        id: 'reasoning-outline',
        label: 'Reasoning as outline (Markdown)',
        hint: 'Structured argument form. Best for slide-style writeups.',
        run: (s) => exportReasoningOutlineMd(s.doc),
      },
    ],
  },
  {
    title: 'Share',
    items: [
      {
        id: 'share-link',
        label: 'Copy read-only share link',
        hint: 'Compressed share URL with the doc embedded. Receiver opens it Browse-Locked.',
        run: async (s) => {
          try {
            const link = await generateShareLink(s.doc);
            if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
              await navigator.clipboard.writeText(link);
              const tooLarge = link.length > SHARE_LINK_SOFT_WARN_BYTES;
              s.showToast(
                tooLarge ? 'info' : 'success',
                tooLarge
                  ? `Share link copied (${(link.length / 1024).toFixed(1)} KB). Some chat clients may truncate links this large — consider exporting JSON instead.`
                  : 'Read-only share link copied to clipboard.'
              );
            } else {
              s.showToast(
                'error',
                "This browser doesn't expose the clipboard API. Use the JSON export to share."
              );
            }
          } catch (err) {
            s.showToast(
              'error',
              err instanceof Error ? err.message : 'Could not generate share link.'
            );
          }
        },
      },
    ],
  },
];

export function ExportPickerDialog() {
  const open = useDocumentStore((s) => s.exportPickerOpen);
  const close = useDocumentStore((s) => s.closeExportPicker);
  const diagramType = useDocumentStore((s) => s.doc.diagramType);
  const dialogRef = useRef<HTMLDivElement | null>(null);

  useFocusTrap(dialogRef, open);
  useEscapeKey(open, close);

  if (!open) return null;

  const handlePick = async (action: ExportAction): Promise<void> => {
    close();
    // Run the action against the live store state. The exporter
    // surfaces its own toasts (success / error / info); we just
    // dispatch and close. Awaited so async exporters (PNG / JPEG /
    // SVG / EC workshop) finish before any subsequent state read.
    await action.run(useDocumentStore.getState());
  };

  return (
    <dialog
      open
      className="fixed inset-0 z-50 m-0 flex h-screen max-h-screen w-screen max-w-none items-center justify-center bg-black/40 p-0"
      aria-modal="true"
      aria-labelledby="export-picker-title"
    >
      <div
        ref={dialogRef}
        tabIndex={-1}
        className="flex max-h-[88vh] w-[min(720px,94vw)] flex-col gap-4 rounded-lg border border-neutral-200 bg-white p-5 shadow-xl outline-none dark:border-neutral-800 dark:bg-neutral-950"
      >
        <header className="flex items-center justify-between">
          <div>
            <h2 id="export-picker-title" className="font-semibold text-base">
              Export
            </h2>
            <p className="text-neutral-500 text-xs dark:text-neutral-400">
              Pick a format. Files download to your browser's default location.
            </p>
          </div>
          <Button variant="ghost" size="icon" onClick={close} aria-label="Close export picker">
            <X className="h-4 w-4" />
          </Button>
        </header>

        <div className="flex flex-col gap-4 overflow-y-auto pr-1">
          {EXPORT_CATEGORIES.map((cat) => {
            const visible = cat.items.filter((it) => !it.onlyOnECDoc || diagramType === 'ec');
            if (visible.length === 0) return null;
            return (
              <section key={cat.title} className="flex flex-col gap-1.5">
                <h3 className="font-semibold text-[10px] text-neutral-500 uppercase tracking-wider dark:text-neutral-400">
                  {cat.title}
                </h3>
                <ul className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                  {visible.map((it) => (
                    <li key={it.id}>
                      <button
                        type="button"
                        onClick={() => void handlePick(it)}
                        className={clsx(
                          'group flex w-full flex-col gap-0.5 rounded-md border border-neutral-200 bg-white px-3 py-2 text-left transition',
                          'hover:border-indigo-400 hover:bg-indigo-50/40 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-300',
                          'dark:border-neutral-800 dark:bg-neutral-900 dark:focus:ring-indigo-600 dark:hover:border-indigo-500 dark:hover:bg-indigo-950/40'
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
              </section>
            );
          })}
        </div>
      </div>
    </dialog>
  );
}
