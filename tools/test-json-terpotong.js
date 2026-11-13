/**
 * ============================================================================
 *  GRISKA GO - tools/test-json-terpotong.js
 * ----------------------------------------------------------------------------
 *  Menguji parser JSON tolerate terhadap balasan AI yang TERPOTONG
 *  (kena batas maxOutputTokens -> JSON Invalid).
 *
 *  Jalankan:  node tools/test-json-terpotong.js
 * ============================================================================
 */

'use strict';

const path = require('path');
const assert = require('assert');

const chat = require(path.join(__dirname, '..', 'api', 'chat.js'));
const { parseJSONAman, perbaikiJSONTerpotong, potongTeks } = chat._internal;

let lulus = 0;
let gagal = 0;

function uji(nama, fn) {
  try {
    fn();
    lulus += 1;
    console.log('  ✓ ' + nama);
  } catch (e) {
    gagal += 1;
    console.log('  ✗ ' + nama + ' -> ' + e.message);
  }
}

console.log('\n=== Parser JSON tolerate (balasan terpotong) ===');

uji('JSON utuh tetap parsed seperti biasa', () => {
  const o = parseJSONAman('{"hari":[{"hari":1,"tema":"Ubud"}]}');
  assert.ok(o && Array.isArray(o.hari));
  assert.strictEqual(o.hari[0].tema, 'Ubud');
});

uji('Terpotong di tengah string -> diperbaiki', () => {
  const o = perbaikiJSONTerpotong('{"hari":[{"hari":1,"tema":"Menjelajah Ubud denganuckle');
  assert.ok(o, 'harus dapat objek');
  assert.ok(Array.isArray(o.hari), 'harus ada array hari');
  assert.strictEqual(o.hari[0].hari, 1);
  assert.strictEqual(o.hari[0].tema, 'Menjelajah Ubud denganuckle');
});

uji('Hari yang terpotong tetap terpakai (narasi parsial)', () => {
  const o = perbaikiJSONTerpotong(
    '{"hari":[{"hari":1,"tema":"A"},{"hari":2,"tema":"B"},{"hari":3,"tema":"C'
  );
  assert.ok(o && Array.isArray(o.hari));
  assert.strictEqual(o.hari.length, 3, 'tiga hari harusnya ada');
  assert.strictEqual(o.hari[1].tema, 'B');
  assert.strictEqual(o.hari[2].hari, 3, 'hari terakhir parsial tetap ada');
});

uji('Terpotong di tengah array aktivitas -> id yang terbaca tetap dipakai', () => {
  const o = perbaikiJSONTerpotong(
    '{"hari":[{"hari":1,"aktivitas":[{"id":"ubud-palace","aktivitas":"Menyusuri"},{"id":"tanah-lot"'
  );
  assert.ok(o && Array.isArray(o.hari));
  assert.strictEqual(o.hari[0].aktivitas.length, 2);
  assert.strictEqual(o.hari[0].aktivitas[0].id, 'ubud-palace');
  assert.strictEqual(o.hari[0].aktivitas[1].id, 'tanah-lot');
  // Aktivitas tanpa teks -> tidak menimpa narasi dari kode.
  assert.strictEqual(o.hari[0].aktivitas[1].aktivitas, undefined);
});

uji('Koma menggantung dibuang (anggota terakhir tidak lengkap)', () => {
  const o = perbaikiJSONTerpotong('{"hari":[{"hari":1,"tema":"A"},');
  assert.ok(o && Array.isArray(o.hari));
  assert.strictEqual(o.hari.length, 1);
});

uji('Nilai angka terpotong tetap aman', () => {
  const o = perbaikiJSONTerpotong('{"totalEstimasi":123');
  assert.ok(o);
  assert.strictEqual(o.totalEstimasi, 123);
});

uji('Teks tanpa objek -> null (tidak error)', () => {
  assert.strictEqual(perbaikiJSONTerpotong('maaf, saya tidak bisa'), null);
});

uji('parseJSONAman otomatis mencoba perbaikan', () => {
  const o = parseJSONAman('```json\n{"hari":[{"hari":1,"tema":"Ubud terpotong');
  assert.ok(o && Array.isArray(o.hari), 'harus punya hari');
});

console.log('\n=== Pemotongan teks AI (narasi tetap ringkas) ===');

uji('Tema panjang dipotong di batas kata', () => {
  const panjang = 'a '.repeat(200);
  const p = potongTeks(panjang, 120);
  assert.ok(p.length <= 120, 'harus <= 120 karakter');
  assert.ok(!/,\s*$/.test(p));
});

uji('Teks pendek tidak diubah', () => {
  assert.strictEqual(potongTeks('Ubud yang tenang', 120), 'Ubud yang tenang');
});

uji('Spasi berlebih dirapikan', () => {
  assert.strictEqual(potongTeks('  Ubud   yang   tenang  ', 120), 'Ubud yang tenang');
});

uji('Teks kosong -> string kosong', () => {
  assert.strictEqual(potongTeks('', 120), '');
  assert.strictEqual(potongTeks(null, 120), '');
});

console.log('\n--------------------------------------');
console.log('  Lulus: ' + lulus + '   Gagal: ' + gagal);
console.log('--------------------------------------');
process.exit(gagal ? 1 : 0);
