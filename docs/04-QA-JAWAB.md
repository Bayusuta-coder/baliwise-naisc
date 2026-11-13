
---

# BAGIAN B — 10 PERTANYAAN JURI & CONTOH JAWABAN

> Setiap jawaban dibatasi **± 90 detik**. Struktur: **jawaban langsung → bukti → penutup.**

---

## Q1. Apa yang membuat Griska Go berbeda dari aplikasi itinerary atau travel guide yang sudah ada?

**Jawaban:**
> "Perbedaannya ada di dua hal, dan keduanya kami rancang dengan sengaja.
>
> **Pertama, groundedness.** Travel guide biasanya memuat daftar tempat; AI chat biasa bisa mengarang tempat yang tidak ada. Griska Go menutup celah itu dengan tiga lapis: prompt yang melarang nama di luar katalog, `responseSchema` yang memaksa format JSON, dan — yang paling menentukan — **post-filter server yang membuang setiap nama yang tidak ada di katalog**. Metadata `tempatDitebuang` melaporkan berapa yang dibuang, jadi prosesnya transparan dan bisa diverifikasi.
>
> **Kedua, budaya menyatu dengan rute.** Tips etika diambil langsung dari katalog tiap lokasi, jadi spesifik — pakai sarong di pura, alur beribadah di Tirta Empul, aturan snorkeling di Nusa Lembongan, cara menawar di Pasar Badung. Bukan nasihat umum di akhir halaman.
>
> Dan **ketiga**, yang jarang ada: chat yang benar-benar mengubah rencana, bukan sekadar menjawab."

---

## Q2. Bagaimana cara Anda memastikan AI tidak mengarang nama tempat?

**Jawaban:**
> "Kami menutupnya dengan tiga lapis, dan ketiganya bisa ditunjukkan dalam kode.
>
> **Lapis 1 — Prompt.** System prompt di `api/chat.js` memuat 14 aturan wajib. Yang paling penting: **'HANYA boleh merekomendasikan nama tempat yang ada di KATALOG'**. Katalog itu berisi 28 destinasi nyata dengan harga, jam buka, dan tips etika yang disisipkan ke prompt.
>
> **Lapis 2 — Format.** Kami mengatur `responseMimeType: 'application/json'` plus `responseSchema`. Dengan begitu Gemini secara teknis **tidak mungkin** menjawab dengan bebas — hanya boleh mengeluarkan JSON dengan struktur yang kami tentukan.
>
> **Lapis 3 — Post-filter.** Ini yang paling penting dan ini kode kami sendiri, bukan]-tepat andal model. Setelah balasan AI diterima, server mencocokkan setiap `namaTempat` ke katalog dengan normalisasi teks. **Tidak cocok → dibuang.** Wilayah, kategori, harga tiket, dan jam buka juga selalu di-*override* dari katalog, bukan dipercaya dari AI.
>
> Kalau semuanya dibuang, server mengembalikan `INVALID_AI_OUTPUT` beserta jawaban mentah, dan antarmuka menampilkan pesan error ramah plus tombol coba lagi. Jadi **tidak pernah ada tempat fiktis yang lolos ke layar, dan tidak pernah halaman kosong.**"

---

## Q3. Kenapa memilih AI, dan kenapa tidak pakai rule-based atau template saja?

**Jawaban:**
> "Pertanyaan bagus, dan jawabannya: kami **membagi** keduanya.
>
> Aturan yang memang pasti — durasi 1–7 hari, budget harus salah satu dari tiga, jumlah kegiatan maksimal 5 per hari, harga harus diambil dari katalog, nama harus ada di katalog — **semua itu kami tangani di kode**, bukan di prompt. Rule-based lebih baik dan lebih murah untuk hal yang deterministik.
>
> Yang kami serahkan ke AI adalah hal yang **memerlukan penalaran dan bahasa alami**:
> - Memilih **kombinasi** tempat yang cocok dengan minat dan budget pengguna.
> - Menentukan **urutan dan jam** yang masuk akal, denganVFVO Considerasi kedekatan geografis dan jam buka.
> - Menulis **tips etika** dalam kalimat yang mudah dipahami, bukan daftar poin teknis.
> - Memahami **perintah bebas** seperti 'ganti hari 2 jadi lebih santai' atau 'turunkan budget jadi hemat' — ini mustahil dibuat dengan `if-else`.
>
> Kalau ditanya: 'apa yang mustahil dilakukan rule-based?' — jawabannya adalah **memahami permintaan bahasa alami yang bebas**, lalu memetakannya ke perubahan konkret pada data. Itulah yang dilakukan AI di sini."

---

## Q4. Bagaimana keamanan API key ditangani? Apa kalau ada yang menyalin key Anda?

