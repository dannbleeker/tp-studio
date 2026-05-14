// Session 89 — vitest stub for the `virtual:pwa-register` module that
// vite-plugin-pwa generates at build time. The real module wires a
// service-worker registration; the stub captures the callbacks passed
// to `registerSW` so tests can fire them deterministically and assert
// the resulting toast / store state.
//
// Tests reach the captured callbacks via `__getLastRegisterSWOptions()`
// or via the `__triggerNeedRefresh()` / `__triggerOfflineReady()`
// helpers. Production code never imports this file — the vitest alias
// in `vite.config.ts` routes `virtual:pwa-register` here only when the
// `VITEST` env var is set.

export type RegisterSWOptions = {
  onNeedRefresh?: () => void;
  onOfflineReady?: () => void;
  onRegistered?: (registration: ServiceWorkerRegistration | undefined) => void;
  onRegisterError?: (error: unknown) => void;
};

type UpdateSW = (reloadPage?: boolean) => Promise<void>;

let lastOptions: RegisterSWOptions | null = null;
let updateCalls: Array<boolean | undefined> = [];

export const registerSW = (options: RegisterSWOptions = {}): UpdateSW => {
  lastOptions = options;
  return async (reloadPage?: boolean) => {
    updateCalls.push(reloadPage);
  };
};

export const __getLastRegisterSWOptions = (): RegisterSWOptions | null => lastOptions;

export const __getUpdateCalls = (): Array<boolean | undefined> => updateCalls;

export const __resetPwaRegisterStub = (): void => {
  lastOptions = null;
  updateCalls = [];
};

export const __triggerNeedRefresh = (): void => {
  lastOptions?.onNeedRefresh?.();
};

export const __triggerOfflineReady = (): void => {
  lastOptions?.onOfflineReady?.();
};
