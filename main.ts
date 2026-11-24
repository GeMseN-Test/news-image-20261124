// Tuesday 24 November 2026 - The World in One Picture.
// A single broadsheet front page: 36 dated world-news stories from Tuesday
// 24 November 2026, drawn with a hand-rolled PNG writer. Node 22+,
// standard library only, no network. Deterministic: two runs write
// identical bytes. Two fonts on purpose: a FILLED 5x7 block font for the
// masthead date and big numbers (bold newspaper headline, legible at a
// glance) and a single-stroke caps font for body copy. Rich visuals: paper
// grain, gradient skies, a drawn scene in every panel, halftone dots.
// Usage: mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { deflateSync } from 'node:zlib';

// ---------------------------------------------------------------- canvas
const W = 1024, H = 1024;
const px = new Uint8Array(W * H * 3);
const PAPER = [246, 241, 229];
const INK = [25, 25, 25];
const RED = [158, 27, 27];
const RED2 = [190, 40, 32];
const NAVY = [30, 58, 95];
const NAVY2 = [18, 38, 66];
const TEAL = [15, 91, 77];
const GOLD = [176, 124, 18];
const GOLD2 = [212, 160, 40];
const SKY = [214, 228, 235];
const SEA = [196, 219, 228];
const LAND = [232, 214, 178];
const LAND2 = [216, 196, 158];
const GREY = [110, 108, 100];
const WHITE = [255, 255, 255];
const CREAM2 = [238, 231, 214];
const TINTA = [250, 246, 236];
const TINTB = [240, 236, 222];
const GREEN = [27, 110, 60];
const AMBER = [176, 90, 10];
const DARK = [38, 38, 44];
const PINK = [214, 150, 150];

// Paint the whole canvas one colour.
function fill(c) {
  for (let i = 0; i < px.length; i += 3) {
    px[i] = c[0]; px[i + 1] = c[1]; px[i + 2] = c[2];
  }
}
// Plot a single pixel; silently ignore anything outside the canvas.
function set(x, y, c) {
  if (x < 0 || x >= W || y < 0 || y >= H) return;
  const o = (y * W + x) * 3;
  px[o] = c[0]; px[o + 1] = c[1]; px[o + 2] = c[2];
}
function get(x, y) {
  if (x < 0 || x >= W || y < 0 || y >= H) return [0, 0, 0];
  const o = (y * W + x) * 3;
  return [px[o], px[o + 1], px[o + 2]];
}
// Solid rectangle, clipped to the canvas.
function rect(x, y, w, h, c) {
  const rx = Math.round(x), ry = Math.round(y);
  const x0 = Math.max(0, rx), y0 = Math.max(0, ry);
  const x1 = Math.min(W, rx + Math.round(w)), y1 = Math.min(H, ry + Math.round(h));
  for (let yy = y0; yy < y1; yy++) {
    for (let xx = x0; xx < x1; xx++) set(xx, yy, c);
  }
}
// Bresenham line with a square brush of width w.
function line(x0, y0, x1, y1, c, w = 1) {
  let ax = Math.round(x0), ay = Math.round(y0);
  const bx = Math.round(x1), by = Math.round(y1);
  const dx = Math.abs(bx - ax), dy = Math.abs(by - ay);
  const sx = ax < bx ? 1 : -1, sy = ay < by ? 1 : -1;
  const half = Math.floor(w / 2);
  let err = dx - dy;
  for (;;) {
    for (let oy = -half; oy <= half; oy++) {
      for (let ox = -half; ox <= half; ox++) set(ax + ox, ay + oy, c);
    }
    if (ax === bx && ay === by) break;
    const e2 = 2 * err;
    if (e2 > -dy) { err -= dy; ax += sx; }
    if (e2 < dx) { err += dx; ay += sy; }
  }
}
// Disc, filled by default; with fillIt false only its rim is drawn.
function circle(cx, cy, r, c, fillIt = true) {
  const ccx = Math.round(cx), ccy = Math.round(cy), rr = Math.round(r);
  const outer = rr * rr, inner = (rr - 1) * (rr - 1);
  for (let yy = -rr; yy <= rr; yy++) {
    for (let xx = -rr; xx <= rr; xx++) {
      const d2 = xx * xx + yy * yy;
      if (fillIt ? d2 <= outer : (d2 <= outer && d2 >= inner)) set(ccx + xx, ccy + yy, c);
    }
  }
}
// Filled polygon, scanline by scanline.
function poly(points, c) {
  let top = 1e9, bottom = -1e9;
  for (const p of points) {
    top = Math.min(top, p[1]);
    bottom = Math.max(bottom, p[1]);
  }
  for (let y = Math.ceil(top); y <= Math.floor(bottom); y++) {
    const cuts = [];
    for (let i = 0; i < points.length; i++) {
      const a = points[i], b = points[(i + 1) % points.length];
      if ((a[1] <= y && b[1] > y) || (b[1] <= y && a[1] > y)) {
        cuts.push(a[0] + (y - a[1]) * (b[0] - a[0]) / (b[1] - a[1]));
      }
    }
    cuts.sort((m, n) => m - n);
    for (let k = 0; k + 1 < cuts.length; k += 2) {
      for (let x = Math.ceil(cuts[k]); x <= Math.floor(cuts[k + 1]); x++) set(x, y, c);
    }
  }
}
function polyLine(points, c, w = 1) {
  for (let i = 1; i < points.length; i++) {
    line(points[i - 1][0], points[i - 1][1], points[i][0], points[i][1], c, w);
  }
}
// Blend two RGB colours: t = 0 gives a, t = 1 gives b.
function lerpC(a, b, t) {
  const out = [0, 0, 0];
  for (let i = 0; i < 3; i++) out[i] = Math.round(a[i] + (b[i] - a[i]) * t);
  return out;
}
function vgrad(x, y, w, h, c1, c2) {
  for (let yy = 0; yy < h; yy++) {
    const t = h <= 1 ? 0 : yy / (h - 1);
    rect(x, y + yy, w, 1, lerpC(c1, c2, t));
  }
}
function hgrad(x, y, w, h, c1, c2) {
  for (let xx = 0; xx < w; xx++) {
    const t = w <= 1 ? 0 : xx / (w - 1);
    rect(x + xx, y, 1, h, lerpC(c1, c2, t));
  }
}
// Deterministic hash noise for paper grain (seeded, no Math.random).
function hash2(x, y) {
  let h = (y * 668265263 + x * 374761393) | 0;
  h = (h ^ (h >> 13)) | 0;
  h = Math.imul(h, 1274126177);
  h = (h ^ (h >> 16)) >>> 0;
  return h / 4294967295;
}
const GRAIN = 1;
function grain() {
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const d = Math.round((hash2(x, y) - 0.5) * 2 * GRAIN);
      if (!d) continue;
      const i = (y * W + x) * 3;
      for (let k = 0; k < 3; k++) px[i + k] = Math.max(0, Math.min(255, px[i + k] + d));
    }
  }
}
// Staggered halftone dots over a box.
function dots(x, y, w, h, c, gap = 6, r = 1) {
  for (let yy = y + 3; yy < y + h - 2; yy += gap) {
    const row = Math.floor((yy - y) / gap) % 2;
    for (let xx = x + 3 + (row * gap) / 2; xx < x + w - 2; xx += gap) circle(xx, yy, r, c);
  }
}

// ---------------------------------------------------------------- PNG writer
// CRC-32 (IEEE 802.3) lookup table, built once when the program loads.
const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = (c & 1) !== 0 ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    }
    table[n] = c;
  }
  return table;
})();
function crc32(buf) {
  let c = 0xFFFFFFFF;
  for (const byte of buf) c = CRC_TABLE[(c ^ byte) & 0xFF] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
}
// One PNG chunk: 4-byte length, type, data, then the CRC over type + data.
function pngChunk(type, data) {
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const out = Buffer.alloc(body.length + 8);
  out.writeUInt32BE(data.length, 0);
  body.copy(out, 4);
  out.writeUInt32BE(crc32(body), body.length + 4);
  return out;
}
function writePNG(path) {
  const stride = W * 3 + 1; // one filter byte per scanline, filter type 0
  const raw = Buffer.alloc(stride * H);
  for (let y = 0; y < H; y++) {
    raw[y * stride] = 0;
    raw.set(px.subarray(y * W * 3, (y + 1) * W * 3), y * stride + 1);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(W, 0);
  ihdr.writeUInt32BE(H, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // colour type 2 = truecolour RGB
  ihdr[10] = 0; // compression: deflate
  ihdr[11] = 0; // filter: adaptive, we use 0
  ihdr[12] = 0; // interlace: none
  const png = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]),
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', deflateSync(raw, { level: 9 })),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
  writeFileSync(path, png);
  return png.length;
}

