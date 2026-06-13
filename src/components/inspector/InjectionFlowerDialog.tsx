import clsx from 'clsx';
import type { LucideIcon } from 'lucide-react';
import { Link2, RotateCcw, Sparkles, Syringe, TriangleAlert, Workflow } from 'lucide-react';
import {
  buildInjectionFlower,
  CANONICAL_FLOWER_PETALS,
  type FlowerLink,
  type FlowerPetalRole,
} from '@/domain/injectionFlower';
import type { Entity } from '@/domain/types';
import { useDocumentStore } from '@/store';
import { currentDoc } from '@/store/selectors';
import { LargeDialog } from '../ui/LargeDialog';

/**
 * Phase 3 #3 — the "Injection Flower" dialog. Opened by the "View the injection
 * flower…" palette command (or the inspector button) on a single injection
 * entity. Groups that injection's Phase-2a cross-doc links into Cohen's petals —
 * Desired Effects (FRT), Negative Branch (NBR), Plan (PRT), plus an "Other"
 * catch-all — so the user can see, at a glance, whether the injection is fully
 * developed or still missing a side. Empty canonical petals show a prompt.
 *
 * Read-only lens over `Entity.links`: each row navigates (openSavedDoc +
 * selectEntity, closing the dialog) — reopening the linked tree first if its tab
 * was closed (Session 184); nothing is mutated and no schema changes.
 */
export function InjectionFlowerDialog() {
  const entityId = useDocumentStore((s) => s.injectionFlowerEntityId);
  const close = useDocumentStore((s) => s.closeInjectionFlower);
  const doc = useDocumentStore((s) => currentDoc(s));

  if (entityId === null) return null;
  const injection = doc.entities[entityId];

  if (!injection) {
    return (
      <LargeDialog
        open
        onClose={close}
        title="Injection flower"
        subtitle="This entity no longer exists."
        closeAriaLabel="Close injection flower"
        widthClass="w-[min(560px,94vw)]"
      >
        <p className="px-1 py-6 text-center text-neutral-500 text-sm dark:text-neutral-400">
          The injection you were viewing has been removed. Close this and pick another.
        </p>
      </LargeDialog>
    );
  }

  return <InjectionFlowerBody injection={injection} onClose={close} />;
}

const PETAL_META: Record<
  FlowerPetalRole,
  { label: string; blurb: string; emptyHint: string; icon: LucideIcon; accent: string }
> = {
  desiredEffect: {
    label: 'Desired effects',
    blurb: 'What this injection should produce (a Future Reality Tree).',
    emptyHint:
      'No desired effects linked yet — build an FRT from this injection and link its positive outcomes.',
    icon: Sparkles,
    accent: 'text-emerald-600 dark:text-emerald-400',
  },
  negativeBranch: {
    label: 'Negative branch',
    blurb: 'What could go wrong (a Negative Branch Reservation).',
    emptyHint:
      'No negative branch linked yet — ask “what could go wrong?” and trim it before you commit.',
    icon: TriangleAlert,
    accent: 'text-rose-600 dark:text-rose-400',
  },
  plan: {
    label: 'Plan',
    blurb: 'How it gets implemented (a Prerequisite Tree).',
    emptyHint: 'No plan linked yet — a PRT turns this injection into sequenced prerequisites.',
    icon: Workflow,
    accent: 'text-sky-600 dark:text-sky-400',
  },
  related: {
    label: 'Other links',
    blurb: 'Other entities linked to this injection.',
    emptyHint: '',
    icon: Link2,
    accent: 'text-neutral-500 dark:text-neutral-400',
  },
};