**Jawaban:**
> "Kuncinya **tidak pernah menyentuh browser**.
>
> Frontend hanya memanggil `POST /api/chat` — endpoint milik kami sendiri. Semua kode yang memanggil Gemini ada di `api/chat.js` yang berjalan di server Vercel, dan kunci dibaca dari `process.env.AI_API_KEY`. Nobody can melihat isinya dari DevTools, karena memang tidak pernah dikirim ke klien.
>
> Kalau bocor: file `.env` sudah masuk `.gitignore` — hanya `.env.example` yang tanpa nilai yang masuk GitHub. Kami juga tidak pernah mencetak kunci ke log atau ke pesan error yang dikirim ke pengguna; detail teknis hanya tetap di log server. Dan rotasi bisa dilakukan dalam hitungan menit lewat dashboard Vercel, lalu redeploy.
>
> Lapisan lain: **input dibatasi 300 karakter** di dua tempat sekaligus — atribut `maxlength` di HTML dan pemotongan ulang di server, jadi tidak bisa dilewati. **Semua preferensi divalidasi ulang di server dengan daftar putih** — validasi browser bisa dilewati, tapi server tidak mempercayai klien. Ditambah **rate limit 20 permintaan per menit per IP**, timeout 45 detik, dan `maxOutputTokens` yang membatasi biaya per permintaan."

---

## Q5. Mengapa hanya satu serverless function? Bukankah seharusnya ada backend lebih besar?

**Jawaban:**
> "Justru sebaliknya — kami percaya **kesederhanaan arsitektur adalah keputusan desain**, bukan keterbatasan.
>
> Satu fungsi `api/chat.js` menangani dua aksi saja: `generate` dan `chat`. Seluruh state sesi ada di memori browser, jadi **tidak ada database sama sekali**. Ini punya tiga keuntungan nyata:
> - **Biaya hosting mendekati nol** untuk skala lomba dan bahkan produksi kecil.
> - **Tidak ada permukaan serangan tambahan** — tidak ada SQL injection, tidak ada session management, tidak ada password yang diretas.
> - **Mudah diaudit dan direview** dalam 5 menit, yang penting untukfrakonium oleh juri.
>
> Justru karena tidak ada database, kami bisa menaruh semua proteksi di satu tempat: validasi, rate limit, dan post-filter anti-halusinasi. Kalau nanti butuh akun dan riwayat, itu penambahan **di luar** arsitektur saat ini — katalog JSON tetap menjadi sumber kebenaran, dan AI prompt tetap sama. Arsitektur ini **bukan buntu, tapi fondasi**."

---

## Q6. Bagaimana Anda menangani kemungkinan AI gagal atau balannya tidak valid?

**Jawaban:**
> "Kami merancang kegagalan sebagai **kasus normal**, bukan pengecualian.
>
> **Di sisi server** ada lima lapis:
> 1. `parseJSONAman()` mencoba empat strategi parsing — JSON polos, JSON dalam code fence, teks tambahan mengelilingi JSON, dan pemindaian kurung kurawal yang aman terhadap string.kalimat.
> 2. Kalau tetap gagal, `bersihkanItinerary()` mengembalikan `null`.
> 3. Server membalas `200 OK` dengan `{ ok:false, error:'INVALID_AI_OUTPUT', rawText: ... }` — **bukan** 500.
> 4. Frontend menampilkan pesan ramah, tombol 'Coba lagi', dan jawaban mentah di dalam `<details>` untuk diagnostik.
> 5. Kalau Gemini menolak `responseSchema`, permintaan diulang otomatis **tanpa** schema.
>
> **Di sisi klien** ada timeout 70 detik dengan `AbortController`, dan setiap jenis error punya pesan spesifik: API key belum diatur, kuota penuh, timeout, rate limit, atau JSON tidak valid — bukan 'terjadi kesalahan' generik.
>
> Prinsip kami: **user harus selalu mendapat sesuatu yang berguna**, dan aplikasi tidak boleh pernah blank."

---

## Q7. Bagaimana Anda menguji produk ini? Apakah ada bukti bahwa semuanya benar-benar bekerja?

**Jawaban:**
> "Ada dua bentuk bukti.
>
> **Pertama, uji otomatis.** `node tools/test-api.js` menjalankan **29 pengujian** dan semuanya lulus. Cakupannya nyata: parser JSON dengan empat skenario berbeda, post-filter yang membuktikan tempat fiktis dibuang, validasi preferensi dengan kasus batas, pemeriksaan bahwa system prompt memuat seluruh katalog, dan handler end-to-end dengan `fetch` tiruan — termasuk simulasi pesan chat sepanjang 301 karakter yang ditolak server, permintaan tanpa API key, dan JSON tidak valid.
>
> **Kedua, audit otomatis untuk UI.** Lighthouse memberi **aksesibilitas 100, best practices 100, SEO 100**. Itu hasil kerja, bukan Dani — kami sempat menemukan kontras warna hijau tropis di bawah ambang 4,5 banding dan urutan heading yang melompat, lalu memperbaikinya.
>
> **Ketiga, pengujian manual** yang kami lakukan pada perangkat nyata: HP 390 px, tablet, dan laptop; mode Incognito; serta alur penuh dari form sampai chat.
>
> Semua dapat direproduksi juri dengan satu perintah di terminal."

---

