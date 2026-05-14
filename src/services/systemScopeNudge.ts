import type { SystemScope, TPDocument } from '@/domain/types';
import { useDocumentStore } from '@/store';

/**
 * Session 83 — soft System Scope nudge.
 *
 * On `setDocument` / `newDocument` for a CRT, if the user hasn't filled
 * any of the seven System Scope (Step 0) fields AND the per-doc
 * `systemScopeNudgeShown` flag isn't already set, surface a one-time
 * toast pointing them to the Document Inspector's System Scope section.
 *
 * The previous parking rationale was "every-CRT-load is intrusive."
 * This implementation is deliberately one-time-per-doc: once shown, the
 * flag flips on and is persisted into the doc itself, so the nudge
 * never re-fires for that document.
 */

const isScopeEmpty = (scope: SystemScope | undefined): boolean => {
  if (!scope) return true;
  // Treat whitespace-only entries as empty so a half-filled scope (one
  // field with `\n`) doesn't accidentally suppress the nudge.
  return (Object.values(scope) as Array<string | undefined>).every(
    (v) => !v || v.trim().length === 0
  );
};

/**
 * Trigger the nudge for a freshly-loaded doc when appropriate. Pure
 * side-effect: shows toast + flips the per-doc flag via `updateDoc`.
 * Safe to call unconditionally — the function early-returns when the
 * preconditions aren't met.
 *
 * Exported for direct test coverage.
 */
export const maybeNudgeSystemScope = (doc: TPDocument): void => {
  if (doc.diagramType !== 'crt') return;
  if (doc.systemScopeNudgeShown) return;
  if (!isScopeEmpty(doc.systemScope)) return;
  const state = useDocumentStore.getState();
  state.showToast(
    'info',
    'Tip: Fill in the System Scope (Step 0) in the Document Inspector — it strengthens CRT analysis and seeds CLR hints.'
  );
  // Flip the per-doc flag so the nudge doesn't fire again on subsequent
  // setDocument calls for this same doc. The flag travels with the
  // doc through JSON export/import + share-links, so collaborators on
  // the same shared doc also see at most one toast.
  state.markSystemScopeNudgeShown();
};

// Exported so tests can verify the predicate in isolation.
export { isScopeEmpty };

/**
 * Install a `useDocumentStore` subscription that fires the nudge on
 * doc swaps (`setDocument` / `newDocument` / share-link load / boot
 * with stored doc). Called once from `main.tsx`. The subscription
 * compares `doc.id`s so it fires on full doc swaps but not on every
 * title-edit tick.
 */
export const installSystemScopeNudgeWatcher = (): void => {
  // Fire once for the boot doc — handles the localStorage-restore path.
  maybeNudgeSystemScope(useDocumentStore.getState().doc);
  let lastId = useDocumentStore.getState().doc.id;
  useDocumentStore.subscribe((state) => {
    if (state.doc.id !== lastId) {
      lastId = state.doc.id;
      maybeNudgeSystemScope(state.doc);
    }
  });
};
