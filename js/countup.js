/**
 * ============================================================================
 *  GRISKA GO - js/countup.js
 * ----------------------------------------------------------------------------
 *  Animasi angka (count-up) untuk statistik di bawah hero.
 *
 *  Cara pakai pada HTML:
 *    <strong data-count-to="28" data-count-suffix="+">28+</strong>
 *    <strong data-count-prefix="1-" data-count-from="1" data-count-to="7">1-7</strong>
 *    <strong data-count-to="100" data-count-suffix="%">100%</strong>
 *
 *  Angka mulai dihitung saat elemen terlihat di layar (IntersectionObserver)
 *  dan langsung ditampilkan final bila pengguna meminta animasi minimal.
 * ============================================================================
 */

(function () {
  'use strict';

  const DURASI = 1400;   // ms

  function kurangiGerak() {
    return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  /** Format angka dengan pemisah ribuan (id-ID). */
  function format(nilai, desimal) {
    return nilai.toLocaleString('id-ID', {
      minimumFractionDigits: desimal,
      maximumFractionDigits: desimal
    });
  }

  function jalankan(el) {
    const ke = parseFloat(el.getAttribute('data-count-to'));
    if (isNaN(ke)) return;

    const dari = parseFloat(el.getAttribute('data-count-from') || '0');
    const awalan = el.getAttribute('data-count-prefix') || '';
    const akhiran = el.getAttribute('data-count-suffix') || '';
    const desimal = parseInt(el.getAttribute('data-count-decimals') || '0', 10);

    const tulis = function (nilai) {
      el.textContent = awalan + format(nilai, desimal) + akhiran;
    };

    if (kurangiGerak()) { tulis(ke); return; }

    const mulai = performance.now();
    const langkah = function (waktu) {
      const rasio = Math.min(1, (waktu - mulai) / DURASI);
      const eased = 1 - Math.pow(1 - rasio, 3);           // easeOutCubic
      tulis(dari + (ke - dari) * eased);
      if (rasio < 1) window.requestAnimationFrame(langkah);
    };
    window.requestAnimationFrame(langkah);
  }

  function init() {
    const elemen = document.querySelectorAll('[data-count-to]');
    if (!elemen.length) return;

    if (!('IntersectionObserver' in window)) {
      Array.prototype.forEach.call(elemen, jalankan);
      return;
    }

    const observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          jalankan(entry.target);
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.4 });

    Array.prototype.forEach.call(elemen, function (el) { observer.observe(el); });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
