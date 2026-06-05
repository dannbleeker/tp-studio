// @vitest-environment jsdom
import type { Node } from '@xyflow/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { exportJPEG, exportPNG, exportSVG } from '@/services/exporters/image';
import { triggerDataUrlDownload } from '@/services/exporters/shared';
import { makeDoc, makeEntity, resetIds } from '../domain/helpers';

// The existing imageExporters.test covers the null/early-return paths; this covers
// the SUCCESS path — mock html-to-image + the download side-effect so the real
// prepareExport (bounds + viewport + theme) runs end-to-end without a real canvas.
vi.mock('html-to-image', () => ({
  toPng: vi.fn(async () => 'data:image/png;base64,AAA'),
  toJpeg: vi.fn(async () => 'data:image/jpeg;base64,BBB'),
  toSvg: vi.fn(async () => 'data:image/svg+xml;base64,CCC'),
}));
vi.mock('@/services/exporters/shared', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/services/exporters/shared')>()),
  triggerDataUrlDownload: vi.fn(),
}));

const mockDownload = vi.mocked(triggerDataUrlDownload);
const nodes = [
  {
    id: 'a',
    type: 'tp',
    position: { x: 0, y: 0 },
    width: 100,
    height: 50,
    measured: { width: 100, height: 50 },
    data: {},
  },
] as unknown as Node[];

const doc = () => {
  const d = makeDoc([makeEntity()], []);
  d.title = 'My CRT';
  return d;
};

beforeEach(() => {
  resetIds();
  mockDownload.mockClear();
  document.body.innerHTML = '<div class="react-flow__viewport"></div>';
});
afterEach(() => {
  vi.restoreAllMocks();
});

describe('image exporters — success path', () => {
  it('exportPNG downloads a .png from the captured viewport', async () => {
    await exportPNG(doc(), nodes);
    expect(mockDownload).toHaveBeenCalledWith(
      expect.stringContaining('data:image/png'),
      'my-crt.png'
    );
  });

  it('exportJPEG downloads a .jpg', async () => {
    await exportJPEG(doc(), nodes);
    expect(mockDownload).toHaveBeenCalledWith(expect.stringContaining('image/jpeg'), 'my-crt.jpg');
  });

  it('exportSVG downloads a .svg', async () => {
    await exportSVG(doc(), nodes);
    expect(mockDownload).toHaveBeenCalledWith(expect.any(String), 'my-crt.svg');
  });

  it('no-ops with no nodes (nothing to capture)', async () => {
    await exportPNG(doc(), []);
    expect(mockDownload).not.toHaveBeenCalled();
  });

  it('no-ops when the viewport element is absent', async () => {
    document.body.innerHTML = '';
    await exportPNG(doc(), nodes);
    expect(mockDownload).not.toHaveBeenCalled();
  });
});
