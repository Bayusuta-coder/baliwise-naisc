/**
 * ============================================================================
 *  GRISKA GO - tools/test-waktu.js
 * ----------------------------------------------------------------------------
 *  Mengukur waktu respons server untuk 1, 3, dan 7 hari, serta menguji jalur
 *  fallback ketika Gemini timeout (fetch tidak pernah menjawab).
 *
 *  Yang diperiksa:
 *   1. Server selalu menjawab (< batas anggaran), tidak menggantung.
 *   2. Saat AI timeout -> TIDAK ada error, melainkan rencana lengkap dari
 *      kode (lib/rencana.js) dengan narasiAI = false.
 *   3. Budget tetap konsisten: total = jumlah rincian.
 *
 *  Jalankan:  node tools/test-waktu.js
 * ============================================================================
 */

'use strict';

const path = require('path');
const assert = require('assert');

/* Timeout diperkecil supaya uji ini selesai dalam hitungan detik. */
process.env.AI_TIMEOUT_PERTAMA_MS = '1200';
process.env.AI_TIMEOUT_MS = '2000';
process.env.AI_TOTAL_BUDGET_MS = '6000';
process.env.AI_API_KEY = 'kunci-uji-waktu';

const chat = require(path.join(__dirname, '..', 'api', 'chat.js'));
const chatInternal = chat._internal;

function resTiruan() {
  return {
    statusCode: 0, payload: null, headers: {},
    setHeader(k, v) { this.headers[k] = v; },
    status(c) { this.statusCode = c; return this; },
    json(p) { this.payload = p; return this; },
    end() { return this; }
  };
}

function body(durasi, gaya) {
  return {
    action: 'generate',
    bahasa: 'id',
    durasi: durasi,
    budget: 'menengah',
    minat: ['budaya', 'alam'],
    gaya: gaya || 'padat',
    wilayahAwal: 'ubud',
    traveler: { dewasa: 2, anak: 1 },
    touristType: 'domestik',
    transport: 'mobil',
    akomodasi: 'hotel'
  };
}

/* -------------------------------------------------------------------------
 * 1. Waktu respons normal (AI menjawab cepat)
 * ---------------------------------------------------------------------- */
async function ujiNormal() {
  console.log('\n=== 1. Waktu respons (AI normal) ===');
  global.fetch = async function () {
    return {
      ok: true,
      status: 200,
      text: async () => JSON.stringify({
        candidates: [{ content: { parts: [{ text: JSON.stringify({
          ringkasan: 'Uji narasi.',
          hari: [{ hari: 1, tema: 'Uji', aktivitas: [{ id: 'ubud-palace', aktivitas: 'Uji.', alasan: 'Uji.' }] }]
        }) }] } }]
      })
    };
  };

  const hasil = [];
  for (const hari of [1, 3, 7]) {
    const res = resTiruan();
    const mulai = Date.now();
    await chat({ method: 'POST', headers: {}, body: body(hari), socket: {} }, res);
    const durasi = Date.now() - mulai;
    hasil.push({ hari: hari, ms: durasi });
    console.log(
      '  ' + hari + ' hari : ' + durasi + ' ms | status=' + res.statusCode +
      ' | ok=' + (res.payload && res.payload.ok) +
      ' | hari=' + (res.payload.itinerary.hari.length) +
      ' | narasiAI=' + (res.payload.meta.narasiAI)
    );
    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.payload.ok, true);
  }
  return hasil;
}

/* -------------------------------------------------------------------------
 * 2. Jalur fallback: Gemini timeout (tidak pernah menjawab)
 * ---------------------------------------------------------------------- */
async function ujiTimeout() {
  console.log('\n=== 2. Jalur fallback saat AI timeout ===');
  // Fetch yang tidak pernah menjawab -> memicu AbortController di server.
  // Tiruan ini menghormati signal abort, sama seperti fetch bawaan Node.
  global.fetch = function (url, opsi) {
    return new Promise(function (resolve, reject) {
      if (opsi && opsi.signal) {
        opsi.signal.addEventListener('abort', function () {
          const err = new Error('The operation was aborted');
          err.name = 'AbortError';
          reject(err);
        });
      }
    });
  };

  const res = resTiruan();
  const mulai = Date.now();
  await chat({ method: 'POST', headers: {}, body: body(3), socket: {} }, res);
  const durasi = Date.now() - mulai;

  console.log('  total ' + durasi + ' ms | status=' + res.statusCode + ' | ok=' + (res.payload && res.payload.ok));

  assert.strictEqual(res.statusCode, 200, 'tidak boleh error');
  assert.strictEqual(res.payload.ok, true, 'harus ok');
  assert.strictEqual(res.payload.meta.narasiAI, false, 'narasiAI harus false');
  assert.ok(res.payload.itinerary.hari.length >= 1, 'rencana tetap ada');
  assert.ok(res.payload.budget.total > 0, 'budget tetap ada');

  // Budget tetap konsisten walau tanpa narasi AI.
  const b = res.payload.budget;
  const jumlahKategori = Object.keys(b.kategori).reduce(function (s, k) { return s + b.kategori[k]; }, 0);
  assert.strictEqual(jumlahKategori, b.total, 'total = jumlah kategori');
  const jumlahHari = b.rincianHari.reduce(function (s, h) { return s + h.total; }, 0);
  assert.strictEqual(jumlahHari, b.total, 'total = jumlah per hari');

  console.log('  OK: rencana lengkap dikembalikan tanpa error (narasiAI=false)');
  return durasi;
}

/* -------------------------------------------------------------------------
 * 3. Permintaan tanpa narasi (tombol "Lewati narasi AI")
 * ---------------------------------------------------------------------- */
async function ujiTanpaNarasi() {
  console.log('\n=== 3. Permintaan tanpa narasi AI ===');
  let dipanggil = 0;
  global.fetch = async function () { dipanggil += 1; return { ok: true, status: 200, text: async () => '{}' }; };

  const res = resTiruan();
  const mulai = Date.now();
  const b = body(3);
  b.tanpaNarasi = true;
  await chat({ method: 'POST', headers: {}, body: b, socket: {} }, res);
  const durasi = Date.now() - mulai;

  console.log('  ' + durasi + ' ms | dipanggil ke AI=' + dipanggil + ' | ok=' + res.payload.ok + ' | narasiAI=' + res.payload.meta.narasiAI);
  assert.strictEqual(dipanggil, 0, 'AI tidak boleh dipanggil');
  assert.strictEqual(res.payload.ok, true);
  assert.strictEqual(res.payload.meta.narasiAI, false);
  return durasi;
}

(async function () {
  const normal = await ujiNormal();
  const timeout = await ujiTimeout();
  const tanpa = await ujiTanpaNarasi();

  console.log('\n--------------------------------------');
  console.log('  Ringkasan waktu respons server:');
  normal.forEach(function (h) {
    console.log('    ' + h.hari + ' hari : ' + h.ms + ' ms');
  });
  console.log('    timeout AI : ' + timeout + ' ms (rencana tetap keluar, tanpa error)');
  console.log('    tanpa narasi: ' + tanpa + ' ms');
  console.log('--------------------------------------');
  process.exit(0);
})().catch(function (e) {
  console.error('GAGAL: ' + e.message);
  process.exit(1);
});
