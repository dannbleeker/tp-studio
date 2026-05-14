// Session 89 — generate the four PWA icons in public/ as PNGs.
//
// Pure-Node PNG encoder (no `sharp`, no `pngjs`) so the script runs
// against the repo's existing dependencies. The icons are simple
// enough that hand-rolling RGBA + zlib is cheaper than dragging in a
// drawing library:
//   - indigo-500 (#6366f1) rounded-square background
//   - white "TP" monogram, centred
//
// The maskable variants keep the visual within the central 80% safe
// zone (Android / Windows clip the outer 10% to fit their masks). We
// achieve that here by simply scaling the monogram down to 60% of the
// canvas — leaving generous padding for any platform mask shape.
//
// Run with: `node scripts/generate-pwa-icons.mjs`. Idempotent.

import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateSync } from 'node:zlib';

const here = dirname(fileURLToPath(import.meta.url));
const publicDir = join(here, '..', 'public');
mkdirSync(publicDir, { recursive: true });

// Indigo-500 (matches Tailwind's `indigo-500` and the manifest's
// `theme_color`). RGB triple.
const BG = [0x63, 0x66, 0xf1];
// White monogram.
const FG = [0xff, 0xff, 0xff];

// 5x7 bitmap font for the letters T and P. Each row is 5 bits left to
// right; 1 = foreground, 0 = background. Enough to render "TP".
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
};

/** Build a size×size RGBA buffer for the icon. `safeZoneFraction`
 *  controls how big the monogram is relative to the canvas — 0.85 for
 *  the standard icon (just inset from the rounded corners), 0.55 for
 *  the maskable variant so platform mask clipping never touches the
 *  monogram. */
function buildIcon(size, safeZoneFraction) {
  const pixels = new Uint8Array(size * size * 4);

  // Background — solid indigo-500 with rounded corners. Corner radius
  // is ~20% of the canvas side (matches the PWA "rounded square"
  // aesthetic; Android wraps the maskable variant with its own mask
  // so the radius there is irrelevant — the padding does the work).
  const radius = Math.round(size * 0.2);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const inCorner = isOutsideRoundedSquare(x, y, size, radius);
      const idx = (y * size + x) * 4;
      if (inCorner) {
        pixels[idx + 0] = 0;
        pixels[idx + 1] = 0;
        pixels[idx + 2] = 0;
        pixels[idx + 3] = 0; // transparent
      } else {
        pixels[idx + 0] = BG[0];
        pixels[idx + 1] = BG[1];
        pixels[idx + 2] = BG[2];
        pixels[idx + 3] = 0xff;
      }
    }
  }

  // Monogram — "TP" rendered at glyph height = safeZoneFraction * size.
  // The 5x7 base bitmap scales by integer multiples so anti-aliasing
  // isn't an issue at the sizes we ship (192 / 512).
  const charsT = FONT.T;
  const charsP = FONT.P;
  const baseGlyphW = 5;
  const baseGlyphH = 7;
  const baseGap = 2; // gap between T and P in font-units
  const baseTextW = baseGlyphW * 2 + baseGap;

  const safeSize = size * safeZoneFraction;
  // Scale the glyph so the *text block* (T + gap + P) fits inside the
  // safe zone. Then enforce an integer pixel scale so the edges stay
  // crisp without AA.
  const scale = Math.floor(Math.min(safeSize / baseTextW, safeSize / baseGlyphH));
  const scaledTextW = baseTextW * scale;
  const scaledTextH = baseGlyphH * scale;
  const startX = Math.round((size - scaledTextW) / 2);
  const startY = Math.round((size - scaledTextH) / 2);

  drawGlyph(pixels, size, startX, startY, scale, charsT);
  drawGlyph(pixels, size, startX + (baseGlyphW + baseGap) * scale, startY, scale, charsP);

  return pixels;
}

function isOutsideRoundedSquare(x, y, size, radius) {
  // Check each of the four corners. Outside the rounded arc → return
  // true so the caller fills transparent (instead of indigo).
  const corners = [
    [radius, radius], // top-left
    [size - 1 - radius, radius], // top-right
    [radius, size - 1 - radius], // bottom-left
    [size - 1 - radius, size - 1 - radius], // bottom-right
  ];
  for (const [cx, cy] of corners) {
    const inXSide = x < cx ? 'left' : x > cx ? 'right' : 'center';
    const inYSide = y < cy ? 'top' : y > cy ? 'bottom' : 'center';
    // Only outside the rounded square if both x and y are on the
    // *outer* side of this corner's centre.
    if (
      (cx === radius && inXSide === 'left' && cy === radius && inYSide === 'top') ||
      (cx === size - 1 - radius &&
        inXSide === 'right' &&
        cy === radius &&
        inYSide === 'top') ||
      (cx === radius &&
        inXSide === 'left' &&
        cy === size - 1 - radius &&
        inYSide === 'bottom') ||
      (cx === size - 1 - radius &&
        inXSide === 'right' &&
        cy === size - 1 - radius &&
        inYSide === 'bottom')
    ) {
      const dx = x - cx;
      const dy = y - cy;
      if (dx * dx + dy * dy > radius * radius) return true;
    }
  }
  return false;
}

function drawGlyph(pixels, size, originX, originY, scale, glyph) {
  for (let gy = 0; gy < glyph.length; gy++) {
    const row = glyph[gy];
    for (let gx = 0; gx < row.length; gx++) {
      if (!row[gx]) continue;
      for (let dy = 0; dy < scale; dy++) {
        for (let dx = 0; dx < scale; dx++) {
          const px = originX + gx * scale + dx;
          const py = originY + gy * scale + dy;
          if (px < 0 || px >= size || py < 0 || py >= size) continue;
          const idx = (py * size + px) * 4;
          pixels[idx + 0] = FG[0];
          pixels[idx + 1] = FG[1];
          pixels[idx + 2] = FG[2];
          pixels[idx + 3] = 0xff;
        }
      }
    }
  }
}

// --- PNG encoder ---------------------------------------------------
// Minimum-viable PNG writer. Color type 6 (RGBA), 8 bits per channel,
// no filter (filter byte 0 per scanline). Each chunk is
// length(4) | type(4) | data(len) | crc32(4).

function encodePng(width, height, rgba) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr.writeUInt8(8, 8); // bit depth
  ihdr.writeUInt8(6, 9); // color type RGBA
  ihdr.writeUInt8(0, 10); // compression
  ihdr.writeUInt8(0, 11); // filter
  ihdr.writeUInt8(0, 12); // interlace

  // Add filter byte (0 = None) to each scanline.
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

// Standard PNG CRC32 (table-driven).
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

// --- Emit the four files ------------------------------------------
const targets = [
  { name: 'icon-192.png', size: 192, safe: 0.85 },
  { name: 'icon-512.png', size: 512, safe: 0.85 },
  { name: 'icon-192-maskable.png', size: 192, safe: 0.55 },
  { name: 'icon-512-maskable.png', size: 512, safe: 0.55 },
];

for (const t of targets) {
  const rgba = buildIcon(t.size, t.safe);
  const png = encodePng(t.size, t.size, rgba);
  const out = join(publicDir, t.name);
  writeFileSync(out, png);
  const sha = createHash('sha1').update(png).digest('hex').slice(0, 8);
  console.log(`wrote ${t.name} (${t.size}×${t.size}, ${png.length}B, sha1:${sha})`);
}
