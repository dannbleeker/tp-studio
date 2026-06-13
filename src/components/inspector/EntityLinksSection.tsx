import clsx from 'clsx';
import { Link2, RotateCcw, X } from 'lucide-react';
import type { DocumentId, Entity, EntityId, TPDocument } from '@/domain/types';
import { Field } from './Field';

/**
 * Phase 2a (TP completeness #2) — navigable cross-document links. Each chip jumps
 * to the linked entity in its tab; a target whose tab is closed renders muted and
 * REOPENS the saved tree on click (Session 184), then revives as a live link. The
 * × removes the link (and its reciprocal mirror when that tab is open). The parent
 * wraps the store calls — `onNavigate` routes through `openSavedDoc` (switch if
 * open, else reopen) — so this section takes plain `onNavigate` / `onUnlink`
 * callbacks. Extracted verbatim from `EntityInspector` (Session 169 structural tier).
 */
export function EntityLinksSection({
  entity,
  docs,
  locked,
  onNavigate,
  onUnlink,
}: {
  entity: Entity;
  docs: Record<DocumentId, TPDocument>;
  locked: boolean;
  onNavigate: (docId: DocumentId, entityId: EntityId) => void;
  onUnlink: (link: NonNullable<Entity['links']>[number]) => void;
}) {
  if (!entity.links || entity.links.length === 0) return null;
  // A link whose target doc is OPEN but whose entity is gone was DELETED — drop
  // it (rendering it as "tab closed" would mislead). A link whose target doc is
  // merely CLOSED stays as a muted chip that reopens the tree on click (which
  // revives it as a live link). The store prunes most of these eagerly on delete;
  // this also covers the case where the source doc's tab was closed when the
  // target was removed.
  const visibleLinks = entity.links.filter((link) => {
    const targetDoc = docs[link.docId];
    return !targetDoc || Boolean(targetDoc.entities[link.entityId]);
  });
  if (visibleLinks.length === 0) return null;
  return (
    <Field label="Linked to" as="group">
      <div className="flex flex-col gap-1.5">
        {visibleLinks.map((link) => {
          const targetDoc = docs[link.docId];
          const targetEntity = targetDoc?.entities[link.entityId];
          const reachable = Boolean(targetDoc && targetEntity);
          return (
            <div key={`${link.docId}:${link.entityId}`} className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => onNavigate(link.docId, link.entityId)}
                title={
                  reachable
                    ? `Go to "${targetEntity?.title || 'entity'}" in ${targetDoc?.title}`
                    : 'Reopen its tab and follow this link.'
                }
                className={clsx(
                  'flex min-w-0 flex-1 items-center gap-1.5 rounded-md border px-2 py-1 text-left text-xs transition',
                  reachable
                    ? 'border-indigo-200 bg-indigo-50/60 text-indigo-800 hover:bg-indigo-100 dark:border-indigo-900 dark:bg-indigo-950/40 dark:text-indigo-200 dark:hover:bg-indigo-900/50'
                    : 'border-neutral-200 text-neutral-500 hover:border-neutral-300 hover:bg-neutral-50 hover:text-neutral-700 dark:border-neutral-800 dark:text-neutral-400 dark:hover:bg-neutral-900 dark:hover:text-neutral-200'
                )}
              >
                {reachable ? (
                  <Link2 aria-hidden className="h-3 w-3 shrink-0" />
                ) : (
                  <RotateCcw aria-hidden className="h-3 w-3 shrink-0" />
                )}
                <span className="truncate">
                  {reachable ? (
                    <>
                      {targetEntity?.title || '(untitled)'}
                      <span className="ml-1 text-indigo-500/70 dark:text-indigo-300/60">
                        · {targetDoc?.title}
                      </span>
                    </>
                  ) : (
                    <span className="italic">Reopen linked tab</span>
                  )}
                </span>
              </button>
              {!locked && (
                <button
                  type="button"
                  onClick={() => onUnlink(link)}
                  aria-label="Remove link"
                  className="shrink-0 rounded-sm p-1 text-neutral-400 transition hover:bg-neutral-100 hover:text-rose-600 dark:hover:bg-neutral-800"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>
          );
        })}
      </div>
    </Field>
  );
}
