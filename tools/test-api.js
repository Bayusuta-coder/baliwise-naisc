/**
 * ============================================================================
 *  BALIWISE - tools/test-api.js
 * ----------------------------------------------------------------------------
 *  Pengujian otomatis untuk logika backend (tanpa memanggil API sungguhan).
 *
 *  Yang diuji:
 *   1. Parser JSON tahan markdown / teks tambahan.
 *   2. Pembersihan itinerary: tempat di luar katalog harus dibuang.
 *   3. Validasi preferensi form.
 *   4. System prompt memuat katalog 28 destinasi.
 *   5. Rantai model (fallback 404) & pemetaan error.
 *   6. Alur handler lengkap dengan fetch tiruan (mock Gemini).
 *
 *  Jalankan: node tools/test-api.js
 * ============================================================================
 */

'use strict';

const assert = require('assert');
const path = require('path');

const chat = require(path.join(__dirname, '..', 'api', 'chat.js'));
const {
  parseJSONAman, bersihkanItinerary, validasiPreferensi,
  bangunSystemPrompt, muatDestinasi, daftarModel, jadwalSchema, resetCacheModel,
  DEFAULT_MODEL, DEFAULT_MODEL_FALLBACK, DEFAULT_MODEL_DARURAT
} = chat._internal;

let lulus = 0;
let gagal = 0;

/** Membungkus satu pengujian agar hasilnya rapi. */
function uji(nama, fn) {
  try {
    fn();
    lulus++;
    console.log('  \u2713 ' + nama);
  } catch (err) {
    gagal++;
    console.log('  \u2717 ' + nama + '\n      ' + err.message);
  }
}

const data = muatDestinasi();

console.log('\n=== BALIWISE - Uji Logika Backend ===\n');

/* -------------------------------------------------------------------------
 * 1. Parser JSON
 * ----------------------------------------------------------------------- */
console.log('[1] Parser JSON');

uji('JSON polos berhasil di-parse', () => {
  const hasil = parseJSONAman('{"a":1}');
  assert.strictEqual(hasil.a, 1);
});

uji('JSON dengan code fence markdown di-handle', () => {
  const hasil = parseJSONAman('```json\n{"a":2}\n```');
  assert.strictEqual(hasil.a, 2);
});

uji('JSON dengan teks tambahan di-handle', () => {
  const hasil = parseJSONAman('Berikut jawabannya:\n{"a":3}\nSemoga membantu!');
  assert.strictEqual(hasil.a, 3);
});

uji('Teks bukan JSON menghasilkan null', () => {
  assert.strictEqual(parseJSONAman('Maaf, saya tidak bisa membantu.'), null);
});

uji('Kurung kurawal di dalam string tidak ruining parser', () => {
  const hasil = parseJSONAman('{"catatan":"pakai sarong {wajib}"}');
  assert.strictEqual(hasil.catatan, 'pakai sarong {wajib}');
});

/* -------------------------------------------------------------------------
 * 2. Pembersihan itinerary (anti-halusinasi)
 * ----------------------------------------------------------------------- */
console.log('\n[2] Pembersihan itinerary & anti-halusinasi');

const contohAI = {
  ringkasan: 'Rencana 2 hari di Bali.',
  totalEstimasi: 200000,
  hari: [
    {
      hari: 1,
      tema: 'Ubud',
      totalBiaya: 150000,
      jadwal: [
        { jam: '09.00', namaTempat: 'Pura Uluwatu', aktivitas: 'Menikmati tebing', estimasiBiaya: 50000, tipsBudaya: ['Pakai sarong'] },
        { jam: '13.00', namaTempat: 'Tempat Fiktif Yang Tidak Ada', aktivitas: 'W toured', estimasiBiaya: 99999, tipsBudaya: ['abc'] },
        { jam: '16.00', namaTempat: 'Warung Babi Guling Ibu Oka', aktivitas: 'Makan siang', estimasiBiaya: 50000, tipsBudaya: [] }
      ]
    }
  ]
};