// ---------------------------------------------------------------- fonts
// Single-stroke capitals on a 5x7 grid (x 0..4, y 0..6). Fixed advance 6 units.
// Stored as compact stroke strings: each glyph is "x0,y0,x1,y1;..." — one
// segment per group, parsed by drawText. Same letterforms as any 5x7 face,
// written here as plain coordinate text instead of nested arrays.
const GLYPHS = {
  A: '0,6,2,0;2,0,4,6;1,4,3,4',
  B: '0,0,0,6;0,0,3,0;3,0,4,1;4,1,4,2;4,2,3,3;3,3,0,3;3,3,4,4;4,4,4,5;4,5,3,6;3,6,0,6',
  C: '4,1,3,0;3,0,1,0;1,0,0,1;0,1,0,5;0,5,1,6;1,6,3,6;3,6,4,5',
  D: '0,0,0,6;0,0,3,0;3,0,4,1;4,1,4,5;4,5,3,6;3,6,0,6',
  E: '4,0,0,0;0,0,0,6;0,6,4,6;0,3,3,3',
  F: '0,0,0,6;0,0,4,0;0,3,3,3',
  G: '4,1,3,0;3,0,1,0;1,0,0,1;0,1,0,5;0,5,1,6;1,6,3,6;3,6,4,5;4,5,4,3;4,3,2,3',
  H: '0,0,0,6;4,0,4,6;0,3,4,3',
  I: '1,0,3,0;2,0,2,6;1,6,3,6',
  J: '4,0,4,5;4,5,3,6;3,6,1,6;1,6,0,5;0,5,0,4',
  K: '0,0,0,6;4,0,0,3;0,3,4,6',
  L: '0,0,0,6;0,6,4,6',
  M: '0,6,0,0;0,0,2,3;2,3,4,0;4,0,4,6',
  N: '0,6,0,0;0,0,4,6;4,6,4,0',
  O: '1,0,3,0;3,0,4,1;4,1,4,5;4,5,3,6;3,6,1,6;1,6,0,5;0,5,0,1;0,1,1,0',
  P: '0,6,0,0;0,0,3,0;3,0,4,1;4,1,4,2;4,2,3,3;3,3,0,3',
  Q: '1,0,3,0;3,0,4,1;4,1,4,5;4,5,3,6;3,6,1,6;1,6,0,5;0,5,0,1;0,1,1,0;3,4,4,6',
  R: '0,6,0,0;0,0,3,0;3,0,4,1;4,1,4,2;4,2,3,3;3,3,0,3;2,3,4,6',
  S: '4,1,3,0;3,0,1,0;1,0,0,1;0,1,0,2;0,2,1,3;1,3,3,3;3,3,4,4;4,4,4,5;4,5,3,6;3,6,1,6;1,6,0,5',
  T: '0,0,4,0;2,0,2,6',
  U: '0,0,0,5;0,5,1,6;1,6,3,6;3,6,4,5;4,5,4,0',
  V: '0,0,2,6;2,6,4,0',
  W: '0,0,1,6;1,6,2,3;2,3,3,6;3,6,4,0',
  X: '0,0,4,6;4,0,0,6',
  Y: '0,0,2,3;4,0,2,3;2,3,2,6',
  Z: '0,0,4,0;4,0,0,6;0,6,4,6',
  '0': '1,0,3,0;3,0,4,1;4,1,4,5;4,5,3,6;3,6,1,6;1,6,0,5;0,5,0,1;0,1,1,0;1,5,3,1',
  '1': '1,1,2,0;2,0,2,6;0,6,4,6',
  '2': '0,1,1,0;1,0,3,0;3,0,4,1;4,1,4,2;4,2,3,3;3,3,0,6;0,6,4,6',
  '3': '0,0,4,0;4,0,4,6;0,3,3,3;0,6,4,6',
  '4': '0,0,0,3;0,3,4,3;3,0,3,6',
  '5': '4,0,0,0;0,0,0,3;0,3,3,3;3,3,4,4;4,4,4,5;4,5,3,6;3,6,1,6;1,6,0,5',
  '6': '4,1,3,0;3,0,1,0;1,0,0,2;0,2,0,5;0,5,1,6;1,6,3,6;3,6,4,5;4,5,4,3;4,3,3,2;3,2,1,2;1,2,0,3',
  '7': '0,0,4,0;4,0,1,6',
  '8': '1,0,3,0;3,0,4,1;4,1,4,2;4,2,3,3;3,3,1,3;1,3,0,2;0,2,0,1;0,1,1,0;1,3,0,4;0,4,0,5;0,5,1,6;1,6,3,6;3,6,4,5;4,5,4,4;4,4,3,3',
  '9': '1,0,3,0;3,0,4,1;4,1,4,3;4,3,3,4;3,4,1,4;1,4,0,3;0,3,0,1;0,1,1,0;4,1,4,6',
  '.': '2,5,2,5',
  ',': '2,5,2,5;1,6,2,5',
  ':': '2,1,2,1;2,4,2,4',
  ';': '2,1,2,1;2,4,2,4;1,6,2,4',
  "'": '2,0,1,2',
  '-': '0,3,4,3',
  '/': '4,6,0,0',
  '(': '3,0,2,0;2,0,1,1;1,1,1,5;1,5,2,6;2,6,3,6',
  ')': '1,0,2,0;2,0,3,1;3,1,3,5;3,5,2,6;2,6,1,6',
  '%': '4,0,0,6;0,0,1,0;1,0,1,1;1,1,0,1;0,1,0,0;3,5,4,5;4,5,4,6;4,6,3,6;3,6,3,5',
  '+': '2,1,2,5;0,3,4,3',
  '=': '0,2,4,2;0,4,4,4',
  '?': '1,1,1,0;1,0,3,0;3,0,4,1;4,1,4,2;4,2,3,3;3,3,2,3;2,4,2,4;2,6,2,6',
  '!': '2,0,2,4;2,6,2,6',
  '$': '3,1,2,0;2,0,1,0;1,0,0,1;0,1,0,2;0,2,1,3;1,3,3,3;3,3,4,4;4,4,4,5;4,5,3,6;3,6,1,6;1,6,0,5;2,0,2,6',
  '·': '2,3,2,3',
  ' ': '',
};

function textWidth(s, sc) { return s.length * 6 * sc; }
function drawText(x, y, s, sc, c, strokeW) {
  s = s.toUpperCase();
  const w = strokeW ?? Math.max(1, Math.round(sc * 0.7));
  let cx = x;
  for (const ch of s) {
    const strokes = GLYPHS[ch] ?? GLYPHS['?'];
    if (strokes) {
      for (const seg of strokes.split(';')) {
        const p = seg.split(',').map(Number);
        line(cx + p[0] * sc, y + p[1] * sc, cx + p[2] * sc, y + p[3] * sc, c, w);
      }
    }
    cx += 6 * sc;
  }
  return cx;
}
function drawTextC(x, y, s, sc, c, strokeW) { // centred on x
  return drawText(x - textWidth(s, sc) / 2, y, s, sc, c, strokeW);
}
function wrapText(s, maxW, sc) {
  const maxChars = Math.max(1, Math.floor(maxW / (6 * sc)));
  const words = s.split(' ');
  const lines = [];
  let cur = '';
  for (const w of words) {
    const next = cur ? cur + ' ' + w : w;
    if (next.length <= maxChars) { cur = next; continue; }
    if (cur) lines.push(cur);
    if (w.length > maxChars) {
      let rest = w;
      while (rest.length > maxChars) { lines.push(rest.slice(0, maxChars)); rest = rest.slice(maxChars); }
      cur = rest;
    } else cur = w;
  }
  if (cur) lines.push(cur);
  return lines;
}
function drawPara(x, y, s, sc, c, maxW, lh, maxLines) {
  const lines = wrapText(s, maxW, sc).slice(0, maxLines ?? 99);
  for (let i = 0; i < lines.length; i++) drawText(x, y + i * (lh ?? Math.round(9 * sc)), lines[i], sc, c);
  return lines.length;
}

