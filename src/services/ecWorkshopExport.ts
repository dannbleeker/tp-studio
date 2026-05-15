import {
  ALL_EC_SLOTS,
  type ECSlot,
  EC_SLOT_GUIDING_QUESTIONS,
  EC_SLOT_LABEL,
} from '@/domain/ecGuiding';
import type { Entity, TPDocument } from '@/domain/types';
import { loadJsPdf } from '@/services/exporters/pdfShared';
import { slug, triggerDownload } from '@/services/exporters/shared';

/**
 * Session 87 / EC PPT comparison item #5 — One-page workshop-handout EC export.
 *
 * The canonical BESTSELLER EC workshop PowerPoint is a 16:9 fixed-layout
 * sheet: title at top, numbered "READ EVERY ARROW" reading guide, 5
 * canonical boxes with 4 directional arrows + 1 mutex arrow, small
 * "Assumptions" placeholders fanned out from each arrow, an
 * "Injection(s)" box, and a guiding-questions reference table at the
 * bottom. The interactive React Flow canvas (and the vector-PDF export
 * built on top of it) faithfully renders the live diagram — but doesn't
 * produce that printable workshop sheet.
 *
 * This module generates that sheet directly via jspdf: A4 landscape,
 * fixed coordinates regardless of the live canvas zoom/pan state,
 * guiding-questions table baked into the page. The slot titles, the
 * D↔D′ mutex line, and any wired assumption count come from the
 * `TPDocument` — everything else is laid out at canonical positions
 * so the output matches the PPT template visually.
 *
 * Anti-scope:
 *   - Doesn't try to replicate the live canvas's drag positions —
 *     the slot positions on the sheet are fixed.
 *   - Doesn't render assumption *text* (only a slot box per arrow);
 *     listing assumptions would crowd the layout and the
 *     verbalisation + AssumptionWell already surface that content on
 *     screen.
 *   - Doesn't render injection text either — a single "Injection(s)"
 *     placeholder mirrors the PPT.
 *
 * If a future iteration needs assumption / injection text in the
 * handout, follow the appendix pattern in `pdfExport.ts` and add a
 * second page rather than crowding the canonical one-page layout.
 */

const PAGE_W_MM = 297; // A4 landscape
const PAGE_H_MM = 210;
const MARGIN_MM = 14;

const TITLE_FONT_PT = 16;
const READING_LABEL_FONT_PT = 9;
const SLOT_LABEL_FONT_PT = 8;
const SLOT_TITLE_FONT_PT = 10;
const ASSUMPTION_FONT_PT = 8;
const TABLE_HEADER_FONT_PT = 9;
const TABLE_BODY_FONT_PT = 9;

// Box geometry — mm coordinates on the A4 landscape page. Hand-tuned
// to roughly mirror the BESTSELLER PowerPoint's relative positioning
// while leaving room for the bottom guiding-questions table.
const BOX_W_MM = 60;
const BOX_H_MM = 22;
const ASSUMP_W_MM = 36;
const ASSUMP_H_MM = 14;

const SLOT_BOX_POSITIONS: Record<ECSlot, { x: number; y: number }> = {
  a: { x: 32, y: 75 }, // Objective — left center
  b: { x: 130, y: 40 }, // Need B — top middle
  c: { x: 130, y: 110 }, // Need C — bottom middle
  d: { x: 222, y: 40 }, // Want D — top right
  dPrime: { x: 222, y: 110 }, // Want D′ — bottom right
};

// Each assumption-placeholder card sits between an arrow's midpoint
// and an empty corner of the canvas, attached by a dashed leader line.
// Coordinates pre-resolved so the layout is deterministic.
type AssumptionAnchor = {
  edgeLabel: string;
  midX: number;
  midY: number;
  cardX: number;
  cardY: number;
};

const arrowMid = (s: ECSlot, t: ECSlot): { x: number; y: number } => {
  const src = SLOT_BOX_POSITIONS[s];
  const tgt = SLOT_BOX_POSITIONS[t];
  return {
    x: (src.x + BOX_W_MM / 2 + tgt.x + BOX_W_MM / 2) / 2,
    y: (src.y + BOX_H_MM / 2 + tgt.y + BOX_H_MM / 2) / 2,
  };
};

const guidingQuestionRowHeightMm = (): number => 7.5;

const headerLabel = (slot: ECSlot): string => EC_SLOT_LABEL[slot];

