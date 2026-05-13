import type { Revision } from '@/domain/revisions';
import { useDocumentStore } from '@/store';
import clsx from 'clsx';
import { Clock, GitBranch, History, X } from 'lucide-react';
import { useState } from 'react';
import { useShallow } from 'zustand/shallow';
import { Button } from '../ui/Button';
import { RevisionRow } from './RevisionRow';
import { formatRelativeTime } from './formatTime';

/**
 * H1 — Revision history side panel. Slides in from the right (the
 * inspector slides in from the same side; only one of the two is ever
 * mounted-visible at a time because the user opens history *instead of*
 * inspecting selection). Lists the current document's snapshots
 * newest-first; each row shows label / relative time / diff summary
 * versus the live doc, plus restore / rename / delete affordances.
 */
export function RevisionPanel() {
  const {
    open,
    close,
    revisions,
    doc,
    captureSnapshot,
    restoreSnapshot,
    deleteSnapshot,
    renameSnapshot,
    branchFromRevision,
    openCompare,
    openSideBySide,
    compareRevisionId,
  } = useDocumentStore(
    useShallow((s) => ({
      open: s.historyPanelOpen,
      close: s.closeHistoryPanel,
      revisions: s.revisions,
      doc: s.doc,
      captureSnapshot: s.captureSnapshot,
      restoreSnapshot: s.restoreSnapshot,
      deleteSnapshot: s.deleteSnapshot,
      renameSnapshot: s.renameSnapshot,
      branchFromRevision: s.branchFromRevision,
      openCompare: s.openCompare,
      openSideBySide: s.openSideBySide,
      compareRevisionId: s.compareRevisionId,
    }))
  );
  const showToast = useDocumentStore((s) => s.showToast);
  const confirm = useDocumentStore((s) => s.confirm);

  // The just-captured snapshot row gets a brief highlight so the user sees
  // their action land. Cleared after ~1.5 s; not persisted anywhere.
  const [recentId, setRecentId] = useState<string | null>(null);

  return (
    <aside
      data-component="revision-panel"
      className={clsx(
        // Mirrors the Inspector's geometry so the two panels feel like
        // alternates of one slot rather than competing UI.
        'revision-panel absolute right-0 top-0 z-20 h-full w-[min(85vw,320px)] transform md:w-[320px]',
        'border-l border-neutral-200 bg-white/95 backdrop-blur',
        'dark:border-neutral-800 dark:bg-neutral-950/95',
        // Match the Inspector's slide animation (200 ms, ease-out) so when
        // history closes and an Inspector opens — or vice versa — the
        // motion reads as one continuous swap rather than a snap.
        'transition-transform duration-200 ease-out',
        open ? 'translate-x-0' : 'translate-x-full'
      )}
      aria-hidden={!open}
      // `inert` removes the panel from focus + AT navigation while it's
      // off-screen. React types don't carry it on `aside` yet; cast.
      {...({ inert: !open ? '' : undefined } as Record<string, string | undefined>)}
    >
      <div className="flex h-full flex-col">
        <header className="flex items-center justify-between border-b border-neutral-200 px-4 py-3 dark:border-neutral-800">
          <span className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
            <History className="h-3.5 w-3.5" /> History
          </span>
          <Button variant="ghost" size="icon" onClick={close} aria-label="Close history">
            <X className="h-4 w-4" />
          </Button>
        </header>

        <div className="border-b border-neutral-200 px-4 py-3 dark:border-neutral-800">
          <Button
            variant="softViolet"
            onClick={() => {
              const id = captureSnapshot();
              showToast('success', 'Snapshot captured.');
              setRecentId(id);
              setTimeout(() => setRecentId((cur) => (cur === id ? null : cur)), 1500);
            }}
            className="w-full"
            aria-label="Snapshot current document"
          >
            <Clock className="h-3.5 w-3.5" />
            <span>Snapshot now</span>
          </Button>
          <p className="mt-2 text-[11px] text-neutral-500 dark:text-neutral-400">
            Snapshots also fire automatically on document swap (open / new).
          </p>
        </div>

        <div className="flex-1 overflow-y-auto">
          {revisions.length === 0 ? (
            <p className="px-4 py-6 text-center text-xs text-neutral-500 dark:text-neutral-400">
              No snapshots yet. Press{' '}
              <kbd className="rounded border border-neutral-200 px-1 dark:border-neutral-800">
                Snapshot now
              </kbd>{' '}
              to capture the current state.
            </p>
          ) : (
            <RevisionList
              revisions={revisions}
              liveDoc={doc}
              recentId={recentId}
              compareRevisionId={compareRevisionId}
              onRestore={(r) => {
                restoreSnapshot(r.id);
                showToast('success', `Restored ${r.label ?? 'snapshot'}.`);
              }}
              onDelete={async (r) => {
                const ok = await confirm(
                  `Delete snapshot "${r.label ?? formatRelativeTime(r.capturedAt)}"?`,
                  { confirmLabel: 'Delete' }
                );
                if (ok) deleteSnapshot(r.id);
              }}
              onRename={(r, next) => renameSnapshot(r.id, next)}
              onCompare={(r) => {
                openCompare(r.id);
                showToast('info', `Visual diff vs. ${r.label ?? 'snapshot'} — Esc to exit.`);
              }}
              onSideBySide={(r) => openSideBySide(r.id)}
              onBranch={(r) => {
                const name = window.prompt(
                  'Branch name?',
                  r.branchName ? `${r.branchName}-fork` : 'experiment'
                );
                if (name?.trim()) {
                  const id = branchFromRevision(r.id, name.trim());
                  if (id) showToast('success', `Branched "${name.trim()}" from snapshot.`);
                }
              }}
            />
          )}
        </div>
      </div>
    </aside>
  );
}

