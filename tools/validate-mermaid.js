/**
 * ============================================================================
 *  BALIWISE - tools/validate-mermaid.js
 * ----------------------------------------------------------------------------
 *  Validator sintaks diagram Mermaid pada file markdown.
 *
 *  Ini adalah ALAT OPSIONAL (bukan bagian dari aplikasi). Aplikasi tetap
 *  berjalan tanpa dependency apa pun.
 *
 *  Cara pakai:
 *      npm install mermaid jsdom dompurify --no-save
 *      node tools/validate-mermaid.js docs/01-DOKUMEN-ARSITEKTUR.md
 *
 *  Diagram juga bisa dirender secara online di https://mermaid.live
 * ============================================================================
 */
const fs = require('fs');
const path = require('path');

(async () => {
  // Sediakan DOM minimal agar DOMPurify (dipakai Mermaid) bisa berjalan di Node.
  const { JSDOM } = await import('jsdom');
  const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>');
  global.window = dom.window;
  global.document = dom.window.document;
  global.navigator = dom.window.navigator;
  global.Element = dom.window.Element;
  global.SVGElement = dom.window.SVGElement;
  global.Node = dom.window.Node;

  const mermaid = (await import('mermaid')).default;
  mermaid.initialize({ startOnLoad: false, securityLevel: 'loose' });

  const files = process.argv.slice(2);
  let total = 0;
  let gagal = 0;

  for (const f of files) {
    const teks = fs.readFileSync(path.resolve(f), 'utf8');
    const blok = [...teks.matchAll(/```mermaid\s*\n([\s\S]*?)```/g)].map((m) => m[1]);
    console.log(`\n=== ${f} : ${blok.length} diagram ===`);

    for (let i = 0; i < blok.length; i++) {
      total++;
      try {
        await mermaid.parse(blok[i]);
        console.log(`  [OK]   diagram #${i + 1}`);
      } catch (err) {
        gagal++;
        console.log(`  [FAIL] diagram #${i + 1}: ${String(err.message).split('\n').slice(0, 6).join(' | ')}`);
      }
    }
  }

  console.log(`\nTotal diagram: ${total}, gagal: ${gagal}`);
  process.exit(gagal === 0 ? 0 : 1);
})();
