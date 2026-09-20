// The repair path only fires on one narrow signature — a registered
// worker sitting on an empty precache, while online — and must fire
// exactly once. These cases pin that, and pin the three ways a
// locked-down browser can refuse to answer (no service worker API, no
// Cache Storage, a rejecting Cache Storage) without the module throwing
// or guessing.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  __resetOfflineReadinessForTest,
  checkOfflineReadiness,
} from '@/services/pwa/offlineReadiness';

const PRECACHE = 'workbox-precache-v2-https://tp-studio.example/';

function setNavigator(key: string, value: unknown): void {
  Object.defineProperty(navigator, key, { value, configurable: true, writable: true });
}

/** A registration whose `update()` we can assert on. */
function registrationStub(update: () => Promise<void> = () => Promise.resolve()) {
  const updateMock = vi.fn(update);
  return { updateMock, registration: { active: {}, update: updateMock } };
}

/** Cache Storage holding `entryCount` precache entries. */
function cachesWith(entryCount: number, names: string[] = [PRECACHE]): unknown {
  return {
    keys: () => Promise.resolve(names),
    open: () =>
      Promise.resolve({
        keys: () => Promise.resolve(new Array<Request>(entryCount)),
      }),
  };
}

beforeEach(() => {
  __resetOfflineReadinessForTest();
  setNavigator('onLine', true);
});