## Q8. Bagaimana dan apakah produk ini bisa dikembangkan lebih lanjut?

**Jawaban:**
> "Kami punya peta jalan yang jelas, dan sengaja memilih fondasi yang extensible.
>
> **Fase 2.0 — Akun & riwayat.** Menambah Supabase atau Firebase Auth, itinerary tersimpan antar perangkat. Katalog JSON tetap sumber kebenaran.
> **Fase 2.1 — Peta interaktif.** Leaflet plus OSRM untuk rute harian nyata, menggantikan estimasi transport berbasis jarakCorpse.
> **Fase 2.2 — Rekomendasi personal.** Embedding dan vector search berdasarkan riwayat kunjungan pengguna.
> **Fase 2.3 — Mode offline.** Service Worker dan IndexedDB agar itinerary tetap bisa dibuka tanpa sinyal.
> **Fase 2.4 — Ekspor.** jsPDF untuk ekspor PDF dan format ICS ke kalender.
> **Fase 2.5 — Ekspansi wilayah.** Yogyakarta, Lombok, atau daerah lain. Karena katalog JSON bersifat generik dengan kolom wilayah, menambah kota cukup menambah entri — **tanpa mengubah satu baris kode AI**.
>
> Yang paling kami banggakan justru yang paling sederhana: **menambah 28 destinasi lagi cukup menambah JSON, tidak menyentuh kode.**"

---

## Q9. Bagaimana kalau data harga dan jam buka di katalog menjadi basi?

**Jawaban:**
> "Ini jujur jadi batasan versi 1.0, dan kami tidak menutupinya.
>
> Yang kami lakukan sekarang: setiap entri katalog punya field `catatan` yang menjelaskan sifat datanya, dan di bawah setiap itinerary ada disclaimer bahwa harga adalah **estimasi** dan harus dikonfirmasi ke sumber resmi. Kami juga menampilkan **jam buka asli dari katalog** di setiap kartu, terpisah dari jam yang dipilih AI — jadi pengguna bisa langsung melihat batas waktunya.
>
> Solusi jangka panjangnya ada di roadmap: katalog bisa disinkronkan berkala dari sumber resmi, atau diganti API data wisata resmi Bali. Karena arsitekturnya **memisahkan katalog dari prompt**, pembaruan itu cukup satu file — tidak ada perubahan kode AI sama sekali.
>
> Yang penting, ada **satu sumber kebenaran** untuk data, dan UI selalu meng-*grounding*-kan ke sana. Jadi data basi berarti katalog basi — bukan AI yang mengarang harga sendiri."

---

## Q10. Bagaimana produk ini bisaGive dampak nyata pada sektor pariwisata Bali?

**Jawaban:**
> "Kami melihat dampaknya dari dua sisi.
>
> **Untuk traveler:** waktu lebih hemat, budget lebih terukur, dan yang paling penting — **tahu aturan sebelum datang**. Mengurangi insiden 'tanpa sarong' atau 'memberi makan monyet' berarti mengurangi konflik antara tamu dan warga.
>
> **Untuk sektor:** setiap kunjungan yang muncul dari Griska Go datang bersama panduan sopan santun. Itu bentuk promosi responsible tourism yang nyata, bukan slogan. Katalog kami juga mencakup destinasi yang masih jarang dikunjungi — Gitgit, Tirta Gangga, Lovina, dan Pasare Betis — sehingga”[tempat baru] ikut mendapat perhatian dan kunjungan, yang baik untuk ekonomi desa.
>
> **Untuk pengembangan lokal:** arsitekturnya open. Katalog JSON bisa diisi oleh Guides,Pok&Dinas Honeys, atau sogar komunitas warga dengan tambahan satu file — tanpa menyentuh kode AI. Kami membayangkan itu sebagai model scaling ke wilayah lain: satu orang locally bisa menambah 15 destinasi kotanya sendiri, dan AI langsung bisa menjadwalkannya.
>
> Dan yang paling konkret: karena proyek ini gratis, open-source, dan didokumentasi lengkap, **siapa pun di Indonesia bisa membangun versi untuk wilayahnya sendiri**."

---

## Tips Menjawab Tanya Jawab

| Tips | Penjelasan |
|---|---|
| **Jawab langsung dulu** | Satu kalimat pembuka sebelum penjelasan panjang. |
| **Tunjuk buktinya** | Buka file/terminal yang relevan. Juri percaya apa yang bisa mereka lihat. |
| **Akui batasan** | "Ini batasan versi 1.0, dan solusinya ada di roadmap" jauh lebih kuat daripada berbohong. |
| **Jangan mengarang** | Kalau tidak tahu, katakan "ini belum kami-research" lalu tawarkan cara mencobanya. |
| **Kaitkan ke DUDI** | Kapan pun bisa, hubungkan kembali ke masalah pariwisata Bali. |
| **Batas 90 detik** | Jawaban terlalu panjang = tim Xamarin hilang perhatian. |

---

<div align="center">

**Griska Go** · Bahan Presentasi & Tanya Jawab · NAISC 2026
</div>
