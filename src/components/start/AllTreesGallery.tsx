import { Search } from 'lucide-react';
import { useMemo, useState } from 'react';
import { diagramMetaFor } from './diagramMeta';
import { TreeGallery } from './TreeGallery';
import type { SavedTree } from './useSavedTrees';

/**
 * Session 193 — the "All trees" view with an inline filter. The saved trees are
 * already loaded (passed down from StartPage), so filtering is instant,
 * client-side, and case-insensitive over the tree title + its diagram-type tag
 * (e.g. typing "crt" or "sales" both narrow the grid). Distinct from the
 * header's "Search trees…" button, which opens the ⌘K command palette; this is
 * an in-place filter of the gallery you're looking at.
 */
export function AllTreesGallery({ trees }: { trees: SavedTree[] }) {
  const [query, setQuery] = useState('');
  const q = query.trim().toLowerCase();

  const filtered = useMemo(() => {
    if (!q) return trees;
    return trees.filter((t) => {
      const title = (t.doc.title || 'Untitled').toLowerCase();
      const tag = diagramMetaFor(t.doc.diagramType).tag.toLowerCase();
      return title.includes(q) || tag.includes(q);
    });
  }, [trees, q]);

  return (
    <div className="flex flex-col gap-4">
      <div className="relative max-w-sm">
        <Search
          className="pointer-events-none absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 text-neutral-400"
          aria-hidden
        />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Filter trees by name or type…"
          aria-label="Filter trees by name or type"
          className="w-full rounded-md border border-neutral-200 bg-white py-1.5 pr-3 pl-8 text-neutral-900 text-sm outline-none placeholder:text-neutral-400 focus:border-accent-400 focus:ring-1 focus:ring-accent-400 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-100"
        />
      </div>
      <TreeGallery
        trees={filtered}
        emptyMessage={
          q
            ? `No trees match "${query.trim()}".`
            : 'No trees yet — start one from the Start page or a template.'
        }
      />
    </div>
  );
}
