/**
 * ============================================================================
 *  BALIWISE - Serverless Function (Vercel Node.js)
 *  File: api/chat.js
 * ----------------------------------------------------------------------------
 *  Fungsi ini adalah SATU-SATUNYA pintu masuk dari browser ke AI.
 *
 *  Kenapa harus lewat server (bukan langsung dari browser)?
 *   1. API key (AI_API_KEY) hanya tersimpan di environment variable server.
 *      Kalau dipanggil langsung dari browser, anyone bisa melihat key tersebut
 *      lewat DevTools dan memakai/mencurinya. Dengan cara ini key TIDAK PERNAH
 *      dikirim ke klien.
 *   2. Kita bisa menambahkan validasi, rate limit, dan ground-truth
 *      (data/destinasi.json) sebelum data sampai ke AI.
 *
 *  Dua aksi yang ditangani:
 *   - action = "generate" : membuat itinerary baru dari form preferensi.
 *   - action = "chat"     : obrolan lanjutan / mengubah itinerary yang ada.
 *
 *  Provider AI: Google Gemini (REST API). Tidak perlu npm install apa pun,
 *  sehingga proyek tetap ringan dan mudah di-deploy.
 *
 *  Environment variable yang dibutuhkan:
 *   AI_API_KEY  (wajib) - kunci API Google AI Studio / Gemini.
 *   AI_MODEL    (opsional, default: gemini-3.8-flash)
 * ============================================================================
 */

'use strict';

const fs = require('fs');
const path = require('path');

/* ---------------------------------------------------------------------------
 *  1. KONSTANTA & KONFIGURASI
 * ------------------------------------------------------------------------ */

const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models';

/* ---------------------------------------------------------------------------
 *  DAFTAR MODEL (dibaca dari environment variable, ada nilai bawaan)
 *  - AI_MODEL          : model utama.   Default: gemini-3.8-flash (stabil)
 *  - AI_MODEL_FALLBACK : model cadangan. Default: gemini-2.5-flash
 *  - AI_MODEL_DARURAT  : model cadangan kedua (jaring pengaman terakhir).
 *                        Default: gemini-3.6-flash (stabil, tidak dibatasi akses)
 *
 *  Catatan: gemini-2.0-flash sudah DIHAPUS oleh Google (shut down), sehingga
 *  permintaan ke model itu akan dibalas HTTP 404. Karena itu sekarang ada
 *  rantai model: jika model utama 404/400, server otomatis mencoba model
 *  berikutnya tanpa mengubah kode.
 * ------------------------------------------------------------------------ */
const DEFAULT_MODEL = 'gemini-3.8-flash';
const DEFAULT_MODEL_FALLBACK = 'gemini-2.5-flash';
const DEFAULT_MODEL_DARURAT = 'gemini-3.6-flash';

/* Model jaring pengaman terakhir: stabil & tersedia luas.
   dipakai kalau model utama + cadangan + darurat semua bermasalah
   (mis. sedang overload "high demand"). */
const MODEL_STABIL = ['gemini-3.5-flash-lite', 'gemini-3.1-flash-lite'];

/* Model yang dibalas 404 (sudah dihapus / tidak tersedia untuk kunci ini).
   Diingat sementara agar tidak dicoba berulang kali, tapi memakai masa
   tunggu supaya model bisa dicoba lagi nanti (kadang akses dipulihkan). */
const MODEL_MATI = new Map();
const MODEL_MATI_TTL_MS = 30 * 60 * 1000;

/* Model yang sedang overload ("high demand") diberi masa tunggu sejenak
   supaya request berikutnya langsung melompat ke model yang sehat. */
const MODEL_COOLDOWN = new Map();
const COOLDOWN_MS = 10 * 60 * 1000;

// Batas keras: mencegah penyalahgunaan & blew-up biaya token.
const MAX_CHAT_CHARS = 300;      // sesuai permintaan maksimal 300 karakter
const MAX_HISTORY_TURNS = 12;     // jumlah pesan riwayat yang dikirim ke AI
const REQUEST_TIMEOUT_MS = 30000; // timeout per permintaan (agar tidak eating seluruh anggaran)
const MAX_REQUESTS_PER_MINUTE = 20; // rate limit sederhana per IP

// Batas output token. PENTING: pada model Gemini 3.x, maxOutputTokens ikut
// menghitung token "thinking". Kalau terlalu kecil, jawaban bisa terpotong
// (status incomplete) sehingga JSON tidak bisa di-parse. Jadi nilainya longgar.
const MAX_OUTPUT_TOKENS = 32768;

// Batas waktu TOTAL untuk satu pemanggilan AI (semua model + semua variasi).
const TOTAL_BUDGET_MS = 75000;

const VALID_BUDGET = ['hemat', 'menengah', 'mewah'];
const VALID_GAYA = ['santai', 'padat'];
const VALID_KATEGORI = ['pantai', 'budaya', 'kuliner', 'alam', 'belanja'];

/* ---------------------------------------------------------------------------
 *  2. PEMBACAAN DATA DESTINASI (ground truth anti-halusinasi)
 * ------------------------------------------------------------------------ */

let CACHE_DESTINASI = null; // cache supaya tidak membaca disk setiap request

/**
 * Membaca data/destinasi.json dari filesystem server.
 * Di Vercel, folder proyek ikut ter-deploy, jadi path ini valid.
 */
function muatDestinasi() {
  if (CACHE_DESTINASI) return CACHE_DESTINASI;

  const FILE = path.join(process.cwd(), 'data', 'destinasi.json');
  const data = JSON.parse(fs.readFileSync(FILE, 'utf8'));

  // Index cepat: nama -> objek destinasi (kunci dinormalisasi lowercase).
  const index = new Map();
  data.destinasi.forEach((d) => {
    index.set(normalisasi(d.nama), d);
    index.set(normalisasi(d.namaEn), d);
    index.set(normalisasi(d.id), d);
  });

  CACHE_DESTINASI = { ...data, index };
  return CACHE_DESTINASI;
}

