/**
 * ============================================================================
 *  GRISKA GO - tools/ukur-waktu.js
 * ----------------------------------------------------------------------------
 *  Mengukur waktu respons END-TO-END dari browser ke server lokal
 *  untuk skenario 1 hari, 3 hari, dan 7 hari.
 *
 *  Jalankan:
 *    node tools/ukur-waktu.js                 # server yang sedang berjalan
 *    node tools/ukur-waktu.js http://host:3000
 *
 *  Output: tabel waktu respons + ringkasan NarasiAI.
 * ============================================================================
 */

'use strict';

const http = require('http');
const https = require('https');
const { URL } = require('url');

const BASE = process.argv[2] || 'http://localhost:3000';

function post(body) {
  return new Promise(function (resolve, reject) {
    const url = new URL('/api/chat', BASE);
    const lib = url.protocol === 'https:' ? https : http;
    const data = JSON.stringify(body);
    const req = lib.request({
      hostname: url.hostname,
      port: url.port || (url.protocol === 'https:' ? 443 : 80),
      path: url.pathname,
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) }
    }, function (res) {
      let teks = '';
      res.on('data', function (c) { teks += c; });
      res.on('end', function () {
        try { resolve({ status: res.statusCode, json: JSON.parse(teks) }); }
        catch (e) { reject(new Error('Respons bukan JSON: ' + teks.slice(0, 120))); }
      });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

/* Titik awal custom: pin di Canggu (bukan dari daftar wilayah). */
const TITIK_CANGGU = { nama: 'Canggu, Bali', lat: -8.6478, lng: 115.1385 };

function body(durasi, tanpaNarasi, ekstra) {
  return Object.assign({
    action: 'generate',
    bahasa: 'id',
    durasi: durasi,
    budget: 'menengah',
    minat: ['budaya', 'alam'],
    gaya: durasi >= 5 ? 'padat' : 'santai',
    wilayahAwal: 'ubud',
    traveler: { dewasa: 2, anak: 1 },
    touristType: 'domestik',
    transport: 'mobil',
    akomodasi: 'hotel',
    tanpaNarasi: !!tanpaNarasi
  }, ekstra || {});
}

(async function () {
  console.log('Server: ' + BASE + '\n');
  console.log('| skenario | durasi | status | hari | tempat | narasiAI | budget total |');
  console.log('|---|---|---|---|---|---|---|');

  const rows = [];
  for (const hari of [1, 3, 7]) {
    const mulai = Date.now();
    const r = await post(body(hari));
    const ms = Date.now() - mulai;
    const j = r.json || {};
    const it = j.itinerary || {};
    const jumlahTempat = (it.hari || []).reduce(function (s, h) {
      return s + h.jadwal.filter(function (x) { return x.tipe !== 'makan'; }).length;
    }, 0);
    const total = j.budget ? j.budget.total : 0;
    rows.push({ hari: hari, ms: ms });
    console.log('| ' + hari + ' hari | ' + ms + ' ms | ' + r.status + ' | ' +
      (it.hari ? it.hari.length : 0) + ' | ' + jumlahTempat + ' | ' +
      (j.meta ? j.meta.narasiAI : '-') + ' | Rp ' + total.toLocaleString('id-ID') + ' |');
  }

  // Varian tanpa narasi (tombol "Lewati narasi AI").
  const mulaiTanpa = Date.now();
  const rt = await post(body(3, true));
  const msTanpa = Date.now() - mulaiTanpa;
  rows.push({ hari: '3 (tanpa narasi)', ms: msTanpa });
  console.log('| 3 hari (tanpa narasi) | ' + msTanpa + ' ms | ' + rt.status + ' | ' +
    (rt.json.itinerary ? rt.json.itinerary.hari.length : 0) + ' | - | false | Rp ' +
    (rt.json.budget ? rt.json.budget.total.toLocaleString('id-ID') : 0) + ' |');

  // Skenario fitur baru: titik awal custom + minat bebas.
  const mulaiBaru = Date.now();
  const rb = await post(body(3, false, {
    titikAwal: TITIK_CANGGU,
    minatTeks: ['surfing']
  }));
  const msBaru = Date.now() - mulaiBaru;
  rows.push({ hari: '3 (titik awal Canggu + minat surfing)', ms: msBaru });
  console.log('| 3 hari (titik awal custom + minat bebas) |' + msBaru +
    ' ms | ' + rb.status + ' | ' +
    (rb.json.itinerary ? rb.json.itinerary.hari.length : 0) + ' | - | ' +
    (rb.json.meta ? rb.json.meta.narasiAI : '-') + ' | Rp ' +
    (rb.json.budget ? rb.json.budget.total.toLocaleString('id-ID') : 0) + ' |');

  console.log('\nRingkasan:');
  rows.forEach(function (r) { console.log('  ' + r.hari + ': ' + r.ms + ' ms'); });
  console.log('\nCatatan: waktu di atas adalah waktu END-TO-END (termasuk HTTP).');
  console.log('Server selalu mengembalikan rencana lengkap: kalau AI timeout/gagal,');
  console.log('rencana dari kode (lib/rencana.js) yang dikirim dengan narasiAI=false.');
  console.log('Batas keras: anggaran AI 45 detik, maxDuration Vercel 60 detik.');
})().catch(function (e) {
  console.error('GAGAL: ' + e.message);
  process.exit(1);
});
