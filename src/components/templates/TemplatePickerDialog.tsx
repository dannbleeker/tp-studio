import { DIAGRAM_TYPE_LABEL } from '@/domain/entityTypeMeta';
import { useDocumentStore } from '@/store';
import { TEMPLATE_SPECS, buildTemplate } from '@/templates';
import { TemplateThumbnail } from '@/templates/thumbnail';
import clsx from 'clsx';
import { LargeDialog } from '../ui/LargeDialog';
import { CARD_FOCUS } from '../ui/focusClasses';

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
 * Session 94 — migrated to the shared `LargeDialog` shell; focus-trap,
 * Esc handling, backdrop, and header chrome live there now.
 */
export function TemplatePickerDialog() {
  const open = useDocumentStore((s) => s.templatePickerOpen);
  const close = useDocumentStore((s) => s.closeTemplatePicker);
  const setDocument = useDocumentStore((s) => s.setDocument);
  const showToast = useDocumentStore((s) => s.showToast);

  // Session 88 (S14) — capture the prior doc before swapping so the
  // "Undo" affordance on the success toast can restore it. Cheap: the
  // doc is a plain object and `setDocument` is the same path Ctrl+Z
  // uses, so the restore is fully consistent with the history stack.
  const handlePick = (id: string): void => {
    const spec = TEMPLATE_SPECS.find((t) => t.id === id);
    if (!spec) return;
    const previousDoc = useDocumentStore.getState().doc;
    const doc = buildTemplate(spec);
    setDocument(doc);
    showToast('success', `Loaded template: ${spec.title}`, {
      action: {
        label: 'Undo',
        run: () => setDocument(previousDoc),
      },
    });
    close();
  };

  return (
    <LargeDialog
      open={open}
      onClose={close}
      title="New document from template"
      subtitle="Click a card to start a fresh document pre-populated with the template's entities."
      closeAriaLabel="Close template picker"
    >
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
                // Session 101 — selector hook for the e2e visual
                // regression spec (`visual-dialogs.spec.ts`). The
                // attribute is also stable enough for future test
                // targeting if more dialog interactions get added.
                data-component="template-card"
                onClick={() => handlePick(spec.id)}
                aria-label={`Load ${spec.title}: ${typeLabel} with ${entityCount} entities and ${edgeCount} edges`}
                className={clsx(
                  'group flex w-full flex-col gap-2 rounded-md border border-neutral-200 bg-white p-3 text-left transition',
                  'hover:border-indigo-400 hover:bg-indigo-50/40',
                  CARD_FOCUS,
                  'dark:border-neutral-800 dark:bg-neutral-900 dark:hover:border-indigo-500 dark:hover:bg-indigo-950/40'
                )}
              >
                <div className="overflow-hidden rounded border border-neutral-100 bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-950">
                  {/* Session 88 (S22) — JSX thumbnail. Replaces
                      the prior `dangerouslySetInnerHTML` SVG-string
                      injection so the security ignore can go away
                      while staying visually identical. */}
                  <TemplateThumbnail spec={spec} />
                </div>
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
    </LargeDialog>
  );
}
