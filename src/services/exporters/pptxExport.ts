import type { Node } from '@xyflow/react';
import type PptxGenJSDefault from 'pptxgenjs';
import { findCoreDrivers } from '@/domain/coreDriver';
import {
  renderEdgeSentence,
  resolveEdgeConnector,
  topologicalEdgeOrder,
} from '@/domain/edgeReading';
import { ENTITY_TYPE_META } from '@/domain/entityTypeMeta';
import { entitiesOfType, isAssumption } from '@/domain/graph';
import { METHOD_BY_DIAGRAM } from '@/domain/methodChecklist';
import type { TPDocument } from '@/domain/types';
import type { CausalityLabel } from '@/store/uiSlice/types';
import { capturePngDataUrl } from './image';
import { slug } from './shared';

/**
 * Session 134 — PowerPoint deck export (closes major gap #10 from the
 * spec gap analysis).
 *
 * The spec called out PowerPoint as a target workshop-deck format. The
 * existing reasoning-export already produces the right *content*
 * (preamble + edge sentences + Core Driver / EC conflict appendix);
 * this exporter wraps that content in a deck shape, with one slide
 * per major section and a canvas screenshot embedded on its own
 * "visual" slide so the audience sees both the picture and the
 * verbal narrative.
 *
 * Lazy-imported: `pptxgenjs` is ~300 KB; loaded only when the user
 * actually invokes this export. Same pattern as `jspdf` /
 * `html-to-image` elsewhere.
 *
 * Brand: indigo accent on dark cover band, light-on-white content
 * slides, system font. Workshop-projection friendly; matches the
 * book + TP Studio canvas indigo.
 */

const INDIGO = '6366F1';
const INDIGO_DARK = '4338CA';
const TEXT_DARK = '111827';
const TEXT_MUTED = '4B5563';
const TEXT_LIGHT = '9CA3AF';
const PANEL_BG = 'F3F4F6';
const WHITE = 'FFFFFF';

const FONT_FACE = 'Segoe UI'; // Common Windows-default that maps to system-ui on macOS

const DIAGRAM_LABELS: Record<TPDocument['diagramType'], string> = {
  crt: 'Current Reality Tree',
  frt: 'Future Reality Tree',
  prt: 'Prerequisite Tree',
  tt: 'Transition Tree',
  ec: 'Evaporating Cloud',
  st: 'Strategy & Tactics Tree',
  goalTree: 'Goal Tree',
  freeform: 'Freeform Diagram',
  nbr: 'Negative Branch Reservation',
};

/**
 * Group edge sentences into chunks of N for paginated bullet slides.
 * 7 fits comfortably on a 16:9 slide with room for the title above.
 */
const SENTENCES_PER_SLIDE = 7;

/** Exposed for tests. Slice an array into fixed-size chunks (final chunk may be shorter). */
export const chunkForTest = <T>(arr: T[], size: number): T[][] => {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
};

const chunk = chunkForTest;

/**
 * Walk the doc and produce the deck's narrative sentences. Mirrors the
 * loop inside `exportReasoningNarrative` but returns the array directly
 * (no Markdown framing) so the deck can lay it out slide-by-slide.
 * Exposed (under a `*ForTest` alias) for unit tests.
 */
export const buildSentencesForTest = (doc: TPDocument, label: CausalityLabel): string[] => {
  const order = topologicalEdgeOrder(doc);
  const sentences: string[] = [];
  for (const eid of order) {
    const e = doc.edges[eid];
    if (!e) continue;
    const src = doc.entities[e.sourceId];
    const tgt = doc.entities[e.targetId];
    if (!src || !tgt || isAssumption(src) || isAssumption(tgt)) continue;
    const connector = resolveEdgeConnector(e, label, doc.diagramType);
    sentences.push(renderEdgeSentence(src, tgt, connector));
  }
  return sentences;
};

const buildSentences = buildSentencesForTest;

