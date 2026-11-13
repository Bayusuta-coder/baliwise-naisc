# 🏝️ Griska Go — Perencana Itinerary Bali Berbasis AI

**Griska Go** adalah website perencana perjalanan Bali yang menggunakan **Artificial Intelligence** untuk menyusun itinerary harian sesuai durasi, budget, minat, dan gaya perjalanan pengguna — **dilengkapi panduan budaya & etika di setiap lokasi** agar wisatawan tidak salah adat.

> Proyek ini dibuat untuk **National AI Summit & Competition (NAISC) 2026 — Kategori Website** oleh pelajar SMA/SMK.

---

## 📌 Daftar Isi

1. [Deskripsi Singkat](#1-deskripsi-singkat)
2. [Fitur Utama](#2-fitur-utama)
3. [Teknologi](#3-teknologi)
4. [Cara Kerja Integrasi AI](#4-cara-kerja-integrasi-ai)
5. [Struktur Proyek](#5-struktur-proyek)
6. [Cara Instalasi & Menjalankan di Komputer Sendiri](#6-cara-instalasi--menjalankan-di-komputer-sendiri)
7. [Deploy ke GitHub & Vercel](#7-deploy-ke-github--vercel)
8. [Pengujian](#8-pengujian)
9. [Catatan Penting untuk Juri](#9-catatan-penting-untuk-juri)

---

## 1. Deskripsi Singkat

Wisatawan yang baru pertama kali ke Bali sering menghadapi tiga masalah yang sama:

| Masalah | Akibatnya |
|---|---|
| Terlalu banyak pilihan tempat | Waktu habis di jalan, itinerary kacau |
| Tidak ada estimasi biaya per hari | Budget meleset di tengah perjalanan |
| Tidak paham adat & etika lokal | Tidak sengaja menyinggung warga/pemangku pura |

****Griska Go** menjawab tiga masalah tersebut dengan satu alur sederhana: pengguna mengisi form preferensi, AI menyusun rencana per hari dalam bentuk **kartu timeline** (bukan paragraf panjang), lalu pengguna bisa **mengobrol** untuk mengubah rencana kapan saja.

Yang membedakan Griska Go dari chat AI biasa:

- **Grounded** — AI hanya boleh merekomendasikan tempat yang benar-benar ada di `data/destinasi.json` (28 destinasi nyata). Tempat yang tidak dikenal **otomatis dibuang** oleh server.
- **Berbudaya** — setiap kartu memuat tips etika spesifik untuk lokasinya (sarong, alur beribadah, aturan snorkeling, cara menawar di pasar).
- **Ingat** — chat lanjutan membawa itinerary sebelumnya sebagai konteks, jadi "ganti hari 2 jadi lebih santai" benar-benar dieksekusi.
- **Aman** — API key tidak pernah menyentuh browser; input dibatasi (maks 300 karakter) dan divalidasi berlapis.

---

## 2. Fitur Utama

| # | Fitur | Penjelasan |
|---|---|---|
| 1 | **Landing page** | Hero section + carousel destinasi (auto-play 5 detik, Ken Burns, dots dengan progress bar, swipe, badge tips etika per slide), penjelasan masalah → solusi, 3 langkah cara kerja, 6 kartu fitur, CTA penutup. |
| 2 | **Logo & brand** | Logo dari `public/logo.png` (ganti file, tanpa ubah kode) + wordmark "Griska Go". |
| 3 | **Form preferensi lengkap** | Durasi, budget, minat, gaya, wilayah awal, jumlah traveler (stepper dewasa & anak), jenis wisatawan (domestik/mancanegara), transportasi (motor/mobil+driver/ojek), tipe akomodasi (hostel/hotel/villa), tanggal berangkat, dan budget maksimal opsional. |
| 4 | **Rencana deterministik** | Tempat, urutan harian, jam kunjungan, jarak, dan seluruh budget dihitung **oleh kode** dari data resmi; AI hanya menulis narasi sehingga tidak ada tempat karangan dan total selalu cocok dengan rinciannya. |
| 5 | **Itinerary lengkap per hari** | Tab per hari, timeline kartu aktivitas: jam, kategori, alasan kecocokan, alamat, jarak & waktu tempuh dari titik sebelumnya, harga tiket, tips budaya, dress code, dan tombol Buka di Google Maps. |
| 6 | **Peta rute interaktif** | Leaflet + OpenStreetMap (gratis, tanpa API key): marker bernomor per hari dengan warna berbeda dan garis rute, plus tombol collapse untuk layar kecil. |
| 7 | **Rincian budget** | Donut proporsi + tabel per kategori (akomodasi, transport, tiket, makan, aktivitas, oleh-oleh, dana cadangan 10%) dengan rincian per hari, status terhadap budget, dan saran hemat bila melebihi. |
| 8 | **Aksi & tips** | Cetak/PDF, salin rencana, simpan di perangkat (localStorage), buat ulang, checklist bawaan, waktu terbaik, dan peringatan etika (termasuk Nyepi). |
| 9 | **Kartu timeline** | Tiap aktivitas dirender sebagai kartu: jam mulai-selesai, nama tempat, kategori, narasi aktivitas, alasan kecocokan, foto, alamat, jarak, harga tiket, dan **"Tips Budaya & Etika"** per lokasi. |
| 10 | **Chat lanjutan** | Pengguna dapat bertanya atau meminta perubahan rencana. AI mengingat itinerary yang sudah dibuat dan bisa mengembalikan versi terbaru yang langsung dirender ulang. |
| 11 | **Bilingual ID / EN** | Toggle bahasa mengubah seluruh antarmuka **dan**(system prompt) bahasa hasil AI. Pilihan bahasa disimpan di `localStorage` (dengan `try/catch`). |
| 12 | **Loading state** | Animasi "AI sedang menyusun rencana..." dengan indikator 3 tahap. |
| 13 | **Penanganan error ramah** | Pesan spesifik untuk: API key belum diatur, kuota penuh, timeout, rate limit, JSON tidak valid, dan input tidak valid. |
| 14 | **Validasi form** | Divalidasi dua kali: di browser (instant) dan di server (tidak bisa ditembus). |
| 15 | **Pembatasan input** | Maks 300 karakter untuk catatan & pesan chat; `maxlength` di HTML + slicing di server. |
| 16 | **Responsif** | Mobile-first, CSS Grid + Flexbox, sudah diuji di HP/tablet/laptop. |
| 17 | **Aksesibel** | Label pada semua input, `alt` pada gambar, skip-link, `aria-live`, focus ring, kontras warna ≥ 4.5:1. Skor **Lighthouse A11y = 100**. |

---

## 3. Teknologi

| Lapisan | Teknologi | Alasan |
|---|---|---|
| Frontend | **HTML5, CSS3, Vanilla JavaScript** | Tanpa framework → ringan, cepat, dan mudah dipelajariRevision juri. |
| Styling | CSS Variables + Grid + Flexbox | 3 warna utama (biru laut, hijau tropis, emas), 1 font Google (Plus Jakarta Sans). |
| Backend | **1 Serverless Function (Node.js)** di `api/chat.js` | Dijalankan di Vercel, tanpa server/database. |
| AI | **Google Gemini API** (REST, `gemini-3.8-flash`) | Dipanggil langsung via `fetch` → **tanpa `npm install`**, proyek tetap ringan. AI hanya menulis **narasi**, bukan memilih tempat atau angka. |
| Budget | **Kode deterministik** (`lib/rencana.js`) | Semua nominal dihitung dari harga di data, sehingga total selalu sama persis dengan rinciannya. |
| Data | `data/destinasi.json` | 28 destinasi nyata sebagai *ground truth* anti-halusinasi. |
| Hosting | **Vercel** | Gratis untuk pelajar, auto-deploy dari GitHub, mendukung serverless function + env var. |
| Gambar | Foto lokal (`public/images/hero/*.jpg`) + ikon SVG inline | Ringan, tidak bergantung koneksi saat presentasi. |

> **Tidak ada dependensi npm.** Proyek ini berjalan hanya dengan Node.js bawaan.

---

## 4. Cara Kerja Integrasi AI

### 4.1 Diagram Alur

```
┌──────────────────┐
│  Browser (user)  │  index.html + js/app.js + js/api.js
└────────┬─────────┘
         │ POST /api/chat  { action, bahasa, durasi, budget, minat, ... }
         ▼
┌──────────────────────────────────────────────┐
│  Serverless Function (api/chat.js)          │
│  1. Validasi input (durasi 1-7, budget, dsb) │
│  2. Baca data/destinasi.json (28 destinasi)  │
│  3. Bangun SYSTEM PROMPT + katalog           │
│  4. Panggil Gemini API  (x-goog-api-key)     │
│  5. Parse JSON + filter Anti-halusinasi      │
│  6. Balas JSON bersih ke browser             │
└────────┬─────────────────────────────────────┘
         │ HTTPS  (API key hanya di server!)
         ▼
┌──────────────────┐
│  Google Gemini   │  → JSON itinerary
└──────────────────┘
```

### 4.2 Kenapa harus lewat server?

Kalau browser memanggil Gemini secara langsung, **API key terlihat di DevTools** dan siapa pun bisa mencurinya. Dengan pola ini:

- `AI_API_KEY` hanya ada di **environment variable server** (`process.env.AI_API_KEY`).
- Browser hanya mengenal endpoint `/api/chat` milik kita sendiri.
- Kita juga bisa menambah **validasi, rate limit, dan ground-truth** sebelum data sampai ke AI.

### 4.3 System Prompt (inti anti-halusinasi)

System prompt lengkap bisa dibaca di **`api/chat.js`** pada fungsi `bangunSystemPrompt()` dan `bangunChatPrompt()`. Ringkasnya:

```
Kamu adalah "Griska Go", seorang asisten perencanaan perjalanan yang ahli menjelajah Bali.

ATURAN WAJIB:
1. HANYA boleh merekomendasikan nama tempat yang ada di KATALOG di bawah. DILARANG keras
   menyebut tempat yang tidak ada di katalog.
2. Gunakan HANYA nama tempat dari katalog apa adanya.
3. Setiap jadwal wajib memiliki "tipsBudaya" berisi 2-4 tips etika.
4. Jam kegiatan harus berada di dalam rentang "jamBuka" tempat tersebut.
...
13. Jika catatan tempat menyebut butuh satu hari penuh (misal Nusa Penida),
    jadwalkan sebagai satu-satunya kegiatan hari itu.

FORMAT OUTPUT (WAJIB PERSIS):
Balas HANYA dengan objek JSON valid tanpa teks tambahan, tanpa markdown, tanpa code fence.
```

Ditambah **katalog 28 destinasi** (nama, wilayah, kategori, harga tiket, jam buka, durasi, deskripsi, tips etika, catatan AI) yang dikirim sebagai bagian prompt.

### 4.4 Format JSON yang diminta ke AI

```jsonc
{
  "ringkasan": "ringkasan rencana 1-2 kalimat",
  "totalEstimasi": 1234567,
  "hari": [
    {
      "hari": 1,
      "tema": "tema singkat hari tersebut",
      "totalBiaya": 450000,
      "jadwal": [
        {
          "jam": "08.00",
          "namaTempat": "Pura Uluwatu",        // HARUS ada di katalog
          "wilayah": "Badung",
          "kategori": "budaya",
          "aktivitas": "deskripsi aktivitas singkat",
          "durasiMenit": 90,
          "estimasiBiaya": 50000,
          "tipsBudaya": ["Pakai sarong.", "..."],   // wajib ada
          "transportasi": "catatan transport singkat"
        }
      ]
    }
  ]
}
```

### 4.5 Pipeline anti-halusinasi (3 lapis)

| Lapis | Mekanisme | Lokasi kode |
|---|---|---|
| 1 — **Prompt** | AI diperintah hanya memakai nama dari katalog + contoh struktur JSON | `bangunSystemPrompt()` |
| 2 — **API constraint** | `responseMimeType: "application/json"` + `responseSchema` → Gemini dijamin balas JSON valid | `jadwalSchema()` |
| 3 — **Post-filter** | Server mencocokkan tiap `namaTempat` dengan katalog. **Tidak cocok → dibuang.** `wilayah`/`kategori`/`hargaTiket` selalu diambil dari katalog (grounding). | `bersihkanItinerary()` |

### 4.6 Parsing & fallback

`parseJSONAman()` menangani semua kemungkinan balasan AI:

1. JSON polos → langsung di-parse.
2. JSON di dalam code fence ```` ```json ... ``` ```` → fence dibuang.
3. Teks tambahan di sekitar JSON → objek JSON terluar diambil dengan pemindaian kurung kurawal yang aman terhadap string & escape.
4. **JSON terpotong** (balasan kena `maxOutputTokens` dan terputus di tengah kalimat) → `perbaikiJSONTerpotong()` menutup kurung & string yang menggantung, lalu membuang anggota terakhir yang belum lengkap. Hasilnya: hari/aktivitas yang **sudah lengkap tetap terpakai** sebagai narasi.
5. Tetap tidak terbaca → **fallback**, lihat di bawah.

> **Kontrak utama:** untuk aksi `generate`, kegagalan AI **tidak pernah** menjadi error ke pengguna.
> Server selalu membalas HTTP 200 dengan rencana lengkap dari kode (`lib/rencana.js`) plus
> `meta.narasiAI: false`, dan frontend menampilkan notifikasi kecil
> *"Narasi AI sedang tidak tersedia, tetapi rencana & biaya dihitung lengkap dari data lokal."*
> Rute, jam, dan budget **tidak pernah** bergantung pada AI.

### 4.7 Dua aksi API

| `action` | Kapan dipakai | Data yang dikirim |
|---|---|---|
| `generate` | Saat pengguna menekan tombol submit | Preferensi (durasi, budget, minat, gaya, wilayah awal, catatan) |
| `chat` | Saat pengguna mengirim pesan chat | Pesan (maks 300 karakter), **itinerary saat ini**, dan riwayat percakapan (12 pesan terakhir) |

Karena `chat` selalu membawa `itinerary`, AI **benar-benar mengingat** rencana yang sudah dibuat.

### 4.8 Rantai Model Gemini (anti 404)

> **Latar belakang:** model `gemini-2.0-flash` **sudah dihapus (shut down) oleh Google**, sehingga
> permintaan ke model itu selalu dibalas **HTTP 404 "not found"**. Model yang dipakai sekarang
> adalah `gemini-3.8-flash`. Selain memperbarui nama model, server juga memakai **rantai model**
> supaya aplikasi tetap berjalan walaupun satu model sedang bermasalah.

**Urutan percobaan** (dari `daftarModel()`):

| Urutan | Sumber | Default |
|---|---|---|
| 1 | `AI_MODEL` (utama) | `gemini-3.8-flash` |
| 2 | `AI_MODEL_FALLBACK` (cadangan) | `gemini-2.5-flash` |
| 3 | `AI_MODEL_DARURAT` (darurat) | `gemini-3.6-flash` |
| 4-5 | Jaring pengaman bawaan | `gemini-3.5-flash-lite`, `gemini-3.1-flash-lite` |

**Aturan perpindahan model:**

| Status dari Google | Tindakan |
|---|---|
| `404` model tidak ada | Langsung ke model berikutnya, dan model ini **dilewati 30 menit** ke depan |
| `503` high demand / overload | Langsung ke model berikutnya, model ini **diberi jeda 10 menit** (supaya request berikutnya tidak menunggu) |
| `400` payload ditolak | Coba variasi parameter pada model yang sama (tanpa `responseSchema`) |
| `401` / `403` | Berhenti — masalah API key, bukan model |
| `429` kuota penuh | Kuota dihitung **per model**: model ini diberi jeda 65 menit, lalu mencoba model lain |

**Variasi parameter** (dicoba berurutan pada model yang sama):

1. `responseMimeType: application/json` + `temperature` (**tanpa** `responseSchema`) — dipakai paling dulu
2. Mode JSON + `thinkingConfig: { thinkingBudget: 0 }` (matikan "thinking" kalau model mendukung)
3. `responseMimeType` + `responseSchema` + `temperature`
4. `responseMimeType` + `responseSchema` + `thinkingBudget: 0`
5. `responseMimeType` saja (paling minimal)

Semua langkah tetap **meminta JSON lewat system prompt**, dan hasilnya tetap diparse dengan
parser berlapis — jadi **`responseSchema` hanya bonus**, bukan satu-satunya penopang.

> **Kenapa JSON mode tanpa schema didahulukan?** Pada beberapa model (terutama `*-flash-lite`),
> `responseSchema` memicu *pengulangan kalimat* sampai kena batas token, sehingga JSON-nya
> terpotong di tengah. Tanpa schema, model menulis JSON yang rapi **dan jauh lebih cepat**
> (hasil uji: 4,6 detik & 12/12 tempat punya narasi, vs 15 detik & JSON terpotong).

> **Catatan penting:** `gemini-2.5-flash` sudah *deprecated* dan **tidak tersedia untuk kunci API
> baru** (Google membalas 404: *"no longer available to new users"*). Karena itu, untuk kunci baru
> sebaiknya isi `AI_MODEL_FALLBACK=gemini-3.6-flash` di file `.env`.

### 4.9 Batas waktu & pesan error yang ditampilkan ke pengguna

**Batas waktu (server):**

| Konstanta | Nilai | Arti |
|---|---|---|
| `AI_TIMEOUT_MS` | 27 detik | Batas satu percobaan ke Gemini |
| `AI_TIMEOUT_PERTAMA_MS` | 16 detik | Batas percobaan pertama (model yang lambat tidak ditunggu penuh) |
| `AI_TOTAL_BUDGET_MS` | 45 detik | Anggaran TOTAL satu permintaan (semua model + variasi) |
| `vercel.json` `maxDuration` | 60 detik | Batas fungsi di Vercel (harus &gt; anggaran AI) |
| `js/api.js` `TIMEOUT_MS` | 68 detik | Batas di sisi browser (sedikit lebih besar dari server) |

Nilai-nilai ini **bisa diubah lewat environment variable** (lihat `.env.example`).

**Kalau AI timeout / gagal, tidak ada halaman error.** Server membalas HTTP 200 dengan
rencana lengkap dari kode dan `meta.narasiAI: false`. Notifikasi kecil yang muncul:

> *"Narasi AI sedang tidak tersedia, tetapi rencana & biaya dihitung lengkap dari data lokal."*

Tabel error di bawah hanya berlaku untuk aksi `chat` (revisi) dan kesalahan validasi:

| Kode | Kondisi | Pesan di layar |
|---|---|---|
| `AI_QUOTA` | 429 | "Kuota AI sedang penuh, coba lagi 1 menit lagi." |
| `AI_AUTH` | 401/403 | "API key tidak valid." |
| `AI_MODEL_UNAVAILABLE` | Semua model 404 | "Model AI tidak tersedia." |
| `AI_UNREACHABLE` | 503 | "Layanan AI sedang tidak dapat diakses. Silakan coba lagi." |
| `AI_REJECTED` | 400 | "Permintaan ditolak oleh layanan AI. Coba ubah preferensi Anda." |
| `TIMEOUT` | Melewati batas waktu | "AI terlalu lama merespons. Silakan coba lagi." |
| `SERVER_ERROR` | Lainnya | "Terjadi kesalahan, silakan coba lagi." |

Di **terminal**, server selalu mencatat model yang dicoba, statusnya, dan durasinya:

```
[Griska Go] Gemini HTTP 200 | model=gemini-3.5-flash-lite | 2413ms
[Griska Go] Gemini timeout | model=gemini-3.8-flash | 16000ms
[Griska Go] Timeout pada model=gemini-3.8-flash (16010ms) -> pindah ke model cadangan.
[Griska Go] Kuota model "gemini-3.6-flash" habis - dicoba lagi setelah 65 menit.
[Griska Go] AI tidak tersedia | model=gemini-3.1-flash-lite | status=503 | 6931ms | narasi dilewati, rencana dari kode yang dipakai.
```

**API key tidak pernah ikut dicetak ke log.**

### 4.10 Tombol "Lewati narasi AI"

Saat loading, traveler bisa menekan **"Lewati narasi AI"**. Yang terjadi:

1. Permintaan yang sedang berjalan dibatalkan (`AbortController` di browser).
2. Permintaan baru dikirim dengan `tanpaNarasi: true` -> server **melewati AI sepenuhnya**.
3. Rencana (tempat, jam, rute, budget, tema hari, tips) tetap lengkap,
   dengan `meta.narasiAI: false` dan notifikasi kecil di atas.

Token permintaan (`tokenPermintaan`) mencegah respons lama menimpa hasil yang lebih baru.

---

## 4c. Titik Awal Bebas, Minat Bebas & Opsi "Lainnya"

### Titik awal (3 cara, satu sumber kebenaran)

| Cara | Cara kerja | Data yang dikirim |
|---|---|---|
| (a) Daftar wilayah | Dropdown 15 wilayah Bali | `wilayahAwal` (id zona) |
| (b) Cari nama tempat | Ketik hotel/tempat -> `/api/chat` action `geocode` -> Nominatim (OpenStreetMap), bbox Bali, debounce 600 ms, maks 1 request/detik, `User-Agent` benar | `titikAwal: { nama, lat, lng }` |
| (c) Klik pin di peta | Peta Leaflet, klik untuk menandai; titik bisa digeser | `titikAwal: { nama, lat, lng }` |
| GPS | Tombol "Pakai lokasi saya" (izin diminta dengan sopan) | `titikAwal: { nama, lat, lng }` |

Koordinat titik awal dipakai `lib/rencana.js` untuk **jarak, klaster hari, dan harga
akomodasi** (zona terdekat ditentukan otomatis). Bila titik di luar Bali, searching
gagal, atau offline: pesan ramah + fallback ke pilihan dropdown, **tidak pernah error**.

### Minat bebas + tag katalog

Setiap destinasi di `data/destinasi.json` punya array `tags` (20 tag whitelist:
`spiritual`, `yoga`, `fotografi`, `sunrise`, `sunset`, `surfing`, `snorkeling`, `trekking`,
`spa`, `nightlife`, `keluarga`, `romantis`, `sejarah`, `kuliner-lokal`, `kerajinan`, `pasar`,
`air-terjun`, `sawah`, `pura`, `pantai-sepi`).

Alurnya:

1. Traveler mengetik minat bebas (maks 100 karakter, maks 5 butir, tampil sebagai chip).
2. AI memetakan teks itu ke tag (JSON mode, timeout pendek, **hanya tag dari whitelist**;
   tag di luar daftar dibuang di server).
3. Bila AI gagal/timeout -> fallback pencocokan kata kunci sederhana.
4. `lib/rencana.js` memakai tag untuk skoring (tag + kategori + kedekatan + keberagaman),
   dan menampilkan badge tag yang cocok di kartu aktivitas.
5. Bila **tidak ada**-spot di katalog yang cocok -> `meta.catatan` berisi jawaban jujur,
   mis. *"Belum ada destinasi untuk 'ski salju' di katalog kami, kami tampilkan yang paling
   mendekati."* Tidak ada tempat karangan.

### Keamanan teks bebas

Teks dari traveler **tidak pernah** masuk mentah ke prompt AI. Server menyanitasi:
karakter kontrol dibuang, kurung JSON dibuang, panjang dipotong, dan teks yang berisi
upaya prompt injection dibuang **seluruhnya**. Browser juga menolak teks seperti itu
sebelum dikirim (pertahanan lapis pertama).

### Opsi "Lainnya"

| Field | Opsi | Cara hitung |
|---|---|---|
| Durasi | 1-7 tombol + "Lainnya" | 8-14 hari |
| Traveler | Input angka langsung | Dewasa maks 20, anak maks 10 |
| Transportasi | Motor / Mobil / Ojek / **Lainnya** | Biaya per hari dari traveler x jumlah hari (tiket fast boat Nusa Penida tetap ditambahkan) |
| Akomodasi | Hostel / Hotel / Villa / **Lainnya** | Biaya per malam dari traveler x jumlah malam |

---

## 4b. Arsitektur bagian "Rencanakan" (tempat, jam, dan budget dihitung kode)

Inti produk ini memakai pemisahan tugas yang tegas:

| Lapis | Tugas | Sumber kebenaran |
|---|---|---|
| **Kode** (`lib/rencana.js`) | Memilih destinasi, mengelompokkannya secara geografis, menyusun jam, menghitung jarak, dan menghitung seluruh budget | `data/destinasi.json` + `data/wilayah.json` |
| **AI** (Gemini) | Menulis narasi: ringkasan, tema hari, deskripsi aktivitas, alasan kecocokan, rekomendasi menu, tips umum | Rencana dari kode (tidak boleh diubah) |

Dengan pembagian ini:

1. **Tidak ada tempat karangan.** AI tidak pernah memilih atau menambah nama tempat; ia hanya menulis cerita untuk tempat yang sudah ditentukan kode.
2. **Total selalu cocok.** `total = jumlah seluruh rincian`, dijamin oleh `hitungBudget()`.
3. **Rute logis.** Hari dibentuk berdasarkan kedekatan geografis (haversine + greedy nearest-neighbour), bukan tebakan AI.
4. **Tetap jalan tanpa API key.** Bila AI gagal (kuota, timeout, JSON rusak), server tetap mengembalikan rencana lengkap dari data lokal dengan penanda `meta.narasiAI: false`.

### Alur di server

```
1. validasiPreferensiLengkap()  -> traveler, tipe turis, transport, akomodasi, budget maks
2. R.bangunRencana()            -> pilih destinasi + kelompok hari + jam + budget (KODE)
3. AI menulis narasi             -> digabung lewat gabungkanNarasi() (id asing diabaikan)
4. kirimJSON()                   -> { itinerary, budget, meta }
```

### Revisi lewat chat

Saat traveler meminta perubahan, AI mengembalikan **komposisi hari baru** (daftar id destinasi per hari).
Kode lalu membangun ulang jadwal, jarak, dan budget dari komposisi tersebut, sehingga hasil revisi
selalu konsisten dengan rincian biaya yang baru.
---

## 5. Struktur Proyek

```
naisc-wisata/
│
├── index.html              # Halaman tunggal: hero, fitur, form, hasil, chat, footer
├── css/
│   ├── style.css           # Token, reset, komponen, navbar, form, hasil, chat, footer
│   ├── home.css            # Landing page: hero, carousel, section utama, CTA penutup
│   └── planner.css         # Bagian "Rencanakan": form, itinerary, peta, budget, tips
├── js/
│   ├── i18n.js             # Kamus dua bahasa (ID/EN) + helper terjemahan
│   ├── api.js              # Client API: POST /api/chat + pesan error ramah
│   ├── app.js              # Logika UI: validasi, render timeline, chat
│   ├── brand.js            # Komponen logo (ganti file di /public/logo.png)
│   ├── nav.js              # Navbar: efek glass, menu aktif, drawer mobile
│   ├── carousel.js         # HeroCarousel: auto-play, dots, swipe, badge tips
│   ├── countup.js          # Animasi angka statistik saat masuk viewport
│   ├── hasil.js            # Renderer hasil itinerary (ringkasan, timeline, budget, tips)
│   ├── peta.js             # Peta rute Leaflet + OpenStreetMap (CDN, tanpa API key)
│   └── chart.js            # Diagram donut proporsi budget (SVG murni)
│   └── reveal.js           # Animasi fade-up tiap section saat di-scroll
├── api/
│   └── chat.js             # Serverless function: narasi AI + validasi + budget
├── lib/
│   └── rencana.js          # MESIN RENCANA DETERMINISTIK: pilih tempat, susun jam, hitung budget
├── data/
│   └── └──destinasi.json   # 28 destinasi nyata = ground truth anti-halusinasi
├── public/
│   ├── logo.png            # LOGO GRISKA GO (ganti file ini, tanpa ubah kode)
│   └── images/hero/        # Gambar carousel hero (hero-1.jpg ... hero-5.jpg)
├── tools/
│   ├── dev-server.js       # Server dev lokal (statis + /api/chat) tanpa Vercel CLI
│   ├── test-api.js         # 42 uji otomatis untuk logika backend
│   ├── scan.js             # Pemeriksa kebersihan teks seluruh berkas
│   ├── test-rencana.js     # Uji mesin rencana + budget untuk 3 skenario
│   ├── make-placeholder-logo.js # Membuat ulang placeholder logo PNG
│   ├── validate-mermaid.js # Validator sintaks diagram Mermaid (opsional)
│   ├── probe-gemini.js     # Diagnosa: model Gemini mana yang tersedia
│   ├── make-placeholder-logo.js # Membuat ulang placeholder logo PNG
│   └── restore-env.js      # memulihkan .env dari riwayat lokal VS Code
├── docs/                   # Materi lomba
│   ├── 01-DOKUMEN-ARSITEKTUR.md   # Dokumen perancangan arsitektur + 6 diagram Mermaid
│   ├── 02-DESKRIPSI-PRODUK.md     # Deskripsi singkat produk
│   ├── 03-NASKAH-VIDEO.md         # Naskah video demo 3 menit per adegan
│   ├── 04-BAHAN-PRESENTASI.md     # Ringkasan presentasi 5 menit
│   └── 04-QA-JAWAB.md             # 10 pertanyaan juri + contoh jawaban
├── vercel.json             # Konfigurasi Vercel (function, header keamanan)
├── package.json            # Hanya script (tidak ada dependency)
├── .env.example            # Contoh environment variable
├── .gitignore              # Mengabaikan .env & node_modules
└── README.md               # Dokumen ini

> Catatan: file katalog data bernama `destinasi.json` (bukan `destinations.json`) agar konsisten dengan seluruh kode dan dokumen.

### Cara mengganti logo & gambar hero

| Yang diganti | Lokasi | Catatan |
|---|---|---|
| Logo aplikasi | `public/logo.png` | Sudah terisi logo resmi "Griska Go" (wordmark, sudah di-crop & dioptimasi ke 520×165 / 76 KB). Untuk menggantinya: taruh file PNG baru di `public/logo.png` — **tanpa ubah kode**, langsung terpakai. Kalau file Anda SVG, simpan sebagai `public/logo.svg` lalu ubah satu baris `LOGO_SUMBER` di `js/brand.js`. Logo otomatis menyesuaikan ukuran (mark persegi maupun wordmark lebar) dan teks "Griska Go" disembunyikan otomatis kalau logonya berupa wordmark. |
| Gambar carousel | `public/images/hero/hero-1.jpg` ... `hero-5.jpg` | Urut: Ulun Danu Beratan, Uluwatu, Tegallalang, Kelingking, Tanah Lot. Rasio ideal 4:3 (1280×960). Sumber asli (mentah) ada di folder `galery/`. |

---

## 6. Cara Instalasi & Menjalankan di Komputer Sendiri

### Prasyarat
- **Node.js 18 atau lebih baru** — cek dengan `node -v`
- API key Google Gemini (gratis) dari <https://aistudio.google.com/apikey>
- Browser modern (Chrome/Edge/Firefox)

### Langkah

**1. Buka folder proyek**

```bash
cd naisc-wisata
```

**2. Buat file `.env`**

Windows (PowerShell):
```powershell
Copy-Item .env.example .env
```

macOS / Linux:
```bash
cp .env.example .env
```

**3. Isi API key** — buka `.env` dengan Notepad, lalu ganti baris ini:

```env
AI_API_KEY=AIzaSy...kunci_anda_asli...
AI_MODEL=gemini-3.8-flash
AI_MODEL_FALLBACK=gemini-3.6-flash
AI_MODEL_DARURAT=gemini-3.5-flash-lite
```

> ⚠️ **Jangan pernah** mengunggah file `.env` ke GitHub. File ini sudah otomatis diabaikan oleh `.gitignore`.

**4. Jalankan server pengembangan**

```bash
npm run dev
```

Atau tanpa npm:
```bash
node tools/dev-server.js
```

**5. Buka di browser**

```
http://localhost:3000
```

Selesai. Form, tombol, dan chat sudah berfungsi penuh.

### Mode Mock (belum punya API key?)

Kalau ingin mencoba tampilan tanpa memakai kuota API, jalankan:

```bash
# Windows PowerShell
$env:MOCK_AI="1"; node tools/dev-server.js
```

Mode ini mengembalikan itinerary contoh sehingga frontend bisa diuji sepenuhnya.

### Caraalternative memakai Vercel CLI (paling mirip produksi)

```bash
npm install -g vercel
vercel login
vercel          # development
vercel --prod   # production
```

CLI akan meminta Anda membuat environment variable `AI_API_KEY` di dashboard Vercel.

---

## 7. Deploy ke GitHub & Vercel

### 7.1 Push ke GitHub

```bash
# 1. Inisialisasi repositori (pastikan sudah masuk folder naisc-wisata)
git init
git add .
git commit -m "Griska Go - perencana itinerary Bali berbasis AI (NAISC 2026)"

# 2. Hubungkan ke GitHub (ganti dengan username & nama repo Anda)
git remote add origin https://github.com/USERNAME/NAMA-REPO.git

# 3. Upload
git branch -M main
git push -u origin main
```

> Verifikasi bahwa `.env` **tidak** ikut ter-upload:
> ```bash
> git status        # .env tidak boleh muncul
> ```

Alternatif lewat GitHub Desktop: *Add local repository* → pilih folder → isi commit message → *Push origin*.

### 7.2 Deploy ke Vercel

**Cara A — lewat dashboard (paling mudah untuk pelajar):**

1. Buka <https://vercel.com> → **Sign Up** (gratis, bisa pakai akun GitHub).
2. Klik **Add New... → Project** → **Import** repository `NAMA-REPO`.
3. Pada halaman konfigurasi:
   - **Framework Preset:** `Other`
   - **Root Directory:** kosongkan (biarkan root repo)
   - **Build Command:** kosongkan
   - **Output Directory:** kosongkan
4. Klik **Deploy**.

**Cara B — lewat CLI:**

```bash
npm install -g vercel
vercel login
vercel --prod
```

### 7.3 ⚠️ Mengatur Environment Variable `AI_API_KEY` (WAJIB)

> **Ini langkah yang paling sering terlewat. Tanpa ini, website akan menampilkan error "AI_API_KEY belum diatur".**

1. Di dashboard Vercel, buka project Anda → tab **Settings** → menu **Environment Variables**.
2. Klik **Add Environment Variable**, lalu isi:

| Name (Key) | Value | Environment |
|---|---|---|
| `AI_API_KEY` | `AIzaSy...kunci_anda_asli...` | ✅ Production, ✅ Preview, ✅ Development |
| `AI_MODEL` *(opsional)* | `gemini-3.8-flash` | ✅ Production, ✅ Preview, ✅ Development |
| `AI_MODEL_FALLBACK` *(opsional)* | `gemini-3.6-flash` | ✅ Production, ✅ Preview, ✅ Development |
| `AI_MODEL_DARURAT` *(opsional)* | `gemini-3.5-flash-lite` | ✅ Production, ✅ Preview, ✅ Development |

3. Klik **Add** untuk setiap variabel.
4. Klik **Save**.
5. **Deploy ulang** (wajib!): tab **Deployments** → ikon `⋯` → **Redeploy**.

Alternatif via CLI:

```bash
vercel env add AI_API_KEY production
# lalu tempel kuncinya dan tekan Enter
```

Atau langsung dari file `.env`:

```bash
vercel env add AI_API_KEY production < .env
```

### 7.4 Verifikasi

Buka URL Vercel Anda (misal `https://naisc-wisata.vercel.app`), lalu:
1. Isi form preferensi → tekan **"Susun Itinerary dengan AI"**.
2. Pastikan kartu itinerary muncul (bukan pesan error).
3. Coba chat: **"ganti hari 2 jadi lebih santai"**.
4. Ganti toggle **ID / EN** dan pastikan antarmuka berubah.
5. Uji **"Lewati narasi AI"**: tekan tombol itu saat loading — rencana harus langsung
   muncul (tanpa menunggu) dengan notifikasi "Narasi AI sedang tidak tersedia...".

Jika muncul error `NO_API_KEY`, ulangi langkah 7.3 lalu redeploy.

---

## 8. Pengujian

Proyek menyertakan uji otomatis untuk logika backend (tanpa memanggil API sungguhan):

```bash
npm test                          # semua uji di bawah + pemeriksaan kebersihan teks

node tools/test-api.js            # 48 uji: logika backend, validasi, prompt, handler
node tools/test-rencana.js        # 40 uji: mesin rencana + budget untuk 3 skenario
node tools/test-json-terpotong.js # 12 uji: parser JSON tolerate + pemotongan teks
node tools/test-waktu.js          # waktu respons & jalur fallback saat AI timeout
```

Untuk mengukur waktu respons sungguhan (server lokal sudah jalan):

```bash
node tools/ukur-waktu.js          # tabel waktu respons 1 hari, 3 hari, 7 hari
```

Hasil: **100 uji lulus, 0 gagal**, meliputi:

- Parser JSON (code fence, teks tambahan, string berisi `{}`, non-JSON).
- Parser JSON **terpotong** (balasan kena batas token): kurung & string yang menggantung
  ditutup, anggota yang belum lengkap dibuang, sisanya tetap terpakai.
- Pemotongan teks AI (tema hari & alasan dibatasi 120/160 karakter).
- Post-filter anti-halusinasi (tempat fiktif dibuang, data di-*grounding* ke katalog).
- Validasi preferensi (durasi, budget, minat, gaya, wilayah, panjang catatan).
- System prompt (memuat seluruh katalog & aturan anti-halusinasi, versi ID & EN).
- Handler end-to-end dengan `fetch` tiruan: generate, chat, batas 300 karakter, method GET,
  tanpa API key, dan fallback JSON tidak valid.
- **Kontrak tanpa error**: saat AI timeout / gagal / kuota habis, server tetap membalas
  HTTP 200 dengan rencana lengkap + `narasiAI: false` (dijalur di `tools/test-waktu.js`).
- Judul hari dibuat dari kode (`temaOtomatis`) sehingga hari tetap punya nama walau
  narasi AI tidak tersedia.

Pemeriksaan kebersihan teks (artefak karakter aneh):

```bash
node tools/scan.js
```

Audit aksesibilitas (Lighthouse): **Accessibility 100 · Best Practices 100 · SEO 100**.

---

## 9. Catatan Penting untuk Juri

### Keamanan
- API key **hanya** di environment variable server, tidak pernah masuk bundle browser.
- Input dibatasi 300 karakter (HTML `maxlength` + slicing server).
- Semua preferensi divalidasi **server-side** dengan *whitelist* (durasi 1–7, budget, gaya, kategori minat).
- Rate limit sederhana 20 permintaan/menit per IP di sisi server.
- Header keamanan dasar dikonfigurasi di `vercel.json` (`X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`).

### Anti-halusinasi
- 28 destinasi nyata dengan harga tiket, jam buka, dan tips etika di `data/destinasi.json`.
- 3 lapis proteksi: prompt (termasuk format JSON eksplisit) → `responseSchema` sebagai cadangan → post-filter server.
- Metadata `meta.tempatDitebuang` melaporkan berapa tempat yang dibuang otomatis, sehingga proses ini **terbukti dan transparan**.

### KenapaAI, bukan rule-based?
- Aturan tetap (durasi, budget, urutan hari, dedup lokasi) memang lebih tepat ditangani kode — dan itulah yang dilakukan server.
- Yang diserahkan kepada AI adalah apa yang **memerlukan penalaran**: memilih kombinasi tempat yang cocok dengan minat, menentukan jam kunjungan yang masuk akal, menulis tips etika dalam kalimat yang mudah dipahami, dan memahami perintah bebas dari user ("ganti hari 2 jadi lebih santai", "turunkan budget"). Rule-based tidak bisa memahami bahasa alami.

### Aksesibilitas & responsif
- Semua input punya `<label>`; gambar punya `alt`; ada skip-link; `aria-live` pada log chat; `aria-pressed` pada toggle bahasa; fokus terlihat jelas.
- Mobile-first dengan titik break `360 / 480 / 560 / 700 / 860 / 900 / 960 / 1000 px`; sudah diuji di 320px, 390px, 430px, 768px, 1024px, 1280px, dan 1440px (tanpa scroll horizontal).
- Menghormati `prefers-reduced-motion`.

### Batasan (jujur & transparan)
- Harga tiket & jam buka bersifat indikatif (ditulis demikian di `data/destinasi.json`) dan dapat berubah — ditampilkan sebagai " estimasi".
- AI tetap bisa salah menulis jam di luar `jamBuka`; untuk itu kami menampilkan jam buka asli dari katalog di setiap kartu.
- Riwayat chat disimpan di memori browser selama sesi (tidak ada database, sesuai Seaserta   
  batasan "tanpa localStorage berisiko error"; yang disimpan di `localStorage` **hanya** pilihan bahasa, dan itu pun dibungkus `try/catch`).

---

## 📄 Lisensi & Kredit

- **Kode:** dibuat sendiri untuk keperluan lomba NAISC 2026.
- **Model AI:** Google Gemini (`gemini-3.8-flash`) via Google AI Studio.
- **Font:** [Plus Jakarta Sans](https://fonts.google.com/specimen/Plus+Jakarta+Sans) (Google Fonts, SIL Open Font License).
- **Foto:** foto lokasi (Ulun Danu Beratan, Uluwatu, Tegallalang, Kelingking, Tanah Lot) dari [Unsplash](https://unsplash.com) (lisensi bebas untuk penggunaan non-komersial dan komersial, dengan atribusi), disimpan lokal di `public/images/hero/`. Ikon dibuat sebagai SVG inline oleh tim kami.
- **Data tempat:** dikumpulkan dari sumber informasi wisata resmi Bali dan pengetahuan umum; bersifat indikatif dan sebaiknya diverifikasi ulang sebelum perjalanan.

---

<div align="center">

**Griska Go** · NAISC 2026 · Kategori Website
Bangun dengan HTML5, CSS3, Vanilla JS, Vercel Serverless & Google Gemini

</div>