/** Mengubah string menjadi kunci banding yang konsisten. */
function normalisasi(teks) {
  return String(teks || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/* ---------------------------------------------------------------------------
 *  3. SYSTEM PROMPT
 *     Inti dari integrasi AI. Ditulis lengkap agar model tidak mengarang.
 * ------------------------------------------------------------------------ */

/**
 * Membangun system prompt sesuai bahasa yang dipilih pengguna.
 * @param {object} data - data/destinasi.json
 * @param {string} bahasa - 'id' atau 'en'
 */
function bangunSystemPrompt(data, bahasa) {
  const en = bahasa === 'en';

  // Ringkas data agar prompt tidak terlalu panjang tapi tetap lengkap.
  const katalog = data.destinasi.map((d) => ({
    id: d.id,
    nama: en ? d.namaEn : d.nama,
    namaLain: en ? d.nama : d.namaEn,
    wilayah: d.wilayah,
    kategori: d.kategori,
    hargaTiket: d.hargaTiket,
    jamBuka: d.jamBuka,
    durasiMenit: d.durasiMenit,
    deskripsi: d.deskripsi,
    tipsEtika: d.tipsEtika,
    catatan: d.catatanAI
  }));

  // Label kategori sesuai bahasa agar model tidak salah tulis.
  const labelKategori = en
    ? { pantai: 'beach', budaya: 'culture', kuliner: 'food', alam: 'nature', belanja: 'shopping' }
    : { pantai: 'pantai', budaya: 'budaya', kuliner: 'kuliner', alam: 'alam', belanja: 'belanja' };

  /* ------------------- ATURAN BAHASA INDONESIA ------------------- */
  const aturanID = `Kamu adalah "BaliWise", seorang asisten perencanaan perjalanan yang ahli menjelajah Bali.

TUJUANMU:
Membuat rencana perjalanan (itinerary) yang realistis, detail, dan aman untuk wisatawan, SERTA menyertakan panduan budaya dan etika di setiap lokasi agar wisatawan baru tidak salah adat.

ATURAN WAJIB (tidak boleh dilanggar):
1. HANYA boleh merekomendasikan nama tempat yang ada di KATALOG di bawah. DILARANG keras menyebut tempat, restoran, hotel, atau atraksi yang tidak ada di katalog. Jika katalog tidak punya tempat yang cocok, pilih yang paling mendekati dari katalog.
2. Gunakan HANYA nama tempat dari katalog apa adanya. Jangan menambah, mengubah, atau menggabungkan nama tempat.
3. Setiap jadwal wajib memiliki "tipsBudaya" berisi 2-4 tips etika yang relevan dengan tempat tersebut (ambil dari katalog agar akurat).
4. Jam kegiatan harus berada di dalam rentang "jamBuka" tempat tersebut. Untuk tempat dengan jamBuka "24 jam" bebas memilih jam.
5. Estimasi biaya harus realistis: gunakan "hargaTiket" sebagai tiket masuk, lalu tambahkan estimasi transport dan makanan wajar sesuai budget.
6. Jadwalkan hari berdasarkan kedekatan geografis (kelompokkan wilayah yang sama dalam satu hari) agar tidak membuang waktu di jalan.
7. Hari ke-1 SELALU dimulai dari "wilayahAwal" yang diminta pengguna.
8. Jangan pernah menyebut harga dalam mata uang lain; gunakan Rupiah (Rp) dan tulis TANPA titik (contoh: 75000).
9. Jangan mengulang tempat yang sama di hari yang sama.
10. Maksimal 5 kegiatan per hari untuk gaya "padat", maksimal 3 kegiatan untuk gaya "santai".
11. Total biaya harian harus sesuai level budget:
    - hemat    : sekitar Rp 300000 - Rp 800000 per hari
    - menengah : sekitar Rp 800000 - Rp 1800000 per hari
    - mewah    : sekitar Rp 1800000 ke atas per hari
    Perhatikan bahwa "hargaTiket" pada katalog sudah termasuk di dalamnya.
12. Jika durasi hanya 1 hari dan waktunya kurang, pilih tempat yang paling relevan dengan minat pengguna.
13. Jika catatan tempat menyebut butuh satu hari penuh (misalnya Nusa Penida), jadwalkan sebagai satu-satunya kegiatan hari itu.`;

  /* ------------------- ATURAN BAHASA INGGRIS ------------------- */
  const aturanEN = `You are "BaliWise", a travel-planning assistant and Bali expert.

YOUR GOAL:
Build a realistic, detailed and safe travel itinerary for tourists, AND include a culture and etiquette guide for every location so first-time visitors never offend local customs.

MANDATORY RULES (never break them):
1. You may ONLY recommend place names that appear in the CATALOGUE below. It is strictly forbidden to mention any place, restaurant, hotel or attraction that is not in the catalogue. If nothing matches perfectly, pick the closest catalogue entry.
2. Use the place names EXACTLY as written in the catalogue. Do not add, translate or merge names.
3. Every schedule entry MUST include "tipsBudaya" with 2-4 etiquette tips relevant to that place (reuse the catalogue tips so they stay accurate).
4. Activity times must fall inside the place "jamBuka" range. Places open "24 jam" allow any time.
5. Cost estimates must be realistic: use "hargaTiket" as the entrance ticket, then add reasonable transport and food costs for the chosen budget.
6. Group days by geographic proximity (same region in the same day) so travellers do not waste time on the road.
7. Day 1 MUST start in the requested "wilayahAwal".
8. Never quote prices in another currency; use Indonesian Rupiah (Rp) written WITHOUT dots (example: 75000).
9. Never repeat the same place within the same day.
10. Maximum 5 activities per day for the "padat" (packed) style, maximum 3 for the "santai" (relaxed) style.
11. The daily total must match the budget level:
    - hemat (budget)  : about Rp 300000 - Rp 800000 per day
    - menengah (mid) : about Rp 800000 - Rp 1800000 per day
    - mewah (luxury)  : about Rp 1800000 and above per day
    Remember that the catalogue "hargaTiket" values are already included in those totals.
12. If the trip is only 1 day and time is tight, pick the places that best match the user interests.
13. If a catalogue note says a place needs a full day (for example Nusa Penida), schedule it as the only activity of that day.`;

  const aturan = en ? aturanEN : aturanID;

  /* Aturan bahasa OUTPUT. WAJIB ada dan eksplisit, kalau tidak model bisa
     saja menulis aktivitas/tips dalam Bahasa Indonesia walau pengguna
     memilih English (atau sebaliknya). */
  const aturanOutput = en
    ? 'OUTPUT LANGUAGE RULE (STRICT): Write EVERY string value in natural English -\n' +
      'including "ringkasan", "tema", "aktivitas", "tipsBudaya", and "transportasi".\n' +
      'Use the catalogue "nama" value verbatim as the place name.\n' +
      'Do NOT write any Indonesian words.'
    : 'ATURAN BAHASA OUTPUT (WAJIB): Tulis SEMUA nilai string dalam Bahasa Indonesia yang natural -\n' +
      'termasuk "ringkasan", "tema", "aktivitas", "tipsBudaya", dan "transportasi".\n' +
      'Gunakan nilai "nama" dari katalog apa adanya sebagai nama tempat.\n' +
      'Jangan menulis kata-kata dalam Bahasa Inggris.';

  return `${aturan}

${aturanOutput}

FORMAT OUTPUT (STRICT):
Reply with a single VALID JSON object only. No extra text, no markdown, no code fence.

JSON structure:
{
  "ringkasan": "a 1-2 sentence summary of the plan",
  "totalEstimasi": 1234567,
  "hari": [
    {
      "hari": 1,
      "tema": "a short theme for the day",
      "totalBiaya": 450000,
      "jadwal": [
        {
          "jam": "08.00",
          "namaTempat": "place name EXACTLY as in the catalogue",
          "wilayah": "region of the place",
          "kategori": "${Object.keys(labelKategori).join('|')}",
          "aktivitas": "a one-sentence description of the activity",
          "durasiMenit": 90,
          "estimasiBiaya": 75000,
          "tipsBudaya": ["tip 1", "tip 2"],
          "transportasi": "a short transport note"
        }
      ]
    }
  ]
}

CATALOGUE OF DESTINATIONS (ground truth - the only source of truth):
${JSON.stringify(katalog, null, 1)}
`;
}

/**
 * System prompt untuk sesi chat lanjutan.
 * Menyertakan itinerary sebelumnya + daftar katalog supaya model tetap
 * "grounded" dan tidak mengarang tempat baru.
 */
function bangunChatPrompt(data, bahasa, itinerary, riwayat) {
  const en = bahasa === 'en';

  const katalogRingkas = data.destinasi.map((d) => ({
    nama: en ? d.namaEn : d.nama,
    namaLain: en ? d.nama : d.namaEn,
    wilayah: d.wilayah,
    kategori: d.kategori,
    hargaTiket: d.hargaTiket,
    jamBuka: d.jamBuka,
    tipsEtika: d.tipsEtika
  }));

  const strukturJSON = `{
  "reply": "jawaban singkat 1-4 kalimat untuk ditampilkan di chat",
  "perubahan": ["ringkasan singkat setiap perubahan yang dilakukan (maks 4 item)"],
  "itinerary": { "ringkasan": "...", "totalEstimasi": 0, "hari": [ { "hari": 1, "tema": "...", "totalBiaya": 0, "jadwal": [ { "jam": "08.00", "namaTempat": "...", "wilayah": "...", "kategori": "...", "aktivitas": "...", "durasiMenit": 90, "estimasiBiaya": 75000, "tipsBudaya": ["..."], "transportasi": "..." } ] } ] } | null
}`;

  /* ------------------- ATURAN BAHASA INDONESIA ------------------- */
  const aturanID = `Kamu adalah "BaliWise", asisten perencana perjalanan Bali yang sedang berkomunikasi dengan pengguna lewat chat.

ATURAN WAJIB:
1. Ingat itinerary yang sudah dibuat (lihat di bawah) dan gunakan sebagai konteks.
2. HANYA boleh menyebut nama tempat yang ada di KATALOG. DILARANG mengarang tempat baru.
3. Jika pengguna meminta perubahan (misalnya "ganti hari 2 jadi lebih santai"), terapkan perubahannya dan kembalikan itinerary lengkap yang sudah diperbarui pada field "itinerary".
4. Jika pengguna hanya bertanya (misalnya "berapa harga tiket Pura Uluwatu?"), jawab singkat pada field "reply" DAN set "itinerary" menjadi null (rencana tidak berubah).
5. Balas HANYA dengan JSON valid, tanpa teks tambahan, tanpa markdown, tanpa code fence.
6. Balas dalam Bahasa Indonesia yang natural dan ramah.
7. Field "perubahan" diisi HANYA bila ada perubahan nyata pada itinerary.
8. BAHASA OUTPUT (WAJIB): SEMUA nilai string harus dalam Bahasa Indonesia yang natural -
   termasuk "reply", "tema", "aktivitas", "tipsBudaya", dan "transportasi" dari itinerary
   yang dikembalikan. Gunakan nilai "nama" dari katalog apa adanya. Jangan menulis kata
   dalam Bahasa Inggris.`;

  /* ------------------- ATURAN BAHASA INGGRIS ------------------- */
  const aturanEN = `You are "BaliWise", a Bali travel-planning assistant chatting with a user.

MANDATORY RULES:
1. Remember the itinerary that was already created (see below) and use it as context.
2. You may ONLY mention place names that appear in the CATALOGUE. Never invent a new place.
3. If the user requests a change (for example "make day 2 more relaxed"), apply it and return the FULL updated itinerary in the "itinerary" field.
4. If the user only asks a question (for example "how much is the ticket to Uluwatu?"), answer briefly in the "reply" field AND set "itinerary" to null (the plan does not change).
5. Reply with VALID JSON only, no extra text, no markdown, no code fence.
6. Reply in natural, friendly English.
7. Fill the "perubahan" field ONLY when the itinerary actually changed.
8. OUTPUT LANGUAGE (STRICT): EVERY string value must be in natural English - including
   "reply", "tema", "aktivitas", "tipsBudaya", and "transportasi" of the itinerary you return.
   Use the catalogue "nama" value verbatim as the place name. Do NOT write any Indonesian words.`;

  const aturan = en ? aturanEN : aturanID;

  return `${aturan}

JSON structure:
${strukturJSON}

ITINERARY SEBELUMNYA (konteks):
${JSON.stringify(itinerary, null, 1)}

KATALOG DESTINASI (ground truth):
${JSON.stringify(katalogRingkas, null, 1)}

RIWAYAT PERCAKAPAN:
${JSON.stringify(riwayat, null, 1)}
`;
}

/* ---------------------------------------------------------------------------
 *  4. RESPONSE SCHEMA (agar Gemini dijamin balas JSON valid)
 * ------------------------------------------------------------------------ */

/**
 * Skema JSON untuk itinerary.
 * Tipe ditulis lowercase ("object", "string", ...) mengikuti format resmi
 * Google pada dokumentasi Structured Output terkini, sehingga kompatibel
 * dengan model lama maupun model Gemini 3.x/4.x.
 */
function jadwalSchema() {
  return {
    type: 'object',
    properties: {
      ringkasan: { type: 'string' },
      totalEstimasi: { type: 'number' },
      hari: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            hari: { type: 'integer' },
            tema: { type: 'string' },
            totalBiaya: { type: 'number' },
            jadwal: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  jam: { type: 'string' },
                  namaTempat: { type: 'string' },
                  wilayah: { type: 'string' },
                  kategori: { type: 'string' },
                  aktivitas: { type: 'string' },
                  durasiMenit: { type: 'integer' },
                  estimasiBiaya: { type: 'number' },
                  tipsBudaya: { type: 'array', items: { type: 'string' } },
                  transportasi: { type: 'string' }
                },
                required: ['jam', 'namaTempat', 'aktivitas']
              }
            }
          },
          required: ['hari', 'jadwal']
        }
      }
    },
    required: ['ringkasan', 'hari']
  };
}

