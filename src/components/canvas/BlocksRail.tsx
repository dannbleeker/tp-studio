import { ChevronLeft, ChevronRight, LayoutGrid, LayoutTemplate } from 'lucide-react';
import { useShallow } from 'zustand/react/shallow';
import {
  DIAGRAM_SHORT_LABEL,
  DIAGRAM_TYPE_LABEL,
  ENTITY_TYPE_META,
  PALETTE_BY_DIAGRAM,
  paletteForDoc,
  resolveEntityTypeMeta,
} from '@/domain/entityTypeMeta';
import type { DiagramType, EntityType } from '@/domain/types';
import { guardWriteOrToast } from '@/services/browseLock';
import { getCanvasInstance } from '@/services/canvasRef';
import { useDocumentStore } from '@/store';
import { currentDoc } from '@/store/selectors';

/**
 * Building Blocks rail — type-led entity creation. The entity *type* carries the
 * TP meaning, so it should lead creation rather than trail it in the inspector.
 * Lists the types valid for the current diagram (from `paletteForDoc`); a click
 * mints a correctly-typed node, ready to title. Additive: the canvas
 * double-click-to-create gesture still works.
 *
 * The per-type "meaning" copy is one source of truth on `EntityTypeMeta.meaning`
 * (`entityTypeMeta.ts`), shared with the inspector type-picker tooltip.
 */

// Reading order used to pick a representative "home" diagram for a type the
// current diagram can't use (e.g. Injection → FRT); the current type is skipped.
const HOME_ORDER: DiagramType[] = [
  'crt',
  'ec',
  'frt',
  'prt',
  'tt',
  'goalTree',
  'st',
  'nbr',
  'freeform',
];

const homeDiagramFor = (type: EntityType, exclude: DiagramType): DiagramType | null => {
  for (const dt of HOME_ORDER) {
    if (dt === exclude) continue;
    if (PALETTE_BY_DIAGRAM[dt].includes(type)) return dt;
  }
  return null;
};

const ALL_BUILTINS = Object.keys(ENTITY_TYPE_META) as EntityType[];

