# 🎤 Bahan Presentasi & Tanya Jawab — Griska Go

**NAISC 2026 · Kategori Website**
Durasi presentasi: **5 menit** · Tanya jawab: **10 menit**

---

# BAGIAN A — RINGKASAN PRESENTASI (5 MENIT)

> **Aturan main:** sekitar **700–800 kata** untuk 5 menit (≈ 140 kata/menit).
> Kotak `[TAMPIL]` = yang ditampilkan/di-klik saat presentasi.
> Kotak `[BICARA]` = naskah yang dibacakan.

---

## Slide 1 — Pembuka *(0:00 – 0:30)*

**TAMPIL:** Slide judul + screenshot hero website Griska Go. Logo, nama tim, sekolah.

**BICARA:**
> "Selamat pagi, kami **[Tim / Nama]** dari **[SMA/SMK]**, dan kami ingin memperkenalkan **Griska Go** — perencana itinerary Bali berbasis AI yang tidak hanya memberi tahu *ke mana* pergi, tetapi juga *bagaimana* berperilaku agar dihormati oleh warga lokal."

---

## Slide 2 — Masalah *(0:30 – 1:15)*

**TAMPIL:** 3 kartu masalah (section "The Problem" di website).

**BICARA:**
> "Bayangkan seseorang yang baru pertama kali ke Bali.
>
> **Pertama, pilihannya overwhelming.** Ada ratusan atraksi, sementara waktunya cuma beberapa hari. Akibatnya hari pertama habis hanya untuk berpindah tempat.
>
> **Kedua, budget meleset.** Tidak ada estimasi biaya per hari, jadi pengeluaran tiba-tiba membengkak di tengah perjalanan.
>
> **Ketiga, dan ini yang paling kami pedulikan — banyak orang tidak tahu adat.** Tidak sengaja masuk ke area suci tanpa sarong, memotret prosesi beribadah, bahkan memberi makan monyet di Monkey Forest. Akibatnya mereka menyinggung warga, atau bahkan tidak boleh masuk ke area tertentu.
>
> Intinya: ada pemisahan antara **'where to go'** dan **'how to behave'**. Itinerary yang ada biasanya tidak menjawab keduanya."

---

## Slide 3 — Solusi *(1:15 – 2:00)*

**TAMPIL:** Diagram alur sederhana (Pengguna → Form → AI → Itinerary).

**BICARA:**
> "Griska Go menjembatani itu. Pengguna cukup mengisi **lima preferensi**: berapa hari, budget berapa, minat apa, gaya perjalanan seperti apa, dan mau mulai dari wilayah mana.
>
> AI lalu menyusun **itinerary per hari**: jam, tempat, aktivitas, estimasi biaya, durasi, dan — yang paling penting — **Tips Budaya & Etika di setiap lokasi**.
>
> Hasilnya bukan paragraf panjang, tapi **kartu timeline** yang mudah dipindai, ditambah panel chat untuk mengubah rencana kapan saja.
>
> Dan ada satu hal yang jadi komitmen kami: **AI tidak boleh mengarang tempat.** Semua rekomendasi dibatasi pada **28 destinasi nyata** yang kami siapkan sendiri."

---

## Slide 4 — Penerapan AI *(2:00 – 3:15)*

**TAMPIL:** Potongan kode `api/chat.js` (system prompt) — sisipkan 3 baris kunci.

