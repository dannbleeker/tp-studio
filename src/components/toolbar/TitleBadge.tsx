import { DataComponent } from '@/components/dataComponentNames';
import { DIAGRAM_TYPE_LABEL } from '@/domain/entityTypeMeta';
import { useDocumentStore } from '@/store';
import { Info } from 'lucide-react';

/**
 * Editable doc-title at the top-left of the canvas, paired with the
 * diagram-type badge (hidden on narrow viewports) and an info button that
 * opens the Document Inspector.
 *
 * Lives next to TopBar in the toolbar/ folder because layout-wise the two
 * are siblings — TitleBadge anchors left, TopBar anchors right, both at
 * z-10 above the canvas.
 */
export function TitleBadge() {
  const title = useDocumentStore((s) => s.doc.title);
  const setTitle = useDocumentStore((s) => s.setTitle);
  const diagramType = useDocumentStore((s) => s.doc.diagramType);
  const locked = useDocumentStore((s) => s.browseLocked);
  const openDocSettings = useDocumentStore((s) => s.openDocSettings);

  return (
    <div
      data-component={DataComponent.TitleBadge}
      // Title region caps at viewport-minus-TopBar so a long title never
      // collides with the toolbar buttons:
      //   <sm  (TopBar ~120 px, icon-only Commands + Lock + Kebab)
      //   sm   (TopBar ~150 px, full Commands + Lock + History + Help + Theme)
      //   md+  (TopBar ~280 px, full Commands + Lock + Layout + History + Help + Theme)
      className="pointer-events-none absolute left-4 top-4 z-10 flex max-w-[calc(100%-9rem)] items-center gap-2 sm:max-w-[calc(100%-12rem)] md:max-w-[calc(100%-20rem)]"
    >
      <input
        // The width follows the title text so the badge sits close to it, but
        // never exceeds 60ch so a runaway title can't push the toolbar off-screen.
        className="pointer-events-auto min-w-0 max-w-[60ch] flex-shrink rounded-md bg-transparent px-2 py-1 text-sm font-medium text-neutral-900 outline-none transition focus:bg-white focus:shadow-sm disabled:opacity-60 dark:text-neutral-100 dark:focus:bg-neutral-900"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        size={Math.max(Math.min(title.length, 50), 6)}
        disabled={locked}
      />
      <span
        className="hidden truncate rounded-full bg-neutral-200/70 px-2 py-0.5 text-[10px] font-medium text-neutral-600 sm:inline-block dark:bg-neutral-800 dark:text-neutral-300"
        title={DIAGRAM_TYPE_LABEL[diagramType]}
      >
        {DIAGRAM_TYPE_LABEL[diagramType]}
      </span>
      <button
        type="button"
        onClick={openDocSettings}
        className="pointer-events-auto rounded p-1 text-neutral-400 transition hover:bg-neutral-100 hover:text-neutral-700 dark:hover:bg-neutral-800 dark:hover:text-neutral-200"
        title="Document details"
        aria-label="Document details"
      >
        <Info className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
