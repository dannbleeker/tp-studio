import clsx from 'clsx';
import { diagramLabel, diagramShortLabel } from '@/domain/entityPalettes';
import { EXAMPLE_BY_DIAGRAM } from '@/domain/examples';
import type { DiagramType } from '@/domain/types';
import { useT } from '@/i18n/useT';
import { getCanvasInstance } from '@/services/canvasRef';
import { useDocumentStore } from '@/store';
import { currentDoc } from '@/store/selectors';
import { CARD_FOCUS } from '../ui/focusClasses';
import { LargeDialog } from '../ui/LargeDialog';
import { undoRestoreAction } from '../ui/loadToast';

/**
 * Session 90 — DiagramTypePicker.
 *
 * Replaces 14 palette commands (`New <X>` + `Load example <X>` for each
 * of 7 diagram types) with two palette commands (`New diagram…` /
 * `Load example…`) that both open this picker in different modes. Trims
 * the palette dramatically and gives users a visual fan-out for "which
 * diagram type fits this problem?"
 *
 * Mode comes from the store's `diagramPickerOpen` tri-state:
 *   - `null`     → dialog closed
 *   - `'new'`    → click a card → `newDocument(type)`
 *   - `'example'`→ click a card → `openDocInTab(buildExample(type))`
 *
 * Card content per diagram type is hand-curated below — a one-line
 * "use this when…" cue plus the canonical label. Order matches the
 * mental flow of "current state → desired state → execution plan"
 * (CRT → FRT → PRT → TT) then the EC + Goal Tree + S&T pair, with
 * the open-ended Freeform last.
 */

/**
 * Card order. The short tag and the description used to live here; both now
 * come from the message catalogue — `short` was a verbatim duplicate of
 * the catalogue's short label, so dropping it removes a second place to keep in sync.
 */
const DIAGRAM_CARD_ORDER: DiagramType[] = [
  'crt',
  'frt',
  'prt',
  'tt',
  'nbr',
  'ec',
  'goalTree',
  'st',
  'id',
  'freeform',
];

export function DiagramTypePickerDialog() {
  const t = useT();
  const mode = useDocumentStore((s) => s.diagramPickerOpen);
  const close = useDocumentStore((s) => s.closeDiagramPicker);
  const newDocument = useDocumentStore((s) => s.newDocument);
  const setDocument = useDocumentStore((s) => s.setDocument);
  const openDocInTab = useDocumentStore((s) => s.openDocInTab);
  const showToast = useDocumentStore((s) => s.showToast);

  const open = mode !== null;
  if (!open) return null;

  // After the diagram lands, fit-view via two animation frames so React
  // Flow has reconciled the new node set before the fit calculation
  // runs. Same pattern as the example-load commands.
  const fitViewAfterLoad = (): void => {
    if (typeof window === 'undefined') return;
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        getCanvasInstance()?.fitView({ padding: 0.4, maxZoom: 1.2 });
      });
    });
  };

  const handlePick = (type: DiagramType): void => {
    const previousDoc = currentDoc(useDocumentStore.getState());
    let openedNewTab = false;
    if (mode === 'new') {
      // 'New' replaces the active tab via `newDocument` (which carries its
      // own creation-wizard + system-scope-nudge semantics). The tab
      // strip's + button and the New-tab palette command are the
      // "fresh doc in a new tab" paths.
      newDocument(type);
    } else {
      openedNewTab = openDocInTab(EXAMPLE_BY_DIAGRAM[type]());
    }
    fitViewAfterLoad();
    // `undoRestoreAction` offers Undo whenever the active doc was replaced:
    // a 'new' doc (openedNewTab stays false here) or an example loaded in
    // replace mode. An example opened in a new tab is undone by closing it.
    showToast(
      'success',
      mode === 'new'
        ? t.diagramPicker.createdToast({ diagram: diagramLabel(t, type) })
        : openedNewTab
          ? t.diagramPicker.loadedNewTabToast({ diagram: diagramLabel(t, type) })
          : t.diagramPicker.loadedToast({ diagram: diagramLabel(t, type) }),
      undoRestoreAction(openedNewTab, previousDoc, setDocument)
    );
    close();
  };

  const title = mode === 'new' ? t.diagramPicker.newTitle : t.diagramPicker.exampleTitle;
  const subtitle = mode === 'new' ? t.diagramPicker.newSubtitle : t.diagramPicker.exampleSubtitle;

  return (
    <LargeDialog
      open={open}
      onClose={close}
      title={title}
      subtitle={subtitle}
      closeAriaLabel={t.diagramPicker.close}
    >
      <ul
        className="grid grid-cols-1 gap-3 overflow-y-auto pr-1 sm:grid-cols-2 lg:grid-cols-3"
        aria-label={t.diagramPicker.listLabel}
      >
        {DIAGRAM_CARD_ORDER.map((cardType) => {
          const label = diagramLabel(t, cardType);
          return (
            <li key={cardType}>
              <button
                type="button"
                onClick={() => handlePick(cardType)}
                aria-label={
                  mode === 'new'
                    ? t.diagramPicker.pickNew({ diagram: label })
                    : t.diagramPicker.pickExample({ diagram: label })
                }
                className={clsx(
                  'group flex w-full flex-col gap-1.5 rounded-md border border-neutral-200 bg-white p-3 text-left transition',
                  'hover:border-accent-400 hover:bg-accent-50/40',
                  CARD_FOCUS,
                  'dark:border-neutral-800 dark:bg-neutral-900 dark:hover:border-accent-500 dark:hover:bg-accent-950/40'
                )}
              >
                <span className="rounded-sm bg-accent-100 px-1.5 py-0 font-semibold text-[9px] text-accent-700 uppercase tracking-wide dark:bg-accent-950 dark:text-accent-200">
                  {diagramShortLabel(t, cardType)}
                </span>
                <h3 className="font-medium text-neutral-900 text-sm leading-tight dark:text-neutral-100">
                  {label}
                </h3>
                <p className="text-neutral-600 text-xs leading-snug dark:text-neutral-400">
                  {t.diagram[cardType].use}
                </p>
              </button>
            </li>
          );
        })}
      </ul>
    </LargeDialog>
  );
}