/**
 * Group revisions by their `branchName` (undefined → "Main"). Each group
 * renders as a small heading + an ordered list. The default Main branch
 * always comes first; named branches follow in capture-recency order
 * (most-recently-captured branch closest to Main).
 */
function RevisionList({
  revisions,
  liveDoc,
  recentId,
  compareRevisionId,
  onRestore,
  onDelete,
  onRename,
  onCompare,
  onSideBySide,
  onBranch,
}: {
  revisions: Revision[];
  liveDoc: Revision['doc'];
  recentId: string | null;
  compareRevisionId: string | null;
  onRestore: (r: Revision) => void;
  onDelete: (r: Revision) => void;
  onRename: (r: Revision, label: string) => void;
  onCompare: (r: Revision) => void;
  onSideBySide: (r: Revision) => void;
  onBranch: (r: Revision) => void;
}) {
  // Bucket by branchName.
  const groups = new Map<string, Revision[]>();
  for (const r of revisions) {
    const key = r.branchName?.trim() || 'Main';
    const list = groups.get(key) ?? [];
    list.push(r);
    groups.set(key, list);
  }
  // Stable ordering: Main first; then named branches by their latest
  // capture descending (newest experiments float up).
  const entries = Array.from(groups.entries()).sort(([a, ra], [b, rb]) => {
    if (a === 'Main') return -1;
    if (b === 'Main') return 1;
    const aLatest = Math.max(...ra.map((r) => r.capturedAt));
    const bLatest = Math.max(...rb.map((r) => r.capturedAt));
    return bLatest - aLatest;
  });
  return (
    <div className="flex flex-col">
      {entries.map(([branchName, group]) => (
        <section key={branchName}>
          <h3 className="sticky top-0 z-10 flex items-center gap-1 border-b border-neutral-200 bg-neutral-50/95 px-4 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-neutral-500 backdrop-blur dark:border-neutral-800 dark:bg-neutral-900/95 dark:text-neutral-400">
            <GitBranch className="h-3 w-3" />
            {branchName}
            <span className="ml-1 font-normal normal-case tracking-normal text-neutral-400">
              {group.length} snapshot{group.length === 1 ? '' : 's'}
            </span>
          </h3>
          <ul className="divide-y divide-neutral-200 dark:divide-neutral-800">
            {group.map((r) => (
              <RevisionRow
                key={r.id}
                revision={r}
                liveDoc={liveDoc}
                recent={r.id === recentId}
                comparing={r.id === compareRevisionId}
                onRestore={() => onRestore(r)}
                onDelete={() => onDelete(r)}
                onRename={(next) => onRename(r, next)}
                onCompare={() => onCompare(r)}
                onSideBySide={() => onSideBySide(r)}
                onBranch={() => onBranch(r)}
              />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
