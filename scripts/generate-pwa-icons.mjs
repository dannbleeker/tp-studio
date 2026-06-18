// Session 89 / rev. Session 189 — generate the four PWA icons in
// public/ as PNGs.
//
// Pure-Node PNG encoder (no `sharp`, no `pngjs`) so the script runs
// against the repo's existing dependencies, with a small analytic
// rasteriser for the brand mark:
//   - neutral-900 (#171717) rounded-square background
//   - white lucide `git-branch` glyph, centred
//
// Session 189 swapped the old white "TP" monogram on indigo for the
// app's actual brand mark — the lucide `git-branch` glyph on a dark
// rounded square — so the installed-app / home-screen icon matches the
// in-app logo (`HomeLogo.tsx` / `StartSidebar.tsx`) AND the browser-tab
// favicon (`public/favicon.svg`). The glyph has curves (two rings + a
// quarter-arc), so the renderer is a signed-distance-field rasteriser
// supersampled 4× and box-downsampled for clean anti-aliasing — the old
// 5×7 bitmap-font path only handled axis-aligned monogram edges.
//
// Standard vs maskable: the standard icons keep the favicon's look — a
// rounded square with transparent corners. The maskable variants fill
// the whole canvas (opaque, square) so a platform mask (Android /
// Windows circle/squircle) never reveals a transparent corner; the
// glyph stays in the central safe zone either way (it spans ~29–71% of
// the canvas, comfortably inside the maskable 80% safe circle).
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

// neutral-900 square + white glyph — matches the in-app brand mark
// (Tailwind `bg-neutral-900` / `text-white`) and the favicon's
// light-mode colours. RGB triples.
const SQUARE = [0x17, 0x17, 0x17];
const GLYPH = [0xff, 0xff, 0xff];

// Supersample factor for anti-aliasing. Render at 4× then box-downsample
// — 16 samples per output pixel smooths the rings + arc without a
// drawing library.
const SS = 4;

// Corner radius of the standard (non-maskable) rounded square, as a
// fraction of the side. Matches the favicon's 6/32 ≈ 0.1875.
const CORNER_FRACTION = 0.1875;

// The glyph's 24-unit lucide viewBox is scaled to this fraction of the
// canvas and centred — mirrors the favicon (16px glyph in a 32px square).
const GLYPH_FRACTION = 0.5;

// --- git-branch glyph geometry (lucide v1.16, 24-unit viewBox) -------
// Path `M15 6 a9 9 0 0 0 -9 9 V3` + two `r=3` circles, all stroked at
// width 2 with round caps/joins. Expressed here as centreline distance
// fields so the stroke (and its round caps/joins) fall out of a single
// `<= halfStroke` test.
const STROKE_HALF = 1; // half of lucide stroke-width 2, in glyph units

// Vertical segment of the path: from (6,3) down to (6,15).
const SEG_A = [6, 3];
const SEG_B = [6, 15];
// Quarter-arc of the path: centre (15,15), radius 9, sweeping the
// upper-left quadrant (angles π‥3π/2) between (15,6) and (6,15).
const ARC_C = [15, 15];
const ARC_R = 9;
const ARC_E1 = [15, 6];
const ARC_E2 = [6, 15];
// The two branch nodes (stroked rings).
const RING1 = [18, 6];
const RING2 = [6, 18];
const RING_R = 3;

function hypot(dx, dy) {
  return Math.sqrt(dx * dx + dy * dy);
}

/** Distance from p to the line segment a→b (round-capped: outside the
 *  segment span the nearest point is an endpoint). */
function distSegment(px, py, a, b) {
  const vx = b[0] - a[0];
  const vy = b[1] - a[1];
  const wx = px - a[0];
  const wy = py - a[1];
  const len2 = vx * vx + vy * vy;
  let t = len2 === 0 ? 0 : (wx * vx + wy * vy) / len2;
  t = Math.max(0, Math.min(1, t));
  return hypot(px - (a[0] + t * vx), py - (a[1] + t * vy));
}

/** Distance from p to the quarter-arc (centre ARC_C, radius ARC_R). On
 *  the arc's angular span → radial distance; outside it → distance to the
 *  nearer endpoint, which gives the round caps. */
function distArc(px, py) {
  let ang = Math.atan2(py - ARC_C[1], px - ARC_C[0]);
  if (ang < 0) ang += 2 * Math.PI; // normalise to [0, 2π)
  if (ang >= Math.PI && ang <= 1.5 * Math.PI) {
    return Math.abs(hypot(px - ARC_C[0], py - ARC_C[1]) - ARC_R);
  }
  return Math.min(hypot(px - ARC_E1[0], py - ARC_E1[1]), hypot(px - ARC_E2[0], py - ARC_E2[1]));
}

