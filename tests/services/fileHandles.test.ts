import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  __resetHandleStoreForTests,
  getLinkedFile,
  linkFile,
  subscribeLinkChange,
  unlinkFile,
} from '@/services/storage/fileHandles';

/**
 * jsdom has no IndexedDB, so the store transparently uses its in-memory
 * fallback here — which is exactly the public-API contract we want to pin.
 * (The IndexedDB adapter is a thin standard-API wrapper exercised manually in
 * Chrome/Edge.) `__resetHandleStoreForTests` gives each case a fresh map.
 */

const fakeHandle = (name: string): FileSystemFileHandle =>
  ({ name }) as unknown as FileSystemFileHandle;

beforeEach(__resetHandleStoreForTests);

describe('fileHandles link store', () => {
  it('returns null for an unlinked document', async () => {
    expect(await getLinkedFile('doc-x')).toBeNull();
  });

  it('links a handle and reads it back with its name', async () => {
    await linkFile('doc-1', fakeHandle('budget.tps.json'));
    const linked = await getLinkedFile('doc-1');
    expect(linked?.name).toBe('budget.tps.json');
    expect(linked?.handle).toBeDefined();
  });

  it('keys links independently per document id', async () => {
    await linkFile('doc-1', fakeHandle('a.json'));
    await linkFile('doc-2', fakeHandle('b.json'));
    expect((await getLinkedFile('doc-1'))?.name).toBe('a.json');
    expect((await getLinkedFile('doc-2'))?.name).toBe('b.json');
  });

  it('overwrites an existing link', async () => {
    await linkFile('doc-1', fakeHandle('old.json'));
    await linkFile('doc-1', fakeHandle('new.json'));
    expect((await getLinkedFile('doc-1'))?.name).toBe('new.json');
  });

  it('unlinks a document', async () => {
    await linkFile('doc-1', fakeHandle('a.json'));
    await unlinkFile('doc-1');
    expect(await getLinkedFile('doc-1')).toBeNull();
  });

  it('notifies subscribers on link + unlink, and stops after unsubscribe', async () => {
    const listener = vi.fn();
    const unsubscribe = subscribeLinkChange(listener);
    await linkFile('doc-1', fakeHandle('a.json'));
    await unlinkFile('doc-1');
    expect(listener).toHaveBeenCalledTimes(2);
    unsubscribe();
    await linkFile('doc-2', fakeHandle('b.json'));
    expect(listener).toHaveBeenCalledTimes(2);
  });
});

// ── IndexedDB path tests ─────────────────────────────────────────────────────
//
// `createIdbStore` is the production path used in real Chromium browsers.
// jsdom has no IndexedDB, so we inject a lightweight hand-crafted
// IDBFactory/IDBDatabase/IDBObjectStore mock onto globalThis and then call
// `__resetHandleStoreForTests` to force getStore() to re-evaluate and pick up
// the fake factory rather than falling back to the memory Map.

/** Build a minimal IDB-alike factory whose in-memory data store mirrors the
 *  real IndexedDB contract that `createIdbStore` relies on. */
const buildFakeIdbFactory = () => {
  // Simple in-memory Map<key, value> backing the object store.
  const data = new Map<string, unknown>();

  const makeRequest = <T>(
    handler: (resolve: (v: T) => void, reject: (e: DOMException) => void) => void
  ): Record<string, unknown> => {
    const req: Record<string, unknown> = {
      result: undefined as unknown,
      error: null,
      onsuccess: null,
      onerror: null,
    };
    handler(
      (v) => {
        req.result = v;
        if (req.onsuccess) (req.onsuccess as () => void)();
      },
      (e) => {
        req.error = e;
        if (req.onerror) (req.onerror as () => void)();
      }
    );
    return req;
  };

  const objectStore = {
    get: (key: string) =>
      makeRequest<unknown>((resolve) => {
        // Schedule on the next microtask so onsuccess is always set first,
        // matching real IndexedDB async behaviour.
        Promise.resolve().then(() => resolve(data.get(key)));
      }),
    put: (value: unknown, key: string) =>
      makeRequest<string>((resolve) => {
        Promise.resolve().then(() => {
          data.set(key, value);
          resolve(key);
        });
      }),
    delete: (key: string) =>
      makeRequest<undefined>((resolve) => {
        Promise.resolve().then(() => {
          data.delete(key);
          resolve(undefined);
        });
      }),
  };

  const objectStoreNames = { contains: (_name: string) => true };

  const database = {
    objectStoreNames,
    transaction: (_storeNames: string, _mode: string) => ({
      objectStore: (_name: string) => objectStore,
    }),
  };

  const openRequest: Record<string, unknown> = {
    result: database,
    error: null,
    onsuccess: null,
    onerror: null,
    onupgradeneeded: null,
  };

  const factory = {
    open: (_name: string, _version: number) => {
      // Fire onupgradeneeded synchronously (mirrors how the browser fires it
      // before onsuccess on the very first open), then onsuccess on the next tick.
      Promise.resolve().then(() => {
        if (openRequest.onupgradeneeded) (openRequest.onupgradeneeded as () => void)();
        if (openRequest.onsuccess) (openRequest.onsuccess as () => void)();
      });
      return openRequest;
    },
  } as unknown as IDBFactory;

  return { factory, data };
};

