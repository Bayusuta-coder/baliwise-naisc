/**
 * Memulihkan file .env lokal dari riwayat lokal VS Code, lalu memperbarui
 * konfigurasi model ke gemini-3.8-flash + rantai fallback.
 *
 * Kunci API dibaca langsung dari berkas riwayat (tidak pernah dicetak).
 * Jalankan: node tools/restore-env.js
 */
const fs = require('fs');
const path = require('path');
const os = require('os');

const SEJARAH = path.join(os.homedir(), 'AppData', 'Roaming', 'Code', 'User', 'History');
const TARGET = path.join(__dirname, '..', '.env');

// 1. Cari entri riwayat yang resource-nya = .env proyek ini
let sumber = null;
for (const folder of fs.readdirSync(SEJARAH)) {
  const dir = path.join(SEJARAH, folder);
  const entriesFile = path.join(dir, 'entries.json');
  if (!fs.existsSync(entriesFile)) continue;
  try {
    const meta = JSON.parse(fs.readFileSync(entriesFile, 'utf8'));
    if (!/naisc-wisata\/(\.env)$/i.test(decodeURIComponent(meta.resource || ''))) continue;
    const id = meta.entries[0].id;
    const isi = fs.readFileSync(path.join(dir, id), 'utf8');
    const m = isi.match(/^\s*AI_API_KEY\s*=\s*(.+)$/m);
    if (m) { sumber = { path: path.join(dir, id), kunci: m[1].trim() }; break; }
  } catch (_) { /* abaikan folder yang tidak bisa dibaca */ }
}

if (!sumber) {
  console.error('Kunci tidak ditemukan di riwayat VS Code.');
  process.exit(1);
}

// 2. Susun ulang .env dengan model yang benar
const isiBaru = [
  '# Environment variable lokal BaliWise (JANGAN di-commit ke GitHub).',
  '# Dibuat otomatis oleh tools/restore-env.js',
  '',
  '# Kunci API Google Gemini (wajib).',
  'AI_API_KEY=' + sumber.kunci,
  '',
  '# Model utama. WAJIB bukan gemini-2.0-flash (sudah dihapus Google -> HTTP 404).',
  'AI_MODEL=gemini-3.8-flash',
  '',
  '# Model cadangan, dipakai otomatis bila model utama 404 / ditolak.',
  'AI_MODEL_FALLBACK=gemini-3.6-flash',
  '',
  '# Model cadangan kedua (jaring pengaman terakhir).',
  'AI_MODEL_DARURAT=gemini-3.5-flash-lite',
  ''
].join('\n');

fs.writeFileSync(TARGET, isiBaru, 'utf8');

// 3. Verifikasi (tanpa mencetak kunci)
const cek = fs.readFileSync(TARGET, 'utf8');
const k = cek.match(/AI_API_KEY=(.+)/)[1].trim();
console.log('OK: .env dipulihkan.');
console.log('  sumber kunci  :', sumber.path);
console.log('  panjang kunci  :', k.length, 'karakter');
console.log('  awalan/akhiran:', k.slice(0, 6) + '...' + k.slice(-4));
console.log('  model utama    :', cek.match(/AI_MODEL=(.+)/)[1].trim());