// ---------------------------------------------------------------- block font
// FILLED 5x7 bitmap font ('1' = filled cell) for the masthead date and the
// big numbers. Bold, solid letters: a real newspaper headline, not a wire
// outline. Advance 6 cells. '·' and space included; unknown chars -> '?'.
const BLOCK = {
  A: ['01110', '10001', '10001', '11111', '10001', '10001', '10001'],
  B: ['11110', '10001', '10001', '11110', '10001', '10001', '11110'],
  C: ['01110', '10001', '10000', '10000', '10000', '10001', '01110'],
  D: ['11110', '10001', '10001', '10001', '10001', '10001', '11110'],
  E: ['11111', '10000', '10000', '11110', '10000', '10000', '11111'],
  F: ['11111', '10000', '10000', '11110', '10000', '10000', '10000'],
  G: ['01110', '10001', '10000', '10111', '10001', '10001', '01111'],
  H: ['10001', '10001', '10001', '11111', '10001', '10001', '10001'],
  I: ['01110', '00100', '00100', '00100', '00100', '00100', '01110'],
  J: ['00111', '00010', '00010', '00010', '00010', '10010', '01100'],
  K: ['10001', '10010', '10100', '11000', '10100', '10010', '10001'],
  L: ['10000', '10000', '10000', '10000', '10000', '10000', '11111'],
  M: ['10001', '11011', '10101', '10101', '10001', '10001', '10001'],
  N: ['10001', '11001', '10101', '10011', '10001', '10001', '10001'],
  O: ['01110', '10001', '10001', '10001', '10001', '10001', '01110'],
  P: ['11110', '10001', '10001', '11110', '10000', '10000', '10000'],
  Q: ['01110', '10001', '10001', '10001', '10101', '10010', '01101'],
  R: ['11110', '10001', '10001', '11110', '10100', '10010', '10001'],
  S: ['01111', '10000', '10000', '01110', '00001', '00001', '11110'],
  T: ['11111', '00100', '00100', '00100', '00100', '00100', '00100'],
  U: ['10001', '10001', '10001', '10001', '10001', '10001', '01110'],
  V: ['10001', '10001', '10001', '10001', '10001', '01010', '00100'],
  W: ['10001', '10001', '10001', '10101', '10101', '11011', '10001'],
  X: ['10001', '10001', '01010', '00100', '01010', '10001', '10001'],
  Y: ['10001', '10001', '01010', '00100', '00100', '00100', '00100'],
  Z: ['11111', '00001', '00010', '00100', '01000', '10000', '11111'],
  '0': ['01110', '10001', '10011', '10101', '11001', '10001', '01110'],
  '1': ['00100', '01100', '00100', '00100', '00100', '00100', '01110'],
  '2': ['01110', '10001', '00001', '00010', '00100', '01000', '11111'],
  '3': ['11110', '00001', '00001', '01110', '00001', '00001', '11110'],
  '4': ['00010', '00110', '01010', '10010', '11111', '00010', '00010'],
  '5': ['11111', '10000', '11110', '00001', '00001', '10001', '01110'],
  '6': ['00110', '01000', '10000', '11110', '10001', '10001', '01110'],
  '7': ['11111', '00001', '00010', '00100', '01000', '01000', '01000'],
  '8': ['01110', '10001', '10001', '01110', '10001', '10001', '01110'],
  '9': ['01110', '10001', '10001', '01111', '00001', '00010', '01100'],
  '$': ['00100', '01111', '10100', '01110', '00101', '11110', '00100'],
  ',': ['00000', '00000', '00000', '00000', '00110', '00100', '01000'],
  '.': ['00000', '00000', '00000', '00000', '00000', '01100', '01100'],
  '-': ['00000', '00000', '00000', '01110', '00000', '00000', '00000'],
  '%': ['11001', '11010', '00010', '00100', '01000', '01011', '10011'],
  ':': ['00000', '01100', '00000', '00000', '00000', '01100', '00000'],
  "'": ['00100', '00100', '00100', '00000', '00000', '00000', '00000'],
  '·': ['00000', '00000', '00000', '01100', '01100', '00000', '00000'],
  ' ': ['00000', '00000', '00000', '00000', '00000', '00000', '00000'],
  '?': ['01110', '10001', '00001', '00110', '00100', '00000', '00100'],
};
function blockWidth(s, sc) { return s.length * 6 * sc; }
function drawBlock(x, y, s, sc, c) {
  s = s.toUpperCase();
  let cx = x;
  for (const ch of s) {
    const g = BLOCK[ch] ?? BLOCK['?'];
    for (let r = 0; r < 7; r++)
      for (let cc = 0; cc < 5; cc++)
        if (g[r][cc] === '1') rect(cx + cc * sc, y + r * sc, sc, sc, c);
    cx += 6 * sc;
  }
  return cx;
}
function drawBlockC(x, y, s, sc, c) {
  return drawBlock(x - blockWidth(s, sc) / 2, y, s, sc, c);
}

