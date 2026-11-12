# 📋 Deskripsi Singkat Produk

**BaliWise — Perencana Itinerary Bali Berbasis AI dengan Panduan Budaya & Etika**
NAISC 2026 · Kategori Website

---

## 1. Nama Website

**BaliWise** *(gabungan "Bali" + "Wise", melambangkan kecakapan merencanakan)*

- **Tagline:** *"Rencanakan Liburan Bali, Tanpa Lagi Bingung."*
- **URL demo:** `https://[nama-repo].vercel.app`
- **Logo:** perisai segi empat berisi siluet gunung (Bali) dan gelombang laut (pantai), memakai warna hijau tropis dan aksen emas.

---

## 2. Permasalahan DUDI yang Diangkat

**Sektor:** Pariwisata dan Perhotelan · **Wilayah:** Bali, Indonesia

| No | Permasalahan | Dampak bagi wisatawan |
|---|---|---|
| 1 | **Ratusan atraksi tersebar di seluruh Bali tanpa penilaian prioritas.** | Pelancong hari pertama hanya untuk berpindah tempat; waktu dan tenaga terbuang. |
| 2 | **Tidak ada estimasi biaya per hari.** | Budget meleset di tengah perjalanan karena biaya transportasi, tiket, dan makan tidak terperkirakan. |
| 3 | **Wisatawan tidak memahami adat dan etika lokal.** | Tanpa sadar masuk ke area suci tanpa sarong, memotret prosesi beribadah, atau memberi makan satwa liar — berisiko menyinggung warga dan pemangku pura. |
| 4 | **Informasi itinerary tersebar di banyak sumber** (blog, media sosial, peta). | Membingungkan dan sulit dibandingkan. |
| 5 | **Informasi budaya terpisah dari informasi rute.** | Wisatawan tahu *ke mana* pergi, tetapi tidak tahu *bagaimana* berperilaku di sana. |

> **Inti masalah:** ada pemisahan antara *"where to go"* (informasi rute) dan *"how to behave"* (panduan budaya). Itinerary yang ada umumnya tidak menjawab keduanya secara bersamaan.

---

## 3. Tujuan

1. **Menghasilkan itinerary yang benar-benar bisa dijalankan** — durasi, budget, minat, dan gaya perjalanan pengguna menjadi parameter nyata, bukan sekadar saran.
2. **Menyertakan panduan budaya di setiap titik**, bukan satu artikel terpisah di bagian akhir.
3. **Menjaga akurasi informasi** — memastikan setiap rekomendasi benar-benar ada di dunia nyata (anti-halusinasi).
4. **Memberi kontrol penuh kepada pengguna** — hasil AI dapat diubah lewat percakapan biasa.
5. **Menjaga aksesibilitas dan inklusivitas** — dua bahasa, perangkat mobile-first, serta standar aksesibilitas web.

---

## 4. Fitur Utama

| # | Fitur | Ringkasan |
|---|---|---|
| 1 | **Landing page informatif** | Hero, penjelasan masalah dan solusi, 3 langkah cara kerja, 6 fitur, CTA penutup. |
| 2 | **Form preferensi ringkas** | Durasi (1-7 hari), budget (hemat/menengah/mewah), minat (5 kategori, boleh multi-pilih), gaya (santai/padat), wilayah awal, catatan tambahan (maks 300 karakter). |
| 3 | **Itinerary kartu per hari** | Dihasilkan AI, ditampilkan sebagai timeline: jam, nama tempat, aktivitas, estimasi biaya, durasi, dan **Tips Budaya & Etika** per lokasi. |
| 4 | **Chat lanjutan yang mengingat** | Pengguna menulis permintaan bebas; AI membawa itinerary sebelumnya dan riwayat percakapan sebagai konteks, lalu mengembalikan versi terbaru yang langsung dirender ulang. |
| 5 | **Bilingual Indonesia / English** | Toggle mengubah seluruh antarmuka dan bahasa hasil AI (system prompt dibuat dalam dua versi). |
| 6 | **Grounded pada 28 destinasi nyata** | `data/destinasi.json` berisi nama, wilayah, kategori, harga tiket, jam buka, dan tips etika. AI **dilarang** menyebut tempat di luar daftar ini. |
| 7 | **Loading state informatif** | "AI sedang menyusun rencana..." dengan indikator tiga tahap. |
| 8 | **Penanganan error yang ramah** | Pesan spesifik dan tombol coba lagi untuk setiap jenis kegagalan (API key, kuota, timeout, rate limit, JSON tidak valid). |
| 9 | **Validasi berlapis** | Validasi di browser (nyaman) dan di server (aman). |
| 10 | **Responsif dan aksesibel** | Mobile-first; Lighthouse Accessibility 100, Best Practices 100, SEO 100. |

---

## 5. Solusi yang Ditawarkan

**BaliWise** adalah **perencana itinerary AI** yang mengubah lima parameter preferensi sederhana menjadi rencana perjalanan terperinci dalam satu klik, lengkap dengan panduan adab di setiap lokasi.

### Bagaimana solusinya bekerja?

