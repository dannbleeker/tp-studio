import { DIAGRAM_TYPE_LABEL } from '@/domain/entityTypeMeta';
import { EXAMPLE_BY_DIAGRAM } from '@/domain/examples';
import type { DiagramType } from '@/domain/types';
import { getCanvasInstance } from '@/services/canvasRef';
import { useDocumentStore } from '@/store';
import clsx from 'clsx';
import { LargeDialog } from '../ui/LargeDialog';
import { CARD_FOCUS } from '../ui/focusClasses';

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
 *   - `'example'`→ click a card → `setDocument(buildExample(type))`
 *
 * Card content per diagram type is hand-curated below — a one-line
 * "use this when…" cue plus the canonical label. Order matches the
 * mental flow of "current state → desired state → execution plan"
 * (CRT → FRT → PRT → TT) then the EC + Goal Tree + S&T pair, with
 * the open-ended Freeform last.
 */

type DiagramCard = {
  type: DiagramType;
  short: string;
  use: string;
};

const DIAGRAM_CARDS: DiagramCard[] = [
  {
    type: 'crt',
    short: 'CRT',
    use: 'Map the chains of cause and effect behind a problem — find the few root causes that produce many UDEs.',
  },
  {
    type: 'frt',
    short: 'FRT',
    use: 'Lay out the future state you want, plus the injections that get you there from the current reality.',
  },
  {
    type: 'prt',
    short: 'PRT',
    use: 'Plan past obstacles — what intermediate objectives must hold before the goal becomes reachable?',
  },
  {
    type: 'tt',
    short: 'TT',
    use: 'Sequence the concrete actions that turn each intermediate objective into the next, step by step.',
  },
  {
    type: 'ec',
    short: 'EC',
    use: 'Diagnose a conflict — surface the two opposing wants, the needs behind them, and the shared objective.',
  },
  {
    type: 'goalTree',
    short: 'Goal Tree',
    use: 'Decompose a goal into critical success factors and the necessary conditions that hold them up.',
  },
  {
    type: 'st',
    short: 'S&T',
    use: 'Pair every layer of a strategy with the tactic that achieves it, recursively down to action.',
  },
  {
    type: 'freeform',
    short: 'Freeform',
    use: 'Argument mapping, brainstorm, or anything that needs the canvas without TOC type constraints.',
  },
];

export function DiagramTypePickerDialog() {
  const mode = useDocumentStore((s) => s.diagramPickerOpen);
  const close = useDocumentStore((s) => s.closeDiagramPicker);
  const newDocument = useDocumentStore((s) => s.newDocument);
  const setDocument = useDocumentStore((s) => s.setDocument);
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
    const previousDoc = useDocumentStore.getState().doc;
    if (mode === 'new') {
      newDocument(type);
    } else {
      setDocument(EXAMPLE_BY_DIAGRAM[type]());
    }
    fitViewAfterLoad();
    showToast(
      'success',
      mode === 'new'
        ? `New ${DIAGRAM_TYPE_LABEL[type]} created.`
        : `Loaded example ${DIAGRAM_TYPE_LABEL[type]}.`,
      {
        action: {
          label: 'Undo',
          run: () => setDocument(previousDoc),
        },
      }
    );
    close();
  };

  const title = mode === 'new' ? 'New diagram' : 'Load example diagram';
  const subtitle =
    mode === 'new'
      ? 'Pick a diagram type to start fresh. Existing doc is preserved on Undo from the success toast.'
      : 'Pick a diagram type and we load a worked example so you can see the shape before building your own.';

  return (
    <LargeDialog
      open={open}
      onClose={close}
      title={title}
      subtitle={subtitle}
      closeAriaLabel="Close diagram picker"
    >
      <ul
        className="grid grid-cols-1 gap-3 overflow-y-auto pr-1 sm:grid-cols-2 lg:grid-cols-3"
        aria-label="Diagram types"
      >
        {DIAGRAM_CARDS.map((card) => {
          const label = DIAGRAM_TYPE_LABEL[card.type];
          return (
            <li key={card.type}>
              <button
                type="button"
                onClick={() => handlePick(card.type)}
                aria-label={`${mode === 'new' ? 'New' : 'Load example'}: ${label}`}
                className={clsx(
                  'group flex w-full flex-col gap-1.5 rounded-md border border-neutral-200 bg-white p-3 text-left transition',
                  'hover:border-indigo-400 hover:bg-indigo-50/40',
                  CARD_FOCUS,
                  'dark:border-neutral-800 dark:bg-neutral-900 dark:hover:border-indigo-500 dark:hover:bg-indigo-950/40'
                )}
              >
                <span className="rounded bg-indigo-100 px-1.5 py-0 font-semibold text-[9px] text-indigo-700 uppercase tracking-wide dark:bg-indigo-950 dark:text-indigo-200">
                  {card.short}
                </span>
                <h3 className="font-medium text-neutral-900 text-sm leading-tight dark:text-neutral-100">
                  {label}
                </h3>
                <p className="text-neutral-600 text-xs leading-snug dark:text-neutral-400">
                  {card.use}
                </p>
              </button>
            </li>
          );
        })}
      </ul>
    </LargeDialog>
  );
}
