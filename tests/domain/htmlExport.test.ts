import { exportToSelfContainedHTML } from '@/domain/htmlExport';
import type { EntityId } from '@/domain/types';
import { describe, expect, it } from 'vitest';
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
});
