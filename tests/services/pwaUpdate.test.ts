// Session 89 — verify `initPwaUpdateToast()` wires the service-worker
// lifecycle callbacks into the toast pipeline correctly.
//
// vite-plugin-pwa generates `virtual:pwa-register` at build time. The
// vitest alias in `vite.config.ts` routes that import to a stub in
// `tests/stubs/virtual-pwa-register.ts` so jsdom can exercise the
// callback shapes without a real SW.

import { beforeEach, describe, expect, it } from 'vitest';
import { __resetPwaUpdateForTest, initPwaUpdateToast } from '@/services/pwa/pwaUpdate';
import { resetStoreForTest, useDocumentStore } from '@/store';
// The vitest alias in `vite.config.ts` makes `virtual:pwa-register`
// resolve to `tests/stubs/virtual-pwa-register.ts`. We import the
// test helpers directly via the stub's filesystem path because the
// official `virtual:pwa-register` types (from `vite-plugin-pwa/client`)
// don't include the `__getLastRegisterSWOptions` / `__trigger*`
// surface we added for vitest — and we don't want to leak those
// symbols into the production type contract.
import {
  __getLastRegisterSWOptions,
  __getUpdateCalls,
  __resetPwaRegisterStub,
  __triggerNeedRefresh,
  __triggerOfflineReady,
} from '../stubs/virtual-pwa-register';

beforeEach(() => {
  resetStoreForTest();
  __resetPwaUpdateForTest();
  __resetPwaRegisterStub();
});

describe('initPwaUpdateToast', () => {
  it('registers the SW with both lifecycle callbacks', () => {
    initPwaUpdateToast();
    const options = __getLastRegisterSWOptions();
    expect(options).not.toBeNull();
    expect(typeof options?.onNeedRefresh).toBe('function');
    expect(typeof options?.onOfflineReady).toBe('function');
  });

  it('shows an info toast with a "Refresh now" action when a new version lands', () => {
    initPwaUpdateToast();
    expect(useDocumentStore.getState().toasts).toHaveLength(0);
    __triggerNeedRefresh();
    const toasts = useDocumentStore.getState().toasts;
    expect(toasts).toHaveLength(1);
    expect(toasts[0]?.kind).toBe('info');
    expect(toasts[0]?.message).toMatch(/New version/);
    expect(toasts[0]?.action?.label).toBe('Refresh now');
    expect(typeof toasts[0]?.action?.run).toBe('function');
  });

  it('"Refresh now" action calls updateSW(true) so the waiting SW skips waiting + reloads', () => {
    initPwaUpdateToast();
    __triggerNeedRefresh();
    const action = useDocumentStore.getState().toasts[0]?.action;
    expect(action).toBeDefined();
    action?.run();
    const updateCalls = __getUpdateCalls();
    expect(updateCalls).toEqual([true]);
  });

  it('shows a success toast when the SW reports offline-ready (first-visit precache complete)', () => {
    initPwaUpdateToast();
    __triggerOfflineReady();
    const toasts = useDocumentStore.getState().toasts;
    expect(toasts).toHaveLength(1);
    expect(toasts[0]?.kind).toBe('success');
    expect(toasts[0]?.message).toMatch(/offline/i);
  });

  it('is idempotent — repeated calls do not re-register the SW', () => {
    initPwaUpdateToast();
    const first = __getLastRegisterSWOptions();
    initPwaUpdateToast();
    initPwaUpdateToast();
    // The stub's `lastOptions` is overwritten on each `registerSW`
    // call, so if we'd re-registered we'd see a *different* options
    // object. Guard checks the reference held by `registered`.
    const second = __getLastRegisterSWOptions();
    expect(second).toBe(first);
  });
});

// Session 135 — `checkForUpdate` (palette `Check for updates`). jsdom
// doesn't ship a service-worker API; each case stubs
// `navigator.serviceWorker` to drive one branch of `UpdateCheckResult`.

import { checkForUpdate } from '@/services/pwa/pwaUpdate';

type FakeReg = {
  waiting?: ServiceWorker | null;
  installing?: ServiceWorker | null;
  update: () => Promise<unknown>;
};

const installFakeServiceWorker = (reg: FakeReg | null): (() => void) => {
  const nav = navigator as Navigator & {
    serviceWorker?: { getRegistration: () => Promise<FakeReg | undefined> };
  };
  const had = Object.hasOwn(nav, 'serviceWorker');
  const prev = nav.serviceWorker;
  Object.defineProperty(navigator, 'serviceWorker', {
    configurable: true,
    value: { getRegistration: async () => reg ?? undefined },
  });
  return () => {
    if (had && prev !== undefined) {
      Object.defineProperty(navigator, 'serviceWorker', {
        configurable: true,
        value: prev,
      });
    } else {
      delete (nav as unknown as Record<string, unknown>).serviceWorker;
    }
  };
};

describe('checkForUpdate (Session 135)', () => {
  it("returns 'unsupported' when no service-worker registration is present", async () => {
    const restore = installFakeServiceWorker(null);
    try {
      expect(await checkForUpdate()).toBe('unsupported');
    } finally {
      restore();
    }
  });

  it("returns 'up-to-date' and triggers update() when no new SW is found", async () => {
    let updateCalls = 0;
    const reg: FakeReg = {
      update: async () => {
        updateCalls += 1;
      },
    };
    const restore = installFakeServiceWorker(reg);
    try {
      expect(await checkForUpdate()).toBe('up-to-date');
      expect(updateCalls).toBe(1);
    } finally {
      restore();
    }
  });

  it("returns 'newly-found' when update() leaves an installing SW", async () => {
    const reg: FakeReg = {
      update: async () => {
        // Mimic the browser advancing the new worker to `installing`
        // during update() — set the field before the promise resolves.
        reg.installing = { state: 'installing' } as unknown as ServiceWorker;
      },
    };
    const restore = installFakeServiceWorker(reg);
    try {
      expect(await checkForUpdate()).toBe('newly-found');
    } finally {
      restore();
    }
  });

  it("returns 'already-pending' and re-surfaces the Refresh-now toast when an update is already waiting", async () => {
    // The toast carries a Refresh-now action only when `initPwaUpdateToast`
    // has wired the SW (capturing `updateSW`); kick that off first.
    initPwaUpdateToast();
    const reg: FakeReg = {
      waiting: { state: 'installed' } as unknown as ServiceWorker,
      update: async () => {
        throw new Error('update() must not run when an update is already waiting');
      },
    };
    const restore = installFakeServiceWorker(reg);
    try {
      const before = useDocumentStore.getState().toasts.length;
      expect(await checkForUpdate()).toBe('already-pending');
      const toasts = useDocumentStore.getState().toasts;
      expect(toasts).toHaveLength(before + 1);
      const last = toasts.at(-1);
      expect(last?.message).toMatch(/New version/);
      expect(last?.action?.label).toBe('Refresh now');
    } finally {
      restore();
    }
  });
});