/* ---------------------------------------------------------------------------
 *  5. PEMANGGILAN GEMINI
 * ------------------------------------------------------------------------ */

/**
 * Menyusun daftar model yang akan dicoba berurutan.
 * Urutan: model utama -> cadangan -> darurat -> jaring pengaman stabil.
 * Duplikat dibuang, dan model yang sudah 404 (dihapus Google) dilewati.
 * @returns {string[]} daftar nama model
 */
function daftarModel() {
  const mentah = [
    process.env.AI_MODEL,
    process.env.AI_MODEL_FALLBACK,
    process.env.AI_MODEL_DARURAT
  ];
  const bawaan = [DEFAULT_MODEL, DEFAULT_MODEL_FALLBACK, DEFAULT_MODEL_DARURAT];

  const kandidat = [];
  for (let i = 0; i < bawaan.length; i++) {
    const nama = (mentah[i] || bawaan[i] || '').trim();
    if (nama) kandidat.push(nama);
  }
  kandidat.push(...MODEL_STABIL);

  // Buang duplikat, tetapkan urutannya.
  const semua = [];
  for (const nama of kandidat) if (!semua.includes(nama)) semua.push(nama);

  const sekarang = Date.now();
  const hasil = [];
  for (const nama of semua) {
    const sampaiMati = MODEL_MATI.get(nama);
    if (sampaiMati && sekarang < sampaiMati) continue;  // masih diblacklist
    if (sampaiMati) MODEL_MATI.delete(nama);            // blacklist sudah habis

    const sampaiCool = MODEL_COOLDOWN.get(nama);
    if (sampaiCool && sekarang < sampaiCool) continue; // masih overload
    if (sampaiCool) MODEL_COOLDOWN.delete(nama);

    hasil.push(nama);
  }

  // PENTING: jangan pernah benar-benar kosong. Kalau semua model sedang
  // di-skip, tetap coba model utama supaya error yang muncul akurat
  // (mis. 429 kuota, bukan "error umum").
  return hasil.length ? hasil : [semua[0]];
}

