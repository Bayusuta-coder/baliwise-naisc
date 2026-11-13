/**
 * ============================================================================
 *  GRISKA GO - js/nav.js
 * ----------------------------------------------------------------------------
 *  Komponen Navbar:
 *   1. Efek "glass" saat halaman di-scroll (nav transparan -> solid blur).
 *   2. Menu aktif otomatis mengikuti section yang sedang terlihat.
 *   3. Drawer mobile (hamburger) dengan animasi buka/tutup.
 *
 *  Semua perilaku di sini murni tampilan, tidak menyentuh fitur planner/chat.
 * ============================================================================
 */

(function () {
  'use strict';

  /* ======================================================================
     A. STATE SCROLL: navbar jadi solid + blur ketika halaman digulir
     ====================================================================== */
  function pasangEfekScroll(nav) {
    const perbarui = function () {
      nav.classList.toggle('is-scrolled', window.scrollY > 24);
    };
    window.addEventListener('scroll', perbarui, { passive: true });
    perbarui();
  }

  /* ======================================================================
     B. MENU AKTIF: tandai link navbar sesuai section yang sedang terlihat
     ----------------------------------------------------------------------
     Section yang dianggap "aktif" adalah section yang melintasi garis
     imajiner di 35% tinggi layar. Perhitungan dilakukan langsung saat
     scroll (hanya beberapa elemen, jadi sangat murah).
     ====================================================================== */
  function pasangMenuAktif(nav) {
    const links = Array.prototype.slice.call(nav.querySelectorAll('.nav__links a[href^="#"]'));
    const bagian = links.map(function (link) {
      const id = link.getAttribute('href').slice(1);
      return { link: link, id: id, section: document.getElementById(id) };
    }).filter(function (b) { return !!b.section; });

    if (!bagian.length) return;

    const aktifkan = function (id) {
      bagian.forEach(function (b) {
        const on = b.id === id;
        b.link.classList.toggle('is-active', on);
        if (on) b.link.setAttribute('aria-current', 'true');
        else b.link.removeAttribute('aria-current');
      });
    };

    const perbarui = function () {
      const garis = window.scrollY + window.innerHeight * 0.35;
      let aktif = null;
      bagian.forEach(function (b) {
        const atas = b.section.offsetTop;
        const bawah = atas + b.section.offsetHeight;
        if (garis >= atas && garis < bawah) aktif = b.id;
      });
      // Di antara dua section: pilih section terakhir yang sudah dilalui.
      if (!aktif) {
        bagian.forEach(function (b) {
          if (b.section.offsetTop <= garis) aktif = b.id;
        });
      }
      aktifkan(aktif);
    };

    window.addEventListener('scroll', perbarui, { passive: true });
    window.addEventListener('resize', perbarui);
    perbarui();
  }

  /* ======================================================================
     C. DRAWER MOBILE (hamburger)
     ====================================================================== */
  function pasangDrawer(nav) {
    const burger = nav.querySelector('[data-nav-burger]');
    const drawer = nav.querySelector('[data-nav-drawer]');
    if (!burger || !drawer) return;

    const i18n = window.BaliWiseI18n;

    function setBuka(buka) {
      nav.classList.toggle('is-open', buka);
      burger.setAttribute('aria-expanded', buka ? 'true' : 'false');
      burger.setAttribute('aria-label', buka
        ? (i18n ? i18n.get('nav.close') : 'Tutup menu navigasi')
        : (i18n ? i18n.get('nav.open') : 'Buka menu navigasi'));
      drawer.setAttribute('aria-hidden', buka ? 'false' : 'true');
      drawer.classList.toggle('is-open', buka);
    }

    burger.addEventListener('click', function () {
      setBuka(burger.getAttribute('aria-expanded') !== 'true');
    });

    // Tutup setelah salah satu link ditekan.
    Array.prototype.forEach.call(drawer.querySelectorAll('a'), function (a) {
      a.addEventListener('click', function () { setBuka(false); });
    });

    // Tutup dengan tombol Escape.
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && burger.getAttribute('aria-expanded') === 'true') {
        setBuka(false);
        burger.focus();
      }
    });

    // Tutup otomatis saat kembali ke tampilan desktop.
    var mq = window.matchMedia('(min-width: 900px)');
    var onPerubahan = function (e) { if (e.matches) setBuka(false); };
    if (mq.addEventListener) mq.addEventListener('change', onPerubahan);
    else if (mq.addListener) mq.addListener(onPerubahan);

    // Label tombol ikut mengikuti bahasa aktif.
    document.addEventListener('griskago:bahasa', function () {
      const terbuka = burger.getAttribute('aria-expanded') === 'true';
      burger.setAttribute('aria-label', terbuka
        ? (i18n ? i18n.get('nav.close') : 'Tutup menu navigasi')
        : (i18n ? i18n.get('nav.open') : 'Buka menu navigasi'));
    });

    setBuka(false);
  }

  /* ===================================================================== */
  function init() {
    const nav = document.getElementById('nav');
    if (!nav) return;
    pasangEfekScroll(nav);
    pasangMenuAktif(nav);
    pasangDrawer(nav);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
