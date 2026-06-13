import { ArrowRight, BookOpenCheck, TriangleAlert } from 'lucide-react';
import { useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { createDocument, createEntity } from '@/domain/factory';
import type { TPDocument } from '@/domain/types';
import { useDocumentStore } from '@/store';
import { buildTemplate, TEMPLATE_SPECS } from '@/templates';
import { TemplateGallery } from './TemplateGallery';
import { TreeCard } from './TreeCard';
import type { OpenTree } from './useOpenTrees';

const EXAMPLE_PROBLEMS = [
  'Customer churn is rising',
  'Releases are always late',
  'Support tickets keep reopening',
];

/**
 * Session 183 — the Start view's hero. Name a problem (an Undesirable Effect)
 * and "Build a Current Reality Tree" mints a fresh CRT seeded with that UDE as
 * its first entity; example chips prefill + create the same way. A worked-
 * example callout opens a finished CRT, and the registry-driven template strip
 * sits beneath "…or start from a template".
 */
export function StartHome({ trees }: { trees: OpenTree[] }) {
  const { openDocInTab, showToast, setStartSection } = useDocumentStore(
    useShallow((s) => ({
      openDocInTab: s.openDocInTab,
      showToast: s.showToast,
      setStartSection: s.setStartSection,
    }))
  );
  const [problem, setProblem] = useState('');

  // "Pick up where you left off" shows only trees with real content (a fresh
  // blank doc shouldn't clutter the resume strip); most-recent first, capped.
  const recent = trees.filter((t) => Object.keys(t.doc.entities).length > 0).slice(0, 6);
  const reviewCount = trees.filter((t) => t.openWarnings > 0).length;

  // Build a CRT from a problem statement: the trimmed text becomes the tree's
  // first UDE (and the doc title). `openDocInTab` exits Start into the editor.
  const buildCRT = (text: string): void => {
    const ude = text.trim();
    const doc = createDocument('crt');
    let next: TPDocument = doc;
    if (ude) {
      const entity = createEntity({ type: 'ude', title: ude, annotationNumber: 1 });
      next = {
        ...doc,
        title: ude.slice(0, 80),
        entities: { [entity.id]: entity },
        nextAnnotationNumber: 2,
      };
    }
    openDocInTab(next);
    showToast('success', ude ? `Started a CRT from "${ude}".` : 'Started a blank CRT.');
  };

  // The worked example is the first CRT template in the registry — registry-
  // driven, so it never names a specific module.
  const workedExample = TEMPLATE_SPECS.find((s) => s.diagramType === 'crt');
  const openWorkedExample = (): void => {
    if (!workedExample) return;
    openDocInTab(buildTemplate(workedExample));
    showToast('success', `Opened the worked example "${workedExample.title}".`);
  };

  return (
    <div className="flex flex-col gap-10">
      <section>
        <p className="font-semibold text-[11px] text-indigo-600 uppercase tracking-wider dark:text-indigo-400">
          Theory of Constraints · Thinking Processes
        </p>
        <h1 className="mt-2 font-bold text-2xl text-neutral-900 tracking-tight dark:text-neutral-100">
          What problem are you working on?
        </h1>
        <p className="mt-2 max-w-2xl text-neutral-600 text-sm leading-relaxed dark:text-neutral-400">
          Name what&apos;s going wrong — TP Studio scaffolds a Current Reality Tree around it and
          checks your cause-and-effect against the Categories of Legitimate Reservation as you go.
        </p>

        <form
          className="mt-5 flex flex-col gap-2.5 sm:flex-row"
          onSubmit={(e) => {
            e.preventDefault();
            buildCRT(problem);
          }}
        >
          <div className="flex min-w-0 flex-1 items-center gap-2 rounded-md border border-neutral-300 bg-white px-3 py-2 focus-within:border-indigo-400 focus-within:ring-1 focus-within:ring-indigo-400 dark:border-neutral-700 dark:bg-neutral-900">
            <TriangleAlert className="h-4 w-4 shrink-0 text-red-400" aria-hidden />
            <input
              type="text"
              value={problem}
              onChange={(e) => setProblem(e.target.value)}
              placeholder="e.g. “We keep missing deadlines”"
              aria-label="Name the problem (an Undesirable Effect)"
              className="min-w-0 flex-1 bg-transparent text-neutral-900 text-sm outline-none placeholder:text-neutral-400 dark:text-neutral-100"
            />
          </div>
          <button
            type="submit"
            className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-md bg-indigo-600 px-4 py-2 font-medium text-sm text-white transition hover:bg-indigo-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
          >
            Build a Current Reality Tree
            <ArrowRight className="h-4 w-4" aria-hidden />
          </button>
        </form>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="font-semibold text-[10px] text-neutral-400 uppercase tracking-wider dark:text-neutral-500">
            Try
          </span>
          {EXAMPLE_PROBLEMS.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => buildCRT(p)}
              className="rounded-full border border-neutral-200 bg-white px-3 py-1 text-neutral-600 text-xs transition hover:border-indigo-300 hover:text-indigo-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-300 dark:hover:border-indigo-600 dark:hover:text-indigo-300"
            >
              {p}
            </button>
          ))}
        </div>
      </section>

      {recent.length > 0 && (
        <section>
          <div className="mb-4 flex items-baseline justify-between gap-3">
            <h2 className="font-semibold text-neutral-900 text-sm dark:text-neutral-100">
              Pick up where you left off
            </h2>
            <div className="flex items-baseline gap-3">
              {reviewCount > 0 && (
                <span className="text-amber-600 text-xs dark:text-amber-400">
                  {reviewCount} {reviewCount === 1 ? 'tree needs' : 'trees need'} a logic review
                </span>
              )}
              <button
                type="button"
                onClick={() => setStartSection('allTrees')}
                className="font-medium text-indigo-600 text-xs transition hover:text-indigo-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 dark:text-indigo-400"
              >
                View all trees →
              </button>
            </div>
          </div>
          <ul
            className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
            aria-label="Recent trees"
          >
            {recent.map((t) => (
              <li key={t.id}>
                <TreeCard id={t.id} doc={t.doc} openWarnings={t.openWarnings} />
              </li>
            ))}
          </ul>
        </section>
      )}

      {workedExample && (
        <button
          type="button"
          onClick={openWorkedExample}
          className="group flex items-center gap-3 rounded-lg border border-indigo-200 bg-indigo-50/50 px-4 py-3 text-left transition hover:bg-indigo-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 dark:border-indigo-900/50 dark:bg-indigo-950/30 dark:hover:bg-indigo-950/50"
        >
          <BookOpenCheck
            className="h-5 w-5 shrink-0 text-indigo-600 dark:text-indigo-400"
            aria-hidden
          />
          <span className="min-w-0 flex-1">
            <span className="block font-medium text-neutral-900 text-sm dark:text-neutral-100">
              New to the method? Open a worked example
            </span>
            <span className="block text-neutral-600 text-xs dark:text-neutral-400">
              A finished Current Reality Tree — see how UDEs trace back to a few root causes.
            </span>
          </span>
          <ArrowRight
            className="h-4 w-4 shrink-0 text-indigo-500 transition group-hover:translate-x-0.5"
            aria-hidden
          />
        </button>
      )}

      <section>
        <div className="mb-4 flex items-baseline justify-between gap-3">
          <h2 className="font-semibold text-[11px] text-neutral-400 uppercase tracking-wider dark:text-neutral-500">
            …or start from a template
          </h2>
          <span className="text-neutral-400 text-xs dark:text-neutral-500">
            {TEMPLATE_SPECS.length} worked examples · checked against the method
          </span>
        </div>
        <TemplateGallery limitPerGroup={3} />
      </section>
    </div>
  );
}
