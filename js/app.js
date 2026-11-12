/**
 * ============================================================================
 *  BALIWISE - js/app.js
 * ----------------------------------------------------------------------------
 *  Seluruh logika antarmuka:
 *   1. Multi bahasa (Indonesia / English) + teks AI mengikuti bahasa.
 *   2. Validasi form preferensi.
 *   3. Panggilan API + loading state + penanganan error yang ramah.
 *   4. Render itinerary per hari dalam bentuk kartu timeline.
 *   5. Chat lanjutan yang mengingat itinerary.
 * ============================================================================
 */

(function () {
  'use strict';

  /* =====================================================================
     A. KAMUS BAHASA (i18n)
     ===================================================================== */
  const i18n = {
    id: {
      'skip': 'Langsung ke form rencana',
      'nav.how': 'Cara Kerja',
      'nav.features': 'Fitur',
      'nav.planner': 'Rencanakan',
      'nav.result': 'Hasil Rencana',
      'nav.cta': 'Mulai Rencanakan',

      'hero.pill': 'Powered by AI · Guide budaya otomatis',
      'hero.title': 'Rencanakan Liburan Bali, Tanpa Lagi Bingung.',
      'hero.desc': 'BaliWise menyusun itinerary harian sesuai durasi, budget, dan minat Anda — lengkap dengan tips budaya & etika di setiap lokasi, supaya Anda tidak salah adat.',
      'hero.cta1': 'Mulai Rencanakan',
      'hero.cta2': 'Lihat Cara Kerja',
      'hero.stat1': 'Destinasi terverifikasi',
      'hero.stat2': 'Bahasa (ID & EN)',
      'hero.stat3': 'Hari itinerary',
      'hero.cardTag': 'Rekomendasi AI',
      'hero.cardTitle': 'Uluwatu · Sunset & Tari Kechak',
      'hero.badge': 'Tips etika per lokasi',

      'problem.eyebrow': 'The Problem',
      'problem.title': 'Wisatawan bingung merencanakan perjalanan di Bali',
      'problem.p1.title': 'Ribuan tempat, waktu terbatas',
      'problem.p1.text': 'Bali punya ratusan atraksi. Pengunjung sering kehabisan waktu di jalan atau keliling bolak-balik tanpa rencana.',
      'problem.p2.title': 'Budget meleset di tengah jalan',
      'problem.p2.text': 'Tanpa estimasi biaya per hari, pengeluaran membengkak karena transportasi, tiket, dan makan sering di luar dugaan.',
      'problem.p3.title': 'Tidak paham adat & etika lokal',
      'problem.p3.text': 'Banyak tourists tidak tahu aturan beribadah, dress code di pura, hingga cara terima kasih di Bali agar tidak membuat warga lokal tersinggung.',

      'how.eyebrow': 'How It Works',
      'how.title': 'Tiga langkah, rencana siap pakai',
      'how.s1.title': 'Isi preferensi',
      'how.s1.text': 'Pilih durasi, budget, minat, gaya perjalanan, dan wilayah awal. Cukup 30 detik.',
      'how.s2.title': 'AI menyusun itinerary',
      'how.s2.text': 'AI memilih tempat nyata dari katalog 28 destinasi, menghitung biaya, dan menambahkan tips etika per lokasi.',
      'how.s3.title': 'Tanya & ubah bebas',
      'how.s3.text': 'Chat lanjutan mengingat rencana Anda. Minta ubah hari, tambah tempat, atau sesuaikan budget kapan saja.',

      'feat.eyebrow': 'Fitur Utama',
      'feat.title': 'Dibuat untuk traveler, bukan untuk agent',
      'feat.f1.title': 'Grounded, bukan karangan',
      'feat.f1.text': 'AI dibatasi hanya boleh merekomendasikan tempat dari data/destinasi.json. Tempat yang tidak dikenal otomatis dibuang.',
      'feat.f2.title': 'Tips budaya di tiap lokasi',
      'feat.f2.text': 'Setiap kartu memuat etika spesifik: pakai sarong, alur beribadah, aturan snorkeling, hingga cara menawar di pasar.',
      'feat.f3.title': 'Estimasi biaya transparan',
      'feat.f3.text': 'Rincian biaya per kegiatan dan total harian, siap dibandingkan dengan budget yang Anda tetapkan.',
      'feat.f4.title': 'Timeline visual',
      'feat.f4.text': 'Rencana ditampilkan sebagai kartu per hari dengan jam, tempat, aktivitas, biaya, dan tips — mudah dipindai.',
      'feat.f5.title': 'Chat yang mengingat',
      'feat.f5.text': 'AI menyimpan konteks itinerary selama percakapan, jadi permintaan "ganti hari 2 jadi lebih santai" langsung dieksekusi.',
      'feat.f6.title': 'Bilingual penuh',
      'feat.f6.text': 'Antarmuka dan hasil AI mengikuti pilihan bahasa: Bahasa Indonesia atau English, tanpa kehilangan isi.',

      'plan.title': 'Susun Rencana Liburan Anda',
      'plan.desc': 'Isi preferensi di samping. AI akan menyusun rencana per hari lengkap dengan jam, aktivitas, estimasi biaya, dan tips budaya.',
      'plan.note1': '28 destinasi nyata Bali (bukan hasil karangan AI)',
      'plan.note2': 'Tips adat & etika untuk setiap lokasi',
      'plan.note3': 'Bisa chatting untuk revisi kapan saja',
      'plan.durasi': 'Durasi perjalanan',
      'plan.durasiHint': 'Pilih jumlah hari (1-7 hari).',
      'plan.budget': 'Budget',
      'plan.b1': 'Hemat',
      'plan.b2': 'Menengah',
      'plan.b3': 'Mewah',
      'plan.minat': 'Minat perjalanan',
      'plan.minatReq': '(pilih minimal 1)',
      'plan.m1': 'Pantai',
      'plan.m2': 'Budaya',
      'plan.m3': 'Kuliner',
      'plan.m4': 'Alam',
      'plan.m5': 'Belanja',
      'plan.gaya': 'Gaya perjalanan',
      'plan.g1': 'Santai',
      'plan.g2': 'Padat',
      'plan.wilayah': 'Wilayah awal',
      'plan.catatan': 'Catatan tambahan',
      'plan.optional': '(opsional)',
      'plan.submit': 'Susun Itinerary dengan AI',
      'plan.submitBusy': 'AI sedang menyusun rencana...',
      'plan.disclaimer': 'Rencana ini adalah saran. Selalu konfirmasi harga, jam buka, dan aturan terbaru ke sumber resmi.',
      'plan.errDurasi': 'Pilih durasi perjalanan (1-7 hari).',
      'plan.errMinat': 'Pilih minimal satu minat perjalanan.',
      'plan.errWilayah': 'Pilih wilayah awal.',

      'res.eyebrow': 'Your Itinerary',
      'res.title': 'Rencana Perjalanan Anda',
      'res.days': 'Hari',
      'res.places': 'Tempat',
      'res.total': 'Estimasi Total',
      'res.emptyTitle': 'Belum ada rencana',
      'res.emptyText': 'Isi preferensi di atas, lalu tekan "Susun Itinerary dengan AI". Rencana per hari beserta tips budaya akan muncul di sini.',
      'res.regenerate': 'Buat ulang dalam {lang}',
      'res.changed': 'Itinerary diperbarui oleh AI.',

      'chat.title': 'Tanya atau Ubah Rencana',
      'chat.desc': 'AI mengingat itinerary Anda. Contoh: "ganti hari 2 jadi lebih santai", "tambah aktivitas snorkeling", "turunkan budget jadi hemat".',
      'chat.s1': 'Ganti hari 2 jadi lebih santai',
      'chat.s2': 'Turunkan budget jadi hemat',
      'chat.s3': 'Tambahkan aktivitas belanja di hari 3',
      'chat.status': 'Siap membantu',
      'chat.statusBusy': 'Sedang thinking...',
      'chat.label': 'Tulis pesan',
      'chat.placeholder': 'Tulis permintaan Anda (maks 300 karakter)',
      'chat.empty': 'Contoh: "Tambahkan sunset di Pantai Seminyak di hari 1".',
      'chat.send': 'Kirim',
      'chat.errEmpty': 'Tulis pesan terlebih dahulu.',
      'chat.errLong': 'Pesan maksimal 300 karakter.',
      'chat.rebuild': 'Itinerary sudah diperbarui di atas.',
      'chat.you': 'Anda',
      'chat.ai': 'BaliWise AI',

      'cta.title': 'Siang mulai liburan dengan lebih tenang?',
      'cta.desc': 'Buat rencana Anda dalam satu menit — lengkap dengan panduan budaya yang membuat Anda dihormati oleh warga lokal.',
      'cta.btn': 'Mulai Rencanakan Gratis',

      'footer.desc': 'Perencana itinerary Bali berbasis AI dengan panduan budaya & etika di setiap lokasi.',
      'footer.navTitle': 'Navigasi',
      'footer.techTitle': 'Teknologi',
      'footer.note': 'Dibuat oleh pelajar SMA/SMK untuk kompetisi NAISC 2026 · Kategori Website.',

      /* --- teks dinamis (dibuat lewat JS) --- */
      'load.title': 'AI sedang menyusun rencana...',
      'load.hint': 'Menganalisis preferensi Anda, memilih destinasi yang sesuai, dan menghitung estimasi biaya.',
      'load.step1': 'Menentukan hari & budget',
      'load.step2': 'Memilih destinasi nyata',
      'load.step3': 'Menambahkan tips budaya',
      'day.label': 'Hari {n}',
      'stop.tips': 'Tips Budaya & Etika',
      'stop.transport': 'Transportasi',
      'stop.duration': 'Durasi',
      'stop.free': 'Gratis',
      'stop.min': 'mnt',
      'kategori.pantai': 'Pantai',
      'kategori.budaya': 'Budaya',
      'kategori.kuliner': 'Kuliner',
      'kategori.alam': 'Alam',
      'kategori.belanja': 'Belanja',
      'err.title': 'Terjadi masalah',
      'err.default': 'Terjadi kesalahan, silakan coba lagi.',
      'err.raw': 'Lihat jawaban mentah dari AI',
      'plan.retry': 'Coba Lagi'
    },

    en: {
      'skip': 'Skip to the planner form',
      'nav.how': 'How It Works',
      'nav.features': 'Features',
      'nav.planner': 'Planner',
      'nav.result': 'My Itinerary',
      'nav.cta': 'Start Planning',

      'hero.pill': 'Powered by AI · Automatic culture guide',
      'hero.title': 'Plan Your Bali Trip, Without the Guesswork.',
      'hero.desc': 'BaliWise builds a day-by-day itinerary that matches your duration, budget, and interests — complete with cultural and etiquette tips for every single location, so you never offend a local.',
      'hero.cta1': 'Start Planning',
      'hero.cta2': 'See How It Works',
      'hero.stat1': 'Verified destinations',
      'hero.stat2': 'Languages (ID & EN)',
      'hero.stat3': 'Itinerary days',
      'hero.cardTag': 'AI pick',
      'hero.cardTitle': 'Uluwatu · Sunset & Kechak Dance',
      'hero.badge': 'Etiquette tips per location',

      'problem.eyebrow': 'The Problem',
      'problem.title': 'Travellers struggle to plan a Bali trip',
      'problem.p1.title': 'Endless places, limited time',
      'problem.p1.text': 'Bali has hundreds of attractions. Travellers often waste time on the road or criss-cross the island with no clear plan.',
      'problem.p2.title': 'Budget overruns mid-trip',
      'problem.p2.text': 'Without a daily cost estimate, transport, tickets, and food expenses regularly exceed expectations.',
      'problem.p3.title': 'Unaware of local customs',
      'problem.p3.text': 'Many tourists do not know temple dress codes, worship etiquette, or how to say thank you in Bali without upsetting locals.',

      'how.eyebrow': 'How It Works',
      'how.title': 'Three steps to a ready-to-use plan',
      'how.s1.title': 'Set your preferences',
      'how.s1.text': 'Pick duration, budget, interests, travel style, and starting area. It only takes 30 seconds.',
      'how.s2.title': 'AI builds the itinerary',
      'how.s2.text': 'The AI picks real places from a catalogue of 28 destinations, calculates costs, and adds etiquette tips for each stop.',
      'how.s3.title': 'Ask and refine freely',
      'how.s3.text': 'The follow-up chat remembers your plan. Ask to change a day, add a place, or adjust the budget any time.',

      'feat.eyebrow': 'Key Features',
      'feat.title': 'Built for travellers, not travel agents',
      'feat.f1.title': 'Grounded, never invented',
      'feat.f1.text': 'The AI may only recommend places listed in data/destinasi.json. Unknown locations are filtered out automatically.',
      'feat.f2.title': 'Culture tips at every stop',
      'feat.f2.text': 'Each card carries specific etiquette: wear a sarong, follow worship flow, snorkeling rules, and how to bargain at markets.',
      'feat.f3.title': 'Transparent cost estimates',
      'feat.f3.text': 'Per-activity cost and daily totals, ready to compare against the budget you set.',
      'feat.f4.title': 'Visual timeline',
      'feat.f4.text': 'The plan is shown as cards per day with time, place, activity, cost, and tips — easy to skim.',
      'feat.f5.title': 'A chat that remembers',
      'feat.f5.text': 'The AI keeps the itinerary in context, so "make day 2 more relaxed" is executed immediately.',
      'feat.f6.title': 'Fully bilingual',
      'feat.f6.text': 'Both the interface and the AI output follow your language choice: Indonesian or English, with nothing lost.',

      'plan.title': 'Build Your Travel Plan',
      'plan.desc': 'Fill in the preferences. The AI will produce a per-day plan with times, activities, cost estimates, and culture tips.',
      'plan.note1': '28 real Bali destinations (not AI inventions)',
      'plan.note2': 'Customs and etiquette for every location',
      'plan.note3': 'Chat with the AI to revise it any time',
      'plan.durasi': 'Trip duration',
      'plan.durasiHint': 'Choose the number of days (1-7).',
      'plan.budget': 'Budget',
      'plan.b1': 'Budget',
      'plan.b2': 'Mid-range',
      'plan.b3': 'Luxury',
      'plan.minat': 'Travel interests',
      'plan.minatReq': '(pick at least 1)',
      'plan.m1': 'Beaches',
      'plan.m2': 'Culture',
      'plan.m3': 'Food',
      'plan.m4': 'Nature',
      'plan.m5': 'Shopping',
      'plan.gaya': 'Travel style',
      'plan.g1': 'Relaxed',
      'plan.g2': 'Packed',
      'plan.wilayah': 'Starting area',
      'plan.catatan': 'Extra notes',
      'plan.optional': '(optional)',
      'plan.submit': 'Build My Itinerary with AI',
      'plan.submitBusy': 'AI is building your plan...',
      'plan.disclaimer': 'This plan is a suggestion. Always confirm prices, opening hours, and current rules with official sources.',
      'plan.errDurasi': 'Please pick a trip duration (1-7 days).',
      'plan.errMinat': 'Please pick at least one travel interest.',
      'plan.errWilayah': 'Please pick a starting area.',

      'res.eyebrow': 'Your Itinerary',
      'res.title': 'Your Travel Plan',
      'res.days': 'Days',
      'res.places': 'Places',
      'res.total': 'Estimated Total',
      'res.emptyTitle': 'No plan yet',
      'res.emptyText': 'Fill in your preferences above, then press "Build My Itinerary with AI". Your day-by-day plan with culture tips will appear here.',
      'res.regenerate': 'Rebuild in {lang}',
      'res.changed': 'The AI updated your itinerary.',

      'chat.title': 'Ask or Edit the Plan',
      'chat.desc': 'The AI remembers your itinerary. For example: "make day 2 more relaxed", "add a snorkeling activity", "switch to a budget plan".',
      'chat.s1': 'Make day 2 more relaxed',
      'chat.s2': 'Switch to a budget plan',
      'chat.s3': 'Add a shopping stop on day 3',
      'chat.status': 'Ready to help',
      'chat.statusBusy': 'Thinking...',
      'chat.label': 'Type your message',
      'chat.placeholder': 'Type your request (max 300 characters)',
      'chat.empty': 'Example: "add a sunset at Seminyak Beach on day 1".',
      'chat.send': 'Send',
      'chat.errEmpty': 'Please type a message first.',
      'chat.errLong': 'Messages are limited to 300 characters.',
      'chat.rebuild': 'The itinerary above has been updated.',
      'chat.you': 'You',
      'chat.ai': 'BaliWise AI',

      'cta.title': 'Ready to travel with more peace of mind?',
      'cta.desc': 'Build your plan in one minute — complete with a culture guide that makes you respected by locals.',
      'cta.btn': 'Start Planning Free',

      'footer.desc': 'An AI-powered Bali itinerary planner with cultural and etiquette guidance for every location.',
      'footer.navTitle': 'Navigation',
      'footer.techTitle': 'Technology',
      'footer.note': 'Built by high school students for the NAISC 2026 competition - Website category.',

      'load.title': 'AI is building your plan...',
      'load.hint': 'Analysing your preferences, selecting matching destinations, and calculating cost estimates.',
      'load.step1': 'Setting days and budget',
      'load.step2': 'Picking real destinations',
      'load.step3': 'Adding culture tips',
      'day.label': 'Day {n}',
      'stop.tips': 'Cultural & Etiquette Tips',
      'stop.transport': 'Getting there',
      'stop.duration': 'Duration',
      'stop.free': 'Free',
      'stop.min': 'min',
      'kategori.pantai': 'Beach',
      'kategori.budaya': 'Culture',
      'kategori.kuliner': 'Food',
      'kategori.alam': 'Nature',
      'kategori.belanja': 'Shopping',
      'err.title': 'Something went wrong',
      'err.default': 'Something went wrong. Please try again.',
      'err.raw': 'View the raw AI response',
      'plan.retry': 'Try Again'
    }
  };

  /* =====================================================================
     B. STATE APLIKASI
     ===================================================================== */
  const state = {
    bahasa: 'id',
    bahasaItinerary: 'id',   // bahasa saat itinerary dibuat
    itinerary: null,          // itinerary yang sedang tampil
    preferensi: null,         // preferensi terakhir (untuk membuat ulang)
    chatHistory: [],          // [{ role: 'user'|'assistant', text }]
    sedangProses: false
  };

  /* =====================================================================
     C. UTILITAS
     ===================================================================== */
  const $ = (sel, akar) => (akar || document).querySelector(sel);
  const $$ = (sel, akar) => Array.prototype.slice.call((akar || document).querySelectorAll(sel));

  /** Mengambil teks terjemahan, dengan placeholder {n} yang bisa diganti. */
  function t(kunci, vars) {
    const paket = i18n[state.bahasa] || i18n.id;
    let teks = paket[kunci];
    if (teks === undefined) teks = i18n.id[kunci];
    if (teks === undefined) return kunci;
    if (vars) {
      Object.keys(vars).forEach((v) => {
        teks = teks.split('{' + v + '}').join(vars[v]);
      });
    }
    return teks;
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
      window.localStorage.setItem('baliwise.bahasa', bahasa);
    } catch (_) {
      /* localStorage tidak tersedia (mode private / iframe) -> abaikan, bukan error fatal */
    }
  }
  function bacaBahasa() {
    try {
      const v = window.localStorage.getItem('baliwise.bahasa');
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
    $$('[data-i18n]').forEach((el) => {
      const teks = t(el.getAttribute('data-i18n'));
      // Jangan Sentuh elemen yang butuh HTML (mis. <span> di dalam <p>)
      if (el.children.length === 0) el.textContent = teks;
      else {
        // Ganti hanya teks node pertama agar format/icon tetap aman.
        el.firstChild && (el.firstChild.nodeType === 3 ? el.firstChild.nodeValue = teks : (el.textContent = teks));
      }
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
      ? 'BaliWise — AI-Powered Bali Itinerary Planner'
      : 'BaliWise — Perencana Itinerary Bali Berbasis AI';
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

    // Render ulang itinerary agar nama tempat ikut mengikuti bahasa.
    if (state.itinerary) renderItinerary(state.itinerary);

    // Tampilkan tombol "buat ulang" bila bahasa hasil AI berbeda dengan bahasa UI.
    perbaruiTombolRegenerate();
  }

  /* =====================================================================
     E. VALIDASI FORM
     ===================================================================== */
  function bacaPreferensi() {
    const durasiEl = $('input[name="durasi"]:checked');
    const minat = $$('input[name="minat"]:checked').map((el) => el.value);
    const budgetEl = $('input[name="budget"]:checked');
    const gayaEl = $('input[name="gaya"]:checked');
    const wilayah = $('#wilayah-awal');
    const catatan = $('#catatan');

    return {
      durasi: durasiEl ? Number(durasiEl.value) : null,
      budget: budgetEl ? budgetEl.value : 'menengah',
      minat: minat,
      gaya: gayaEl ? gayaEl.value : 'padat',
      wilayahAwal: wilayah ? wilayah.value : '',
      catatan: catatan ? catatan.value.trim().slice(0, 300) : ''
    };
  }

  /** Validasi sebelum memanggil server. Mengembalikan pesan error atau null. */
  function validasiForm(p) {
    if (!p.durasi || p.durasi < 1 || p.durasi > 7) return t('plan.errDurasi');
    if (!p.minat || p.minat.length === 0) return t('plan.errMinat');
    if (!p.wilayahAwal) return t('plan.errWilayah');
    if (p.catatan && p.catatan.length > 300) return t('chat.errLong');
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

  /** Render seluruh itinerary ke section hasil. */
  function renderItinerary(itinerary) {
    const timeline = $('#timeline');
    const hasilSection = $('#hasil');
    if (!timeline || !hasilSection) return;

    timeline.textContent = '';

    if (!itinerary || !itinerary.hari || !itinerary.hari.length) {
      timeline.appendChild(buatEl('p', 'alert alert--info', t('err.title')));
      return;
    }

    // Hasil sudah ada: tampilkan kepala + 3 kotak ringkasan, sembunyikan empty state.
    const head = $('#res-head');
    const empty = $('#res-empty');
    if (head) head.hidden = false;
    if (empty) empty.hidden = true;

    // Ringkasan & angka ringkas
    const ringkas = $('#res-summary');
    if (ringkas) ringkas.textContent = itinerary.ringkasan || '';

    const totalTempat = itinerary.hari.reduce((n, h) => n + (h.jadwal ? h.jadwal.length : 0), 0);
    const elHari = $('#res-days');
    const elTempat = $('#res-places');
    const elTotal = $('#res-total');
    if (elHari) elHari.textContent = itinerary.hari.length;
    if (elTempat) elTempat.textContent = totalTempat;
    if (elTotal) elTotal.textContent = rupiah(itinerary.totalEstimasi);

    itinerary.hari.forEach((hari) => timeline.appendChild(renderHari(hari)));

    hasilSection.hidden = false;

    // Munculkan juga panel chat (hanya setelah ada rencana).
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
    loader.appendChild(buatEl('p', 'loader__text', t('load.title')));

    const dots = buatEl('p', 'loader__dots');
    dots.appendChild(buatEl('span'));
    dots.appendChild(buatEl('span'));
    dots.appendChild(buatEl('span'));
    loader.appendChild(dots);

    loader.appendChild(buatEl('p', 'loader__hint', t('load.hint')));

    timeline.appendChild(loader);
    hasilSection.hidden = false;
    $('#chat').hidden = true;

    // Auto scroll ke area hasil.
    setTimeout(() => hasilSection.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80);
  }

  /* =====================================================================
     H. ALUR PEMBUATAN ITINERARY
     ===================================================================== */
  async function buatItinerary() {
    if (state.sedangProses) return;

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

    const hasil = await window.BaliWiseApi.buatItinerary(preferensi, state.bahasa);

    state.sedangProses = false;
    setLoadingForm(false);

    if (!hasil.ok) {
      tampilkanGagal(hasil.message, hasil.rawText);
      return;
    }

    state.itinerary = hasil.itinerary;
    state.bahasaItinerary = state.bahasa;
    state.chatHistory = [];

    renderItinerary(state.itinerary);
    bersihkanChat();
    setTimeout(() => $('#hasil').scrollIntoView({ behavior: 'smooth', block: 'start' }), 60);
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
      state.bahasa
    );

    if (typing && typing.parentNode) typing.parentNode.removeChild(typing);
    if (statusEl) statusEl.textContent = t('chat.status');

    if (!hasil.ok) {
      tambahPesan('assistant', hasil.message || 'Maaf, terjadi kesalahan.');
      return;
    }

    const balasan = hasil.balasan;
    let teksTampil = balasan.reply || '';

    // Jika AI mengembalikan itinerary baru, render ulang.
    if (balasan.itinerary) {
      state.itinerary = balasan.itinerary;
      state.bahasaItinerary = state.bahasa;
      renderItinerary(state.itinerary);
      if (balasan.perubahan && balasan.perubahan.length) {
        teksTampil += (teksTampil ? '\n' : '') + t('chat.rebuild');
      }
    }

    tambahPesan('assistant', teksTampil, balasan.perubahan);
    state.chatHistory.push({ role: 'assistant', text: balasan.reply || '' });

    // Batasi riwayat agar tidak membengkak.
    if (state.chatHistory.length > 20) {
      state.chatHistory = state.chatHistory.slice(-20);
    }
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

    /* --- Menu burger (mobile) --- */
    const burger = $('#burger');
    const drawer = $('#nav-drawer');
    if (burger && drawer) {
      burger.addEventListener('click', () => {
        const terbuka = burger.getAttribute('aria-expanded') === 'true';
        burger.setAttribute('aria-expanded', terbuka ? 'false' : 'true');
        drawer.hidden = terbuka;
      });
      // Tutup menu setelah link diklik.
      $$('a', drawer).forEach((a) => a.addEventListener('click', () => {
        burger.setAttribute('aria-expanded', 'false');
        drawer.hidden = true;
      }));
    }

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

    /* --- Animasi muncul saat scroll --- */
    if ('IntersectionObserver' in window) {
      const observer = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
            observer.unobserve(entry.target);
          }
        });
      }, { threshold: 0.12 });
      $$('.card, .step, .hero__card').forEach((el, i) => {
        el.classList.add('reveal');
        el.style.transitionDelay = (i % 3) * 70 + 'ms';
        observer.observe(el);
      });
    }

    /* --- Efek navbar saat scroll --- */
    const nav = $('#nav');
    let ticking = false;
    window.addEventListener('scroll', () => {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(() => {
        if (nav) nav.classList.toggle('is-scrolled', window.scrollY > 12);
        ticking = false;
      });
    }, { passive: true });

    /* --- Log ke console untuk kebutuhan demo/presentasi --- */
    console.log('%cBaliWise', 'color:#0A3D62;font-size:18px;font-weight:800', '- Perencana itinerary Bali berbasis AI (NAISC 2026)');
  }

  // Jalankan setelah DOM siap.
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
