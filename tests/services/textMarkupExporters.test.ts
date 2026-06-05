import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  exportDOT,
  exportMermaid,
  exportOPML,
  exportReasoningNarrativeMd,
  exportReasoningOutlineMd,
  exportVGL,
} from '@/services/exporters/markup';
import { triggerDownload } from '@/services/exporters/shared';
import {
  exportAnnotationsMd,
  exportAnnotationsTxt,
  exportCSV,
  exportJSON,
} from '@/services/exporters/text';
import { makeDoc, makeEdge, makeEntity, resetIds } from '../domain/helpers';

// Mock only the browser-download side-effect; slug + everything else run real, so
// the tests pin the real filename, MIME type, and exported content for each wrapper.
vi.mock('@/services/exporters/shared', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/services/exporters/shared')>()),
  triggerDownload: vi.fn(),
}));

const mockTrigger = vi.mocked(triggerDownload);

const buildDoc = () => {
  const a = makeEntity({ title: 'Forecast lags orders' });
  const b = makeEntity({ title: 'Inventory turns drop' });
  const doc = makeDoc([a, b], [makeEdge(a.id, b.id)]);
  doc.title = 'My CRT';
  return doc;
};

const lastDownload = () => {
  const call = mockTrigger.mock.calls.at(-1);
  if (!call) throw new Error('triggerDownload was not called');
  return { blob: call[0] as Blob, filename: call[1] as string };
};

beforeEach(() => {
  resetIds();
  mockTrigger.mockClear();
});
afterEach(() => {
  vi.restoreAllMocks();
});

describe('text-format export wrappers', () => {
  it('exportJSON downloads a round-trippable .tps.json', async () => {
    exportJSON(buildDoc());
    const { blob, filename } = lastDownload();
    expect(filename).toBe('my-crt.tps.json');
    expect(blob.type).toContain('application/json');
    expect(JSON.parse(await blob.text()).title).toBe('My CRT');
  });

  it('exportCSV downloads a .csv with the header row', async () => {
    exportCSV(buildDoc());
    const { blob, filename } = lastDownload();
    expect(filename).toBe('my-crt.csv');
    expect(blob.type).toContain('text/csv');
    expect(await blob.text()).toContain('kind,id,type,title');
  });

  it('exportAnnotationsMd downloads a markdown annotations file', () => {
    exportAnnotationsMd(buildDoc());
    const { blob, filename } = lastDownload();
    expect(filename).toBe('my-crt-annotations.md');
    expect(blob.type).toContain('text/markdown');
    expect(blob.size).toBeGreaterThan(0);
  });

  it('exportAnnotationsTxt downloads a plain-text annotations file', () => {
    exportAnnotationsTxt(buildDoc());
    const { blob, filename } = lastDownload();
    expect(filename).toBe('my-crt-annotations.txt');
    expect(blob.type).toContain('text/plain');
    expect(blob.size).toBeGreaterThan(0);
  });
});

describe('markup-format export wrappers', () => {
  it('exportOPML downloads an .opml outline', async () => {
    exportOPML(buildDoc());
    const { blob, filename } = lastDownload();
    expect(filename).toBe('my-crt.opml');
    expect(blob.type).toContain('opml');
    expect(await blob.text()).toContain('<opml');
  });

  it('exportDOT downloads a Graphviz .dot', async () => {
    exportDOT(buildDoc());
    const { blob, filename } = lastDownload();
    expect(filename).toBe('my-crt.dot');
    expect(blob.type).toContain('graphviz');
    expect(await blob.text()).toMatch(/digraph|graph/);
  });

  it('exportMermaid downloads a .mmd', async () => {
    exportMermaid(buildDoc());
    const { blob, filename } = lastDownload();
    expect(filename).toBe('my-crt.mmd');
    expect(await blob.text()).toMatch(/graph|flowchart/);
  });

  it('exportVGL downloads a .vgl', () => {
    exportVGL(buildDoc());
    const { blob, filename } = lastDownload();
    expect(filename).toBe('my-crt.vgl');
    expect(blob.size).toBeGreaterThan(0);
  });

  it('exportReasoningNarrativeMd downloads a -reasoning.md', () => {
    exportReasoningNarrativeMd(buildDoc());
    const { blob, filename } = lastDownload();
    expect(filename).toBe('my-crt-reasoning.md');
    expect(blob.type).toContain('text/markdown');
  });

  it('exportReasoningOutlineMd downloads a -reasoning-outline.md', () => {
    exportReasoningOutlineMd(buildDoc());
    const { blob, filename } = lastDownload();
    expect(filename).toBe('my-crt-reasoning-outline.md');
    expect(blob.type).toContain('text/markdown');
  });
});