export function BlocksRail() {
  const {
    diagramType,
    customClasses,
    edgePalette,
    addEntity,
    setEntityPosition,
    collapsed,
    setCollapsed,
    openPatternLibrary,
  } = useDocumentStore(
    useShallow((s) => ({
      diagramType: currentDoc(s).diagramType,
      customClasses: currentDoc(s).customEntityClasses,
      // Session 193 — rail swatches track the active colour palette.
      edgePalette: s.edgePalette,
      addEntity: s.addEntity,
      setEntityPosition: s.setEntityPosition,
      collapsed: s.blocksRailCollapsed,
      setCollapsed: s.setBlocksRailCollapsed,
      openPatternLibrary: s.openPatternLibrary,
    }))
  );

  // Types valid for this diagram (built-ins first, then custom classes).
  const active = paletteForDoc({ diagramType, customEntityClasses: customClasses });
  const activeSet = new Set(active);
  // Built-in types this diagram can't use — shown dimmed with their home diagram.
  const dimmed = ALL_BUILTINS.filter((t) => !activeSet.has(t));

  const create = (type: string): void => {
    if (!guardWriteOrToast()) return;
    const entity = addEntity({ type: type as EntityType, startEditing: true });
    // Drop it at the current viewport centre. Auto-layout diagrams (CRT, FRT…)
    // ignore entity.position — dagre owns placement — so this only moves the node
    // on manual-layout diagrams (EC / freeform); it's harmless elsewhere.
    const inst = getCanvasInstance();
    if (inst) {
      setEntityPosition(
        entity.id,
        inst.screenToFlowPosition({ x: window.innerWidth / 2, y: window.innerHeight / 2 })
      );
    }
  };

  if (collapsed) {
    return (
      <div className="flex w-9 shrink-0 flex-col items-center border-neutral-200 border-r bg-neutral-50 py-2 dark:border-neutral-800 dark:bg-neutral-900 print:hidden">
        <button
          type="button"
          onClick={() => setCollapsed(false)}
          title="Show building blocks"
          aria-label="Show building blocks"
          className="rounded-md p-1.5 text-neutral-500 hover:bg-neutral-200/60 hover:text-neutral-900 dark:hover:bg-neutral-800 dark:hover:text-neutral-100"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
        <LayoutGrid className="mt-2 h-4 w-4 text-neutral-400" aria-hidden />
      </div>
    );
  }

  return (
    <aside
      aria-label="Building blocks"
      className="flex w-[236px] shrink-0 flex-col border-neutral-200 border-r bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-900 print:hidden"
    >
      <div className="flex items-start justify-between gap-2 px-3 pt-3 pb-2">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 font-semibold text-[11px] text-neutral-500 uppercase tracking-[0.06em] dark:text-neutral-400">
            <LayoutGrid className="h-3.5 w-3.5" aria-hidden />
            Building blocks
          </div>
          <p className="mt-0.5 text-[11px] text-neutral-400 leading-snug dark:text-neutral-500">
            Click to add a correctly-typed entity.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setCollapsed(true)}
          title="Collapse"
          aria-label="Collapse building blocks"
          className="-mr-1 shrink-0 rounded-md p-1 text-neutral-400 hover:bg-neutral-200/60 hover:text-neutral-700 dark:hover:bg-neutral-800 dark:hover:text-neutral-200"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-2">
        {active.map((type) => {
          const meta = resolveEntityTypeMeta(type, customClasses, edgePalette);
          const Icon = meta.icon;
          return (
            <button
              type="button"
              key={type}
              onClick={() => create(type)}
              title={`Add ${meta.label}`}
              className="group mb-1 flex w-full items-start gap-2 rounded-md border border-transparent p-2 text-left transition hover:border-neutral-200 hover:bg-white dark:hover:border-neutral-700 dark:hover:bg-neutral-950"
            >
              <span
                className="mt-0.5 h-9 w-1 shrink-0 rounded-full"
                style={{ backgroundColor: meta.stripeColor }}
                aria-hidden
              />
              <Icon
                className="mt-0.5 h-4 w-4 shrink-0 text-neutral-500 dark:text-neutral-400"
                aria-hidden
              />
              <span className="min-w-0">
                <span className="block font-medium text-[13px] text-neutral-800 dark:text-neutral-100">
                  {meta.label}
                </span>
                {meta.meaning && (
                  <span className="mt-0.5 block text-[11px] text-neutral-500 leading-snug dark:text-neutral-400">
                    {meta.meaning}
                  </span>
                )}
              </span>
            </button>
          );
        })}

        {dimmed.length > 0 && (
          <div className="mt-2 border-neutral-200/70 border-t pt-2 dark:border-neutral-800">
            {dimmed.map((type) => {
              const meta = ENTITY_TYPE_META[type];
              const Icon = meta.icon;
              const home = homeDiagramFor(type, diagramType);
              return (
                <div
                  key={type}
                  title={`${meta.label}${home ? ` — used in ${DIAGRAM_TYPE_LABEL[home]}` : ''}`}
                  className="flex items-center gap-2 rounded-md px-2 py-1 text-neutral-400 dark:text-neutral-600"
                >
                  <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden />
                  <span className="min-w-0 flex-1 truncate text-[12px]">{meta.label}</span>
                  {home && (
                    <span className="shrink-0 text-[10px] text-neutral-400 dark:text-neutral-600">
                      in {DIAGRAM_SHORT_LABEL[home]} →
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="border-neutral-200 border-t px-2 py-2 dark:border-neutral-800">
        <button
          type="button"
          onClick={() => openPatternLibrary('all')}
          className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-[12px] text-neutral-600 transition hover:bg-white hover:text-neutral-900 dark:text-neutral-300 dark:hover:bg-neutral-950 dark:hover:text-neutral-100"
        >
          <LayoutTemplate className="h-4 w-4 shrink-0" aria-hidden />
          Browse templates &amp; examples
        </button>
      </div>
    </aside>
  );
}
