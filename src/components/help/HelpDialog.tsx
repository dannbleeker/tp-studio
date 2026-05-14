import { SHORTCUTS_BY_GROUP, SHORTCUT_GROUP_TITLE, type ShortcutGroup } from '@/domain/shortcuts';
import { useDocumentStore } from '@/store';
import { X } from 'lucide-react';
import { Button } from '../ui/Button';
import { Modal } from '../ui/Modal';

/**
 * The four section headings, in the order the dialog renders them. Stored
 * as a const tuple so renaming or reordering is a single edit. The
 * underlying rows come from `SHORTCUTS_BY_GROUP` so this file no longer
 * carries its own per-row list — registry drift is impossible.
 */
const GROUP_ORDER: ShortcutGroup[] = ['global', 'entity', 'group', 'canvas'];

export function HelpDialog() {
  const open = useDocumentStore((s) => s.helpOpen);
  const close = useDocumentStore((s) => s.closeHelp);

  return (
    <Modal open={open} onDismiss={close} widthClass="max-w-md" labelledBy="help-title">
      <header className="flex items-center justify-between border-neutral-200 border-b px-4 py-3 dark:border-neutral-800">
        <h2
          id="help-title"
          className="font-semibold text-neutral-900 text-sm dark:text-neutral-100"
        >
          Keyboard shortcuts
        </h2>
        <Button variant="ghost" size="icon" onClick={close} aria-label="Close help">
          <X className="h-4 w-4" />
        </Button>
      </header>
      <div className="max-h-[70vh] space-y-4 overflow-y-auto px-4 py-3">
        {GROUP_ORDER.map((group) => {
          const rows = SHORTCUTS_BY_GROUP[group];
          if (rows.length === 0) return null;
          return (
            <section key={group}>
              <h3 className="mb-1.5 font-semibold text-[10px] text-neutral-500 uppercase tracking-wider dark:text-neutral-400">
                {SHORTCUT_GROUP_TITLE[group]}
              </h3>
              <dl className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-1.5 text-sm">
                {rows.map((r) => (
                  <div key={r.id} className="contents">
                    <dt className="text-neutral-700 dark:text-neutral-200">{r.label}</dt>
                    <dd>
                      <kbd className="rounded border border-neutral-200 bg-neutral-50 px-1.5 py-0.5 font-mono text-[11px] text-neutral-600 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-300">
                        {r.keys}
                      </kbd>
                    </dd>
                  </div>
                ))}
              </dl>
            </section>
          );
        })}
      </div>
    </Modal>
  );
}