```
Pengguna mengisi 5 preferensi
        |
        v
AI menyusun itinerary harian (dibatasi 28 destinasi nyata)
        |
        v
Server memverifikasi dan meng-grounding-kan setiap butir ke katalog
        |
        v
Hasil ditampilkan sebagai kartu timeline + Tips Budaya & Etika
        |
        v
Pengguna dapat chat untuk mengubah rencana kapan saja
```

### Lima pembeda utama

| # | Pembeda | Cara kerjanya |
|---|---|---|
| 1 | **Grounded, bukan karangan** | 3 lapis: (1) system prompt melarang nama di luar katalog, (2) `responseSchema` Gemini membatasi struktur JSON, (3) **post-filter server membuang** tempat yang tidak ada di katalog. Metadata `tempatDitebuang` membuktikan proses ini berjalan. |
| 2 | **Budaya menyatu dengan rute** | Tips etika diambil langsung dari katalog tiap lokasi sehingga spesifik (sarong di pura, aturan snorkeling, cara menawar di pasar), bukan nasihat generik. |
| 3 | **Chat yang benar-benar mengingat** | Itinerary aktif dikirim balik ke server pada setiap pesan chat, jadi "ganti hari 2 jadi lebih santai" dieksekusi, bukan sekadar dijawab. |
| 4 | **Anti-halusinasi berlapis dengan fallback** | Bila JSON AI tidak valid, aplikasi menampilkan pesan ramah, jawaban mentah (dalam `<details>`), dan tombol coba lagi. **Tidak pernah halaman kosong.** |
| 5 | **Aman secara arsitektur** | API key hanya di environment variable server, input dibatasi 300 karakter, ada rate limit, dan validasi whitelist di sisi server. |

---

## 6. Manfaat Produk

### Bagi Traveler dan Individu

| Manfaat | Bagaimana dihasilkan |
|---|---|
| **Waktu hemat** | Itinerary sudah tersusun per jam, durasi, dan urutan geografis. |
| **Budget terukur** | Estimasi biaya per kegiatan dan total harian yang bisa dibandingkan sebelum berangkat. |
| **Lebih percaya diri dan dihormati** | Tahu aturan sebelum datang: pakai sarong, alur beribadah, etika snorkeling. |
| **Dukungan bahasa** | Antarmuka dan hasil AI dalam Bahasa Indonesia maupun English. |
| **Mudah diubah** | Tidak perlu mengulang dari nol saat ada perubahan rencana. |

### Bagi Stakeholders sektor Pariwisata

| Manfaat | Signifikansi |
|---|---|
| **Promosi budaya yang bertanggung jawab** | Setiap kunjungan datang bersama aturan sopan, sehingga mengurangi keluhan dan konflik dengan warga. |
| **Sirkulasi ke destinasi yang lebih jarang** | Katalog 28 destinasi (termasuk yang belum umum seperti Gitgit, Tirta Gangga, dan Lovina) ikut mendapat perhatian dan kunjungan. |
| **Standarisasi informasi** | Satu sumber acuan terstruktur untuk harga, jam buka, dan etika, mudah diperbarui tim. |
| **Arsitektur yang siap dikembangkan** | Menambah wilayah baru cukup menambah entri JSON, tanpa mengubah kode AI. |

### Keunggulan Kompetitif

- **Gratis untuk dijalankan** — satu serverless function, tanpa database, biaya hosting mendekati nol.
- **Mudah ditiru dan dikembangkan** — Vanilla JS dan satu file backend, bisa di-*fork* dan di-*white-label* untuk kota lain.
- **Terbuka untuk ekstensi** — `data/destinasi.json` adalah titik integrasi utama.

---

## 7. Target Pengguna

| Segmen | Kebutuhan Utama | Bagaimana BaliWise Membantu |
|---|---|---|
| **Wisatawan pertama ke Bali** (segmen utama) | Tidak tahu adat dan etika, takut salah | Tips etika di setiap lokasi, itinerary yang jelas |
| **Pelajar dan mahasiswa** | Budget terbatas, waktu terbatas | Budget hemat, durasi 1-7 hari, estimasi biaya transparan |
| **Keluarga** | Butuh itinerary yang tidak melelahkan dan aman untuk anak | Gaya santai, catatan tambahan seperti "bawa keluarga" |
| **Pencinta fotografi** | Mencari spot menarik yang layak difoto | Tips waktu terbaik per lokasi, aktivitas yang spesifik |
| **Operator tur kecil** | Butuh draf itinerary cepat | Dapat dipakai sebagai generator draf pertama |

---

## 8. Ringkasan Satu Kalimat

> **BaliWise adalah perencana itinerary Bali berbasis AI yang tidak hanya memberi tahu *ke mana* pergi, tetapi juga *bagaimana* berperilaku agar Anda menjadi tamu yang dihormati — dengan 28 destinasi nyata, tips budaya di setiap lokasi, dan chat yang mengingat rencana Anda.**

---

<div align="center">

**BaliWise** · NAISC 2026 · Kategori Website
*Nama Tim: [....] · Sekolah: [....]*

</div>
