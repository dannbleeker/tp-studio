import clsx from 'clsx';
import { entitiesOfType } from '@/domain/graph';
import { redactDocument } from '@/domain/redact';
import { getCanvasNodes } from '@/services/canvasRef';
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
  exportPPTX,
  exportPrtPlan,
  exportReasoningNarrativeMd,
  exportReasoningOutlineMd,
  exportRiskRegister,
  exportSVG,
  exportTtTasks,
  exportVGL,
} from '@/services/exporters';
import { exportECWorkshopSheet } from '@/services/exporters/ecWorkshopExport';
import { generateShareLink, SHARE_LINK_SOFT_WARN_BYTES } from '@/services/shareLink';
import { type RootStore, useDocumentStore } from '@/store';
import { currentDoc } from '@/store/selectors';
import { CARD_FOCUS } from '../ui/focusClasses';
import { LargeDialog } from '../ui/LargeDialog';

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
  /** Optional predicate — only render when the doc contains at least one
   *  entity matching the filter (e.g. `'ude'` for the risk-register
   *  export, which would otherwise produce an empty CSV; `'action'`
   *  for the TT-task export added Session 135; `'intermediateObjective'`
   *  for the PRT-plan export added Session 162). */
  requiresEntityType?: 'ude' | 'action' | 'intermediateObjective';
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
          await exportPNG(currentDoc(s), getCanvasNodes());
        },
      },
      {
        id: 'jpeg',
        label: 'JPEG (2×)',
        hint: 'Smaller file than PNG, no transparency.',
        run: async (s) => {
          await exportJPEG(currentDoc(s), getCanvasNodes());
        },
      },
      {
        id: 'svg',
        label: 'SVG',
        hint: 'Vector, sharp at any zoom. Best for design tools.',
        run: async (s) => {
          await exportSVG(currentDoc(s), getCanvasNodes());
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
        // Session 136 — exporter now also embeds a PNG render of the
        // canvas as a `<figure>` at the top, so the same `getCanvasNodes`
        // dance the image exports use applies here.
        run: async (s) => {
          await exportHTMLViewer(currentDoc(s), getCanvasNodes());
        },
      },
      {
        id: 'ec-workshop-sheet',
        label: 'EC workshop sheet (PDF)',
        hint: 'One-page A4 landscape handout matching the BESTSELLER PPT layout.',
        onlyOnECDoc: true,
        run: async (s) => {
          const ok = await exportECWorkshopSheet(currentDoc(s));
          if (ok) s.showToast('success', 'EC workshop sheet saved.');
          else s.showToast('error', 'Workshop sheet export failed.');
        },
      },
      {
        // Session 134 — PowerPoint deck export (closes major gap #10 from
        // the spec gap analysis). Cover + system scope + diagram screenshot
        // + reasoning bullets + EC conflict / CRT Core Driver / method
        // checklist appendices. Lazy-loads pptxgenjs.
        id: 'pptx-deck',
        label: 'PowerPoint deck (.pptx)',
        hint: 'Cover + diagram snapshot + narrative bullets + per-diagram appendix. Workshop-ready.',
        run: async (s) => {
          try {
            await exportPPTX(currentDoc(s), getCanvasNodes(), s.causalityLabel);
            s.showToast('success', 'PowerPoint deck saved.');
          } catch (err) {
            s.showToast('error', err instanceof Error ? err.message : 'PowerPoint export failed.');
          }
        },
      },
      {
        // Session 134 — risk-register export (closes the second half of
        // major gap #5: "convert NBR items into a risk register"). One CSV
        // row per UDE; columns: risk_id / risk / trigger / consequence /
        // mitigation / owner / status. Diagram-type agnostic — works on
        // any doc with UDEs (NBR is the canonical case but CRT UDEs map
        // naturally onto a register too). Gated by `requiresEntityType:
        // 'ude'` so docs without any UDEs (clouds, goal trees) don't see
        // the empty-CSV trap.
        id: 'risk-register',
        label: 'Risk register (CSV)',
        hint: 'One row per UDE: risk / trigger / consequence / mitigation / owner / status. Drops into Jira / Linear / a spreadsheet.',
        requiresEntityType: 'ude',
        run: (s) => {
          const n = exportRiskRegister(currentDoc(s));
          s.showToast('success', `Exported risk register (${n} risk${n === 1 ? '' : 's'}).`);
        },
      },
      {
        // Session 135 — TT-task tracker CSV (closes the first half of
        // major gap #7: "TT actions → task tracker"). One CSV row per
        // `action` entity; columns: step / action / precondition /
        // outcome / owner / due_date / status / success_criteria.
        // Diagram-type agnostic — TT is the canonical case but any
        // doc containing action entities exports cleanly. Gated by
        // `requiresEntityType: 'action'` so docs without actions
        // don't see the empty-CSV trap.
        id: 'tt-tasks',
        label: 'Task tracker CSV',
        hint: 'One row per TT action: step / action / precondition / outcome / owner / due / status / success criteria. Drops into Jira / Trello / Planner / Asana.',
        requiresEntityType: 'action',
        run: (s) => {
          const n = exportTtTasks(currentDoc(s));
          s.showToast('success', `Exported ${n} action${n === 1 ? '' : 's'} to CSV.`);
        },
      },
      {
        // Phase 3 #6 — PRT ordered-plan CSV. Topologically sorts a
        // Prerequisite Tree and emits its Intermediate Objectives in
        // dependency order (a prerequisite IO precedes the one that needs
        // it); columns: step / objective / overcomes / depends_on / owner /
        // due_date / status / notes. Gated by `requiresEntityType:
        // 'intermediateObjective'` so non-PRT docs don't see the empty-CSV
        // trap.
        id: 'prt-plan',
        label: 'Prerequisite plan (CSV)',
        hint: 'One row per Intermediate Objective in dependency order: step / objective / overcomes / depends on / owner / due / status / notes.',
        requiresEntityType: 'intermediateObjective',
        run: (s) => {
          const n = exportPrtPlan(currentDoc(s));
          s.showToast(
            'success',
            `Exported ${n} objective${n === 1 ? '' : 's'} in dependency order.`
          );
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
        hint: 'Full round-trip: re-import via Import… → TP Studio JSON.',
        run: (s) => exportJSON(currentDoc(s)),
      },
      {
        id: 'json-redacted',
        label: 'JSON (redacted)',
        hint: 'Titles → #N, descriptions / labels stripped. For sharing a structural sample.',
        run: (s) => {
          exportJSON(redactDocument(currentDoc(s)));
          s.showToast(
            'info',
            'Exported with titles replaced by #N and descriptions / labels stripped.'
          );
        },
      },
      {
        id: 'flying-logic',
        label: 'Flying Logic',
        hint: 'Native FL file format. Round-trips via Import… → Flying Logic file.',
        run: (s) => exportFlyingLogic(currentDoc(s)),
      },
      {
        id: 'opml',
        label: 'OPML outline',
        hint: 'Opens in OmniOutliner, Bike, Logseq, etc.',
        run: (s) => exportOPML(currentDoc(s)),
      },
      {
        id: 'dot',
        label: 'Graphviz DOT',
        hint: 'Re-render via Graphviz tooling.',
        run: (s) => exportDOT(currentDoc(s)),
      },
      {
        id: 'mermaid',
        label: 'Mermaid',
        hint: 'Markdown-embeddable diagram source. Round-trips via Import… → Mermaid diagram.',
        run: (s) => exportMermaid(currentDoc(s)),
      },
      {
        id: 'vgl',
        label: 'VGL (declarative)',
        hint: 'Vector Graph Language-flavored file. One-way; no companion import.',
        run: (s) => exportVGL(currentDoc(s)),
      },
      {
        id: 'csv',
        label: 'CSV',
        hint: 'Entities + edges + groups in one RFC-4180 file. Re-import via Import… → Entities CSV.',
        run: (s) => exportCSV(currentDoc(s)),
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
        run: (s) => exportAnnotationsMd(currentDoc(s)),
      },
      {
        id: 'annotations-txt',
        label: 'Annotations (plain text)',
        hint: 'Same content as the Markdown variant, without formatting.',
        run: (s) => exportAnnotationsTxt(currentDoc(s)),
      },
      {
        id: 'reasoning-narrative',
        label: 'Reasoning as narrative (Markdown)',
        hint: 'Prose write-up of the causal chain. Best for emails / briefs.',
        run: (s) => exportReasoningNarrativeMd(currentDoc(s)),
      },
      {
        id: 'reasoning-outline',
        label: 'Reasoning as outline (Markdown)',
        hint: 'Structured argument form. Best for slide-style writeups.',
        run: (s) => exportReasoningOutlineMd(currentDoc(s)),
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
            const link = await generateShareLink(currentDoc(s));
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
  const diagramType = useDocumentStore((s) => currentDoc(s).diagramType);
  // Session 134 — surfaced separately so the `requiresEntityType` filter
  // below can short-circuit on docs that have no UDEs without forcing a
  // full doc-tree subscription. Session 135 / Perf #17 — replaced the
  // `Object.values().some()` scan with the cached `entitiesOfType`
  // index (O(1) Map.get); the selector still re-runs on every snapshot,
  // but the per-call cost drops from O(N) to O(1) and the boolean
  // result stays stable across non-UDE mutations so the component
  // doesn't re-render unnecessarily.
  const hasAnyUde = useDocumentStore((s) => entitiesOfType(currentDoc(s), 'ude').length > 0);
  // Session 135 / spec major gap #7 — parallel guard for the TT-task
  // CSV export. Same O(1) cached lookup pattern as `hasAnyUde`.
  const hasAnyAction = useDocumentStore((s) => entitiesOfType(currentDoc(s), 'action').length > 0);
  // Parallel guard for the PRT ordered-plan CSV export. The
  // `requiresEntityType: 'intermediateObjective'` flag was declared when the
  // export shipped (Session 162) but never wired into the filter below, so the
  // option surfaced on every document — the empty-CSV trap it was meant to
  // avoid. Same O(1) cached lookup as `hasAnyUde` / `hasAnyAction`.
  const hasAnyIntermediateObjective = useDocumentStore(
    (s) => entitiesOfType(currentDoc(s), 'intermediateObjective').length > 0
  );

  if (!open) return null;

  // Availability of each gated entity type, keyed by the `requiresEntityType`
  // value — so the per-item filter below is one lookup instead of an if-ladder.
  const hasEntityType: Record<'ude' | 'action' | 'intermediateObjective', boolean> = {
    ude: hasAnyUde,
    action: hasAnyAction,
    intermediateObjective: hasAnyIntermediateObjective,
  };

  const handlePick = async (action: ExportAction): Promise<void> => {
    close();
    // Run the action against the live store state. The exporter
    // surfaces its own toasts (success / error / info); we just
    // dispatch and close. Awaited so async exporters (PNG / JPEG /
    // SVG / EC workshop) finish before any subsequent state read.
    await action.run(useDocumentStore.getState());
  };

  return (
    <LargeDialog
      open={open}
      onClose={close}
      title="Export"
      subtitle="Pick a format. Files download to your browser's default location."
      closeAriaLabel="Close export picker"
      widthClass="w-[min(720px,94vw)]"
    >
      <div className="flex flex-col gap-4 overflow-y-auto pr-1">
        {EXPORT_CATEGORIES.map((cat) => {
          const visible = cat.items.filter((it) => {
            if (it.onlyOnECDoc && diagramType !== 'ec') return false;
            if (it.requiresEntityType && !hasEntityType[it.requiresEntityType]) return false;
            return true;
          });
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
                        'hover:border-indigo-400 hover:bg-indigo-50/40',
                        CARD_FOCUS,
                        'dark:border-neutral-800 dark:bg-neutral-900 dark:hover:border-indigo-500 dark:hover:bg-indigo-950/40'
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
    </LargeDialog>
  );
}
