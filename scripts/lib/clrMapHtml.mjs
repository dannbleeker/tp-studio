/**
 * Single source of truth for the CLR-map HTML embedded in Chapter 13.
 *
 * Both `render-clr-map-native.mjs` (PNG preview) and `build-book-pdf.mjs`
 * (the book itself) import `clrMapHtml()` from here so the diagram stays
 * in lockstep across artefacts.
 *
 * The HTML uses semantic class names (`clr-map`, `clr-grid`, `clr-card`,
 * `vignette`); the corresponding CSS lives in the book's STYLES block so
 * the cards inherit print-friendly typography.
 *
 * Vignette palette mirrors `src/domain/tokens.ts:ENTITY_STRIPE_COLOR`:
 *   - "Cause" / "Extra" → amber  (#d97706, rootCause)
 *   - "Effect" / "Entity" → grey (#737373, effect)
 *   - "Missing" → red            (#ef4444, ude)
 *   - "New" → indigo             (#6366f1, desiredEffect)
 */

const INDIGO = '#6366f1';
const RED = '#dc2626';
const NODE_FILL = '#ffffff';
const NODE_BORDER = '#e5e7eb';
const NODE_TEXT = '#111827';
const STRIPE_CAUSE = '#d97706';
const STRIPE_EFFECT = '#737373';
const STRIPE_MISSING = '#ef4444';

const CARD_W = 100;
const CARD_H = 38;
const STRIPE_W = 6;

const SVG_DEFS = `
  <defs>
    <marker id="arrow-indigo" viewBox="0 0 10 10" refX="9" refY="5"
            markerWidth="6" markerHeight="6" orient="auto-start-reverse">
      <path d="M0,0 L10,5 L0,10 z" fill="${INDIGO}"/>
    </marker>
    <marker id="arrow-red" viewBox="0 0 10 10" refX="9" refY="5"
            markerWidth="6" markerHeight="6" orient="auto-start-reverse">
      <path d="M0,0 L10,5 L0,10 z" fill="${RED}"/>
    </marker>
    <filter id="card-shadow" x="-20%" y="-20%" width="140%" height="160%">
      <feDropShadow dx="0" dy="0.5" stdDeviation="0.6" flood-opacity="0.08"/>
    </filter>
  </defs>`;

/** TPNode-style mini card with optional left stripe. */
function node(x, y, label, { stripe = STRIPE_EFFECT, dashed = false } = {}) {
  const dash = dashed ? 'stroke-dasharray="4 3"' : '';
  const borderColor = dashed ? (stripe ?? RED) : NODE_BORDER;
  return `<g filter="url(#card-shadow)">
    <rect x="${x}" y="${y}" width="${CARD_W}" height="${CARD_H}" rx="5" ry="5"
          fill="${NODE_FILL}" stroke="${borderColor}" stroke-width="1.25" ${dash}/>
    ${
      stripe && !dashed
        ? `<rect x="${x}" y="${y}" width="${STRIPE_W}" height="${CARD_H}" rx="5" ry="5" fill="${stripe}"/>
           <rect x="${x + STRIPE_W / 2}" y="${y}" width="${STRIPE_W / 2}" height="${CARD_H}" fill="${stripe}"/>`
        : ''
    }
    <text x="${x + (stripe && !dashed ? STRIPE_W + (CARD_W - STRIPE_W) / 2 : CARD_W / 2)}"
          y="${y + 24}" text-anchor="middle"
          font-size="13" font-weight="500" fill="${NODE_TEXT}"
          font-family="-apple-system, Segoe UI, Roboto, sans-serif">${label}</text>
  </g>`;
}

