// Session 89 — generate a 1200×630 OG image for link previews.
//
// We deliberately use a programmatic PNG (vs. the dev-server
// screenshot path) because:
//   - The dev server needs ?test=1 + a seeded EC + a manual fit-view
//     to produce a clean canvas; orchestrating that headlessly adds
//     enough moving parts that a "good enough" static rendering
//     beats a marginal screenshot.
//   - The OG card is consumed at <600×300 in most chat UIs anyway —
//     loud branded text + diagram-shaped silhouettes carry the
//     intent better than a tiny pixelated screenshot would.
//
// Output: public/og-image.png. Pure-Node PNG encoder shared in shape
// with `scripts/generate-pwa-icons.mjs`.

import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateSync } from 'node:zlib';

const here = dirname(fileURLToPath(import.meta.url));
const publicDir = join(here, '..', 'public');
mkdirSync(publicDir, { recursive: true });

const W = 1200;
const H = 630;

// Palette — uses the same indigo-500 accent as the manifest theme.
const BG = [0xff, 0xff, 0xff];
const INDIGO = [0x63, 0x66, 0xf1];
const SLATE_900 = [0x0f, 0x17, 0x2a];
const SLATE_500 = [0x64, 0x74, 0x8b];
const EMERALD_500 = [0x10, 0xb9, 0x81];
const AMBER_500 = [0xf5, 0x9e, 0x0b];
const ROSE_500 = [0xf4, 0x3f, 0x5e];

// Build the RGBA canvas. The drawing code lives at the bottom of
// this file, after every helper + the font are declared (otherwise
// TDZ on the `const FONT` table would trip on first glyph render).
const pixels = new Uint8Array(W * H * 4);

// --- Drawing helpers ----------------------------------------------

function fillRect(x, y, w, h, rgb) {
  for (let py = y; py < y + h; py++) {
    if (py < 0 || py >= H) continue;
    for (let px = x; px < x + w; px++) {
      if (px < 0 || px >= W) continue;
      setPx(px, py, rgb, 0xff);
    }
  }
}

function fillRoundedRect(x, y, w, h, radius, rgb) {
  for (let py = y; py < y + h; py++) {
    if (py < 0 || py >= H) continue;
    for (let px = x; px < x + w; px++) {
      if (px < 0 || px >= W) continue;
      // Corner test — only the four corner squares apply the radius.
      const dx = Math.max(x + radius - px, px - (x + w - 1 - radius), 0);
      const dy = Math.max(y + radius - py, py - (y + h - 1 - radius), 0);
      if (dx * dx + dy * dy <= radius * radius) {
        setPx(px, py, rgb, 0xff);
      }
    }
  }
}

function drawLine(x0, y0, x1, y1, rgb, thickness) {
  // Bresenham with a small thickness — good enough for thin connector
  // strokes on a 1200×630 canvas.
  const dx = Math.abs(x1 - x0);
  const sx = x0 < x1 ? 1 : -1;
  const dy = -Math.abs(y1 - y0);
  const sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  let cx = x0;
  let cy = y0;
  const half = Math.floor(thickness / 2);
  while (true) {
    fillRect(cx - half, cy - half, thickness, thickness, rgb);
    if (cx === x1 && cy === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) {
      err += dy;
      cx += sx;
    }
    if (e2 <= dx) {
      err += dx;
      cy += sy;
    }
  }
}

