import { ClipboardPaste, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useShallow } from 'zustand/shallow';
import { entityMeta, paletteForDoc } from '@/domain/entityTypeMeta';
import type { EntityType } from '@/domain/types';
import { applyWhiteboardPaste, parseWhiteboardPaste } from '@/services/exporters/whiteboardImport';
import { useDocumentStore } from '@/store';
import { currentDoc } from '@/store/selectors';
import { Button } from '../ui/Button';
import { Modal } from '../ui/Modal';

/**
 * Session 134 — "Paste from whiteboard (Miro / Mural)" import dialog.
 *
 * Closes the Miro / Mural import gap from the spec gap analysis. Neither
 * tool exposes connectors reliably in any client-accessible export
 * format, so the practical bridge is the universal one: select the
 * stickies on the source board, copy, paste here, one entity per line.
 * Also works for FigJam, Lucidspark, bulleted lists from Notion /
 * Word / Markdown, or a meeting-transcript dump.
 *
 * The parser is bullet-aware (strips `- `, `* `, `• `, `1.`, `1)` etc.)
 * and tab-aware (takes only the first column of a tab-separated paste,
 * which is what Miro / Mural CSV → spreadsheet → copy round-trips to).
 * Connectors are not inferred — the user wires causality after import.
 *
 * UX shape mirrors `ReadAllAtOnceDialog`:
 *   - header w/ title + dismiss
 *   - large textarea, live "N entities will be created" count
 *   - entity-type dropdown (defaults to the diagram's first palette
 *     entry — sensible because that's the most common type for the
 *     diagram)
 *   - Import / Cancel buttons
 */
export function WhiteboardPasteDialog() {
  const { open, doc, close, showToast } = useDocumentStore(
    useShallow((s) => ({
      open: s.whiteboardPasteOpen,
      doc: currentDoc(s),
      close: s.closeWhiteboardPaste,
      showToast: s.showToast,
    }))
  );

  const palette = useMemo(() => paletteForDoc(doc), [doc]);
  const defaultType = palette[0] ?? 'effect';

  const [pasted, setPasted] = useState('');
  const [type, setType] = useState<EntityType | string>(defaultType);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  // Reset state when the dialog opens — stale paste from a previous
  // session shouldn't surprise the user.
  useEffect(() => {
    if (open) {
      setPasted('');
      setType(defaultType);
      // Two RAFs let the modal mount + take focus first; the textarea
      // then claims focus so the user can paste immediately.
      requestAnimationFrame(() => requestAnimationFrame(() => textareaRef.current?.focus()));
    }
  }, [open, defaultType]);

  const statements = useMemo(() => parseWhiteboardPaste(pasted), [pasted]);

  if (!open) return null;

  const handleImport = () => {
    if (statements.length === 0) return;
    const count = applyWhiteboardPaste(statements, type as EntityType);
    close();
    showToast(
      'success',
      `Imported ${count} entit${count === 1 ? 'y' : 'ies'} as ${entityMeta(type, doc).label}.`
    );
  };

  return (
    <Modal open={open} onDismiss={close} widthClass="max-w-2xl" labelledBy="whiteboard-paste-title">
      <div className="flex max-h-[85vh] flex-col gap-4 rounded-lg border border-neutral-200 bg-white p-6 shadow-2xl dark:border-neutral-800 dark:bg-neutral-900">
        <header className="flex items-start justify-between gap-3">
          <div>
            <h2
              id="whiteboard-paste-title"
              className="font-semibold text-neutral-900 dark:text-neutral-100"
            >
              Paste from whiteboard
            </h2>
            <p className="mt-1 text-neutral-500 text-xs dark:text-neutral-400">
              Copy stickies from Miro, Mural, FigJam, or any text source. One entity per non-empty
              line. Bullet markers (<code>-</code>, <code>*</code>, <code>•</code>, <code>1.</code>)
              are stripped. Connectors aren&apos;t inferred — wire causality after import.
            </p>
          </div>
          <Button variant="ghost" size="icon" onClick={close} aria-label="Close">
            <X className="h-4 w-4" />
          </Button>
        </header>

        <div className="flex flex-col gap-2">
          <label
            htmlFor="whiteboard-paste-textarea"
            className="font-medium text-neutral-700 text-xs dark:text-neutral-300"
          >
            Pasted content
          </label>
          <textarea
            id="whiteboard-paste-textarea"
            ref={textareaRef}
            value={pasted}
            onChange={(e) => setPasted(e.target.value)}
            placeholder={
              '- Customers churn after first month\n- Onboarding email lands in spam\n- Activation rate below 30%'
            }
            rows={10}
            className="w-full resize-y rounded-md border border-neutral-300 bg-white p-3 font-mono text-neutral-900 text-sm shadow-inner focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-400 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100"
          />
        </div>

        <div className="flex items-center gap-3">
          <label
            htmlFor="whiteboard-paste-type"
            className="font-medium text-neutral-700 text-xs dark:text-neutral-300"
          >
            Import as
          </label>
          <select
            id="whiteboard-paste-type"
            value={type}
            onChange={(e) => setType(e.target.value)}
            className="rounded-md border border-neutral-300 bg-white px-2 py-1 text-neutral-900 text-sm focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-400 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100"
          >
            {palette.map((t) => (
              <option key={t} value={t}>
                {entityMeta(t, doc).label}
              </option>
            ))}
          </select>
          <span className="ml-auto text-neutral-500 text-xs dark:text-neutral-400">
            {statements.length === 0
              ? 'Paste content to see a count.'
              : `${statements.length} entit${statements.length === 1 ? 'y' : 'ies'} will be created.`}
          </span>
        </div>

        <footer className="flex items-center justify-end gap-2 border-neutral-200 border-t pt-4 dark:border-neutral-800">
          <Button variant="ghost" size="sm" onClick={close}>
            Cancel
          </Button>
          <Button
            variant="softViolet"
            size="sm"
            onClick={handleImport}
            disabled={statements.length === 0}
          >
            <ClipboardPaste className="h-3.5 w-3.5" />
            Import {statements.length > 0 ? `${statements.length} ` : ''}
            {statements.length === 1 ? 'entity' : 'entities'}
          </Button>
        </footer>
      </div>
    </Modal>
  );
}
