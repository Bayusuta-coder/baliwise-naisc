/**
 * ============================================================================
 *  GRISKA GO - js/titikawal.js
 * ----------------------------------------------------------------------------
 *  Komponen "Titik awal" dengan tiga cara memilih:
 *    (a) pilih dari daftar wilayah Bali,
 *    (b) ketik nama hotel/tempat (pencarian otomatis via /api -> Nominatim),
 *    (c) klik pin di peta Leaflet.
 *  Plus tombol "Pakai lokasi saya" (geolocation, minta izin dengan sopan).
 *
 *  Semua hasil disimpan sebagai { nama, lat, lng } dan dipakai server untuk
 *  menghitung jarak, klaster hari, dan harga akomodasi.
 *
 *  Aturan:
 *    - Pencarian dibatasi area Bali. Di luar Bali -> pesan ramah + fallback.
 *    - Debounce 600 ms + maksimal 1 request per detik (dijaga server juga).
 *    - Semua error (offline, service down, izin ditolak) ditangani ramah:
 *      TIDAK PERNAH membuat halaman error.
 * ============================================================================
 */

(function (global) {
  'use strict';

  const $ = function (sel, akar) { return (akar || document).querySelector(sel); };
  const $$ = function (sel, akar) {
    return Array.prototype.slice.call((akar || document).querySelectorAll(sel));
  };

  /* Batas area Bali (harus sama dengan lib/rencana.js). */
  const BALI = { latMin: -8.90, latMax: -8.00, lngMin: 114.35, lngMax: 115.80 };

  const DEBOUNCE_MS = 600;
  const MAKS_HASIL = 6;

  /* State komponen. */
  const state = {
    titik: null,          // { nama, lat, lng } atau null (pakai dropdown)
    timerCari: null,
    reqTerakhir: 0,
    reqBerjalan: false,
    antrian: null,
    peta: null,
    marker: null,
    layer: null,
    onUbah: null          // callback saat titik berubah
  };

  /* ---------------------------------------------------------------------
   * Utilitas
   * ------------------------------------------------------------------ */
  function t(kunci, vars) {
    const I = global.BaliWiseI18n;
    return I ? I.get(kunci, vars) : kunci;
  }

  function el(tag, kelas, teks) {
    const node = document.createElement(tag);
    if (kelas) node.className = kelas;
    if (teks !== undefined && teks !== null) node.textContent = teks;
    return node;
  }

  function diBali(lat, lng) {
    return lat >= BALI.latMin && lat <= BALI.latMax &&
      lng >= BALI.lngMin && lng <= BALI.lngMax;
  }

  function formatKoordinat(lat, lng) {
    return lat.toFixed(5) + ', ' + lng.toFixed(5);
  }

  /* ---------------------------------------------------------------------
   * Tampilan titik terpilih
   * ------------------------------------------------------------------ */
  function gambarRingkasan() {
    const kotak = $('#startpoint');
    const namaEl = $('#startpoint-name');
    const metaEl = $('#startpoint-meta');
    if (!kotak || !namaEl || !metaEl) return;

    if (!state.titik) {
      kotak.hidden = true;
      return;
    }
    kotak.hidden = false;
    namaEl.textContent = state.titik.nama;
    metaEl.textContent = t('plan.titikAwalKoordinat', { koordinat: formatKoordinat(state.titik.lat, state.titik.lng) });
  }

  /** Memberi tahu pemanggil bahwa titik awal berubah. */
  function beriTahu() {
    gambarRingkasan();
    if (typeof state.onUbah === 'function') state.onUbah(state.titik);
  }

  /** Menetapkan titik awal (dari peta, pencarian, atau GPS). */
  function setTitik(titik, sumber) {
    if (!titik) {
      state.titik = null;
      if (state.marker && state.peta) {
        state.layer.removeLayer(state.marker);
        state.marker = null;
      }
      beriTahu();
      return;
    }

    const lat = Number(titik.lat);
    const lng = Number(titik.lng);
    if (!isFinite(lat) || !isFinite(lng)) return;

    if (!diBali(lat, lng)) {
      pesan(t('plan.titikAwalDiLuarBali'), 'error');
      // Fallback: kembali ke pilihan dropdown wilayah.
      state.titik = null;
      if (state.marker && state.peta) {
        state.layer.removeLayer(state.marker);
        state.marker = null;
      }
      beriTahu();
      return;
    }

    state.titik = {
      nama: String(titik.nama || t('plan.titikAwalTanpaNama')).slice(0, 100),
      lat: lat,
      lng: lng
    };
    pesan(t('plan.titikAwalDipilih', { nama: state.titik.nama }), 'ok');
    placeMarker(lat, lng);
    beriTahu();
  }

  /* ---------------------------------------------------------------------
   * Pesan status (ramah, tidak pernah error)
   * ------------------------------------------------------------------ */
  function pesan(teks, jenis) {
    const elStatus = $('#start-search-status');
    if (!elStatus) return;
    elStatus.textContent = teks || '';
    elStatus.classList.remove('is-ok', 'is-error');
    if (jenis) elStatus.classList.add(jenis === 'ok' ? 'is-ok' : 'is-error');
  }

  /* ---------------------------------------------------------------------
   * (b) Pencarian nama tempat
   * ------------------------------------------------------------------ */
  function bersihkanKueri(teks) {
    return String(teks || '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80);
  }

  function cari(kueri) {
    const q = bersihkanKueri(kueri);
    const daftar = $('#start-results');
    if (!daftar) return;

    if (q.length < 3) {
      daftar.textContent = '';
      pesan('');
      return;
    }

    pesan(t('plan.titikAwalMencari'));

    // Minimal 1 detik antar request ( courteous & sesuai aturan layanan peta).
    const sekarang = Date.now();
    const tunggu = 1000 - (sekarang - state.reqTerakhir);
    const jalankan = function () {
      state.reqTerakhir = Date.now();
      state.reqBerjalan = true;

      global.BaliWiseApi.cariTempat(q).then(function (hasil) {
        state.reqBerjalan = false;
        if (!hasil || !hasil.ok) {
          daftar.textContent = '';
          pesan(t('plan.titikAwalGagalCari'), 'error');
          return;
        }
        if (hasil.pesan) {
          pesan(hasil.pesan, 'error');
        } else if (!hasil.hasil || !hasil.hasil.length) {
          pesan(t('plan.titikAwalTidakDitemukan'));
        } else {
          pesan(t('plan.titikAwalHasil', { jumlah: hasil.hasil.length }), 'ok');
        }
        tampilkanHasil(hasil.hasil || []);
      }).catch(function () {
        state.reqBerjalan = false;
        daftar.textContent = '';
        pesan(t('plan.titikAwalGagalCari'), 'error');
      });
    };

    if (tunggu > 0) {
      state.antrian = setTimeout(jalankan, tunggu);
    } else {
      jalankan();
    }
  }

  function tampilkanHasil(hasil) {
    const daftar = $('#start-results');
    if (!daftar) return;
    daftar.textContent = '';

    hasil.slice(0, MAKS_HASIL).forEach(function (item) {
      const li = el('li', 'results__item');
      li.setAttribute('role', 'option');
      li.setAttribute('tabindex', '0');

      const tombol = el('button', 'results__btn');
      tombol.type = 'button';
      tombol.appendChild(el('strong', 'results__name', item.nama));
      if (item.alamat) tombol.appendChild(el('span', 'results__addr', item.alamat));
      tombol.appendChild(el('span', 'results__coord', formatKoordinat(item.lat, item.lng)));
      li.appendChild(tombol);

      const pilih = function () {
        setTitik({ nama: item.nama, lat: item.lat, lng: item.lng }, 'pencarian');
        daftar.textContent = '';
        pesan(t('plan.titikAwalDipilih', { nama: item.nama }), 'ok');
      };

      li.addEventListener('click', pilih);
      li.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pilih(); }
      });

      daftar.appendChild(li);
    });
  }

  /* ---------------------------------------------------------------------
   * (c) Peta untuk memilih pin
   * ------------------------------------------------------------------ */
  function placeMarker(lat, lng) {
    if (!state.peta || !global.L) return;
    if (state.marker) {
      state.marker.setLatLng([lat, lng]);
    } else {
      state.marker = global.L.marker([lat, lng], {
        draggable: true,
        title: t('plan.titikAwalPeta')
      }).addTo(state.layer);
      state.marker.on('dragend', function () {
        const pos = state.marker.getLatLng();
        setTitik({ nama: t('plan.titikAwalPeta'), lat: pos.lat, lng: pos.lng }, 'peta');
      });
    }
    state.peta.setView([lat, lng], Math.max(state.peta.getZoom(), 11));
  }

  function siapPeta() {
    const wadah = $('#start-map');
    if (!wadah || state.peta) return;

    if (!global.GriskaPeta || !global.GriskaPeta.muatLeaflet) return;

    global.GriskaPeta.muatLeaflet().then(function (L) {
      if (state.peta) return;
      state.peta = L.map(wadah, { scrollWheelZoom: false, attributionControl: true });
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; OpenStreetMap'
      }).addTo(state.peta);
      state.layer = L.layerGroup().addTo(state.peta);

      // Batas Bali digambar agar traveler tahu area pencarian.
      L.rectangle([
        [BALI.latMin, BALI.lngMin], [BALI.latMax, BALI.lngMax]
      ], { color: '#1177B8', weight: 1, opacity: .5, fillOpacity: .05 }).addTo(state.layer);

      state.peta.setView([-8.5069, 115.2625], 10);

      state.peta.on('click', function (e) {
        setTitik({ nama: t('plan.titikAwalPeta'), lat: e.latlng.lat, lng: e.latlng.lng }, 'peta');
      });

      if (state.titik) placeMarker(state.titik.lat, state.titik.lng);
    }).catch(function () {
      // Offline / CDN diblokir -> peta tidak tampil, tapi aplikasi tetap jalan.
      const status = $('#start-map-status');
      if (status) status.textContent = t('plan.titikAwalPetaGagal');
    });
  }

  /* ---------------------------------------------------------------------
   * Geolocation
   * ------------------------------------------------------------------ */
  function pakaiLokasiSaya() {
    if (!navigator.geolocation) {
      pesan(t('plan.titikAwalGpsGagal'), 'error');
      return;
    }

    pesan(t('plan.titikAwalGpsMeminta'));

    navigator.geolocation.getCurrentPosition(function (pos) {
      const lat = pos.coords.latitude;
      const lng = pos.coords.longitude;
      if (!diBali(lat, lng)) {
        // Di luar Bali: pesan ramah + fallback ke dropdown.
        pesan(t('plan.titikAwalDiLuarBali'), 'error');
        state.titik = null;
        if (state.marker && state.layer) { state.layer.removeLayer(state.marker); state.marker = null; }
        beriTahu();
        return;
      }
      setTitik({ nama: t('plan.titikAwalLokasiSaya'), lat: lat, lng: lng }, 'gps');
    }, function (err) {
      if (err && err.code === 1) {
        pesan(t('plan.titikAwalGpsDitolak'), 'error');
      } else if (err && err.code === 3) {
        pesan(t('plan.titikAwalGpsTimeout'), 'error');
      } else {
        pesan(t('plan.titikAwalGpsGagal'), 'error');
      }
    }, { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 });
  }

  /* ---------------------------------------------------------------------
   * Tab (3 cara)
   * ------------------------------------------------------------------ */
  function aktifkanTab(id) {
    $$('[data-start-tab]').forEach(function (tombol) {
      const aktif = tombol.getAttribute('data-start-tab') === id;
      tombol.classList.toggle('is-active', aktif);
      tombol.setAttribute('aria-selected', aktif ? 'true' : 'false');
      tombol.setAttribute('tabindex', aktif ? '0' : '-1');
    });
    $$('[data-start-panel]').forEach(function (panel) {
      panel.hidden = panel.getAttribute('data-start-panel') !== id;
    });
    if (id === 'peta') {
      siapPeta();
      setTimeout(function () { if (state.peta) state.peta.invalidateSize(); }, 120);
    }
  }

  /* ---------------------------------------------------------------------
   * Inisialisasi
   * ------------------------------------------------------------------ */
  function init(pilihan, onUbah) {
    // Pilihan awal (bisa null = pakai dropdown wilayah).
    state.titik = pilihan ? {
      nama: String(pilihan.nama || '').slice(0, 100),
      lat: Number(pilihan.lat),
      lng: Number(pilihan.lng)
    } : null;

    if (typeof onUbah === 'function') state.onUbah = onUbah;

    // Tab.
    $$('[data-start-tab]').forEach(function (tombol) {
      tombol.addEventListener('click', function () {
        aktifkanTab(tombol.getAttribute('data-start-tab'));
      });
      tombol.addEventListener('keydown', function (e) {
        if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
        e.preventDefault();
        const semua = $$('[data-start-tab]');
        const i = semua.indexOf(tombol);
        const next = e.key === 'ArrowRight' ? (i + 1) % semua.length : (i - 1 + semua.length) % semua.length;
        semua[next].focus();
        aktifkanTab(semua[next].getAttribute('data-start-tab'));
      });
    });
    aktifkanTab('daerah');

    // Pencarian (debounce 600 ms).
    const input = $('#start-search');
    if (input) {
      input.addEventListener('input', function () {
        if (state.timerCari) clearTimeout(state.timerCari);
        state.timerCari = setTimeout(function () { cari(input.value); }, DEBOUNCE_MS);
      });
      input.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') {
          const daftar = $('#start-results');
          if (daftar) daftar.textContent = '';
        }
      });
    }

    // Tombol GPS.
    const btnGps = $('#start-locate');
    if (btnGps) btnGps.addEventListener('click', pakaiLokasiSaya);

    // Tombol hapus titik (kembali ke dropdown wilayah).
    const btnHapus = $('#startpoint-clear');
    if (btnHapus) btnHapus.addEventListener('click', function () {
      state.titik = null;
      if (state.marker && state.layer) { state.layer.removeLayer(state.marker); state.marker = null; }
      pesan('');
      const daftar = $('#start-results');
      if (daftar) daftar.textContent = '';
      beriTahu();
    });

    // Memilih wilayah dari dropdown = titik awal dari daftar.
    const dropdown = $('#wilayah-awal');
    if (dropdown) {
      dropdown.addEventListener('change', function () {
        state.titik = null;
        if (state.marker && state.layer) { state.layer.removeLayer(state.marker); state.marker = null; }
        beriTahu();
      });
    }

    gambarRingkasan();
  }

  global.GriskaTitikAwal = {
    init: init,
    setTitik: setTitik,
    getTitik: function () { return state.titik; },
    aktifkanTab: aktifkanTab,
    siapPeta: siapPeta
  };

})(window);
