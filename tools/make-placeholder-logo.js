/**
 * ============================================================================
 *  GRISKA GO - tools/make-placeholder-logo.js
 * ----------------------------------------------------------------------------
 *  Membuat file logo placeholder:  public/logo.png
 *
 *  TUJUAN:
 *  Folder "public/" adalah lokasi file logo resmi Griska Go. File yang dibuat
 *  script ini HANYA placeholder supaya website tetap tampil rapi sebelum logo
 *  asli tersedia.
 *
 *  CARA GANTI DENGAN LOGO ASLI (paling mudah):
 *    1. Simpan file logo Anda sebagai  public/logo.png  (format PNG, sisi 512px)
 *    2. Buka  js/brand.js  -> ubah konstanta LOGO_SUMBER menjadi:
 *         '/public/logo.png'   (PNG)  atau   '/public/logo.svg'   (SVG)
 *    3. Refresh browser. Tidak ada kode lain yang perlu diubah.
 *
 *  Script ini memakai modul bawaan Node.js saja (zlib), tanpa dependency.
 *
 *  Jalankan ulang (hanya bila ingin membuat ulang placeholder):
 *      node tools/make-placeholder-logo.js
 * ============================================================================
 */

'use strict';

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const UKURAN = 512;          // sisi gambar (piksel)
const SS = 2;                // faktor supersampling untuk tepi halus
const KELUARAN = path.join(__dirname, '..', 'public', 'logo.png');

/* -------------------------------------------------------------------------- */
/*  Encoder PNG (RGBA 8-bit) - hanya modul bawaan Node.js                     */
/* -------------------------------------------------------------------------- */
function chunk(type, data) {
  const panjang = Buffer.alloc(4);
  panjang.writeUInt32BE(data.length, 0);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(zlib.crc32(body) >>> 0, 0);
  return Buffer.concat([panjang, body, crc]);
}

function tulisPNG(width, height, rgba) {
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0;                    // filter type 0 (None)
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;   // bit depth
  ihdr[9] = 6;   // color type: RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0))
  ]);
}

/* -------------------------------------------------------------------------- */
/*  Utilitas warna & geometri                                                 */
/* -------------------------------------------------------------------------- */
function hex(c) {
  return [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)];
}
function lerp(a, b, t) { return a + (b - a) * t; }
function mix(c1, c2, t) {
  return [lerp(c1[0], c2[0], t), lerp(c1[1], c2[1], t), lerp(c1[2], c2[2], t)];
}
function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }

/** Gradien 3 titik: atas (biru laut) -> tengah -> bawah (teal tropis). */
const GRAD = [hex('#0A3D62'), hex('#0E5486'), hex('#0F9D76')];
const EMAS = hex('#E8A33D');
const EMAS_TERANG = hex('#F6C877');

/** jarak (approx.) dari titik ke kotak membulat; <0 berarti di dalam. */
function sdKotakBulat(u, v, cx, cy, half, radius) {
  const dx = Math.abs(u - cx) - (half - radius);
  const dy = Math.abs(v - cy) - (half - radius);
  const ax = Math.max(dx, 0);
  const ay = Math.max(dy, 0);
  return Math.sqrt(ax * ax + ay * ay) + Math.min(Math.max(dx, dy), 0) - radius;
}

/** jarak dari titik ke cincin (annulus) di sekitar pusat. */
function sdCincin(u, v, cx, cy, rOuter, rInner) {
  const d = Math.hypot(u - cx, v - cy);
  const rMid = (rOuter + rInner) / 2;
  const rHalf = (rOuter - rInner) / 2;
  return Math.abs(d - rMid) - rHalf;
}

/** Kotak (persegi panjang) yang dirotasi 0 derajat. */
function sdKotak(u, v, x0, y0, x1, y1) {
  const dx = Math.max(x0 - u, u - x1);
  const dy = Math.max(y0 - v, v - y1);
  const ax = Math.max(dx, 0);
  const ay = Math.max(dy, 0);
  return Math.sqrt(ax * ax + ay * ay) + Math.min(Math.max(dx, dy), 0);
}

