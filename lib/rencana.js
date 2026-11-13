/**
 * ============================================================================
 *  GRISKA GO - lib/rencana.js
 * ----------------------------------------------------------------------------
 *  MESIN PERENCANAAN DETERMINISTIK (dipakai di server).
 *
 *  Prinsip utama:
 *    - TEMPAT dipilih oleh KODE, bukan oleh AI. AI hanya menulis narasi
 *      (alasan, deskripsi aktivitas, tema hari, tips umum).
 *    - BIAYA dihitung oleh KODE dari data/destinasi.json + data/wilayah.json,
 *      sehingga total selalu sama persis dengan rinciannya.
 *    - Semua tempat yang dipakai pasti ada di katalog 28 destinasi.
 *
 *  Modul ini murni (tanpa fs), sehingga bisa dipakai:
 *    - oleh api/chat.js (serverless function)
 *    - oleh tools/test-rencana.js (uji otomatis)
 * ============================================================================
 */

'use strict';

/* --------------------------------------------------------------------------
   KONSTANTA
   -------------------------------------------------------------------------- */
const JARAK_MAX_HARI_KM = 45;      // radius maksimal satu hari (anti bolak-balik)
const AKTIVITAS_PER_HARI = { santai: 3, padat: 5 };
const MAKAN_PER_HARI = 2;           // makan siang + makan malam
const JAM_MULAI_SANTAI = 8 * 60;     // 08.00
const JAM_MULAI_PADAT = 7 * 60 + 30;  // 07.30 (mulai awal, hindari keramaian)
const JAM_MAKAN_SIANG = 12 * 60 + 30;
const JAM_MAKAN_MALAM = 19 * 60;
const DURASI_MAKAN = 60;            // menit
const JEMBAT_ANTAR = 10;            // menit (parkir + jalan kaki ke lokasi)
const PERSEN_CADANGAN = 0.10;       // dana cadangan 10%

/* Budget harian acuan per orang (dipakai untuk status "dalam budget"). */
const BUDGET_HARIAN_ORANG = { hemat: 500000, menengah: 1400000, mewah: 3200000 };

/* Biaya tambahan per orang per hari (kategori aktivitas & oleh-oleh). */
const BIAYA_AKTIVITAS_HARI = { hemat: 50000, menengah: 150000, mewah: 400000 };
const BIAYA_LAIN_HARI = { hemat: 50000, menengah: 120000, mewah: 300000 };
const BIAYA_AIR_HARI = 10000;       // air mineral & camilan per orang per hari
const DISKON_ANAK_TIKET = 0.5;      // tarif anak umumnya 50% dari dewasa

/* Kecepatan rata-rata (km/jam) per jenis transportasi. */
const KECEPATAN = { motor: 30, mobil: 35, ojek: 25 };

/* Durasi maksimum perjalanan (hari). */
const DURASI_MAX = 14;

/* Batas area Bali (untuk memvalidasi titik awal). */
const BALI_BBOX = { latMin: -8.90, latMax: -8.00, lngMin: 114.35, lngMax: 115.80 };

/* Daftar tag yang SAH (whitelist). Tag di luar daftar ini dibuang. */
const TAG_VALID = [
  'spiritual', 'yoga', 'fotografi', 'sunrise', 'sunset', 'surfing', 'snorkeling',
  'trekking', 'spa', 'nightlife', 'keluarga', 'romantis', 'sejarah',
  'kuliner-lokal', 'kerajinan', 'pasar', 'air-terjun', 'sawah', 'pura', 'pantai-sepi'
];

/* Preset minat baru -> tag yang dicocokkan. */
const MINAT_PRESET = {
  spiritual: ['spiritual', 'yoga', 'pura'],
  fotografi: ['fotografi', 'sunrise', 'sunset'],
  petualangan: ['trekking', 'snorkeling', 'surfing', 'air-terjun'],
  spa: ['spa', 'yoga'],
  nightlife: ['nightlife'],
  keluarga: ['keluarga'],
  romantis: ['romantis'],
  sejarah: ['sejarah', 'kerajinan'],
  'sport-air': ['snorkeling', 'surfing']
};

/* Zona yangVuudsamaperlaku (jarak sangat dekat). */
const ZONA_IDENTIK = ['seminyak', 'canggu'];

/* Prioritas waktu kunjungan (dipakai untuk mengatur urutan di dalam sehari). */
const PRIORITAS_WAKTU = { pagi: 0, makan: 1, siang: 1, senja: 2, malam: 3 };

/* --------------------------------------------------------------------------
   UTILITAS
   -------------------------------------------------------------------------- */