/* Model yang sudah DIHAPUS Google -> pasti dibalas HTTP 404.
   Rantai model akan rescuing secara otomatis, tapi kita beri peringatan
   di log supaya mudah didiagnosis. */
const MODEL_SUDAH_HILANG = [
  'gemini-2.0-flash',
  'gemini-2.0-flash-lite',
  'gemini-1.5-flash',
  'gemini-1.5-flash-8b'
];
let sudahPeringatanModel = false;

/** Peringatan sekali saja bila env var menunjuk model yang sudah dihapus. */
function peringatanModelMati() {
  if (sudahPeringatanModel) return;
  sudahPeringatanModel = true;

  const utama = String(process.env.AI_MODEL || '').trim();
  if (MODEL_SUDAH_HILANG.includes(utama)) {
    console.warn(
      `[BaliWise] PERINGATAN: AI_MODEL="${utama}" sudah dihapus oleh Google (akan dibalas 404).` +
      ` Rantai model akan otomatis mencoba "${DEFAULT_MODEL_FALLBACK}" lalu "${DEFAULT_MODEL_DARURAT}".` +
      ` Sebaiknya ubah AI_MODEL menjadi "${DEFAULT_MODEL}".`
    );
  }
}

/**
 * Memanggil Gemini REST API untuk satu model.
 * Fungsi ini TIDAK melempar error HTTP; status & pesan asli dari Google
 * dikembalikan agar bisa dicatat dan ditangani pemanggil.
 *
 * @param {string} model - nama model, mis. "gemini-3.8-flash"
 * @param {object} payload - body request
 * @returns {Promise<{ok: boolean, data?: object, status?: number, pesanAsli?: string, statusGoogle?: string}>}
 */
