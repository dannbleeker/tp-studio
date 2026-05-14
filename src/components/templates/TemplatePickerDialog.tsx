import { DIAGRAM_TYPE_LABEL } from '@/domain/entityTypeMeta';
import { useEscapeKey } from '@/hooks/useEscapeKey';
import { useFocusTrap } from '@/hooks/useFocusTrap';
import { useDocumentStore } from '@/store';
import { TEMPLATE_SPECS, buildTemplate } from '@/templates';
import { templateThumbnailSvg } from '@/templates/thumbnail';
import clsx from 'clsx';
import { X } from 'lucide-react';
import { useRef } from 'react';
import { Button } from '../ui/Button';

/**
 * Session 79 / brief §12 — Templates picker dialog.
 *
 * Renders the curated template library as a grid of cards. Each card
 * shows:
 *   - A small SVG thumbnail of the diagram's structure (computed by
 *     `templateThumbnailSvg` — no React Flow, no dagre, no DOM
 *     measurement).
 *   - The diagram-type badge (Goal Tree / Evaporating Cloud / CRT).
 *   - The template title + description.
 *   - Entity + edge counts.
 *
 * Clicking a card inflates the spec with `buildTemplate(spec)`,
 * dispatches `setDocument`, and closes the dialog. A toast confirms
 * which template loaded.
 *
 * Accessibility:
 *   - Semantic `<dialog open>` with `aria-modal` + descriptive
 *     `aria-labelledby`.
 *   - `useFocusTrap` keeps Tab cycling inside the dialog.
 *   - Escape closes (handled inline below).
 *   - Each card is a real `<button>` so screen-readers + keyboard
 *     users can navigate them with Tab + Enter.
 */
export function TemplatePickerDialog() {
  const open = useDocumentStore((s) => s.templatePickerOpen);
  const close = useDocumentStore((s) => s.closeTemplatePicker);
  const setDocument = useDocumentStore((s) => s.setDocument);
  const showToast = useDocumentStore((s) => s.showToast);
  const dialogRef = useRef<HTMLDivElement | null>(null);

  useFocusTrap(dialogRef, open);

  // Esc closes. Session 87 (S23) — migrated to the shared
  // `useEscapeKey` hook for consistent Esc handling across dialogs.
  useEscapeKey(open, close);

  if (!open) return null;

  const handlePick = (id: string): void => {
    const spec = TEMPLATE_SPECS.find((t) => t.id === id);
    if (!spec) return;
    const doc = buildTemplate(spec);
    setDocument(doc);
    showToast('success', `Loaded template: ${spec.title}`);
    close();
  };

  return (
    <dialog
      open
      className="fixed inset-0 z-50 m-0 flex h-screen max-h-screen w-screen max-w-none items-center justify-center bg-black/40 p-0"
      aria-modal="true"
      aria-labelledby="template-picker-title"
    >
      <div
        ref={dialogRef}
        tabIndex={-1}
        className="flex max-h-[88vh] w-[min(960px,94vw)] flex-col gap-4 rounded-lg border border-neutral-200 bg-white p-5 shadow-xl outline-none dark:border-neutral-800 dark:bg-neutral-950"
      >
        <header className="flex items-center justify-between">
          <div>
            <h2 id="template-picker-title" className="font-semibold text-base">
              New document from template
            </h2>
            <p className="text-neutral-500 text-xs dark:text-neutral-400">
              Click a card to start a fresh document pre-populated with the template's entities.
            </p>
          </div>
          <Button variant="ghost" size="icon" onClick={close} aria-label="Close template picker">
            <X className="h-4 w-4" />
          </Button>
        </header>

        <ul
          className="grid grid-cols-1 gap-3 overflow-y-auto pr-1 sm:grid-cols-2 lg:grid-cols-3"
          aria-label="Curated templates"
        >
          {TEMPLATE_SPECS.map((spec) => {
            const entityCount = spec.entities.length;
            const edgeCount = spec.edges.length;
            const typeLabel = DIAGRAM_TYPE_LABEL[spec.diagramType];
            return (
              <li key={spec.id}>
                <button
                  type="button"
                  onClick={() => handlePick(spec.id)}
                  aria-label={`Load ${spec.title}: ${typeLabel} with ${entityCount} entities and ${edgeCount} edges`}
                  className={clsx(
                    'group flex w-full flex-col gap-2 rounded-md border border-neutral-200 bg-white p-3 text-left transition',
                    'hover:border-indigo-400 hover:bg-indigo-50/40 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-300',
                    'dark:border-neutral-800 dark:bg-neutral-900 dark:focus:ring-indigo-600 dark:hover:border-indigo-500 dark:hover:bg-indigo-950/40'
                  )}
                >
                  <div
                    className="overflow-hidden rounded border border-neutral-100 bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-950"
                    // The thumbnail SVG is built from a typed spec we
                    // author ourselves — no user input flows into the
                    // rendered SVG, so `dangerouslySetInnerHTML` is
                    // safe here. The thumbnail builder HTML-escapes
                    // the title before embedding it as an attribute.
                    // biome-ignore lint/security/noDangerouslySetInnerHtml: trusted SVG payload generated from curated TemplateSpec literals
                    dangerouslySetInnerHTML={{ __html: templateThumbnailSvg(spec) }}
                  />
                  <div className="flex items-center gap-1.5">
                    <span className="rounded bg-indigo-100 px-1.5 py-0 font-semibold text-[9px] text-indigo-700 uppercase tracking-wide dark:bg-indigo-950 dark:text-indigo-200">
                      {typeLabel}
                    </span>
                    <span className="text-[10px] text-neutral-500 dark:text-neutral-400">
                      {entityCount} entit{entityCount === 1 ? 'y' : 'ies'} · {edgeCount} edge
                      {edgeCount === 1 ? '' : 's'}
                    </span>
                  </div>
                  <h3 className="font-medium text-neutral-900 text-sm leading-tight dark:text-neutral-100">
                    {spec.title}
                  </h3>
                  <p className="line-clamp-3 text-neutral-600 text-xs dark:text-neutral-400">
                    {spec.description}
                  </p>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </dialog>
  );
}