/** Distance from p to a stroked ring's centreline circle. */
function distRing(px, py, c) {
  return Math.abs(hypot(px - c[0], py - c[1]) - RING_R);
}

/** True if (gx,gy) in 24-unit glyph space is inside the stroked glyph. */
function inGlyph(gx, gy) {
  const d = Math.min(
    distSegment(gx, gy, SEG_A, SEG_B),
    distArc(gx, gy),
    distRing(gx, gy, RING1),
    distRing(gx, gy, RING2)
  );
  return d <= STROKE_HALF;
}

/** True if (x,y) in [0,S) is inside the rounded square of side S with the
 *  given corner radius. */
function inRoundedSquare(x, y, S, radius) {
  const dx = Math.max(radius - x, x - (S - 1 - radius), 0);
  const dy = Math.max(radius - y, y - (S - 1 - radius), 0);
  return dx * dx + dy * dy <= radius * radius;
}

/** Build a size×size RGBA buffer for the icon, supersampled SS× and
 *  box-downsampled (premultiplied alpha) for anti-aliasing. */
function buildIcon(size, { maskable }) {
  const S = size * SS;
  const radius = CORNER_FRACTION * S;
  // Map glyph 24-unit space → supersampled pixels.
  const glyphPx = GLYPH_FRACTION * S;
  const scale = glyphPx / 24;
  const origin = (S - glyphPx) / 2;

  // Hi-res RGBA: index 0..3 per pixel.
  const hi = new Uint8Array(S * S * 4);
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const idx = (y * S + x) * 4;
      // Glyph test in 24-unit space (sample pixel centre).
      const gx = (x + 0.5 - origin) / scale;
      const gy = (y + 0.5 - origin) / scale;
      const onGlyph = gx >= 0 && gx <= 24 && gy >= 0 && gy <= 24 && inGlyph(gx, gy);
      // Background: full-bleed for maskable, rounded for standard.
      const onSquare = maskable || inRoundedSquare(x, y, S, radius);
      if (onGlyph) {
        hi[idx] = GLYPH[0];
        hi[idx + 1] = GLYPH[1];
        hi[idx + 2] = GLYPH[2];
        hi[idx + 3] = 0xff;
      } else if (onSquare) {
        hi[idx] = SQUARE[0];
        hi[idx + 1] = SQUARE[1];
        hi[idx + 2] = SQUARE[2];
        hi[idx + 3] = 0xff;
      }
      // else: leave transparent (zero-initialised).
    }
  }

  // Box-downsample SS×SS → 1, premultiplied-alpha so the rounded-corner
  // edge doesn't fringe toward black.
  const out = new Uint8Array(size * size * 4);
  for (let oy = 0; oy < size; oy++) {
    for (let ox = 0; ox < size; ox++) {
      let r = 0;
      let g = 0;
      let b = 0;
      let aSum = 0;
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const sidx = ((oy * SS + sy) * S + (ox * SS + sx)) * 4;
          const af = hi[sidx + 3] / 255;
          r += hi[sidx] * af;
          g += hi[sidx + 1] * af;
          b += hi[sidx + 2] * af;
          aSum += hi[sidx + 3];
        }
      }
      const n = SS * SS;
      const sumAf = aSum / 255;
      const oidx = (oy * size + ox) * 4;
      out[oidx] = sumAf > 0 ? Math.round(r / sumAf) : 0;
      out[oidx + 1] = sumAf > 0 ? Math.round(g / sumAf) : 0;
      out[oidx + 2] = sumAf > 0 ? Math.round(b / sumAf) : 0;
      out[oidx + 3] = Math.round(aSum / n);
    }
  }
  return out;
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
    Buffer.from(rgba.buffer, y * width * 4, width * 4).copy(raw, y * (1 + width * 4) + 1);
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
  { name: 'icon-192.png', size: 192, maskable: false },
  { name: 'icon-512.png', size: 512, maskable: false },
  { name: 'icon-192-maskable.png', size: 192, maskable: true },
  { name: 'icon-512-maskable.png', size: 512, maskable: true },
];

for (const t of targets) {
  const rgba = buildIcon(t.size, { maskable: t.maskable });
  const png = encodePng(t.size, t.size, rgba);
  const out = join(publicDir, t.name);
  writeFileSync(out, png);
  const sha = createHash('sha1').update(png).digest('hex').slice(0, 8);
  console.log(`wrote ${t.name} (${t.size}×${t.size}, ${png.length}B, sha1:${sha})`);
}