// ---------------------------------------------------------------- scenes
// A drawn mini-illustration inside a box (x, y, w, h). Filled shapes,
// gradients and dots on purpose: flat line art compresses to nothing.
function sunDisc(cx, cy, r, c) {
  circle(cx, cy, r, c);
  for (let a = 0; a < 8; a++) {
    const t = a * Math.PI / 4;
    line(cx + Math.cos(t) * (r + 2), cy + Math.sin(t) * (r + 2), cx + Math.cos(t) * (r + 6), cy + Math.sin(t) * (r + 6), c, 2);
  }
}
function ridge(x, y, w, h, c, snow) {
  poly([[x, y + h], [x + w * 0.25, y + h * 0.1], [x + w * 0.5, y + h], [x + w * 0.75, y + h * 0.25], [x + w, y + h]], c);
  if (snow) {
    poly([[x + w * 0.25, y + h * 0.1], [x + w * 0.18, y + h * 0.32], [x + w * 0.32, y + h * 0.32]], WHITE);
    poly([[x + w * 0.75, y + h * 0.25], [x + w * 0.68, y + h * 0.45], [x + w * 0.82, y + h * 0.45]], WHITE);
  }
}
function waves(x, y, w, c, n = 3) {
  for (let k = 0; k < n; k++) {
    const yy = y + k * 6;
    for (let xx = x; xx < x + w; xx += 12) {
      line(xx, yy + 2, xx + 6, yy, c, 1);
      line(xx + 6, yy, xx + 12, yy + 2, c, 1);
    }
  }
}
function windows(x, y, w, h, c, cols, rows) {
  for (let r = 0; r < rows; r++)
    for (let cc = 0; cc < cols; cc++)
      if (hash2(x + cc * 7, y + r * 9) > 0.45) rect(x + 3 + cc * ((w - 6) / cols), y + 3 + r * ((h - 6) / rows), 2, 3, c);
}
function flames(x, y, w, h, c1, c2) {
  poly([[x + w * 0.2, y + h], [x + w * 0.35, y + h * 0.3], [x + w * 0.5, y + h * 0.55], [x + w * 0.62, y + h * 0.15], [x + w * 0.78, y + h * 0.5], [x + w * 0.85, y + h]], c1);
  poly([[x + w * 0.38, y + h], [x + w * 0.45, y + h * 0.55], [x + w * 0.55, y + h * 0.7], [x + w * 0.62, y + h * 0.4], [x + w * 0.68, y + h]], c2);
}
function scene(kind, x, y, w, h) {
  switch (kind) {
    case 'huang': {
      vgrad(x, y, w, h, [16, 34, 22], [8, 18, 12]);
      dots(x, y, w, h, [40, 90, 55], 10, 1);
      rect(x + w * 0.5 - 26, y + h * 0.3, 52, h * 0.45, [46, 180, 110]);
      rect(x + w * 0.5 - 22, y + h * 0.3 + 4, 44, h * 0.45 - 8, [10, 24, 16]);
      rect(x + w * 0.5 - 8, y + h * 0.42, 16, 14, [46, 180, 110]);
      for (let i = 0; i < 5; i++) {
        line(x + w * 0.5 - 34, y + h * 0.36 + i * 7, x + w * 0.5 - 27, y + h * 0.36 + i * 7, GOLD2, 2);
        line(x + w * 0.5 + 27, y + h * 0.36 + i * 7, x + w * 0.5 + 34, y + h * 0.36 + i * 7, GOLD2, 2);
      }
      line(x + w * 0.18, y + h * 0.78, x + w * 0.42, y + h * 0.55, [46, 180, 110], 3);
      line(x + w * 0.42, y + h * 0.55, x + w * 0.62, y + h * 0.3, [46, 180, 110], 3);
      line(x + w * 0.62, y + h * 0.3, x + w * 0.82, y + h * 0.12, [46, 180, 110], 3);
      circle(x + w * 0.82, y + h * 0.12, 3, GOLD2);
      break;
    }
    case 'dymer': {
      vgrad(x, y, w, h, [60, 50, 55], [30, 26, 30]);
      rect(x + 8, y + h * 0.4, 22, h * 0.6, [20, 20, 24]);
      rect(x + 36, y + h * 0.25, 26, h * 0.75, [35, 32, 38]);
      rect(x + 68, y + h * 0.5, 18, h * 0.5, [20, 20, 24]);
      windows(x + 8, y + h * 0.4, 22, h * 0.6, GOLD2, 3, 4);
      windows(x + 36, y + h * 0.25, 26, h * 0.75, GOLD2, 3, 5);
      poly([[x + 44, y + h * 0.25], [x + 52, y + h * 0.05], [x + 60, y + h * 0.25]], [150, 150, 155]);
      poly([[x + 52, y + h * 0.05], [x + 58, y + h * 0.02], [x + 62, y + h * 0.1]], [170, 170, 175]);
      flames(x + w * 0.62, y + h * 0.55, w * 0.3, h * 0.45, [230, 120, 40], GOLD2);
      circle(x + w * 0.5, y + h * 0.14, 4, [200, 200, 200]);
      circle(x + w * 0.56, y + h * 0.08, 6, [190, 190, 190]);
      break;
    }
    case 'bitcoin': {
      vgrad(x, y, w, h, [24, 40, 70], [16, 22, 40]);
      dots(x, y, w, h, [60, 80, 120], 10, 1);
      const bars = [0.4, 0.55, 0.35, 0.7, 0.5, 0.85, 0.65];
      for (let i = 0; i < 7; i++) {
        const bx = x + 8 + i * ((w - 16) / 7);
        const bh = bars[i] * (h - 18);
        const up = i % 2 === 0;
        const c = up ? [46, 180, 110] : [220, 70, 60];
        line(bx + 4, y + h - 8 - bh - 4, bx + 4, y + h - 8 - 2, c, 1);
        rect(bx, y + h - 8 - bh, 8, bh, c);
      }
      line(x + 4, y + h - 8, x + w - 4, y + h - 8, [200, 200, 200], 1);
      circle(x + w - 12, y + 12, 9, GOLD2);
      drawText(x + w - 15, y + 9, '$', 1, NAVY2, 1);
      break;
    }
    case 'estonia': {
      vgrad(x, y, w, h, [205, 220, 235], [235, 240, 245]);
      rect(x + 6, y + 6, w * 0.42, 14, [0, 110, 200]);
      rect(x + 6, y + 20, w * 0.42, 14, INK);
      rect(x + 6, y + 34, w * 0.42, 14, WHITE);
      frame(x + 6, y + 6, w * 0.42, 42, INK);
      for (let i = 0; i < 6; i++) {
        const fx = x + w * 0.55 + i * ((w * 0.4) / 6);
        line(fx, y + h - 10, fx, y + h * 0.35, [90, 90, 95], 2);
        line(fx - 3, y + h * 0.45, fx + 3, y + h * 0.45, [90, 90, 95], 1);
      }
      line(x + w * 0.55, y + h * 0.35, x + w - 4, y + h * 0.35, [90, 90, 95], 2);
      line(x + w * 0.55, y + h * 0.5, x + w - 4, y + h * 0.5, [90, 90, 95], 1);
      circle(x + w * 0.8, y + h * 0.2, 5, RED2);
      break;
    }
    case 'oman': {
      vgrad(x, y, w, h, [190, 210, 225], [240, 235, 215]);
      sunDisc(x + w - 16, y + 13, 7, GOLD2);
      rect(x + w * 0.15, y + h * 0.5, w * 0.6, h * 0.22, [40, 55, 75]);
      rect(x + w * 0.25, y + h * 0.35, w * 0.18, h * 0.16, [40, 55, 75]);
      line(x + w * 0.3, y + h * 0.35, x + w * 0.3, y + h * 0.12, [40, 55, 75], 2);
      poly([[x + w * 0.32, y + h * 0.12], [x + w * 0.32, y + h * 0.32], [x + w * 0.5, y + h * 0.32]], RED2);
      waves(x, y + h * 0.72, w, WHITE, 2);
      waves(x, y + h * 0.84, w, [180, 205, 220], 2);
      circle(x + w * 0.85, y + h * 0.3, 3, RED2);
      break;
    }
    case 'westbank': {
      vgrad(x, y, w, h, [45, 35, 40], [25, 22, 26]);
      rect(x + 8, y + h * 0.55, w * 0.4, h * 0.45, [60, 52, 48]);
      rect(x + w * 0.55, y + h * 0.62, w * 0.35, h * 0.38, [60, 52, 48]);
      flames(x + 10, y + h * 0.3, w * 0.35, h * 0.3, [230, 120, 40], GOLD2);
      flames(x + w * 0.58, y + h * 0.38, w * 0.3, h * 0.28, [230, 120, 40], GOLD2);
      circle(x + w * 0.5, y + h * 0.18, 8, [240, 220, 180]);
      poly([[x + w * 0.5 - 14, y + h * 0.18], [x + w * 0.5 + 14, y + h * 0.18], [x + w * 0.5, y + h * 0.42]], [200, 180, 140]);
      break;
    }
    case 'iran': {
      vgrad(x, y, w, h, [30, 50, 70], [15, 28, 48]);
      poly([[x + w * 0.2, y + h * 0.6], [x + w * 0.8, y + h * 0.6], [x + w * 0.72, y + h * 0.78], [x + w * 0.28, y + h * 0.78]], [70, 80, 95]);
      rect(x + w * 0.42, y + h * 0.42, w * 0.16, h * 0.18, [70, 80, 95]);
      line(x + w * 0.5, y + h * 0.42, x + w * 0.5, y + h * 0.3, [200, 200, 200], 2);
      poly([[x + w * 0.5, y + h * 0.3], [x + w * 0.5, y + h * 0.42], [x + w * 0.62, y + h * 0.42]], [200, 60, 50]);
      for (let i = 0; i < 5; i++) circle(x + w * 0.15 + i * (w * 0.17), y + h * 0.68, 3, GOLD2);
      line(x + w * 0.15, y + h * 0.68, x + w * 0.85, y + h * 0.68, GOLD2, 1);
      waves(x, y + h * 0.8, w, WHITE, 2);
      break;
    }
    case 'armenia': {
      vgrad(x, y, w, h, [200, 220, 235], [245, 235, 210]);
      sunDisc(x + 16, y + 13, 7, GOLD2);
      ridge(x, y + h * 0.3, w, h * 0.7, [90, 110, 140], true);
      ridge(x + w * 0.4, y + h * 0.45, w * 0.6, h * 0.55, [60, 80, 110], true);
      rect(x, y + h - 8, w, 8, [120, 140, 90]);
      rect(x + w - 30, y + 8, 24, 6, [210, 60, 50]);
      rect(x + w - 30, y + 14, 24, 6, [40, 80, 160]);
      rect(x + w - 30, y + 20, 24, 6, [230, 140, 40]);
      circle(x + w * 0.5, y + h * 0.35, 4, WHITE);
      line(x + w * 0.5 - 10, y + h * 0.35, x + w * 0.5 + 10, y + h * 0.35, WHITE, 2);
      line(x + w * 0.5 - 6, y + h * 0.35 - 4, x + w * 0.5 + 6, y + h * 0.35 - 4, WHITE, 1);
      break;
    }
    case 'china': {
      vgrad(x, y, w, h, [250, 210, 160], [245, 230, 200]);
      sunDisc(x + w - 16, y + 13, 7, [220, 90, 40]);
      poly([[x + w * 0.5 - 20, y + h * 0.4], [x + w * 0.5 + 20, y + h * 0.4], [x + w * 0.5, y + h * 0.18]], [180, 50, 40]);
      rect(x + w * 0.5 - 14, y + h * 0.4, 28, h * 0.35, [200, 70, 50]);
      poly([[x + w * 0.5 - 24, y + h * 0.42], [x + w * 0.5 + 24, y + h * 0.42], [x + w * 0.5, y + h * 0.3]], [160, 40, 35]);
      rect(x + w * 0.5 - 3, y + h * 0.55, 6, h * 0.2, [120, 40, 30]);
      circle(x + w * 0.2, y + h * 0.3, 5, RED2);
      circle(x + w * 0.78, y + h * 0.35, 4, RED2);
      line(x + w * 0.2, y + h * 0.3 + 5, x + w * 0.2, y + h * 0.42, INK, 1);
      line(x + w * 0.78, y + h * 0.35 + 4, x + w * 0.78, y + h * 0.45, INK, 1);
      rect(x, y + h - 8, w, 8, [120, 90, 50]);
      break;
    }
    case 'korea': {
      vgrad(x, y, w, h, [215, 228, 240], [245, 242, 235]);
      circle(x + w * 0.5, y + h * 0.45, 13, RED2);
      poly([[x + w * 0.5 - 13, y + h * 0.45], [x + w * 0.5, y + h * 0.45 - 11], [x + w * 0.5 + 13, y + h * 0.45]], [40, 80, 160]);
      circle(x + w * 0.5, y + h * 0.45, 13, [40, 80, 160], false);
      line(x + w * 0.5 - 11, y + h * 0.45 - 11, x + w * 0.5 - 3, y + h * 0.45 - 3, INK, 2);
      line(x + w * 0.5 + 3, y + h * 0.45 + 3, x + w * 0.5 + 11, y + h * 0.45 + 11, INK, 2);
      rect(x + w * 0.5 - 22, y + h * 0.68, 44, 4, GOLD);
      rect(x + w * 0.5 - 16, y + h * 0.68 + 4, 32, 4, GOLD2);
      rect(x + w * 0.5 - 10, y + h * 0.68 + 8, 20, 4, [200, 180, 120]);
      break;
    }
    case 'bangladesh': {
      vgrad(x, y, w, h, [210, 225, 215], [240, 238, 225]);
      rect(x + w * 0.2, y + h * 0.5, w * 0.6, 6, [120, 100, 70]);
      for (let i = 0; i < 4; i++) rect(x + w * 0.24 + i * (w * 0.13), y + h * 0.56, 5, h * 0.3, [140, 120, 85]);
      rect(x + w * 0.2, y + h * 0.86, w * 0.6, 5, [120, 100, 70]);
      poly([[x + w * 0.5 - 24, y + h * 0.5], [x + w * 0.5 + 24, y + h * 0.5], [x + w * 0.5, y + h * 0.32]], [160, 135, 95]);
      circle(x + w * 0.5, y + h * 0.32, 4, GOLD2);
      line(x + w * 0.5, y + h * 0.1, x + w * 0.5, y + h * 0.32, INK, 1);
      poly([[x + w * 0.5 - 16, y + h * 0.14], [x + w * 0.5 + 16, y + h * 0.14], [x + w * 0.5, y + h * 0.08]], RED2);
      break;
    }
    case 'denmark': {
      vgrad(x, y, w, h, [215, 228, 240], [240, 238, 230]);
      rect(x + 10, y + 10, 26, 16, [200, 40, 50]);
      rect(x + 10 + 8, y + 10, 4, 16, WHITE);
      rect(x + 10, y + 10 + 6, 26, 4, WHITE);
      rect(x + w * 0.55, y + h * 0.35, w * 0.28, h * 0.5, DARK);
      rect(x + w * 0.55 + 3, y + h * 0.35 + 3, w * 0.28 - 6, h * 0.5 - 6, [220, 235, 245]);
      line(x + w * 0.55, y + h * 0.35, x + w * 0.83, y + h * 0.85, RED2, 3);
      circle(x + w * 0.69, y + h * 0.85 + 3, 2, DARK);
      poly([[x + w * 0.2, y + h * 0.75], [x + w * 0.32, y + h * 0.6], [x + w * 0.44, y + h * 0.75]], [140, 110, 70]);
      rect(x + w * 0.2, y + h * 0.75, w * 0.24, 5, [140, 110, 70]);
      break;
    }
    case 'congo': {
      vgrad(x, y, w, h, [200, 190, 170], [150, 140, 130]);
      poly([[x + w * 0.2, y + h], [x + w * 0.32, y + h * 0.3], [x + w * 0.44, y + h]], [40, 90, 160]);
      poly([[x + w * 0.45, y + h], [x + w * 0.58, y + h * 0.2], [x + w * 0.72, y + h]], [30, 70, 140]);
      poly([[x + w * 0.68, y + h], [x + w * 0.78, y + h * 0.45], [x + w * 0.88, y + h]], [50, 110, 180]);
      poly([[x + w * 0.32, y + h * 0.3], [x + w * 0.38, y + h * 0.45], [x + w * 0.28, y + h * 0.5]], [120, 180, 230]);
      poly([[x + w * 0.58, y + h * 0.2], [x + w * 0.65, y + h * 0.4], [x + w * 0.52, y + h * 0.45]], [140, 200, 250]);
      rect(x, y + h - 6, w, 6, [90, 80, 70]);
      circle(x + w * 0.85, y + h * 0.18, 4, GOLD2);
      break;
    }
    case 'tajikistan': {
      vgrad(x, y, w, h, [220, 225, 235], [240, 238, 230]);
      line(x + w * 0.5, y + h * 0.15, x + w * 0.5, y + h * 0.7, INK, 2);
      line(x + w * 0.2, y + h * 0.22, x + w * 0.8, y + h * 0.22, INK, 2);
      circle(x + w * 0.5, y + h * 0.15, 3, GOLD2);
      poly([[x + w * 0.2 - 10, y + h * 0.42], [x + w * 0.2 + 10, y + h * 0.42], [x + w * 0.2, y + h * 0.22]], GOLD);
      poly([[x + w * 0.8 - 10, y + h * 0.42], [x + w * 0.8 + 10, y + h * 0.42], [x + w * 0.8, y + h * 0.22]], GOLD);
      line(x + w * 0.2, y + h * 0.22, x + w * 0.2 - 10, y + h * 0.42, INK, 1);
      line(x + w * 0.2, y + h * 0.22, x + w * 0.2 + 10, y + h * 0.42, INK, 1);
      line(x + w * 0.8, y + h * 0.22, x + w * 0.8 - 10, y + h * 0.42, INK, 1);
      line(x + w * 0.8, y + h * 0.22, x + w * 0.8 + 10, y + h * 0.42, INK, 1);
      rect(x + w * 0.5 - 14, y + h * 0.7, 28, 4, INK);
      rect(x + w * 0.5 - 20, y + h * 0.7 + 4, 40, 4, INK);
      break;
    }
    case 'measles': {
      vgrad(x, y, w, h, [250, 225, 215], [245, 210, 195]);
      circle(x + w * 0.5, y + h * 0.5, 14, [200, 60, 60]);
      for (let a = 0; a < 10; a++) {
        const t = a * Math.PI / 5;
        line(x + w * 0.5 + Math.cos(t) * 14, y + h * 0.5 + Math.sin(t) * 14, x + w * 0.5 + Math.cos(t) * 20, y + h * 0.5 + Math.sin(t) * 20, [200, 60, 60], 2);
        circle(x + w * 0.5 + Math.cos(t) * 22, y + h * 0.5 + Math.sin(t) * 22, 2, [200, 60, 60]);
      }
      circle(x + w * 0.5 - 5, y + h * 0.5 - 3, 2, WHITE);
      circle(x + w * 0.5 + 5, y + h * 0.5 - 3, 2, WHITE);
      line(x + w * 0.5 - 4, y + h * 0.5 + 5, x + w * 0.5 + 4, y + h * 0.5 + 5, WHITE, 2);
      rect(x + 6, y + 6, 12, 12, WHITE);
      rect(x + 10, y + 8, 4, 8, RED2);
      rect(x + 8, y + 10, 8, 4, RED2);
      break;
    }
  }
}

