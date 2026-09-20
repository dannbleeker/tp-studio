// The Storage API is absent in jsdom, so every case here installs a
// synthetic `navigator.storage` and removes it again afterwards. The
// contract under test is that `requestPersistentStorage()` classifies
// each browser response correctly, asks at most once per page load, and
// never throws — the caller in `main.tsx` fires it and forgets it.

import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  __resetPersistentStorageForTest,
  requestPersistentStorage,
} from '@/services/pwa/persistentStorage';

type StorageStub = {
  persisted?: () => Promise<boolean>;
  persist?: () => Promise<boolean>;
};

function installStorage(stub: StorageStub | undefined): void {
  Object.defineProperty(navigator, 'storage', {
    value: stub,
    configurable: true,
    writable: true,
  });
}

afterEach(() => {
  __resetPersistentStorageForTest();
  installStorage(undefined);
  vi.restoreAllMocks();
});

describe('requestPersistentStorage', () => {
  it('reports "unsupported" when navigator.storage is missing', async () => {
    installStorage(undefined);
    await expect(requestPersistentStorage()).resolves.toBe('unsupported');
  });

  it('reports "unsupported" when the Storage API lacks persist()', async () => {
    // Older Safari ships `navigator.storage` with `estimate()` only.
    installStorage({ persisted: () => Promise.resolve(false) });
    await expect(requestPersistentStorage()).resolves.toBe('unsupported');
  });

  it('reports "already-persisted" without re-asking', async () => {
    const persist = vi.fn(() => Promise.resolve(true));
    installStorage({ persisted: () => Promise.resolve(true), persist });

    await expect(requestPersistentStorage()).resolves.toBe('already-persisted');
    expect(persist).not.toHaveBeenCalled();
  });

  it('reports "persisted" when the browser grants the request', async () => {
    installStorage({
      persisted: () => Promise.resolve(false),
      persist: () => Promise.resolve(true),
    });
    await expect(requestPersistentStorage()).resolves.toBe('persisted');
  });

  it('reports "denied" when the browser refuses', async () => {
    installStorage({
      persisted: () => Promise.resolve(false),
      persist: () => Promise.resolve(false),
    });
    await expect(requestPersistentStorage()).resolves.toBe('denied');
  });

  it('treats a rejecting Storage API as a refusal rather than throwing', async () => {
    installStorage({
      persisted: () => Promise.reject(new Error('insecure context')),
      persist: () => Promise.resolve(true),
    });
    await expect(requestPersistentStorage()).resolves.toBe('denied');
  });

  it('asks the browser only once, however many callers there are', async () => {
    const persisted = vi.fn(() => Promise.resolve(false));
    const persist = vi.fn(() => Promise.resolve(true));
    installStorage({ persisted, persist });

    const [a, b] = await Promise.all([requestPersistentStorage(), requestPersistentStorage()]);
    await requestPersistentStorage();

    expect([a, b]).toEqual(['persisted', 'persisted']);
    expect(persisted).toHaveBeenCalledOnce();
    expect(persist).toHaveBeenCalledOnce();
  });
});
