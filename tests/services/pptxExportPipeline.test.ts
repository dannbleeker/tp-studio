import type { Node } from '@xyflow/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { METHOD_BY_DIAGRAM } from '@/domain/methodChecklist';
import { capturePngDataUrl } from '@/services/exporters/image';
import { exportPPTX } from '@/services/exporters/pptxExport';
import { makeDoc, makeEdge, makeEntity, resetIds } from '../domain/helpers';

/**
 * Session 177 — integration coverage for the `exportPPTX` entry point.
 *
 * The sibling `pptxExport.test.ts` covers the pure data-shaping helpers
 * (`chunkForTest`, `buildSentencesForTest`); this file drives the full deck
 * builder by mocking the two heavy side-effect dependencies — `pptxgenjs`
 * (a fake recording deck) and the canvas-capture (`capturePngDataUrl`) — so
 * every slide branch (cover, scope, visual, EC conflict, reasoning,
 * core-driver, checklist) runs in jsdom-free Node without a real renderer.
 */

const pptxMock = vi.hoisted(() => ({
  instances: [] as Array<{
    slides: Array<{
      texts: Array<{ text: unknown }>;
      shapes: unknown[];
      images: unknown[];
    }>;
    writeFileArgs: { fileName: string } | null;
  }>,
}));

vi.mock('pptxgenjs', () => {
  class MockSlide {
    background: unknown;
    texts: Array<{ text: unknown; opts: unknown }> = [];
    shapes: unknown[] = [];
    images: unknown[] = [];
    addShape(shape: unknown, opts: unknown): void {
      this.shapes.push({ shape, opts });
    }
    addText(text: unknown, opts: unknown): void {
      this.texts.push({ text, opts });
    }
    addImage(opts: unknown): void {
      this.images.push(opts);
    }
  }
  class MockPptxGenJS {
    layout = '';
    title = '';
    author = '';
    slides: MockSlide[] = [];
    writeFileArgs: { fileName: string } | null = null;
    constructor() {
      pptxMock.instances.push(this);
    }
    addSlide(): MockSlide {
      const s = new MockSlide();
      this.slides.push(s);
      return s;
    }
    writeFile(opts: { fileName: string }): Promise<string> {
      this.writeFileArgs = opts;
      return Promise.resolve(opts.fileName);
    }
  }
  return { default: MockPptxGenJS };
});

vi.mock('@/services/exporters/image', () => ({
  capturePngDataUrl: vi.fn(() => Promise.resolve('data:image/png;base64,AAA')),
}));

const mockCapture = vi.mocked(capturePngDataUrl);
const NODES = [] as never[] as Node[];

const lastDeck = () => {
  const inst = pptxMock.instances[pptxMock.instances.length - 1];
  if (!inst) throw new Error('no pptx instance recorded');
  return inst;
};
const allText = (): string =>
  lastDeck()
    .slides.flatMap((s) =>
      s.texts.map((t) => (typeof t.text === 'string' ? t.text : JSON.stringify(t.text)))
    )
    .join('\n');

beforeEach(() => {
  resetIds();
  pptxMock.instances.length = 0;
  mockCapture.mockReset();
  mockCapture.mockResolvedValue('data:image/png;base64,AAA');
});
afterEach(() => {
  vi.restoreAllMocks();
});

