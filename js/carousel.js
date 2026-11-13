/**
 * ============================================================================
 *  GRISKA GO - js/carousel.js
 * ----------------------------------------------------------------------------
 *  Komponen HeroCarousel (vanilla JS, tanpa library slider).
 *
 *  Fitur:
 *   1. Auto-play tiap 5 detik dengan transisi fade + Ken Burns (zoom pelan).
 *   2. Pause saat di-hover / di-fokus / disentuh, lanjut lagi setelah dilepas.
 *   3. Dots sederhana (titik 8px, yang aktif melebar 24px).
 *   4. Tombol panah prev / next + dukungan swipe (geser) di layar sentuh.
 *   5. Pill "Tips etika per lokasi" ikut berganti mengikuti slide aktif.
 *   6. Hormati prefers-reduced-motion: animasi dimatikan & auto-play dinonaktifkan.
 *   7. Aksesibel: aria-label pada tombol, region dengan role, live region
 *      untuk perubahan slide.
 *
 *  Struktur HTML yang diharapkan (lihat index.html):
 *    <div class="carousel" data-carousel>
 *      <div class="carousel__viewport">
 *        <article class="carousel__slide" data-carousel-slide
 *                 data-title-key="hero.s1.title" data-tip-key="hero.s1.tip"> ... </article>
 *        ...
 *      </div>
 *      <button data-carousel-prev> ... </button>
 *      <button data-carousel-next> ... </button>
 *      <div data-carousel-dots></div>
 *      <span data-carousel-tip></span>  <-- pill tips etika per lokasi
 *    </div>
 * ============================================================================
 */

