import clsx from 'clsx';
import { CaseSensitive, ChevronDown, ChevronUp, Regex, WholeWord, X } from 'lucide-react';
import { useEffect, useMemo, useRef } from 'react';
import { useShallow } from 'zustand/shallow';
import { Button } from '@/components/ui/Button';
import { ancestorChain } from '@/domain/groups';
import { findMatches } from '@/domain/search';
import { useDelayedFocus } from '@/hooks/useDelayedFocus';
import { getCanvasInstance } from '@/services/canvasRef';
import { useDocumentStore } from '@/store';
import { currentDoc } from '@/store/selectors';

/**
 * Slide-down find panel triggered by Cmd/Ctrl+F. Live-filters as the user
 * types, jumps the viewport + selection to the active match, and pre-expands
 * collapsed groups + unhoists when the match lives outside the current view.
 */
export function SearchPanel() {
  const open = useDocumentStore((s) => s.searchOpen);
  const doc = useDocumentStore((s) => currentDoc(s));
  // Inspector occupies up to 320 px on the right when anything is selected.
  // We shift the find-panel center left and tighten the width so the panel
  // never lands underneath the inspector at narrower viewports.
  const inspectorOpen = useDocumentStore((s) => s.selection.kind !== 'none' && !s.inspectorHidden);
  const {
    query,
    options,
    matchIndex,
    setQuery,
    setOptions,
    setMatchIndex,
    closeSearch,
    selectEntity,
    selectEdge,
    toggleGroupCollapsed,
    unhoist,
  } = useDocumentStore(
    useShallow((s) => ({
      query: s.searchQuery,
      options: s.searchOptions,
      matchIndex: s.searchMatchIndex,
      setQuery: s.setSearchQuery,
      setOptions: s.setSearchOptions,
      setMatchIndex: s.setSearchMatchIndex,
      closeSearch: s.closeSearch,
      // Entities and groups share the selection bucket; selectEntity drives both.
      selectEntity: s.selectEntity,
      selectEdge: s.selectEdge,
      toggleGroupCollapsed: s.toggleGroupCollapsed,
      unhoist: s.unhoist,
    }))
  );

  const inputRef = useRef<HTMLInputElement | null>(null);

  // Session 130 — autofocus extracted into `useDelayedFocus`; 60 ms
  // delay syncs with the panel's slide-in animation.
  useDelayedFocus(inputRef, open, 60);

  const matches = useMemo(() => findMatches(doc, query, options), [doc, query, options]);
  const count = matches.length;
  const safeIndex = count === 0 ? 0 : ((matchIndex % count) + count) % count;
  const active = matches[safeIndex];

  // Whenever the active match changes, expand its containing groups, unhoist
  // if it's outside the current hoist, then select it + scroll into view.
  // biome-ignore lint/correctness/useExhaustiveDependencies: every dep that affects the jump is listed via active.
  useEffect(() => {
    if (!active) return;
    const state = useDocumentStore.getState();
    // X-Search-5: auto-expand collapsed ancestors so the match becomes visible.
    if (active.kind === 'entity' || active.kind === 'group') {
      const ancestors = ancestorChain(currentDoc(state), active.id);
      for (const a of ancestors) {
        if (a.collapsed) toggleGroupCollapsed(a.id);
      }
      // If hoisted and the match isn't inside the hoisted scope, unhoist.
      if (state.hoistedGroupId) {
        const inHoist = ancestors.some((a) => a.id === state.hoistedGroupId);
        if (!inHoist && active.id !== state.hoistedGroupId) unhoist();
      }
      selectEntity(active.id);
      const inst = getCanvasInstance();
      const node = inst?.getNode(active.id);
      if (node && inst) {
        // setCenter is forgiving — call after a frame so the just-mutated
        // selection and any expand/unhoist re-render lands first.
        window.requestAnimationFrame(() => {
          inst.setCenter(node.position.x + 140, node.position.y + 40, {
            zoom: inst.getZoom(),
            duration: 250,
          });
        });
      }
    } else if (active.kind === 'edge') {
      selectEdge(active.id);
    }
  }, [active?.kind, active?.id]);

  if (!open) return null;

  const advance = (delta: number) => {
    if (count === 0) return;
    setMatchIndex(safeIndex + delta);
  };

  // When the inspector is closed the panel uses the full canvas. When it's
  // open, the available width is reduced and the panel re-centers within the
  // remaining space (canvas minus the inspector's 320 px right reservation).
  const panelStyle = inspectorOpen
    ? {
        // Center within the canvas-minus-inspector area: viewport center is
        // (W − 320)/2, which equals 50% − 160 px.
        left: 'calc(50% - 160px)',
        // Width caps at 720 OR fits inside (W − 320 − 40 padding), whichever is smaller.
        width: 'min(720px, calc(100vw - 360px))',
      }
    : undefined;
  return (
    <div
      data-component="search-panel"
      style={panelStyle}
      className={clsx(
        'pointer-events-auto absolute top-16 z-20 flex -translate-x-1/2 flex-col rounded-xl border border-neutral-200 bg-white/95 shadow-lg backdrop-blur-xs dark:border-neutral-800 dark:bg-neutral-950/95',
        // Default geometry when nothing's selected: full-canvas centered.
        !inspectorOpen && 'left-1/2 w-[min(720px,90vw)]'
      )}
    >
      <div className="flex items-center gap-2 px-3 py-2">
        <input
          ref={inputRef}
          type="text"
          value={query}
          placeholder="Find in document…"
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              advance(e.shiftKey ? -1 : 1);
            } else if (e.key === 'Escape') {
              e.preventDefault();
              closeSearch();
            }
          }}
          className="flex-1 rounded-md border border-neutral-200 bg-white px-2 py-1 text-sm outline-hidden focus:border-accent-400 focus:ring-1 focus:ring-accent-400 dark:border-neutral-800 dark:bg-neutral-900"
        />
        <span className="min-w-[64px] text-neutral-500 text-xs tabular-nums dark:text-neutral-400">
          {count === 0 ? 'No matches' : `${safeIndex + 1} / ${count}`}
        </span>
        <div className="flex items-center gap-0.5">
          <OptionToggle
            label="Match case"
            active={options.caseSensitive}
            onClick={() => setOptions({ caseSensitive: !options.caseSensitive })}
          >
            <CaseSensitive className="h-3.5 w-3.5" />
          </OptionToggle>
          <OptionToggle
            label="Whole word"
            active={options.wholeWord}
            onClick={() => setOptions({ wholeWord: !options.wholeWord })}
          >
            <WholeWord className="h-3.5 w-3.5" />
          </OptionToggle>
          <OptionToggle
            label="Regex"
            active={options.regex}
            onClick={() => setOptions({ regex: !options.regex })}
          >
            <Regex className="h-3.5 w-3.5" />
          </OptionToggle>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => advance(-1)}
          disabled={count === 0}
          aria-label="Previous match"
          title="Previous (Shift+Enter)"
        >
          <ChevronUp className="h-3.5 w-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => advance(1)}
          disabled={count === 0}
          aria-label="Next match"
          title="Next (Enter)"
        >
          <ChevronDown className="h-3.5 w-3.5" />
        </Button>
        <Button variant="ghost" size="icon" onClick={closeSearch} aria-label="Close find">
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>
      {count > 0 && (
        <ul className="max-h-[40vh] overflow-y-auto border-neutral-200 border-t dark:border-neutral-800">
          {matches.map((m, i) => (
            <li key={`${m.kind}-${m.id}-${m.field}`}>
              <button
                type="button"
                onClick={() => setMatchIndex(i)}
                className={clsx(
                  'flex w-full flex-col items-start gap-0.5 border-l-2 px-3 py-1.5 text-left text-xs transition',
                  i === safeIndex
                    ? 'border-accent-500 bg-accent-50 dark:bg-accent-950/40'
                    : 'border-transparent hover:bg-neutral-50 dark:hover:bg-neutral-900'
                )}
              >
                <span className="font-semibold text-[10px] text-neutral-500 uppercase tracking-wider dark:text-neutral-400">
                  {m.kind} · {m.field}
                </span>
                <span className="line-clamp-1 text-neutral-800 dark:text-neutral-200">
                  {m.preview}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function OptionToggle({
  label,
  active,
  onClick,
  children,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      aria-label={label}
      title={label}
      className={clsx(
        'rounded-xs p-1 transition',
        active
          ? 'bg-accent-100 text-accent-700 dark:bg-accent-950/60 dark:text-accent-300'
          : 'text-neutral-500 hover:bg-neutral-100 hover:text-neutral-800 dark:hover:bg-neutral-800 dark:hover:text-neutral-200'
      )}
    >
      {children}
    </button>
  );
}
