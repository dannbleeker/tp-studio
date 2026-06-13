import { TreeCard } from './TreeCard';
import type { SavedTree } from './useSavedTrees';

/** Shared empty-state card for the tree galleries / lists. */
export function TreesEmpty({ message }: { message: string }) {
  return (
    <div className="rounded-lg border border-neutral-200 border-dashed px-6 py-12 text-center text-neutral-500 text-sm dark:border-neutral-800 dark:text-neutral-400">
      {message}
    </div>
  );
}

/**
 * Session 183 — a responsive grid of tree cards (the user's open trees). Used by
 * "All trees" and "Needs review" (the latter passing a filtered list).
 */
export function TreeGallery({ trees, emptyMessage }: { trees: SavedTree[]; emptyMessage: string }) {
  if (trees.length === 0) return <TreesEmpty message={emptyMessage} />;
  return (
    <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-label="Trees">
      {trees.map((t) => (
        <li key={t.id}>
          <TreeCard id={t.id} doc={t.doc} openWarnings={t.openWarnings} />
        </li>
      ))}
    </ul>
  );
}