(function () {
  'use strict';

  const DURASI_SLIDE = 5000;   // ms
  const AMBANG_GESER = 45;     // px minimum untuk dianggap swipe

  /** Memeriksa apakah pengguna meminta animasi minimal. */
  function kurangiGerak() {
    return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  function initCarousel(root) {
    const slides = Array.prototype.slice.call(root.querySelectorAll('[data-carousel-slide]'));
    if (slides.length < 2) return;

    const i18n = window.BaliWiseI18n;
    const tombolPrev = root.querySelector('[data-carousel-prev]');
    const tombolNext = root.querySelector('[data-carousel-next]');
    const wadahDots = root.querySelector('[data-carousel-dots]');
    const badgeTip = root.querySelector('[data-carousel-tip]');
    const liveRegion = root.querySelector('[data-carousel-live]');

    let index = 0;
    let timer = null;
    let jeda = false;      // true saat hover / fokus
    let terlihat = true;   // true saat carousel berada di viewport
    let timerBerjalan = false;

    /* ---------------- Posisi gambar per slide ----------------
     * Sumber kebenaran ada di atribut data-posisi pada tiap <article>:
     *   data-posisi="center 65%"
     * Nilai inilah yang mengatur object-position, sehingga framing
     * tiap foto (posisi subjek utama) mudah disesuaikan tanpa menyentuh CSS.
     * ------------------------------------------------------------------ */
    slides.forEach(function (slide) {
      const img = slide.querySelector('img');
      const posisi = slide.getAttribute('data-posisi');
      if (img && posisi) img.style.objectPosition = posisi;
    });

    /* ---------------- Slide & dot ---------------- */
    const dots = slides.map(function (slide, i) {
      const dot = document.createElement('button');
      dot.type = 'button';
      dot.className = 'carousel__dot';
      dot.setAttribute('aria-controls', slide.id || ('carousel-slide-' + i));
      dot.addEventListener('click', function () { keSlide(i, true); });
      if (wadahDots) wadahDots.appendChild(dot);
      return dot;
    });

    /** Menandai dot yang aktif (tanpa progress bar). */
    function tandaiDot() {
      dots.forEach(function (dot, i) {
        const aktif = i === index;
        dot.classList.toggle('is-active', aktif);
        dot.setAttribute('aria-pressed', aktif ? 'true' : 'false');
      });
    }

    /** Mengganti slide aktif. */
    function keSlide(baru, manual) {
      const total = slides.length;
      index = ((baru % total) + total) % total;

      slides.forEach(function (slide, i) {
        const aktif = i === index;
        slide.classList.toggle('is-active', aktif);
        slide.setAttribute('aria-hidden', aktif ? 'false' : 'true');
        if (aktif) {
          // Reset animasi Ken Burns untuk slide baru.
          const img = slide.querySelector('img');
          if (img) {
            img.style.animation = 'none';
            void img.offsetWidth;
            img.style.animation = '';
          }
        }
      });

      // Pill tips etika mengikuti slide aktif.
      if (badgeTip) {
        const kunci = slides[index].getAttribute('data-tip-key');
        badgeTip.textContent = kunci && i18n ? i18n.get(kunci) : '';
        // Animasi halus saat teks pill berubah.
        const kartu = badgeTip.closest('.carousel__tip') || badgeTip;
        kartu.classList.remove('is-in');
        void kartu.offsetWidth;
        kartu.classList.add('is-in');
      }


      // Muat lebih awal gambar slide berikutnya supaya transisi tidak kosong.
      const berikutnya = slides[(index + 1) % total];
      const imgBerikutnya = berikutnya && berikutnya.querySelector('img');
      if (imgBerikutnya && imgBerikutnya.loading === 'lazy') imgBerikutnya.loading = 'eager';

      tandaiDot();

      // Live region untuk pembaca layar.
      if (liveRegion) {
        const kunciJudul = slides[index].getAttribute('data-title-key');
        const judul = kunciJudul && i18n ? i18n.get(kunciJudul) : '';
        liveRegion.textContent = (i18n ? i18n.get('hero.slideOf', { n: index + 1, total: total }) : '') +
          (judul ? ' — ' + judul : '');
      }

      if (manual) mulaiTimer();
    }

    /* ---------------- Auto-play ---------------- */
    function stopTimer() {
      if (timer) { clearTimeout(timer); timer = null; }
      timerBerjalan = false;
      root.classList.remove('is-playing');
    }

    function mulaiTimer() {
      stopTimer();
      if (kurangiGerak() || jeda || !terlihat) return;
      timerBerjalan = true;
      root.classList.add('is-playing');
      timer = setTimeout(function () {
        keSlide(index + 1, false);
        mulaiTimer();
      }, DURASI_SLIDE);
    }

    function jedaSlider(aktif) {
      jeda = aktif;
      if (aktif) stopTimer();
      else mulaiTimer();
      root.classList.toggle('is-paused', aktif);
    }

    /* ---------------- Kontrol ---------------- */
    if (tombolPrev) {
      tombolPrev.addEventListener('click', function () { keSlide(index - 1, true); });
    }
    if (tombolNext) {
      tombolNext.addEventListener('click', function () { keSlide(index + 1, true); });
    }

    // Panah keyboard saat fokus berada di area carousel.
    root.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowLeft') { e.preventDefault(); keSlide(index - 1, true); }
      else if (e.key === 'ArrowRight') { e.preventDefault(); keSlide(index + 1, true); }
    });

    // Pause saat hover / fokus, lanjut setelah dilepas.
    root.addEventListener('mouseenter', function () { jedaSlider(true); });
    root.addEventListener('mouseleave', function () { jedaSlider(false); });
    root.addEventListener('focusin', function () { jedaSlider(true); });
    root.addEventListener('focusout', function (e) {
      if (!root.contains(e.relatedTarget)) jedaSlider(false);
    });

    // Swipe (geser) untuk layar sentuh.
    let sentuhX = 0, sentuhY = 0, adaSentuhan = false;
    root.addEventListener('touchstart', function (e) {
      adaSentuhan = true;
      sentuhX = e.touches[0].clientX;
      sentuhY = e.touches[0].clientY;
      jedaSlider(true);
    }, { passive: true });

    root.addEventListener('touchend', function (e) {
      if (!adaSentuhan) return;
      adaSentuhan = false;
      const dx = e.changedTouches[0].clientX - sentuhX;
      const dy = e.changedTouches[0].clientY - sentuhY;
      if (Math.abs(dx) > AMBANG_GESER && Math.abs(dx) > Math.abs(dy)) {
        keSlide(index + (dx < 0 ? 1 : -1), true);
      }
      jedaSlider(false);
    }, { passive: true });

    // Jangan lanjut saat tab disembunyikan.
    document.addEventListener('visibilitychange', function () {
      if (document.hidden) stopTimer();
      else mulaiTimer();
    });

    // Hemat sumber daya: hanya jalan saat carousel terlihat.
    if ('IntersectionObserver' in window) {
      const obs = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          terlihat = entry.isIntersecting;
          if (terlihat) mulaiTimer(); else stopTimer();
        });
      }, { threshold: 0.25 });
      obs.observe(root);
    }

    // Label tombol mengikuti bahasa aktif.
    function perbaruiLabel() {
      if (tombolPrev) tombolPrev.setAttribute('aria-label', i18n ? i18n.get('hero.prev') : 'Previous slide');
      if (tombolNext) tombolNext.setAttribute('aria-label', i18n ? i18n.get('hero.next') : 'Next slide');
      if (wadahDots) wadahDots.setAttribute('aria-label', i18n ? i18n.get('hero.dots') : 'Choose slide');
      slides.forEach(function (slide, i) {
        slide.setAttribute('aria-label', i18n
          ? i18n.get('hero.slideOf', { n: i + 1, total: slides.length })
          : (i + 1) + ' / ' + slides.length);
      });
      dots.forEach(function (dot, i) {
        const kunci = slides[i].getAttribute('data-title-key');
        const judul = kunci && i18n ? i18n.get(kunci) : '';
        dot.setAttribute('aria-label', judul
          ? (i18n ? i18n.get('hero.slideOf', { n: i + 1, total: slides.length }) : '') + ' — ' + judul
          : (i18n ? i18n.get('hero.slideOf', { n: i + 1, total: slides.length }) : ''));
      });
    }

    // Respon perubahan bahasa.
    document.addEventListener('griskago:bahasa', function () {
      perbaruiLabel();
      keSlide(index, false);
    });

    /* ---------------- Mulai ---------------- */
    perbaruiLabel();
    keSlide(0, false);
    if (!kurangiGerak()) mulaiTimer();
    root.classList.add('is-ready');
  }

  function init() {
    const roots = document.querySelectorAll('[data-carousel]');
    Array.prototype.forEach.call(roots, initCarousel);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