const formatAuthor = (doc: TPDocument): string => {
  const author = doc.author?.trim();
  return author ? `by ${author}` : '';
};

const formatDate = (): string =>
  new Date().toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });

/**
 * Build the deck and trigger a browser download. Returns once the
 * download is initiated; rejects with a toast-friendly Error if
 * pptxgenjs fails to load or the canvas capture errors.
 */
export const exportPPTX = async (
  doc: TPDocument,
  nodes: Node[],
  causalityLabel: CausalityLabel
): Promise<void> => {
  // Lazy-load pptxgenjs only when the user actually invokes this path.
  const { default: PptxGenJS } = await import('pptxgenjs');
  const pptx = new PptxGenJS();
  pptx.layout = 'LAYOUT_WIDE'; // 13.333 x 7.5 in (16:9)
  pptx.title = doc.title;
  if (doc.author) pptx.author = doc.author;

  // ─── Cover slide ─────────────────────────────────────────────────────
  {
    const slide = pptx.addSlide();
    // Left indigo band — visual weight + brand colour.
    slide.background = { color: WHITE };
    slide.addShape('rect', { x: 0, y: 0, w: 4.5, h: 7.5, fill: { color: INDIGO_DARK } });
    slide.addShape('rect', { x: 4.5, y: 0, w: 0.04, h: 7.5, fill: { color: INDIGO } });

    slide.addText('TP Studio', {
      x: 0.5,
      y: 0.5,
      w: 3.5,
      h: 0.5,
      fontSize: 11,
      fontFace: FONT_FACE,
      color: 'C7D2FE',
      bold: true,
      charSpacing: 4,
    });
    slide.addText(doc.title || 'Untitled diagram', {
      x: 0.5,
      y: 2.4,
      w: 3.5,
      h: 2.2,
      fontSize: 32,
      fontFace: FONT_FACE,
      color: WHITE,
      bold: true,
      valign: 'top',
    });
    slide.addText(DIAGRAM_LABELS[doc.diagramType], {
      x: 0.5,
      y: 4.8,
      w: 3.5,
      h: 0.5,
      fontSize: 14,
      fontFace: FONT_FACE,
      color: 'C7D2FE',
      italic: true,
    });

    const meta = [formatAuthor(doc), formatDate()].filter(Boolean).join('  ·  ');
    if (meta) {
      slide.addText(meta, {
        x: 0.5,
        y: 6.7,
        w: 3.5,
        h: 0.4,
        fontSize: 10,
        fontFace: FONT_FACE,
        color: 'A5B4FC',
      });
    }

    // Right side: subtitle copy that sets up the deck.
    slide.addText('Reasoning workbook', {
      x: 5.0,
      y: 2.4,
      w: 7.5,
      h: 0.5,
      fontSize: 12,
      fontFace: FONT_FACE,
      color: TEXT_MUTED,
      bold: true,
      charSpacing: 4,
    });
    slide.addText(
      'A narrative walk-through of every cause-and-effect step in this diagram, plus the diagram itself for at-a-glance reference.',
      {
        x: 5.0,
        y: 3.0,
        w: 7.5,
        h: 2.0,
        fontSize: 16,
        fontFace: FONT_FACE,
        color: TEXT_DARK,
        valign: 'top',
      }
    );
  }

  // ─── System scope slide (when at least one field is filled) ───────
  const scope = doc.systemScope;
  const scopeRows: { label: string; value: string | undefined }[] = scope
    ? [
        { label: 'System goal', value: scope.goal },
        { label: 'Necessary conditions', value: scope.necessaryConditions },
        { label: 'Success measures', value: scope.successMeasures },
        { label: 'Boundaries', value: scope.boundaries },
        { label: 'Containing system', value: scope.containingSystem },
        { label: 'Interacting systems', value: scope.interactingSystems },
        { label: 'Inputs / outputs', value: scope.inputsOutputs },
      ]
    : [];
  const filledScope = scopeRows.filter((r) => r.value && r.value.trim().length > 0);
  if (filledScope.length > 0) {
    const slide = pptx.addSlide();
    addSlideTitle(slide, 'System scope');
    slide.addText(
      filledScope
        .map((r) => ({ text: `${r.label}: `, options: { bold: true } as const }))
        .flatMap(
          // Each row → bold label, then value on the same paragraph.
          (_, i) => {
            const row = filledScope[i];
            if (!row) return [];
            return [
              {
                text: `${row.label}: `,
                options: { bold: true, breakLine: false, color: TEXT_DARK },
              },
              { text: `${row.value}\n`, options: { color: TEXT_MUTED } },
            ];
          }
        ),
      {
        x: 0.6,
        y: 1.4,
        w: 12.1,
        h: 5.4,
        fontSize: 16,
        fontFace: FONT_FACE,
        valign: 'top',
        paraSpaceAfter: 6,
      }
    );
  }

  // ─── Canvas visual slide ─────────────────────────────────────────────
  // Capture the live React Flow viewport as a PNG and fit it onto a slide.
  // If no nodes / canvas, skip silently — the deck still works without it.
  try {
    const dataUrl = await capturePngDataUrl(nodes);
    if (dataUrl) {
      const slide = pptx.addSlide();
      addSlideTitle(slide, 'The diagram');
      // pptxgenjs sizes images by the slide layout's coordinate system
      // (inches at LAYOUT_WIDE). Fit a 12.13 × 5.4 box, centred under
      // the title. Image is auto-scaled to fit, preserving aspect ratio.
      slide.addImage({
        data: dataUrl,
        x: 0.6,
        y: 1.4,
        w: 12.13,
        h: 5.4,
        sizing: { type: 'contain', w: 12.13, h: 5.4 },
      });
    }
  } catch {
    // Canvas capture failures shouldn't take the whole export down.
    // Silently skip; the rest of the deck still ships.
  }

  // ─── EC conflict slide (EC-only) ─────────────────────────────────────
  if (doc.diagramType === 'ec') {
    const slide = pptx.addSlide();
    addSlideTitle(slide, 'The conflict');
    const wants = entitiesOfType(doc, 'want');
    const needs = entitiesOfType(doc, 'need');
    const goal = entitiesOfType(doc, 'goal')[0];

    const lines: string[] = [];
    if (goal?.title) lines.push(`Common goal: ${goal.title}`);
    if (wants.length === 2 && needs.length === 2) {
      const [d, dPrime] = wants;
      const [b, c] = needs;
      lines.push('');
      lines.push(
        `On the one hand, we want "${d?.title ?? '—'}" in order to meet "${b?.title ?? '—'}".`
      );
      lines.push(
        `On the other hand, we want "${dPrime?.title ?? '—'}" in order to meet "${c?.title ?? '—'}".`
      );
      lines.push('');
      lines.push(
        'Both needs serve the common goal, yet the wants are mutually exclusive — surface the assumptions on each edge to find the injection that evaporates the cloud.'
      );
    } else {
      lines.push(
        'Cloud structure incomplete — fill the 5 boxes (goal, both needs, both wants) and draw the D↔D′ mutex arrow.'
      );
    }

    slide.addText(lines.join('\n'), {
      x: 0.6,
      y: 1.4,
      w: 12.1,
      h: 5.4,
      fontSize: 18,
      fontFace: FONT_FACE,
      color: TEXT_DARK,
      valign: 'top',
      paraSpaceAfter: 8,
    });
  }

  // ─── Reasoning slides (one per chunk of sentences) ───────────────────
  const sentences = buildSentences(doc, causalityLabel);
  if (sentences.length === 0) {
    const slide = pptx.addSlide();
    addSlideTitle(slide, 'Reasoning');
    slide.addText('No edges drawn yet.', {
      x: 0.6,
      y: 1.4,
      w: 12.1,
      h: 5.4,
      fontSize: 18,
      fontFace: FONT_FACE,
      color: TEXT_LIGHT,
      italic: true,
    });
  } else {
    const groups = chunk(sentences, SENTENCES_PER_SLIDE);
    groups.forEach((group, i) => {
      const slide = pptx.addSlide();
      const title = groups.length === 1 ? 'Reasoning' : `Reasoning (${i + 1} / ${groups.length})`;
      addSlideTitle(slide, title);
      slide.addText(
        group.map((s) => ({ text: s, options: { bullet: true } })),
        {
          x: 0.6,
          y: 1.4,
          w: 12.1,
          h: 5.4,
          fontSize: 16,
          fontFace: FONT_FACE,
          color: TEXT_DARK,
          valign: 'top',
          paraSpaceAfter: 8,
        }
      );
    });
  }

  // ─── Likely Core Driver(s) (CRT-only, when one+ exists) ──────────────
  if (doc.diagramType === 'crt') {
    const drivers = findCoreDrivers(doc);
    if (drivers.length > 0) {
      const slide = pptx.addSlide();
      addSlideTitle(slide, 'Likely Core Driver(s)');
      slide.addText(
        drivers.slice(0, 5).map((d) => ({
          text: `${d.entity.title || 'Untitled'} (${ENTITY_TYPE_META[d.entity.type].label}) — reaches ${d.reachedUdeCount} UDE${d.reachedUdeCount === 1 ? '' : 's'}`,
          options: { bullet: true },
        })),
        {
          x: 0.6,
          y: 1.4,
          w: 12.1,
          h: 5.4,
          fontSize: 18,
          fontFace: FONT_FACE,
          color: TEXT_DARK,
          valign: 'top',
          paraSpaceAfter: 10,
        }
      );
    }
  }

  // ─── Method checklist (when any step is ticked) ──────────────────────
  const checklist = doc.methodChecklist;
  const steps = METHOD_BY_DIAGRAM[doc.diagramType];
  if (steps.length > 0 && checklist && Object.values(checklist).some((v) => v)) {
    const slide = pptx.addSlide();
    const completed = steps.filter((s) => checklist[s.id] === true).length;
    addSlideTitle(slide, `Method checklist (${completed} / ${steps.length})`);
    slide.addText(
      steps.map((step) => {
        const checked = checklist[step.id] === true;
        return {
          text: `${checked ? '☑' : '☐'}  ${step.label}`,
          options: {
            color: checked ? TEXT_DARK : TEXT_MUTED,
            bold: checked,
            paraSpaceAfter: 6,
          },
        };
      }),
      {
        x: 0.6,
        y: 1.4,
        w: 12.1,
        h: 5.4,
        fontSize: 15,
        fontFace: FONT_FACE,
        valign: 'top',
      }
    );
  }

  // ─── Done — trigger the download ─────────────────────────────────────
  await pptx.writeFile({ fileName: `${slug(doc.title)}.pptx` });
};

/**
 * Shared header: indigo accent rule + slide-title text. Every content
 * slide gets the same header treatment so the deck reads as one piece.
 */
type PptxSlide = ReturnType<InstanceType<typeof PptxGenJSDefault>['addSlide']>;

function addSlideTitle(slide: PptxSlide, text: string): void {
  // Top indigo rule.
  slide.addShape('rect', { x: 0, y: 0, w: 13.333, h: 0.04, fill: { color: INDIGO } });
  // Subtle panel under the title for visual anchor.
  slide.addShape('rect', { x: 0, y: 0.04, w: 13.333, h: 0.96, fill: { color: PANEL_BG } });
  slide.addText(text, {
    x: 0.6,
    y: 0.15,
    w: 12.1,
    h: 0.8,
    fontSize: 22,
    fontFace: FONT_FACE,
    color: TEXT_DARK,
    bold: true,
    valign: 'middle',
  });
}
