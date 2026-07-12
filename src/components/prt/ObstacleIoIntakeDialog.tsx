import { Plus, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { LargeDialog } from '@/components/ui/LargeDialog';
import { useDocumentStore } from '@/store';
import type { ObstacleIoRow } from '@/store/documentSlice/edges/connect';

/**
 * Session 199 (backlog E) — the Prerequisite-Tree Obstacle/Objective intake
 * table. Capture many obstacle → intermediate-objective pairs at once; Apply
 * mints them all in a single undo step via `addObstacleIoRows`. Local state
 * only until Apply — the active doc isn't touched while you type (mirrors the
 * ThreeCloudWizard capture-then-commit model).
 */
type Row = {
  id: number;
  obstacle: string;
  io: string;
  showStopper: boolean;
  blockingFactor: string;
};

// A monotonic id per row so React keys stay stable across add/remove (rows
// reorder, so an array-index key would mis-associate inputs).
let rowSeq = 0;
const blankRow = (): Row => ({
  id: rowSeq++,
  obstacle: '',
  io: '',
  showStopper: false,
  blockingFactor: '',
});

const INPUT =
  'w-full rounded-md border border-neutral-200 bg-white px-2 py-1 text-neutral-900 text-xs transition focus:border-accent-400 focus:outline-none dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-100';

export function ObstacleIoIntakeDialog() {
  const open = useDocumentStore((s) => s.obstacleIoIntakeOpen);
  const close = useDocumentStore((s) => s.closeObstacleIoIntake);
  const addRows = useDocumentStore((s) => s.addObstacleIoRows);
  const showToast = useDocumentStore((s) => s.showToast);
  const [rows, setRows] = useState<Row[]>(() => [blankRow()]);

  // Reset to a single blank row each time the dialog opens.
  useEffect(() => {
    if (open) setRows([blankRow()]);
  }, [open]);

  if (!open) return null;

  const setAt = (i: number, patch: Partial<Row>) =>
    setRows((prev) => prev.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const removeAt = (i: number) =>
    setRows((prev) => (prev.length === 1 ? [blankRow()] : prev.filter((_, j) => j !== i)));

  const validCount = rows.filter((r) => r.obstacle.trim() !== '' || r.io.trim() !== '').length;

  const apply = () => {
    if (validCount === 0) return;
    const payload: ObstacleIoRow[] = rows.map((r) => ({
      obstacle: r.obstacle,
      io: r.io,
      ...(r.showStopper ? { showStopper: true } : {}),
      ...(r.blockingFactor.trim() !== '' ? { blockingFactor: r.blockingFactor } : {}),
    }));
    const created = addRows(payload);
    close();
    const pairs = created.length / 2;
    showToast(
      'success',
      `Added ${pairs} obstacle–objective pair${pairs === 1 ? '' : 's'}. Undo to remove.`
    );
  };

  return (
    <LargeDialog
      open={open}
      onClose={close}
      title="Add obstacles & objectives"
      subtitle="Each row becomes an Obstacle and the Intermediate Objective that overcomes it, wired objective → obstacle."
      widthClass="w-[min(680px,96vw)]"
    >
      <div className="flex flex-col gap-3 p-4">
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr className="text-left text-[10px] text-neutral-500 uppercase tracking-wider dark:text-neutral-400">
              <th className="w-[36%] px-2 pb-1 font-medium">Obstacle</th>
              <th className="w-[12%] px-2 pb-1 text-center font-medium">Show-stopper?</th>
              <th className="w-[34%] px-2 pb-1 font-medium">Intermediate objective</th>
              <th className="w-[18%] px-2 pb-1 font-medium">Blocking factor</th>
              <th className="w-8" />
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={r.id}>
                <td className="px-2 py-1 align-top">
                  <input
                    className={INPUT}
                    value={r.obstacle}
                    onChange={(e) => setAt(i, { obstacle: e.target.value })}
                    placeholder="What's in the way?"
                    aria-label={`Obstacle ${i + 1}`}
                  />
                </td>
                <td className="px-2 py-1 text-center align-middle">
                  <input
                    type="checkbox"
                    checked={r.showStopper}
                    onChange={(e) => setAt(i, { showStopper: e.target.checked })}
                    aria-label={`Show-stopper ${i + 1}`}
                  />
                </td>
                <td className="px-2 py-1 align-top">
                  <input
                    className={INPUT}
                    value={r.io}
                    onChange={(e) => setAt(i, { io: e.target.value })}
                    placeholder="What must be true to overcome it?"
                    aria-label={`Objective ${i + 1}`}
                  />
                </td>
                <td className="px-2 py-1 align-top">
                  <input
                    className={INPUT}
                    value={r.blockingFactor}
                    onChange={(e) => setAt(i, { blockingFactor: e.target.value })}
                    placeholder="optional"
                    aria-label={`Blocking factor ${i + 1}`}
                  />
                </td>
                <td className="px-1 py-1 text-center align-middle">
                  <button
                    type="button"
                    onClick={() => removeAt(i)}
                    aria-label={`Remove row ${i + 1}`}
                    className="rounded-sm p-1 text-neutral-400 transition hover:bg-neutral-100 hover:text-neutral-700 dark:hover:bg-neutral-800"
                  >
                    <Trash2 className="h-3.5 w-3.5" aria-hidden />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <button
          type="button"
          onClick={() => setRows((prev) => [...prev, blankRow()])}
          className="inline-flex w-fit items-center gap-1 text-accent-700 text-xs transition hover:text-accent-900 dark:text-accent-300 dark:hover:text-accent-200"
        >
          <Plus className="h-3.5 w-3.5" aria-hidden />
          Add row
        </button>

        <p className="text-[11px] text-neutral-500 dark:text-neutral-400">
          Show-stopper marks a hard blocker on the obstacle; the blocking-factor note lands in the
          obstacle's description. If the tree has a single apex goal, each obstacle is wired to it.
        </p>

        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={close}
            className="rounded-md border border-neutral-200 px-3 py-1.5 text-neutral-700 text-sm transition hover:bg-neutral-50 dark:border-neutral-800 dark:text-neutral-200 dark:hover:bg-neutral-900"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={apply}
            disabled={validCount === 0}
            className="rounded-md border border-accent-400 bg-accent-50 px-3 py-1.5 font-medium text-accent-900 text-sm transition hover:bg-accent-100 disabled:cursor-not-allowed disabled:opacity-40 dark:border-accent-500 dark:bg-accent-950/40 dark:text-accent-100"
          >
            Apply{validCount > 0 ? ` · ${validCount} pair${validCount === 1 ? '' : 's'}` : ''}
          </button>
        </div>
      </div>
    </LargeDialog>
  );
}