// ---------------------------------------------------------------- world map
const CONTINENTS = [
  [[-168, 66], [-150, 70], [-135, 70], [-125, 72], [-110, 73], [-95, 80], [-85, 80], [-75, 72], [-65, 60], [-55, 47], [-70, 42], [-75, 35], [-80, 26], [-84, 30], [-90, 21], [-95, 19], [-105, 20], [-110, 23], [-115, 30], [-125, 40], [-125, 49], [-140, 60], [-155, 58], [-165, 60]],
  [[-58, 64], [-45, 60], [-30, 68], [-25, 70], [-40, 76], [-58, 74]],
  [[-80, 9], [-72, 12], [-62, 10], [-52, 5], [-50, -5], [-40, -10], [-35, -15], [-40, -25], [-50, -32], [-58, -38], [-65, -45], [-70, -52], [-72, -40], [-75, -30], [-80, -18], [-80, -5]],
  [[-17, 15], [-10, 30], [0, 36], [10, 37], [20, 32], [30, 31], [35, 28], [43, 12], [51, 11], [48, 0], [40, -10], [35, -20], [32, -28], [20, -35], [15, -30], [12, -18], [13, -10], [9, 4], [-8, 5], [-15, 11]],
  [[-10, 36], [-9, 43], [-2, 48], [0, 50], [5, 53], [8, 57], [10, 59], [18, 56], [21, 55], [24, 58], [28, 60], [30, 62], [32, 60], [30, 55], [28, 46], [23, 40], [20, 40], [16, 38], [12, 44], [8, 44], [3, 42], [0, 40], [-2, 37], [-6, 36]],
  [[30, 62], [40, 68], [55, 68], [70, 72], [90, 75], [110, 76], [130, 72], [160, 70], [178, 66], [170, 60], [160, 55], [150, 60], [142, 50], [140, 40], [130, 35], [127, 33], [120, 30], [110, 20], [105, 10], [100, 8], [95, 15], [90, 22], [85, 20], [80, 10], [75, 8], [70, 20], [65, 25], [60, 25], [55, 26], [50, 28], [48, 30], [45, 35], [40, 40], [35, 42], [32, 45], [30, 50], [30, 55]],
  [[113, -22], [114, -30], [120, -34], [130, -32], [140, -38], [150, -37], [153, -32], [146, -19], [142, -11], [135, -12], [130, -13], [122, -17], [115, -20]],
  [[167, -45], [174, -41], [178, -38], [176, -40], [170, -44]],
];
function mapXY(mx, my, mw, mh, lon, lat) {
  return [mx + (lon + 170) / 360 * mw, my + (75 - lat) / 130 * mh];
}
function drawMap(mx, my, mw, mh, pins) {
  rect(mx, my, mw, mh, SEA);
  for (let gy = my + 12; gy < my + mh; gy += 24) line(mx, gy, mx + mw, gy, [210, 228, 234], 1);
  for (const cont of CONTINENTS) {
    const pts = cont.map(p => mapXY(mx, my, mw, mh, p[0], p[1]));
    poly(pts, LAND);
    polyLine([...pts, pts[0]], [120, 105, 70], 1);
  }
  dots(mx, my, mw, mh, [190, 205, 210], 14, 1);
  for (const p of pins) {
    const [x, y] = mapXY(mx, my, mw, mh, p.lon, p.lat);
    if (p.big) {
      circle(x, y, 10, RED);
      circle(x, y, 10, INK, false);
      const s = String(p.n);
      drawText(x - (s.length * 6) / 2 + 1, y - 4, s, 1, WHITE, 1);
    } else {
      circle(x, y, 7, RED);
      circle(x, y, 7, INK, false);
      drawText(x - 2, y - 3, String(p.n), 1, WHITE, 1);
    }
  }
}

