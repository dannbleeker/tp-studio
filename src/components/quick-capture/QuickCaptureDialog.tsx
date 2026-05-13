import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { type CaptureNode, parseQuickCapture } from '@/domain/quickCapture';
import { guardWriteOrToast } from '@/services/browseLock';
import { applyQuickCapture } from '@/services/quickCapture';
import { useDocumentStore } from '@/store';
import { ChevronRight, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';

/**
 * Modal triggered by `E` (when not in a text field). Users paste or type a
 * bulleted, indented list; each non-empty line becomes an entity, indents
 * become parent → child edges, and the root entities attach as children of
 * the currently-selected entity if there is one. Otherwise they float.
 *
 * The live preview to the right of the textarea reflects exactly what will
 * be created on submit. Submit via `Cmd/Ctrl+Enter` or the button.
 */
export function QuickCaptureDialog() {
  const open = useDocumentStore((s) => s.quickCaptureOpen);
  const close = useDocumentStore((s) => s.closeQuickCapture);
  const selection = useDocumentStore((s) => s.selection);
  const entities = useDocumentStore((s) => s.doc.entities);
  const showToast = useDocumentStore((s) => s.showToast);
  const [text, setText] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  // Compute attachment context from the current selection. A single entity
  // selection (not a group) becomes the parent of all root captures.
  const attachToId = useMemo(() => {
    if (selection.kind !== 'entities' || selection.ids.length !== 1) return null;
    const id = selection.ids[0];
    if (!id) return null;
    return entities[id] ? id : null;
  }, [selection, entities]);

  const parsed = useMemo(() => parseQuickCapture(text), [text]);

  useEffect(() => {
    if (!open) return;
    setText('');
    const id = window.setTimeout(() => textareaRef.current?.focus(), 50);
    return () => window.clearTimeout(id);
  }, [open]);

  const submit = (): void => {
    if (!guardWriteOrToast()) return;
    if (parsed.total === 0) {
      showToast('info', 'Nothing to capture — paste an indented list and try again.');
      return;
    }
    const result = applyQuickCapture(parsed, attachToId);
    close();
    showToast(
      'success',
      `Created ${result.entities} entit${result.entities === 1 ? 'y' : 'ies'}, ${result.edges} edge${result.edges === 1 ? '' : 's'}.`
    );
  };

  return (
    <Modal open={open} onDismiss={close} widthClass="max-w-3xl" labelledBy="qc-title">
      <header className="flex items-center justify-between border-b border-neutral-200 px-4 py-3 dark:border-neutral-800">
        <h2 id="qc-title" className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
          Quick Capture
        </h2>
        <Button variant="ghost" size="icon" onClick={close} aria-label="Close quick capture">
          <X className="h-4 w-4" />
        </Button>
      </header>

      <div className="grid grid-cols-1 gap-4 px-4 py-4 md:grid-cols-2">
        <div className="flex flex-col gap-2">
          <label
            className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400"
            htmlFor="qc-textarea"
          >
            Paste a bulleted, indented list
          </label>
          <textarea
            id="qc-textarea"
            ref={textareaRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
                e.preventDefault();
                submit();
              }
            }}
            rows={12}
            placeholder={
              'Customer satisfaction is declining\n  Order entry is manual\n  Warehouse is understaffed\n    Hard to find qualified pickers'
            }
            className="w-full resize-y rounded-md border border-neutral-200 bg-white px-2 py-1.5 font-mono text-xs leading-relaxed text-neutral-900 outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-100"
          />
          <p className="text-[11px] text-neutral-500 dark:text-neutral-400">
            Indent with 2 spaces or a tab. Bullets (<code>-</code>, <code>*</code>, <code>•</code>,{' '}
            <code>1.</code>) and leading emoji are stripped automatically.
            {attachToId ? (
              <>
                {' '}
                Roots will attach to{' '}
                <strong>{entities[attachToId]?.title || 'the selected entity'}</strong>.
              </>
            ) : (
              ' Roots will float (no entity is currently selected).'
            )}
          </p>
        </div>

        <div className="flex flex-col gap-2">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
            Preview ({parsed.total} {parsed.total === 1 ? 'entity' : 'entities'})
          </span>
          <div className="min-h-[14rem] flex-1 overflow-auto rounded-md border border-neutral-200 bg-neutral-50 p-2 text-xs dark:border-neutral-800 dark:bg-neutral-900">
            {parsed.total === 0 ? (
              <p className="italic text-neutral-400">Nothing to preview yet.</p>
            ) : (
              <ul className="flex flex-col gap-0.5">
                {parsed.roots.map((node, i) => (
                  <PreviewNode key={`${i}-${node.title}`} node={node} depth={0} />
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>

      <footer className="flex items-center justify-end gap-2 border-t border-neutral-200 px-4 py-3 dark:border-neutral-800">
        <span className="mr-auto text-[11px] text-neutral-500 dark:text-neutral-400">
          <kbd className="rounded border border-neutral-200 bg-neutral-50 px-1 py-px font-mono text-[10px] dark:border-neutral-700 dark:bg-neutral-800">
            {typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform)
              ? '⌘'
              : 'Ctrl'}
          </kbd>
          +
          <kbd className="rounded border border-neutral-200 bg-neutral-50 px-1 py-px font-mono text-[10px] dark:border-neutral-700 dark:bg-neutral-800">
            Enter
          </kbd>{' '}
          to create
        </span>
        <Button variant="softNeutral" onClick={close}>
          Cancel
        </Button>
        <Button variant="primary" onClick={submit} disabled={parsed.total === 0}>
          Create {parsed.total} {parsed.total === 1 ? 'entity' : 'entities'}
        </Button>
      </footer>
    </Modal>
  );
}

function PreviewNode({ node, depth }: { node: CaptureNode; depth: number }) {
  return (
    <li>
      <div
        className="flex items-center gap-1 text-neutral-700 dark:text-neutral-200"
        style={{ paddingLeft: depth * 12 }}
      >
        {depth > 0 && <ChevronRight className="h-3 w-3 text-neutral-400" />}
        <span className="truncate">{node.title}</span>
      </div>
      {node.children.length > 0 && (
        <ul className="flex flex-col gap-0.5">
          {node.children.map((c, i) => (
            <PreviewNode key={`${i}-${c.title}`} node={c} depth={depth + 1} />
          ))}
        </ul>
      )}
    </li>
  );
}
