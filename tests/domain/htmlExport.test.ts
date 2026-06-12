import { describe, expect, it } from 'vitest';
import { exportToSelfContainedHTML } from '@/domain/htmlExport';
import type { Assumption, EntityId } from '@/domain/types';
import { makeDoc, makeEdge, makeEntity, resetIds } from './helpers';

/**
 * Session 77 / brief §11 — Self-contained HTML viewer export. The
 * generated file:
 *   - Is a single string (no external assets).
 *   - Embeds the source JSON as a base64 payload for round-trip.
 *   - Renders entity titles + types.
 *   - On EC docs, surfaces the verbalisation block.
 *   - HTML-escapes user-supplied text.
 */

describe('exportToSelfContainedHTML', () => {
  it('produces a single self-contained HTML string', () => {
    resetIds();
    const a = makeEntity({ type: 'effect', title: 'Hello world' });
    const doc = makeDoc([a], [], 'crt');
    const html = exportToSelfContainedHTML(doc);
    expect(html).toContain('<!doctype html>');
    expect(html).toContain('Hello world');
    expect(html).toContain('Read-only view');
    // No external <link> or <script src=>.
    expect(html).not.toMatch(/<link[^>]+href=/i);
    expect(html).not.toMatch(/<script[^>]+src=/i);
  });

  it('embeds the source document as a base64 payload', () => {
    resetIds();
    const a = makeEntity({ type: 'effect', title: 'Source' });
    const doc = makeDoc([a], [], 'crt');
    const html = exportToSelfContainedHTML(doc);
    expect(html).toContain('<script type="application/json" id="tp-studio-doc">');
  });

  it('HTML-escapes user-supplied entity titles to dodge XSS', () => {
    resetIds();
    const a = makeEntity({ type: 'effect', title: '<script>alert(1)</script>' });
    const doc = makeDoc([a], [], 'crt');
    const html = exportToSelfContainedHTML(doc);
    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
  });

  it('neutralises injected handlers/markup in title + description (no live vector survives)', () => {
    resetIds();
    // The exact payloads the sibling MindMap Studio export carried: an
    // onerror handler and a javascript: link. Here they reach the viewer as
    // escaped text in a title + a free-text description, so no attribute or
    // element is parsed out of them.
    const a = makeEntity({
      type: 'effect',
      title: '<img src=x onerror=alert(1)>',
      description: '<a href="javascript:alert(2)">click</a>',
    });
    const html = exportToSelfContainedHTML(makeDoc([a], [], 'crt'));
    // No live element or handler is parsed out of the payloads: the escaped
    // text legitimately still contains the characters "onerror=", but with the
    // angle brackets encoded it can never become an element that fires.
    expect(html).not.toContain('<img src=x');
    expect(html).not.toContain('href="javascript:');
    // The text is preserved — just escaped (visible, not executable).
    expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;');
    expect(html).toContain('&lt;a href=&quot;javascript:alert(2)&quot;&gt;');
  });

  it('builds the assumption status CSS class from a fixed allowlist (no class injection)', () => {
    resetIds();
    const a = makeEntity({ type: 'effect', title: 'E' });
    // A malformed status (cast past the `validateAssumption` allowlist) must
    // NOT reach the `class="status …"` attribute — `escapeHtml` escapes
    // < > " ' & but not spaces, so a value like `valid hax` would otherwise
    // inject a second CSS class. The lookup-table guard makes that impossible.
    const assumptions = {
      asm1: { id: 'asm1', edgeId: 'edge-x', text: 'maybe', status: 'valid hax' },
    } as unknown as Record<string, Assumption>;
    const doc = { ...makeDoc([a], [], 'crt'), assumptions };
    const html = exportToSelfContainedHTML(doc);
    // Class is the safe fallback; the raw value never reaches the attribute.
    expect(html).toContain('class="status unexamined"');
    expect(html).not.toContain('class="status valid hax"');
  });

  it('surfaces the verbalisation block on EC docs', () => {
    resetIds();
    const a = makeEntity({ type: 'goal', title: 'Objective A', ecSlot: 'a' });
    const b = makeEntity({ type: 'need', title: 'Need B', ecSlot: 'b' });
    const c = makeEntity({ type: 'need', title: 'Need C', ecSlot: 'c' });
    const d = makeEntity({ type: 'want', title: 'Want D', ecSlot: 'd' });
    const dPrime = makeEntity({ type: 'want', title: 'Want D-prime', ecSlot: 'dPrime' });
    const edges = [
      { ...makeEdge(b.id, a.id), kind: 'necessity' as const },
      { ...makeEdge(c.id, a.id), kind: 'necessity' as const },
      { ...makeEdge(d.id, b.id), kind: 'necessity' as const },
      { ...makeEdge(dPrime.id, c.id), kind: 'necessity' as const },
    ];
    const doc = makeDoc([a, b, c, d, dPrime], edges, 'ec');
    const html = exportToSelfContainedHTML(doc);
    expect(html).toContain('Verbalisation');
    expect(html).toContain('Objective A');
    expect(html).toContain('Want D-prime');
  });

  it('renders assumptions section when assumptions exist', () => {
    resetIds();
    const a = makeEntity({ type: 'ude' });
    const b = makeEntity({ type: 'rootCause' });
    const doc = makeDoc([a, b], [makeEdge(b.id, a.id)], 'crt');
    // Manually inject an Assumption record (the migration would create
    // this for any assumption-entity).
    const docWithAsm: typeof doc = {
      ...doc,
      assumptions: {
        asm1: {
          id: 'asm1',
          edgeId: Object.keys(doc.edges)[0]!,
          text: 'This relies on monthly NPS data',
          status: 'unexamined',
          createdAt: 0,
          updatedAt: 0,
        },
      },
    };
    const html = exportToSelfContainedHTML(docWithAsm);
    expect(html).toContain('Assumptions (1)');
    expect(html).toContain('This relies on monthly NPS data');
    expect(html).toContain('class="status unexamined"');
    void ({} as EntityId); // keep the import non-empty for the test file's typing pattern
  });

  it('embeds the preview PNG figure when `previewPng` is provided (Session 136)', () => {
    const doc = makeDoc([makeEntity({ type: 'ude', title: 'X' })], [], 'crt');
    // Tiny 1x1 transparent PNG data URL — enough to verify the embed
    // path; the real export captures the canvas via `html-to-image`.
    const tinyPng =
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkAAIAAAoAAv/lxKUAAAAASUVORK5CYII=';
    const html = exportToSelfContainedHTML(doc, { previewPng: tinyPng });
    expect(html).toContain('<figure class="preview">');
    expect(html).toContain(`src="${tinyPng}"`);
    expect(html).toContain('alt="Diagram preview"');
  });

  it('omits the preview figure when `previewPng` is not provided', () => {
    const doc = makeDoc([makeEntity({ type: 'ude', title: 'X' })], [], 'crt');
    const html = exportToSelfContainedHTML(doc);
    expect(html).not.toContain('<figure class="preview">');
  });
});
