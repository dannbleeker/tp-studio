import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildExampleCRT } from '@/domain/examples/crt';
import { exportFlyingLogic, pickFlyingLogic } from '@/services/exporters/flyingLogic';

/**
 * The Flying Logic exporter/import-picker is a thin browser-file wrapper over the
 * domain round-trip (`@/domain/flyingLogic`, tested separately). These tests pin
 * the wrapper: `exportFlyingLogic` produces a `.logicx` XML blob, and
 * `pickFlyingLogic` opens the picker with the Flying Logic extensions. Both DOM
 * boundaries (`triggerDownload`, `pickFile`) are stubbed.
 */

let lastBlob: Blob | null = null;
let lastFilename: string | null = null;
vi.mock('@/services/exporters/shared', async () => {
  const actual = await vi.importActual<typeof import('@/services/exporters/shared')>(
    '@/services/exporters/shared'
  );
  return {
    ...actual,
    triggerDownload: (blob: Blob, filename: string) => {
      lastBlob = blob;
      lastFilename = filename;
    },
  };
});

let pickerOpts: { accept?: string; label?: string } | null = null;
vi.mock('@/services/exporters/picker', async () => {
  const actual = await vi.importActual<typeof import('@/services/exporters/picker')>(
    '@/services/exporters/picker'
  );
  return {
    ...actual,
    pickFile: (opts: { accept?: string; label?: string }) => {
      pickerOpts = opts;
      return Promise.resolve(null);
    },
  };
});

afterEach(() => {
  lastBlob = null;
  lastFilename = null;
  pickerOpts = null;
});

describe('exportFlyingLogic', () => {
  it('downloads a .logicx XML blob built from the document', async () => {
    exportFlyingLogic(buildExampleCRT());
    expect(lastBlob?.type).toBe('application/xml');
    expect(lastFilename).toMatch(/\.logicx$/);
    const text = (await lastBlob?.text()) ?? '';
    expect(text).toContain('<'); // real XML markup
    expect(text.length).toBeGreaterThan(50);
  });
});

describe('pickFlyingLogic', () => {
  it('opens the picker accepting the Flying Logic extensions', async () => {
    await pickFlyingLogic();
    expect(pickerOpts?.accept).toContain('.logicx');
    expect(pickerOpts?.label).toBe('Flying Logic');
  });
});