async function panggilGemini(model, payload) {
  const url = `${GEMINI_API_URL}/${model}:generateContent`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // API key hanya dikirim ke domain Google, tidak pernah dicetak ke log.
        'x-goog-api-key': process.env.AI_API_KEY
      },
      body: JSON.stringify(payload),
      signal: controller.signal
    });

    const teks = await response.text();

    if (!response.ok) {
      // Ambil pesan asli dari Google agar mudah didiagnosis.
      let pesanAsli = teks.slice(0, 500);
      let statusGoogle = '';
      try {
        const parsed = JSON.parse(teks);
        if (parsed && parsed.error) {
          pesanAsli = parsed.error.message || pesanAsli;
          statusGoogle = parsed.error.status || '';
        }
      } catch (_) {
        /* body bukan JSON -> pakai potongan teks apa adanya */
      }

      // Log di terminal: status + pesan asli dari Google. API key TIDAK pernah ikut.
      console.error(
        `[BaliWise] Gemini gagal | model=${model} | status=${response.status}` +
        (statusGoogle ? ` (${statusGoogle})` : '') +
        ` | pesan: ${pesanAsli}`
      );

      return { ok: false, status: response.status, pesanAsli, statusGoogle };
    }

    return { ok: true, data: JSON.parse(teks) };
  } catch (err) {
    if (err.name === 'AbortError') {
      console.error(`[BaliWise] Gemini timeout | model=${model} | ${REQUEST_TIMEOUT_MS}ms`);
      return { ok: false, status: 504, pesanAsli: 'Permintaan ke AI melewati batas waktu.', statusGoogle: 'TIMEOUT' };
    }
    console.error(`[BaliWise] Gemini gagal diakses | model=${model} | ${err.message}`);
    return { ok: false, status: 503, pesanAsli: err.message, statusGoogle: 'NETWORK' };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Menjalankan AI dengan fallback berlapis.
 *
 * Lapis A - Rantai model (untuk model yang sudah dihapus / tidak tersedia):
 *   model utama -> model cadangan -> model darurat.
 *   Error 404 (model tidak ada) langsung pindah ke model berikutnya.
 *
 * Lapis B - Rantai parameter (untuk 400 "payload ditolak"):
 *   1. schema + responseMimeType + temperature  (paling ketat)
 *   2. responseMimeType + temperature           (tanpa schema)
 *   3. responseMimeType saja                     (paling minimal)
 *   Semua langkah tetap meminta JSON lewat system prompt, dan hasilnya
 *   tetap diparse dengan parser berlapis (parseJSONAman).
 *
 * Error 401/403 (API key) dan 429 (kuota) TIDAK dipindah ke model lain,
 * karena penyebabnya bukan model.
 *
 * @param {string} systemInstruction - system prompt + katalog
 * @param {string} userContent - instruksi/preferensi pengguna
 * @param {boolean} pakaiSchema - true untuk aksi "generate"
 */
async function jalankanAI(systemInstruction, userContent, pakaiSchema) {
  const modelUtama = daftarModel();
  const mulaiTotal = Date.now();
  let percobaanTerakhir = null;

  for (const model of modelUtama) {
    // Kalau anggaran waktu sudah habis, jangan coba model berikutnya.
    if (Date.now() - mulaiTotal > TOTAL_BUDGET_MS) {
      console.error('[BaliWise] Batas waktu total AI habis, berhenti mencoba model lain.');
      break;
    }

    // --- Lapis B: variasi parameter untuk model ini ---
    const variasi = pakaiSchema
      ? [
          { label: 'schema+temperature', config: { temperature: 0.45, responseMimeType: 'application/json', responseSchema: jadwalSchema() } },
          { label: 'json-mode', config: { temperature: 0.45, responseMimeType: 'application/json' } },
          { label: 'minimal', config: { responseMimeType: 'application/json' } }
        ]
      : [
          { label: 'json-mode', config: { temperature: 0.45, responseMimeType: 'application/json' } },
          { label: 'minimal', config: { responseMimeType: 'application/json' } }
        ];

    for (const variasiSaatIni of variasi) {
      const payload = {
        systemInstruction: { parts: [{ text: systemInstruction }] },
        contents: [{ role: 'user', parts: [{ text: userContent }] }],
        generationConfig: Object.assign(
          { maxOutputTokens: MAX_OUTPUT_TOKENS },
          variasiSaatIni.config
        )
      };

      const hasil = await panggilGemini(model, payload);

      if (hasil.ok) {
        console.log(
          `[BaliWise] Gemini OK | model=${model} | mode=${variasiSaatIni.label}` +
          ` | maxOutputTokens=${MAX_OUTPUT_TOKENS} | ${Date.now() - mulaiTotal}ms`
        );
        return hasil.data;
      }

      percobaanTerakhir = Object.assign({ model, mode: variasiSaatIni.label }, hasil);

      // 401/403 (API key) & 429 (kuota): bukan masalah model -> langsung naik.
      if (hasil.status === 401 || hasil.status === 403 || hasil.status === 429) {
        const err = new Error(hasil.pesanAsli || 'Permintaan ke AI ditolak.');
        err.status = hasil.status;
        err.pesanAsli = hasil.pesanAsli;
        err.model = model;
        throw err;
      }

      // 404 = model tidak ada (mis. sudah dihapus Google).
      // 503 = model sedang overload ("high demand").
      // 5xx lain = gangguan layanan. Semuanya -> LANGSUNG ke model berikutnya,
      // karena mengulang model yang sama hanya memperpanjang waktu tunggu.
      if (hasil.status === 404) {
        // Ingat model ini sementara, supaya tidak dicoba lagi terus-menerus.
        MODEL_MATI.set(model, Date.now() + MODEL_MATI_TTL_MS);
        console.warn(`[BaliWise] Model "${model}" tidak tersedia untuk kunci ini, dilewati.`);
        break;
      }
      if (hasil.status === 503 || hasil.status >= 500) {
        // Model sedang overload -> beri masa tunggu supaya request berikutnya
        // langsung memakai model lain yang sehat.
        MODEL_COOLDOWN.set(model, Date.now() + COOLDOWN_MS);
        console.warn(`[BaliWise] Model "${model}" sedang overload, diberi jeda ${COOLDOWN_MS / 60000} menit.`);
        break;
      }

      // 400 = payload ditolak -> coba variasi parameter berikutnya.
    }
  }

  // Semua model & variasi gagal: lempar error dengan informasi terakhir.
  const err = new Error((percobaanTerakhir && percobaanTerakhir.pesanAsli) || 'Permintaan ke AI gagal.');
  if (percobaanTerakhir) {
    err.status = percobaanTerakhir.status;
    err.pesanAsli = percobaanTerakhir.pesanAsli;
    err.model = percobaanTerakhir.model;
  }
  throw err;
}

/* ---------------------------------------------------------------------------
 *  6. PARSING & VALIDASI HASIL AI
 * ------------------------------------------------------------------------ */

/**
 * Mengambil teks dari respons Gemini.
 */
function ambilTeksRespons(hasil) {
  const candidates = hasil?.candidates || [];
  for (const c of candidates) {
    const parts = c?.content?.parts || [];
    const teks = parts.map((p) => p.text || '').join('');
    if (teks.trim()) return teks;
  }
  return '';
}

/**
 * Parse teks AI menjadi objek JSON.
 * Menangani kasus AI membungkus JSON dengan markdown code fence.
 * @returns {object|null} objek JSON atau null bila gagal
 */
function parseJSONAman(teks) {
  if (!teks) return null;

  let cleaned = String(teks).trim();

  // Buang code fence ```json ... ```
  cleaned = cleaned.replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();

  // Coba parse langsung
  try {
    return JSON.parse(cleaned);
  } catch (_) {
    /* lanjut ke strategi berikutnya */
  }

  // Ambil objek JSON pertama yang balancing (finding objek terluar).
  const start = cleaned.indexOf('{');
  if (start === -1) return null;

  let depth = 0;
  let inString = false;
  let escape = false;

  for (let i = start; i < cleaned.length; i++) {
    const ch = cleaned[i];
    if (escape) { escape = false; continue; }
    if (ch === '\\') { escape = true; continue; }
    if (ch === '"') { inString = !inString; continue; }
    if (inString) continue;

    if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) {
        try {
          return JSON.parse(cleaned.slice(start, i + 1));
        } catch (_) {
          return null;
        }
      }
    }
  }
  return null;
}