function InjectionFlowerBody({ injection, onClose }: { injection: Entity; onClose: () => void }) {
  // The multi-doc map resolves each link's target (title / doc / diagram type).
  const allDocs = useDocumentStore((s) => s.docs);
  const openSavedDoc = useDocumentStore((s) => s.openSavedDoc);
  const selectEntity = useDocumentStore((s) => s.selectEntity);

  const flower = buildInjectionFlower(injection, allDocs);
  const presentCanonical = CANONICAL_FLOWER_PETALS.filter((role) =>
    flower.petals.some((p) => p.role === role && p.links.length > 0)
  ).length;

  const go = (link: FlowerLink): void => {
    // Switch to the tab if open, else reopen the saved tree (Session 184); only
    // navigate + close once we know it's there (a deleted tree toasts and stays).
    if (!openSavedDoc(link.docId)) return;
    selectEntity(link.entityId);
    onClose();
  };

  const injectionTitle = injection.title.trim() || 'Untitled injection';

  return (
    <LargeDialog
      open
      onClose={onClose}
      title="Injection flower"
      subtitle={`“${injectionTitle}” — ${presentCanonical} of ${CANONICAL_FLOWER_PETALS.length} sides developed`}
      closeAriaLabel="Close injection flower"
      widthClass="w-[min(640px,94vw)]"
    >
      <div className="flex flex-col gap-4">
        <p className="flex items-start gap-2 text-neutral-500 text-xs dark:text-neutral-400">
          <Syringe aria-hidden className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>
            An injection is fully vetted when you can see its desired effects, its negative branch,
            and its plan. Link this injection to entities in other tabs (“Link to entity in another
            tab…”) and they gather here.
          </span>
        </p>

        {flower.petals.map((petal) => {
          const meta = PETAL_META[petal.role];
          // The "Other" petal only shows when it actually has links — empty is
          // not a gap there. Canonical petals always show (empty → a prompt).
          if (petal.role === 'related' && petal.links.length === 0) return null;
          const Icon = meta.icon;
          return (
            <section key={petal.role} className="flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <Icon aria-hidden className={clsx('h-4 w-4 shrink-0', meta.accent)} />
                <h3 className="font-semibold text-neutral-800 text-sm dark:text-neutral-100">
                  {meta.label}
                </h3>
                <span className="text-neutral-400 text-xs dark:text-neutral-500">
                  {petal.links.length}
                </span>
              </div>
              <p className="text-neutral-500 text-xs dark:text-neutral-400">{meta.blurb}</p>

              {petal.links.length === 0 ? (
                <p className="rounded-md border border-neutral-200 border-dashed bg-neutral-50/60 px-2.5 py-2 text-neutral-400 text-xs italic dark:border-neutral-800 dark:bg-neutral-900/40 dark:text-neutral-500">
                  {meta.emptyHint}
                </p>
              ) : (
                <div className="flex flex-col gap-1.5">
                  {petal.links.map((link) => (
                    <button
                      key={`${link.docId}:${link.entityId}`}
                      type="button"
                      onClick={() => go(link)}
                      title={
                        link.reachable
                          ? `Go to "${link.entityTitle || 'entity'}" in ${link.docTitle}`
                          : 'Reopen its tab and follow this link.'
                      }
                      className={clsx(
                        'flex min-w-0 items-center gap-1.5 rounded-md border px-2 py-1 text-left text-xs transition',
                        link.reachable
                          ? 'border-indigo-200 bg-indigo-50/60 text-indigo-800 hover:bg-indigo-100 dark:border-indigo-900 dark:bg-indigo-950/40 dark:text-indigo-200 dark:hover:bg-indigo-900/50'
                          : 'border-neutral-200 text-neutral-500 hover:border-neutral-300 hover:bg-neutral-50 hover:text-neutral-700 dark:border-neutral-800 dark:text-neutral-400 dark:hover:bg-neutral-900 dark:hover:text-neutral-200'
                      )}
                    >
                      {link.reachable ? (
                        <Link2 aria-hidden className="h-3 w-3 shrink-0" />
                      ) : (
                        <RotateCcw aria-hidden className="h-3 w-3 shrink-0" />
                      )}
                      <span className="truncate">
                        {link.reachable ? (
                          <>
                            {link.entityTitle || '(untitled)'}
                            <span className="ml-1 text-indigo-500/70 dark:text-indigo-300/60">
                              · {link.docTitle}
                            </span>
                          </>
                        ) : (
                          <span className="italic">Reopen linked tab</span>
                        )}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </section>
          );
        })}
      </div>
    </LargeDialog>
  );
}
