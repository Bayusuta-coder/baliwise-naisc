/**
 * ============================================================================
 *  GRISKA GO - js/reveal.js
 * ----------------------------------------------------------------------------
 *  Animasi muncul (fade-up) saat elemen masuk viewport.
 *
 *  Cara pakai pada HTML:
 *    <div data-reveal>...</div>            -> muncul dengan jeda normal
 *    <div data-reveal="80">...</div>       -> jeda 80 ms
 *    <div data-reveal-group>...</div>      -> anak-anaknya muncul berurutan
 *
 *  Memakai IntersectionObserver + CSS saja (tidak ada library).
 *  Bila pengguna meminta reduced motion, elemen langsung ditampilkan.
 * ============================================================================
 */

(function () {
  'use strict';

  function kurangiGerak() {
    return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  function init() {
    const elemen = document.querySelectorAll('[data-reveal], [data-reveal-group] > *');
    if (!elemen.length) return;

    if (kurangiGerak() || !('IntersectionObserver' in window)) {
      Array.prototype.forEach.call(elemen, function (el) { el.classList.add('is-visible'); });
      return;
    }

    // Beri jeda berurutan untuk elemen dalam satu grup.
    document.querySelectorAll('[data-reveal-group]').forEach(function (grup) {
      Array.prototype.forEach.call(grup.children, function (anak, i) {
        anak.style.transitionDelay = (i * 90) + 'ms';
      });
    });

    const observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });

    Array.prototype.forEach.call(elemen, function (el) {
      el.classList.add('reveal');
      const jeda = el.getAttribute('data-reveal');
      if (jeda) el.style.transitionDelay = jeda + 'ms';
      observer.observe(el);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
