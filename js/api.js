/**
 * ============================================================================
 *  BALIWISE - js/api.js
 * ----------------------------------------------------------------------------
 *  Lapisan komunikasi ke serverless function (api/chat.js).
 *
 *  PENTING: file ini TIDAK pernah menyentuh API key. Browser hanya
 *  berbicara dengan endpoint /api/chat milik kita sendiri. API key tetap
 *  berada di server dan tidak pernah dikirim ke klien.
 * ============================================================================
 */

(function (global) {
  'use strict';

  /* Endpoint serverless function. Vercel otomatis memetakan /api/chat
   * ke file api/chat.js, jadi tidak perlu konfigurasi tambahan. */
  const ENDPOINT = '/api/chat';
  const TIMEOUT_MS = 70000; // timeout di sisi browser (server punya timeout sendiri)

  /**
   * Pesan error yang ramah untuk pengguna (bukan dump teknis).
   * @param {string} kode - kode error dari server
   * @param {string} bahasa - 'id' | 'en'
   */
  function pesanError(kode, bahasa) {
    const en = bahasa === 'en';
    const peta = {
      NETWORK: en
        ? 'Could not reach the server. Please check your internet connection.'
        : 'Tidak dapat terhubung ke server. Periksa koneksi internet Anda.',
      TIMEOUT: en
        ? 'The AI took too long to respond. Please try again.'
        : 'AI terlalu lama merespons. Silakan coba lagi.',
      NO_API_KEY: en
        ? 'The server is not configured yet. The administrator must set the AI_API_KEY environment variable.'
        : 'Server belum dikonfigurasi. Admin perlu mengatur environment variable AI_API_KEY.',
      RATE_LIMITED: en
        ? 'Too many requests. Please wait a minute and try again.'
        : 'Terlalu banyak permintaan. Tunggu satu menit lalu coba lagi.',
      AI_QUOTA: en
        ? 'The AI quota is full. Please try again in a minute.'
        : 'Kuota AI sedang penuh, coba lagi 1 menit lagi.',
      AI_AUTH: en
        ? 'The API key is not valid.'
        : 'API key tidak valid.',
      AI_MODEL_UNAVAILABLE: en
        ? 'The AI model is not available.'
        : 'Model AI tidak tersedia.',
      AI_UNREACHABLE: en
        ? 'The AI service is unreachable right now. Please try again.'
        : 'Layanan AI sedang tidak dapat diakses. Silakan coba lagi.',
      AI_REJECTED: en
        ? 'The AI service rejected the request. Please change your preferences.'
        : 'Permintaan ditolak oleh layanan AI. Coba ubah preferensi Anda.',
    };
    return peta[kode] || (en ? 'Something went wrong. Please try again.' : 'Terjadi kesalahan. Silakan coba lagi.');
  }

  /**
   * Mengirim POST JSON ke server dan mengembalikan hasil ter-normalisasi.
   * @param {object} payload - data yang dikirim
   * @returns {Promise<{ok: boolean, data?: object, code?: string, message?: string}>}
   */
  async function post(payload) {
    // Pesan khusus bila file dibuka langsung (file://) sehingga /api/chat
    // tidak tersedia. Solusinya: jalankan server pengembangan lokal.
    if (window.location.protocol === 'file:') {
      return {
        ok: false,
        code: 'FILE_PROTOCOL',
        message: payload.bahasa === 'en'
          ? 'The page was opened directly from the file system, so the API cannot be reached. Please run "npm run dev" and open http://localhost:3000.'
          : 'Halaman dibuka langsung dari sistem file sehingga API tidak dapat diakses. Jalankan "npm run dev" lalu buka http://localhost:3000.'
      };
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

    try {
      const response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: controller.signal
      });

      // Server mungkin mengembalikan JSON atau teks biasa.
      let body = null;
      const teks = await response.text();
      try { body = JSON.parse(teks); } catch (_) { body = null; }

      if (!response.ok) {
        return {
          ok: false,
          code: (body && body.error) || 'SERVER_ERROR',
          message: (body && body.message) || pesanError('SERVER_ERROR', payload.bahasa)
        };
      }

      if (!body) {
        return { ok: false, code: 'INVALID_AI_OUTPUT', message: pesanError('INVALID_AI_OUTPUT', payload.bahasa) };
      }
      return { ok: true, data: body };
    } catch (err) {
      if (err.name === 'AbortError') {
        return { ok: false, code: 'TIMEOUT', message: pesanError('TIMEOUT', payload.bahasa) };
      }
      return { ok: false, code: 'NETWORK', message: pesanError('NETWORK', payload.bahasa) };
    } finally {
      clearTimeout(timer);
    }
  }

  /* ---------------------------------------------------------------------
   *  API publik
   * ------------------------------------------------------------------- */

  /**
   * Meminta AI membuat itinerary baru.
   * @param {object} preferensi - { durasi, budget, minat[], gaya, wilayahAwal, catatan }
   * @param {string} bahasa - 'id' | 'en'
   */
  async function buatItinerary(preferensi, bahasa) {
    const hasil = await post({
      action: 'generate',
      bahasa: bahasa || 'id',
      durasi: preferensi.durasi,
      budget: preferensi.budget,
      minat: preferensi.minat,
      gaya: preferensi.gaya,
      wilayahAwal: preferensi.wilayahAwal,
      catatan: preferensi.catatan || ''
    });

    if (!hasil.ok) {
      return { ok: false, code: hasil.code, message: hasil.message || pesanError(hasil.code, bahasa) };
    }

    // Server sudah mengembalikan { ok, itinerary, meta }.
    if (!hasil.data.ok || !hasil.data.itinerary) {
      return {
        ok: false,
        code: (hasil.data && hasil.data.error) || 'INVALID_AI_OUTPUT',
        message: (hasil.data && hasil.data.message) || pesanError('INVALID_AI_OUTPUT', bahasa),
        rawText: hasil.data && hasil.data.rawText
      };
    }

    return { ok: true, itinerary: hasil.data.itinerary, meta: hasil.data.meta };
  }

  /**
   * Mengirim pesan chat lanjutan.
   * @param {string} pesan - pesan pengguna (maks 300 karakter)
   * @param {object} itinerary - itinerary saat ini (agar AI mengingat)
   * @param {Array} riwayat - riwayat percakapan [{ role, text }]
   * @param {string} bahasa - 'id' | 'en'
   */
  async function kirimChat(pesan, itinerary, riwayat, bahasa) {
    const hasil = await post({
      action: 'chat',
      bahasa: bahasa || 'id',
      pesan: String(pesan || '').slice(0, 300),
      itinerary: itinerary || null,
      riwayat: riwayat || []
    });

    if (!hasil.ok) {
      return { ok: false, code: hasil.code, message: hasil.message || pesanError(hasil.code, bahasa) };
    }

    if (!hasil.data.balasan) {
      return { ok: false, code: 'INVALID_AI_OUTPUT', message: pesanError('INVALID_AI_OUTPUT', bahasa) };
    }

    return { ok: true, balasan: hasil.data.balasan, meta: hasil.data.meta };
  }

  // Ekspor sebagai objek global (vanilla JS, tanpa modul).
  global.BaliWiseApi = { buatItinerary, kirimChat, pesanError };

})(window);
