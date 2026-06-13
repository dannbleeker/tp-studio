import clsx from 'clsx';
import { useShallow } from 'zustand/react/shallow';
import { useDocumentStore } from '@/store';
import { buildTemplate, TEMPLATE_SPECS, type TemplateSpec } from '@/templates';
import { diagramMetaFor, groupTemplatesByType } from './diagramMeta';

/**
 * Session 183 — the registry-driven template picker. Maps over the live
 * `TEMPLATE_SPECS` (never a hand-maintained list), groups by diagram type via
 * {@link groupTemplatesByType}, and renders each group in canonical method
 * order. Adding a TemplateSpec module to the registry makes its card appear
 * here — and in the Start strip — with zero edits to this component. The same
 * component serves the full Templates page and the Start view's strip
 * (`limitPerGroup`).
 */
export function TemplateGallery({ limitPerGroup }: { limitPerGroup?: number }) {
  const { openDocInTab, showToast } = useDocumentStore(
    useShallow((s) => ({ openDocInTab: s.openDocInTab, showToast: s.showToast }))
  );

  // Inflate + open the chosen template. `openDocInTab` clears `startSection`
  // via the shared `activeDocEphemeralReset`, so loading a template drops the
  // user straight into the editor on the new document.
  const pick = (spec: TemplateSpec): void => {
    openDocInTab(buildTemplate(spec));
    showToast('success', `Loaded "${spec.title}".`);
  };

  const groups = groupTemplatesByType(TEMPLATE_SPECS);

  return (
    <div className="flex flex-col gap-7">
      {groups.map(({ type, specs }) => {
        const meta = diagramMetaFor(type);
        const Icon = meta.icon;
        const shown = typeof limitPerGroup === 'number' ? specs.slice(0, limitPerGroup) : specs;
        const overflow = specs.length - shown.length;
        return (
          <section key={type} aria-label={meta.label}>
            <div className="mb-2.5 flex items-center gap-2">
              <Icon className="h-4 w-4 shrink-0" style={{ color: meta.color }} aria-hidden />
              <h3 className="font-semibold text-neutral-900 text-sm dark:text-neutral-100">
                {meta.label}s
              </h3>
              <span className="text-neutral-400 text-xs tabular-nums dark:text-neutral-500">
                {specs.length}
              </span>
            </div>
            <ul
              className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3"
              aria-label={`${meta.label} templates`}
            >
              {shown.map((spec) => (
                <li key={spec.id}>
                  <button
                    type="button"
                    onClick={() => pick(spec)}
                    aria-label={`Open template: ${spec.title}`}
                    className="group flex h-full w-full overflow-hidden rounded-lg border border-neutral-200 bg-white text-left transition hover:border-indigo-400 hover:shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 dark:border-neutral-800 dark:bg-neutral-900 dark:hover:border-indigo-500"
                  >
                    <span
                      className="w-1 shrink-0"
                      style={{ backgroundColor: meta.color }}
                      aria-hidden
                    />
                    <span className="flex min-w-0 flex-1 flex-col gap-1 p-3">
                      <span className="flex items-start justify-between gap-2">
                        <span className="font-medium text-neutral-900 text-sm leading-tight dark:text-neutral-100">
                          {spec.title}
                        </span>
                        <span className="shrink-0 rounded-sm bg-neutral-100 px-1.5 py-0.5 font-semibold text-[9px] text-neutral-500 uppercase tracking-wide dark:bg-neutral-800 dark:text-neutral-400">
                          {meta.tag}
                        </span>
                      </span>
                      <span
                        className={clsx(
                          'text-neutral-600 text-xs leading-snug dark:text-neutral-400',
                          'line-clamp-3'
                        )}
                      >
                        {spec.description}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
              {overflow > 0 && (
                <li className="flex items-center justify-center rounded-lg border border-neutral-200 border-dashed text-neutral-400 text-xs dark:border-neutral-800 dark:text-neutral-500">
                  +{overflow} more
                </li>
              )}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
