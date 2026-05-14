import { useDocumentStore } from '@/store';

/**
 * Session 82 — Playwright test hook.
 *
 * The Playwright e2e suite runs against the production `vite preview`
 * build, so it can't `import` from `@/store` directly. Driving the UI
 * with `page.mouse.dblclick()` to seed entities turned out to be flaky
 * on the GitHub-Actions Ubuntu runner (the dblclick gesture races with
 * React Flow's mount, and exact `toHaveCount(N)` assertions fail
 * intermittently — see the e2e-debt entry under Session 81 in the
 * CHANGELOG).
 *
 * The fix is to expose a tiny deterministic seeding surface on `window`
 * — but only when the page explicitly opts in via `?test=1`. Regular
 * users never see it; Playwright opts in at `page.goto('/?test=1')`.
 *
 * The hook exposes the live `useDocumentStore` plus a small `seed()`
 * helper that captures the common "reset + create N entities + connect
 * them" pattern. Tests can also drop down to `store.getState().<action>`
 * for anything the helper doesn't cover.
 */

type EntityType = Parameters<ReturnType<typeof useDocumentStore.getState>['addEntity']>[0]['type'];

export interface TpTestHook {
  /** Live zustand store; tests can call any action via `getState().X`. */
  store: typeof useDocumentStore;
  /**
   * Reset the store + add N entities of the given type. Returns each
   * created entity's id so tests can reference them in subsequent
   * actions. The default `clear` resets localStorage too so a previous
   * test's autosave doesn't leak in.
   */
  seed: (opts: {
    type?: EntityType;
    titles: string[];
    clear?: boolean;
  }) => string[];
  /**
   * Connect two seeded entities by id with a sufficiency edge. Returns
   * the edge id, or null if the pair would create a self-loop / dupe.
   */
  connect: (sourceId: string, targetId: string) => string | null;
}

/**
 * Install the test hook on `window` if the current URL carries `?test=1`.
 * No-op otherwise. Called once at app boot from `main.tsx`. The opt-in
 * URL param keeps the hook out of the production user's surface area —
 * it's only there when explicitly requested.
 */
export const maybeInstallTestHook = (): void => {
  if (typeof window === 'undefined') return;
  const params = new URLSearchParams(window.location.search);
  if (params.get('test') !== '1') return;
  const hook: TpTestHook = {
    store: useDocumentStore,
    seed: ({ type = 'effect', titles, clear = true }) => {
      if (clear) {
        try {
          window.localStorage.clear();
        } catch {
          // ignore — some embedders block localStorage access
        }
      }
      const ids: string[] = [];
      const state = useDocumentStore.getState();
      // Drop every existing entity so the seed is a clean slate even
      // when `clear` was false (e.g. a follow-up seed in the same
      // page load).
      for (const id of Object.keys(state.doc.entities)) {
        state.deleteEntity(id);
      }
      for (const title of titles) {
        const entity = useDocumentStore.getState().addEntity({ type, title });
        ids.push(entity.id);
      }
      return ids;
    },
    connect: (sourceId, targetId) => {
      const edge = useDocumentStore.getState().connect(sourceId, targetId);
      return edge?.id ?? null;
    },
  };
  // biome-ignore lint/suspicious/noExplicitAny: deliberate window-surface escape hatch for Playwright; the TpTestHook contract documents the shape and the opt-in URL flag keeps it out of normal users' way.
  (window as any).__TP_TEST__ = hook;
};