// ---------------------------------------------------------------- story data
// All copy UPPERCASE (fonts are caps-only). Every story happened or was
// first reported on Tuesday 24 November 2026. Sources verified 24 Nov 2026.
const NUMBERS = [
  { v: '61,212', l: 'BITCOIN, $ 00:04 UTC' },
  { v: '12.2BN', l: "NVIDIA BEARS' HIT, $" },
  { v: '11', l: 'KILLED IN DYMER, KYIV' },
  { v: '78', l: 'US DRONES IRAN CLAIMS DOWN' },
  { v: '74%', l: 'US LATINOS SAW ICE ACTION' },
  { v: '30BN', l: 'FAA BOOST URGED, $' },
];
const TIMELINE = [
  { t: '00:00 UTC', s: 'GULF OF OMAN: TANKER INCIDENT' },
  { t: '00:01 UTC', s: 'RIGA: LATVIA VOWS CURBS ON RUSSIAN' },
  { t: '00:04 UTC', s: 'BITCOIN $61,212 ON BINANCE' },
  { t: '00:47 CET', s: 'GENEVA: WFP WARNS FOOD AID AT RISK' },
  { t: '00:56 CET', s: 'BRUSSELS: EU UNVEILS NEW SANCTIONS' },
  { t: '00:00 PKT', s: 'TEHRAN: IRGC CLAIMS 78 DRONES DOWN' },
];
const LEADS = [
  { n: 1, art: 'huang', kick: 'SILICON VALLEY · MARKETS', title: 'HUANG IS BACK, BEARS PAY $12.2BN', body: 'Nvidia shares soar a day after the board reinstated Jensen Huang as CEO; short sellers face a $12.2bn hit. Trump tells CNBC he spoke to Huang and was represented at the board.', src: 'REUTERS', conf: 'CONFIRMED', lon: -122, lat: 37 },
  { n: 2, art: 'dymer', kick: 'KYIV REGION · WAR', title: '11 KILLED IN DYMER STRIKE', body: 'A Russian attack on Dymer in the Kyiv region kills 11. Zelenskiy says intelligence shows Russia is planning new strikes; Kyiv is to get more F-16s and Gripens.', src: 'REUTERS', conf: 'REPORTED', lon: 32, lat: 50 },
  { n: 3, art: 'bitcoin', kick: 'MARKETS · BIG NUMBER', title: '$61,212', big: true, body: 'Bitcoin $61,212 at 00:04 UTC. November down 24%, the year down 31%.', src: 'FINNHUB', conf: 'CONFIRMED', lon: -100, lat: 38 },
];
const PANELS = [
  { n: 4, art: 'estonia', kick: 'TALLINN · DIPLOMACY', title: "'VERGE OF OPEN WAR'", body: 'Moscow accuses Estonia of hostile acts on the verge of triggering open war.', src: 'REUTERS', conf: 'REPORTED', lon: 24, lat: 60 },
  { n: 5, art: 'oman', kick: 'GULF OF OMAN · SEA', title: 'TANKER INCIDENT', body: 'UKMTO reports a tanker incident involving military forces in the Gulf of Oman.', src: 'UKMTO', conf: 'REPORTED', lon: 59, lat: 21 },
  { n: 6, art: 'westbank', kick: 'WEST BANK · CONFLICT', title: "'JEWISH TERRORISM'", body: 'Eisenkot condemns settler arson attacks on Palestinian villages.', src: 'REUTERS', conf: 'REPORTED', lon: 35, lat: 32 },
  { n: 7, art: 'iran', kick: 'TEHRAN · CONFLICT', title: "'ALL MEANS' VS BLOCKADE", body: 'Tehran vows to use all available means against a US naval blockade.', src: 'REUTERS', conf: 'REPORTED', lon: 53, lat: 34 },
  { n: 8, art: 'armenia', kick: 'YEREVAN · POLITICS', title: 'NEW CONSTITUTION', body: 'Armenia proposes a new constitution in a step toward peace with Azerbaijan.', src: 'REUTERS', conf: 'REPORTED', lon: 44, lat: 41 },
  { n: 9, art: 'china', kick: 'BEIJING · SOCIETY', title: '2030 WELFARE TARGETS', body: 'China sets 2030 goals for elderly care and childcare support.', src: 'REUTERS', conf: 'CONFIRMED', lon: 114, lat: 39 },
  { n: 10, art: 'korea', kick: 'SEOUL · POLITICS', title: 'NEW FM, SPY CHIEF', body: 'President nominates a new foreign minister and intelligence chief.', src: 'REUTERS', conf: 'REPORTED', lon: 129, lat: 37 },
  { n: 11, art: 'bangladesh', kick: 'DHAKA · POLITICS', title: "'ARREST HASINA'", body: 'Bangladesh vows to arrest the ex-PM if she returns from India.', src: 'REUTERS', conf: 'REPORTED', lon: 90, lat: 24 },
  { n: 12, art: 'denmark', kick: 'COPENHAGEN · SOCIETY', title: 'PHONES OUT OF SCHOOL', body: 'Denmark to propose a school mobile-phone ban from 2027.', src: 'REUTERS', conf: 'REPORTED', lon: 10, lat: 55 },
  { n: 13, art: 'congo', kick: 'KINSHASA · ECONOMY', title: 'COBALT HALT', body: 'Congo halts cobalt exports again to tackle oversupply and lift prices.', src: 'REUTERS', conf: 'REPORTED', lon: 15, lat: -4 },
  { n: 14, art: 'tajikistan', kick: 'DUSHANBE · LAW', title: 'QUITS THE ICC', body: 'Tajikistan becomes the fourth country to leave the ICC since the US push.', src: 'REUTERS', conf: 'REPORTED', lon: 69, lat: 39 },
  { n: 15, art: 'measles', kick: 'VIRGINIA · HEALTH', title: 'US LOSES FREE STATUS', body: 'America loses measles-free status; a Virginia child dies, the first of 2026.', src: 'AP', conf: 'CONFIRMED', lon: -77, lat: 39 },
];
const BRIEFS = [
  { t: 'Kilauea volcano erupts in Hawaii', s: 'REUTERS' },
  { t: 'Wellington: India-New Zealand first Test ends in a draw', s: 'PRESS' },
  { t: 'Geneva: Gukesh defends the chess crown against Sindarov from today', s: 'PRESS' },
  { t: 'Canada and Qatar to sign an investment pact on Tuesday', s: 'REUTERS' },
  { t: 'Aviation groups urge a $30bn boost for FAA modernisation', s: 'REUTERS' },
  { t: 'FAA pauses router installs linked to the nationwide ground stop', s: 'AP' },
  { t: 'Mexico and China agree a working group to boost trade', s: 'REUTERS' },
  { t: 'US states back Epic Games as Apple asks the Supreme Court to overturn a contempt order', s: 'REUTERS' },
  { t: 'US discussing military training for Syrian forces', s: 'REUTERS' },
  { t: "US requests the extradition of arrested drug lord 'El Chapo Isidro'", s: 'REUTERS' },
  { t: 'China and EU officials discuss exchange rates; PBOC chief urges cooperation', s: 'REUTERS' },
  { t: 'UK PMI shows a slight November slowdown; Q4 looks robust', s: 'REUTERS' },
  { t: "ECB's Panetta warns payment fragmentation risks higher costs", s: 'REUTERS' },
  { t: "Brazil's Galipolo flags the inflation hit from spending growth", s: 'REUTERS' },
  { t: 'Belgian PM sets a December 31 budget deadline amid a national strike', s: 'REUTERS' },
  { t: 'WFP: wars jeopardise food aid for 7 million more people', s: 'UN' },
  { t: 'WHO: fighting near the Congo Ebola outbreak disrupts the response', s: 'REUTERS' },
  { t: "Latvia's new government vows limits on Russian in public spaces", s: 'REUTERS' },
  { t: '74 percent of US Latinos say they have seen or heard ICE activity', s: 'POLL' },
  { t: 'Germany lifts annual Ukraine aid about sixfold since 2022', s: 'REUTERS' },
  { t: "A supermoon meets the Pleiades 'Seven Sisters' in tonight's sky", s: 'PRESS' },
];
const DATECHECK = [
  'ALCARAZ BEATS ZVEREV FOR ATP FINALS - SUN 22 NOV',
  'INDIA-NEPAL: 8 MOUS, $1.63BN PACKAGE - MON 23 NOV',
  'COP31 COLLAPSES WITH NO DEAL - MON 23 NOV',
  'INDONESIA FACTORY FIRE KILLS 24 - MON 23 NOV',
  'UKRAINE SINKS RUSSIAN SHIP OFF LIBYA - MON 23 NOV',
  'NVIDIA BOARD REINSTATES HUANG - MON 23 NOV',
  'DEMOCRATS CLINCH 258 HOUSE SEATS - MON 23 NOV',
  'FIFA PICKS US-LED BID FOR 2031 CUP - MON 23 NOV',
  'TRUMP BLOCKS IOWA DETONATION ORDER - MON 23 NOV',
  'FIONA THE HIPPO DIES AT CINCINNATI ZOO - THU 19 NOV',
];

