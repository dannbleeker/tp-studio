import { Info, Link2 } from 'lucide-react';
import { useShallow } from 'zustand/shallow';
import { DataComponent } from '@/components/dataComponentNames';
import { CLOUD_TYPE_LABEL } from '@/domain/cloudType';
import { DIAGRAM_TYPE_LABEL } from '@/domain/entityTypeMeta';
import { useDocumentStore } from '@/store';
import { currentDoc } from '@/store/selectors';
import { useLinkedFileName } from './useLinkedFileName';

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
  // Session 135 / Perf #9 — collapsed five separate `useDocumentStore`
  // calls into one `useShallow` bundle. Each subscription was its own
  // snapshot read; the bundle takes one snapshot read + shallow
  // compare. All values are primitives (string / boolean) or stable
  // action refs, so `useShallow` correctly avoids re-renders unless
  // the relevant primitives actually change.
  const { id, title, setTitle, diagramType, cloudType, locked, openDocSettings } = useDocumentStore(
    useShallow((s) => {
      const doc = currentDoc(s);
      return {
        id: doc.id,
        title: doc.title,
        setTitle: s.setTitle,
        diagramType: doc.diagramType,
        cloudType: doc.cloudType,
        locked: s.browseLocked,
        openDocSettings: s.openDocSettings,
      };
    })
  );
  // Additive (File System Access): the on-disk file this doc re-saves to, or
  // null. Renders nothing when unlinked / unsupported, so it never affects
  // viewports that have never saved to a file.
  const linkedName = useLinkedFileName(id);

  return (
    <div
      data-component={DataComponent.TitleBadge}
      // Lives in the header's title row (left side). `flex-1 min-w-0` lets it
      // take the space left of the TopBar and truncate a long title rather
      // than push the toolbar off-screen.
      className="flex min-w-0 flex-1 items-center gap-1.5 sm:gap-2"
    >
      <input
        // The width follows the title text so the badge sits close to it, but
        // never exceeds 60ch so a runaway title can't push the toolbar off-screen.
        // Padding tightens on the smallest viewports so a long title still
        // fits the available space without pushing the Info button out of
        // the page.
        // Session 89 EC chrome cleanup — added `text-ellipsis
        // overflow-hidden` so an over-cap title shows a "…" tail
        // instead of being silently clipped. Without ellipsis a long
        // title looked truncated-with-no-signal at the start (the
        // input scrolls horizontally on focus); with `truncate`-style
        // overflow the end of the field reads as "this continues."
        //
        // Session 115 — `aria-label` added. The visible text IS the
        // value of the input (the document title), but axe's `label`
        // rule requires a name independent of the value so a screen
        // reader can announce "Document title, edit text" before
        // reading the value. The axe-core a11y spec caught this on
        // first run; fix here rather than disabling the rule.
        aria-label="Document title"
        className="pointer-events-auto min-w-0 max-w-[60ch] flex-shrink overflow-hidden text-ellipsis whitespace-nowrap rounded-md bg-transparent px-1.5 py-1 font-medium text-neutral-900 text-sm outline-hidden transition focus:bg-white focus:shadow-xs disabled:opacity-60 sm:px-2 dark:text-neutral-100 dark:focus:bg-neutral-900"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        size={Math.max(Math.min(title.length, 50), 6)}
        disabled={locked}
      />
      {/* Session 87 — `title` attr removed: the visible text inside the
          badge IS the label, so a hover tooltip with the same string
          was redundant and (worse) drew on top of the EC reading-
          instructions strip when the user hovered. */}
      <span className="hidden truncate rounded-full bg-neutral-200/70 px-2 py-0.5 font-medium text-[10px] text-neutral-600 sm:inline-block dark:bg-neutral-800 dark:text-neutral-300">
        {DIAGRAM_TYPE_LABEL[diagramType]}
      </span>
      {/* Additive (TP Basics #1): the cloud's progression role, when tagged on
          an EC doc via the Document panel. Hidden until set; below `sm:` like
          the type badge so narrow viewports stay tidy. */}
      {cloudType && (
        <span
          className="hidden truncate rounded-full bg-sky-100/80 px-2 py-0.5 font-medium text-[10px] text-sky-700 sm:inline-block dark:bg-sky-900/40 dark:text-sky-300"
          title="Cloud type — its role in the UDE → Consolidated → Core progression (TP Basics)."
        >
          {CLOUD_TYPE_LABEL[cloudType]}
        </span>
      )}
      {/* Additive: shows when this doc is linked to an on-disk file (File
          System Access). The link icon + filename signal that "Save to file"
          re-writes this file in one click; "Save to file as…" picks a new one.
          Hidden below `sm:` like the type badge so narrow viewports stay tidy. */}
      {linkedName && (
        <span
          className="hidden max-w-[18ch] items-center gap-1 truncate rounded-full bg-emerald-100/80 px-2 py-0.5 font-medium text-[10px] text-emerald-700 sm:inline-flex dark:bg-emerald-900/40 dark:text-emerald-300"
          title={`Linked to ${linkedName} — “Save to file” writes here; “Save to file as…” picks a new file.`}
        >
          <Link2 aria-hidden className="h-3 w-3 shrink-0" />
          <span className="truncate">{linkedName}</span>
        </span>
      )}
      <button
        type="button"
        onClick={openDocSettings}
        // Hidden below `xs:` (480 px) — at very narrow widths every pixel
        // matters and the Document Inspector stays reachable via the
        // palette ("Document details" command). At xs+ the icon-only
        // button surfaces alongside the title.
        className="pointer-events-auto xs:inline-flex hidden rounded-sm p-1 text-neutral-400 transition hover:bg-neutral-100 hover:text-neutral-700 dark:hover:bg-neutral-800 dark:hover:text-neutral-200"
        title="Document details"
        aria-label="Document details"
      >
        <Info className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