// Minimal 5x7 bitmap font — same one used by the PWA icon script,
// extended to cover the few extra glyphs the OG image needs.
const FONT = {
  T: [
    [1, 1, 1, 1, 1],
    [0, 0, 1, 0, 0],
    [0, 0, 1, 0, 0],
    [0, 0, 1, 0, 0],
    [0, 0, 1, 0, 0],
    [0, 0, 1, 0, 0],
    [0, 0, 1, 0, 0],
  ],
  P: [
    [1, 1, 1, 1, 0],
    [1, 0, 0, 0, 1],
    [1, 0, 0, 0, 1],
    [1, 1, 1, 1, 0],
    [1, 0, 0, 0, 0],
    [1, 0, 0, 0, 0],
    [1, 0, 0, 0, 0],
  ],
  S: [
    [0, 1, 1, 1, 1],
    [1, 0, 0, 0, 0],
    [1, 0, 0, 0, 0],
    [0, 1, 1, 1, 0],
    [0, 0, 0, 0, 1],
    [0, 0, 0, 0, 1],
    [1, 1, 1, 1, 0],
  ],
  t: [
    [0, 1, 0, 0, 0],
    [1, 1, 1, 0, 0],
    [0, 1, 0, 0, 0],
    [0, 1, 0, 0, 0],
    [0, 1, 0, 0, 0],
    [0, 1, 0, 0, 0],
    [0, 0, 1, 1, 0],
  ],
  u: [
    [0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0],
    [1, 0, 0, 0, 1],
    [1, 0, 0, 0, 1],
    [1, 0, 0, 0, 1],
    [1, 0, 0, 0, 1],
    [0, 1, 1, 1, 1],
  ],
  d: [
    [0, 0, 0, 0, 1],
    [0, 0, 0, 0, 1],
    [0, 1, 1, 1, 1],
    [1, 0, 0, 0, 1],
    [1, 0, 0, 0, 1],
    [1, 0, 0, 0, 1],
    [0, 1, 1, 1, 1],
  ],
  i: [
    [0, 0, 1, 0, 0],
    [0, 0, 0, 0, 0],
    [0, 1, 1, 0, 0],
    [0, 0, 1, 0, 0],
    [0, 0, 1, 0, 0],
    [0, 0, 1, 0, 0],
    [0, 1, 1, 1, 0],
  ],
  o: [
    [0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0],
    [0, 1, 1, 1, 0],
    [1, 0, 0, 0, 1],
    [1, 0, 0, 0, 1],
    [1, 0, 0, 0, 1],
    [0, 1, 1, 1, 0],
  ],
  h: [
    [1, 0, 0, 0, 0],
    [1, 0, 0, 0, 0],
    [1, 1, 1, 1, 0],
    [1, 0, 0, 0, 1],
    [1, 0, 0, 0, 1],
    [1, 0, 0, 0, 1],
    [1, 0, 0, 0, 1],
  ],
  e: [
    [0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0],
    [0, 1, 1, 1, 0],
    [1, 0, 0, 0, 1],
    [1, 1, 1, 1, 1],
    [1, 0, 0, 0, 0],
    [0, 1, 1, 1, 1],
  ],
  r: [
    [0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0],
    [1, 0, 1, 1, 0],
    [1, 1, 0, 0, 1],
    [1, 0, 0, 0, 0],
    [1, 0, 0, 0, 0],
    [1, 0, 0, 0, 0],
  ],
  y: [
    [0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0],
    [1, 0, 0, 0, 1],
    [1, 0, 0, 0, 1],
    [0, 1, 1, 1, 1],
    [0, 0, 0, 0, 1],
    [1, 1, 1, 1, 0],
  ],
  f: [
    [0, 0, 1, 1, 0],
    [0, 1, 0, 0, 1],
    [0, 1, 0, 0, 0],
    [1, 1, 1, 0, 0],
    [0, 1, 0, 0, 0],
    [0, 1, 0, 0, 0],
    [0, 1, 0, 0, 0],
  ],
  c: [
    [0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0],
    [0, 1, 1, 1, 1],
    [1, 0, 0, 0, 0],
    [1, 0, 0, 0, 0],
    [1, 0, 0, 0, 0],
    [0, 1, 1, 1, 1],
  ],
  n: [
    [0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0],
    [1, 0, 1, 1, 0],
    [1, 1, 0, 0, 1],
    [1, 0, 0, 0, 1],
    [1, 0, 0, 0, 1],
    [1, 0, 0, 0, 1],
  ],
  s: [
    [0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0],
    [0, 1, 1, 1, 1],
    [1, 0, 0, 0, 0],
    [0, 1, 1, 1, 0],
    [0, 0, 0, 0, 1],
    [1, 1, 1, 1, 0],
  ],
  m: [
    [0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0],
    [1, 1, 0, 1, 0],
    [1, 0, 1, 0, 1],
    [1, 0, 1, 0, 1],
    [1, 0, 1, 0, 1],
    [1, 0, 1, 0, 1],
  ],
  a: [
    [0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0],
    [0, 1, 1, 1, 0],
    [0, 0, 0, 0, 1],
    [0, 1, 1, 1, 1],
    [1, 0, 0, 0, 1],
    [0, 1, 1, 1, 1],
  ],
  g: [
    [0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0],
    [0, 1, 1, 1, 1],
    [1, 0, 0, 0, 1],
    [0, 1, 1, 1, 1],
    [0, 0, 0, 0, 1],
    [0, 1, 1, 1, 0],
  ],
  ' ': [
    [0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0],
  ],
  ',': [
    [0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0],
    [0, 1, 0, 0, 0],
    [1, 0, 0, 0, 0],
  ],
  A: [
    [0, 0, 1, 0, 0],
    [0, 1, 0, 1, 0],
    [1, 0, 0, 0, 1],
    [1, 0, 0, 0, 1],
    [1, 1, 1, 1, 1],
    [1, 0, 0, 0, 1],
    [1, 0, 0, 0, 1],
  ],
  B: [
    [1, 1, 1, 1, 0],
    [1, 0, 0, 0, 1],
    [1, 0, 0, 0, 1],
    [1, 1, 1, 1, 0],
    [1, 0, 0, 0, 1],
    [1, 0, 0, 0, 1],
    [1, 1, 1, 1, 0],
  ],
  C: [
    [0, 1, 1, 1, 0],
    [1, 0, 0, 0, 1],
    [1, 0, 0, 0, 0],
    [1, 0, 0, 0, 0],
    [1, 0, 0, 0, 0],
    [1, 0, 0, 0, 1],
    [0, 1, 1, 1, 0],
  ],
  D: [
    [1, 1, 1, 1, 0],
    [1, 0, 0, 0, 1],
    [1, 0, 0, 0, 1],
    [1, 0, 0, 0, 1],
    [1, 0, 0, 0, 1],
    [1, 0, 0, 0, 1],
    [1, 1, 1, 1, 0],
  ],
};

