/**
 * §—PWA file handler. A double-clicked Flying Logic file (`.xlogic` / `.logicx` /
 * `.logic`) arrives on `window.launchQueue`; the consumer imports it via
 * `importFromFlyingLogic` and opens it in a new tab. These tests drive the
 * consumer directly with fake file handles.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createDocument } from '@/domain/factory';
import { exportToFlyingLogic } from '@/domain/flyingLogic';
import { registerLaunchFileHandler } from '@/services/pwa/fileHandlers';
import { resetStoreForTest, useDocumentStore } from '@/store';

const s = () => useDocumentStore.getState();

type Consumer = (params: { files?: unknown[] }) => void | Promise<void>;
let consumer: Consumer | null = null;

const installLaunchQueue = () => {
  consumer = null;
  (window as unknown as { launchQueue?: unknown }).launchQueue = {
    setConsumer: (c: Consumer) => {
      consumer = c;
    },
  };
};

const fakeHandle = (name: string, text: string) => ({
  name,
  getFile: async () => new File([text], name, { type: 'application/xml' }),
});

beforeEach(() => {
  resetStoreForTest();
  localStorage.clear();
});
afterEach(() => {
  (window as unknown as { launchQueue?: unknown }).launchQueue = undefined;
});

describe('PWA file handler — Flying Logic double-click', () => {
  it('is a no-op when the File Handling API is absent', () => {
    (window as unknown as { launchQueue?: unknown }).launchQueue = undefined;
    expect(() => registerLaunchFileHandler()).not.toThrow();
  });

  it('opens a launched Flying Logic file in a new tab', async () => {
    installLaunchQueue();
    registerLaunchFileHandler();
    expect(consumer).toBeTypeOf('function');

    const xml = exportToFlyingLogic(createDocument('crt'));
    const before = s().tabOrder.length;
    await consumer?.({ files: [fakeHandle('plan.xlogic', xml)] });

    expect(s().tabOrder.length).toBe(before + 1);
    expect(s().toasts.some((t) => t.kind === 'success' && t.message.includes('plan.xlogic'))).toBe(
      true
    );
  });

  it('toasts an error for a file that is not a valid Flying Logic document', async () => {
    installLaunchQueue();
    registerLaunchFileHandler();
    const before = s().tabOrder.length;
    await consumer?.({ files: [fakeHandle('junk.xlogic', '<notFlyingLogic/>')] });

    expect(s().tabOrder.length).toBe(before); // nothing opened
    expect(s().toasts.some((t) => t.kind === 'error' && t.message.includes('junk.xlogic'))).toBe(
      true
    );
  });

  it('ignores a launch with no files', async () => {
    installLaunchQueue();
    registerLaunchFileHandler();
    const before = s().tabOrder.length;
    await consumer?.({ files: [] });
    expect(s().tabOrder.length).toBe(before);
  });
});