const escapeForPdf = (text: string): string =>
  // jspdf accepts Latin-1; non-Latin glyphs render as `?`. We leave
  // them in for the user — best-effort matching the on-screen text.
  text.length > 0 ? text : '';

const slotEntities = (doc: TPDocument): Record<ECSlot, Entity | undefined> => {
  const map: Record<ECSlot, Entity | undefined> = {
    a: undefined,
    b: undefined,
    c: undefined,
    d: undefined,
    dPrime: undefined,
  };
  for (const entity of Object.values(doc.entities)) {
    if (entity.ecSlot && !map[entity.ecSlot]) map[entity.ecSlot] = entity;
  }
  return map;
};

/**
 * Build the EC workshop sheet PDF and trigger a download. Returns
 * `false` when the doc isn't an EC — the caller surfaces a toast.
 */
export const exportECWorkshopSheet = async (doc: TPDocument): Promise<boolean> => {
  if (doc.diagramType !== 'ec') return false;
  const slots = slotEntities(doc);

  // Lazy-load jspdf — keeps the eager path tiny (jspdf is ~115 KB gz).
  // Session 94 (Top-30 #4) — routed through `loadJsPdf` so the
  // dynamic-import sits in one shared module.
  const jsPDF = await loadJsPdf();
  const pdf = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4',
    compress: true,
  });

  // ── Title strip ────────────────────────────────────────────────
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(TITLE_FONT_PT);
  pdf.setTextColor(20, 20, 20);
  pdf.text(escapeForPdf(doc.title || 'Untitled Evaporating Cloud'), MARGIN_MM, MARGIN_MM + 4);

  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(READING_LABEL_FONT_PT);
  pdf.setTextColor(80, 80, 80);
  pdf.text('Evaporating Cloud — workshop sheet', PAGE_W_MM - MARGIN_MM, MARGIN_MM + 4, {
    align: 'right',
  });

  // ── Reading-instruction strip ──────────────────────────────────
  // Indigo-bordered band echoing the on-canvas ECReadingInstructions.
  const readingY = MARGIN_MM + 9;
  const readingH = 9;
  pdf.setDrawColor(199, 210, 254);
  pdf.setFillColor(238, 242, 255);
  pdf.roundedRect(MARGIN_MM, readingY, PAGE_W_MM - MARGIN_MM * 2, readingH, 2, 2, 'FD');
  pdf.setFontSize(READING_LABEL_FONT_PT);
  pdf.setTextColor(67, 56, 202);
  pdf.setFont('helvetica', 'bold');
  pdf.text('READ EVERY ARROW:', MARGIN_MM + 3, readingY + 6);
  pdf.setFont('helvetica', 'normal');
  pdf.setTextColor(55, 65, 81);
  const steps: { n: string; text: string }[] = [
    { n: '1', text: 'In order to…' },
    { n: '2', text: 'we must…' },
    { n: '3', text: 'because…' },
  ];
  let chipX = MARGIN_MM + 53;
  for (const step of steps) {
    pdf.setFillColor(99, 102, 241);
    pdf.circle(chipX, readingY + 4.5, 2.2, 'F');
    pdf.setTextColor(255, 255, 255);
    pdf.setFont('helvetica', 'bold');
    pdf.text(step.n, chipX, readingY + 5.5, { align: 'center' });
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(55, 65, 81);
    pdf.text(step.text, chipX + 4, readingY + 6);
    chipX += pdf.getTextWidth(step.text) + 14;
  }

  // ── 5 EC boxes ─────────────────────────────────────────────────
  const drawSlotBox = (slot: ECSlot): void => {
    const pos = SLOT_BOX_POSITIONS[slot];
    const entity = slots[slot];
    const title = entity?.title?.trim() ?? '';
    pdf.setDrawColor(150, 150, 150);
    pdf.setFillColor(255, 255, 255);
    pdf.roundedRect(pos.x, pos.y, BOX_W_MM, BOX_H_MM, 2, 2, 'FD');
    // Left coloured stripe by slot kind: indigo for goal/A, amber for
    // needs (B/C), rose for wants (D/D′). Matches the on-canvas stripe
    // convention.
    const stripe =
      slot === 'a' ? [99, 102, 241] : slot === 'b' || slot === 'c' ? [217, 119, 6] : [225, 29, 72];
    pdf.setFillColor(stripe[0]!, stripe[1]!, stripe[2]!);
    pdf.rect(pos.x, pos.y, 1.5, BOX_H_MM, 'F');
    pdf.setFontSize(SLOT_LABEL_FONT_PT);
    pdf.setTextColor(100, 100, 100);
    pdf.setFont('helvetica', 'bold');
    pdf.text(headerLabel(slot).toUpperCase(), pos.x + 4, pos.y + 5);
    pdf.setFontSize(SLOT_TITLE_FONT_PT);
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(30, 30, 30);
    // Wrap the title to the box width.
    const wrapped = pdf.splitTextToSize(escapeForPdf(title || '(untitled)'), BOX_W_MM - 6);
    pdf.text(wrapped, pos.x + 4, pos.y + 11);
  };
  for (const slot of ALL_EC_SLOTS) drawSlotBox(slot);

  // ── 5 arrows ───────────────────────────────────────────────────
  const drawArrow = (
    from: ECSlot,
    to: ECSlot,
    opts?: { mutex?: boolean }
  ): { midX: number; midY: number } => {
    const src = SLOT_BOX_POSITIONS[from];
    const tgt = SLOT_BOX_POSITIONS[to];
    // Connect right-edge-midpoint of source → left-edge-midpoint of
    // target when the boxes are roughly side-by-side; for the D↔D′
    // mutex (vertically stacked) connect bottom→top.
    let sx = src.x;
    let sy = src.y + BOX_H_MM / 2;
    let tx = tgt.x + BOX_W_MM;
    let ty = tgt.y + BOX_H_MM / 2;
    if (opts?.mutex) {
      sx = src.x + BOX_W_MM / 2;
      sy = src.y + BOX_H_MM;
      tx = tgt.x + BOX_W_MM / 2;
      ty = tgt.y;
    } else {
      // EC arrows flow right → left (D supports B, B supports A).
      // The visual convention here: arrow head points at the TARGET,
      // so head is at the left edge of the source slot. But edges in
      // the EC schema read child → parent: D → B means D supports B,
      // so the arrowhead should point at B (which is left of D).
      sx = src.x;
      sy = src.y + BOX_H_MM / 2;
      tx = tgt.x + BOX_W_MM;
      ty = tgt.y + BOX_H_MM / 2;
    }
    pdf.setDrawColor(opts?.mutex ? 220 : 90, opts?.mutex ? 38 : 90, opts?.mutex ? 38 : 90);
    pdf.setLineWidth(opts?.mutex ? 0.6 : 0.4);
    pdf.line(sx, sy, tx, ty);
    // Arrowhead — only on directional arrows (not mutex).
    if (!opts?.mutex) {
      const dx = tx - sx;
      const dy = ty - sy;
      const len = Math.hypot(dx, dy);
      if (len > 0) {
        const ux = dx / len;
        const uy = dy / len;
        const headLen = 2.8;
        const headWidth = 1.6;
        const px = -uy;
        const py = ux;
        const baseX = tx - ux * headLen;
        const baseY = ty - uy * headLen;
        pdf.setFillColor(90, 90, 90);
        pdf.triangle(
          tx,
          ty,
          baseX + px * headWidth,
          baseY + py * headWidth,
          baseX - px * headWidth,
          baseY - py * headWidth,
          'F'
        );
      }
    }
    return { midX: (sx + tx) / 2, midY: (sy + ty) / 2 };
  };

  drawArrow('d', 'b');
  drawArrow('dPrime', 'c');
  drawArrow('b', 'a');
  drawArrow('c', 'a');
  drawArrow('d', 'dPrime', { mutex: true });

  // Lightning glyph next to the mutex arrow's midpoint — matches the
  // on-canvas ⚡ convention.
  {
    const mutexMid = arrowMid('d', 'dPrime');
    pdf.setTextColor(220, 38, 38);
    pdf.setFontSize(11);
    pdf.setFont('helvetica', 'bold');
    pdf.text('⚡', mutexMid.x - BOX_W_MM / 2 - 3, mutexMid.y + 1.5);
  }

  // ── Assumption placeholders ────────────────────────────────────
  // Four cards on the four directional arrows. Each sits offset from
  // the arrow midpoint, with a dashed leader line back to the arrow.
  const anchors: AssumptionAnchor[] = [
    { edgeLabel: 'D → B', midX: 0, midY: 0, cardX: 195, cardY: 22 },
    { edgeLabel: 'D′ → C', midX: 0, midY: 0, cardX: 195, cardY: 174 },
    { edgeLabel: 'B → A', midX: 0, midY: 0, cardX: 70, cardY: 22 },
    { edgeLabel: 'C → A', midX: 0, midY: 0, cardX: 70, cardY: 174 },
  ];
  const midDB = arrowMid('d', 'b');
  const midDPC = arrowMid('dPrime', 'c');
  const midBA = arrowMid('b', 'a');
  const midCA = arrowMid('c', 'a');
  anchors[0]!.midX = midDB.x;
  anchors[0]!.midY = midDB.y;
  anchors[1]!.midX = midDPC.x;
  anchors[1]!.midY = midDPC.y;
  anchors[2]!.midX = midBA.x;
  anchors[2]!.midY = midBA.y;
  anchors[3]!.midX = midCA.x;
  anchors[3]!.midY = midCA.y;

  for (const a of anchors) {
    // Dashed leader.
    pdf.setLineDashPattern([1.2, 1.2], 0);
    pdf.setDrawColor(150, 150, 150);
    pdf.setLineWidth(0.25);
    pdf.line(a.midX, a.midY, a.cardX + ASSUMP_W_MM / 2, a.cardY + ASSUMP_H_MM / 2);
    pdf.setLineDashPattern([], 0);
    // Card body.
    pdf.setDrawColor(170, 170, 170);
    pdf.setFillColor(250, 250, 250);
    pdf.roundedRect(a.cardX, a.cardY, ASSUMP_W_MM, ASSUMP_H_MM, 1.5, 1.5, 'FD');
    pdf.setFontSize(ASSUMPTION_FONT_PT);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(60, 60, 60);
    pdf.text('Assumptions', a.cardX + 2, a.cardY + 4);
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(140, 140, 140);
    pdf.text(a.edgeLabel, a.cardX + 2, a.cardY + 9);
  }

  // ── Injection(s) box ──────────────────────────────────────────
  const injX = PAGE_W_MM - MARGIN_MM - 40;
  const injY = MARGIN_MM + 24;
  pdf.setDrawColor(190, 190, 190);
  pdf.setFillColor(255, 255, 255);
  pdf.roundedRect(injX, injY, 40, 12, 1.5, 1.5, 'FD');
  pdf.setFontSize(ASSUMPTION_FONT_PT);
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(60, 60, 60);
  pdf.text('Injection(s)', injX + 2, injY + 5);
  pdf.setFont('helvetica', 'normal');
  pdf.setTextColor(140, 140, 140);
  pdf.text(
    `${Object.values(doc.entities).filter((e) => e.type === 'injection').length} wired`,
    injX + 2,
    injY + 10
  );

  // ── Guiding-questions table (bottom) ───────────────────────────
  const tableX = MARGIN_MM;
  const tableY = PAGE_H_MM - MARGIN_MM - guidingQuestionRowHeightMm() * 6 - 2;
  const tableW = PAGE_W_MM - MARGIN_MM * 2;
  const rowH = guidingQuestionRowHeightMm();
  const slotColW = 28;

  // Header row.
  pdf.setDrawColor(180, 180, 180);
  pdf.setFillColor(243, 244, 246);
  pdf.rect(tableX, tableY, tableW, rowH, 'FD');
  pdf.setFontSize(TABLE_HEADER_FONT_PT);
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(30, 30, 30);
  pdf.text('Box', tableX + 3, tableY + 5);
  pdf.text('Guiding question', tableX + slotColW + 3, tableY + 5);

  // Body rows in PPT order (D → D′ → C → B → A; bottom-up
  // elicitation matches the PowerPoint's reading flow).
  const tableSlotOrder: ECSlot[] = ['d', 'dPrime', 'c', 'b', 'a'];
  let rowY = tableY + rowH;
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(TABLE_BODY_FONT_PT);
  for (const slot of tableSlotOrder) {
    pdf.setDrawColor(220, 220, 220);
    pdf.rect(tableX, rowY, tableW, rowH, 'D');
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(60, 60, 60);
    pdf.text(EC_SLOT_LABEL[slot], tableX + 3, rowY + 5);
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(30, 30, 30);
    pdf.text(EC_SLOT_GUIDING_QUESTIONS[slot], tableX + slotColW + 3, rowY + 5);
    rowY += rowH;
  }

  // ── Save ───────────────────────────────────────────────────────
  const blob = pdf.output('blob');
  triggerDownload(blob, `${slug(doc.title || 'evaporating-cloud')}-workshop.pdf`);
  return true;
};
