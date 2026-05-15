import { confirmAndDeleteEntity } from '@/services/confirmations';
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
  // Note: previously this interface also exposed the live `useDocumentStore`
  // as a `store` field for tests that needed arbitrary actions. Session 84
  // optimization-pass audit found no caller across the 5 specs in `e2e/` —
  // every test went through `seed` / `connect` / `confirmAndDeleteEntity`
  // instead. Dropped to shrink the surface; if a future test needs a new
  // action, add it as a typed method on this interface (not a generic
  // store escape hatch).
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
  /**
   * Invoke the production `confirmAndDeleteEntity(id)` service. Fires
   * the same code path the keyboard `Delete` handler does — opens the
   * `ConfirmDialog` when the entity has edges; deletes silently when
   * it doesn't. Returns the promise so the test can choose to await
   * the resolution after clicking the dialog button.
   *
   * This exists because the keyboard / click-to-select path is racy
   * on CI (React Flow's `onSelectionChange` mirrors react-flow state
   * back to the store on every render, including mount-time empty
   * events — a programmatic `store.selectEntity()` set just before
   * pressing Delete gets wiped before the keyboard handler reads it).
   * Going through `confirmAndDeleteEntity(id)` directly sidesteps the
   * selection ambiguity entirely.
   */
  confirmAndDeleteEntity: (id: string) => Promise<void>;
  /**
   * Session 95 — expose the current selection so the SelectionToolbar
   * e2e can wait for React Flow's onSelectionChange to have written
   * through to our store before asserting on the toolbar's
   * appearance. Returning the raw discriminated union is cheaper
   * than a per-shape accessor and matches the store's shape exactly.
   */
  getSelection: () => ReturnType<typeof useDocumentStore.getState>['selection'];
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
    confirmAndDeleteEntity,
    getSelection: () => useDocumentStore.getState().selection,
  };
  // `window.__TP_TEST__` is typed in `src/vite-env.d.ts` as an
  // optional `TpTestHook` — no `as any` cast needed. The opt-in URL
  // flag (?test=1) is what keeps the property out of normal users'
  // way; the type lets src-side reads narrow it correctly.
  window.__TP_TEST__ = hook;
};
