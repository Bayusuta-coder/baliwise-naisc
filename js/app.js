/**
 * ============================================================================
 *  GRISKA GO - js/app.js
 * ----------------------------------------------------------------------------
 *  Seluruh logika antarmuka:
 *   1. Multi bahasa (Indonesia / English) + teks AI mengikuti bahasa.
 *   2. Validasi form preferensi.
 *   3. Panggilan API + loading state + penanganan error yang ramah.
 *   4. Render itinerary per hari dalam bentuk kartu timeline.
 *   5. Chat lanjutan yang mengingat itinerary.
 *
 *  Kamus bahasa berada di js/i18n.js; komponen tampilan (logo, navbar,
 *  carousel, count-up, reveal) berada di file masing-masing.
 * ============================================================================
 */

(function () {
  'use strict';

  /* =====================================================================
     A. KAMUS BAHASA (i18n) - dimuat dari js/i18n.js
     ===================================================================== */
  const I18n = window.BaliWiseI18n;

  /* =====================================================================
     B. STATE APLIKASI
     ===================================================================== */
  const state = {
    bahasa: 'id',
    bahasaItinerary: 'id',   // bahasa saat itinerary dibuat
    itinerary: null,          // itinerary yang sedang tampil
    preferensi: null,         // preferensi terakhir (untuk membuat ulang)
    chatHistory: [],          // [{ role: 'user'|'assistant', text }]
    sedangProses: false,
    minatBebas: [],          // minat bebas yang diketik traveler (maks 5)
    titikAwal: null,         // { nama, lat, lng } atau null (pakai dropdown)
    dikecualikan: { destinasi: [], makan: [] }
  };

  /* Timer teks progres saat memproses rencana. */
  let loaderTimer = null;
  /* Token permintaan: mencegah respons lama menimpa hasil baru. */
  let tokenPermintaan = 0;

  /* =====================================================================
     C. UTILITAS
     ===================================================================== */
  const $ = (sel, akar) => (akar || document).querySelector(sel);
  const $$ = (sel, akar) => Array.prototype.slice.call((akar || document).querySelectorAll(sel));

  /** Mengambil teks terjemahan, dengan placeholder {n} yang bisa diganti. */
  function t(kunci, vars) {
    return I18n.get(kunci, vars);
  }

  /** Format Rupiah: 75000 -> "Rp 75.000" */
  function rupiah(angka) {
    const n = Number(angka) || 0;
    return 'Rp ' + new Intl.NumberFormat('id-ID').format(n);
  }

  /** Men-created elemen dengan aman (tanpa innerHTML dari input user). */
  function buatEl(tag, kelas, teks) {
    const el = document.createElement(tag);
    if (kelas) el.className = kelas;
    if (teks !== undefined && teks !== null) el.textContent = teks;
    return el;
  }

  /* ---- Penyimpanan bahasa (dengan try/catch, localStorage bisa diblokir) ---- */
  function simpanBahasa(bahasa) {
    try {
      window.localStorage.setItem('griska-go.bahasa', bahasa);
    } catch (_) {
      /* localStorage tidak tersedia (mode private / iframe) -> abaikan, bukan error fatal */
    }
  }
  function bacaBahasa() {
    try {
      const v = window.localStorage.getItem('griska-go.bahasa');
      return (v === 'id' || v === 'en') ? v : null;
    } catch (_) {
      return null;
    }
  }

  /* =====================================================================
     D. MULTI BAHASA
     ===================================================================== */

  /** Menerjemahkan seluruh elemen yang punya atribut data-i18n. */
  function terjemahkanUI() {
    I18n.setBahasa(state.bahasa);

    $$('[data-i18n]').forEach((el) => {
      const teks = t(el.getAttribute('data-i18n'));
      // Jangan sentuh elemen yang butuh HTML (mis. <span> di dalam <p>)
      if (el.children.length === 0) el.textContent = teks;
      else {
        // Ganti hanya teks node pertama agar format/icon tetap aman.
        el.firstChild && (el.firstChild.nodeType === 3 ? el.firstChild.nodeValue = teks : (el.textContent = teks));
      }
    });

    // Atribut alt untuk gambar (mis. slide carousel).
    $$('[data-i18n-alt]').forEach((el) => {
      el.setAttribute('alt', t(el.getAttribute('data-i18n-alt')));
    });

    // Atribut aria-label yang perlu ikut berbahasa (mis. label navigasi).
    $$('[data-i18n-aria-label]').forEach((el) => {
      el.setAttribute('aria-label', t(el.getAttribute('data-i18n-aria-label')));
    });

    // Update atribut yang berisi teks dinamis.
    const inputChat = $('#chat-input');
    if (inputChat) inputChat.placeholder = t('chat.placeholder');
    const btnSubmit = $('#submit-btn');
    if (btnSubmit) {
      const span = btnSubmit.querySelector('span');
      if (span) span.textContent = state.sedangProses ? t('plan.submitBusy') : t('plan.submit');
    }

    document.documentElement.lang = state.bahasa;
    document.title = state.bahasa === 'en'
      ? 'Griska Go — AI-Powered Bali Itinerary Planner'
      : 'Griska Go — Perencana Itinerary Bali Berbasis AI';
  }

  /** Mengganti bahasa aplikasi (+ hasil AI kalau itinerary sudah ada). */
  function setBahasa(bahasa) {
    if (bahasa !== 'id' && bahasa !== 'en') return;
    state.bahasa = bahasa;
    simpanBahasa(bahasa);

    $$('.lang-toggle__btn').forEach((btn) => {
      const aktif = btn.getAttribute('data-lang') === bahasa;
      btn.classList.toggle('is-active', aktif);
      btn.setAttribute('aria-pressed', aktif ? 'true' : 'false');
    });

    terjemahkanUI();

    // Teks dinamis komponen form ikut berbahasa.
    tambahChipBeachClub();
    perbaruiLabelTanggal();
    gambarWilayah('');
    gambarWilayahNative();

    // Render ulang hasil itinerary agar ikut berbahasa.
    if (state.itinerary && window.GriskaHasil) {
      renderItinerary(state.itinerary, state.budget, state.metaRencana);
    }

    // Render ulang itinerary agar nama tempat ikut mengikuti bahasa.
    if (state.itinerary) renderItinerary(state.itinerary);

    // Tampilkan tombol "buat ulang" bila bahasa hasil AI berbeda dengan bahasa UI.
    perbaruiTombolRegenerate();

    // Kabari komponen lain (carousel, dsb) bahwa bahasa berganti.
    document.dispatchEvent(new CustomEvent('griskago:bahasa', { detail: { bahasa: bahasa } }));
  }

  /* =====================================================================
     E. VALIDASI FORM
     ===================================================================== */
  function bacaPreferensi() {
    const durasiEl = $('input[name="durasi"]:checked');
    const budgetEl = $('input[name="budget"]:checked');
    const gayaEl = $('input[name="gaya"]:checked');
    const wilayah = $('#wilayah-awal');
    const catatan = $('#catatan');
    const turisEl = $('input[name="touristType"]:checked');
    const transportEl = $('input[name="transport"]:checked');
    const akomodasiEl = $('input[name="akomodasi"]:checked');
    const tanggal = $('#tanggal');
    const maks = $('#budget-maks');
    const durasiJumlah = $('#durasi-jumlah');
    const biayaTransport = $('#biaya-transport');
    const biayaAkomodasi = $('#biaya-akomodasi');

    // Durasi: tombol 1-7, atau "Lainnya" (8-14 hari).
    let durasi = durasiEl ? Number(durasiEl.value) : null;
    if (durasiEl && durasiEl.value === 'lainnya') {
      durasi = durasiJumlah ? parseInt(durasiJumlah.value, 10) : NaN;
    }

    // Minat: kategori + preset + teks bebas (chip).
    const minat = $$('input[name="minat"]:checked').map((el) => el.value);

    return {
      durasi: durasi,
      budget: budgetEl ? budgetEl.value : 'menengah',
      minat: minat,
      minatTeks: state.minatBebas.slice(),
      gaya: gayaEl ? gayaEl.value : 'padat',
      wilayahAwal: wilayah ? wilayah.value : '',
      titikAwal: state.titikAwal,
      catatan: catatan ? catatan.value.trim().slice(0, 300) : '',
      traveler: {
        dewasa: Number(($('#traveler-dewasa-input') || {}).value || 1),
        anak: Number(($('#traveler-anak-input') || {}).value || 0)
      },
      touristType: turisEl ? turisEl.value : 'domestik',
      transport: transportEl ? transportEl.value : 'motor',
      akomodasi: akomodasiEl ? akomodasiEl.value : 'hotel',
      biayaTransportHarian: biayaTransport ? Number(biayaTransport.value || 0) : 0,
      biayaAkomodasiMalam: biayaAkomodasi ? Number(biayaAkomodasi.value || 0) : 0,
      tanggal: tanggal ? tanggal.value : '',
      budgetMaks: maks ? angkaDariTeks(maks.value) : 0,
      // Tempat yang traveler minta dikecualikan (bertahan di revisi berikutnya).
      dikecualikan: {
        destinasi: ((state.dikecualikan && state.dikecualikan.destinasi) || []).slice(),
        makan: ((state.dikecualikan && state.dikecualikan.makan) || []).slice()
      }
    };
  }

  /** Validasi sebelum memanggil server. Mengembalikan pesan error atau null. */
  function validasiForm(p) {
    if (!p.durasi || !Number.isInteger(p.durasi) || p.durasi < 1 || p.durasi > 14) return t('plan.errDurasi');
    // Minimal satu minat: kategori, preset, atau teks bebas.
    const adaMinat = (p.minat && p.minat.length > 0) || (p.minatTeks && p.minatTeks.length > 0);
    if (!adaMinat) return t('plan.errMinat');
    if (!p.wilayahAwal && !p.titikAwal) return t('plan.errWilayah');
    if (p.catatan && p.catatan.length > 300) return t('chat.errLong');
    if (!p.traveler || p.traveler.dewasa < 1) return t('plan.errTraveler');
    if (p.traveler.dewasa > 20) return t('plan.errTraveler');
    if (p.traveler.anak < 0 || p.traveler.anak > 10) return t('plan.errTraveler');
    if (p.traveler.dewasa + p.traveler.anak > 30) return t('plan.errTraveler');
    if (p.budgetMaks && p.budgetMaks < 0) return t('plan.errBudgetMaks');
    if (p.transport === 'lainnya' && !(p.biayaTransportHarian > 0)) return t('plan.errBiayaTransport');
    if (p.akomodasi === 'lainnya' && !(p.biayaAkomodasiMalam > 0)) return t('plan.errBiayaAkomodasi');
    if (p.minatTeks && p.minatTeks.length > 5) return t('plan.errMinatBebas');
    return null;
  }

  function tampilkanError(pesan) {
    const box = $('#form-error');
    if (!box) return;
    if (!pesan) {
      box.hidden = true;
      box.textContent = '';
      return;
    }
    box.hidden = false;
    box.textContent = pesan;
    box.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  /* =====================================================================
     E2. CHIP MINAT BEBAS (teks yang diketik traveler)
     ===================================================================== */

  /**
   * Pola upaya prompt injection (identik dengan proteksi server).
   * Kalau terdeteksi, teks TIDAK dikirim sama sekali.
   */
  const POLA_INJEKSI = [
    /\b(ignore|abaikan|lupakan|discard|forget)\b[^.!?\n]{0,60}?\b(instruksi|instructions?|perintah|aturan|sistem|system|prompt)\b/i,
    /\b(system|assistant|user)\s*:/i,
    /\b(you are|anda adalah|kamu adalah|act as|bertingkah|pretend)\b/i,
    /\b(ignore all|abaikan semua|tambahkan|add|tambah)\b[^.!?\n]{0,40}?\b(ke itinerary|to the itinerary|hotel|resort|destinasi|place)\b/i
  ];

  /** Menambah minat bebas (maks 5, tiap 100 karakter). */
  function tambahMinatBebas(teks) {
    const bersih = String(teks || '').replace(/[\u0000-\u001f\u007f]/g, ' ')
      .replace(/\s+/g, ' ').trim().slice(0, 100);
    if (!bersih) return false;
    // Upaya memberi instruksi ke AI -> ditolak dengan pesan ramah.
    if (POLA_INJEKSI.some(function (pola) { return pola.test(bersih); })) {
      tampilkanError(t('plan.minatBebasDitolak'));
      return false;
    }
    if (state.minatBebas.length >= 5) {
      tampilkanError(t('plan.errMinatBebas'));
      return false;
    }
    if (state.minatBebas.indexOf(bersih) >= 0) return false;
    state.minatBebas.push(bersih);
    gambarChipMinatBebas();
    tampilkanError(null);
    return true;
  }

  /** Menggambar daftar chip minat bebas (dapat dihapus). */
  function gambarChipMinatBebas() {
    const daftar = $('#minat-bebas-list');
    if (!daftar) return;
    daftar.textContent = '';

    state.minatBebas.forEach(function (teks, i) {
      const li = document.createElement('li');
      li.className = 'taglist__item';

      const label = document.createElement('span');
      label.className = 'taglist__text';
      label.textContent = teks;
      li.appendChild(label);

      const hapus = document.createElement('button');
      hapus.type = 'button';
      hapus.className = 'taglist__remove';
      hapus.setAttribute('aria-label', t('plan.minatBebasHapus', { teks: teks }));
      hapus.textContent = '\u00d7';
      hapus.addEventListener('click', function () {
        state.minatBebas.splice(i, 1);
        gambarChipMinatBebas();
      });
      li.appendChild(hapus);

      daftar.appendChild(li);
    });

    const counter = $('#minat-bebas-count');
    const input = $('#minat-bebas');
    if (counter) counter.textContent = String(input ? input.value.length : 0);
  }

  /* =====================================================================
     F. RENDER ITINERARY (timeline kartu per hari)
     ===================================================================== */

  /** Membuat satu kartu kegiatan (stop). */
  function renderStop(stop) {
    const kartu = buatEl('article', 'stop');

    /* --- Bagian atas: jam + nama tempat --- */
    const top = buatEl('div', 'stop__top');

    const jam = buatEl('div', 'stop__time', stop.jam || '--:--');
    jam.setAttribute('aria-label', 'Waktu'); // label untuk pembaca layar

    const judul = buatEl('div');
    const nama = buatEl('h4', 'stop__name',
      state.bahasa === 'en' && stop.namaTempatEn ? stop.namaTempatEn : stop.namaTempat);
    judul.appendChild(nama);

    /* --- Meta: kategori, wilayah, durasi --- */
    const meta = buatEl('div', 'stop__meta');
    meta.appendChild(buatEl('span', 'tag tag--sea', t('kategori.' + stop.kategori)));
    meta.appendChild(buatEl('span', 'tag tag--green', stop.wilayah));
    const durasi = stop.durasiMenit;
    if (durasi) meta.appendChild(buatEl('span', 'tag', t('stop.duration') + ' ' + durasi + ' ' + t('stop.min')));
    judul.appendChild(meta);

    top.appendChild(jam);
    top.appendChild(judul);
    kartu.appendChild(top);

    /* --- Aktivitas --- */
    if (stop.aktivitas) kartu.appendChild(buatEl('p', 'stop__act', stop.aktivitas));

    /* --- Estimasi biaya --- */
    const biaya = Number(stop.estimasiBiaya) || 0;
    kartu.appendChild(buatEl('span', 'stop__cost', biaya > 0 ? rupiah(biaya) : t('stop.free')));

    /* --- Tips budaya & etika --- */
    if (stop.tipsBudaya && stop.tipsBudaya.length) {
      const tips = buatEl('div', 'stop__tips');
      const judulTips = buatEl('div', 'stop__tips-title');
      // Ikon centang kecil (inline SVG, tanpa file eksternal).
      judulTips.insertAdjacentHTML('afterbegin',
        '<svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true" style="flex:0 0 auto">' +
        '<path d="M9 16.2L4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4z" fill="currentColor"/></svg>');
      judulTips.appendChild(buatEl('span', null, t('stop.tips')));
      tips.appendChild(judulTips);

      const list = buatEl('ul');
      stop.tipsBudaya.forEach((tip) => list.appendChild(buatEl('li', null, tip)));
      tips.appendChild(list);
      kartu.appendChild(tips);
    }

    /* --- Transportasi --- */
    if (stop.transportasi) {
      const tr = buatEl('div', 'stop__transport');
      tr.appendChild(buatEl('strong', null, t('stop.transport') + ': '));
      tr.appendChild(buatEl('span', null, stop.transportasi));
      kartu.appendChild(tr);
    }

    return kartu;
  }

  /** Membuat blok satu hari. */
  function renderHari(hari) {
    const blok = buatEl('section', 'day');

    /* --- Kepala hari --- */
    const head = buatEl('div', 'day__head');
    head.appendChild(buatEl('div', 'day__badge', String(hari.hari)));
    const judulWrap = buatEl('div');
    judulWrap.appendChild(buatEl('h3', 'day__title', t('day.label', { n: hari.hari })));
    if (hari.tema) judulWrap.appendChild(buatEl('p', 'day__theme', hari.tema));
    head.appendChild(judulWrap);
    head.appendChild(buatEl('span', 'day__cost', rupiah(hari.totalBiaya)));
    blok.appendChild(head);

    /* --- Daftar kegiatan --- */
    const list = buatEl('div', 'day__list');
    (hari.jadwal || []).forEach((stop) => list.appendChild(renderStop(stop)));
    blok.appendChild(list);

    return blok;
  }

  /**
   * Menampilkan hasil itinerary (ringkasan, timeline, peta, budget, tips).
   * Data sudah lengkap dari server: rencana + rincian budget.
   */
  function renderItinerary(itinerary, budget, meta) {
    if (!itinerary) return;
    state.itinerary = itinerary;
    state.budget = budget || null;
    state.metaRencana = meta || null;

    if (window.GriskaHasil) {
      window.GriskaHasil.render(itinerary, budget || state.budget, Object.assign({}, meta, {
        bahasa: state.bahasa,
        gaya: (state.preferensi || {}).gaya,
        tanggal: (state.preferensi || {}).tanggal
      }));
    }

    // Panel chat muncul setelah ada rencana.
    const chatSection = $('#chat');
    if (chatSection) chatSection.hidden = false;

    perbaruiTombolRegenerate();
  }

  /** Tombol "buat ulang" muncul saat bahasa UI berbeda dari bahasa hasil AI. */
  function perbaruiTombolRegenerate() {
    const btn = $('#regenerate-btn');
    if (!btn) return;
    const beda = state.itinerary && state.bahasaItinerary !== state.bahasa;
    btn.hidden = !beda;
    if (beda) {
      btn.textContent = t('res.regenerate', { lang: state.bahasa === 'en' ? 'English' : 'Bahasa Indonesia' });
    }
  }

  /* =====================================================================
     G. LOADING STATE
     ===================================================================== */
  function tampilkanLoading() {
    const timeline = $('#timeline');
    const hasilSection = $('#hasil');
    if (!timeline || !hasilSection) return;

    timeline.textContent = '';

    // Saat sedang memproses: jangan tampilkan kotak "0" atau "Rp 0".
    const head = $('#res-head');
    const empty = $('#res-empty');
    if (head) head.hidden = true;
    if (empty) empty.hidden = true;

    const loader = buatEl('div', 'loader');
    loader.setAttribute('role', 'status');
    loader.setAttribute('aria-live', 'polite');

    loader.appendChild(buatEl('div', 'loader__ring'));

    // Teks progres: berganti bertahap supaya traveler tahu prosesnya jalan.
    const judul = buatEl('p', 'loader__text', t('load.title'));
    loader.appendChild(judul);

    const langkah = buatEl('p', 'loader__step', t('load.step1'));
    loader.appendChild(langkah);

    const dots = buatEl('p', 'loader__dots');
    dots.appendChild(buatEl('span'));
    dots.appendChild(buatEl('span'));
    dots.appendChild(buatEl('span'));
    loader.appendChild(dots);

    loader.appendChild(buatEl('p', 'loader__hint', t('load.hint')));

    // Tombol "Lewati narasi AI": traveler tidak perlu menunggu AI menulis cerita.
    const skip = buatEl('button', 'btn btn--outline btn--sm loader__skip');
    skip.type = 'button';
    skip.setAttribute('data-action', 'skip-narasi');
    skip.appendChild(buatEl('span', null, t('load.skip')));
    loader.appendChild(skip);

    // Kerangka (skeleton) itinerary supaya layout tidak "melompat" saat hasil muncul.
    const skeleton = buatEl('div', 'skeleton');
    for (let i = 0; i < 3; i++) {
      const baris = buatEl('div', 'skeleton__row');
      baris.appendChild(buatEl('span', 'skeleton__time'));
      const isi = buatEl('div', 'skeleton__body');
      isi.appendChild(buatEl('span', 'skeleton__line skeleton__line--title'));
      isi.appendChild(buatEl('span', 'skeleton__line'));
      isi.appendChild(buatEl('span', 'skeleton__line skeleton__line--short'));
      baris.appendChild(isi);
      skeleton.appendChild(baris);
    }
    loader.appendChild(skeleton);

    timeline.appendChild(loader);
    hasilSection.hidden = false;
    $('#chat').hidden = true;

    // Auto scroll ke area hasil.
    setTimeout(() => hasilSection.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80);

    // Berhenti saat hasil sudah tampil.
    window.clearInterval(loaderTimer);
    let tahap = 0;
    const daftarLangkah = ['load.step1', 'load.step2', 'load.step3'];
    loaderTimer = window.setInterval(() => {
      tahap = (tahap + 1) % daftarLangkah.length;
      langkah.textContent = t(daftarLangkah[tahap]);
    }, 1600);
  }

  /* =====================================================================
     H. ALUR PEMBUATAN ITINERARY
     ===================================================================== */
  async function buatItinerary(tanpaNarasi) {
    if (state.sedangProses && !tanpaNarasi) return;

    const preferensi = bacaPreferensi();
    const error = validasiForm(preferensi);
    if (error) {
      tampilkanError(error);
      return;
    }
    tampilkanError(null);

    state.preferensi = preferensi;
    state.sedangProses = true;
    setLoadingForm(true);
    tampilkanLoading();

    // Token permintaan: respons yang sudah basi (mis. dari permintaan lama
    // yang dibatalkan) diabaikan supaya tidak menimpa hasil yang lebih baru.
    const token = ++tokenPermintaan;

    const hasil = await window.BaliWiseApi.buatItinerary(preferensi, state.bahasa, !!tanpaNarasi);

    if (token !== tokenPermintaan) return;   // permintaan lain sudah menggantikannya

    state.sedangProses = false;
    setLoadingForm(false);
    window.clearInterval(loaderTimer);
    loaderTimer = null;

    if (!hasil.ok) {
      // Server sudah-mortens: error di sini berarti masalah lain (mis. validasi).
      tampilkanGagal(hasil.message, hasil.rawText);
      return;
    }

    state.itinerary = hasil.itinerary;
    state.budget = hasil.budget || null;
    state.bahasaItinerary = state.bahasa;
    state.chatHistory = [];

    renderItinerary(state.itinerary, hasil.budget, hasil.meta);
    bersihkanChat();
    tampilkanCatatanJujur(hasil.meta);
    setTimeout(() => $('#hasil').scrollIntoView({ behavior: 'smooth', block: 'start' }), 60);
  }

  /**
   * "Lewati narasi AI": traveler tidak mau menunggu cerita dari AI.
   * Permintaan yang sedang jalan dibatalkan, lalu rencana dihitung ulang
   * TANPA narasi (rencana, rute, dan budget tetap lengkap).
   */
  function lewatiNarasiAI() {
    if (!state.preferensi) return;
    tokenPermintaan += 1;                 // buang respons yang sedang jalan
    if (window.BaliWiseApi && window.BaliWiseApi.batalkan) window.BaliWiseApi.batalkan();
    state.sedangProses = false;
    setLoadingForm(false);
    buatItinerary(true);
  }

  /** Menonaktifkan form saat proses berjalan. */
  function setLoadingForm(aktif) {
    const btn = $('#submit-btn');
    const form = $('#plan-form');
    if (btn) {
      btn.disabled = aktif;
      const span = btn.querySelector('span');
      if (span) span.textContent = aktif ? t('plan.submitBusy') : t('plan.submit');
    }
    if (form) $$('input, select, textarea', form).forEach((el) => { el.disabled = aktif; });
  }

  /** Menampilkan pesan error sebagai kartu rapi (tidak memenuhi layar). */
  function tampilkanGagal(pesan, rawText) {
    const timeline = $('#timeline');
    const hasilSection = $('#hasil');
    if (!timeline) return;

    timeline.textContent = '';

    // Sembunyikan kepala + empty state, tampilkan kartu error saja.
    const head = $('#res-head');
    const empty = $('#res-empty');
    if (head) head.hidden = true;
    if (empty) empty.hidden = true;

    const box = buatEl('div', 'error-card');
    box.setAttribute('role', 'alert');

    const judul = buatEl('div', 'error-card__title');
    judul.insertAdjacentHTML('afterbegin',
      '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" style="flex:0 0 auto">' +
      '<path d="M12 2L1 21h22L12 2zm1 14h-2v2h2zm0-6h-2v5h2z" fill="currentColor"/></svg>');
    judul.appendChild(buatEl('span', null, t('err.title')));
    box.appendChild(judul);

    box.appendChild(buatEl('p', null, pesan || t('err.default')));

    const cobaLagi = buatEl('button', 'btn btn--primary btn--sm', t('plan.retry'));
    cobaLagi.type = 'button';
    cobaLagi.style.marginBottom = '12px';
    cobaLagi.addEventListener('click', buatItinerary);
    box.appendChild(cobaLagi);

    // Fallback: tampilkan teks mentah dari AI bila format JSON tidak valid.
    if (rawText) {
      const detail = buatEl('details');
      detail.appendChild(buatEl('summary', null, t('err.raw')));
      const pre = buatEl('pre', null, rawText);
      detail.appendChild(pre);
      box.appendChild(detail);
    }

    timeline.appendChild(box);

    if (hasilSection) hasilSection.hidden = false;
    setTimeout(() => hasilSection.scrollIntoView({ behavior: 'smooth', block: 'center' }), 60);
  }

  /**
   * Menampilkan catatan jujur dari server (mis. minat bebas yang tidak ada
   * di katalog). Tidak pernah menampilkan tempat karangan.
   */
  function tampilkanCatatanJujur(meta) {
    const kotak = $('#trip-notice');
    if (!kotak) return;
    const catatan = meta && Array.isArray(meta.catatan) ? meta.catatan.filter(Boolean) : [];
    if (!catatan.length) {
      kotak.hidden = true;
      kotak.textContent = '';
      return;
    }
    kotak.hidden = false;
    kotak.textContent = catatan.join(' ');
  }

  /* =====================================================================
     I. CHAT LANJUTAN
     ===================================================================== */

  /** Mengosongkan panel chat. */
  function bersihkanChat() {
    const log = $('#chat-log');
    if (!log) return;
    log.textContent = '';
    log.appendChild(buatEl('p', 'loader__hint', t('chat.empty')));
  }

  /** Menambahkan satu pesan ke log chat. */
  function tambahPesan(role, teks, perubahan) {
    const log = $('#chat-log');
    if (!log) return;

    // Hapus pesan placeholder awal.
    const kosong = log.querySelector('.loader__hint');
    if (kosong) kosong.remove();

    const wrapper = buatEl('div', 'msg msg--' + (role === 'user' ? 'user' : 'ai'));
    const bubble = buatEl('div', 'msg__bubble');

    // Teks dipisah per baris agar rapi.
    String(teks || '').split(/\n+/).forEach((baris) => {
      if (baris.trim()) bubble.appendChild(buatEl('p', null, baris.trim()));
    });

    if (perubahan && perubahan.length) {
      const list = buatEl('ul', 'msg__changes');
      perubahan.forEach((p) => list.appendChild(buatEl('li', null, p)));
      bubble.appendChild(list);
    }

    wrapper.appendChild(bubble);
    log.appendChild(wrapper);
    log.scrollTop = log.scrollHeight;
  }

  /** Menampilkan indikator "sedang thinking" di chat. */
  function tampilkanTyping() {
    const log = $('#chat-log');
    if (!log) return null;
    const el = buatEl('div', 'msg msg--ai');
    const bubble = buatEl('div', 'msg__bubble');
    const dots = buatEl('span', 'loader__dots');
    dots.appendChild(buatEl('span'));
    dots.appendChild(buatEl('span'));
    dots.appendChild(buatEl('span'));
    bubble.appendChild(dots);
    el.appendChild(bubble);
    log.appendChild(el);
    log.scrollTop = log.scrollHeight;
    return el;
  }

  /** Bahasa aktif (dari atribut <html lang>). */
  function bahasaSekarang() {
    return (document.documentElement.lang || 'id') === 'en' ? 'en' : 'id';
  }

  /* Kalimat yang mengklaim perubahan TIDAK boleh tampil dari teks AI:
   klaim hanya boleh datang dari flag "diubah" milik server. */
  const POLA_KLAIM_KLIEN = /(diperbarui|diperbaharui|diupdate|updated|has been updated|have been updated|sudah diubah|perubahan telah diterapkan|applied (the|your) changes?)/i;

  /** Membuang kalimat klaim-perubahan dari teks balasan AI. */
  function buangKlaimTeks(teks) {
    const baris = String(teks || '').split(/\n+/);
    const hasil = [];
    baris.forEach(function (b) {
      const kalimat = b.split(/(?<=[.!?])\s+/);
      const aman = kalimat.filter(function (k) { return !POLA_KLAIM_KLIEN.test(k); });
      const gabung = aman.join(' ').replace(/\s+/g, ' ').trim();
      if (gabung) hasil.push(gabung);
    });
    return hasil.join('\n');
  }

  /** Scroll halus ke area hasil setelah rencana diperbarui. */
  function scrollKeHasil() {
    const target = $('#hasil') || $('#plan');
    if (!target) return;
    try {
      // scrollIntoView dipakai lebih dulu (pola yang sama dengan bagian loading).
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } catch (e) {
      try {
        const y = target.getBoundingClientRect().top + window.pageYOffset - 88;
        window.scrollTo({ top: y, behavior: 'smooth' });
      } catch (e2) { /* abaikan */ }
    }
  }

  /** Sinkronkan preferensi budget/akomodasi/transport setelah revisi chat. */
  function terapkanPreferensiBaru(pref) {
    if (!pref || !state.preferensi) return;
    if (pref.budget) {
      state.preferensi.budget = pref.budget;
      const radio = $('input[name="budget"][value="' + pref.budget + '"]');
      if (radio && !radio.checked) {
        radio.checked = true;
        radio.dispatchEvent(new Event('change', { bubbles: true }));
      }
    }
    if (pref.akomodasi) state.preferensi.akomodasi = pref.akomodasi;
    if (pref.transport) state.preferensi.transport = pref.transport;
    if (pref.dikecualikan) {
      state.dikecualikan = {
        destinasi: (pref.dikecualikan.destinasi || []).slice(),
        makan: (pref.dikecualikan.makan || []).slice()
      };
      state.preferensi.dikecualikan = {
        destinasi: state.dikecualikan.destinasi.slice(),
        makan: state.dikecualikan.makan.slice()
      };
    }
    if (pref.budgetMaks) {
      state.preferensi.budgetMaks = pref.budgetMaks;
      const maks = $('#budget-maks');
      if (maks && maks.value !== formatRibuan(pref.budgetMaks)) {
        maks.value = formatRibuan(pref.budgetMaks);
        maks.dispatchEvent(new Event('input', { bubbles: true }));
      }
    }
  }

  /** Label chip beach club sesuai bahasa. */
  function labelBeachClub() {
    return bahasaSekarang() === 'en' ? 'Beach Club' : 'Beach Club / Klub Pantai';
  }

  /**
   * Menambahkan pilihan minat "Beach club" (kategori baru di katalog).
   * Chip dibuat dari JS supaya file index.html tidak perlu diubah.
   */
  function tambahChipBeachClub() {
    const cek = $('input[name="minat"][value="beach-club"]');
    if (cek) {
      const label = cek.parentNode.querySelector('span');
      if (label) label.textContent = labelBeachClub();
      return;
    }
    const acuan = $('input[name="minat"][value="nightlife"]');
    if (!acuan || !acuan.parentNode || !acuan.parentNode.parentNode) return;

    const label = document.createElement('label');
    label.className = 'chip';
    label.id = 'chip-beach-club';

    const input = document.createElement('input');
    input.type = 'checkbox';
    input.name = 'minat';
    input.value = 'beach-club';

    const span = document.createElement('span');
    span.textContent = labelBeachClub();

    label.appendChild(input);
    label.appendChild(span);
    acuan.parentNode.parentNode.insertBefore(label, acuan.parentNode.nextSibling);
  }

  /** Mengirim pesan chat ke AI. */
  async function kirimPesan(teks) {
    if (!teks || !teks.trim()) {
      tampilkanError(t('chat.errEmpty'));
      return;
    }
    if (teks.length > 300) {
      tampilkanError(t('chat.errLong'));
      return;
    }
    tampilkanError(null);

    if (!state.itinerary) {
      // Tetap boleh chat, tapi itinerary kosong = tidak ada konteks.
      console.warn('[BaliWise] Chat tanpa itinerary.');
    }

    tambahPesan('user', teks);
    state.chatHistory.push({ role: 'user', text: teks });

    const statusEl = $('.chat__status');
    if (statusEl) statusEl.textContent = t('chat.statusBusy');

    const typing = tampilkanTyping();

    const hasil = await window.BaliWiseApi.kirimChat(
      teks,
      state.itinerary,
      state.chatHistory.slice(0, -1), // riwayat tanpa pesan yang baru saja dikirim
      state.bahasa,
      state.preferensi
    );

    if (typing && typing.parentNode) typing.parentNode.removeChild(typing);
    if (statusEl) statusEl.textContent = t('chat.status');

    if (!hasil.ok) {
      tambahPesan('assistant', hasil.message || 'Maaf, terjadi kesalahan.');
      return;
    }

    const balasan = hasil.balasan || {};
    const meta = hasil.meta || {};

    // Flag "diubah" dari server: satu-satunya sumber kebenaran.
    const diubah = typeof balasan.diubah === 'boolean'
      ? balasan.diubah
      : (typeof meta.diubah === 'boolean' ? meta.diubah : false);

    // Teks AI tidak boleh mengklaim perubahan -> kalimat klaim dibuang.
    // Pesan utama diambil dari server (ringkasan perubahan yang jujur).
    let teksTampil = meta.pesan
      ? String(meta.pesan)
      : buangKlaimTeks(balasan.reply || '');

    // Rencana baru? Render ulang seluruh hasil (ringkasan, tab hari,
    // timeline, peta, rincian budget), lalu scroll + highlight singkat.
    if (diubah && balasan.itinerary) {
      state.itinerary = balasan.itinerary;
      state.budget = hasil.budget || null;
      state.bahasaItinerary = state.bahasa;
      renderItinerary(state.itinerary, hasil.budget, {
        bahasa: state.bahasa,
        narasiAI: meta.narasiAI !== false
      });
      terapkanPreferensiBaru(meta.preferensi);
      scrollKeHasil();
      if (window.GriskaHasil && window.GriskaHasil.tandaiDiperbarui) {
        window.GriskaHasil.tandaiDiperbarui();
      }
    }

    // Cadangan kalau server tidak mengirim ringkasan.
    if (!teksTampil) {
      teksTampil = diubah
        ? (bahasaSekarang() === 'en' ? 'Plan updated.' : 'Rencana diperbarui.')
        : (bahasaSekarang() === 'en'
            ? 'No change was made to the plan.'
            : 'Belum ada perubahan pada rencana.');
    }

    tambahPesan('assistant', teksTampil, diubah ? (balasan.perubahan || []) : []);
    state.chatHistory.push({ role: 'assistant', text: buangKlaimTeks(balasan.reply || '') });

    // Batasi riwayat agar tidak membengkak.
    if (state.chatHistory.length > 20) {
      state.chatHistory = state.chatHistory.slice(-20);
    }
  }

  /* =====================================================================
     K. KOMPONEN FORM: BUDGET MAKS, KALENDER CUSTOM, PICKER WILAYAH
     ===================================================================== */

  /* ---------- Util angka & rupiah ---------- */

  /** Ambil angka dari teks (semua non-digit dibuang). */
  function angkaDariTeks(teks) {
    return Number(String(teks || '').replace(/\D/g, '')) || 0;
  }

  /** Format angka dengan pemisah ribuan titik: 19900000 -> 19.900.000 */
  function formatRibuan(angka) {
    return String(angka === undefined || angka === null ? '' : angka)
      .replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  }

  /** Bentuk ringkasan budget: "19,9 juta" (ID) / "19.9 million" (EN). */
  function ringkasRupiah(angka) {
    const en = state.bahasa === 'en';
    const n = Number(angka) || 0;
    const desimal = function (x) {
      return x.toFixed(1).replace('.0', '').replace('.', en ? '.' : ',');
    };
    if (n >= 1e9) return desimal(n / 1e9) + (en ? ' billion' : ' miliar');
    if (n >= 1e6) return desimal(n / 1e6) + (en ? ' million' : ' juta');
    if (n >= 1e3) return Math.round(n / 1e3) + (en ? ' thousand' : ' ribu');
    return String(n);
  }

  /* ---------- Panel yang bisa dibuka (buka-tutup bersama) ---------- */

  /* Panel yang sedang terbuka: { id, el, tombol } */
  const panelTerbuka = { id: null, el: null, tombol: null };

  /* Dropdown kecil (bulan & tahun) yang sedang terbuka. */
  const dropdownTerbuka = { el: null, tombol: null };

  /* Latar gelap untuk bottom sheet di layar kecil. */
  let backdropKalender = null;

  /* Handler "tutup saat klik di luar": dipasang SETELAH panel terbuka
     (setTimeout 0) dan dicopot saat panel tertutup, tidak berulang. */
  let klikLuarHandler = null;

  /** Membuat (sekali) latar gelap di luar panel. */
  function ambilBackdrop() {
    if (!backdropKalender) {
      backdropKalender = document.createElement('div');
      backdropKalender.className = 'picker__backdrop';
      backdropKalender.id = 'picker-backdrop';
      backdropKalender.hidden = true;
      document.body.appendChild(backdropKalender);
    }
    return backdropKalender;
  }

  function tutupDropdown() {
    if (!dropdownTerbuka.el) return;
    dropdownTerbuka.el.hidden = true;
    if (dropdownTerbuka.tombol) dropdownTerbuka.tombol.setAttribute('aria-expanded', 'false');
    dropdownTerbuka.el = null;
    dropdownTerbuka.tombol = null;
  }

  /** Pasang (sekali) handler klik di document yang menutup panel. */
  function pasangKlikLuar() {
    if (klikLuarHandler) return;
    klikLuarHandler = function (e) {
      // Dropdown kecil (bulan/tahun) yang sedang terbuka.
      if (dropdownTerbuka.el) {
        const wrap = dropdownTerbuka.el.parentNode;
        if (wrap && wrap.contains(e.target)) return;
        tutupDropdown();
      }
      if (!panelTerbuka.id) { copotKlikLuar(); return; }
      const panel = panelTerbuka.el;
      const tombol = panelTerbuka.tombol;
      // Abaikan klik di dalam tombol pembuka atau di dalam panel.
      if (panel && (e.target === panel || panel.contains(e.target))) return;
      if (tombol && (e.target === tombol || tombol.contains(e.target))) return;
      tutupPanel();
    };
    document.addEventListener('click', klikLuarHandler);
  }

  /** Copot handler klik di luar (dipanggil saat panel tertutup). */
  function copotKlikLuar() {
    if (!klikLuarHandler) return;
    document.removeEventListener('click', klikLuarHandler);
    klikLuarHandler = null;
  }

  function tutupPanel() {
    copotKlikLuar();
    tutupDropdown();
    if (!panelTerbuka.id) return;
    if (panelTerbuka.el) panelTerbuka.el.classList.remove('is-open');
    if (panelTerbuka.tombol) panelTerbuka.tombol.setAttribute('aria-expanded', 'false');
    if (backdropKalender) backdropKalender.hidden = true;
    panelTerbuka.id = null;
    panelTerbuka.el = null;
    panelTerbuka.tombol = null;
  }

  function bukaPanel(idPanel, idTombol, sebelumBuka) {
    // Sudah terbuka: jangan render ulang / buka ulang (cegah kedip).
    if (panelTerbuka.id === idPanel) return;
    tutupPanel();
    const panel = $('#' + idPanel);
    const tombol = $('#' + idTombol);
    if (!panel || !tombol) return;
    if (sebelumBuka) sebelumBuka();
    panel.hidden = false;              /* lepas atribut awal HTML (sekali) */
    panel.classList.add('is-open');   /* tampil/sembunyi via class */
    tombol.setAttribute('aria-expanded', 'true');
    panelTerbuka.id = idPanel;
    panelTerbuka.el = panel;
    panelTerbuka.tombol = tombol;
    // Latar gelap hanya untuk layar kecil (<640px) tempat panel jadi
    // bottom sheet; di desktop panel adalah popup biasa tanpa overlay.
    if (window.matchMedia('(max-width: 639px)').matches) {
      ambilBackdrop().hidden = false;
    }
    // Pasang "tutup saat klik di luar" SETELAH event click tombol selesai.
    window.setTimeout(pasangKlikLuar, 0);
  }

  /**
   * Tombol pemicu panel: HANYA satu event "click" (tanpa pointerup/
   * touchstart/mousedown), dengan stopPropagation agar handler
   * "tutup saat klik di luar" tidak langsung menutupnya kembali.
   */
  function pasangTombolPanel(tombol, idPanel, sebelumBuka) {
    tombol.addEventListener('click', function (e) {
      e.stopPropagation();
      if (panelTerbuka.id === idPanel) tutupPanel();
      else bukaPanel(idPanel, tombol.id, sebelumBuka);
    });
  }

  /* ---------- 1. BUDGET MAKSIMAL ---------- */

  function initBudgetMaks() {
    const input = $('#budget-maks');
    const setara = $('#budget-maks-setara');
    const chipWrap = $('#budget-maks-cepat');
    if (!input) return;

    const perbarui = function () {
      const n = angkaDariTeks(input.value);
      if (!setara) return;
      if (!n) {
        setara.hidden = true;
        setara.textContent = '';
        return;
      }
      setara.hidden = false;
      setara.textContent = t('plan.budgetMaksSetara', { nilai: ringkasRupiah(n) });
    };

    input.addEventListener('input', function () {
      const kursorAwal = input.selectionStart;
      const digitSebelum = String(input.value.slice(0, kursorAwal).replace(/\D/g, '')).length;
      const angka = input.value.replace(/\D/g, '');
      const baru = formatRibuan(angka);
      input.value = baru;
      // Kursor dikembalikan ke digit yang sama, jadi tidak "loncat".
      let pos = 0;
      let seen = 0;
      while (pos < baru.length && seen < digitSebelum) {
        if (/\d/.test(baru[pos])) seen += 1;
        pos += 1;
      }
      try { input.setSelectionRange(pos, pos); } catch (e) { /* abaikan */ }
      perbarui();
    });

    if (chipWrap) {
      $$('button[data-jumlah]', chipWrap).forEach(function (btn) {
        btn.addEventListener('click', function () {
          input.value = formatRibuan(btn.getAttribute('data-jumlah') || '0');
          perbarui();
          input.focus();
        });
      });
    }

    perbarui();
  }

  /* ---------- 2. KALENDER CUSTOM ---------- */

  let kalenderBulan = null;

  function kalenderLocale() {
    return state.bahasa === 'en' ? 'en-GB' : 'id-ID';
  }

  function kalenderHariAwal() {
    return state.bahasa === 'en' ? 0 : 1;
  }

  /** Nama bulan 0-11 sesuai bahasa. */
  function namaBulan(bln) {
    const id = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli',
      'Agustus', 'September', 'Oktober', 'November', 'Desember'];
    const en = ['January', 'February', 'March', 'April', 'May', 'June', 'July',
      'August', 'September', 'October', 'November', 'December'];
    return state.bahasa === 'en' ? en[bln] : id[bln];
  }

  function tanggalDariIso(iso) {
    const teks = String(iso || '');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(teks)) return null;
    const bagian = teks.split('-').map(Number);
    return new Date(bagian[0], bagian[1] - 1, bagian[2]);
  }

  function isoDariTanggal(d) {
    const bulan = String(d.getMonth() + 1).padStart(2, '0');
    const hari = String(d.getDate()).padStart(2, '0');
    return d.getFullYear() + '-' + bulan + '-' + hari;
  }

  function formatTanggalPanjang(iso) {
    const d = tanggalDariIso(iso);
    if (!d) return '';
    return d.toLocaleDateString(kalenderLocale(), {
      weekday: 'long', day: 'numeric', month: 'short', year: 'numeric'
    });
  }

  /** Info musim: kemarau Apr-Okt, hujan Nov-Mar. */
  function infoMusim(tgl) {
    const bulan = tgl.getMonth();
    const kemarau = bulan >= 3 && bulan <= 9;
    return kemarau ? t('plan.tanggalMusimKemarau') : t('plan.tanggalMusimHujan');
  }

  function kalenderBulanTampil() {
    if (!kalenderBulan) {
      const now = new Date();
      kalenderBulan = new Date(now.getFullYear(), now.getMonth(), 1);
    }
    return kalenderBulan;
  }

  /** Tahun yang boleh dipilih: tahun ini sampai +3. */
  function kalenderTahunOpsi() {
    const now = new Date();
    const daftar = [];
    for (let i = 0; i < 4; i++) daftar.push(now.getFullYear() + i);
    return daftar;
  }

  /** Buat dropdown custom (bulan / tahun) yang bisa disentuh. */
  function buatDropdownOpsi(konfigurasi) {
    const wrap = document.createElement('div');
    wrap.className = 'datepick__select';

    const tombol = document.createElement('button');
    tombol.type = 'button';
    tombol.className = 'datepick__select-btn';
    tombol.setAttribute('aria-haspopup', 'listbox');
    tombol.setAttribute('aria-expanded', 'false');
    tombol.setAttribute('aria-label', konfigurasi.labelAria);

    const label = document.createElement('span');
    label.className = 'datepick__select-label';
    tombol.appendChild(label);

    const chev = document.createElement('span');
    chev.className = 'datepick__select-chev';
    chev.setAttribute('aria-hidden', 'true');
    chev.textContent = '\u25be';
    tombol.appendChild(chev);

    const panel = document.createElement('div');
    panel.className = 'datepick__select-panel';
    panel.hidden = true;
    panel.setAttribute('role', 'listbox');

    wrap.appendChild(tombol);
    wrap.appendChild(panel);

    const gambar = function () {
      panel.textContent = '';
      konfigurasi.opsi().forEach(function (o) {
        const item = document.createElement('button');
        item.type = 'button';
        item.className = 'datepick__select-item' + (o.aktif ? ' is-active' : '');
        item.setAttribute('role', 'option');
        item.setAttribute('aria-selected', o.aktif ? 'true' : 'false');
        item.textContent = o.teks;
        item.disabled = !!o.nonaktif;
        item.addEventListener('click', function () {
          if (item.disabled) return;
          konfigurasi.pilih(o.nilai);
          tutupDropdown();
        });
        panel.appendChild(item);
      });
    };

    tombol.addEventListener('pointerup', function (e) {
      e.stopPropagation();
      const akanBuka = panel.hidden;
      tutupDropdown();
      if (!akanBuka) return;
      gambar();
      panel.hidden = false;
      tombol.setAttribute('aria-expanded', 'true');
      dropdownTerbuka.el = panel;
      dropdownTerbuka.tombol = tombol;
    });
    tombol.addEventListener('click', function (e) {
      e.stopPropagation();
    });

    return {
      wrap: wrap,
      tombol: tombol,
      setLabel: function (teks) { label.textContent = teks; },
      gambar: gambar
    };
  }

  function gambarKalender() {
    const judul = $('#tanggal-judul');
    const barisHari = $('#tanggal-hari');
    const grid = $('#tanggal-grid');
    if (!judul || !grid) return;

    const bulan = kalenderBulanTampil();

    // Dua dropdown custom (Bulan & Tahun) menggantikan teks "November 2026".
    if (!judul.querySelector('.datepick__select')) {
      judul.textContent = '';
      judul.className = 'datepick__selects';
      if (dropdownBulan) judul.appendChild(dropdownBulan.wrap);
      if (dropdownTahun) judul.appendChild(dropdownTahun.wrap);
    }
    if (dropdownBulan) dropdownBulan.setLabel(namaBulan(bulan.getMonth()));
    if (dropdownTahun) dropdownTahun.setLabel(String(bulan.getFullYear()));

    // Nama hari (Senin/Minggu, mengikuti bahasa).
    if (barisHari) {
      barisHari.textContent = '';
      const acuan = new Date(2024, 0, 7);            // 7 Januari 2024 = Minggu
      for (let i = 0; i < 7; i++) {
        const d = new Date(acuan);
        d.setDate(acuan.getDate() - acuan.getDay() + kalenderHariAwal() + i);
        barisHari.appendChild(buatEl('span', 'datepick__dayname',
          d.toLocaleDateString(kalenderLocale(), { weekday: 'short' })));
      }
    }

    // Grid tanggal.
    grid.textContent = '';
    const pertama = new Date(bulan.getFullYear(), bulan.getMonth(), 1);
    const geser = (pertama.getDay() - kalenderHariAwal() + 7) % 7;
    const jumlahHari = new Date(bulan.getFullYear(), bulan.getMonth() + 1, 0).getDate();
    const hariIni = new Date();
    hariIni.setHours(0, 0, 0, 0);
    const input = $('#tanggal');
    const terpilih = tanggalDariIso(input ? input.value : '');

    for (let i = 0; i < geser; i++) {
      grid.appendChild(buatEl('span', 'datepick__cell datepick__cell--kosong'));
    }

    for (let d = 1; d <= jumlahHari; d++) {
      const tgl = new Date(bulan.getFullYear(), bulan.getMonth(), d);
      const dipilih = !!terpilih && terpilih.getTime() === tgl.getTime();
      const cell = buatEl('button', 'datepick__cell' + (dipilih ? ' is-selected' : ''));
      cell.type = 'button';
      cell.textContent = String(d);
      cell.disabled = tgl.getTime() < hariIni.getTime();
      cell.setAttribute('aria-label',
        tgl.toLocaleDateString(kalenderLocale(), { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }));
      if (dipilih) cell.setAttribute('aria-current', 'date');
      cell.addEventListener('click', (function (iso) {
        return function () { pilihTanggal(iso); };
      })(isoDariTanggal(tgl)));
      grid.appendChild(cell);
    }
  }

  function pilihTanggal(iso) {
    terapkanTanggal(iso);
    tutupPanel();
  }

  function perbaruiLabelTanggal() {
    const input = $('#tanggal');
    const nilai = $('#tanggal-value');
    const hapus = $('#tanggal-clear');
    const musim = $('#tanggal-musim');
    if (!input) return;
    const d = tanggalDariIso(input.value);
    if (nilai) {
      nilai.textContent = d ? formatTanggalPanjang(input.value) : t('plan.tanggalPilih');
    }
    if (hapus) hapus.hidden = !d;
    if (musim) {
      musim.hidden = !d;
      musim.textContent = d ? infoMusim(d) : '';
    }
    // Sinkron dengan input tanggal native (dipakai di layar kecil).
    const native = $('#tanggal-native');
    if (native) {
      native.min = isoHariIni();
      if (native.value !== (input.value || '')) native.value = input.value || '';
    }
  }

  /* Dropdown bulan & tahun (dibuat sekali, dipakai bersama). */
  let dropdownBulan = null;
  let dropdownTahun = null;

  function initKalender() {
    const tombol = $('#tanggal-picker');
    const panel = $('#tanggal-panel');
    const input = $('#tanggal');
    const hapus = $('#tanggal-clear');
    if (!tombol || !panel || !input) return;

    // Tombol "Tutup" untuk bottom sheet di layar kecil.
    if (!panel.querySelector('.picker__tutup')) {
      const tutup = document.createElement('button');
      tutup.type = 'button';
      tutup.className = 'picker__tutup';
      tutup.textContent = t('plan.tanggalTutup');
      tutup.addEventListener('click', function () {
        tutupPanel();
        tombol.focus();
      });
      panel.appendChild(tutup);
    }

    // Dropdown bulan.
    dropdownBulan = buatDropdownOpsi({
      labelAria: t('plan.tanggalPilihBulan'),
      opsi: function () {
        const bulan = kalenderBulanTampil();
        const now = new Date();
        const daftar = [];
        for (let m = 0; m < 12; m++) {
          // Bulan yang seluruhnya sudah lewat tidak bisa dipilih.
          const lewat = bulan.getFullYear() === now.getFullYear() && m < now.getMonth();
          daftar.push({
            nilai: m,
            teks: namaBulan(m),
            aktif: m === bulan.getMonth(),
            nonaktif: lewat
          });
        }
        return daftar;
      },
      pilih: function (m) {
        const b = kalenderBulanTampil();
        kalenderBulan = new Date(b.getFullYear(), m, 1);
        gambarKalender();
      }
    });

    // Dropdown tahun.
    dropdownTahun = buatDropdownOpsi({
      labelAria: t('plan.tanggalPilihTahun'),
      opsi: function () {
        const bulan = kalenderBulanTampil();
        const daftar = [];
        kalenderTahunOpsi().forEach(function (y) {
          daftar.push({
            nilai: y,
            teks: String(y),
            aktif: y === bulan.getFullYear(),
            nonaktif: false
          });
        });
        return daftar;
      },
      pilih: function (y) {
        const b = kalenderBulanTampil();
        kalenderBulan = new Date(y, b.getMonth(), 1);
        gambarKalender();
      }
    });

    pasangTombolPanel(tombol, 'tanggal-panel', function () {
      kalenderBulan = null;
      gambarKalender();
    });

    const prev = $('#tanggal-prev');
    const next = $('#tanggal-next');
    if (prev) {
      prev.addEventListener('click', function () {
        const b = kalenderBulanTampil();
        kalenderBulan = new Date(b.getFullYear(), b.getMonth() - 1, 1);
        gambarKalender();
      });
    }
    if (next) {
      next.addEventListener('click', function () {
        const b = kalenderBulanTampil();
        kalenderBulan = new Date(b.getFullYear(), b.getMonth() + 1, 1);
        gambarKalender();
      });
    }

    if (hapus) {
      hapus.addEventListener('click', function () {
        terapkanTanggal('');
        tutupPanel();
      });
    }

    // Input tanggal native (hanya dipakai di layar <640px).
    const native = $('#tanggal-native');
    if (native) {
      native.min = isoHariIni();
      native.value = input.value || '';
      native.addEventListener('change', function () {
        terapkanTanggal(native.value);
      });
    }

    perbaruiLabelTanggal();
  }

  /* ---------- 3. PICKER WILAYAH ---------- */

  const DAFTAR_WILAYAH = [
    {
      grup: 'plan.wilayahGrupTengah',
      zona: [
        { id: 'ubud', nama: 'Ubud', desc: 'plan.wilayahDescUbud' },
        { id: 'gianyar', nama: 'Gianyar', desc: 'plan.wilayahDescGianyar' },
        { id: 'klungkung', nama: 'Klungkung', desc: 'plan.wilayahDescKlungkung' },
        { id: 'bedugul', nama: 'Bedugul', desc: 'plan.wilayahDescBedugul' },
        { id: 'tabsan', nama: 'Tabanan', desc: 'plan.wilayahDescTabanan' }
      ]
    },
    {
      grup: 'plan.wilayahGrupSelatan',
      zona: [
        { id: 'kuta', nama: 'Kuta', desc: 'plan.wilayahDescKuta' },
        { id: 'seminyak', nama: 'Seminyak', desc: 'plan.wilayahDescSeminyak' },
        { id: 'canggu', nama: 'Canggu', desc: 'plan.wilayahDescCanggu' },
        { id: 'uluwatu', nama: 'Uluwatu', desc: 'plan.wilayahDescUluwatu' },
        { id: 'nusa-dua', nama: 'Nusa Dua', desc: 'plan.wilayahDescNusaDua' },
        { id: 'sanur', nama: 'Sanur', desc: 'plan.wilayahDescSanur' },
        { id: 'denpasar', nama: 'Denpasar', desc: 'plan.wilayahDescDenpasar' }
      ]
    },
    {
      grup: 'plan.wilayahGrupTimur',
      zona: [
        { id: 'nusa-penida', nama: 'Nusa Penida', desc: 'plan.wilayahDescNusaPenida' },
        { id: 'amed', nama: 'Amed', desc: 'plan.wilayahDescAmed' },
        { id: 'lovina', nama: 'Lovina', desc: 'plan.wilayahDescLovina' }
      ]
    }
  ];

  const IKON_WILAYAH = {
    ubud: 'M12 2a7 7 0 00-7 7c0 5 7 13 7 13s7-8 7-13a7 7 0 00-7-7zm0 9.5A2.5 2.5 0 1112 6.5a2.5 2.5 0 010 5z',
    gianyar: 'M12 2L2 7l10 5 8-4v6c0 1.7-3.6 3-8 3s-8-1.3-8-3V7l-2-1v12c0 3.3 4.5 5 10 5s10-1.7 10-5V6z',
    klungkung: 'M12 2a7 7 0 00-7 7c0 5 7 13 7 13s7-8 7-13a7 7 0 00-7-7zm0 9.5A2.5 2.5 0 1112 6.5a2.5 2.5 0 010 5z',
    bedugul: 'M12 2c-4 3-7 7-7 11a7 7 0 0014 0c0-4-3-8-7-11zm0 4c2.5 2.4 4.5 5 4.5 7a4.5 4.5 0 01-9 0c0-2 2-4.6 4.5-7z',
    tabsan: 'M4 18h16v2H4zm0-6h16v2H4zm0-6h16v2H4z',
    kuta: 'M2 18c2-4 4-6 7-6s5 2 7 6M8 12a3 3 0 106 0 3 3 0 00-6 0',
    seminyak: 'M12 3a9 9 0 109 9 9 9 0 00-9-9zm0 2a7 7 0 100 14A7 7 0 0012 5z',
    canggu: 'M3 17c1.5-3 3.5-4.5 6-4.5S13.5 14 15 17M4 20h16',
    uluwatu: 'M3 20h18L12 4z',
    'nusa-dua': 'M12 3l3 6 6 1-4.5 4.5L18 21l-6-3-6 3 1.5-6.5L3 10l6-1z',
    sanur: 'M4 18c3-5 6-7 8-7s5 2 8 7M4 21h16',
    denpasar: 'M4 21V9l8-6 8 6v12M9 21v-6h6v6',
    'nusa-penida': 'M4 20l6-12 4 7 3-5 3 10z',
    amed: 'M3 17c2-3 4-4 6-4s4 1 6 4M12 9a2 2 0 100-4 2 2 0 000 4z',
    lovina: 'M2 16c2-3 3-4 5-4s4 1 6 4M15 8a3 3 0 103 3 3 3 0 00-3-3'
  };

  function cariZona(id) {
    let ketemu = null;
    DAFTAR_WILAYAH.forEach(function (grup) {
      grup.zona.forEach(function (z) {
        if (z.id === id) ketemu = z;
      });
    });
    return ketemu;
  }

  function gambarWilayah(kunci) {
    const daftar = $('#wilayah-list');
    const input = $('#wilayah-awal');
    if (!daftar || !input) return;

    const saring = String(kunci || '').toLowerCase().trim();
    daftar.textContent = '';
    let jumlah = 0;

    DAFTAR_WILAYAH.forEach(function (grup) {
      const cocok = grup.zona.filter(function (z) {
        if (!saring) return true;
        return z.nama.toLowerCase().indexOf(saring) >= 0 ||
          t(z.desc).toLowerCase().indexOf(saring) >= 0;
      });
      if (!cocok.length) return;
      jumlah += cocok.length;

      daftar.appendChild(buatEl('p', 'picker__group', t(grup.grup)));

      cocok.forEach(function (z) {
        const dipilih = input.value === z.id;
        const item = buatEl('button', 'picker__item' + (dipilih ? ' is-active' : ''));
        item.type = 'button';
        item.setAttribute('role', 'option');
        item.setAttribute('aria-selected', dipilih ? 'true' : 'false');
        item.setAttribute('data-wilayah', z.id);

        const ikon = buatEl('span', 'picker__item-icon');
        ikon.setAttribute('aria-hidden', 'true');
        ikon.insertAdjacentHTML('afterbegin',
          '<svg viewBox="0 0 24 24" width="15" height="15"><path d="' +
          (IKON_WILAYAH[z.id] || IKON_WILAYAH.ubud) + '" fill="currentColor"/></svg>');
        item.appendChild(ikon);

        const isi = buatEl('span', 'picker__item-body');
        isi.appendChild(buatEl('strong', 'picker__item-name', z.nama));
        isi.appendChild(buatEl('span', 'picker__item-desc', t(z.desc)));
        item.appendChild(isi);

        if (dipilih) {
          const cek = buatEl('span', 'picker__item-check', '\u2713');
          cek.setAttribute('aria-hidden', 'true');
          item.appendChild(cek);
        }

        item.addEventListener('click', function () { pilihWilayah(z.id); });
        daftar.appendChild(item);
      });
    });

    if (!jumlah) {
      daftar.appendChild(buatEl('p', 'picker__empty', t('plan.wilayahCariKosong')));
    }
  }

  function pilihWilayah(id) {
    terapkanWilayah(id);
    tutupPanel();
  }

  function initWilayah() {
    const tombol = $('#wilayah-picker');
    const input = $('#wilayah-awal');
    const cari = $('#wilayah-search');
    const panel = $('#wilayah-panel');
    if (!tombol || !input) return;

    // Tombol "Tutup" untuk bottom sheet di layar kecil.
    if (panel && !panel.querySelector('.picker__tutup')) {
      const tutup = document.createElement('button');
      tutup.type = 'button';
      tutup.className = 'picker__tutup';
      tutup.textContent = t('plan.tanggalTutup');
      tutup.addEventListener('click', function () {
        tutupPanel();
        tombol.focus();
      });
      panel.appendChild(tutup);
    }

    pasangTombolPanel(tombol, 'wilayah-panel', function () {
      if (cari) cari.value = '';
      gambarWilayah('');
      // Tanpa auto-focus: di layar sentuh keyboard yang muncul otomatis
      // menggeser panel dan membuat daftar sulit dipilih. Keyboard hanya
      // muncul bila pengguna mengetuk kolom pencarian sendiri.
    });

    if (cari) {
      cari.addEventListener('input', function () {
        gambarWilayah(cari.value);
      });
      cari.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') {
          tutupPanel();
          tombol.focus();
        }
      });
    }

    const nilai = $('#wilayah-value');
    const z = cariZona(input.value);
    if (nilai) nilai.textContent = z ? z.nama : input.value;

    // <select> native (hanya dipakai di layar <640px).
    const native = $('#wilayah-native');
    if (native) {
      gambarWilayahNative();
      native.addEventListener('change', function () {
        if (native.value) terapkanWilayah(native.value);
      });
    }
  }

  /* ---------- 4. MODE NATIVE (LAYAR <640px) ---------- */

  /* true bila layar kecil: pakai <select> & <input type="date"> bawaan. */
  const mediaNative = window.matchMedia('(max-width: 639px)');

  function modeNative() {
    return mediaNative.matches;
  }

  /** Hapus latar gelap dari DOM sepenuhnya (tidak ada overlay tersisa). */
  function hapusBackdrop() {
    if (!backdropKalender) return;
    if (backdropKalender.parentNode) backdropKalender.parentNode.removeChild(backdropKalender);
    backdropKalender = null;
  }

  /** ISO hari ini (YYYY-MM-DD) untuk atribut min. */
  function isoHariIni() {
    const now = new Date();
    const bulan = String(now.getMonth() + 1).padStart(2, '0');
    const hari = String(now.getDate()).padStart(2, '0');
    return now.getFullYear() + '-' + bulan + '-' + hari;
  }

  /** Bangun <select> wilayah native dengan <optgroup> per wilayah. */
  function gambarWilayahNative() {
    const select = $('#wilayah-native');
    if (!select) return;
    const hidden = $('#wilayah-awal');
    const nilai = hidden ? hidden.value : 'ubud';
    select.textContent = '';
    DAFTAR_WILAYAH.forEach(function (grup) {
      const og = document.createElement('optgroup');
      og.label = t(grup.grup);
      grup.zona.forEach(function (z) {
        const opt = document.createElement('option');
        opt.value = z.id;
        opt.textContent = z.nama;
        if (z.id === nilai) opt.selected = true;
        og.appendChild(opt);
      });
      select.appendChild(og);
    });
    select.value = nilai;
  }

  /** Terapkan nilai wilayah ke input tersembunyi + select native. */
  function terapkanWilayah(id) {
    const input = $('#wilayah-awal');
    const nilai = $('#wilayah-value');
    if (!input) return;
    input.value = id;
    // Beri tahu komponen lain (mis. membersihkan titik di peta).
    input.dispatchEvent(new Event('change', { bubbles: true }));
    const z = cariZona(id);
    if (nilai) nilai.textContent = z ? z.nama : id;
    const native = $('#wilayah-native');
    if (native && native.value !== id) native.value = id;
    gambarWilayah('');
  }

  /** Terapkan tanggal ke input tersembunyi + input native. */
  function terapkanTanggal(iso) {
    const input = $('#tanggal');
    if (!input) return;
    input.value = iso || '';
    perbaruiLabelTanggal();
  }

  /** Terapkan mode sesuai lebar layar (native vs picker custom). */
  function terapkanModeForm() {
    if (modeNative()) {
      // Panel custom ditutup & latar gelap dihapus total dari DOM.
      if (panelTerbuka.id) tutupPanel();
      hapusBackdrop();
    }
    const sel = $('#wilayah-native');
    const hidden = $('#wilayah-awal');
    if (sel && hidden) sel.value = hidden.value;
    const tgl = $('#tanggal-native');
    const tglHidden = $('#tanggal');
    if (tgl) {
      tgl.min = isoHariIni();
      if (tglHidden) tgl.value = tglHidden.value || '';
    }
  }

  /** Dengarkan perubahan lebar layar (resize / rotasi). */
  function dengarkanModeForm() {
    const jalankan = function () { terapkanModeForm(); };
    if (typeof mediaNative.addEventListener === 'function') {
      mediaNative.addEventListener('change', jalankan);
    } else if (typeof mediaNative.addListener === 'function') {
      mediaNative.addListener(jalankan);
    }
    // Cadangan: beberapa browser tidak memicu event "change" matchMedia.
    window.addEventListener('resize', jalankan);
    terapkanModeForm();
  }

  /* =====================================================================
     J. EVENT & INISIALISASI
     ===================================================================== */
  function init() {
    /* --- Bahasa: pakai tersimpan, default Bahasa Indonesia --- */
    const tersimpan = bacaBahasa();
    state.bahasa = tersimpan || 'id';
    terjemahkanUI();
    $$('.lang-toggle__btn').forEach((btn) => {
      const aktif = btn.getAttribute('data-lang') === state.bahasa;
      btn.classList.toggle('is-active', aktif);
      btn.setAttribute('aria-pressed', aktif ? 'true' : 'false');
    });

    /* --- Toggle bahasa --- */
    $$('.lang-toggle__btn').forEach((btn) => {
      btn.addEventListener('click', () => setBahasa(btn.getAttribute('data-lang')));
    });

    /* --- Form rencana --- */
    const form = $('#plan-form');
    if (form) {
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        buatItinerary();
      });
    }

    /* --- Penghitung karakter catatan --- */
    const catatan = $('#catatan');
    const catatanCount = $('#catatan-count');
    if (catatan && catatanCount) {
      catatan.addEventListener('input', () => { catatanCount.textContent = String(catatan.value.length); });
    }

    /* --- Chat --- */
    const chatForm = $('#chat-form');
    const chatInput = $('#chat-input');
    const chatCount = $('#chat-count');
    if (chatForm && chatInput) {
      chatForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const teks = chatInput.value;
        chatInput.value = '';
        if (chatCount) chatCount.textContent = '0';
        kirimPesan(teks);
      });
      chatInput.addEventListener('input', () => {
        if (chatCount) chatCount.textContent = String(chatInput.value.length);
      });
    }

    /* --- Saran cepat di section chat --- */
    $$('.suggestion').forEach((btn) => {
      btn.addEventListener('click', () => {
        const teks = btn.getAttribute('data-teks') || btn.textContent.trim();
        kirimPesan(teks);
      });
    });

    /* --- Tombol buat ulang (perubahan bahasa) --- */
    const regen = $('#regenerate-btn');
    if (regen) regen.addEventListener('click', () => {
      if (!state.preferensi) return;
      state.bahasaItinerary = state.bahasa;
      buatItinerary();
    });


    /* --- Stepper jumlah traveler --- */
    $$('[data-stepper]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        const jenis = btn.getAttribute('data-stepper');
        const langkah = Number(btn.getAttribute('data-step')) || 0;
        const input = $('#traveler-' + jenis + '-input');
        const output = $('#traveler-' + jenis);
        if (!input || !output) return;

        const minimum = jenis === 'anak' ? 0 : 1;
        const maksimum = jenis === 'anak' ? 10 : 20;
        let nilai = Math.max(minimum, Math.min(maksimum, (Number(input.value) || 0) + langkah));
        input.value = String(nilai);
        output.textContent = String(nilai);
      });
    });

    /* --- Komponen "Titik awal" (3 cara: daftar, pencarian, peta) --- */
    if (window.GriskaTitikAwal) {
      window.GriskaTitikAwal.init(null, function () {
        state.titikAwal = window.GriskaTitikAwal.getTitik();
      });
    }

    /* --- Pulihkan state dari rencana tersimpan (bila ada) --- */
    const tersimpanRencana = bacaTersimpan();
    if (tersimpanRencana && tersimpanRencana.preferensi) {
      pulihkanStateForm(tersimpanRencana.preferensi);
    }

    /* --- Baris "Lainnya" (durasi, transport, akomodasi) --- */
    const sinkronBarisLainnya = function () {
      const pairs = [
        ['durasi', '#durasi-baris'],
        ['transport', '#transport-baris'],
        ['akomodasi', '#akomodasi-baris']
      ];
      pairs.forEach(function (p) {
        const radios = $$('input[name="' + p[0] + '"]');
        let radio = null;
        radios.forEach(function (el) { if (el.checked) radio = el; });
        const baris = $(p[1]);
        if (!baris) return;
        const aktif = !!radio && radio.value === 'lainnya';
        baris.hidden = !aktif;
      });
    };
    $$('input[name="durasi"], input[name="transport"], input[name="akomodasi"]').forEach(function (el) {
      el.addEventListener('change', sinkronBarisLainnya);
    });
    sinkronBarisLainnya();

    /* --- Input minat bebas + chip --- */
    const inputBebas = $('#minat-bebas');
    const tombolBebas = $('#minat-bebas-add');
    const counterBebas = $('#minat-bebas-count');
    if (inputBebas && counterBebas) {
      inputBebas.addEventListener('input', function () {
        counterBebas.textContent = String(inputBebas.value.length);
      });
    }
    const tambahBebas = function () {
      if (!inputBebas) return;
      if (tambahMinatBebas(inputBebas.value)) {
        inputBebas.value = '';
        if (counterBebas) counterBebas.textContent = '0';
        tampilkanError(null);
      }
    };
    if (tombolBebas) tombolBebas.addEventListener('click', tambahBebas);
    if (inputBebas) {
      inputBebas.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') {
          e.preventDefault();
          tambahBebas();
        }
      });
    }
    gambarChipMinatBebas();

    /* --- Minat tambahan: beach club (chip dibuat dari JS) --- */
    tambahChipBeachClub();

    /* --- Komponen form: budget maks, kalender, picker wilayah --- */
    initBudgetMaks();
    initKalender();
    initWilayah();

    /* --- Mode native (<640px): select wilayah + input tanggal --- */
    dengarkanModeForm();

    /* --- Panel (wilayah & tanggal): tutup dengan Esc. Penutupan saat
       klik di luar dipasang dinamis saat panel terbuka (pasangKlikLuar). --- */
    document.addEventListener('keydown', function (e) {
      if (e.key !== 'Escape' || !panelTerbuka.id) return;
      const tombol = $('#' + panelTerbuka.id.replace('-panel', '-picker'));
      tutupPanel();
      if (tombol) tombol.focus();
    });

    /* --- Akomodasi mengikuti level budget --- */
    const sinkronAkomodasi = function () {
      const budget = $('input[name="budget"]:checked');
      if (!budget) return;
      const rewrite = budget.value === 'hemat' ? 'hostel' : (budget.value === 'mewah' ? 'villa' : 'hotel');
      const target = $('input[name="akomodasi"][value="' + rewrite + '"]');
      const sekarang = $('input[name="akomodasi"]:checked');
      if (!target || !sekarang) return;
      // Hanya mengubah bila pengguna belum memilih manual.
      if (sekarang.dataset.manual === '1') return;
      target.checked = true;
    };
    $$('input[name="budget"]').forEach(function (el) {
      el.addEventListener('change', sinkronAkomodasi);
    });
    $$('input[name="akomodasi"]').forEach(function (el) {
      el.addEventListener('change', function () { el.dataset.manual = '1'; });
    });
    sinkronAkomodasi();

    /* --- Tombol "Lewati narasi AI" (di dalam loading state) --- */
    document.addEventListener('click', function (e) {
      const btn = e.target.closest ? e.target.closest('[data-action="skip-narasi"]') : null;
      if (btn) lewatiNarasiAI();
    });

    /* --- Tombol "Buat ulang" pada hasil itinerary --- */
    document.addEventListener('griska-go:buat-ulang', function () {
      if (state.preferensi) buatItinerary();
    });

    /* --- Log ke console untuk kebutuhan demo/presentasi --- */
    console.log('%cGriska Go', 'color:#0A3D62;font-size:18px;font-weight:800', '- Perencana itinerary Bali berbasis AI (NAISC 2026)');
  }

  /* =====================================================================
     K. STATE PLAN & PENYIMPANAN
     ===================================================================== */

  /**
   * Memulihkan state form dari rencana yang tersimpan.
   * Dipakai supaya "Simpan rencana" benar-benar berguna: titik awal,
   * minat bebas, dan biaya "lainnya" ikut kembali.
   */
  function pulihkanStateForm(pref) {
    if (!pref) return;

    // Minat (kategori + preset).
    if (Array.isArray(pref.minat)) {
      $$('input[name="minat"]').forEach(function (el) {
        el.checked = pref.minat.indexOf(el.value) >= 0;
      });
    }

    // Minat bebas -> chip.
    if (Array.isArray(pref.minatTeks)) {
      state.minatBebas = pref.minatTeks.slice(0, 5);
      gambarChipMinatBebas();
    }

    // Titik awal.
    if (pref.titikAwal && window.GriskaTitikAwal) {
      window.GriskaTitikAwal.setTitik(pref.titikAwal);
      state.titikAwal = window.GriskaTitikAwal.getTitik();
    }

    // Opsi "lainnya" + biayanya.
    if (pref.transport) {
      const t = $('input[name="transport"][value="' + pref.transport + '"]');
      if (t) { t.checked = true; t.dispatchEvent(new Event('change', { bubbles: true })); }
    }
    if (pref.akomodasi) {
      const a = $('input[name="akomodasi"][value="' + pref.akomodasi + '"]');
      if (a) { a.checked = true; a.dispatchEvent(new Event('change', { bubbles: true })); }
    }
    if (pref.biayaTransportHarian) {
      const b = $('#biaya-transport');
      if (b) b.value = String(pref.biayaTransportHarian);
    }
    if (pref.biayaAkomodasiMalam) {
      const c = $('#biaya-akomodasi');
      if (c) c.value = String(pref.biayaAkomodasiMalam);
    }

    // Durasi (termasuk opsi "lainnya").
    if (pref.durasi) {
      const lainnya = $('input[name="durasi"][value="lainnya"]');
      if (lainnya && pref.durasi > 7) {
        lainnya.checked = true;
        lainnya.dispatchEvent(new Event('change', { bubbles: true }));
        const dj = $('#durasi-jumlah');
        if (dj) dj.value = String(pref.durasi);
      } else {
        const d = $('input[name="durasi"][value="' + pref.durasi + '"]');
        if (d) { d.checked = true; d.dispatchEvent(new Event('change', { bubbles: true })); }
      }
    }

    // Traveler.
    const dd = $('#traveler-dewasa-input');
    const da = $('#traveler-anak-input');
    if (dd && pref.traveler) dd.value = String(pref.traveler.dewasa || 2);
    if (da && pref.traveler) da.value = String(pref.traveler.anak || 0);
  }

  /** Membaca rencana tersimpan dari localStorage (jika ada). */
  function bacaTersimpan() {
    try {
      const raw = window.localStorage.getItem('griska-go.rencana');
      return raw ? JSON.parse(raw) : null;
    } catch (e) { return null; }
  }

  /* Jaga-jaga agar state bisa dibaca modul lain (mis. "Simpan rencana"). */
  window.GriskaApp = {
    getMeta: function () { return state.metaRencana || null; },
    getPreferensi: function () { return state.preferensi; },
    pulihkanStateForm: pulihkanStateForm,
    bacaTersimpan: bacaTersimpan
  };

  // Jalankan setelah DOM siap.
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
