/**
 * ============================================================================
 *  BALIWISE - tools/dev-server.js
 * ----------------------------------------------------------------------------
 *  Server pengembangan LOKAL tanpa perlu Vercel CLI.
 *
 *  Fungsinya:
 *   1. Menyajikan file statis (index.html, css, js, data).
 *   2. Menerjemahkan POST /api/chat ke handler yang sama dengan api/chat.js
 *      (dipakai Vercel), sehingga logika backend identik saat tes lokal.
 *
 *  Cara menjalankan:
 *     - Pastikan file .env sudah ada (isi AI_API_KEY).
 *     - Jalankan:  node tools/dev-server.js
 *     - Buka:      http://localhost:3000
 * ============================================================================
 */

'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const PORT = process.env.PORT || 3000;

/* ---------------------------------------------------------------------------
 *  Muat environment variable dari file .env (tanpa dependency tambahan)
 * ------------------------------------------------------------------------ */
function muatEnv() {
  const fileEnv = path.join(ROOT, '.env');
  if (!fs.existsSync(fileEnv)) {
    console.warn('[Griska Go] File .env tidak ditemukan. Pastikan AI_API_KEY sudah diset.');
    return;
  }

  // SAFEGUARD: simpan cadangan .env sekali saja, supaya API key tidak pernah
  // hilang permanen kalau file .env salah di-edit.
  const cadangan = path.join(ROOT, '.env.backup');
  if (!fs.existsSync(cadangan)) {
    try {
      fs.copyFileSync(fileEnv, cadangan);
      console.log('[Griska Go] Cadangan .env dibuat (.env.backup).');
    } catch (e) {
      console.warn('[Griska Go] Gagal membuat cadangan .env.backup: ' + e.message);
    }
  }

  const isi = fs.readFileSync(fileEnv, 'utf8');
  isi.split(/\r?\n/).forEach((baris) => {
    const bersih = baris.trim();
    if (!bersih || bersih.startsWith('#')) return;
    const idx = bersih.indexOf('=');
    if (idx === -1) return;
    const kunci = bersih.slice(0, idx).trim();
    const nilai = bersih.slice(idx + 1).trim().replace(/^["']|["']$/g, '');
    if (!(kunci in process.env)) process.env[kunci] = nilai;
  });
  console.log('[Griska Go] Environment variable dari .env berhasil dimuat.');

  // Peringatan model yang sudah dihapus Google (pasti dibalas 404).
  const model = String(process.env.AI_MODEL || '').trim();
  if (['gemini-2.0-flash', 'gemini-2.0-flash-lite', 'gemini-1.5-flash'].includes(model)) {
    console.warn(
      '[Griska Go] PERINGATAN: AI_MODEL="' + model + '" sudah dihapus oleh Google (akan dibalas 404).\n' +
      '           Rantai model akan otomatis mencoba gemini-2.5-flash lalu gemini-3.6-flash.\n' +
      '           Ubah AI_MODEL menjadi "gemini-3.8-flash" di file .env.'
    );
  }
}
muatEnv();

/* ---------------------------------------------------------------------------
 *  Mode mock:_when MOCK_AI=1, server membalas dengan itinerary contoh
 *  sehingga frontend bisa diuji tanpaquo API key (berguna saat belajar).
 * ------------------------------------------------------------------------ */
/* Simulasi AI lambat untuk menguji jalur fallback (ms). */
const MOCK_DELAY_MS = Number(process.env.MOCK_AI_DELAY_MS) || 0;

const MOCK_ITINERARY = {
  ringkasan: 'Contoh itinerary 2 hari untuk uji tampilan (MODE MOCK, bukan jawaban AI sungguhan).',
  totalEstimasi: 465000,
  hari: [
    {
      hari: 1,
      tema: 'Ubud: budaya dan alam',
      totalBiaya: 275000,
      jadwal: [
        {
          jam: '08.30',
          namaTempat: 'Pura Tirta Empul',
          namaTempatEn: 'Tirta Empul Temple',
          wilayah: 'Tabanan',
          kategori: 'budaya',
          aktivitas: 'Mengikuti prosesi sembahy angci di mata air suci.',
          durasiMenit: 90,
          estimasiBiaya: 45000,
          hargaTiket: 45000,
          jamBuka: '08.00 - 18.00',
          tipsBudaya: ['Gunakan sarong yang disediakan.', 'Ikuti urutan prosesi, jangan menyela barisan.'],
          transportasi: 'Sewa motor, sekitar 20 menit dari Ubud.'
        },
        {
          jam: '11.00',
          namaTempat: 'Sawah Terasering Jatiluwih',
          namaTempatEn: 'Jatiluwih Rice Terraces',
          wilayah: 'Tabanan',
          kategori: 'alam',
          aktivitas: 'Menikmati panorama sawah berundak yang diakui UNESCO.',
          durasiMenit: 120,
          estimasiBiaya: 20000,
          hargaTiket: 20000,
          jamBuka: '07.00 - 18.00',
          tipsBudaya: ['Tidak memanjat atau melangkahi pematang sawah.', 'Jangan memetik padi.'],
          transportasi: 'Berkuda atau naik ojek ke Pura Tirta Empul, sekitar 15 menit.'
        },
        {
          jam: '17.00',
          namaTempat: 'Warung Babi Guling Ibu Oka',
          namaTempatEn: 'Ibu Oka Warung',
          wilayah: 'Ubud',
          kategori: 'kuliner',
          aktivitas: 'Makan babi guling Bali yang legendaris di pusat Ubud.',
          durasiMenit: 60,
          estimasiBiaya: 50000,
          hargaTiket: 50000,
          jamBuka: '09.00 - 21.00',
          tipsBudaya: ['Antre dengan sabar sesuai nomor.', 'Makan dengan tangan kanan.'],
          transportasi: 'Jalan kaki dari Jalan Hanoman, sekitar 10 menit.'
        }
      ]
    },
    {
      hari: 2,
      tema: 'Pantai dan senja di Kuta',
      totalBiaya: 190000,
      jadwal: [
        {
          jam: '09.00',
          namaTempat: 'Pantai Seminyak',
          namaTempatEn: 'Seminyak Beach',
          wilayah: 'Badung',
          kategori: 'pantai',
          aktivitas: 'Berjalan santai di tepi pantai dan mampir butik-butik sekitar.',
          durasiMenit: 90,
          estimasiBiaya: 0,
          hargaTiket: 0,
          jamBuka: '24 jam',
          tipsBudaya: ['Jaga kebersihan pantai.', 'Simpan barang berharga saat ramai.'],
          transportasi: 'Bebas, gunakan bus atau ride-hailing.'
        },
        {
          jam: '16.30',
          namaTempat: 'Pura Uluwatu',
          namaTempatEn: 'Uluwatu Temple',
          wilayah: 'Badung',
          kategori: 'budaya',
          aktivitas: 'Menyaksikan Tari Kechak di tebing Samudra Hindia saat senja.',
          durasiMenit: 90,
          estimasiBiaya: 50000,
          hargaTiket: 50000,
          jamBuka: '06.00 - 19.00',
          tipsBudaya: ['Wajib pakai sarong.', 'Datang 30 menit sebelum pertunjukan.'],
          transportasi: 'Sewa motor, sekitar 30 menit dari Seminyak.'
        },
        {
          jam: '19.00',
          namaTempat: 'Pantai Jimbaran dan Seafood Grill',
          namaTempatEn: 'Jimbaran Bay Beach and Seafood',
          wilayah: 'Badung',
          kategori: 'kuliner',
          aktivitas: 'Makan seafood grill sambil menikmati matahari terbenam.',
          durasiMenit: 120,
          estimasiBiaya: 140000,
          hargaTiket: 150000,
          jamBuka: '11.00 - 23.00',
          tipsBudaya: ['Tanyakan harga per porsi sebelum dimasak.', 'Buang tulang ke tempat yang disediakan.'],
          transportasi: 'Sewa motor, sekitar 25 menit dari Seminyak.'
        }
      ]
    }
  ]
};

/**
 * Menyesuaikan objek response bawaan Node.js agar mengikuti kontrak Vercel
 * (res.status(...).json(...)).
 */
function adaptasiResponseVercel(res) {
  if (typeof res.status !== 'function') {
    res.status = (kode) => { res.statusCode = kode; return res; };
  }
  if (typeof res.json !== 'function') {
    res.json = (payload) => {
      if (!res.getHeader('Content-Type')) {
        res.setHeader('Content-Type', 'application/json');
      }
      res.end(JSON.stringify(payload));
      return res;
    };
  }
  return res;
}

/* ---------------------------------------------------------------------------
 *  Handler API (sama persis dengan yang dipakai Vercel)
 * ------------------------------------------------------------------------ */
const handlerApi = require(path.join(ROOT, 'api', 'chat.js'));

/* ---------------------------------------------------------------------------
 *  Penyaji file statis
 * ------------------------------------------------------------------------ */
const TIPE_MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon'
};

function layaniStatis(req, res, pathname) {
  // Cegah path traversal (keamanan).
  const relatif = pathname === '/' ? '/index.html' : pathname;
  const filePath = path.join(ROOT, path.normalize(relatif).replace(/^([/\\])+/, ''));

  if (!filePath.startsWith(ROOT) || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end('<h1>404 - Halaman tidak ditemukan</h1><p><a href="/">Kembali ke beranda</a></p>');
    return;
  }

  const ext = path.extname(filePath).toLowerCase();
  res.writeHead(200, { 'Content-Type': TIPE_MIME[ext] || 'application/octet-stream' });
  fs.createReadStream(filePath).pipe(res);
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost:' + PORT);

  // --- Endpoint API ---
  if (url.pathname === '/api/chat') {
    if (req.method !== 'POST') {
      res.writeHead(405, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: false, error: 'METHOD_NOT_ALLOWED' }));
      return;
    }

    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
      if (body.length > 1e6) req.destroy(); // batasi 1 MB
    });
    req.on('end', async () => {
      let parsed = {};
      try { parsed = JSON.parse(body || '{}'); } catch (_) { parsed = {}; }

      // --- Mode mock: tidak memanggil Gemini sama sekali ---
      // Rencana tetap dihitung kode (lib/rencana.js), hanya narasi AI yang
      // disimulasikan. Berguna untuk demo tanpa API key.
      if (process.env.MOCK_AI === '1') {
        // Pencarian titik awal: mock lokal (tanpa memanggil Nominatim).
        if (parsed.action === 'geocode') {
          const q = String(parsed.q || parsed.query || '').toLowerCase();
          const contoh = [
            { nama: 'Mock Point ' + q, lat: -8.6478, lng: 115.1385, jenis: 'mock', alamat: 'Canggu, Bali' },
            { nama: 'Mock Second ' + q, lat: -8.6900, lng: 115.1570, jenis: 'mock', alamat: 'Seminyak, Bali' }
          ];
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: true, hasil: contoh, pesan: '' }));
          return;
        }

        if (parsed.action === 'chat') {
          const R = require(path.join(ROOT, 'lib', 'rencana.js'));
          const dataDest = require(path.join(ROOT, 'data', 'destinasi.json'));
          const dataWilayah = require(path.join(ROOT, 'data', 'wilayah.json'));
          const zonaById = {};
          dataWilayah.zona.forEach((z) => { zonaById[z.id] = z; });
          const wilayah = {
            zona: dataWilayah.zona,
            zonaById: zonaById,
            kursUSD: dataWilayah.meta.kursUSD
          };

          const rencanaIni = parsed.itinerary || null;
          const preferensi = Object.assign({
            durasi: 3, budget: 'menengah', minat: ['budaya'], gaya: 'padat',
            wilayahAwal: 'ubud', traveler: { dewasa: 2, anak: 0 },
            touristType: 'domestik', transport: 'motor', akomodasi: 'hotel'
          }, parsed.preferensi || {});

          // Revisi contoh: hari pertama dibuat lebih santai (kurang satu tempat).
          const komposisi = [];
          if (rencanaIni && rencanaIni.hari) {
            rencanaIni.hari.forEach(function (h, i) {
              const ids = h.jadwal.filter(function (j) { return j.tipe !== 'makan'; })
                .map(function (j) { return j.id; });
              komposisi.push({ hari: i + 1, destinasiIds: i === 0 ? ids.slice(0, 2) : ids });
            });
          }

          const baru = R.bangunRencanaDariId(preferensi, dataDest, wilayah, komposisi, rencanaIni);
          if (baru) {
            baru.ringkasan = rencanaIni ? rencanaIni.ringkasan : '';
            baru.tipsUmum = rencanaIni ? rencanaIni.tipsUmum : null;
            baru.hari.forEach(function (h) {
              h.jadwal.forEach(function (j) {
                if (j.tipe === 'makan') return;
                if (!parsed.tanpaNarasi) {
              j.aktivitas = j.aktivitas || ('Mengunjungi ' + j.nama + ' di ' + j.zonaNama + '.');
              j.alasan = j.alasan || 'Dipilih karena sesuai minat dan jaraknya tidak jauh.';
            }
                j.alasan = j.alasan || 'Dipilih karena sesuai minat dan jaraknya tidak jauh.';
              });
            });
          }

          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            ok: true,
            balasan: {
              reply: '(MODE MOCK) Revisi diterapkan: hari 1 dibuat lebih santai dan budget dihitung ulang.',
              perubahan: ['Hari 1 dikurangi jadi 2 kegiatan', 'Budget dihitung ulang oleh sistem'],
              itinerary: baru || rencanaIni
            },
            budget: baru ? baru.budget : null,
            meta: { mock: true }
          }));
          return;
        }

        const R = require(path.join(ROOT, 'lib', 'rencana.js'));
        const dataDest = require(path.join(ROOT, 'data', 'destinasi.json'));
        const dataWilayah = require(path.join(ROOT, 'data', 'wilayah.json'));
        const zonaById = {};
        dataWilayah.zona.forEach((z) => { zonaById[z.id] = z; });
        const wilayah = {
          zona: dataWilayah.zona,
          zonaById: zonaById,
          kursUSD: dataWilayah.meta.kursUSD
        };

        const preferensi = {
          durasi: Number(parsed.durasi) || 3,
          budget: parsed.budget || 'menengah',
          minat: Array.isArray(parsed.minat) ? parsed.minat : ['budaya'],
          gaya: parsed.gaya || 'padat',
          wilayahAwal: parsed.wilayahAwal || 'ubud',
          catatan: parsed.catatan || '',
          traveler: parsed.traveler || { dewasa: 2, anak: 0 },
          touristType: parsed.touristType || 'domestik',
          transport: parsed.transport || 'motor',
          akomodasi: parsed.akomodasi || 'hotel',
          tanggal: parsed.tanggal || '',
          budgetMaks: Number(parsed.budgetMaks) || 0,
          titikAwal: parsed.titikAwal || null,
          minatTeks: Array.isArray(parsed.minatTeks) ? parsed.minatTeks : [],
          biayaTransportHarian: Number(parsed.biayaTransportHarian) || 0,
          biayaAkomodasiMalam: Number(parsed.biayaAkomodasiMalam) || 0
        };

        // Minat bebas -> tag (mode mock pakai pencocokan kata kunci).
        if (preferensi.minatTeks.length) {
          const perTeks = {};
          const semuaTag = [];
          const cocok = (handlerApi._internal && handlerApi._internal.cocokkanKataKunci)
            ? handlerApi._internal.cocokkanKataKunci
            : function () { return []; };
          preferensi.minatTeks.forEach(function (t) {
            const tags = cocok(t);
            perTeks[t] = tags;
            tags.forEach(function (tg) { if (semuaTag.indexOf(tg) < 0) semuaTag.push(tg); });
          });
          preferensi.minatTagPerTeks = perTeks;
          preferensi.minatTag = semuaTag;
        }

        // Simulasi AI lambat (untuk menguji jalur fallback & tombol
        // "Lewati narasi AI"). Permintaan tanpa narasi tetap CEPAT,
        // persis seperti di server sungguhan.
        if (MOCK_DELAY_MS > 0 && !parsed.tanpaNarasi) {
          await new Promise(function (r) { setTimeout(r, MOCK_DELAY_MS); });
        }

        const rencana = R.bangunRencana(preferensi, dataDest, wilayah);
        rencana.ringkasan = (parsed.tanpaNarasi ? '' : '(MODE MOCK) ') + (rencana.ringkasan || '');
        rencana.tipsUmum = {
          bawa: [
            'Sarung dan sabuk untuk masuk pura',
            'Sunscreen, topi, dan air minum',
            'Pakaian sopan yang menutup bahu dan lutut',
            'Uang tunai pecahan kecil'
          ],
          waktuTerbaik: 'Pura dan sawah paling bagus sebelum jam 10.00, pantai dan sunset paling enak pada sore hari.',
          etika: [
            'Jangan melintas prosesi yang sedang berlangsung.',
            'Selalu pakai sarung saat memasuki pura.',
            'Minta izin sebelum memotret orang lokal.'
          ]
        };
        rencana.hari.forEach((h) => {
          if (!h.tema && !parsed.tanpaNarasi) {
            const zona = h.zonaNama || h.zonaUtama || 'Bali';
            h.tema = (parsed.bahasa === 'en' ? 'Around ' : 'Sekitar ') + zona;
          }
          h.jadwal.forEach((j) => {
            if (j.tipe === 'makan') {
              j.catatanMakan = j.catatanMakan || 'Rekomendasi_mock';
              return;
            }
            j.aktivitas = j.aktivitas || ('Mengunjungi ' + j.nama + ' di ' + j.zonaNama + '.');
            j.alasan = j.alasan || 'Dipilih karena sesuai minat dan jaraknya tidak jauh.';
          });
        });

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          ok: true,
          itinerary: rencana,
          budget: rencana.budget,
          meta: {
            jumlahHari: rencana.hari.length,
            jumlahTempat: rencana.hari.reduce((s2, h) => s2 + h.jadwal.filter((j) => j.tipe !== 'makan').length, 0),
            narasiAI: !parsed.tanpaNarasi,
            mock: true,
            bahasa: parsed.bahasa || 'id',
            kursUSD: wilayah.kursUSD,
            catatan: Array.isArray(rencana.catatan) ? rencana.catatan : [],
            titikAwal: rencana.titikAwal || null,
            minatTag: Array.isArray(preferensi.minatTag) ? preferensi.minatTag : [],
            minatTeks: Array.isArray(preferensi.minatTeks) ? preferensi.minatTeks : []
          }
        }));
        return;
      }

      // Bungkus req/res agar sesuai kontrak handler Vercel.
      req.body = parsed;
      adaptasiResponseVercel(res);
      handlerApi(req, res).catch((err) => {
        console.error('[Griska Go] Error handler:', err);
        if (!res.headersSent) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: false, error: 'SERVER_ERROR', message: String(err.message) }));
        }
      });
    });
    return;
  }

  layaniStatis(req, res, url.pathname);
});

server.listen(PORT, () => {
  console.log('');
  console.log('  BaliWise - server pengembangan lokal');
  console.log('  ------------------------------------');
  console.log('  Buka:  http://localhost:' + PORT);
  console.log('  API :  http://localhost:' + PORT + '/api/chat');
  console.log('  Stop: Ctrl + C');
  console.log('');
});
