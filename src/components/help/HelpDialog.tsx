import { X } from 'lucide-react';
import { useEffect } from 'react';
import { useDocumentStore } from '../../store';

type Row = { keys: string; label: string };

const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);
const M = isMac ? '⌘' : 'Ctrl';

const SECTIONS: { title: string; rows: Row[] }[] = [
  {
    title: 'Global',
    rows: [
      { keys: `${M}+K`, label: 'Command palette' },
      { keys: `${M}+Z`, label: 'Undo' },
      { keys: `${M}+Shift+Z`, label: 'Redo' },
      { keys: `${M}+S`, label: 'Save' },
      { keys: 'Esc', label: 'Close palette / deselect' },
    ],
  },
  {
    title: 'On a selected entity',
    rows: [
      { keys: 'Enter', label: 'Rename' },
      { keys: 'Tab', label: 'Add child entity' },
      { keys: 'Shift+Tab', label: 'Add parent entity' },
      { keys: '↑', label: 'Move selection to effect' },
      { keys: '↓', label: 'Move selection to cause' },
      { keys: '← / →', label: 'Move selection to sibling at same rank' },
      { keys: 'Del / Backspace', label: 'Delete entity' },
    ],
  },
  {
    title: 'Canvas',
    rows: [
      { keys: 'Double-click', label: 'New entity at cursor' },
      { keys: 'Right-click', label: 'Context menu' },
      { keys: 'Shift+click', label: 'Multi-select edges (for AND grouping)' },
      { keys: 'Drag handle', label: 'Connect entities' },
    ],
  },
];

export function HelpDialog() {
  const open = useDocumentStore((s) => s.helpOpen);
  const close = useDocumentStore((s) => s.closeHelp);

  useEffect(() => {
    if (!open) return undefined;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        close();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, close]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-900/30 px-4 backdrop-blur-sm"
      onClick={close}
      onKeyDown={(e) => {
        if (e.key === 'Escape') close();
      }}
      role="presentation"
    >
      <dialog
        open
        className="w-full max-w-md overflow-hidden rounded-xl border border-neutral-200 bg-white p-0 shadow-2xl dark:border-neutral-800 dark:bg-neutral-950"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
        aria-modal="true"
        aria-labelledby="help-title"
      >
        <header className="flex items-center justify-between border-b border-neutral-200 px-4 py-3 dark:border-neutral-800">
          <h2
            id="help-title"
            className="text-sm font-semibold text-neutral-900 dark:text-neutral-100"
          >
            Keyboard shortcuts
          </h2>
          <button
            type="button"
            onClick={close}
            className="rounded p-1 text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800"
            aria-label="Close help"
          >
            <X className="h-4 w-4" />
          </button>
        </header>
        <div className="max-h-[70vh] space-y-4 overflow-y-auto px-4 py-3">
          {SECTIONS.map((section) => (
            <section key={section.title}>
              <h3 className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
                {section.title}
              </h3>
              <dl className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-1.5 text-sm">
                {section.rows.map((r) => (
                  <div key={`${section.title}-${r.keys}`} className="contents">
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
          ))}
        </div>
      </dialog>
    </div>
  );
}
