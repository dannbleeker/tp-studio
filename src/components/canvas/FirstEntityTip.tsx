import { useDocumentStore } from '@/store';
import { X } from 'lucide-react';
import { useShallow } from 'zustand/shallow';

/**
 * Shown once the user has placed their first entity — points them at the
 * next interactions (Tab, drag-to-connect, palette). One-time per browser:
 * dismissed-state lives in uiSlice's `emptyStateTipDismissed` and the panel
 * stays gone for the session.
 *
 * The tip auto-hides past two entities — by then the user has the rhythm
 * and the tip just clutters the canvas.
 */
export function FirstEntityTip() {
  const { dismissed, dismiss, entityCount } = useDocumentStore(
    useShallow((s) => ({
      dismissed: s.emptyStateTipDismissed,
      dismiss: s.dismissEmptyStateTip,
      entityCount: Object.keys(s.doc.entities).length,
    }))
  );

  if (dismissed || entityCount === 0 || entityCount > 2) return null;

  return (
    <div
      data-component="first-entity-tip"
      // Sits ABOVE the bottom-center Controls bar (zoom +/-/fit), not on top
      // of it. `bottom-24` clears the ~80 px Controls stack with room for a
      // shadow.
      className="pointer-events-none absolute bottom-24 left-1/2 z-10 -translate-x-1/2"
    >
      <div className="pointer-events-auto flex items-start gap-3 rounded-xl border border-neutral-200 bg-white/95 px-4 py-3 text-xs shadow-md backdrop-blur dark:border-neutral-800 dark:bg-neutral-900/95">
        <div className="flex flex-col gap-1 text-neutral-700 dark:text-neutral-200">
          <p className="font-medium">Next steps</p>
          <p className="text-neutral-500 dark:text-neutral-400">
            <kbd className="rounded border border-neutral-200 bg-neutral-50 px-1 py-px font-mono text-[10px] dark:border-neutral-700 dark:bg-neutral-800">
              Tab
            </kbd>{' '}
            adds a child · drag from the bottom handle to connect ·{' '}
            <kbd className="rounded border border-neutral-200 bg-neutral-50 px-1 py-px font-mono text-[10px] dark:border-neutral-700 dark:bg-neutral-800">
              Ctrl
            </kbd>
            +
            <kbd className="rounded border border-neutral-200 bg-neutral-50 px-1 py-px font-mono text-[10px] dark:border-neutral-700 dark:bg-neutral-800">
              K
            </kbd>{' '}
            opens commands.
          </p>
        </div>
        <button
          type="button"
          onClick={dismiss}
          className="-mr-1 rounded p-1 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700 dark:hover:bg-neutral-800 dark:hover:text-neutral-200"
          aria-label="Dismiss tip"
        >
          <X className="h-3 w-3" />
        </button>
      </div>
    </div>
  );
}