function drawText(x, y, text, height, rgb) {
  const baseH = 7;
  const scale = Math.max(1, Math.floor(height / baseH));
  const gap = scale;
  let cx = x;
  for (const ch of text) {
    const glyph = FONT[ch];
    if (!glyph) {
      cx += scale * 5 + gap;
      continue;
    }
    for (let gy = 0; gy < glyph.length; gy++) {
      const row = glyph[gy];
      for (let gx = 0; gx < row.length; gx++) {
        if (!row[gx]) continue;
        fillRect(cx + gx * scale, y + gy * scale, scale, scale, rgb);
      }
    }
    cx += scale * 5 + gap;
  }
}

function setPx(x, y, rgb, alpha) {
  const idx = (y * W + x) * 4;
  pixels[idx + 0] = rgb[0];
  pixels[idx + 1] = rgb[1];
  pixels[idx + 2] = rgb[2];
  pixels[idx + 3] = alpha;
}

// --- PNG encoder (same as generate-pwa-icons.mjs) ------------------
function encodePng(width, height, rgba) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr.writeUInt8(8, 8);
  ihdr.writeUInt8(6, 9);
  ihdr.writeUInt8(0, 10);
  ihdr.writeUInt8(0, 11);
  ihdr.writeUInt8(0, 12);

  const raw = Buffer.alloc(height * (1 + width * 4));
  for (let y = 0; y < height; y++) {
    raw[y * (1 + width * 4)] = 0;
    Buffer.from(rgba.buffer, y * width * 4, width * 4).copy(
      raw,
      y * (1 + width * 4) + 1
    );
  }
  const idatData = deflateSync(raw, { level: 9 });

  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  return Buffer.concat([
    signature,
    makeChunk('IHDR', ihdr),
    makeChunk('IDAT', idatData),
    makeChunk('IEND', Buffer.alloc(0)),
  ]);
}

function makeChunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const crc = crc32(Buffer.concat([typeBuf, data]));
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc >>> 0, 0);
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return c ^ 0xffffffff;
}

// --- Draw the scene -----------------------------------------------
fillRect(0, 0, W, H, BG);
const RAIL_W = 8;
fillRect(0, 0, RAIL_W, H, INDIGO);

// Diagram silhouettes — five rounded chips arranged like an
// Evaporating Cloud (A on the left, B & C stacked in the middle, D
// and D′ stacked on the right) so the OG card communicates "this is
// a TOC diagram tool" at a glance.
const NODES = [
  { x: 720, y: 270, w: 220, h: 90, fill: INDIGO, label: 'A' },
  { x: 1000, y: 130, w: 180, h: 80, fill: EMERALD_500, label: 'B' },
  { x: 1000, y: 410, w: 180, h: 80, fill: AMBER_500, label: 'C' },
  { x: 540, y: 130, w: 160, h: 80, fill: ROSE_500, label: 'D' },
  { x: 540, y: 410, w: 160, h: 80, fill: SLATE_900, label: "D'" },
];

const EDGES = [
  ['A', 'B'],
  ['A', 'C'],
  ['B', 'D'],
  ['C', "D'"],
];
const byLabel = Object.fromEntries(NODES.map((n) => [n.label, n]));
for (const [from, to] of EDGES) {
  const a = byLabel[from];
  const b = byLabel[to];
  drawLine(a.x + a.w / 2, a.y + a.h / 2, b.x + b.w / 2, b.y + b.h / 2, SLATE_500, 3);
}
for (const n of NODES) {
  fillRoundedRect(n.x, n.y, n.w, n.h, 16, n.fill);
}

drawText(60, 130, 'TP', 180, INDIGO);
drawText(60, 280, 'Studio', 90, SLATE_900);
drawText(60, 400, 'Theory of Constraints', 28, SLATE_500);
drawText(60, 440, 'diagramming, fast', 28, SLATE_500);

const png = encodePng(W, H, pixels);
const out = join(publicDir, 'og-image.png');
writeFileSync(out, png);
const sha = createHash('sha1').update(png).digest('hex').slice(0, 8);
console.log(`wrote og-image.png (${W}×${H}, ${png.length}B, sha1:${sha})`);