// ---------------------------------------------------------------- layout
const MX = 14, CW = 996; // content x, width
function frame(x, y, w, h, c) {
  line(x, y, x + w - 1, y, c, 1); line(x, y + h - 1, x + w - 1, y + h - 1, c, 1);
  line(x, y, x, y + h - 1, c, 1); line(x + w - 1, y, x + w - 1, y + h - 1, c, 1);
}
function chip(x, y, text, bg) {
  const w = Math.round(textWidth(text, 1)) + 12;
  rect(x, y, w, 12, bg);
  drawText(x + 6, y + 2, text, 1, WHITE, 1);
  return w;
}
function sectionHead(x, y, text, c) {
  rect(x, y - 2, 4, 12, c ?? RED);
  drawText(x + 8, y, text, 1.3, c ?? RED, 2);
}

function drawMasthead() {
  rect(0, 0, W, 6, RED);
  drawText(MX, 12, 'VOL. I - NO. 24', 1, GREY, 1);
  drawTextC(512, 12, "THE WORLD'S NEWS OF ONE DAY", 1.2, INK, 1);
  drawText(1010 - textWidth('TUESDAY EDITION', 1), 12, 'TUESDAY EDITION', 1, GREY, 1);
  rect(MX, 26, CW, 2, NAVY);
  rect(MX, 29, CW, 1, GOLD);
  drawBlockC(512, 36, 'TUESDAY 24 NOVEMBER 2026', 6, NAVY);
  rect(MX, 84, CW, 1, GOLD);
  rect(MX, 86, CW, 2, NAVY);
  drawTextC(512, 93, '36 STORIES · 7 REGIONS · 15 PICTURES - EVERY ONE DATED TUESDAY 24 NOVEMBER 2026', 1.2, INK, 1);
  rect(MX, 106, CW, 1, INK);
}

function drawNumbers() {
  const y0 = 108, y1 = 142, cw = CW / 6;
  for (let i = 0; i < 6; i++) {
    const cx = MX + i * cw;
    if (i > 0) line(cx, y0 + 4, cx, y1 - 4, [200, 195, 180], 1);
    drawBlockC(cx + cw / 2, y0 + 4, NUMBERS[i].v, 2, i % 2 ? NAVY : RED);
    drawTextC(cx + cw / 2, y0 + 24, NUMBERS[i].l, 1, GREY, 1);
  }
  rect(MX, y1, CW, 1, INK);
}

