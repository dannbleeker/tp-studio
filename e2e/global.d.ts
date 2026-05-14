// Session 82 — ambient declaration for the Playwright test hook
// installed by `src/services/testHook.ts` when the app loads with
// `?test=1`. We redefine the shape here (rather than importing it
// from `@/services/testHook`) so the e2e suite's TypeScript pass
// doesn't depend on path-alias resolution, which Playwright's
// auto-discovered tsconfig handles differently than the app's `tsc`.

type TpEntityType =
  | 'effect'
  | 'rootCause'
  | 'undesirableEffect'
  | 'assumption'
  | 'injection'
  | 'goal'
  | 'criticalSuccessFactor'
  | 'necessaryCondition'
  | 'note';

interface TpTestHook {
  store: {
    getState: () => unknown;
    setState: (partial: unknown) => void;
  };
  seed: (opts: {
    type?: TpEntityType;
    titles: string[];
    clear?: boolean;
  }) => string[];
  connect: (sourceId: string, targetId: string) => string | null;
  confirmAndDeleteEntity: (id: string) => Promise<void>;
}

declare global {
  interface Window {
    __TP_TEST__?: TpTestHook;
  }
}

export {};