/** Jarak dua titik (km) menggunakan formula haversine. */
function jarakKm(a, b) {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 +
    Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Ubah "08.30" menjadi menit sejak tengah malam. */
function jamKeMenit(jam) {
  const bagian = String(jam || '0.0').split('.');
  return (parseInt(bagian[0], 10) || 0) * 60 + (parseInt(bagian[1], 10) || 0);
}

/** Ubah menit menjadi "08.30". */
function menitKeJam(menit) {
  const total = ((Math.round(menit) % 1440) + 1440) % 1440;
  return String(Math.floor(total / 60)).padStart(2, '0') + '.' + String(total % 60).padStart(2, '0');
}

/** Ambil jam buka & jam tutup dari string "07.00 - 19.00". */
function jamOperasional(jamBuka) {
  const teks = String(jamBuka || '24 jam');
  if (teks.indexOf('24') >= 0) return { buka: 0, tutup: 1439 };
  const bagian = teks.split('-').map((b) => jamKeMenit(b.trim()));
  return { buka: bagian[0] || 0, tutup: bagian[1] || 1439 };
}

/** Deretkan menit menjadi "1 jam 20 menit". */
function durasiTeks(menit) {
  const jam = Math.floor(menit / 60);
  const sisa = menit % 60;
  if (!jam) return sisa + ' menit';
  if (!sisa) return jam + ' jam';
  return jam + ' jam ' + sisa + ' menit';
}

/**
 * Menentukan titik awal perjalanan.
 *
 * - Bila traveler memberi koordinat (pin di peta / hasil pencarian / GPS),
 *   TITIK AWAL memakai koordinat itu untuk semua perhitungan jarak.
 * - Zona (Ubud, Kuta, ...) ditentukan OTOMATIS sebagai zona terdekat,
 *   dipakai untuk harga akomodasi & transportasi.
 *
 * @param {object} preferensi
 * @param {object} wilayah
 * @returns {{lat:number, lng:number, nama:string, zona:object, jarakKeZona:number, dariPin:boolean}}
 */
function titikAwalEfektif(preferensi, wilayah) {
  const zonaAwal = wilayah.zonaById[preferensi.wilayahAwal] || wilayah.zona[0];
  const pin = preferensi.titikAwal;

  const valid = pin && typeof pin.lat === 'number' && typeof pin.lng === 'number' &&
    Number.isFinite(pin.lat) && Number.isFinite(pin.lng) &&
    pin.lat >= BALI_BBOX.latMin && pin.lat <= BALI_BBOX.latMax &&
    pin.lng >= BALI_BBOX.lngMin && pin.lng <= BALI_BBOX.lngMax;

  if (!valid) {
    return {
      lat: zonaAwal.lat, lng: zonaAwal.lng, nama: zonaAwal.nama,
      zona: zonaAwal, jarakKeZona: 0, dariPin: false
    };
  }

  // Zona terdekat otomatis (untuk harga akomodasi & transport).
  let terdekat = zonaAwal;
  let jarakTercapai = Infinity;
  wilayah.zona.forEach((z) => {
    const j = jarakKm(pin, z);
    if (j < jarakTercapai) { jarakTercapai = j; terdekat = z; }
  });

  return {
    lat: pin.lat, lng: pin.lng,
    nama: String(pin.nama || terdekat.nama).slice(0, 120),
    zona: terdekat, jarakKeZona: jarakTercapai, dariPin: true
  };
}

/* --------------------------------------------------------------------------
   PEMILIHAN DESTINASI (skoring oleh kode)
   -------------------------------------------------------------------------- */

/**
 * Skor satu destinasi terhadap preferensi pengguna.
 * Semua angka bisa dipertanggungjawabkan: berbasis kategori, gaya, harga,
 * dan jarak dari wilayah awal.
 */
function skorDestinasi(dest, preferensi, titikAwal) {
  const minat = Array.isArray(preferensi.minat) ? preferensi.minat : [];
  const minatTag = Array.isArray(preferensi.minatTagResolved) ? preferensi.minatTagResolved : [];
  let skor = 0;
  const alasan = [];

  // 1. Kecocokan minat (paling penting).
  if (minat.includes(dest.kategori)) {
    skor += 5;
    alasan.push('kategori ' + dest.kategori + ' sesuai minat');
  } else if (dest.kategori === 'kuliner') {
    skor += 2;
    alasan.push('kuliner untuk makan siang/malam');
  } else if (dest.kategori === 'alam' || dest.kategori === 'budaya') {
    skor += 1;
  }

  // 1b. Kecocokan TAG minat (lebih spesifik dari kategori).
  const tagsDest = Array.isArray(dest.tags) ? dest.tags : [];
  const cocokTag = tagsDest.filter((t) => minatTag.indexOf(t) >= 0);
  if (cocokTag.length) {
    skor += Math.min(3.5, 1.5 + 0.5 * cocokTag.length);
    alasan.push('tag ' + cocokTag.join(', ') + ' sesuai minat');
  }

  // 2. Kesesuaian dengan gaya perjalanan.
  if (preferensi.gaya === 'santai' && dest.intensitas === 'padat') { skor -= 2.5; }
  if (preferensi.gaya === 'padat' && dest.intensitas === 'santai') { skor += 0.5; }
  if (preferensi.gaya === 'santai' && dest.intensitas === 'santai') { skor += 1; }

  // 3. Kesesuaian harga dengan level budget.
  const harga = (dest.hargaTiketLokal || 0) + (dest.biayaAktivitas || 0);
  if (preferensi.budget === 'hemat') {
    if (harga <= 25000) { skor += 2.5; } else if (harga <= 75000) { skor += 1; } else { skor -= 1.5; }
  } else if (preferensi.budget === 'menengah') {
    if (harga <= 100000) { skor += 2; } else if (harga <= 200000) { skor += 0.5; } else { skor -= 1; }
  } else {
    if (harga >= 100000) { skor += 1.5; } else { skor += 0.5; }
  }

  // 4. Jarak dari titik awal (lebih dekat lebih baik).
  const jarak = jarakKm(titikAwal, dest);
  if (jarak <= 12) skor += 2;
  else if (jarak <= 30) skor += 1;
  else if (jarak <= 60) skor -= 0.5;
  else skor -= 2;

  // 5. Tempat yang butuh sehari penuh hanya untuk trip cukup lama.
  if (dest.butuhHariPenuh && preferensi.durasi < 2) { skor -= 10; }

  // 6. Destinasi sama sekali gratis tetap bernilai (bagus untuk budget hemat).
  if ((dest.hargaTiketLokal || 0) === 0 && preferensi.budget === 'hemat') { skor += 1; }

  return { skor: Math.round(skor * 100) / 100, alasan, jarak };
}

/**
 * Memilih dan memberi skor seluruh kandidat, lalu mengurutkannya.
 */
function pilihDestinasi(preferensi, data, wilayah) {
  const awal = titikAwalEfektif(preferensi, wilayah);
  const hasil = [];

  data.destinasi.forEach((dest) => {
    const nilai = skorDestinasi(dest, preferensi, awal);
    if (nilai.skor <= -5) return;   // tidak relevan / tidak terjangkau
    hasil.push(Object.assign({}, dest, { skor: nilai.skor, alasanSkor: nilai.alasan, jarakDariAwal: nilai.jarak }));
  });

  hasil.sort((a, b) => b.skor - a.skor);
  return hasil;
}

/**
 * Menyelesaikan seluruh tag minat yang dipakai untuk skoring:
 *  - tag dari preset minat (mis. "spiritual" -> spiritual, yoga, pura),
 *  - tag dari teks bebas yang sudah dipetakan AI / pencocokan kata kunci.
 *
 * @param {object} preferensi
 * @returns {string[]} daftar tag unik yang sah
 */
function selesaikanTagMinat(preferensi) {
  const hasil = [];
  const tambah = function (t) {
    const tag = String(t || '').trim().toLowerCase();
    if (TAG_VALID.indexOf(tag) >= 0 && hasil.indexOf(tag) < 0) hasil.push(tag);
  };

  // 1. Preset minat.
  (Array.isArray(preferensi.minat) ? preferensi.minat : []).forEach((m) => {
    (MINAT_PRESET[m] || []).forEach(tambah);
  });

  // 2. Tag hasil pemetaan teks bebas.
  (Array.isArray(preferensi.minatTag) ? preferensi.minatTag : []).forEach(tambah);

  // 3. Tag hasil pemetaan teks bebas per-frasa (dari server).
  const perTeks = preferensi.minatTagPerTeks || {};
  Object.keys(perTeks).forEach((k) => {
    (Array.isArray(perTeks[k]) ? perTeks[k] : []).forEach(tambah);
  });

  return hasil;
}

/* --------------------------------------------------------------------------
   PENGELOMPOKAN GEOGRAFIS (satu hari = satu kawasan)
   -------------------------------------------------------------------------- */

/**
 * Mengelompokkan Wiget ke hari berdasarkan kedekatan geografis.
 * Algoritma: greedy nearest-neighbour yang tetap menghormati skor minat.
 */
/**
 * Mengelompokkanpulau ke hari berdasarkan kedekatan geografis.
 *
 * Aturan:
 *  - Hari pertama dimulai dari wilayah awal pengguna.
 *  - Hari berikutnya dilanjutkan dari titik terakhir hari sebelumnya
 *    (rantai rute yang wajar, tidak bolak-balik jauh).
 *  - Jarak antar titik dalam satu hari dibatasi (radius harian).
 *  - Jika jumlah suasana tidak cukup untuk mengisi semua hari, destinasi
 *    yang sama boleh dipakai lagi di hari lain (dengan penalti skor),
 *    karena tidak ada_missing hari kosong.
 */
function kelompokkanHari(kandidat, preferensi, wilayah) {
  const durasi = Math.max(1, Math.min(DURASI_MAX, Number(preferensi.durasi) || 1));
  const perHari = AKTIVITAS_PER_HARI[preferensi.gaya] || 3;
  const awal = titikAwalEfektif(preferensi, wilayah);

  // Destinasi yang butuh sehari penuh berdiri sendiri (mis. Nusa Penida).
  const sehariPenuh = kandidat.filter((d) => d.butuhHariPenuh);
  const biasa = kandidat.filter((d) => !d.butuhHariPenuh);

  const jumlahHariBiasa = Math.max(1, durasi - sehariPenuh.length);
  const perHariEfektif = Math.max(2, Math.min(perHari, Math.ceil(biasa.length / jumlahHariBiasa)));

  const dipakai = new Map();
  const hariGroups = [];
  let titikSebelumnya = { lat: awal.lat, lng: awal.lng };

  for (let d = 0; d < jumlahHariBiasa; d++) {
    const isi = [];
    let anchorHari = null;

    for (let slot = 0; slot < perHariEfektif; slot++) {
      const anchor = anchorHari || titikSebelumnya;

      // Kandidat: belum dipakai di hari ini + dalam radius harian.
      // (satu tempat tidak boleh muncul dua kali dalam satu hari)
      const belumDipakai = biasa.filter((c) => !isi.some((i) => i.id === c.id));
      let calon = belumDipakai.filter((c) => {
        if (!anchorHari) return true;
        return jarakKm(anchorHari, c) <= JARAK_MAX_HARI_KM;
      });
      if (!calon.length) calon = belumDipakai;
      if (!calon.length) break;

      // Skor: minat (skor) - jarak - penalti pemakaian ulang - penalti
      // keberagaman (jangan menumpuk kategori & tag yang sama dalam 1 hari).
      const kategoriHari = new Set(isi.map((i) => i.kategori));
      const tagHari = new Set();
      isi.forEach((i) => (i.tags || []).forEach((tg) => tagHari.add(tg)));

      let terbaik = null;
      let nilaiTerbaik = -Infinity;
      calon.forEach((c) => {
        const j = jarakKm(anchor, c);
        const jumlahPakai = dipakai.get(c.id) || 0;
        const penaltiKategori = kategoriHari.has(c.kategori) ? 0.6 : 0;
        const tagBaru = (c.tags || []).filter((tg) => !tagHari.has(tg)).length;
        const penaltiTag = (c.tags || []).length ? (1 - tagBaru / c.tags.length) * 0.4 : 0;
        const nilai = c.skor * 1.6 - j * 0.22 - jumlahPakai * 7 - penaltiKategori - penaltiTag;
        if (nilai > nilaiTerbaik) { nilaiTerbaik = nilai; terbaik = c; }
      });
      if (!terbaik) break;

      isi.push(terbaik);
      if (!anchorHari) anchorHari = terbaik;
      dipakai.set(terbaik.id, (dipakai.get(terbaik.id) || 0) + 1);
    }

    hariGroups.push(isi);
    if (isi.length) titikSebelumnya = isi[isi.length - 1];
  }

  // Gabungkan hari biasa + hari penuh, lalu urutkan sesuai durasi.
  const semuaHari = hariGroups.filter((h) => h.length > 0).concat(
    sehariPenuh.map((d) => [d])
  );

  while (semuaHari.length < durasi) semuaHari.push([]);

  // Hari pertama harus yang paling dekat dengan titik awal.
  semuaHari.sort((a, b) => {
    const jA = a.length ? jarakKm(awal, a[0]) : 0;
    const jB = b.length ? jarakKm(awal, b[0]) : 0;
    return jA - jB;
  });

  return semuaHari.slice(0, durasi);
}

/* --------------------------------------------------------------------------
   WAKTU TEMPUH ANTAR LOKASI
   -------------------------------------------------------------------------- */

/**
 * Estimasi waktu tempuh (menit) antar duacoa❤️titik.
 * Mempertimbangkan jenis transportasi, faktor jalan, dan jalur khusus kapal.
 */
function waktuTempuh(from, to, jenisTransport) {
  if (!from || !to) return 0;
  if (from.zona && to.zona && from.zona === to.zona && !ZONA_IDENTIK.includes(from.zona)) {
    // Satu zona = jarak pendek.
    return Math.max(10, Math.round((jarakKm(from, to) * 1.3 / 25) * 60) + JEMBAT_ANTAR);
  }
  const straight = jarakKm(from, to) * 1.35;   // faktor jalan (jalan tidak lurus)
  const kecepatan = KECEPATAN[jenisTransport] || 30;

  // Jalur laut Sanur <-> Nusa Penida / Nusa Lembongan.
  const laut = (from.zona === 'sanur' && to.zona === 'nusa-penida') ||
    (to.zona === 'sanur' && from.zona === 'nusa-penida') ||
    (from.zona === 'klungkung' && to.zona === 'nusa-penida') ||
    (to.zona === 'klungkung' && from.zona === 'nusa-penida');
  if (laut) return 60;

  return Math.max(12, Math.round((straight / kecepatan) * 60) + JEMBAT_ANTAR);
}

/* --------------------------------------------------------------------------
   PENYUSUNAN JADWAL PER HARI
   -------------------------------------------------------------------------- */

/**
 * Menyusun jam mulai/selesai tiap item dalam satu hari.
 * Item = aktivitas destinedasi + makan siang + makan malam.
 */
function susunJadwal(items, mulaiMenit, jenisTransport, bahasa) {
  const totalItem = items.length;
  const hasil = [];
  let waktu = mulaiMenit;
  let posisiSebelum = null;

  items.forEach((item) => {
    if (!item) return;
    const tempuh = posisiSebelum ? waktuTempuh(posisiSebelum, item, jenisTransport) : 0;
    let mulai = waktu + tempuh;

    if (item.tipe === 'makan') {
      const target = item.waktu === 'siang' ? JAM_MAKAN_SIANG : JAM_MAKAN_MALAM;
      if (mulai < target) mulai = target;
      const selesai = mulai + DURASI_MAKAN;
      hasil.push(Object.assign({}, item, {
        jamMulai: menitKeJam(mulai),
        jamSelesai: menitKeJam(selesai),
        durasiMenit: DURASI_MAKAN,
        waktuTempuhMenit: tempuh,
        jarakKm: posisiSebelum ? Math.round(jarakKm(posisiSebelum, item) * 10) / 10 : 0
      }));
      waktu = selesai;
      posisiSebelum = item;
      return;
    }

    // Destinasi.
    const oper = jamOperasional(item.jamBuka);
    if (mulai < oper.buka) mulai = oper.buka;

    // Jadwal tetap (mis. Tari Kecak 19.00).
    if (item.jamKhusus && item.jamKhusus.length) {
      const pilihan = item.jamKhusus
        .map((j) => jamKeMenit(j))
        .filter((m) => m >= mulai && m + item.durasiMenit <= oper.tutup)
        .sort((a, b) => b - a)[0];
      if (pilihan === undefined) return;   // tidak ada slot -> lewati
      mulai = pilihan;
    }

    // Utamakan waktu terbaik (senja/malam) untuk item terakhir hari itu saja,
    // supaya hari tetap padat namun tidak melebihi jam operasional.
    const prefer = item.waktuTerbaik;
    const itemTerakhir = hasil.length + 1 >= totalItem;
    if (itemTerakhir && (prefer === 'senja' || prefer === 'malam') && mulai < 16 * 60) {
      const target = prefer === 'malam' ? 18 * 60 + 30 : 16 * 60 + 30;
      if (target + item.durasiMenit <= oper.tutup) mulai = target;
    }

    let selesai = mulai + item.durasiMenit;
    if (selesai > oper.tutup) {
      // Coba geser ke belakang agar masih di dalam jam operasional.
      const baru = oper.tutup - item.durasiMenit;
      if (baru >= oper.buka && baru >= waktu + tempuh) {
        mulai = baru;
        selesai = baru + item.durasiMenit;
      } else {
        return;  // tidak muat -> lewati aktivitas ini
      }
    }

    hasil.push(Object.assign({}, item, {
      jamMulai: menitKeJam(mulai),
      jamSelesai: menitKeJam(selesai),
      durasiMenit: item.durasiMenit,
      waktuTempuhMenit: tempuh,
      jarakKm: posisiSebelum ? Math.round(jarakKm(posisiSebelum, item) * 10) / 10 : 0
    }));
    waktu = selesai;
    posisiSebelum = item;
  });

  return hasil;
}

/* --------------------------------------------------------------------------
   URUTAN DALAM HARI (geografi vs waktu terbaik)
   -------------------------------------------------------------------------- */

/** Panjang rute (km) untuk urutan tertentu. */
function panjangRute(urutan, jenisTransport) {
  let total = 0;
  for (let i = 1; i < urutan.length; i++) total += jarakKm(urutan[i - 1], urutan[i]);
  return total;
}

/**
 * Mengurutkan aktivitas dalam satu hari:
 * bandingkan urutan nearest-neighbour (paling hemat energi) dengan urutan
 * berdasarkan waktu terbaik, lalu pilih yang lebih masuk akal.
 */
function urutkanHari(items, jenisTransport) {
  if (items.length <= 2) return items;

  // A: nearest neighbour mulai dari titik terdekat ke posisi awal.
  const sisa = items.slice();
  const urutA = [];
  let terakhir = null;
  while (sisa.length) {
    let idx = 0;
    let jTerdekat = Infinity;
    sisa.forEach((d, i) => {
      const j = terakhir ? jarakKm(terakhir, d) : 0;
      if (j < jTerdekat) { jTerdekat = j; idx = i; }
    });
    const ambil = sisa.splice(idx, 1)[0];
    urutA.push(ambil);
    terakhir = ambil;
  }

  // B: kelompokkan berdasarkan waktu terbaik (pagi -> siang -> senja -> malam).
  const kelompok = { pagi: [], siang: [], senja: [], malam: [] };
  items.forEach((d) => {
    const k = kelompok[d.waktuTerbaik] ? d.waktuTerbaik : 'siang';
    kelompok[k].push(d);
  });
  const urutB = [];
  ['pagi', 'siang', 'senja', 'malam'].forEach((k) => {
    const isi = kelompok[k];
    if (!isi.length) return;
    let terakhirB = urutB.length ? urutB[urutB.length - 1] : null;
    const temp = isi.slice();
    while (temp.length) {
      let idx = 0;
      let jTerdekat = Infinity;
      temp.forEach((d, i) => {
        const j = terakhirB ? jarakKm(terakhirB, d) : 0;
        if (j < jTerdekat) { jTerdekat = j; idx = i; }
      });
      const ambil = temp.splice(idx, 1)[0];
      urutB.push(ambil);
      terakhirB = ambil;
    }
  });

  const lenA = panjangRute(urutA, jenisTransport);
  const lenB = panjangRute(urutB, jenisTransport);
  return lenB * 1.15 < lenA ? urutB : urutA;
}

/* --------------------------------------------------------------------------
   MAKAN SIANG & MALAM (dari data wilayah)
   -------------------------------------------------------------------------- */

/** Hash string sederhana supaya pilihan kuliner stabil (tidak acak). */
function hashSimple(teks) {
  let h = 0;
  const s = String(teks || '');
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 100000;
  return h;
}

/**
 * Memilih rekomendasi makan siang & malam untuk sebuah hari,
 * berdasarkan zona tempat aktivitas hari itu berada.
 */
function pilihMakan(items, wilayah) {
  const zonaId = items.length ? items[0].zona : 'ubud';
  const zona = wilayah.zonaById[zonaId];

  // Bila zonanya tidak ada di data wilayah (mis. nusa-penida), pakai area
  // hari ini sebagai cadangan supaya rekomendasi makan tetap masuk akal.
  const namaZona = zona
    ? zona.nama
    : (items.length ? (items[0].zonaNama || items[0].wilayah || 'Bali') : 'Bali');
  const latZona = zona ? zona.lat : (items.length ? items[0].lat : 0);
  const lngZona = zona ? zona.lng : (items.length ? items[0].lng : 0);
  const kulinerZona = (zona && zona.kuliner) || [];

  // Jangan tawarkan restoran yang sudah jadi aktivitas di hari yang sama.
  const namaAktivitas = items.map((i) => String(i.nama || '').toLowerCase());
  const kuliner = kulinerZona.filter((k) => {
    const n = String(k.nama || '').toLowerCase();
    return !namaAktivitas.some((a) => n.indexOf(a) >= 0 || a.indexOf(n) >= 0);
  });
  const daftar = kuliner.length ? kuliner : kulinerZona;
  const jumlah = daftar.length || 1;
  const awal = Math.abs(hashSimple(zonaId)) % jumlah;
  const tarifMakan = (zona && zona.makan && zona.makan.menengah) || 65000;

  const buat = function (waktu, pilihan, hargaFallback) {
    return {
      tipe: 'makan',
      waktu: waktu,
      zona: zonaId,
      zonaNama: namaZona,
      nama: pilihan ? pilihan.nama : 'Warung lokal',
      jenis: pilihan ? pilihan.jenis : 'Makanan lokal',
      hargaPerOrang: pilihan ? pilihan.harga : hargaFallback,
      lat: latZona,
      lng: lngZona
    };
  };

  return [
    buat('siang', daftar[awal % jumlah], tarifMakan),
    buat('malam', daftar[(awal + 1) % jumlah], tarifMakan)
  ];
}

/* --------------------------------------------------------------------------
   PERHITUNGAN BUDGET (100% oleh kode)
   -------------------------------------------------------------------------- */

/**
 * Menghitung rincian budget secara deterministik dari data resmi.
 * Tidak ada satupun angka budget yang berasal dari AI.
 *
 * @returns {object} rincian budget lengkap
 */
function hitungBudget(preferensi, hariRencana, wilayah) {
  const budget = preferensi.budget || 'menengah';
  const turis = preferensi.touristType === 'mancanegara';
  const dewasa = Math.max(1, Number((preferensi.traveler || {}).dewasa) || 1);
  const anak = Math.max(0, Number((preferensi.traveler || {}).anak) || 0);
  const traveler = dewasa + anak;
  const durasi = Math.max(1, hariRencana.length);
  const malam = Math.max(0, durasi - 1);
  // Harga akomodasi & transport mengikuti zona TERDEKAT dari titik awal.
  const awal = titikAwalEfektif(preferensi, wilayah);
  const zonaAwal = awal.zona;

  /* --- 1. Akomodasi --- */
  const tipeAkomodasi = preferensi.akomodasi ||
    (budget === 'hemat' ? 'hostel' : budget === 'menengah' ? 'hotel' : 'villa');
  let unitAkomodasi = 1;
  let jumlahUnit = 1;
  let totalAkomodasi = 0;

  if (tipeAkomodasi === 'lainnya') {
    // Biaya diisi traveler: per malam untuk seluruh scaffolder.
    const perMalam = Math.max(0, Number(preferensi.biayaAkomodasiMalam) || 0);
    totalAkomodasi = Math.round(perMalam * malam);
    unitAkomodasi = traveler;
    jumlahUnit = 1;
  } else {
    const tarifAkomodasi = (zonaAwal.akomodasi[tipeAkomodasi] || zonaAwal.akomodasi.hotel)[budget];
    if (tipeAkomodasi === 'hostel') { unitAkomodasi = 1; jumlahUnit = traveler; }
    else if (tipeAkomodasi === 'hotel') { unitAkomodasi = 2; jumlahUnit = Math.ceil(traveler / 2); }
    else { unitAkomodasi = 4; jumlahUnit = Math.ceil(traveler / 4); }
    totalAkomodasi = Math.round(tarifAkomodasi * jumlahUnit * malam);
  }

  /* --- 2. Transportasi --- */
  const jenisTransport = preferensi.transport || 'motor';
  const tr = zonaAwal.transport;
  let totalTransportasi = 0;
  let rincianTransportasi = [];
  if (jenisTransport === 'lainnya') {
    // Biaya diisi traveler: per hari untuk seluruh scaffolder.
    const perHari = Math.max(0, Number(preferensi.biayaTransportHarian) || 0);
    totalTransportasi = Math.round(perHari * durasi);
    rincianTransportasi = [{ nama: 'Biaya transport custom (' + durasi + ' hari)', nilai: totalTransportasi }];
  } else if (jenisTransport === 'motor') {
    const motor = Math.max(1, Math.ceil(traveler / 2));
    const perMotor = (tr.motor.sewa + tr.motor.bahanBakar) * durasi;
    totalTransportasi = Math.round(perMotor * motor);
    rincianTransportasi = [{ nama: 'Sewa motor (' + motor + ' unit)', nilai: totalTransportasi }];
  } else if (jenisTransport === 'mobil') {
    totalTransportasi = Math.round(tr.mobil.harian * durasi);
    rincianTransportasi = [{ nama: 'Sewa mobil + driver (' + durasi + ' hari)', nilai: totalTransportasi }];
  } else {
    totalTransportasi = Math.round(tr.ojek.perHari * durasi);
    rincianTransportasi = [{ nama: 'Ojek online dan taksi (' + durasi + ' hari)', nilai: totalTransportasi }];
  }

  // Kereta ferry menuju Nusa Penida / Nusa Lembongan (dari Sanur).
  const perluKapal = hariRencana.some((h) => h.jadwal.some((j) => j.zona === 'nusa-penida'));
  if (perluKapal && wilayah.zonaById.sanur && wilayah.zonaById.sanur.transport.boat) {
    const boat = wilayah.zonaById.sanur.transport.boat;
    const biayaKapal = Math.max(boat.minimum, boat.perPax * traveler);
    totalTransportasi += Math.round(biayaKapal);
    rincianTransportasi.push({ nama: 'Tiket fast boat Sanur - Nusa Penida', nilai: Math.round(biayaKapal) });
  }

  /* --- 3, 4, 5. Tiket, aktivitas, dan makan (dihitung per hari) --- */
  const perHari = [];
  let totalTiket = 0;
  let totalAktivitas = 0;
  let totalMakan = 0;

  hariRencana.forEach((hari, i) => {
    let tiketHari = 0;
    let aktivitasHari = 0;
    let makanHari = 0;

    hari.jadwal.forEach((item) => {
      if (item.tipe === 'makan') {
        const zonaMakan = wilayah.zonaById[item.zona];
        const tarif = (zonaMakan && zonaMakan.makan)
          ? zonaMakan.makan[budget]
          : zonaAwal.makan[budget];
        makanHari += tarif * traveler;
        item.biayaMakan = Math.round(tarif * traveler);
        item.biayaTiket = 0;
        item.biayaAktivitas = 0;
        item.biayaTotal = item.biayaMakan;
        return;
      }

      // Tiket masuk:foraadult vs anak (50%).
      const hargaDewasa = turis ? (item.hargaTiketTuris || 0) : (item.hargaTiketLokal || 0);
      const hargaAnak = Math.round(hargaDewasa * DISKON_ANAK_TIKET);
      const tiket = hargaDewasa * dewasa + hargaAnak * anak;
      const aktivitas = (item.biayaAktivitas || 0) * traveler;
      tiketHari += tiket;
      aktivitasHari += aktivitas;

      item.hargaTiketAnak = hargaAnak;
      item.biayaTiket = Math.round(tiket);
      item.biayaAktivitas = Math.round(aktivitas);
      item.biayaTotal = Math.round(tiket + aktivitas);
    });

    // Air mineral & camilan.
    makanHari += BIAYA_AIR_HARI * traveler;

    // Alokasi harian untuk aktivitas pilihan & oleh-oleh.
    const aktivitasHarian = Math.round(BIAYA_AKTIVITAS_HARI[budget] * traveler);
    const lainHarian = Math.round(BIAYA_LAIN_HARI[budget] * traveler);

    perHari.push({
      hari: hari.hari,
      akomodasi: 0,
      transportasi: Math.round(totalTransportasi / durasi),
      tiket: Math.round(tiketHari),
      makan: Math.round(makanHari),
      aktivitas: Math.round(aktivitasHari + aktivitasHarian),
      lainLain: lainHarian,
      cadangan: 0,
      total: 0
    });

    totalTiket += tiketHari;
    totalAktivitas += aktivitasHari + aktivitasHarian;
    totalMakan += makanHari;
  });

  /* --- 6. Akomodasi dialokasikan ke malam-malam menginap --- */
  const perMalam = malam > 0 ? Math.round(totalAkomodasi / malam) : 0;
  for (let i = 0; i < perHari.length && i < malam; i++) perHari[i].akomodasi = perMalam;
  const sisaAkomodasi = totalAkomodasi - perMalam * Math.min(malam, perHari.length);
  if (sisaAkomodasi > 0 && perHari.length) perHari[perHari.length - 1].akomodasi += sisaAkomodasi;

  /* --- 7. Dana cadangan 10% per hari --- */
  perHari.forEach((h) => {
    const sub = h.akomodasi + h.transportasi + h.tiket + h.makan + h.aktivitas + h.lainLain;
    h.cadangan = Math.round(sub * PERSEN_CADANGAN);
    h.total = sub + h.cadangan;
  });

  // Kategori = JUMLAH rincian harian (bukan total pembulatan terpisah),
  // sehingga total budget selalu sama persis dengan jumlah rinciannya.
  const kategori = {
    akomodasi: perHari.reduce((s, h) => s + h.akomodasi, 0),
    transportasi: perHari.reduce((s, h) => s + h.transportasi, 0),
    tiket: perHari.reduce((s, h) => s + h.tiket, 0),
    makan: perHari.reduce((s, h) => s + h.makan, 0),
    aktivitas: perHari.reduce((s, h) => s + h.aktivitas, 0),
    lainLain: perHari.reduce((s, h) => s + h.lainLain, 0),
    cadangan: perHari.reduce((s, h) => s + h.cadangan, 0)
  };
  const total = perHari.reduce((s, h) => s + h.total, 0);

  /* --- 8. Status terhadap budget + saran hemat --- */
  const batasPengguna = Number(preferensi.budgetMaks) || 0;
  const batasAcuan = BUDGET_HARIAN_ORANG[budget] * traveler * durasi;
  const batas = batasPengguna > 0 ? batasPengguna : batasAcuan;
  const selisih = total - batas;
  const status = selisih > 0 ? 'melebihi' : 'dalam_budget';

  const saranHemat = [];
  if (status === 'melebihi') {
    const en = preferensi.bahasa === 'en';
    const kandidat = [];

    // 1. Turunkan tipe akomodasi.
    const tarifHostel = zonaAwal.akomodasi.hostel[budget];
    const unitSetara = tipeAkomodasi === 'hostel' ? traveler : jumlahUnit;
    const hematAkomodasi = Math.round(kategori.akomodasi - (tarifHostel * unitSetara * malam));
    if (hematAkomodasi > 0 && tipeAkomodasi !== 'lainnya') {
      kandidat.push({
        judul: en ? 'Switch to a hostel' : 'Turunkan tipe akomodasi',
        detail: en
          ? 'Stay in a hostel or homestay in ' + zonaAwal.nama + ' (' + jumlahUnit + ' unit).'
          : 'Tidur di Hostel/Homestay di ' + zonaAwal.nama + ' (' + jumlahUnit + ' unit).',
        hemat: hematAkomodasi
      });
    }

    // 2. Ganti transportasi ke motor.
    if (jenisTransport !== 'motor') {
      const motor = Math.round((tr.motor.sewa + tr.motor.bahanBakar) * Math.max(1, Math.ceil(traveler / 2)) * durasi);
      const hematTransport = Math.round(kategori.transportasi - motor);
      if (hematTransport > 0) {
        kandidat.push({
          judul: en ? 'Rent a scooter instead' : 'Pakai sewa motor',
          detail: en
            ? 'A scooter is cheaper for ' + traveler + ' travellers on the same routes.'
            : 'Sewa motor lebih hemat untuk ' + traveler + ' orang di jalur yang sama.',
          hemat: hematTransport
        });
      }
    }

    // 3. Ganti sebagian atraksi berbayar dengan tempat gratis.
    const bayar = kategori.tiket + kategori.aktivitas;
    if (bayar > 0) {
      kandidat.push({
        judul: en ? 'Swap paid attractions for free ones' : 'Kurangi aktivitas berbayar',
        detail: en
          ? 'Rice terraces, beaches and temples are free; keep the paid ones for the best spots.'
          : 'Sawah, pantai, dan sebagian pura bisa dimasuki gratis; sisakan atraksi berbayar untuk tempat terbaik.',
        hemat: Math.round(bayar * 0.25)
      });
    }

    // 4. Makan di warung lokal.
    if (kategori.makan > 0) {
      kandidat.push({
        judul: en ? 'Eat at local warungs' : 'Makan di warung lokal',
        detail: en
          ? 'Local warungs and nasi campur are much cheaper than beach clubs.'
          : 'Warung dan nasi campur jauh lebih murah daripada beach club atau restoran turis.',
        hemat: Math.round(kategori.makan * 0.2)
      });
    }

    // 5. Kurangi jumlah hari.
    kandidat.push({
      judul: en ? 'Shorten the trip by one day' : 'Kurangi jumlah hari',
      detail: en
        ? 'Removing one day saves accommodation and transport for a whole day.'
        : 'Memangkas satu hari menghemat akomodasi dan transport untuk satu hari penuh.',
      hemat: Math.round(total / durasi)
    });

    // Ambil 3 saran dengan penghematan terbesar.
    kandidat.sort((a, b) => b.hemat - a.hemat);
    saranHemat.push.apply(saranHemat, kandidat.slice(0, 3));
  }

  return {
    total,
    perOrang: Math.round(total / traveler),
    perHari: Math.round(total / durasi),
    perBulan: null,
    traveler: { dewasa: dewasa, anak: anak, total: traveler },
    malam: malam,
    tipeAkomodasi: tipeAkomodasi,
    jumlahUnit: jumlahUnit,
    unitAkomodasi: unitAkomodasi,
    jenisTransport: jenisTransport,
    rincianTransportasi: rincianTransportasi,
    kategori: kategori,
    rincianHari: perHari,
    status: {
      kode: status,
      batas: Math.round(batas),
      batasAcuan: Math.round(batasAcuan),
      selisih: Math.round(selisih),
      sisa: Math.round(Math.abs(selisih)),
      sumberBatas: batasPengguna > 0 ? 'pengguna' : 'acuan'
    },
    saranHemat: saranHemat,
    kursUSD: wilayah.kursUSD || 16250
  };
}

/**
 * Menyusun jadwal satu hari dan menyesuaikan jumlah aktivitas supaya muat
 * dalam jam operasional (tidak ada aktivitas yang jatuh karena terlalu jauh).
 */
function jadwalUntukHari(urut, minimum, jenisTransport, bahasa, wilayah) {
  const mulai = minimum >= 3 ? JAM_MULAI_PADAT : JAM_MULAI_SANTAI;
  let daftar = urut.slice();
  let terbaik = null;

  const gabungMakan = function (isi) {
    const makan = pilihMakan(isi, wilayah);
    const gabung = [];
    const posisiMakan = Math.max(1, Math.ceil(isi.length / 2));
    isi.forEach((d, idx) => {
      if (idx === posisiMakan) gabung.push(makan[0]);
      gabung.push(d);
    });
    gabung.push(makan[1]);
    return gabung;
  };

  while (daftar.length >= Math.max(1, minimum)) {
    const jadwal = susunJadwal(gabungMakan(daftar), mulai, jenisTransport, bahasa);
    const n = jadwal.filter((j) => j.tipe !== 'makan').length;
    if (!terbaik || n > terbaik.n) terbaik = { jadwal: jadwal, n: n };
    if (n >= minimum) return jadwal;
    if (daftar.length <= minimum) break;

    // Buang satu item: coba yang paling akhir, lalu yang skornya terkecil.
    const tanpaAkhir = daftar.slice(0, daftar.length - 1);
    daftar = tanpaAkhir.length >= minimum
      ? tanpaAkhir
      : daftar.slice().sort((a, b) => a.skor - b.skor).slice(0, daftar.length - 1);
  }

  return terbaik ? terbaik.jadwal : [];
}

/* --------------------------------------------------------------------------
   PENYUSUNAN RENCANA LENGKAP (deterministik, tanpa AI)
   -------------------------------------------------------------------------- */

/**
 * Membuat judul hari dari zona-zona yang dikunjungi.
 * Dipakai sebagai cadangan kalau narasi AI tidak tersedia, supaya rencana
 * dari kode tetap terlihat lengkap.
 *
 * @param {string[]} zonaNama - nama zona unik yang dikunjungi
 * @param {string} bahasa - "id" atau "en"
 * @returns {string} judul hari
 */
function temaOtomatis(zonaNama, bahasa) {
  const en = bahasa === 'en';
  const unik = [];
  (zonaNama || []).forEach(function (z) {
    const nama = String(z || '').trim();
    if (nama && unik.indexOf(nama) < 0) unik.push(nama);
  });

  if (!unik.length) return en ? 'Bali highlights' : 'Sorotan Bali';
  if (unik.length === 1) return unik[0] + (en ? ' & surroundings' : ' & sekitar');
  if (unik.length === 2) return unik[0] + ' & ' + unik[1];

  const awal = unik.slice(0, -1).join(', ');
  return awal + ' & ' + unik[unik.length - 1];
}

/**
 * Membangun rencana lengkap: hari -> item (destinasi + makan) -> budget.
 * Ini yang dikirim ke AI untuk ditulisi narasi, dan yang dipakai sebagai
 * cadangan bila AI gagal.
 */
function bangunRencana(preferensi, data, wilayah) {
  // Selesaikan tag minat sekali, lalu pakai di semua tempat.
  preferensi.minatTagResolved = selesaikanTagMinat(preferensi);

  const kandidat = pilihDestinasi(preferensi, data, wilayah);
  const groups = kelompokkanHari(kandidat, preferensi, wilayah);
  const jenisTransport = preferensi.transport || 'motor';

  const bahasa = preferensi.bahasa || 'id';
  const awal = titikAwalEfektif(preferensi, wilayah);
  const hariRencana = [];
  let nomor = 0;

  groups.forEach((items) => {
    if (!items.length) return;
    nomor += 1;

    const urut = urutkanHari(items, jenisTransport);
    const minimum = preferensi.gaya === 'padat' ? 3 : 2;
    const jadwal = jadwalUntukHari(urut, minimum, jenisTransport, preferensi.bahasa, wilayah);
    if (!jadwal.length) return;

    const hari = {
      hari: nomor,
      // Tema bawaan dari kode; narasi AI (kalau ada) akan menimpanya.
      tema: temaOtomatis(
        jadwal.map((item) => item.zonaNama),
        preferensi.bahasa
      ),
      zonaUtama: jadwal[0].zona,
      zonaNama: jadwal[0].zonaNama || (wilayah.zonaById[jadwal[0].zona] || {}).nama || jadwal[0].wilayah || '',
      jadwal: jadwal.map((item) => decorate(item, wilayah, data))
    };
    hariRencana.push(hari);
  });

  // Budget dihitung setelah jadwal selesai.
  const budget = hitungBudget(preferensi, hariRencana, wilayah);

  // Tambahkan total harian (dari budget per hari) ke setiap hari.
  hariRencana.forEach((h) => {
    const b = budget.rincianHari.find((x) => x.hari === h.hari);
    h.totalBiaya = b ? b.total : 0;
    h.rincianBiaya = b || null;
  });

  // Tag minat yang cocok per tempat (dipakai untuk badge di UI).
  const tagMinat = preferensi.minatTagResolved || [];
  hariRencana.forEach((h) => {
    h.jadwal.forEach((item) => {
      if (item.tipe === 'makan') return;
      item.tagCocok = (item.tags || []).filter((tg) => tagMinat.indexOf(tg) >= 0);
    });
  });

  return {
    ringkasan: '',
    hari: hariRencana,
    budget: budget,
    catatan: cekMinatTeks(preferensi, data, bahasa),
    titikAwal: {
      nama: awal.nama,
      lat: awal.lat,
      lng: awal.lng,
      zona: awal.zona.id,
      dariPin: awal.dariPin
    }
  };
}

/**
 * Memeriksa minat bebas: kalau tidak ada destinasi yang cocok di katalog,
 * buat catatan jujur untuk ditampilkan ke traveler (tidak mengarang tempat).
 *
 * @param {object} preferensi
 * @param {object} data
 * @param {string} bahasa
 * @returns {string[]} catatan jujur untuk ditampilkan ke traveler
 */
function cekMinatTeks(preferensi, data, bahasa) {
  const en = bahasa === 'en';
  const catatan = [];
  const bebas = Array.isArray(preferensi.minatTeks) ? preferensi.minatTeks : [];
  if (!bebas.length) return catatan;

  const perTeks = preferensi.minatTagPerTeks || {};
  const semuaDest = data.destinasi || [];

  bebas.forEach((teks) => {
    const bersih = String(teks || '').trim().slice(0, 100);
    if (!bersih) return;
    const tags = Array.isArray(perTeks[bersih]) ? perTeks[bersih] : [];

    // Tidak ada tag yang cocok sama sekali.
    if (!tags.length) {
      catatan.push(en
        ? 'We have no destination matching "' + bersih + '" in our catalogue, so we show the closest match.'
        : 'Belum ada destinasi untuk "' + bersih + '" di katalog kami, kami tampilkan yang paling mendekati.');
      return;
    }

    // Tag ada, tapi tidak ada destinasi yang memakainya.
    const ada = semuaDest.some((d) => (d.tags || []).some((tg) => tags.indexOf(tg) >= 0));
    if (!ada) {
      catatan.push(en
        ? 'We have no destination matching "' + bersih + '" in our catalogue, so we show the closest match.'
        : 'Belum ada destinasi untuk "' + bersih + '" di katalog kami, kami tampilkan yang paling mendekati.');
    }
  });

  return catatan;
}

/**
 * Melengkapi satu item jadwal dengan data katalog (alamat, koordinat,
 * tips, dress code, dan seterusnya).
 */
function decorate(item, wilayah, data) {
  if (item.tipe === 'makan') {
    return Object.assign({}, item, {
      foto: null,
      mapsUrl: 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(item.nama + ' ' + item.zonaNama + ' Bali')
    });
  }

  const daftar = data.destinasi || [];
  const katalog = (data.index && data.index.get(item.id)) ||
    daftar.find((d) => d.id === item.id) || item;
  return Object.assign({}, item, {
    id: katalog.id,
    nama: katalog.nama,
    namaEn: katalog.namaEn,
    kategori: katalog.kategori,
    tags: Array.isArray(katalog.tags) ? katalog.tags : [],
    wilayah: katalog.wilayah,
    zona: katalog.zona,
    zonaNama: (wilayah.zonaById[katalog.zona] || {}).nama || katalog.wilayah,
    alamat: katalog.alamat,
    lat: katalog.lat,
    lng: katalog.lng,
    mapsUrl: katalog.mapsUrl,
    foto: '/public/images/destinasi/' + katalog.id + '.jpg',
    jamBuka: katalog.jamBuka,
    durasiMenit: katalog.durasiMenit,
    hargaTiket: katalog.hargaTiketLokal,
    hargaTiketLokal: katalog.hargaTiketLokal,
    hargaTiketTuris: katalog.hargaTiketTuris,
    biayaAktivitas: katalog.biayaAktivitas || 0,
    tipsBudaya: katalog.tipsEtika || [],
    tipsBudayaEn: katalog.tipsEtikaEn || [],
    dressCode: katalog.dressCode,
    dressCodeEn: katalog.dressCodeEn,
    keramaian: katalog.keramaian,
    intensitas: katalog.intensitas,
    waktuTerbaik: katalog.waktuTerbaik,
    waktuTerbaikEn: katalog.waktuTerbaikEn,
    deskripsi: katalog.deskripsi,
    catatanAI: katalog.catatanAI
  });
}


/**
 * Membangun rencana dari komposisi hari (daftar id destinasi per hari).
 * Dipakai saat traveler meminta revisi lewat chat: komposisi tempat boleh
 * berubah, tetapi JAM, JARAK, dan BUDGET selalu dihitung ulang oleh kode.
 *
 * @param {object} preferensi - preferensi traveler
 * @param {object} data - data/destinasi.json
 * @param {object} wilayah - data wilayah
 * @param {Array} komposisi - [{ hari: 1, destinasiIds: ['id', ...] }]
 * @param {object} rencanaLama - rencana sebelumnya (cadangan bila komposisi kosong)
 */
function bangunRencanaDariId(preferensi, data, wilayah, komposisi, rencanaLama) {
  preferensi.minatTagResolved = selesaikanTagMinat(preferensi);
  const index = new Map();
  (data.destinasi || []).forEach((d) => index.set(d.id, d));

  const hariLama = (rencanaLama && rencanaLama.hari) || [];
  const hariRencana = [];
  const daftarHari = Array.isArray(komposisi) && komposisi.length ? komposisi : [];

  daftarHari.forEach((h, i) => {
    const ids = Array.isArray(h.destinasiIds) ? h.destinasiIds : [];
    let items = ids.map((id) => index.get(String(id).trim())).filter(Boolean);

    // Bila AI tidak memberi komposisi, pakai isi hari lama.
    if (!items.length && hariLama[i]) {
      items = hariLama[i].jadwal
        .filter((j) => j.tipe !== 'makan')
        .map((j) => index.get(j.id))
        .filter(Boolean);
    }
    if (!items.length) return;

    const urut = urutkanHari(items, preferensi.transport);
    const minimum = Math.min(preferensi.gaya === 'padat' ? 3 : 2, urut.length);
    const jadwal = jadwalUntukHari(urut, minimum, preferensi.transport, preferensi.bahasa, wilayah);
    if (!jadwal.length) return;

    hariRencana.push({
      hari: hariRencana.length + 1,
      tema: h.tema || temaOtomatis(
        jadwal.map((item) => item.zonaNama),
        preferensi.bahasa
      ),
      zonaUtama: jadwal[0].zona,
      zonaNama: jadwal[0].zonaNama || '',
      jadwal: jadwal.map((item) => decorate(item, wilayah, data))
    });
  });

  if (!hariRencana.length) return null;

  const budget = hitungBudget(preferensi, hariRencana, wilayah);
  hariRencana.forEach((h) => {
    const b = budget.rincianHari.find((x) => x.hari === h.hari);
    h.totalBiaya = b ? b.total : 0;
    h.rincianBiaya = b || null;
  });

  const tagMinat = preferensi.minatTagResolved || [];
  hariRencana.forEach((h) => {
    h.jadwal.forEach((item) => {
      if (item.tipe === 'makan') return;
      item.tagCocok = (item.tags || []).filter((tg) => tagMinat.indexOf(tg) >= 0);
    });
  });

  return {
    ringkasan: (rencanaLama && rencanaLama.ringkasan) || '',
    tipsUmum: (rencanaLama && rencanaLama.tipsUmum) || null,
    hari: hariRencana,
    budget: budget,
    catatan: cekMinatTeks(preferensi, data, preferensi.bahasa || 'id'),
    titikAwal: (function () {
      const awal = titikAwalEfektif(preferensi, wilayah);
      return {
        nama: awal.nama, lat: awal.lat, lng: awal.lng,
        zona: awal.zona.id, dariPin: awal.dariPin
      };
    })()
  };
}
/* -------------------------------------------------------------------------- */
module.exports = {
  temaOtomatis,
  titikAwalEfektif,
  selesaikanTagMinat,
  cekMinatTeks,
  // utilitas
  jarakKm,
  jamKeMenit,
  menitKeJam,
  jamOperasional,
  durasiTeks,
  hashSimple,
  // perencanaan
  skorDestinasi,
  pilihDestinasi,
  kelompokkanHari,
  waktuTempuh,
  susunJadwal,
  urutkanHari,
  pilihMakan,
  // budget
  hitungBudget,
  // rencana lengkap
  bangunRencana,
  bangunRencanaDariId,
  decorate,
  // konstanta
  BUDGET_HARIAN_ORANG,
  TAG_VALID,
  MINAT_PRESET,
  DURASI_MAX,
  BALI_BBOX,
  BIAYA_AKTIVITAS_HARI,
  BIAYA_LAIN_HARI,
  BIAYA_AIR_HARI,
  DISKON_ANAK_TIKET,
  PERSEN_CADANGAN,
  AKTIVITAS_PER_HARI,
  MAKAN_PER_HARI,
  DURASI_MAKAN,
  JAM_MAKAN_SIANG,
  JAM_MAKAN_MALAM
};