**BICARA:**
> "Bagian AI ini yang paling kami rapikan, karena di situlah nilai produk ini.
>
> **Pertama, arsitekturnya.** Browser tidak pernah menyentuh API key. Semua permintaan lewat **satu serverless function** di Vercel, dan API key hanya ada di environment variable server. Jadi tidak ada yang bisa melihat kunci kami lewat DevTools.
>
> **Kedua, tiga lapis anti-halusinasi:**
> - **Lapis 1 — Prompt.** System prompt berisi 14 aturan wajib, termasuk larangan keras menyebut nama di luar katalog, plus catatan per destinasi — misalnya 'Nusa Penida butuh satu hari penuh'.
> - **Lapis 2 — Format.** Kami paksa Gemini menjawab dalam **JSON ketat** lewat `responseSchema` dan `responseMimeType`. Jadi AI tidak mungkin menjawab dengan bebas.
> - **Lapis 3 — Post-filter.** Ini kode kami sendiri. **Server mencocokkan setiap nama tempat ke katalog.** Yang tidak cocok **dibuang**. Wilayah, kategori, dan harganya selalu diambil ulang dari katalog, bukan dari AI.
>
> **Ketiga, chat yang benar-benar mengingat.** Setiap kali user chat, itinerary aktif ikut dikirim sebagai konteks. Jadi 'ganti hari 2 jadi lebih santai' benar-benar dieksekusi, dan kartu di layar langsung berubah.
>
> **Keempat, ada fallback.** Kalau JSON AI tidak valid, server mengembalikan pesan ramah plus jawaban mentah untuk diagnostik. Aplikasi **tidak pernah blank**."

---

## Slide 5 — Bukti Kualitas *(3:15 – 4:00)*

**TAMPIL:** Screenshot terminal `node tools/test-api.js` → "Lulus: 29 Gagal: 0", dan hasil Lighthouse.

**BICARA:**
> "Kami tidak hanya mengklaim ini bekerja — kami mengujinya.
>
> Ada **29 uji otomatis** yang mencakup parser JSON, post-filter anti-halusinasi, validasi input, dan seluruh handler dari ujung ke ujung. Hasilnya **29 lulus, nol gagal**, dan bisa dijalankan siapa saja lewat satu perintah.
>
> Untuk UI, kami audit dengan **Lighthouse: aksesibilitas 100, best practices 100, SEO 100**. Itu bukan kebetulan — kami memastikan semua input punya label, ada skip link, dan kontras warnanya di atas 4,5 banding."

---

## Slide 6 — Arsitektur & Keamanan *(4:00 – 4:30)*

**TAMPIL:** Diagram arsitektur (dari dokumen arsitektur).

**BICARA:**
> "Arsitekturnya sengaja dibuat **tipis**: HTML, CSS, dan JavaScript murni di depan; **satu** serverless function di belakang; **nol** dependency npm; dan **nol** database.
>
> Dari sisi keamanan: API key hanya di server, input dibatasi 300 karakter di HTML sekaligus di server, ada rate limit 20 permintaan per menit per IP, dan seluruh preferensi divalidasi ulang di server dengan daftar putih — jadi validasi browser bisa dilewati, tapi tidak bisa ditembus."

---

## Slide 7 — Penutup *(4:30 – 5:00)*

**TAMPIL:** Tampilan mobile website + URL.

**BICARA:**
> "Griska Go dibuat agar mudah dikembangkan — menambah wilayah baru cukup menambah entri di satu file JSON.
>
> Bali adalah tempat yang hangat, dan kami ingin setiap pengunjung datang sebagai tamu yang tahu sopan santun.
>
> **Terima kasih. Kami siap menjawab pertanyaan.**
>
> *URL: [https://nama-repo.vercel.app]* · *Kode: [github.com/username/repo]*"

---

## Catatan Alokasi Waktu (opsional, untuk pembicara)

| Slide | Detik | Kata | Tampilan |
|---|---|---|---|
| 1 | 0:00–0:30 | ~60 | Judul + hero |
| 2 | 0:30–1:15 | ~115 | 3 kartu masalah |
| 3 | 1:15–2:00 | ~115 | Diagram alur |
| 4 | 2:00–3:15 | ~190 | Kode system prompt |
| 5 | 3:15–4:00 | ~115 | Terminal + Lighthouse |
| 6 | 4:00–4:30 | ~80 | Diagram arsitektur |
| 7 | 4:30–5:00 | ~75 | Mobile + URL |
| **Total** | **5:00** | **~750** | — |

> **Tips:** Latihan dengan timer. Targetkan selesai di 4:50 agar ada jeda untuk transisi slide.
