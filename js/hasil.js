/**
 * ============================================================================
 *  GRISKA GO - js/hasil.js
 * ----------------------------------------------------------------------------
 *  Renderer hasil itinerary:
 *   1. Ringkasan trip (wilayah, durasi, traveler, total budget).
 *   2. Tab per hari + timeline kartu aktivitas (foto, tips, alamat, peta).
 *   3. Peta rute (Leaflet + OpenStreetMap).
 *   4. Rincian budget (donut, legenda, tabel per hari).
 *   5. Tips umum trip.
 *   6. Aksi: cetak/PDF, salin, simpan, buat ulang.
 *
 *  Semua angka budget berasal dari server (hasil perhitungan kode).
 * ============================================================================
 */

(function (global) {
  'use strict';

  const I18n = global.BaliWiseI18n;
  const Chart = global.GriskaChart;
  const Peta = global.GriskaPeta;

  const t = function (kunci, vars) { return I18n ? I18n.get(kunci, vars) : kunci; };
  const el = function (tag, kelas, teks) {
    const node = document.createElement(tag);
    if (kelas) node.className = kelas;
    if (teks !== undefined && teks !== null) node.textContent = teks;
    return node;
  };
  const $ = function (sel, akar) { return (akar || document).querySelector(sel); };

  /* ---------------- format angka ---------------- */
  const rupiah = function (angka) {
    return 'Rp ' + new Intl.NumberFormat('id-ID').format(Math.round(angka || 0));
  };
  const dolar = function (angka, kurs) {
    if (!kurs) return '';
    const nilai = Math.round((angka || 0) / kurs);
    return '≈ USD ' + new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(nilai);
  };

  /* ---------------- bahasa aktif ---------------- */
  const bahasaAktif = function () {
    return (document.documentElement.lang || 'id') === 'en' ? 'en' : 'id';
  };

  /** Judul kartu total keseluruhan (mobile). */
  const labelTotalKeseluruhan = function () {
    return bahasaAktif() === 'en' ? 'Grand Total' : 'Total Keseluruhan';
  };

  /* ---------------- label kategori &/icon ---------------- */
  const KATEGORI_IKON = {
    pantai: '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M12 2a10 10 0 100 20 10 10 0 000-20zm0 18a8 8 0 110-16 8 8 0 010 16zM7 13c1.5 1.5 3 2 5 2s3.5-.5 5-2c-1.5 4-3.5 6-5 6s-3.5-2-5-6z" fill="currentColor"/></svg>',
    budaya: '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M12 2L2 7l10 5 8-4v6c0 1.7-3.6 3-8 3s-8-1.3-8-3V7l-2-1v12c0 3.3 4.5 5 10 5s10-1.7 10-5V6z" fill="currentColor"/></svg>',
    kuliner: '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M11 9H9V2H7v7H5V2H3v7a4 4 0 003 3.9V22h2v-9.1A4 4 0 007 9V2H5v7H3M16 2v8h3v12h2V2h-5zm2 6h-1V4h1v4z" fill="currentColor"/></svg>',
    alam: '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M12 2a7 7 0 00-7 7c0 5 7 13 7 13s7-8 7-13a7 7 0 00-7-7zm0 9.5A2.5 2.5 0 1112 6.5a2.5 2.5 0 010 5z" fill="currentColor"/></svg>',
    belanja: '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M7 18a2 2 0 100 4 2 2 0 000-4zm10 0a2 2 0 100 4 2 2 0 000-4zM7.2 14h9.9c.8 0 1.5-.5 1.8-1.2L22 5H5.2L4 3H1v2h2l3.6 8.6-1.4 4.2C5 19.4 6.5 21 8.5 21H20v-2H8.5l.3-1h9.6l1.6-4H6.7z" fill="currentColor"/></svg>'
  };

  const labelKategori = function (k) {
    const peta = { pantai: 'kategori.pantai', budaya: 'kategori.budaya', kuliner: 'kategori.kuliner', alam: 'kategori.alam', belanja: 'kategori.belanja' };
    return t(peta[k] || 'kategori.alam');
  };

  /* =====================================================================
     A. RINGKASAN TRIP
     ===================================================================== */
  function renderRingkasan(rencana, budget, meta) {
    const wrap = $('#trip');
    if (!wrap) return;
    wrap.hidden = false;

    const hari = rencana.hari || [];
    const jumlahTempat = hari.reduce((s, h) => s + h.jadwal.filter((j) => j.tipe !== 'makan').length, 0);
    const traveler = budget.traveler || { dewasa: 1, anak: 0, total: 1 };
    const gaya = (meta && meta.gaya) || '';

    /* Ringkasan teks */
    const desc = $('#trip-desc');
    if (desc) desc.textContent = rencana.ringkasan || t('res.desc');

    /* Fakta trip */
    const facts = $('#trip-facts');
    if (facts) {
      facts.textContent = '';
      const zona = hari.length && hari[0].jadwal.length ? (hari[0].jadwal[0].zonaNama || '') : '';
      const daftar = [
        { ikon: '📍', label: t('res.factZona'), value: zona || '-' },
        { ikon: '🗓️', label: t('res.factDurasi'), value: hari.length + ' ' + t('res.hari').toLowerCase() },
        { ikon: '👥', label: t('res.factTraveler'), value: traveler.dewasa + ' ' + t('plan.travelerDewasa').toLowerCase() +
            (traveler.anak ? ', ' + traveler.anak + ' ' + t('plan.travelerAnak').toLowerCase() : '') },
        { ikon: '🏃', label: t('res.factGaya'), value: gaya ? (gaya === 'padat' ? t('res.intensitasPadat') : t('res.intensitasSantai')) : '-' },
        { ikon: '📌', label: t('res.factTempat'), value: jumlahTempat + ' ' + t('res.factTempat').toLowerCase() }
      ];
      if (meta && meta.tanggal) {
        daftar.push({ ikon: '✈️', label: t('res.factTanggal'), value: meta.tanggal });
      }
      daftar.forEach(function (f) {
        const li = el('li', 'trip__fact');
        li.appendChild(el('span', 'trip__fact-icon', f.ikon));
        const isi = el('span', 'trip__fact-body');
        isi.appendChild(el('span', 'trip__fact-label', f.label));
        isi.appendChild(el('strong', 'trip__fact-value', f.value));
        li.appendChild(isi);
        facts.appendChild(li);
      });
    }

    /* Kartu angka budget */
    const money = $('#trip-money');
    if (money) {
      money.textContent = '';
      const overBudget = budget.status.kode === 'melebihi';
      const kartu = [
        { label: t('res.totalEstimasi'), nilai: rupiah(budget.total), sub: dolar(budget.total, budget.kursUSD), gold: true },
        { label: t('res.perOrang'), nilai: rupiah(budget.perOrang), sub: dolar(budget.perOrang, budget.kursUSD) },
        { label: t('res.perHari'), nilai: rupiah(budget.perHari), sub: '' },
        overBudget
          ? { label: t('res.lebihBudget'), nilai: rupiah(budget.status.selisih), sub: '', warn: true }
          : { label: t('res.sisaBudget'), nilai: rupiah(budget.status.sisa), sub: '', warn: false }
      ];
      kartu.forEach(function (k) {
        const box = el('div', 'money' + (k.gold ? ' money--gold' : '') + (k.warn ? ' money--warn' : ''));
        box.appendChild(el('span', 'money__label', k.label));
        box.appendChild(el('strong', 'money__value', k.nilai));
        if (k.sub) box.appendChild(el('small', 'money__sub', k.sub));
        money.appendChild(box);
      });
    }

    /* Peringatan / sisa budget */
    const alert = $('#budget-alert');
    if (alert) {
      alert.textContent = '';
      if (budget.status.kode === 'melebihi') {
        alert.hidden = false;
        alert.classList.add('budget-alert--over');
        const judul = el('strong', 'budget-alert__title', '⚠️ ' + t('res.lebihBudget') +
          ' (+' + rupiah(budget.status.selisih) + ')');
        alert.appendChild(judul);
        if (budget.saranHemat && budget.saranHemat.length) {
          alert.appendChild(el('p', 'budget-alert__label', t('res.saranHemat')));
          const list = el('ul', 'budget-alert__list');
          budget.saranHemat.forEach(function (s) {
            const li = el('li');
            li.appendChild(el('strong', null, s.judul));
            li.appendChild(el('span', null, ' ' + s.detail));
            if (s.hemat > 0) li.appendChild(el('em', 'budget-alert__hemat', '−' + rupiah(s.hemat)));
            list.appendChild(li);
          });
          alert.appendChild(list);
        }
      } else {
        alert.hidden = false;
        alert.classList.remove('budget-alert--over');
        alert.classList.add('budget-alert--ok');
        alert.appendChild(el('strong', 'budget-alert__title', '✅ ' + t('res.dalamBudget') +
          ' (' + rupiah(budget.status.sisa) + ')'));
      }
    }

    /* Notifikasi bila narasi AI tidak tersedia */
    const notice = $('#trip-notice');
    if (notice) {
      if (meta && meta.narasiAI === false) {
        notice.hidden = false;
        notice.textContent = t('res.noticeNoAI');
      } else {
        notice.hidden = true;
      }
    }
  }

  /* =====================================================================
     B. TAB HARI + TIMELINE
     ===================================================================== */
  function renderHari(rencana, budget) {
    const tabs = $('#daytabs');
    const wadahHari = $('#plan-days');
    if (!tabs || !wadahHari) return;

    tabs.textContent = '';
    wadahHari.textContent = '';

    rencana.hari.forEach(function (h, i) {
      /* --- Tab --- */
      const tab = el('button', 'daytab');
      tab.type = 'button';
      tab.setAttribute('role', 'tab');
      tab.id = 'daytab-' + h.hari;
      tab.setAttribute('aria-controls', 'daypanel-' + h.hari);
      tab.setAttribute('aria-selected', i === 0 ? 'true' : 'false');
      tab.tabIndex = i === 0 ? 0 : -1;
      tab.classList.toggle('is-active', i === 0);
      // Isi tab ringkas: hanya nama hari ("Hari 1" / "Day 1").
      tab.appendChild(el('span', 'daytab__label', t('res.dariHari') + ' ' + h.hari));
      tab.addEventListener('click', function () { pilihHari(i); });
      tabs.appendChild(tab);

      /* --- Panel hari --- */
      const panel = el('section', 'daypanel');
      panel.id = 'daypanel-' + h.hari;
      panel.setAttribute('role', 'tabpanel');
      panel.setAttribute('aria-labelledby', 'daytab-' + h.hari);
      panel.hidden = i !== 0;
      panel.style.setProperty('--day-color', Peta.WARNA_HARI[i % Peta.WARNA_HARI.length]);

      const kepala = el('header', 'daypanel__head');
      kepala.appendChild(el('span', 'daypanel__badge', t('res.dariHari') + ' ' + h.hari));
      if (h.tema) kepala.appendChild(el('h3', 'daypanel__title', h.tema));
      panel.appendChild(kepala);

      // Keterangan panjang TIDAK di header: tampilkan sebagai paragraf teks
      // gelap di bawah header (latar putih).
      const biayaHari = budget.rincianHari.find((r) => r.hari === h.hari);
      const catatan = [h.deskripsi, h.ringkasan, h.catatan, h.narasi]
        .filter((x) => typeof x === 'string' && x.trim())
        .join(' ');
      if (catatan || biayaHari) {
        const info = el('div', 'daypanel__note');
        if (catatan) info.appendChild(el('p', 'daypanel__note-text', catatan));
        if (biayaHari) {
          info.appendChild(el('span', 'daypanel__cost', rupiah(biayaHari.total)));
        }
        panel.appendChild(info);
      }

      const timeline = el('ol', 'timeline timeline--plan');
      h.jadwal.forEach(function (item) {
        timeline.appendChild(renderItem(item, budget));
      });
      panel.appendChild(timeline);
      wadahHari.appendChild(panel);
    });
  }

  /** Mengganti hari yang aktif (tab). */
  function pilihHari(index) {
    const tabs = document.querySelectorAll('.daytab');
    const panels = document.querySelectorAll('.daypanel');
    tabs.forEach(function (tab, i) {
      tab.classList.toggle('is-active', i === index);
      tab.setAttribute('aria-selected', i === index ? 'true' : 'false');
      tab.tabIndex = i === index ? 0 : -1;
    });
    panels.forEach(function (panel, i) { panel.hidden = i !== index; });
    if (tabs[index]) tabs[index].scrollIntoView({ block: 'nearest', inline: 'center' });
  }

  /** Membuat satu kartu aktivitas. */
  /**
   * Label tag minat (dari whitelist katalog).
   * @param {string} tag - id tag, mis. "sunset"
   * @returns {string} label yang bisa dibaca
   */
  function labelTag(tag) {
    const key = 'tag.' + String(tag || '');
    const teks = t(key);
    return (teks && teks !== key) ? teks : String(tag || '');
  }

  function renderItem(item, budget) {
    const li = el('li', 'stop stop--plan' + (item.tipe === 'makan' ? ' stop--makan' : ''));

    /* Jam */
    const waktu = el('div', 'stop__time');
    waktu.appendChild(el('strong', null, item.jamMulai || '--:--'));
    if (item.jamSelesai) waktu.appendChild(el('span', null, item.jamSelesai));
    li.appendChild(waktu);

    const body = el('div', 'stop__body');

    /* Nama + kategori */
    const head = el('div', 'stop__head');
    const judul = el('h3', 'stop__name');
    judul.textContent = item.nama;
    head.appendChild(judul);
    const badge = el('span', 'tag tag--sea stop__cat');
    badge.innerHTML = (KATEGORI_IKON[item.kategori] || '') + ' ' + labelKategori(item.kategori);
    head.appendChild(badge);
    body.appendChild(head);

    /* Badge tag minat yang cocok (dari data katalog, bukan dari AI). */
    if (item.tagCocok && item.tagCocok.length) {
      const tagBaris = el('div', 'stop__tags');
      item.tagCocok.slice(0, 4).forEach(function (tg) {
        tagBaris.appendChild(el('span', 'tag tag--gold', labelTag(tg)));
      });
      body.appendChild(tagBaris);
    }

    /* Narasi AI */
    if (item.aktivitas) body.appendChild(el('p', 'stop__desc', item.aktivitas));

    /* Alasan kecocokan */
    if (item.alasan) {
      const why = el('div', 'stop__why');
      why.appendChild(el('strong', 'stop__why-label', '💡 ' + t('res.alasan')));
      why.appendChild(el('p', 'stop__why-text', item.alasan));
      body.appendChild(why);
    }

    /* Foto */
    if (item.foto) {
      const foto = el('figure', 'stop__photo');
      const img = document.createElement('img');
      img.src = item.foto;
      img.alt = item.nama + ' — ' + (item.zonaNama || 'Bali');
      img.loading = 'lazy';
      img.decoding = 'async';
      img.width = 640;
      img.height = 480;
      img.addEventListener('error', function () { foto.hidden = true; });
      foto.appendChild(img);
      body.appendChild(foto);
    }

    /* Meta: alamat, jarak, tiket, makan */
    const meta = el('dl', 'stop__meta');
    const tambah = function (label, nilai) {
      if (!nilai) return;
      const wrap = el('div', 'stop__meta-item');
      wrap.appendChild(el('dt', null, label));
      wrap.appendChild(el('dd', null, nilai));
      meta.appendChild(wrap);
    };

    if (item.tipe === 'makan') {
      tambah(item.waktu === 'malam' ? t('res.makanMalam') : t('res.makanSiang'), item.jenis);
      if (item.catatanMakan) tambah(t('res.catatanMakan'), item.catatanMakan);
      if (item.biayaMakan) {
        const catatanHarga = item.estimasiMakan
          ? (bahasaAktif() === 'en' ? ' (estimate)' : ' (estimasi)')
          : '';
        tambah(t('res.makan'), rupiah(item.biayaMakan) + ' / ' +
          (budget.traveler.total > 1 ? budget.traveler.total + ' pax' : '1 pax') + catatanHarga);
      }
      if (item.tips) tambah(t('res.catatanMakan'), item.tips);
    } else {
      tambah(t('res.alamat'), item.alamat);
      if (item.jarakKm) {
        tambah(t('res.dari'), item.jarakKm + ' ' + t('res.km') + ' · ' + item.waktuTempuhMenit + ' ' + t('res.min'));
      }
      if (item.hargaTiket > 0) {
        tambah(t('res.tiket'), rupiah(item.hargaTiket) + ' / orang');
      } else if (item.hargaTiket === 0) {
        tambah(t('res.tiket'), t('res.gratis'));
      }
      if (item.biayaAktivitas > 0) {
        tambah(t('res.kategoriAktivitas'), rupiah(item.biayaAktivitas) + ' / orang');
      }
      if (item.waktuTerbaik) {
        tambah(t('res.waktuTerbaik'), item.waktuTerbaik);
      }
    }
    if (meta.children.length) body.appendChild(meta);

    /* Tips budaya (dari katalog) */
    const tips = item.tipsBudaya && item.tipsBudaya.length ? item.tipsBudaya : null;
    if (tips) {
      const box = el('div', 'stop__tips');
      const judulTips = el('strong', 'stop__tips-title', '🧭 ' + t('res.tipsBudaya'));
      box.appendChild(judulTips);
      const list = el('ul');
      tips.forEach(function (tip) { list.appendChild(el('li', null, tip)); });
      box.appendChild(list);
      if (item.dressCode) {
        box.appendChild(el('p', 'stop__dress', '👗 ' + t('res.dressCode') + ': ' + item.dressCode));
      }
      body.appendChild(box);
    }

    /* Tombol peta */
    if (item.mapsUrl) {
      const link = el('a', 'stop__maps');
      link.href = item.mapsUrl;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.innerHTML = '📍 ' + t('res.bukaMaps');
      body.appendChild(link);
    }

    li.appendChild(body);
    return li;
  }

  /* =====================================================================
     C. PETA
     ===================================================================== */
  function renderPeta(rencana) {
    const wadah = $('#plan-map');
    const note = $('#map-note');
    if (!wadah) return;

    if (!Peta) { wadah.hidden = true; return; }

    Peta.gambar(wadah, rencana.hari || [], t).then(function () {
      if (note) note.hidden = true;
    }).catch(function () {
      wadah.hidden = true;
      if (note) {
        note.hidden = false;
        note.textContent = t('res.petaGagal');
      }
    });
  }

  /* =====================================================================
     D. RINCIAN BUDGET
     ===================================================================== */
  const KATEGORI_BUDGET = [
    { kunci: 'akomodasi', label: 'res.kategoriAkomodasi' },
    { kunci: 'transportasi', label: 'res.kategoriTransportasi' },
    { kunci: 'tiket', label: 'res.kategoriTiket' },
    { kunci: 'makan', label: 'res.kategoriMakan' },
    { kunci: 'aktivitas', label: 'res.kategoriAktivitas' },
    { kunci: 'lainLain', label: 'res.kategoriLainLain' },
    { kunci: 'cadangan', label: 'res.kategoriCadangan' }
  ];

  function renderBudget(budget) {
    const chart = $('#budget-chart');
    const legend = $('#budget-legend');
    const table = $('#budget-table');
    if (!chart || !legend || !table) return;

    const data = KATEGORI_BUDGET.map(function (k) {
      return { kunci: k.kunci, label: t(k.label), nilai: budget.kategori[k.kunci] || 0 };
    });

    /* Donut */
    chart.innerHTML = Chart.donut(data, {
      labelTengah: rupiah(budget.total),
      subTengah: t('res.totalEstimasi')
    });

    /* Legenda */
    legend.textContent = '';
    data.forEach(function (d) {
      const li = el('li', 'legend__item');
      const dot = el('span', 'legend__dot');
      dot.style.background = Chart.WARNA[d.kunci];
      li.appendChild(dot);
      li.appendChild(el('span', 'legend__label', d.label));
      li.appendChild(el('span', 'legend__value', rupiah(d.nilai)));
      legend.appendChild(li);
    });

    /* Tabel ringkas (kategori -> total) untuk panel samping */
    table.textContent = '';
    const tabel = el('table', 'budget-table budget-table--compact');
    const tbody = el('tbody');
    data.forEach(function (d) {
      const tr = el('tr');
      const th = el('th', null, d.label);
      th.scope = 'row';
      tr.appendChild(th);
      tr.appendChild(el('td', 'budget-table__total', rupiah(d.nilai)));
      tbody.appendChild(tr);
    });
    tabel.appendChild(tbody);
    const tfoot = el('tfoot');
    const trFoot = el('tr');
    const thFoot = el('th', null, t('res.totalEstimasi'));
    thFoot.scope = 'row';
    trFoot.appendChild(thFoot);
    trFoot.appendChild(el('td', 'budget-table__total', rupiah(budget.total)));
    tfoot.appendChild(trFoot);
    tabel.appendChild(tfoot);
    table.appendChild(tabel);

    /* Tabel rinci per hari (lebar, di kolom utama) */
    const panelHari = $('#budget-days');
    if (!panelHari) return;
    panelHari.textContent = '';
    panelHari.hidden = false;

    const kepala = el('header', 'panel__head');
    kepala.appendChild(el('h3', null, t('res.budgetPerHari')));
    panelHari.appendChild(kepala);

    const wrap = el('div', 'budget__table budget__table--wide');
    const tabelHari = el('table', 'budget-table');
    const thead = el('thead');
    const barisHead = el('tr');
    barisHead.appendChild(el('th', null, t('res.budgetKategori')));
    budget.rincianHari.forEach(function (r) {
      barisHead.appendChild(el('th', 'budget-table__day', t('res.dariHari') + ' ' + r.hari));
    });
    barisHead.appendChild(el('th', null, t('res.budgetTotal')));
    thead.appendChild(barisHead);
    tabelHari.appendChild(thead);

    const tbodyHari = el('tbody');
    data.forEach(function (d) {
      const tr = el('tr');
      const th = el('th', null, d.label);
      th.scope = 'row';
      tr.appendChild(th);
      budget.rincianHari.forEach(function (r) {
        tr.appendChild(el('td', null, rupiah(r[d.kunci] || 0)));
      });
      tr.appendChild(el('td', 'budget-table__total', rupiah(d.nilai)));
      tbodyHari.appendChild(tr);
    });
    tabelHari.appendChild(tbodyHari);

    const tfootHari = el('tfoot');
    const trTotal = el('tr');
    const thTotal = el('th', null, t('res.totalEstimasi'));
    thTotal.scope = 'row';
    trTotal.appendChild(thTotal);
    budget.rincianHari.forEach(function (r) { trTotal.appendChild(el('td', null, rupiah(r.total))); });
    trTotal.appendChild(el('td', 'budget-table__total', rupiah(budget.total)));
    tfootHari.appendChild(trTotal);
    tabelHari.appendChild(tfootHari);

    wrap.appendChild(tabelHari);
    panelHari.appendChild(wrap);

    /* ---------- Versi mobile (<700px): kartu bertumpuk ---------- */
    /* Data diambil dari objek budget yang sama (tanpa hitung ulang). */
    const mobile = el('div', 'budget-cards');

    budget.rincianHari.forEach(function (r) {
      const card = el('article', 'budget-card');
      card.appendChild(el('h4', 'budget-card__title', t('res.dariHari') + ' ' + r.hari));

      const list = el('dl', 'budget-card__list');
      KATEGORI_BUDGET.forEach(function (k) {
        list.appendChild(el('dt', 'budget-card__label', t(k.label)));
        list.appendChild(el('dd', 'budget-card__nilai', rupiah(r[k.kunci] || 0)));
      });
      card.appendChild(list);

      const foot = el('p', 'budget-card__total');
      foot.appendChild(el('span', 'budget-card__total-label',
        t('res.budgetTotal') + ' ' + t('res.dariHari') + ' ' + r.hari));
      foot.appendChild(el('span', 'budget-card__total-nilai', rupiah(r.total)));
      card.appendChild(foot);

      mobile.appendChild(card);
    });

    /* Kartu "Total Keseluruhan": total per kategori + total akhir. */
    const kartuTotal = el('article', 'budget-card budget-card--total');
    kartuTotal.appendChild(el('h4', 'budget-card__title', labelTotalKeseluruhan()));
    const listTotal = el('dl', 'budget-card__list');
    data.forEach(function (d) {
      listTotal.appendChild(el('dt', 'budget-card__label', d.label));
      listTotal.appendChild(el('dd', 'budget-card__nilai', rupiah(d.nilai)));
    });
    kartuTotal.appendChild(listTotal);
    const footTotal = el('p', 'budget-card__total');
    footTotal.appendChild(el('span', 'budget-card__total-label', t('res.totalEstimasi')));
    footTotal.appendChild(el('span', 'budget-card__total-nilai', rupiah(budget.total)));
    kartuTotal.appendChild(footTotal);
    mobile.appendChild(kartuTotal);

    panelHari.appendChild(mobile);
  }

  /* =====================================================================
     E. TIPS UMUM
     ===================================================================== */
  function renderTips(rencana) {
    const wrap = $('#plan-tips');
    const grid = $('#tips-grid');
    if (!wrap || !grid) return;

    const tips = rencana.tipsUmum;
    if (!tips || (!tips.bawa && !tips.bawa && !tips.etika && !tips.waktuTerbaik)) {
      wrap.hidden = true;
      return;
    }
    wrap.hidden = false;
    grid.textContent = '';

    const blok = function (ikon, judul, daftar) {
      if (!daftar || !daftar.length) return;
      const box = el('div', 'tips__box');
      box.appendChild(el('h4', 'tips__title', ikon + ' ' + judul));
      const list = el('ul', 'tips__list');
      daftar.forEach(function (x) { list.appendChild(el('li', null, x)); });
      box.appendChild(list);
      grid.appendChild(box);
    };

    blok('🎒', t('res.tipsBawa'), tips.bawa);
    blok('⏰', t('res.tipsWaktu'), tips.waktuTerbaik ? [tips.waktuTerbaik] : null);
    blok('⚠️', t('res.tipsEtika'), tips.etika);
  }

  /* =====================================================================
     F. AKSI
     ===================================================================== */
  function teksRingkas(rencana, budget) {
    const lines = [];
    lines.push('GRISKA GO — ' + (rencana.ringkasan || ''));
    lines.push('');
    lines.push(t('res.totalEstimasi') + ': ' + rupiah(budget.total) +
      ' (' + rupiah(budget.perOrang) + ' / orang, ' + rupiah(budget.perHari) + ' / hari)');
    lines.push('');
    (rencana.hari || []).forEach(function (h) {
      lines.push('— ' + t('res.dariHari') + ' ' + h.hari + (h.tema ? ': ' + h.tema : '') + ' —');
      h.jadwal.forEach(function (item) {
        if (item.tipe === 'makan') {
          lines.push('  ' + item.jamMulai + ' ' + item.nama + ' (' + item.jenis + ')');
        } else {
          lines.push('  ' + item.jamMulai + '-' + item.jamSelesai + ' ' + item.nama + ' [' + item.zonaNama + ']');
          if (item.aktivitas) lines.push('      ' + item.aktivitas);
        }
      });
      lines.push('');
    });
    lines.push(t('res.budget') + ':');
    KATEGORI_BUDGET.forEach(function (k) {
      lines.push('  ' + t(k.label) + ': ' + rupiah(budget.kategori[k.kunci] || 0));
    });
    lines.push('');
    lines.push(t('res.budgetNote'));
    return lines.join('\n');
  }

  function pasangAksi(rencana, budget, bahasa) {
    const wrap = $('#plan-actions');
    const status = $('#plan-actions-status');
    if (!wrap) return;
    wrap.hidden = false;

    const statusPesan = function (teks, ok) {
      if (!status) return;
      status.textContent = teks;
      status.classList.toggle('is-ok', !!ok);
      status.classList.toggle('is-error', !ok);
      window.clearTimeout(statusPesan.timer);
      statusPesan.timer = window.setTimeout(function () { status.textContent = ''; }, 4000);
    };

    wrap.querySelectorAll('[data-action]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        const aksi = btn.getAttribute('data-action');
        if (aksi === 'print') {
          window.print();
        } else if (aksi === 'copy') {
          const teks = teksRingkas(rencana, budget);
          const salin = function () {
            if (navigator.clipboard && navigator.clipboard.writeText) {
              return navigator.clipboard.writeText(teks);
            }
            // Cadangan untuk browser tanpa Clipboard API.
            return new Promise(function (resolve, reject) {
              const area = document.createElement('textarea');
              area.value = teks;
              area.setAttribute('readonly', '');
              area.style.position = 'fixed';
              area.style.opacity = '0';
              document.body.appendChild(area);
              area.select();
              let ok = false;
              try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
              document.body.removeChild(area);
              if (ok) resolve(); else reject(new Error('copy gagal'));
            });
          };
          salin().then(function () {
            statusPesan(t('res.aksiTersalin'), true);
          }).catch(function () { statusPesan(t('res.aksiGagal'), false); });
        } else if (aksi === 'save') {
          try {
            // State form ikut disimpan, termasuk fitur baru:
            // titik awal bebas, minat bebas, dan biaya opsi "lainnya".
            const app = window.GriskaApp || {};
            window.localStorage.setItem('griska-go.rencana', JSON.stringify({
              rencana: rencana, budget: budget, bahasa: bahasa, dibuat: new Date().toISOString(),
              meta: (typeof app.getMeta === 'function' ? app.getMeta() : null),
              preferensi: (typeof app.getPreferensi === 'function' ? app.getPreferensi() : null)
            }));
            statusPesan(t('res.aksiTersimpan'), true);
          } catch (e) {
            statusPesan(t('res.aksiGagal'), false);
          }
        } else if (aksi === 'regenerate') {
          document.dispatchEvent(new CustomEvent('griska-go:buat-ulang'));
        }
      });
    });
  }

  /** Menyembunyikan / menampilkan panel peta (mobile: peta di bawah itinerary). */
  function pasangTogglePeta() {
    const btn = document.querySelector('[data-map-toggle]');
    const map = document.querySelector('#plan-map');
    if (!btn || !map) return;

    btn.addEventListener('click', function () {
      const disembunyikan = !map.hidden;
      map.hidden = disembunyikan;
      btn.textContent = disembunyikan ? t('res.petaTampil') : t('res.petaTutup');
      btn.setAttribute('aria-expanded', disembunyikan ? 'false' : 'true');
      if (!disembunyikan && Peta && Peta.perbaruiUkuran) Peta.perbaruiUkuran();
    });
  }

  /* =====================================================================
     G. RENDER UTAMA
     ===================================================================== */

  /**
   * Budget cadangan: dipakai bila server tidak mengirim rincian budget
   * (mis. revisi chat yang tidak mengubah biaya).
   */
  function budgetCadangan(rencana) {
    const hari = (rencana && Array.isArray(rencana.hari)) ? rencana.hari : [];
    const rincianHari = hari.map(function (h) {
      return {
        hari: h.hari, akomodasi: 0, transportasi: 0, tiket: 0, makan: 0,
        aktivitas: 0, lainLain: 0, cadangan: 0, total: h.totalBiaya || 0
      };
    });
    const total = rincianHari.reduce(function (s, r) { return s + r.total; }, 0);
    return {
      total: total,
      perOrang: total,
      perHari: hari.length ? Math.round(total / hari.length) : 0,
      perBulan: null,
      traveler: { dewasa: 1, anak: 0, total: 1 },
      malam: 0,
      tipeAkomodasi: 'hotel',
      jumlahUnit: 1,
      unitAkomodasi: 1,
      jenisTransport: 'motor',
      rincianTransportasi: [],
      kategori: { akomodasi: 0, transportasi: 0, tiket: 0, makan: 0, aktivitas: 0, lainLain: 0, cadangan: 0 },
      rincianHari: rincianHari,
      status: { kode: 'dalam_budget', batas: total, batasAcuan: total, selisih: 0, sisa: 0, sumberBatas: 'acuan' },
      saranHemat: [],
      kursUSD: 16250
    };
  }

  /**
   * Highlight singkat "Rencana diperbarui" setelah revisi chat.
   * Gaya memakai inline style supaya tidak bergantung file CSS baru.
   */
  function tandaiDiperbarui() {
    const wadah = document.querySelector('#hasil') || document.querySelector('#plan');
    if (!wadah) return;

    const notif = document.createElement('div');
    notif.className = 'updated-badge';
    notif.setAttribute('role', 'status');
    notif.textContent = bahasaAktif() === 'en' ? 'Plan updated' : 'Rencana diperbarui';
    notif.style.cssText = 'position:fixed;left:50%;bottom:18px;transform:translateX(-50%);z-index:1200;'      + 'background:#0a3d62;color:#fff;padding:.55rem 1rem;border-radius:999px;'      + 'font-size:.82rem;font-weight:700;line-height:1.25;white-space:nowrap;'      + 'box-shadow:0 12px 28px rgba(10,61,98,.35);';
    document.body.appendChild(notif);
    window.setTimeout(function () {
      if (notif.parentNode) notif.parentNode.removeChild(notif);
    }, 2600);

    // Kilau singkat pada panel hasil.
    const bayangLama = wadah.style.boxShadow;
    wadah.style.transition = 'box-shadow .4s ease';
    wadah.style.boxShadow = '0 0 0 3px rgba(232,163,61,.6)';
    window.setTimeout(function () {
      wadah.style.boxShadow = bayangLama;
    }, 1700);
  }

  function render(rencana, budget, meta) {
    if (!rencana) return;
    const bahasa = (meta && meta.bahasa) || (I18n ? I18n.bahasa : 'id');
    // Budget cadangan bila server tidak mengirim rincian.
    const b = budget || budgetCadangan(rencana);

    $('#res-empty').hidden = true;
    $('#plan').hidden = false;

    renderRingkasan(rencana, b, meta || {});
    renderHari(rencana, b);
    renderPeta(rencana);
    renderBudget(b);
    renderTips(rencana);
    pasangAksi(rencana, budget, bahasa);
    pasangTogglePeta();

    const timeline = $('#timeline');
    if (timeline) timeline.textContent = '';
  }

  /* Mengambil rencana tersimpan dari localStorage. */
  function ambilTersimpan() {
    try {
      const raw = window.localStorage.getItem('griska-go.rencana');
      return raw ? JSON.parse(raw) : null;
    } catch (e) { return null; }
  }

  global.GriskaHasil = {
    render: render,
    pilihHari: pilihHari,
    tandaiDiperbarui: tandaiDiperbarui,
    teksRingkas: teksRingkas,
    ambilTersimpan: ambilTersimpan,
    rupiah: rupiah,
    dolar: dolar
  };

})(window);
