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
const JAM_MULAI = 8 * 60;           // 08.00
const JAM_MAKAN_SIANG = 12 * 60 + 30;
const JAM_MAKAN_MALAM = 19 * 60;
const DURASI_MAKAN = 60;            // menit
const JEMBAT_ANTAR = 10;            // menit (parkir + jalan kaki ke lokasi)
const PERSEN_CADANGAN = 0.10;       // dana cadangan 10%

/* Budget harian acuan per orang (dipakai untuk status "dalam budget"). */
const BUDGET_HARIAN_ORANG = { hemat: 400000, menengah: 1200000, mewah: 3000000 };

/* Biaya tambahan per orang per hari (kategori aktivitas & oleh-oleh). */
const BIAYA_AKTIVITAS_HARI = { hemat: 50000, menengah: 150000, mewah: 400000 };
const BIAYA_LAIN_HARI = { hemat: 50000, menengah: 120000, mewah: 300000 };
const BIAYA_AIR_HARI = 10000;       // air mineral & camilan per orang per hari
const DISKON_ANAK_TIKET = 0.5;      // tarif anak umumnya 50% dari dewasa

/* Kecepatan rata-rata (km/jam) per jenis transportasi. */
const KECEPATAN = { motor: 30, mobil: 35, ojek: 25 };

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

/* --------------------------------------------------------------------------
   PEMILIHAN DESTINASI (skoring oleh kode)
   -------------------------------------------------------------------------- */

/**
 * Skor satu destinasi terhadap preferensi pengguna.
 * Semua angka bisa dipertanggungjawabkan: berbasis kategori, gaya, harga,
 * dan jarak dari wilayah awal.
 */
function skorDestinasi(dest, preferensi, zonaAwal) {
  const minat = Array.isArray(preferensi.minat) ? preferensi.minat : [];
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

  // 4. Jarak dari wilayah awal (lebih dekat lebih baik).
  const jarak = jarakKm(zonaAwal, dest);
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
  const zonaAwal = wilayah.zonaById[preferensi.wilayahAwal] || wilayah.zona[0];
  const hasil = [];

  data.destinasi.forEach((dest) => {
    // imparted: exclude if the same destination is already used? (handled later)
    const nilai = skorDestinasi(dest, preferensi, zonaAwal);
    if (nilai.skor <= -5) return;   // tidak relevan / tidak terjangkau
    hasil.push(Object.assign({}, dest, { skor: nilai.skor, alasanSkor: nilai.alasan, jarakDariAwal: nilai.jarak }));
  });

  hasil.sort((a, b) => b.skor - a.skor);
  return hasil;
}

/* --------------------------------------------------------------------------
   PENGELOMPOKAN GEOGRAFIS (satu hari = satu kawasan)
   -------------------------------------------------------------------------- */

/**
 * Mengelompokkan Wiget ke hari berdasarkan kedekatan geografis.
 * Algoritma: greedy nearest-neighbour yang tetap menghormati skor minat.
 */
function kelompokkanHari(kandidat, preferensi, wilayah) {
  const durasi = Math.max(1, Math.min(7, Number(preferensi.durasi) || 1));
  const perHari = AKTIVITAS_PER_HARI[preferensi.gaya] || 3;
  const zonaAwal = wilayah.zonaById[preferensi.wilayahAwal] || wilayah.zona[0];

  const tersedia = kandidat.slice();
  const hari = [];

  // 1. Pisahkan destinasi yang butuh sehari penuh (Nusa Penida & friends).
  const sehariPenuh = tersedia.filter((d) => d.butuhHariPenuh);
  const biasa = tersedia.filter((d) => !d.butuhHariPenuh);

  // 2. Tentukan jumlah hari yang dipakai untuk miejsce biasa.
  const jumlahHariBiasa = Math.max(1, durasi - sehariPenuh.length);

  // 3. Bagi{${destinasi biasa} ke hari berdasarkan kedekatan.
  const hariBiasa = Array.from({ length: jumlahHariBiasa }, () => []);
  let posisi = { lat: zonaAwal.lat, lng: zonaAwal.lng };

  // Titik awal tiap hari: ambil kandidat terbaik yang masih dekat dengan posisi saat ini.
  while (biasa.length > 0) {
    // Cari hari yang masih kosong dan paling dekat dengan posisi sekarang.
    let hariTujuan = -1;
    let jarakTerdekat = Infinity;
    hariBiasa.forEach((isi, i) => {
      if (isi.length > 0) return;
      let minJarak = Infinity;
      biasa.forEach((d) => { const j = jarakKm(posisi, d); if (j < minJarak) minJarak = j; });
      if (minJarak < jarakTerdekat) { jarakTerdekat = minJarak; hariTujuan = i; }
    });
    if (hariTujuan === -1) break;

    // Isi hari tersebut dengan{kandidat terdekat} sampai kuota hari terpenuhi.
    while (hariBiasa[hariTujuan].length < perHari && biasa.length > 0) {
      const pusat = hariBiasa[hariTujuan].length
        ? hariBiasa[hariTujuan][hariBiasa[hariTujuan].length - 1]
        : posisi;

      let pilihan = -1;
      let nilaiTerbaik = -Infinity;
      biasa.forEach((d, i) => {
        const j = jarakKm(pusat, d);
        if (hariBiasa[hariTujuan].length > 0 && j > JARAK_MAX_HARI_KM) return;
        const nilai = d.skor * 1.6 - j * 0.22;
        if (nilai > nilaiTerbaik) { nilaiTerbaik = nilai; pilihan = i; }
      });
      if (pilihan === -1) break;

      const ambil = biasa.splice(pilihan, 1)[0];
      hariBiasa[hariTujuan].push(ambil);
      posisi = { lat: ambil.lat, lng: ambil.lng };
    }
  }

  // 4. Gabungkan hari biasa + hari penuh menjadi urutan hari final.
  const semuaHari = hariBiasa.filter((h) => h.length > 0).concat(
    sehariPenuh.map((d) => [d])
  );

  // 5. Pastikan jumlah hari sesuai durasi (tambah hari kosong bila perlu).
  while (semuaHari.length < durasi) semuaHari.push([]);

  // 6. Susun ulang agar hari pertama dekat dengan wilayah awal.
  semuaHari.sort((a, b) => {
    const jA = a.length ? jarakKm(zonaAwal, a[0]) : 0;
    const jB = b.length ? jarakKm(zonaAwal, b[0]) : 0;
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

    // Utamakan waktu terbaik (senja/malam).
    const prefer = item.waktuTerbaik;
    if ((prefer === 'senja' || prefer === 'malam') && mulai < 16 * 60) {
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