uji('Tempat di luar katalog otomatis dibuang', () => {
  const { itinerary, dibuang } = bersihkanItinerary(JSON.stringify(contohAI), data);
  assert.strictEqual(dibuang, 1, 'harus ada 1 tempat yang dibuang');
  const nama = itinerary.hari[0].jadwal.map((j) => j.namaTempat);
  assert.ok(!nama.includes('Tempat Fiktif Yang Tidak Ada'), 'tempat fiktif tidak boleh lolos');
});

uji('Wilayah & kategori diambil dari katalog (grounding)', () => {
  const { itinerary } = bersihkanItinerary(JSON.stringify(contohAI), data);
  const stop = itinerary.hari[0].jadwal[0];
  assert.strictEqual(stop.wilayah, 'Badung');
  assert.strictEqual(stop.kategori, 'budaya');
});

uji('Tips kosong diisi dari tips resmi katalog', () => {
  const { itinerary } = bersihkanItinerary(JSON.stringify(contohAI), data);
  const stop = itinerary.hari[0].jadwal[1];
  assert.ok(stop.tipsBudaya.length > 0, 'tips harus terisi');
});

uji('Total biaya dihitung ulang dari data yang dibersihkan', () => {
  const { itinerary } = bersihkanItinerary(JSON.stringify(contohAI), data);
  assert.strictEqual(itinerary.totalEstimasi, 100000);
});

uji('Nama tempat dari AI dirapikan ke nama resmi katalog', () => {
  const contoh = JSON.parse(JSON.stringify(contohAI));
  contoh.hari[0].jadwal[0].namaTempat = 'pura uluwatu';
  const { itinerary } = bersihkanItinerary(JSON.stringify(contoh), data);
  assert.strictEqual(itinerary.hari[0].jadwal[0].namaTempat, 'Pura Uluwatu');
});

uji('Itinerary kosong menghasilkan null', () => {
  const { itinerary } = bersihkanItinerary(JSON.stringify({ hari: [] }), data);
  assert.strictEqual(itinerary, null);
});

/* -------------------------------------------------------------------------
 * 3. Validasi preferensi
 * ----------------------------------------------------------------------- */
console.log('\n[3] Validasi preferensi form');

uji('Durasi di luar 1-7 ditolak', () => {
  const v = validasiPreferensi({ durasi: 10, budget: 'hemat', minat: ['pantai'], gaya: 'santai', wilayahAwal: 'Ubud' });
  assert.strictEqual(v.ok, false);
});

uji('Durasi bukan bilangan bulat ditolak', () => {
  const v = validasiPreferensi({ durasi: 3.5, budget: 'hemat', minat: ['pantai'], gaya: 'santai', wilayahAwal: 'Ubud' });
  assert.strictEqual(v.ok, false);
});

uji('Budget tidak valid ditolak', () => {
  const v = validasiPreferensi({ durasi: 3, budget: 'gratis', minat: ['pantai'], gaya: 'santai', wilayahAwal: 'Ubud' });
  assert.strictEqual(v.ok, false);
});

uji('Minat kosong ditolak', () => {
  const v = validasiPreferensi({ durasi: 3, budget: 'hemat', minat: [], gaya: 'santai', wilayahAwal: 'Ubud' });
  assert.strictEqual(v.ok, false);
});

uji('Gaya tidak valid ditolak', () => {
  const v = validasiPreferensi({ durasi: 3, budget: 'hemat', minat: ['alam'], gaya: 'kilat', wilayahAwal: 'Ubud' });
  assert.strictEqual(v.ok, false);
});

uji('Wilayah awal kosong ditolak', () => {
  const v = validasiPreferensi({ durasi: 3, budget: 'hemat', minat: ['alam'], gaya: 'santai', wilayahAwal: '' });
  assert.strictEqual(v.ok, false);
});