function drawTimeline() {
  const y0 = 142;
  sectionHead(MX, y0 + 4, 'THE DAY SO FAR', RED);
  drawText(1010 - textWidth('EACH TIME WITH ITS ZONE', 1), y0 + 5, 'EACH TIME WITH ITS ZONE', 1, GREY, 1);
  const cw = CW / 6;
  for (let i = 0; i < 6; i++) {
    const cx = MX + i * cw + 2;
    if (i > 0) line(MX + i * cw, y0 + 18, MX + i * cw, y0 + 44, [210, 205, 190], 1);
    drawText(cx, y0 + 18, TIMELINE[i].t, 1.2, RED, 2);
    drawPara(cx, y0 + 30, TIMELINE[i].s, 1, INK, cw - 8, 9, 2);
  }
  rect(MX, 190, CW, 2, INK);
}

function drawLead(L, x, y, w, h) {
  rect(x, y, w, h, TINTA);
  frame(x, y, w, h, INK);
  scene(L.art, x + 1, y + 1, w - 2, 78);
  if (L.big) dots(x + 1, y + 1, w - 2, 78, [255, 255, 255], 9, 1);
  line(x, y + 79, x + w - 1, y + 79, INK, 1);
  circle(x + 16, y + 92, 10, RED);
  drawText(x + 13, y + 89, String(L.n), 1, WHITE, 1);
  drawText(x + 30, y + 89, L.kick, 1, RED, 1);
  if (L.big) {
    // Big-number lead: chip moves to the kick row (top right) so the body
    // gets two clean lines at the bottom; source sits bottom-right.
    const cw0 = Math.round(textWidth(L.conf, 1)) + 12;
    rect(x + w - 8 - cw0, y + 88, cw0, 12, L.conf === 'CONFIRMED' ? GREEN : AMBER);
    drawText(x + w - 8 - cw0 + 6, y + 90, L.conf, 1, WHITE, 1);
    drawBlockC(x + w / 2, y + 100, L.title, 6, NAVY);
    drawTextC(x + w / 2, y + 147, 'FLAT ON THE DAY', 1.2, RED, 2);
    drawPara(x + 8, y + 159, L.body, 1.1, INK, w - 16, 11, 2);
    drawText(x + w - 8 - textWidth(L.src, 1), y + h - 14, L.src, 1, GREY, 1);
    return;
  }
  drawPara(x + 8, y + 102, L.title, 1.7, NAVY, w - 16, 13, 2);
  drawPara(x + 8, y + 130, L.body, 1.1, INK, w - 16, 11, 3);
  const cw = chip(x + 8, y + h - 16, L.conf, L.conf === 'CONFIRMED' ? GREEN : AMBER);
  drawText(x + 8 + cw + 6, y + h - 14, L.src, 1, GREY, 1);
}

function drawPanel(P, x, y, w, h) {
  rect(x, y, w, h, P.n % 2 ? TINTA : TINTB);
  frame(x, y, w, h, INK);
  scene(P.art, x + 1, y + 1, w - 2, 34);
  line(x, y + 35, x + w - 1, y + 35, INK, 1);
  circle(x + 12, y + 45, 8, RED);
  drawText(x + 9, y + 42, String(P.n), 1, WHITE, 1);
  drawText(x + 24, y + 42, P.kick, 1, RED, 1);
  const tl = drawPara(x + 8, y + 54, P.title, 1.2, NAVY, w - 16, 10, 2);
  drawPara(x + 8, y + 54 + tl * 10 + 1, P.body, 1, INK, w - 16, 9, 2);
  const cw = chip(x + 8, y + h - 14, P.conf, P.conf === 'CONFIRMED' ? GREEN : AMBER);
  drawText(x + 8 + cw + 6, y + h - 12, P.src, 1, GREY, 1);
}

function drawMapBriefs() {
  const y0 = 672, y1 = 932;
  // map
  sectionHead(MX, y0 + 6, 'WHERE IT HAPPENED', NAVY);
  drawText(444 - textWidth('15 PINS - 36 STORIES', 1), y0 + 7, '15 PINS - 36 STORIES', 1, GREY, 1);
  const pins = [
    ...LEADS.map(L => ({ n: L.n, lon: L.lon, lat: L.lat, big: true })),
    ...PANELS.map(P => ({ n: P.n, lon: P.lon, lat: P.lat, big: false })),
  ];
  drawMap(MX, y0 + 22, 430, 198, pins);
  frame(MX, y0 + 22, 430, 198, INK);
  drawText(MX, y0 + 228, 'RED DOT = LEAD STORY   ·   SMALL DOT = PANEL', 1, GREY, 1);
  drawText(MX, y0 + 242, 'AMERICAS 11 · EUROPE 9 · ASIA 6 · MIDEAST 4 · AFRICA 2 · OCEANIA 2', 1, INK, 1);
  line(446, y0 + 4, 446, y1 - 4, [200, 195, 180], 1);
  // briefs
  sectionHead(458, y0 + 6, 'THE REST OF THE DAY - 21 MORE', NAVY);
  for (let i = 0; i < 21; i++) {
    const col = i < 11 ? 0 : 1;
    const row = i % 11;
    const bx = 460 + col * 276;
    const by = y0 + 26 + row * 21;
    const B = BRIEFS[i];
    drawText(bx, by, (16 + i) + '.', 1, RED, 1);
    drawPara(bx + 20, by, B.t.toUpperCase() + ' (' + B.s + ')', 1, INK, 248, 10, 2);
  }
  rect(MX, y1, CW, 1, INK);
}

function drawDateCheck() {
  const y0 = 932;
  rect(MX, y0 + 2, CW, 66, [250, 232, 228]);
  frame(MX, y0 + 2, CW, 66, RED);
  drawText(MX + 8, y0 + 8, 'DATE CHECK · LEFT OUT AS OLDER NEWS', 1.2, RED, 2);
  drawText(1010 - textWidth('NOT 24 NOV - SO NOT ON THIS PAGE', 1), y0 + 9, 'NOT 24 NOV - SO NOT ON THIS PAGE', 1, GREY, 1);
  for (let i = 0; i < 10; i++) {
    const col = i < 5 ? 0 : 1;
    const row = i % 5;
    const bx = MX + 10 + col * 500;
    const by = y0 + 24 + row * 9;
    circle(bx + 3, by + 3, 2, RED);
    drawText(bx + 8, by, DATECHECK[i], 1, INK, 1);
  }
}

function drawFooter() {
  drawTextC(512, 1004, 'EVERY STORY HERE HAPPENED, OR WAS FIRST REPORTED, ON TUESDAY 24 NOVEMBER 2026; CLAIMS ARE ATTRIBUTED.', 1, INK, 1);
  drawTextC(512, 1014, 'NOT YET: TRUMP-XI-PUTIN THREE-WAY TALKS IN SHENZHEN, DUE THIS WEEK · SOURCES: REUTERS, AP, AFP, FINNHUB, UKMTO, UN.', 1, GREY, 1);
}

// ---------------------------------------------------------------- main
function main() {
  fill(PAPER);
  drawMasthead();
  drawNumbers();
  drawTimeline();
  const lw = 324;
  for (let i = 0; i < 3; i++) drawLead(LEADS[i], MX + i * (lw + 12), 192, lw, 180);
  for (let i = 0; i < 12; i++) {
    const col = i % 4, row = Math.floor(i / 4);
    drawPanel(PANELS[i], MX + col * 251, 372 + row * 100, 243, 100);
  }
  drawMapBriefs();
  drawDateCheck();
  drawFooter();
  grain();
  const outDir = process.env.MAKEFUN_OUTPUT_DIR || '/output';
  mkdirSync(outDir, { recursive: true });
  const size = writePNG(join(outDir, 'entry.png'));
  console.log('WROTE', join(outDir, 'entry.png'), size, 'bytes');
}
main();
