/**
 * Persistent link from a document to the on-disk file it was last saved to /
 * opened from, so **"Save to file" can re-write the SAME file** without
 * re-showing the OS picker. PURELY ADDITIVE convenience on top of the File
 * System Access feature — nothing depends on a link existing, and the rest of
 * persistence (localStorage auto-save) is untouched.
 *
 * Why IndexedDB: a `FileSystemFileHandle` is structured-cloneable but NOT
 * JSON-serialisable, so it can't live in localStorage. IndexedDB is the only
 * web store that can persist a handle across reloads. This is the app's *only*
 * IndexedDB use.
 *
 * Test / non-Chromium fallback: when `indexedDB` is unavailable (jsdom, SSR,
 * Firefox/Safari) the store transparently degrades to an in-memory `Map`, so
 * the public API always resolves and never throws. Links just don't survive a
 * reload there — moot, since those environments can't pick a file to begin
 * with (the palette commands are Chromium-gated).
 */

export type LinkedFile = { handle: FileSystemFileHandle; name: string };

type HandleStore = {
  get(docId: string): Promise<LinkedFile | null>;
  set(docId: string, value: LinkedFile): Promise<void>;
  remove(docId: string): Promise<void>;
};

const DB_NAME = 'tp-studio-files';
const STORE_NAME = 'linkedFiles';
const DB_VERSION = 1;

const promisifyRequest = <T>(request: IDBRequest<T>): Promise<T> =>
  new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

const openDb = (factory: IDBFactory): Promise<IDBDatabase> =>
  new Promise((resolve, reject) => {
    const request = factory.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME)) {
        request.result.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

const createIdbStore = (factory: IDBFactory): HandleStore => {
  let dbPromise: Promise<IDBDatabase> | null = null;
  const db = (): Promise<IDBDatabase> => {
    dbPromise ??= openDb(factory);
    return dbPromise;
  };
  const run = async <T>(
    mode: IDBTransactionMode,
    op: (store: IDBObjectStore) => IDBRequest<T>
  ): Promise<T> => {
    const database = await db();
    return promisifyRequest(op(database.transaction(STORE_NAME, mode).objectStore(STORE_NAME)));
  };
  return {
    get: async (docId) =>
      (await run<LinkedFile | undefined>('readonly', (s) => s.get(docId))) ?? null,
    set: async (docId, value) => {
      await run('readwrite', (s) => s.put(value, docId));
    },
    remove: async (docId) => {
      await run('readwrite', (s) => s.delete(docId));
    },
  };
};

const createMemoryStore = (): HandleStore => {
  const map = new Map<string, LinkedFile>();
  return {
    get: async (docId) => map.get(docId) ?? null,
    set: async (docId, value) => {
      map.set(docId, value);
    },
    remove: async (docId) => {
      map.delete(docId);
    },
  };
};

let store: HandleStore | null = null;
const getStore = (): HandleStore => {
  if (!store) {
    const factory = (globalThis as { indexedDB?: IDBFactory }).indexedDB ?? null;
    store = factory ? createIdbStore(factory) : createMemoryStore();
  }
  return store;
};

/** Reset the lazily-built store between tests (mirrors `__reset*ForTests`
 *  elsewhere) so each case starts with a fresh in-memory map. */
export const __resetHandleStoreForTests = (): void => {
  store = null;
};

// ── Change notification ──────────────────────────────────────────────
// A tiny pub/sub so the "linked file" title chip can refresh the moment a
// save links a file or a clear unlinks one — without routing the async
// IndexedDB state through the Zustand store.
const listeners = new Set<() => void>();

/** Subscribe to link/unlink changes. Returns an unsubscribe fn. */
export const subscribeLinkChange = (listener: () => void): (() => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

const notify = (): void => {
  for (const listener of [...listeners]) listener();
};

/** Remember the file `handle` for `docId` (overwrites any previous link). */
export const linkFile = async (docId: string, handle: FileSystemFileHandle): Promise<void> => {
  await getStore().set(docId, { handle, name: handle.name });
  notify();
};

/** The file linked to `docId`, or `null` if none. */
export const getLinkedFile = (docId: string): Promise<LinkedFile | null> => getStore().get(docId);

/** Forget the file linked to `docId` (no-op if there was none). */
export const unlinkFile = async (docId: string): Promise<void> => {
  await getStore().remove(docId);
  notify();
};