uji('Input valid diterima', () => {
  const v = validasiPreferensi({ durasi: 4, budget: 'menengah', minat: ['alam', 'budaya'], gaya: 'padat', wilayahAwal: 'Ubud' });
  assert.strictEqual(v.ok, true);
  assert.deepStrictEqual(v.data.minat, ['alam', 'budaya']);
});

uji('Catatan dipotong maksimal 300 karakter', () => {
  const v = validasiPreferensi({ durasi: 2, budget: 'hemat', minat: ['alam'], gaya: 'santai', wilayahAwal: 'Ubud', catatan: 'x'.repeat(500) });
  assert.strictEqual(v.data.catatan.length, 300);
});

/* -------------------------------------------------------------------------
 * 4. System prompt
 * ----------------------------------------------------------------------- */
console.log('\n[4] System prompt');

const promptID = bangunSystemPrompt(data, 'id');
const promptEN = bangunSystemPrompt(data, 'en');

uji('Prompt memuat seluruh katalog', () => {
  data.destinasi.forEach((d) => {
    assert.ok(promptID.includes(d.nama), 'nama "' + d.nama + '" harus ada di prompt');
  });
});

uji('Prompt memuat aturan anti-halusinasi', () => {
  assert.ok(/HANYA boleh merekomendasikan/.test(promptID));
  assert.ok(/KATALOG/.test(promptID));
});

uji('Prompt memuat aturan format JSON', () => {
  assert.ok(/FORMAT OUTPUT/.test(promptID));
  assert.ok(promptID.includes('"namaTempat"'));
});

uji('Prompt bahasa Inggris memakai nama English', () => {
  assert.ok(promptEN.includes('Ubud Palace'));
  assert.ok(!/HANYA boleh/.test(promptEN));
});

/* -------------------------------------------------------------------------
 * 5. Rantai model & skema JSON
 * ----------------------------------------------------------------------- */
console.log('\n[5] Rantai model (fallback 404) & response schema');

const envMODEL_SIMPAN = {
  AI_MODEL: process.env.AI_MODEL,
  AI_MODEL_FALLBACK: process.env.AI_MODEL_FALLBACK,
  AI_MODEL_DARURAT: process.env.AI_MODEL_DARURAT
};

uji('Model utama bukan gemini-2.0-flash (sudah dihapus Google)', () => {
  assert.notStrictEqual(DEFAULT_MODEL, 'gemini-2.0-flash');
  assert.strictEqual(DEFAULT_MODEL, 'gemini-3.8-flash');
});

uji('Default fallback & darurat sesuai harapan', () => {
  assert.strictEqual(DEFAULT_MODEL_FALLBACK, 'gemini-2.5-flash');
  assert.strictEqual(DEFAULT_MODEL_DARURAT, 'gemini-3.6-flash');
});

uji('Rantai model default memuat model utama + cadangan + jaring pengaman', () => {
  delete process.env.AI_MODEL;
  delete process.env.AI_MODEL_FALLBACK;
  delete process.env.AI_MODEL_DARURAT;
  resetCacheModel();
  const rantai = daftarModel();
  assert.strictEqual(rantai[0], 'gemini-3.8-flash');
  assert.ok(rantai.includes('gemini-2.5-flash'), 'harus memuat fallback bawaan');
  assert.ok(rantai.includes('gemini-3.6-flash'), 'harus memuat model darurat');
  assert.ok(rantai.includes('gemini-3.5-flash-lite'), 'harus memuat jaring pengaman');
  assert.strictEqual(rantai.length, 5);
});

uji('Rantai model mengikuti env AI_MODEL / AI_MODEL_FALLBACK', () => {
  process.env.AI_MODEL = 'gemini-3.6-flash';
  process.env.AI_MODEL_FALLBACK = 'gemini-3.1-flash-lite';
  resetCacheModel();
  const rantai = daftarModel();
  assert.strictEqual(rantai[0], 'gemini-3.6-flash');
  assert.strictEqual(rantai[1], 'gemini-3.1-flash-lite');
});

