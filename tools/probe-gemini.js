/**
 * Menguji endpoint Gemini secara langsung (tanpa memakai kode proyek)
 * untuk membandingkan generateContent vs Interactions API.
 * Jalankan: node tools/probe-gemini.js
 */
const fs = require('fs');
const path = require('path');

// Ambil API key dari .env (tidak pernah dicetak)
const isi = fs.readFileSync(path.join(__dirname, '..', '.env'), 'utf8');
const key = (isi.match(/^\s*AI_API_KEY\s*=\s*(.+)$/m) || [])[1].trim();
if (!key) { console.error('AI_API_KEY tidak ditemukan di .env'); process.exit(1); }

const MODEL = process.argv[2] || 'gemini-3.8-flash';
const BODY = {
  contents: [{ role: 'user', parts: [{ text: 'Balas dengan JSON: {"halo":"dunia","model":"' + MODEL + '"}' }] }],
  generationConfig: { responseMimeType: 'application/json', maxOutputTokens: 2048 }
};

async function probe(label, url, body, headers) {
  const started = Date.now();
  try {
    const r = await fetch(url, {
      method: 'POST',
      headers: Object.assign({ 'Content-Type': 'application/json', 'x-goog-api-key': key }, headers || {}),
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(25000)
    });
    const t = await r.text();
    console.log(`\n[${label}] status=${r.status} (${Date.now() - started}ms)`);
    if (!r.ok) {
      console.log('  body:', t.slice(0, 300));
      return null;
    }
    const j = JSON.parse(t);
    // Ringkas struktur respons supaya mudah dibaca
    console.log('  kunci respons:', Object.keys(j).join(', '));
    if (j.candidates) {
      console.log('  teks:', (j.candidates[0].content.parts || []).map(p => p.text).join('').slice(0, 160));
    } else {
      console.log('  preview:', JSON.stringify(j).slice(0, 400));
    }
    return j;
  } catch (e) {
    console.log(`\n[${label}] ERROR: ${e.name} ${e.message}`);
    return null;
  }
}

(async () => {
  console.log('=== Uji model:', MODEL, '===');
  await probe('generateContent',
    `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`,
    BODY);

  await probe('interactions',
    'https://generativelanguage.googleapis.com/v1beta/interactions',
    {
      model: MODEL,
      input: 'Balas dengan JSON: {"halo":"dunia","model":"' + MODEL + '"}',
      response_format: { type: 'text', mime_type: 'application/json' }
    },
    { 'Api-Revision': '2026-05-20' });
})();