/**
 * Membersihkan & membenahi itinerary agar:
 *  - tidak memuat tempat yang tidak ada di katalog (anti-halusinasi), dan
 *  - data wilayah/kategori/harga selalu diambil dari katalog (grounding).
 * @returns {{itinerary: object|null, dibuang: number}}
 */
function bersihkanItinerary(hasilAI, data) {
  const obj = parseJSONAman(hasilAI);
  if (!obj || !Array.isArray(obj.hari)) return { itinerary: null, dibuang: 0 };

  let dibuang = 0;
  const hariBersih = [];

  obj.hari.forEach((h, i) => {
    const jadwal = Array.isArray(h.jadwal) ? h.jadwal : [];
    const jadwalBersih = [];

    jadwal.forEach((item) => {
      const namaAI = String(item.namaTempat || '').trim();
      if (!namaAI) { dibuang++; return; }

      // Cari kandidat di katalog: cocok persis dulu, lalu mencocokkan sebagian (memuat).
      const kuncinama = normalisasi(namaAI);
      let dest = data.index.get(kuncinama);
      if (!dest) {
        dest = data.destinasi.find((d) =>
          normalisasi(d.nama).includes(kuncinama) || kuncinama.includes(normalisasi(d.nama))
        );
      }

      // Tidak ada di katalog -> buang (anti-halusinasi).
      if (!dest) { dibuang++; return; }

      const tips = Array.isArray(item.tipsBudaya) && item.tipsBudaya.length
        ? item.tipsBudaya.filter((t) => typeof t === 'string' && t.trim()).slice(0, 4)
        : dest.tipsEtika.slice(0, 3); // fallback ke tips resmi katalog

      jadwalBersih.push({
        jam: String(item.jam || '08.00').trim(),
        namaTempat: dest.nama,
        namaTempatEn: dest.namaEn,
        wilayah: dest.wilayah,        // selalu dari katalog
        kategori: dest.kategori,      // selalu dari katalog
        aktivitas: String(item.aktivitas || dest.deskripsi).trim(),
        durasiMenit: Number(item.durasiMenit) || dest.durasiMenit,
        estimasiBiaya: Math.max(0, Number(item.estimasiBiaya) || dest.hargaTiket || 0),
        hargaTiket: dest.hargaTiket,
        jamBuka: dest.jamBuka,
        tipsBudaya: tips,
        transportasi: String(item.transportasi || '').trim()
      });
    });

    if (jadwalBersih.length === 0) return; // hari kosong -> buang

    const totalBiaya = jadwalBersih.reduce((sum, j) => sum + j.estimasiBiaya, 0);
    hariBersih.push({
      hari: Number(h.hari) || i + 1,
      tema: String(h.tema || '').trim(),
      totalBiaya,
      jadwal: jadwalBersih
    });
  });

  if (hariBersih.length === 0) return { itinerary: null, dibuang };

  const totalEstimasi = hariBersih.reduce((sum, h) => sum + h.totalBiaya, 0);

  return {
    itinerary: {
      ringkasan: String(obj.ringkasan || '').trim(),
      totalEstimasi,
      hari: hariBersih
    },
    dibuang
  };
}

/**
 * Membersihkan hasil chat (reply + perubahan + itinerary opsional).
 */
