/**
 * ============================================================================
 *  GRISKA GO - js/brand.js
 * ----------------------------------------------------------------------------
 *  Komponen Logo (Brand).
 *
 *  ---------------------------------------------------------------------------
 *  CARA MENGGANTI LOGO (1 menit):
 *  ---------------------------------------------------------------------------
 *  1. Simpan file logo Anda ke folder:  public/logo.png
 *     (PNG, sisi 512 px, latar transparan disarankan)
 *     - Kalau file Anda berformat SVG, simpan sebagai public/logo.svg
 *       lalu ubah konstanta LOGO_SUMBER di bawah menjadi '/logo.svg'.
 *  2. Refresh browser. Logo langsung tampil, tanpa mengubah kode lain.
 *
 *  Catatan:
 *  - Kalau file logo Anda berupa "wordmark" (gambar lebar berisi tulisan),
 *    teks "Griska Go" di samping logo otomatis disembunyikan
 *    (deteksi otomatis lewat rasio lebar/tinggi gambar).
 *  - Kalau file logo gagal dimuat, komponen falls back ke mark SVG bawaan
 *    sehingga tampilan tidak pernah rusak.
 * ============================================================================
 */

(function () {
  'use strict';

  /* ======================================================================
     KONFIGURASI - ubah baris ini untuk memakai file logo Anda sendiri
     ====================================================================== */
  const LOGO_SUMBER = '/public/logo.png';
  const NAMA_BRAND = 'Griska Go';

  /* Mark SVG cadangan (dipakai kalau file logo tidak bisa dimuat). */
  const MARK_SVG = [
    '<svg viewBox="0 0 100 100" width="38" height="38" aria-hidden="true" focusable="false">',
    '<defs><linearGradient id="ggMark" x1="0" y1="0" x2="1" y2="1">',
    '<stop offset="0%" stop-color="#0A3D62"/><stop offset="55%" stop-color="#0E5486"/>',
    '<stop offset="100%" stop-color="#0F9D76"/></linearGradient></defs>',
    '<rect width="100" height="100" rx="26" fill="url(#ggMark)"/>',
    '<path d="M68 38a22 22 0 1 0 0 24" fill="none" stroke="#E8A33D" stroke-width="11" stroke-linecap="round"/>',
    '<path d="M50 52h22" stroke="#E8A33D" stroke-width="11" stroke-linecap="round"/>',
    '</svg>'
  ].join('');

  /**
   * Memasang logo pada satu elemen brand.
   * @param {HTMLElement} brand - elemen pembungkus (navbar atau footer)
   */
  function pasangLogo(brand) {
    const wadah = brand.querySelector('[data-brand-mark]');
    const teks = brand.querySelector('[data-brand-text]');
    if (!wadah) return;

    wadah.textContent = '';

    const img = document.createElement('img');
    img.className = 'brand__img';
    img.src = LOGO_SUMBER;
    img.alt = '';                 // dekoratif: nama brand sudah ada di aria-label
    img.width = 38;
    img.height = 38;
    img.decoding = 'async';

    img.addEventListener('load', function () {
      // Deteksi logo wordmark (gambar lebar) -> sembunyikan teks brand.
      const rasio = img.naturalWidth && img.naturalHeight
        ? img.naturalWidth / img.naturalHeight
        : 1;
      if (rasio >= 2.2 && teks) teks.hidden = true;
      brand.classList.add('has-logo-image');
    });

    img.addEventListener('error', function () {
      // File logo belum ada -> pakai mark SVG bawaan.
      wadah.innerHTML = MARK_SVG;
      brand.classList.add('has-logo-fallback');
    });

    wadah.appendChild(img);
  }

  function init() {
    const brands = document.querySelectorAll('[data-brand]');
    Array.prototype.forEach.call(brands, function (brand) {
      brand.setAttribute('aria-label', NAMA_BRAND + ' — ' + (brand.getAttribute('data-brand-label') || 'AI travel planner'));
      pasangLogo(brand);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