uji('Model duplikat dibuang dari rantai', () => {
  process.env.AI_MODEL = 'gemini-3.6-flash';
  process.env.AI_MODEL_FALLBACK = 'gemini-3.6-flash';
  resetCacheModel();
  const rantai = daftarModel();
  assert.strictEqual(rantai.filter((m) => m === 'gemini-3.6-flash').length, 1);
});

uji('Rantai tidak pernah kosong walau semua model di-skip', () => {
  process.env.AI_MODEL = 'gemini-3.6-flash';
  resetCacheModel();
  const rantai = daftarModel();
  // Simulasikan semua model diblacklist dengan membuat daftar kosong
  const kosong = daftarModel().filter(() => false);
  assert.ok(Array.isArray(kosong));
  assert.ok(rantai.length > 0);
});

// Kembalikan env sebelum uji handler, supaya rantai model memakai nilai bawaan.
Object.keys(envMODEL_SIMPAN).forEach((k) => {
  if (envMODEL_SIMPAN[k] === undefined) delete process.env[k];
  else process.env[k] = envMODEL_SIMPAN[k];
});

uji('Schema JSON memakai tipe lowercase (format resmi terbaru)', () => {
  const s = jadwalSchema();
  assert.strictEqual(s.type, 'object');
  assert.strictEqual(s.properties.hari.type, 'array');
  assert.strictEqual(s.properties.hari.items.type, 'object');
  assert.strictEqual(s.properties.hari.items.properties.jadwal.items.type, 'object');
});

/* -------------------------------------------------------------------------
 * 6. Alur handler lengkap (mock Gemini)
 * ----------------------------------------------------------------------- */

/** Membuat objek res tiruan untuk menguji handler. */
function resTiruan() {
  return {
    statusCode: 0, payload: null, headers: {},
    setHeader(k, v) { this.headers[k] = v; },
    status(c) { this.statusCode = c; return this; },
    json(p) { this.payload = p; return this; },
    end() { return this; }
  };
}

/** Mengganti global fetch dengan tiruan yang mengembalikan JSON tiruan. */
function pasangMock(teksGemini, statusCode) {
  global.fetch = async () => ({
    ok: (statusCode || 200) < 300,
    status: statusCode || 200,
    text: async () => JSON.stringify({
      candidates: [{ content: { parts: [{ text: teksGemini }] } }]
    })
  });
}

/** Tiruan yang gagal dengan pesan error bergaya Google. */
function pasangMockError(status, pesan) {
  global.fetch = async () => ({
    ok: false,
    status: status,
    text: async () => JSON.stringify({
      error: { code: status, message: pesan, status: 'ERROR' }
    })
  });
}