function bersihkanChat(hasilAI, data) {
  const obj = parseJSONAman(hasilAI);
  if (!obj) return null;

  const reply = String(obj.reply || '').trim();
  const perubahan = Array.isArray(obj.perubahan)
    ? obj.perubahan.filter((p) => typeof p === 'string' && p.trim()).slice(0, 4)
    : [];

  let itinerary = null;
  if (obj.itinerary && Array.isArray(obj.itinerary.hari)) {
    const hasil = bersihkanItinerary(JSON.stringify(obj.itinerary), data);
    itinerary = hasil.itinerary;
  }

  // Kalau JSON gagal total tapi ada teks, jadikan teks balasan biasa.
  if (!reply && !itinerary) return null;

  return { reply, perubahan, itinerary };
}

/* ---------------------------------------------------------------------------
 *  7. VALIDASI INPUT
 * ------------------------------------------------------------------------ */

/**
 * Validasi & normalisasi preferensi dari form.
 * @returns {{ok: boolean, data?: object, error?: string}}
 */
function validasiPreferensi(body) {
  const durasi = Number(body.durasi);
  if (!Number.isInteger(durasi) || durasi < 1 || durasi > 7) {
    return { ok: false, error: 'Durasi harus berupa angka bulat antara 1 sampai 7 hari.' };
  }

  if (!VALID_BUDGET.includes(body.budget)) {
    return { ok: false, error: 'Level budget tidak valid.' };
  }

  if (!VALID_GAYA.includes(body.gaya)) {
    return { ok: false, error: 'Gaya perjalanan tidak valid.' };
  }

  const minat = Array.isArray(body.minat)
    ? [...new Set(body.minat.filter((m) => VALID_KATEGORI.includes(m)))]
    : [];
  if (minat.length === 0) {
    return { ok: false, error: 'Pilih minimal satu minat perjalanan.' };
  }

  const wilayahAwal = String(body.wilayahAwal || '').trim();
  if (!wilayahAwal || wilayahAwal.length > 60) {
    return { ok: false, error: 'Wilayah awal tidak valid.' };
  }

  const catatan = String(body.catatan || '').trim().slice(0, 300); // batas 300 karakter

  return {
    ok: true,
    data: { durasi, budget: body.budget, minat, gaya: body.gaya, wilayahAwal, catatan }
  };
}

/* ---------------------------------------------------------------------------
 *  8. RATE LIMIT SEDERHANA (per IP, in-memory)
 * ------------------------------------------------------------------------ */

const cekLimiter = new Map();

function terlaluBanyak(req) {
  const ip =
    (req.headers['x-forwarded-for'] || '').split(',')[0].trim() ||
    req.socket?.remoteAddress ||
    'unknown';

  const now = Date.now();
  const jendela = 60000; // 1 menit

  const hasil = cekLimiter.get(ip);
  if (!hasil || now - hasil.mulai > jendela) {
    cekLimiter.set(ip, { mulai: now, jumlah: 1 });
    return false;
  }

  hasil.jumlah += 1;
  return hasil.jumlah > MAX_REQUESTS_PER_MINUTE;
}

/* ---------------------------------------------------------------------------
 *  9. UTILITAS RESPON
 * ------------------------------------------------------------------------ */

/**
 * Mengirim respons JSON.
 * Portable: mendukung res.status().json() (Vercel) maupun objek response
 * bawaan Node.js (server lokal / platform lain).
 */
function kirimJSON(res, status, payload) {
  if (typeof res.status === 'function' && typeof res.json === 'function') {
    return res.status(status).json(payload);
  }
  res.statusCode = status;
  if (!res.getHeader || !res.getHeader('Content-Type')) {
    res.setHeader('Content-Type', 'application/json');
  }
  return res.end(JSON.stringify(payload));
}

/** Mengirim pesan error dalam format JSON yang seragam. */
function kirimError(res, status, kode, pesan) {
  return kirimJSON(res, status, { ok: false, error: kode, message: pesan });
}

/* ---------------------------------------------------------------------------
 * 10. HANDLER UTAMA
 * ------------------------------------------------------------------------ */

