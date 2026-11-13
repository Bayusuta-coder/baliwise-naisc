/**
 * Pemeriksa kebersihan teks: mencari karakter non-ASCII yang mencurigakan
 * (biasanya artefak generasi), kecuali simbol tipografi, emoji, dan karakter
 * gambar ASCII untuk diagram yang memang dipakai.
 *
 * Jalankan: node tools/scan.js [file ...]
 */
const fs = require('fs');
const path = require('path');

/**
 * Mengembalikan true bila satu kode karakter diizinkan.
 * @param {number} cp - kode poin Unicode
 */
function diizinkan(cp) {
  // Rentang ASCII dasar (a-z, angka, tanda baca) selalu boleh.
  if (cp < 128) return true;

  // Tipografi & tanda umum.
  if ('–—·•“”‘’…×✓©°→←↑↓≥≤±éèêàâäöüÄÖÜ¡¿§…'.includes(String.fromCodePoint(cp))) return true;
  if (cp >= 0x2190 && cp <= 0x27bf) return true;   // panah, simbol, dingbat
  if (cp >= 0x1f300 && cp <= 0x1faff) return true;  // emoji
  if (cp >= 0x2500 && cp <= 0x257f) return true;   // gambar kotak (diagram)
  if (cp >= 0x25a0 && cp <= 0x25ff) return true;   // bentuk geometris
  if (cp === 0xfe0f) return true;                  // variation selector (emoji)
  if (cp === 0x200b || cp === 0x200c || cp === 0x200d) return true; // zero-width

  return false;
}

/** Memeriksa satu baris; mengembalikan daftar karakter yang mencurigakan. */
function karakterAsing(baris) {
  const hasil = [];
  for (const ch of baris) {
    const cp = ch.codePointAt(0);
    if (!diizinkan(cp)) hasil.push(ch + ' (U+' + cp.toString(16).toUpperCase() + ')');
  }
  return hasil;
}

const targets = process.argv.slice(2);
const files = targets.length
  ? targets
  : [
      'index.html', 'css/style.css', 'css/home.css', 'css/planner.css',
      'js/app.js', 'js/api.js', 'js/i18n.js', 'js/brand.js', 'js/nav.js',
      'js/carousel.js', 'js/countup.js', 'js/reveal.js',
      'js/hasil.js', 'js/mapa.js', 'js/chart.js', 'js/titikawal.js',
      'api/chat.js', 'lib/rencana.js',
      'data/destinasi.json', 'data/wilayah.json', 'README.md', 'vercel.json',
      'package.json', '.env.example', 'tools/dev-server.js', 'tools/test-api.js',
      'tools/test-rencana.js', 'tools/test-json-terpotong.js',
      'tools/test-waktu.js', 'tools/ukur-waktu.js',
      'tools/scan.js', 'tools/make-placeholder-logo.js'
    ];

let total = 0;
for (const f of files) {
  const full = path.join(__dirname, '..', f);
  if (!fs.existsSync(full)) { console.log('(skip ' + f + ')'); continue; }
  if (fs.statSync(full).isDirectory()) { console.log('(skip dir ' + f + ')'); continue; }
  const lines = fs.readFileSync(full, 'utf8').split(/\r?\n/);
  const bad = [];
  lines.forEach((l, i) => {
    const mencurigakan = karakterAsing(l);
    if (mencurigakan.length) bad.push(`${i + 1}: ${l.trim()}  [${mencurigakan.join(', ')}]`);
  });
  if (bad.length) {
    console.log(`\n=== ${f} (${bad.length}) ===`);
    bad.forEach((b) => console.log('  ' + b));
    total += bad.length;
  }
}
console.log(total ? `\nTotal masalah: ${total}` : '\nSemua berkas bersih.');
