/**
 * ============================================================================
 *  GRISKA GO - js/peta.js
 * ----------------------------------------------------------------------------
 *  Peta rute interaktif memakai Leaflet + OpenStreetMap (gratis, tanpa API key).
 *
 *  - Leaflet dimuat dari CDN saat pertama kali dibutuhkan (hemat & cepat).
 *  - Bila CDN tidak bisa diakses (offline / dibatasi), fungsi ini tetap aman:
 *    peta menampilkan catatan, dan itinerary tetap terbaca.
 *  - Marker bernomor per hari dengan warna berbeda + garis rute.
 * ============================================================================
 */

(function (global) {
  'use strict';

  const CSS_LEAFLET = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
  const JS_LEAFLET = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';

  /* Warna per hari (maksimal 7 hari). */
  const WARNA_HARI = ['#1177B8', '#0F9D76', '#E8A33D', '#8B5CF6', '#EC4899', '#0EA5A4', '#F97316'];

  let promiseMuat = null;
  let peta = null;
  let lapisan = null;

  /** Memuat Leaflet (CSS + JS) sekali saja. */
  function muatLeaflet() {
    if (global.L) return Promise.resolve(global.L);
    if (promiseMuat) return promiseMuat;

    promiseMuat = new Promise(function (resolve, reject) {
      if (!document.querySelector('link[data-leaflet-css]')) {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = CSS_LEAFLET;
        link.setAttribute('data-leaflet-css', '');
        document.head.appendChild(link);
      }
      const script = document.createElement('script');
      script.src = JS_LEAFLET;
      script.defer = true;
      script.onload = function () { resolve(global.L); };
      script.onerror = function () { reject(new Error('Leaflet gagal dimuat')); };
      document.head.appendChild(script);
    });
    return promiseMuat;
  }

  /** Membuat ikon marker bernomor. */
  function ikonNomor(nomor, warna) {
    return global.L.divIcon({
      className: 'map-marker',
      html: '<span class="map-marker__dot" style="background:' + warna + '">' + nomor + '</span>',
      iconSize: [30, 30],
      iconAnchor: [15, 15],
      popupAnchor: [0, -14]
    });
  }

  /**
   * Menggambar peta rute.
   * @param {HTMLElement} wadah - elemen tujuan peta
   * @param {Array} hari - data hari dari rencana
   * @param {object} t - fungsi terjemahan (t(kunci))
   * @returns {Promise} selesai saat peta siap (atau gagal dengan pesan)
   */
  function gambar(wadah, hari, t) {
    if (!wadah) return Promise.resolve();

    return muatLeaflet().then(function (L) {
      if (!peta) {
        peta = L.map(wadah, { scrollWheelZoom: false, attributionControl: true });
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          maxZoom: 19,
          attribution: '&copy; OpenStreetMap'
        }).addTo(peta);
        lapisan = L.layerGroup().addTo(peta);
      }
      lapisan.clearLayers();

      const semuaTitik = [];
      hari.forEach(function (h, i) {
        const warna = WARNA_HARI[i % WARNA_HARI.length];
        const titik = [];
        let nomor = 0;

        h.jadwal.forEach(function (item) {
          if (item.tipe === 'makan' || !item.lat || !item.lng) return;
          nomor += 1;
          titik.push([item.lat, item.lng]);
          const popup = '<strong>' + item.nama + '</strong><br>' +
            (item.jamMulai ? item.jamMulai + ' - ' + item.jamSelesai + '<br>' : '') +
            (item.alamat ? item.alamat : '');
          L.marker([item.lat, item.lng], { icon: ikonNomor(nomor, warna) })
            .bindPopup(popup)
            .addTo(lapisan);
        });

        if (titik.length > 1) {
          L.polyline(titik, { color: warna, weight: 3, opacity: .8, dashArray: '6 8' }).addTo(lapisan);
        }
        semuaTitik.push.apply(semuaTitik, titik);
      });

      if (semuaTitik.length) {
        peta.fitBounds(semuaTitik, { padding: [28, 28], maxZoom: 12 });
      }
      return true;
    });
  }

  /** Menghapus peta (saat section disembunyikan). */
  function bersihkan() {
    if (peta) { peta.remove(); peta = null; lapisan = null; }
  }

  /** Memaksa peta menggambar ulang (setelah panel ditampilkan kembali). */
  function perbaruiUkuran() {
    if (peta) {
      window.setTimeout(function () { peta.invalidateSize(); }, 60);
    }
  }

  global.GriskaPeta = {
    gambar: gambar,
    bersihkan: bersihkan,
    perbaruiUkuran: perbaruiUkuran,
    // Dim dipakai komponen "Titik awal" (memakai instance peta sendiri).
    muatLeaflet: muatLeaflet,
    WARNA_HARI: WARNA_HARI
  };

})(window);