/** Build a factory whose open() fires onerror instead. */
const buildErrorIdbFactory = (errorMessage = 'IDB open failed') => {
  const openRequest: Record<string, unknown> = {
    result: null,
    error: new DOMException(errorMessage),
    onsuccess: null,
    onerror: null,
    onupgradeneeded: null,
  };
  const factory = {
    open: () => {
      Promise.resolve().then(() => {
        if (openRequest.onerror) (openRequest.onerror as () => void)();
      });
      return openRequest;
    },
  } as unknown as IDBFactory;
  return factory;
};

describe('fileHandles — IndexedDB store path (createIdbStore)', () => {
  const g = globalThis as { indexedDB?: IDBFactory };

  afterEach(() => {
    delete g.indexedDB;
    __resetHandleStoreForTests();
  });

  it('uses the IDB store when globalThis.indexedDB is present', async () => {
    const { factory, data } = buildFakeIdbFactory();
    g.indexedDB = factory;
    __resetHandleStoreForTests(); // force re-evaluation with the fake factory

    await linkFile('idb-doc-1', fakeHandle('idb-file.json'));
    // The value must be persisted in our fake data store
    expect(data.has('idb-doc-1')).toBe(true);
    const stored = data.get('idb-doc-1') as { name: string };
    expect(stored.name).toBe('idb-file.json');
  });

  it('round-trips a linked file through the IDB store (get returns what was set)', async () => {
    const { factory } = buildFakeIdbFactory();
    g.indexedDB = factory;
    __resetHandleStoreForTests();

    const h = fakeHandle('round-trip.json');
    await linkFile('doc-rt', h);
    const linked = await getLinkedFile('doc-rt');
    expect(linked).not.toBeNull();
    expect(linked?.name).toBe('round-trip.json');
    expect(linked?.handle).toBe(h);
  });

  it('returns null via IDB store for a key that was never set', async () => {
    const { factory } = buildFakeIdbFactory();
    g.indexedDB = factory;
    __resetHandleStoreForTests();

    expect(await getLinkedFile('no-such-doc')).toBeNull();
  });

  it('removes a linked file via the IDB store', async () => {
    const { factory } = buildFakeIdbFactory();
    g.indexedDB = factory;
    __resetHandleStoreForTests();

    await linkFile('doc-del', fakeHandle('will-be-deleted.json'));
    expect(await getLinkedFile('doc-del')).not.toBeNull();

    await unlinkFile('doc-del');
    expect(await getLinkedFile('doc-del')).toBeNull();
  });

  it('overwrites an existing IDB entry', async () => {
    const { factory } = buildFakeIdbFactory();
    g.indexedDB = factory;
    __resetHandleStoreForTests();

    await linkFile('doc-ow', fakeHandle('first.json'));
    await linkFile('doc-ow', fakeHandle('second.json'));
    expect((await getLinkedFile('doc-ow'))?.name).toBe('second.json');
  });

  it('reuses the lazy dbPromise singleton across multiple operations', async () => {
    const { factory } = buildFakeIdbFactory();
    const openSpy = vi.spyOn(factory, 'open');
    g.indexedDB = factory;
    __resetHandleStoreForTests();

    // Trigger two IDB operations — open() must only be called once.
    await linkFile('doc-s1', fakeHandle('s1.json'));
    await getLinkedFile('doc-s1');
    expect(openSpy).toHaveBeenCalledTimes(1);
  });

  it('notifies change listeners even when backed by IDB', async () => {
    const { factory } = buildFakeIdbFactory();
    g.indexedDB = factory;
    __resetHandleStoreForTests();

    const listener = vi.fn();
    const unsubscribe = subscribeLinkChange(listener);
    await linkFile('doc-notify', fakeHandle('n.json'));
    await unlinkFile('doc-notify');
    expect(listener).toHaveBeenCalledTimes(2);
    unsubscribe();
  });
});

