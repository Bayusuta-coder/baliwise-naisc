# 🏝️ BaliWise — Perencana Itinerary Bali Berbasis AI

**BaliWise** adalah website perencana perjalanan Bali yang menggunakan **Artificial Intelligence** untuk menyusun itinerary harian sesuai durasi, budget, minat, dan gaya perjalanan pengguna — **dilengkapi panduan budaya & etika di setiap lokasi** agar wisatawan tidak salah adat.

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

****BaliWise** menjawab tiga masalah tersebut dengan satu alur sederhana: pengguna mengisi form preferensi, AI menyusun rencana per hari dalam bentuk **kartu timeline** (bukan paragraf panjang), lalu pengguna bisa **mengobrol** untuk mengubah rencana kapan saja.

Yang membedakan BaliWise dari chat AI biasa:

- **Grounded** — AI hanya boleh merekomendasikan tempat yang benar-benar ada di `data/destinasi.json` (28 destinasi nyata). Tempat yang tidak dikenal **otomatis dibuang** oleh server.
- **Berbudaya** — setiap kartu memuat tips etika spesifik untuk lokasinya (sarong, alur beribadah, aturan snorkeling, cara menawar di pasar).
- **Ingat** — chat lanjutan membawa itinerary sebelumnya sebagai konteks, jadi "ganti hari 2 jadi lebih santai" benar-benar dieksekusi.
- **Aman** — API key tidak pernah menyentuh browser; input dibatasi (maks 300 karakter) dan divalidasi berlapis.

---

## 2. Fitur Utama

| # | Fitur | Penjelasan |
|---|---|---|
| 1 | **Landing page** | Hero section, penjelasan masalah → solusi, 3 langkah cara kerja, 6 kartu fitur, CTA penutup. |
| 2 | **Form preferensi** | Durasi (1–7 hari), budget (hemat/menengah/mewah), minat (pantai/budaya/kuliner/alam/belanja, boleh banyak), gaya perjalanan (santai/padat), wilayah awal, dan catatan tambahan (maks 300 karakter). |
| 3 | **Itinerary per hari** | Dihasilkan AI dan dirender sebagai **kartu timeline**: jam, nama tempat, aktivitas, estimasi biaya, durasi, dan **"Tips Budaya & Etika"** per lokasi. |
| 4 | **Chat lanjutan** | Pengguna dapat bertanya atau meminta perubahan rencana. AI mengingat itinerary yang sudah dibuat dan bisa mengembalikan versi terbaru yang langsung dirender ulang. |
| 5 | **Bilingual ID / EN** | Toggle bahasa mengubah seluruh antarmuka **dan**(system prompt) bahasa hasil AI. Pilihan bahasa disimpan di `localStorage` (dengan `try/catch`). |
| 6 | **Loading state** | Animasi "AI sedang menyusun rencana..." dengan indikator 3 tahap. |
| 7 | **Penanganan error ramah** | Pesan spesifik untuk: API key belum diatur, kuota penuh, timeout, rate limit, JSON tidak valid, dan input tidak valid. |
| 8 | **Validasi form** | Divalidasi dua kali: di browser (instant) dan di server (tidak bisa ditembus). |
| 9 | **Pembatasan input** | Maks 300 karakter untuk catatan & pesan chat; `maxlength` di HTML + slicing di server. |
| 10 | **Responsif** | Mobile-first, CSS Grid + Flexbox, sudah diuji di HP/tablet/laptop. |
| 11 | **Aksesibel** | Label pada semua input, `alt` pada gambar, skip-link, `aria-live`, focus ring, kontras warna ≥ 4.5:1. Skor **Lighthouse A11y = 100**. |

---

## 3. Teknologi

| Lapisan | Teknologi | Alasan |
|---|---|---|
| Frontend | **HTML5, CSS3, Vanilla JavaScript** | Tanpa framework → ringan, cepat, dan mudah dipelajariRevision juri. |
| Styling | CSS Variables + Grid + Flexbox | 3 warna utama (biru laut, hijau tropis, emas), 1 font Google (Plus Jakarta Sans). |
| Backend | **1 Serverless Function (Node.js)** di `api/chat.js` | Dijalankan di Vercel, tanpa server/database. |
| AI | **Google Gemini API** (REST, `gemini-3.8-flash`) | Dipanggil langsung via `fetch` → **tanpa `npm install`**, proyek tetap ringan. |
| Data | `data/destinasi.json` | 28 destinasi nyata sebagai *ground truth* anti-halusinasi. |
| Hosting | **Vercel** | Gratis untuk pelajar, auto-deploy dari GitHub, mendukung serverless function + env var. |
| Gambar | Unsplash (URL) + ikon SVG inline | Sesuai ketentuan, tanpa melanggar hak cipta. |

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
Kamu adalah "BaliWise", seorang asisten perencanaan perjalanan yang ahli menjelajah Bali.

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

`parseJSONAman()` menangani 4 kemungkinan balasan AI:

1. JSON polos → langsung di-parse.
2. JSON di dalam code fence ```` ```json ... ``` ```` → fence dibuang.
3. Teks tambahan di sekitar JSON → objek JSON terluar diambil dengan pemindaian kurung kurawal yang aman terhadap string & escape.
4. Bukan JSON sama sekali → **fallback**: server membalas `INVALID_AI_OUTPUT` beserta `rawText`, dan frontend menampilkannya di dalam `<details>` ("Lihat jawaban mentah dari AI") plus tombol "Coba lagi". **Aplikasi tidak pernah blank.**

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
| `429` kuota penuh | Berhenti — masalah kuota, bukan model |

**Variasi parameter** (dicoba berurutan pada model yang sama):