/* -------------------------------------------------------------------------- */
/*  Rendering                                                                 */
/* -------------------------------------------------------------------------- */
const R = UKURAN * SS;

/** Menggambar satu piksel (pada koordinat supersample) dan mengembalikannya. */
function warnaPiksel(u, v) {
  // --- Latar: kotak membulat dengan gradien diagonal ---
  const dLatar = sdKotakBulat(u, v, 0.5, 0.5, 0.5, 0.235);
  if (dLatar > 0) return null;                       // di luar rounded square

  const t = clamp((u + v) / 2, 0, 1);
  const dasar = t < 0.5 ? mix(GRAD[0], GRAD[1], t / 0.5) : mix(GRAD[1], GRAD[2], (t - 0.5) / 0.5);

  // Kilau halus di sudut kiri atas supaya terasa "premium".
  const kilau = Math.max(0, 1 - Math.hypot(u - 0.16, v - 0.10) / 0.62) * 0.20;
  let rgb = [lerp(dasar[0], 255, kilau), lerp(dasar[1], 255, kilau), lerp(dasar[2], 255, kilau)];

  // --- Huruf "G" emas ---
  const cx = 0.5, cy = 0.5;
  const R_luar = 0.300, R_dalam = 0.196;

  // Cincin dengan celah di kanan-atas.
  const dCincin = sdCincin(u, v, cx, cy, R_luar, R_dalam);
  const sudut = Math.atan2(v - cy, u - cx);           // -pi..pi, sumbu y ke bawah
  const dalamCelah = sudut > -1.30 && sudut < -0.06;
  const cincin = (dCincin < 0) && !dalamCelah;

  // Batang horizontal "G" (dari tengah ke tepi kanan).
  const batang = sdKotak(u, v, 0.5, 0.452, 0.800, 0.548) < 0;

  if (cincin || batang) {
    // Gradien emas halus pada huruf G.
    const tg = clamp((v - 0.2) / 0.6, 0, 1);
    const emas = mix(EMAS_TERANG, EMAS, tg);
    rgb = emas;
  }

  return [rgb[0], rgb[1], rgb[2], 255];
}

/** Render + downsample (rata-rata SS x SS) -> RGBA 8-bit. */
function render() {
  const besar = Buffer.alloc(R * R * 4);
  for (let y = 0; y < R; y++) {
    const v = (y + 0.5) / R;
    for (let x = 0; x < R; x++) {
      const u = (x + 0.5) / R;
      const c = warnaPiksel(u, v);
      const o = (y * R + x) * 4;
      if (c) { besar[o] = c[0]; besar[o + 1] = c[1]; besar[o + 2] = c[2]; besar[o + 3] = c[3]; }
    }
  }

  const kecil = Buffer.alloc(UKURAN * UKURAN * 4);
  for (let y = 0; y < UKURAN; y++) {
    for (let x = 0; x < UKURAN; x++) {
      let r = 0, g = 0, b = 0, a = 0;
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const o = ((y * SS + sy) * R + (x * SS + sx)) * 4;
          r += besar[o]; g += besar[o + 1]; b += besar[o + 2]; a += besar[o + 3];
        }
      }
      const n = SS * SS;
      const o = (y * UKURAN + x) * 4;
      kecil[o] = Math.round(r / n);
      kecil[o + 1] = Math.round(g / n);
      kecil[o + 2] = Math.round(b / n);
      kecil[o + 3] = Math.round(a / n);
    }
  }
  return kecil;
}

/* -------------------------------------------------------------------------- */
fs.mkdirSync(path.dirname(KELUARAN), { recursive: true });
const png = tulisPNG(UKURAN, UKURAN, render());
fs.writeFileSync(KELUARAN, png);
console.log('[Griska Go] Placeholder logo dibuat: ' + KELUARAN + ' (' + Math.round(png.length / 1024) + ' KB)');