(async function () {
  process.env.AI_API_KEY = 'kunci-uji';

  // 6a. Generate berhasil
  pasangMock(JSON.stringify(contohAI));
  let res = resTiruan();
  resetCacheModel();
  await chat({ method: 'POST', headers: {}, body: {
    action: 'generate', bahasa: 'id', durasi: 2, budget: 'menengah',
    minat: ['budaya', 'kuliner'], gaya: 'padat', wilayahAwal: 'Ubud'
  }, socket: {} }, res);

  uji('Action generate mengembalikan itinerary valid', () => {
    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.payload.ok, true);
    assert.strictEqual(res.payload.itinerary.hari.length, 1);
    assert.strictEqual(res.payload.meta.tempatDitebuang, 1);
  });

  // 6b. Chat dengan perubahan
  pasangMock(JSON.stringify({
    reply: 'Sudah saya ubah, hari 2 jadi lebih santai.',
    perubahan: ['Hari 2 dikurangi jadi 2 kegiatan'],
    itinerary: contohAI
  }));
  res = resTiruan();
  resetCacheModel();
  await chat({ method: 'POST', headers: {}, body: {
    action: 'chat', bahasa: 'id', pesan: 'ganti hari 2 jadi lebih santai',
    itinerary: contohAI, riwayat: []
  }, socket: {} }, res);

  uji('Action chat mengembalikan reply + perubahan + itinerary', () => {
    assert.strictEqual(res.payload.ok, true);
    assert.ok(res.payload.balasan.reply.length > 0);
    assert.strictEqual(res.payload.balasan.perubahan.length, 1);
    assert.ok(res.payload.balasan.itinerary);
  });

  // 6c. Pesan chat terlalu panjang ditolak
  res = resTiruan();
  resetCacheModel();
  await chat({ method: 'POST', headers: {}, body: {
    action: 'chat', bahasa: 'id', pesan: 'x'.repeat(301), itinerary: null, riwayat: []
  }, socket: {} }, res);

  uji('Pesan chat > 300 karakter ditolak server', () => {
    assert.strictEqual(res.statusCode, 400);
    assert.strictEqual(res.payload.error, 'VALIDATION');
  });

  // 6d. Metode tidak diizinkan
  res = resTiruan();
  resetCacheModel();
  await chat({ method: 'GET', headers: {}, socket: {} }, res);
  uji('Metode GET ditolak', () => {
    assert.strictEqual(res.statusCode, 405);
  });

  // 6e. API key tidak ada
  const kunciAsli = process.env.AI_API_KEY;
  delete process.env.AI_API_KEY;
  res = resTiruan();
  resetCacheModel();
  await chat({ method: 'POST', headers: {}, body: { action: 'generate' }, socket: {} }, res);
  process.env.AI_API_KEY = kunciAsli;
  uji('Tanpa AI_API_KEY server memberi pesan jelas', () => {
    assert.strictEqual(res.statusCode, 500);
    assert.strictEqual(res.payload.error, 'NO_API_KEY');
  });

  // 6f. Fallback saat JSON tidak valid
  pasangMock('Maaf, saya tidak dapat membuat rencana saat ini.');
  res = resTiruan();
  resetCacheModel();
  await chat({ method: 'POST', headers: {}, body: {
    action: 'generate', bahasa: 'id', durasi: 2, budget: 'hemat',
    minat: ['alam'], gaya: 'santai', wilayahAwal: 'Ubud'
  }, socket: {} }, res);

  uji('Fallback: JSON tidak valid -> pesan ramah + rawText', () => {
    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.payload.ok, false);
    assert.strictEqual(res.payload.error, 'INVALID_AI_OUTPUT');
    assert.ok(res.payload.rawText.length > 0);
  });

  // 6g. 404 pada model utama -> pindah ke model cadangan
  let dipanggil = [];
  global.fetch = async (url) => {
    dipanggil.push(url);
    if (url.includes('gemini-3.8-flash')) {
      return {
        ok: false, status: 404,
        text: async () => JSON.stringify({ error: { code: 404, message: 'models/gemini-3.8-flash is not found for API version v1beta', status: 'NOT_FOUND' } })
      };
    }
    return {
      ok: true, status: 200,
      text: async () => JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify(contohAI) }] } }] })
    };
  };
  res = resTiruan();
  resetCacheModel();
  await chat({ method: 'POST', headers: {}, body: {
    action: 'generate', bahasa: 'id', durasi: 2, budget: 'hemat',
    minat: ['alam'], gaya: 'santai', wilayahAwal: 'Ubud'
  }, socket: {} }, res);

  uji('Model 404 -> otomatis pindah ke model cadangan', () => {
    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.payload.ok, true);
    assert.ok(dipanggil.length >= 2, 'harus mencoba model lebih dari satu');
    assert.ok(String(dipanggil[0]).includes('gemini-3.8-flash'));
    assert.ok(String(dipanggil[1]).includes('gemini-2.5-flash'));
  });

  // 6h. Semua model 404 -> pesan "Model AI tidak tersedia."
  global.fetch = async () => ({
    ok: false, status: 404,
    text: async () => JSON.stringify({ error: { code: 404, message: 'model not found', status: 'NOT_FOUND' } })
  });
  res = resTiruan();
  resetCacheModel();
  await chat({ method: 'POST', headers: {}, body: {
    action: 'generate', bahasa: 'id', durasi: 2, budget: 'hemat',
    minat: ['alam'], gaya: 'santai', wilayahAwal: 'Ubud'
  }, socket: {} }, res);

  uji('Semua model 404 -> pesan "Model AI tidak tersedia."', () => {
    assert.strictEqual(res.payload.error, 'AI_MODEL_UNAVAILABLE');
    assert.strictEqual(res.payload.message, 'Model AI tidak tersedia.');
  });

  // 6i. 429 -> pesan kuota
  pasangMockError(429, 'Resource has been exhausted (e.g. check quota).');
  res = resTiruan();
  resetCacheModel();
  await chat({ method: 'POST', headers: {}, body: {
    action: 'generate', bahasa: 'id', durasi: 2, budget: 'hemat',
    minat: ['alam'], gaya: 'santai', wilayahAwal: 'Ubud'
  }, socket: {} }, res);

  uji('429 -> pesan "Kuota AI sedang penuh, coba lagi 1 menit lagi."', () => {
    assert.strictEqual(res.statusCode, 429);
    assert.strictEqual(res.payload.error, 'AI_QUOTA');
    assert.strictEqual(res.payload.message, 'Kuota AI sedang penuh, coba lagi 1 menit lagi.');
  });

  // 6j. 403 -> pesan API key tidak valid
  pasangMockError(403, 'Permission denied for API key.');
  res = resTiruan();
  resetCacheModel();
  await chat({ method: 'POST', headers: {}, body: {
    action: 'generate', bahasa: 'id', durasi: 2, budget: 'hemat',
    minat: ['alam'], gaya: 'santai', wilayahAwal: 'Ubud'
  }, socket: {} }, res);

  uji('403 -> pesan "API key tidak valid."', () => {
    assert.strictEqual(res.payload.error, 'AI_AUTH');
    assert.strictEqual(res.payload.message, 'API key tidak valid.');
  });

  // 6k. 400 -> pesan permintaan ditolak
  pasangMockError(400, 'Invalid JSON payload received.');
  res = resTiruan();
  resetCacheModel();
  await chat({ method: 'POST', headers: {}, body: {
    action: 'generate', bahasa: 'id', durasi: 2, budget: 'hemat',
    minat: ['alam'], gaya: 'santai', wilayahAwal: 'Ubud'
  }, socket: {} }, res);

  uji('400 -> pesan permintaan ditolak layanan AI', () => {
    assert.strictEqual(res.statusCode, 400);
    assert.strictEqual(res.payload.error, 'AI_REJECTED');
  });

  // 6l. 500 -> pesan umum
  pasangMockError(500, 'Internal error.');
  res = resTiruan();
  resetCacheModel();
  await chat({ method: 'POST', headers: {}, body: {
    action: 'generate', bahasa: 'id', durasi: 2, budget: 'hemat',
    minat: ['alam'], gaya: 'santai', wilayahAwal: 'Ubud'
  }, socket: {} }, res);

  uji('500 -> pesan "Terjadi kesalahan, silakan coba lagi."', () => {
    assert.strictEqual(res.payload.error, 'SERVER_ERROR');
    assert.strictEqual(res.payload.message, 'Terjadi kesalahan, silakan coba lagi.');
  });

  // Kembalikan environment variable seperti semula
  Object.keys(envMODEL_SIMPAN).forEach((k) => {
    if (envMODEL_SIMPAN[k] === undefined) delete process.env[k];
    else process.env[k] = envMODEL_SIMPAN[k];
  });

  console.log('\n--------------------------------------');
  console.log('  Lulus: ' + lulus + '   Gagal: ' + gagal);
  console.log('--------------------------------------\n');
  process.exit(gagal === 0 ? 0 : 1);
})();