afterEach(() => {
  __resetOfflineReadinessForTest();
  Reflect.deleteProperty(navigator, 'serviceWorker');
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('checkOfflineReadiness', () => {
  it('reports "unsupported" where the browser has no service worker API', async () => {
    Reflect.deleteProperty(navigator, 'serviceWorker');
    vi.stubGlobal('caches', cachesWith(90));

    await expect(checkOfflineReadiness()).resolves.toEqual({
      supported: false,
      registered: false,
      activated: false,
      precachedEntries: null,
      action: 'unsupported',
    });
  });

  it('reports "not-registered" and repairs nothing when no worker is registered', async () => {
    setNavigator('serviceWorker', { getRegistration: () => Promise.resolve(undefined) });
    vi.stubGlobal('caches', cachesWith(0));

    const result = await checkOfflineReadiness();

    expect(result.action).toBe('not-registered');
    expect(result.registered).toBe(false);
    // Registering is `pwaUpdate.ts`'s job — we must not read as a failure
    // the state of a boot where registration simply hasn't happened.
    expect(result.precachedEntries).toBeNull();
  });

  it('reports "healthy" and leaves a populated precache alone', async () => {
    const { updateMock, registration } = registrationStub();
    setNavigator('serviceWorker', { getRegistration: () => Promise.resolve(registration) });
    vi.stubGlobal('caches', cachesWith(92));

    const result = await checkOfflineReadiness();

    expect(result).toEqual({
      supported: true,
      registered: true,
      activated: true,
      precachedEntries: 92,
      action: 'healthy',
    });
    expect(updateMock).not.toHaveBeenCalled();
  });

  it('requests exactly one update when a registered worker has an empty precache', async () => {
    const { updateMock, registration } = registrationStub();
    setNavigator('serviceWorker', { getRegistration: () => Promise.resolve(registration) });
    vi.stubGlobal('caches', cachesWith(0, []));

    const result = await checkOfflineReadiness();

    expect(result.action).toBe('repair-requested');
    expect(result.precachedEntries).toBe(0);
    expect(updateMock).toHaveBeenCalledOnce();

    // Memoised: a broken origin reports once and stops, it does not spin.
    await checkOfflineReadiness();
    expect(updateMock).toHaveBeenCalledOnce();
  });

  it('treats a near-empty precache as a wiped install too', async () => {
    const { updateMock, registration } = registrationStub();
    setNavigator('serviceWorker', { getRegistration: () => Promise.resolve(registration) });
    vi.stubGlobal('caches', cachesWith(2));

    await expect(checkOfflineReadiness()).resolves.toMatchObject({
      precachedEntries: 2,
      action: 'repair-requested',
    });
    expect(updateMock).toHaveBeenCalledOnce();
  });

  it('defers the repair — and touches the network not at all — while offline', async () => {
    const { updateMock, registration } = registrationStub();
    setNavigator('serviceWorker', { getRegistration: () => Promise.resolve(registration) });
    setNavigator('onLine', false);
    vi.stubGlobal('caches', cachesWith(0, []));

    const result = await checkOfflineReadiness();

    expect(result.action).toBe('repair-deferred');
    expect(updateMock).not.toHaveBeenCalled();
  });

  it('reports "repair-failed" without throwing when update() rejects', async () => {
    const { updateMock, registration } = registrationStub(() =>
      Promise.reject(new Error('blocked by policy'))
    );
    setNavigator('serviceWorker', { getRegistration: () => Promise.resolve(registration) });
    vi.stubGlobal('caches', cachesWith(0, []));

    await expect(checkOfflineReadiness()).resolves.toMatchObject({ action: 'repair-failed' });
    expect(updateMock).toHaveBeenCalledOnce();
  });

  it('reports "unknown" — not a repair — when Cache Storage is absent', async () => {
    const { updateMock, registration } = registrationStub();
    setNavigator('serviceWorker', { getRegistration: () => Promise.resolve(registration) });
    vi.stubGlobal('caches', undefined);

    const result = await checkOfflineReadiness();

    expect(result.action).toBe('unknown');
    // "We could not look" must stay distinguishable from "we looked and
    // it was empty", or a locked-down profile gets a pointless repair.
    expect(result.precachedEntries).toBeNull();
    expect(updateMock).not.toHaveBeenCalled();
  });

  it('reports "unknown" when Cache Storage rejects', async () => {
    const { updateMock, registration } = registrationStub();
    setNavigator('serviceWorker', { getRegistration: () => Promise.resolve(registration) });
    vi.stubGlobal('caches', { keys: () => Promise.reject(new Error('SecurityError')) });

    await expect(checkOfflineReadiness()).resolves.toMatchObject({
      action: 'unknown',
      precachedEntries: null,
    });
    expect(updateMock).not.toHaveBeenCalled();
  });

  it('reports "unknown" when one cache among several is unreadable', async () => {
    const { updateMock, registration } = registrationStub();
    setNavigator('serviceWorker', { getRegistration: () => Promise.resolve(registration) });
    vi.stubGlobal('caches', {
      keys: () => Promise.resolve([PRECACHE, `${PRECACHE}old`]),
      open: (name: string) =>
        name.endsWith('old')
          ? Promise.reject(new Error('InvalidStateError'))
          : Promise.resolve({ keys: () => Promise.resolve(new Array<Request>(90)) }),
    });

    await expect(checkOfflineReadiness()).resolves.toMatchObject({
      action: 'unknown',
      precachedEntries: null,
    });
    expect(updateMock).not.toHaveBeenCalled();
  });

  it('does not throw when getRegistration() itself rejects', async () => {
    setNavigator('serviceWorker', {
      getRegistration: () => Promise.reject(new Error('not allowed')),
    });
    vi.stubGlobal('caches', cachesWith(0, []));

    await expect(checkOfflineReadiness()).resolves.toMatchObject({
      registered: false,
      action: 'not-registered',
    });
  });

  it('ignores caches that are not the workbox precache', async () => {
    const { updateMock, registration } = registrationStub();
    setNavigator('serviceWorker', { getRegistration: () => Promise.resolve(registration) });
    vi.stubGlobal('caches', cachesWith(50, ['tp-studio-export-vendor-v1', 'tp-studio-pdf-v1']));

    const result = await checkOfflineReadiness();

    // Runtime caches being full says nothing about whether the app shell
    // itself would load offline.
    expect(result.precachedEntries).toBe(0);
    expect(result.action).toBe('repair-requested');
    expect(updateMock).toHaveBeenCalledOnce();
  });
});