function arrow(x1, y1, x2, y2, { color = INDIGO, dashed = false } = {}) {
  return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"
                stroke="${color}" stroke-width="2"
                ${dashed ? 'stroke-dasharray="5 3"' : ''}
                marker-end="url(#arrow-${color === RED ? 'red' : 'indigo'})"/>`;
}

const VIGNETTES = {
  entity: `<svg viewBox="0 0 240 56" xmlns="http://www.w3.org/2000/svg">${SVG_DEFS}
    ${node(70, 9, 'Entity', { stripe: STRIPE_EFFECT })}
  </svg>`,
  cause_effect: `<svg viewBox="0 0 250 56" xmlns="http://www.w3.org/2000/svg">${SVG_DEFS}
    ${node(10, 9, 'Cause', { stripe: STRIPE_CAUSE })}
    ${arrow(114, 28, 134, 28)}
    ${node(140, 9, 'Effect', { stripe: STRIPE_EFFECT })}
  </svg>`,
  missing_cause: `<svg viewBox="0 0 270 104" xmlns="http://www.w3.org/2000/svg">${SVG_DEFS}
    ${node(10, 6, 'Cause', { stripe: STRIPE_CAUSE })}
    ${node(10, 60, 'Missing', { stripe: STRIPE_MISSING, dashed: true })}
    ${arrow(114, 22, 158, 42)}
    ${arrow(114, 76, 158, 58, { color: RED, dashed: true })}
    ${node(160, 33, 'Effect', { stripe: STRIPE_EFFECT })}
  </svg>`,
  additional_cause: `<svg viewBox="0 0 270 104" xmlns="http://www.w3.org/2000/svg">${SVG_DEFS}
    ${node(10, 6, 'Cause', { stripe: STRIPE_CAUSE })}
    ${node(10, 60, 'Extra', { stripe: STRIPE_CAUSE })}
    ${arrow(114, 22, 158, 42)}
    ${arrow(114, 76, 158, 58)}
    ${node(160, 33, 'Effect', { stripe: STRIPE_EFFECT })}
  </svg>`,
  reversal: `<svg viewBox="0 0 250 56" xmlns="http://www.w3.org/2000/svg">${SVG_DEFS}
    ${node(10, 9, 'Cause', { stripe: STRIPE_CAUSE })}
    ${arrow(134, 28, 114, 28)}
    ${node(140, 9, 'Effect', { stripe: STRIPE_EFFECT })}
  </svg>`,
  predicted: `<svg viewBox="0 0 270 104" xmlns="http://www.w3.org/2000/svg">${SVG_DEFS}
    ${node(10, 33, 'Cause', { stripe: STRIPE_CAUSE })}
    ${arrow(114, 42, 158, 22)}
    ${arrow(114, 58, 158, 74, { dashed: true })}
    ${node(160, 6, 'Effect', { stripe: STRIPE_EFFECT })}
    ${node(160, 60, 'New', { stripe: INDIGO, dashed: true })}
  </svg>`,
  tautology: `<svg viewBox="0 0 250 56" xmlns="http://www.w3.org/2000/svg">${SVG_DEFS}
    ${node(10, 9, 'Cause', { stripe: STRIPE_CAUSE })}
    ${arrow(114, 24, 134, 24)}
    ${arrow(134, 32, 114, 32)}
    ${node(140, 9, 'Effect', { stripe: STRIPE_EFFECT })}
  </svg>`,
};

const CATEGORIES = [
  {
    title: 'Clarity',
    gloss: 'Seeking to understand',
    bullets: [
      'Would I add any verbal explanation if reading the tree to someone else?',
      'Is the meaning of words unambiguous?',
      'Is the connection between cause and effect convincing at face value?',
      'Are intermediate steps missing (long arrow)?',
    ],
    vignette: VIGNETTES.entity,
  },
  {
    title: 'Entity existence',
    gloss: 'Complete, properly structured, valid statements',
    bullets: [
      'Is it a complete sentence?',
      'Does it make sense?',
      'Free of embedded "if-then" statements?',
      'Does it convey only one idea?',
      'Does it exist in someone’s reality?',
      'Can it be documented with evidence?',
    ],
    vignette: VIGNETTES.entity,
  },
  {
    title: 'Causality existence',
    gloss: 'Logical connection between cause and effect',
    bullets: [
      'Does an "if-then" connection really exist?',
      'Does the proposed cause, in fact, result in the stated effect?',
      'Does it make sense when read aloud exactly as written?',
      'Is the cause intangible? (if so, look for a confirming predicted effect)',
    ],
    vignette: VIGNETTES.cause_effect,
  },
  {
    title: 'Cause insufficiency',
    gloss: 'A non-trivial dependent element missing',
    bullets: [
      'Can the cause, as stated, result in the effect on its own?',
      'Are any significant causal factors missing?',
      'Is an ellipse (AND) required?',
      'Are any non-dependent causes included by mistake?',
    ],
    vignette: VIGNETTES.missing_cause,
  },
  {
    title: 'Additional cause',
    gloss: 'A separate, independent cause producing the same effect',
    bullets: [
      'Is there anything else that might cause the same effect on its own?',
      'If the stated cause is eliminated, will the effect be (almost completely) eliminated?',
    ],
    vignette: VIGNETTES.additional_cause,
  },
  {
    title: 'Cause-effect reversal',
    gloss: 'Effect misstated as the cause',
    bullets: [
      'Is the stated effect really the cause, and the stated cause really the effect?',
      'Is the stated cause really a reason why, or just how we know the effect exists?',
    ],
    vignette: VIGNETTES.reversal,
  },
  {
    title: 'Predicted effect',
    gloss: 'Additional corroborating effect resulting from the cause',
    bullets: [
      'Is the cause intangible?',
      'Do other unavoidable outcomes of the proposed cause exist besides the stated effect?',
    ],
    vignette: VIGNETTES.predicted,
  },
  {
    title: 'Tautology',
    gloss: 'Circular logic',
    bullets: [
      'Is the cause intangible?',
      'Is the effect offered as the rationale for the existence of the cause?',
      'Are other unavoidable outcomes identifiable besides the proposed effect?',
    ],
    vignette: VIGNETTES.tautology,
  },
];

/** Return the standalone block — no `<style>` (CSS lives with the host). */
export function clrMapHtml() {
  const cards = CATEGORIES.map(
    (c) => `
    <article class="clr-card">
      <header>
        <h4 class="clr-card-title">${c.title}</h4>
        <p class="clr-card-gloss">${c.gloss}</p>
      </header>
      <ul class="clr-card-bullets">
        ${c.bullets.map((b) => `<li>${b}</li>`).join('')}
      </ul>
      <div class="clr-card-vignette">${c.vignette}</div>
    </article>`
  ).join('');
  return `<div class="clr-map">
    <div class="clr-grid">${cards}</div>
  </div>`;
}

/**
 * Standalone CSS that styles the block. The book builder folds this into
 * its global STYLES; the preview-renderer wraps a `<style>` around it.
 * Sizes are in points (pt) so the typography composes with the rest of
 * the book; the preview script reads it the same way (1pt ≈ 1.33 px at
 * 96 dpi, which Chromium handles fine).
 */
export const CLR_MAP_CSS = `
/* The CLR map spreads across roughly one page of the book at A4 content
 * width (~170mm). Four columns proved too tight for the long questions
 * (text wrapping to 7+ lines per card); two columns × four rows reads
 * cleanly. The cards have an inner two-pane layout — text on the left,
 * vignette pinned to the right — so each card still echoes the
 * pptx-style "category card" rhythm. */
.clr-map {
  margin: 14pt 0 18pt;
  padding: 12pt;
  background: #f3f4f6;
  border-radius: 6pt;
  page-break-inside: avoid;
}
.clr-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 8pt;
}
.clr-card {
  background: #ffffff;
  border: 0.5pt solid #e5e7eb;
  border-radius: 4pt;
  padding: 9pt 11pt 11pt;
  display: flex;
  flex-direction: column;
}
.clr-card-title {
  margin: 0;
  font-size: 9pt;
  font-weight: 700;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  color: #6366f1;
}
.clr-card-gloss {
  margin: 1pt 0 5pt;
  font-size: 8.5pt;
  color: #4b5563;
  font-style: italic;
}
.clr-card-bullets {
  margin: 0;
  padding-left: 12pt;
  font-size: 8.5pt;
  color: #374151;
  line-height: 1.35;
  list-style-type: disc;
  flex: 1;
}
.clr-card-bullets li { margin: 1.5pt 0; }
.clr-card-vignette {
  margin-top: 8pt;
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 38pt;
}
.clr-card-vignette svg { max-width: 100%; height: auto; }
`;