1. `responseMimeType` + `responseSchema` + `temperature` (paling ketat)
2. `responseMimeType` + `temperature` (tanpa schema)
3. `responseMimeType` saja (paling minimal)

Semua langkah tetap **meminta JSON lewat system prompt**, dan hasilnya tetap diparse dengan
parser berlapis — jadi **`responseSchema` hanya bonus**, bukan satu-satunya penopang.

> **Catatan penting:** `gemini-2.5-flash` sudah *deprecated* dan **tidak tersedia untuk kunci API
> baru** (Google membalas 404: *"no longer available to new users"*). Karena itu, untuk kunci baru
> sebaiknya isi `AI_MODEL_FALLBACK=gemini-3.6-flash` di file `.env`.

### 4.9 Pesan error yang ditampilkan ke pengguna

| Kode | Kondisi | Pesan di layar |
|---|---|---|
| `AI_QUOTA` | 429 | "Kuota AI sedang penuh, coba lagi 1 menit lagi." |
| `AI_AUTH` | 401/403 | "API key tidak valid." |
| `AI_MODEL_UNAVAILABLE` | Semua model 404 | "Model AI tidak tersedia." |
| `AI_UNREACHABLE` | 503 | "Layanan AI sedang tidak dapat diakses. Silakan coba lagi." |
| `AI_REJECTED` | 400 | "Permintaan ditolak oleh layanan AI. Coba ubah preferensi Anda." |
| `TIMEOUT` | Melewati batas waktu | "AI terlalu lama merespons. Silakan coba lagi." |
| `SERVER_ERROR` | Lainnya | "Terjadi kesalahan, silakan coba lagi." |

Di **terminal**, server selalu mencatat status dan pesan asli dari Google
(mis. *"gemini-2.5-flash is no longer available to new users"*) sehingga mudah didiagnosis.
**API key tidak pernah ikut dicetak ke log.**

---

## 5. Struktur Proyek

```
naisc-wisata/
│
├── index.html              # Halaman tunggal: hero, fitur, form, hasil, chat, footer
├── css/
│   └── style.css           # Semua styling (variabel, komponen, responsif, animasi)
├── js/
│   ├── api.js              # Client API: POST /api/chat + pesan error ramah
│   └── app.js              # Logika UI: i18n, validasi, render timeline, chat
├── api/
│   └── chat.js             # Serverless function: system prompt, panggilan AI, validasi
├── data/
│   └── └──destinasi.json   # 28 destinasi nyata = ground truth anti-halusinasi
├── tools/
│   ├── dev-server.js       # Server dev lokal (statis + /api/chat) tanpa Vercel CLI
│   ├── test-api.js         # 42 uji otomatis untuk logika backend
│   ├── scan.js             # Pemeriksa kebersihan teks seluruh berkas
│   ├── validate-mermaid.js # Validator sintaks diagram Mermaid (opsional)
│   ├── probe-gemini.js     # Diagnosa: model Gemini mana yang tersedia
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
git commit -m "BaliWise - perencana itinerary Bali berbasis AI (NAISC 2026)"

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

Jika muncul error `NO_API_KEY`, ulangi langkah 7.3 lalu redeploy.

---

## 8. Pengujian

Proyek menyertakan uji otomatis untuk logika backend (tanpa memanggil API sungguhan):

```bash
node tools/test-api.js
```

Hasil: **42 uji lulus, 0 gagal**, meliputi:

- Parser JSON (code fence, teks tambahan, string berisi `{}`, non-JSON).
- Post-filter anti-halusinasi (tempat fiktis dibuang, data di-*grounding* ke katalog).
- Validasi preferensi (durasi, budget, minat, gaya, wilayah, panjang catatan).
- System prompt (memuat seluruh katalog & aturan anti-halusinasi, versi ID & EN).
- Handler end-to-end dengan `fetch` tiruan: generate, chat, batas 300 karakter, method GET, tanpa API key, dan fallback JSON tidak valid.

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
- 3 lapis proteksi: prompt → `responseSchema` → post-filter server.
- Metadata `meta.tempatDitebuang` melaporkan berapa tempat yang dibuang otomatis, sehingga proses ini **terbukti dan transparan**.

### KenapaAI, bukan rule-based?
- Aturan tetap (durasi, budget, urutan hari, dedup lokasi) memang lebih tepat ditangani kode — dan itulah yang dilakukan server.
- Yang diserahkan kepada AI adalah apa yang **memerlukan penalaran**: memilih kombinasi tempat yang cocok dengan minat, menentukan jam kunjungan yang masuk akal, menulis tips etika dalam kalimat yang mudah dipahami, dan memahami perintah bebas dari user ("ganti hari 2 jadi lebih santai", "turunkan budget"). Rule-based tidak bisa memahami bahasa alami.

### Aksesibilitas & responsif
- Semua input punya `<label>`; gambar punya `alt`; ada skip-link; `aria-live` pada log chat; `aria-pressed` pada toggle bahasa; fokus terlihat jelas.
- Mobile-first dengan titik break `700px / 860px / 900px / 940px`.
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
- **Foto:** [Unsplash](https://unsplash.com) (lisensi bebas untuk penggunaan non-komersial dan komersial, dengan atribusi). Ikon dibuat sebagai SVG inline oleh tim kami.
- **Data tempat:** dikumpulkan dari sumber informasi wisata resmi Bali dan pengetahuan umum; bersifat indikatif dan sebaiknya diverifikasi ulang sebelum perjalanan.

---

<div align="center">

**BaliWise** · NAISC 2026 · Kategori Website
Bangun dengan HTML5, CSS3, Vanilla JS, Vercel Serverless & Google Gemini

</div>