describe('fileHandles — openDb upgrade path (object store does not exist yet)', () => {
  const g = globalThis as { indexedDB?: IDBFactory };

  afterEach(() => {
    delete g.indexedDB;
    __resetHandleStoreForTests();
  });

  it('creates the object store during onupgradeneeded when it is absent', async () => {
    // Build a factory where objectStoreNames.contains() returns false, so
    // the upgrade branch calls createObjectStore.
    const createObjectStore = vi.fn();
    const data = new Map<string, unknown>();

    const objectStore = {
      get: (key: string) => {
        const req: Record<string, unknown> = { result: undefined, error: null, onsuccess: null };
        Promise.resolve().then(() => {
          req.result = data.get(key);
          if (req.onsuccess) (req.onsuccess as () => void)();
        });
        return req;
      },
      put: (value: unknown, key: string) => {
        const req: Record<string, unknown> = { result: key, error: null, onsuccess: null };
        Promise.resolve().then(() => {
          data.set(key, value);
          if (req.onsuccess) (req.onsuccess as () => void)();
        });
        return req;
      },
      delete: (key: string) => {
        const req: Record<string, unknown> = { result: undefined, error: null, onsuccess: null };
        Promise.resolve().then(() => {
          data.delete(key);
          if (req.onsuccess) (req.onsuccess as () => void)();
        });
        return req;
      },
    };

    const upgradeDb = {
      objectStoreNames: { contains: () => false }, // triggers createObjectStore
      createObjectStore,
      transaction: () => ({ objectStore: () => objectStore }),
    };

    const runtimeDb = {
      objectStoreNames: { contains: () => true },
      transaction: () => ({ objectStore: () => objectStore }),
    };

    const openRequest: Record<string, unknown> = {
      result: upgradeDb,
      error: null,
      onsuccess: null,
      onerror: null,
      onupgradeneeded: null,
    };

    const factory = {
      open: () => {
        Promise.resolve().then(() => {
          // Fire onupgradeneeded with the upgrade DB, then onsuccess with the
          // normal runtime DB (mirrors the real IDB open sequence).
          if (openRequest.onupgradeneeded) (openRequest.onupgradeneeded as () => void)();
          openRequest.result = runtimeDb;
          if (openRequest.onsuccess) (openRequest.onsuccess as () => void)();
        });
        return openRequest;
      },
    } as unknown as IDBFactory;

    g.indexedDB = factory;
    __resetHandleStoreForTests();

    await linkFile('upgrade-doc', fakeHandle('upgrade.json'));
    expect(createObjectStore).toHaveBeenCalledWith('linkedFiles');
  });
});

describe('fileHandles — openDb error path (IDB open rejects)', () => {
  const g = globalThis as { indexedDB?: IDBFactory };

  afterEach(() => {
    delete g.indexedDB;
    __resetHandleStoreForTests();
  });

  it('rejects when IDB open fires onerror', async () => {
    const factory = buildErrorIdbFactory('quota exceeded');
    g.indexedDB = factory;
    __resetHandleStoreForTests();

    await expect(getLinkedFile('any-doc')).rejects.toThrow();
  });

  it('rejects linkFile when IDB open fires onerror', async () => {
    const factory = buildErrorIdbFactory('permission denied');
    g.indexedDB = factory;
    __resetHandleStoreForTests();

    await expect(linkFile('any-doc', fakeHandle('x.json'))).rejects.toThrow();
  });
});

describe('fileHandles — promisifyRequest error branch', () => {
  const g = globalThis as { indexedDB?: IDBFactory };

  afterEach(() => {
    delete g.indexedDB;
    __resetHandleStoreForTests();
  });

  it('rejects when an IDB operation fires onerror on the request', async () => {
    // DB opens successfully, but the get() request fires onerror.
    const badRequest: Record<string, unknown> = {
      result: undefined,
      error: new DOMException('read error'),
      onsuccess: null,
      onerror: null,
    };

    const objectStore = {
      get: () => {
        Promise.resolve().then(() => {
          if (badRequest.onerror) (badRequest.onerror as () => void)();
        });
        return badRequest;
      },
    };

    const database = {
      objectStoreNames: { contains: () => true },
      transaction: () => ({ objectStore: () => objectStore }),
    };

    const openRequest: Record<string, unknown> = {
      result: database,
      error: null,
      onsuccess: null,
      onerror: null,
      onupgradeneeded: null,
    };

    const factory = {
      open: () => {
        Promise.resolve().then(() => {
          if (openRequest.onsuccess) (openRequest.onsuccess as () => void)();
        });
        return openRequest;
      },
    } as unknown as IDBFactory;

    g.indexedDB = factory;
    __resetHandleStoreForTests();

    await expect(getLinkedFile('any-doc')).rejects.toThrow('read error');
  });
});