describe('exportPPTX — deck pipeline', () => {
  it('builds a multi-slide CRT deck, embeds the canvas image, and writes the file', async () => {
    const entities = Array.from({ length: 9 }, (_, i) => makeEntity({ title: `E${i}` }));
    const edges = entities
      .slice(0, -1)
      .map((_, i) => makeEdge(entities[i]!.id, entities[i + 1]!.id));
    const doc = makeDoc(entities, edges);
    doc.title = 'My CRT';
    doc.author = 'Dann';

    await exportPPTX(doc, NODES, 'auto');

    const deck = lastDeck();
    expect(deck.writeFileArgs?.fileName).toBe('my-crt.pptx');
    // cover + visual + ≥2 reasoning slides (8 sentences → 2 chunks of 7+1).
    expect(deck.slides.length).toBeGreaterThanOrEqual(4);
    expect(deck.slides.some((s) => s.images.length > 0)).toBe(true);
    // multi-chunk reasoning titles the slides "Reasoning (1 / 2)".
    expect(allText()).toContain('Reasoning (1 / 2)');
  });

  it('skips the visual slide when the canvas capture returns null', async () => {
    mockCapture.mockResolvedValue(null);
    const a = makeEntity({ title: 'A' });
    const b = makeEntity({ title: 'B' });
    const doc = makeDoc([a, b], [makeEdge(a.id, b.id)]);
    doc.title = 'No Canvas';

    await exportPPTX(doc, NODES, 'auto');

    expect(lastDeck().slides.some((s) => s.images.length > 0)).toBe(false);
    expect(lastDeck().writeFileArgs?.fileName).toBe('no-canvas.pptx');
  });

  it('survives a canvas-capture error and still writes the deck', async () => {
    mockCapture.mockRejectedValue(new Error('boom'));
    const a = makeEntity({ title: 'A' });
    const b = makeEntity({ title: 'B' });
    const doc = makeDoc([a, b], [makeEdge(a.id, b.id)]);

    await exportPPTX(doc, NODES, 'auto');

    expect(lastDeck().writeFileArgs).not.toBeNull();
    expect(lastDeck().slides.some((s) => s.images.length > 0)).toBe(false);
  });

  it('renders the EC conflict slide for a complete cloud', async () => {
    const goal = makeEntity({ title: 'Goal', type: 'goal' });
    const needB = makeEntity({ title: 'Need B', type: 'need' });
    const needC = makeEntity({ title: 'Need C', type: 'need' });
    const wantD = makeEntity({ title: 'Want D', type: 'want' });
    const wantDPrime = makeEntity({ title: "Want D'", type: 'want' });
    const doc = makeDoc([goal, needB, needC, wantD, wantDPrime], [], 'ec');

    await exportPPTX(doc, NODES, 'auto');

    expect(allText()).toContain('On the one hand');
  });

  it('falls back to the incomplete-cloud copy when the EC structure is partial', async () => {
    const goal = makeEntity({ title: 'Goal', type: 'goal' });
    const wantD = makeEntity({ title: 'Want D', type: 'want' });
    const doc = makeDoc([goal, wantD], [], 'ec');

    await exportPPTX(doc, NODES, 'auto');

    expect(allText()).toContain('Cloud structure incomplete');
  });

  it('adds a system-scope slide when at least one scope field is filled', async () => {
    const a = makeEntity({ title: 'A' });
    const doc = makeDoc([a], []);
    doc.systemScope = { goal: 'Reduce lead time', successMeasures: 'On-time %' };

    await exportPPTX(doc, NODES, 'auto');

    expect(allText()).toContain('System scope');
  });

  it('adds a method-checklist slide when a step is ticked', async () => {
    const a = makeEntity({ title: 'A' });
    const doc = makeDoc([a], []);
    const stepId = METHOD_BY_DIAGRAM.crt[0]?.id ?? 'step';
    doc.methodChecklist = { [stepId]: true };

    await exportPPTX(doc, NODES, 'auto');

    expect(allText()).toContain('Method checklist');
  });

  it('emits a placeholder reasoning slide when there are no edges', async () => {
    const doc = makeDoc([makeEntity({ title: 'Lonely' })], []);

    await exportPPTX(doc, NODES, 'auto');

    expect(allText()).toContain('No edges drawn yet');
  });

  it('shows the untitled-diagram cover when the doc has no title', async () => {
    const doc = makeDoc([makeEntity({ title: 'A' })], []);
    doc.title = '';

    await exportPPTX(doc, NODES, 'auto');

    expect(allText()).toContain('Untitled diagram');
  });

  it('adds a Core Driver slide for a CRT whose root cause reaches UDEs', async () => {
    // A structural leaf (no incoming) of an effect feeding two UDEs is the
    // Core Driver — exercises the CRT-only `findCoreDrivers().length > 0` slide
    // and the plural "UDEs" branch.
    const root = makeEntity({ title: 'Bottleneck' });
    const ude1 = makeEntity({ title: 'UDE one', type: 'ude' });
    const ude2 = makeEntity({ title: 'UDE two', type: 'ude' });
    const doc = makeDoc(
      [root, ude1, ude2],
      [makeEdge(root.id, ude1.id), makeEdge(root.id, ude2.id)]
    );

    await exportPPTX(doc, NODES, 'auto');

    expect(allText()).toContain('Likely Core Driver');
    expect(allText()).toContain('reaches 2 UDEs');
  });

  it('titles the reasoning slide "Reasoning" when it fits a single chunk', async () => {
    const a = makeEntity({ title: 'A' });
    const b = makeEntity({ title: 'B' });
    const c = makeEntity({ title: 'C' });
    const doc = makeDoc([a, b, c], [makeEdge(a.id, b.id), makeEdge(b.id, c.id)]);

    await exportPPTX(doc, NODES, 'auto');

    const text = allText();
    expect(text).toContain('Reasoning');
    expect(text).not.toContain('Reasoning (');
  });
});