async function handler(req, res) {
  // Header CORS (aman untuk pengembangan lokal).
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    if (typeof res.status === 'function') return res.status(204).end();
    res.statusCode = 204;
    return res.end();
  }
  if (req.method !== 'POST') {
    return kirimError(res, 405, 'METHOD_NOT_ALLOWED', 'Gunakan metode POST.');
  }

  // Cek API key
  if (!process.env.AI_API_KEY) {
    return kirimError(
      res, 500, 'NO_API_KEY',
      'AI_API_KEY belum diatur di environment variable server. Ikuti langkah di README.md.'
    );
  }

  // Peringatan bila AI_MODEL menunjuk model yang sudah dihapus Google.
  peringatanModelMati();

  // Rate limit
  if (terlaluBanyak(req)) {
    return kirimError(res, 429, 'RATE_LIMITED', 'Terlalu banyak permintaan. Tunggu satu menit lalu coba lagi.');
  }

  // Parse body (Vercel sudah parse JSON, tapi tangani juga string).
  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch (_) { body = {}; }
  }
  body = body || {};

  const aksi = String(body.action || 'generate');
  const bahasa = body.bahasa === 'en' ? 'en' : 'id';

  let data;
  try {
    data = muatDestinasi();
  } catch (err) {
    return kirimError(res, 500, 'DATA_ERROR', 'File data/destinasi.json tidak dapat dibaca di server.');
  }

  try {
    /* ---------------------------------------------------------------------
     *  AKSI 1: GENERATE ITINERARY
     * ------------------------------------------------------------------- */
    if (aksi === 'generate') {
      const v = validasiPreferensi(body);
      if (!v.ok) return kirimError(res, 400, 'VALIDATION', v.error);

      const p = v.data;
      const systemInstruction = bangunSystemPrompt(data, bahasa);

      // User content: preferensi + instruksi bahasa.
      const userContent =
        `Buatkan itinerary ${p.durasi} hari di Bali dengan ketentuan:\n` +
        `- Budget: ${p.budget}\n` +
        `- Minat: ${p.minat.join(', ')}\n` +
        `- Gaya perjalanan: ${p.gaya}\n` +
        `- Wilayah awal: ${p.wilayahAwal}\n` +
        (p.catatan ? `- Catatan tambahan pengguna: ${p.catatan}\n` : '') +
        `\nMulai dari hari pertama di wilayah awal "${p.wilayahAwal}". Berikan tips budaya & etika untuk SETIAP lokasi.`;

      const hasilAI = await jalankanAI(systemInstruction, userContent, true);
      const teks = ambilTeksRespons(hasilAI);
      const { itinerary, dibuang } = bersihkanItinerary(teks, data);

      // Fallback: JSON tidak valid / semua tempat di luar katalog.
      if (!itinerary) {
        return kirimJSON(res, 200, {
          ok: false,
          error: 'INVALID_AI_OUTPUT',
          message: 'Format balasan AI tidak dapat dibaca. Silakan coba lagi dengan preferensi yang sedikit berbeda.',
          rawText: teks.slice(0, 1200) // ditampilkan sebagai teks cadangan di UI
        });
      }

      return kirimJSON(res, 200, {
        ok: true,
        itinerary,
        meta: {
          jumlahHari: itinerary.hari.length,
          jumlahTempat: itinerary.hari.reduce((s, h) => s + h.jadwal.length, 0),
          tempatDitebuang: dibuang, // Places outside the catalogue are automatically removed
          model: (process.env.AI_MODEL || DEFAULT_MODEL),
          rantaiModel: daftarModel(),
          bahasa
        }
      });
    }

    /* ---------------------------------------------------------------------
     *  AKSI 2: CHAT LANJUTAN (ingat itinerary sebelumnya)
     * ------------------------------------------------------------------- */
    if (aksi === 'chat') {
      const pesan = String(body.pesan || '').trim();
      if (!pesan) return kirimError(res, 400, 'VALIDATION', 'Pesan tidak boleh kosong.');
      if (pesan.length > MAX_CHAT_CHARS) {
        return kirimError(
          res, 400, 'VALIDATION',
          `Pesan maksimal ${MAX_CHAT_CHARS} karakter (sekarang ${pesan.length}).`
        );
      }

      const riwayat = Array.isArray(body.riwayat)
        ? body.riwayat.slice(-MAX_HISTORY_TURNS).map((m) => ({
            role: m.role === 'assistant' ? 'model' : 'user',
            text: String(m.text || '').slice(0, MAX_CHAT_CHARS)
          }))
        : [];

      const systemInstruction = bangunChatPrompt(
        data, bahasa, body.itinerary || null, riwayat
      );

      const hasilAI = await jalankanAI(systemInstruction, pesan, false);
      const teks = ambilTeksRespons(hasilAI);
      const hasil = bersihkanChat(teks, data);

      // Fallback: tampilkan teks mentah sebagai balasan chat biasa.
      if (!hasil) {
        return kirimJSON(res, 200, {
          ok: true,
          balasan: {
            reply: teks.slice(0, 1500) || 'Maaf, saya belum bisa memproses permintaan tersebut.',
            perubahan: [],
            itinerary: null
          },
          meta: { fallback: true, bahasa }
        });
      }

      return kirimJSON(res, 200, {
        ok: true,
        balasan: hasil,
        meta: { bahasa }
      });
    }

    return kirimError(res, 400, 'UNKNOWN_ACTION', 'Aksi tidak dikenali.');
  } catch (err) {
    // Log status + pesan asli dari Google (API key tidak pernah ikut dicetak).
    console.error(
      `[BaliWise] Permintaan gagal | status=${err.status || '-'} | model=${err.model || '-'} | ${err.message}`
    );

    // 1) Timeout (batas waktu lokal / abort).
    if (err.name === 'AbortError' || err.status === 504) {
      return kirimError(res, 504, 'TIMEOUT', 'AI terlalu lama merespons. Silakan coba lagi.');
    }

    // 2) 429 - kuota API AI penuh.
    if (err.status === 429) {
      return kirimError(res, 429, 'AI_QUOTA', 'Kuota AI sedang penuh, coba lagi 1 menit lagi.');
    }

    // 3) 401 / 403 - API key salah atau tidak punya akses.
    if (err.status === 401 || err.status === 403) {
      return kirimError(res, 500, 'AI_AUTH', 'API key tidak valid.');
    }

    // 4) 404 - semua model di rantai sudah tidak tersedia.
    if (err.status === 404) {
      return kirimError(res, 500, 'AI_MODEL_UNAVAILABLE', 'Model AI tidak tersedia.');
    }

    // 5) 400 - permintaan ditolak oleh layanan AI.
    if (err.status === 400) {
      return kirimError(res, 400, 'AI_REJECTED', 'Permintaan ditolak oleh layanan AI. Coba ubah preferensi Anda.');
    }

    // 6) 503 - layanan AI tidak bisa diakses.
    if (err.status === 503) {
      return kirimError(res, 503, 'AI_UNREACHABLE', 'Layanan AI sedang tidak dapat diakses. Silakan coba lagi.');
    }

    // 7) Lainnya - pesan umum, tetap ramah.
    return kirimError(res, 500, 'SERVER_ERROR', 'Terjadi kesalahan, silakan coba lagi.');
  }
}

// Ekspor kompatibel dengan format function Vercel Node.js.
module.exports = handler;
module.exports.default = handler;

/** Mengosongkan cache model mati & cooldown (dipakai oleh pengujian). */
function resetCacheModel() {
  MODEL_MATI.clear();
  MODEL_COOLDOWN.clear();
}

/* Diekspor khusus untuk pengujian otomatis (tools/test-api.js).
 * Tidak dipakai di produksi. */
module.exports._internal = {
  parseJSONAman,
  bersihkanItinerary,
  bersihkanChat,
  validasiPreferensi,
  normalisasi,
  bangunSystemPrompt,
  bangunChatPrompt,
  muatDestinasi,
  ambilTeksRespons,
  daftarModel,
  jadwalSchema,
  resetCacheModel,
  DEFAULT_MODEL,
  DEFAULT_MODEL_FALLBACK,
  DEFAULT_MODEL_DARURAT
};
