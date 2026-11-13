# 🎬 Naskah Video Demo — Griska Go

**Durasi total: 2 menit 55 detik** (maksimal 3 menit)
**Format:** screen recording + voice over + musik latar tipis
**Konten:** 6 adegan · 1 adegan Closing

> **Catatan teknis untuk tim:**
> - Rekam pada **1440×900** (desktop) dan ambil 5-8 detik rekaman **HP (390×844)** untuk bagian responsif.
> - Gunakan browser **Incognito** supaya tidak ada ekstensi yang mengganggu.
> - Siapkan **API key yang valid** sebelum rekaman dan lakukan *dry run* 1x sebelumnya.
> - Musik latar: instrumental, volume ~15% (jangan menutupi voice over).
> - Zoom 120% pada browser agar teks terbaca di layar HP.

---

## Ringkasan Adegan

| Adegan | Durasi | Kumulatif | Isi |
|---|---|---|---|
| 1 | 0:00 – 0:25 | 0:25 | Hook + masalah |
| 2 | 0:25 – 0:55 | 0:55 | Solusi + cara kerja |
| 3 | 0:55 – 1:25 | 1:25 | Demo: form → itinerary |
| 4 | 1:25 – 1:50 | 1:50 | Demo: chat lanjutan |
| 5 | 1:50 – 2:15 | 2:15 | Demo: bahasa EN + responsif + aksesibilitas |
| 6 | 2:15 – 2:40 | 2:40 | Bukti teknis (anti-halusinasi, keamanan) |
| 7 | 2:40 – 2:55 | 2:55 | Closing + CTA |

---

## ADEGAN 1 — Hook & Masalah *(0:00 – 0:25 | 25 detik)*

**Visual:** Layar membuka di hero website Griska Go. Skor kecepat: scroll pelan ke section "The Problem" (3 kartu masalah). Statistik kompleks tampil dengan *overlay* teks.

**Voice over:**
> "Bali adalah tujuan wisata paling terkenal di dunia. Tapi bagi wisatawan pertama, keindahan ini bukan fitur — justru menjadi masalah. Ada ratusan tempat, waktu cuma beberapa hari, budget terbatas, dan yang paling penting: banyak yang **tidak tahu adat di tempat yang mereka datangi**.
>
> Hasilnya? Rencana berantakan, budget meleset, dan berisiko kena multa atau bahkan mengganggu prosesi beribadah."

**Teks di layar (overlay):**
`"Ke mana? Berapa? Dan bagaimana behave di sana?"`

**Catatan:** Jangan readscreen —biarkan teks di website bekerja. 3 masalah muncul bergantian dengan *highlight* mouse.

---

## ADEGAN 2 — Solusi & Cara Kerja *(0:25 – 0:55 | 30 detik)*

**Visual:** Kembali ke atas, scroll ke section "How It Works" (3 langkah). Lalu scroll ke section Form. Berhenti di tombol submit.

**Voice over:**
> "Griska Go menjawabnya. Daniel, cukup lima preferensi — **berapa hari, berapa budget, minat apa, gaya seperti apa, dan mau mulai dari mana**.
>
> AI menyusun rencana per hari, lengkap dengan jam, aktivitas, estimasi biaya, dan yang paling penting: **Tips Budaya & Etika di setiap lokasi**.
>
> Dan semua ini dibatasi hanya pada **28 destinasi nyata** — bukan hasil karangan AI."

**Teks di layar (overlay):**
`"Grounded pada 28 destinasi nyata"`

---

## ADEGAN 3 — Demo: Form → Itinerary *(0:55 – 1:25 | 30 detik)*

**Visual:**
1. Tandai checkbox **Pantai** dan **Budaya** (2 klik cepat).
2. Pilih **Durasi 4 hari**, **Budget Menengah**, **Gaya Santai**, **Wilayah Ubud**.
3. Ketik di kolom catatan: *"bawa keluarga, hindari keramaian"* (3 detik).
4. Klik **"Susun Itinerary dengan AI"**.
5. **Tahan 2 detik** di loading state — biarkan juri melihat "AI sedang menyusun rencana...".
6. Scroll ke hasil: kartu **Hari 1** →sorot **Tips Budaya & Etika** (kursor membingkai satu tips).
7. Tunjukkan angka ringkasan: jumlah hari, jumlah tempat, estimasi total.

**Voice over:**
> "Saya pilih **empat hari**, budget menengah, minat **pantai dan budaya**, gaya santai, mulai dari Ubud, dan menulis catatan: *bawa keluarga, hindari keramaian*.
>
> Dalam beberapa detik, AI menyusun empat hari rencana, lengkap dengan jam, aktivitas, dan estimasi biaya per kegiatan.
>
> Dan lihat ini — ** setiap lokasi punya tips etika spesifik**. Di pura: pakai sarong, jangan menyela barisan. Di pantai: simpan barang berharga. Ini yang biasanya tidak ada di aplikasi mana pun."

**Teks di layar (overlay):**
`"Tips Budaya & Etika — per lokasi"`

**Catatan:** Bagian ini adalah **inti demo**. Pastikan hasil itinerary benar-benar muncul (koneksi & API key valid). Kalau AI lambat, potong voice over agar muat.

---

## ADEGAN 4 — Demo: Chat Lanjutan *(1:25 – 1:50 | 25 detik)*

**Visual:**
1. Scroll ke panel chat di bawah hasil.
2. Ketik: **"ganti hari 2 jadi lebih santai"** → Enter.
3. Tunggu jawaban (indikator "thinking" → balasan AI).
4. Scroll **ke atas** sedikit — kartu Hari 2 **berubah** (kartu activity berkurang, tema hari berubah).
5.sorot baris "Itinerary sudah diperbarui di atas."

**Voice over:**
> "Sekarang bagian terbaiknya. Saya tidak perlu mengulang dari nol. Saya simply chat — *'ganti hari 2 jadi lebih santai'*.
>
> AI **mengingat** itinerary saya, karena itinerary itu terus dikirim sebagai konteks. Dan hari kedua langsung berubah di layar.
>
> Ini bukan sekadar chat. Ini **revisi rencana**."

**Teks di layar (overlay):**
`"AI mengingat itinerary Anda"`

**Catatan:** Pastikan contoh prompt.ini dipakai persis — hasilnya reliable dan jelas terlihat bedanya.

---

## ADEGAN 5 — Bahasa, Responsif, Aksesibilitas *(1:50 – 2:15 | 25 detik)*

**Visual:**
1. Klik toggle **EN** → seluruh UI berubah ke English, kartu ikut berubah.
2. Klik toggle **ID** → kembali ke Bahasa Indonesia.
3. Cut ke rekaman **HP** (vertical): scroll cepat dari hero → form → itinerary. Tunjukkan menu burger.
4. Cut ke **desktop**: klik **Tab** → sorot *skip link* "Langsung ke form rencana" muncul.

**Voice over:**
> "Bilingual penuh — Bahasa Indonesia dan English, untuk antarmuka **dan** hasil AI-nya.
>
> Mobile-first: saya uji di HP, dan navigasinya berubah jadi menu ringkas.
>
> Dan aksesibilitasnya nyata, bukan formalitas: semua input punya label, ada skip link, kontras warna di atas 4,5 banding, dan kita sudah audit dengan Lighthouse — **skor aksesibilitas 100**."

**Teks di layar (overlay):**
`"ID / EN · Mobile-first · Lighthouse A11y 100"`

---

## ADEGAN 6 — Bukti Teknis *(2:15 – 2:40 | 25 detik)*

**Visual:** Cut ke **VS Code** (tema gelap). Tampilkan file `api/chat.js`, scroll ke bagian system prompt. Sorot 3 baris kunci:
- `HANYA boleh merekomendasikan nama tempat yang ada di KATALOG`
- `Balas HANYA dengan objek JSON valid`
- `responseSchema`

Lalu potret ke terminal: `node tools/test-api.js` → **"Lulus: 29 Gagal: 0"**.

**Voice over:**
> "Sekarang bagian technical-nya.
>
> Pertanyaan paling penting: **bagaimana kita tahu AI tidak mengarang tempat?** Jawabannya tiga lapis. Pertama, system prompt melarang keras menyebut apa pun di luar katalog. Kedua, kami paksa Gemini menjawab dalam **format JSON ketat** lewat `responseSchema`. Ketiga — dan ini yang paling penting — **server kami memfilter ulang**: nama tempat yang tidak ada di katalog **dibuang**, dan wilayah, kategori, serta harganya selalu diambil dari katalog.
>
> Dan semua logika ini teruji otomatis — 29 uji, nol gagal."

**Teks di layar (overlay):**
`"3 lapis anti-halusinasi · 29 uji otomatis"`

**Catatan:** Bagian inistrongly menjawab kriteria penilaian "Integrasi AI" (30%). Jangan dipotong.

---

## ADEGAN 7 — Closing & CTA *(2:40 – 2:55 | 15 detik)*

**Visual:** Kembali ke browser, hero section Griska Go. Tampilkan URL website di bawah. Tim Outro (wajah, 1 kalimat masing-masing) atau teks penutup.

**Voice over:**
> "Griska Go. Satu klik, rencana jadi. Dan Anda tidak hanya tahu *ke mana* pergi — tapi juga *bagaimana* agar dihormati.
>
> Griska Go. Perencana itinerary Bali berbasis AI. Terima kasih."

**Teks di layar (overlay):**
`"Griska Go — Rencanakan Liburan Bali, Tanpa Lagi Bingung."`
`https://[nama-repo].vercel.app`

---

## Checklist Rekaman

- [ ] API key valid & teruji (jalankan `npm run dev`, coba 1x penuh sebelum rekaman)
- [ ] Koneksi stabil (pakai hotspot cadangan)
- [ ] Browser dalam mode Incognito, zoom 120%
- [ ] Sharp Edge untuk demote (bukan Safari)
- [ ] Layar 1440x900, 60fps
- [ ] Musik latar sudah di-*mix* dengan voice over
- [ ] Rekam segmen HP terpisah (vertical, 30-40 detik)
- [ ] Terminasi dengan file 1080p, H.264, MP4
- [ ] Durasi akhir **tidak melebihi 3:00** (cek di timeline editor!)

---

## Voice Over — Naskah Lengkap (siap dibacakan)

> "Bali adalah tujuan wisata paling terkenal di dunia. Tapi bagi wisatawan pertama, keindahan ini bukan fitur — justru menjadi masalah. Ada ratusan tempat, waktu cuma beberapa hari, budget terbatas, dan yang paling penting: banyak yang **tidak tahu adat di tempat yang mereka datangi**.
>
> Griska Go menjawabnya. Cukup lima preferensi — berapa hari, berapa budget, minat apa, gaya seperti apa, dan mau mulai dari mana. AI menyusun rencana per hari lengkap dengan jam, aktivitas, estimasi biaya, dan yang paling penting: **Tips Budaya & Etika di setiap lokasi**. Semuanya dibatasi hanya pada 28 destinasi nyata.
>
> Saya pilih empat hari, budget menengah, minat pantai dan budaya, gaya santai, mulai dari Ubud. Dalam beberapa detik, AI menyusun empat hari rencana, dan setiap lokasi punya tips etika spesifik. Di pura: pakai sarong, jangan menyela barisan.
>
> Sekarang bagian terbaiknya. Saya chat: *'ganti hari 2 jadi lebih santai'*. AI mengingat itinerary saya dan hari kedua langsung berubah di layar. Ini bukan sekadar chat, ini revisi rencana.
>
> Antarmuka dan hasil AI-nya bilingual, Indonesia dan English. Mobile-first, dan aksesibilitasnya nyata — Lighthouse 100.
>
> Secara teknis, pertanyaannya: bagaimana kita tahu AI tidak mengarang? Tiga lapis. System prompt melarang keras menyebut apa pun di luar katalog. Kami paksa Gemini menjawab JSON ketat lewat `responseSchema`. Lalu server memfilter ulang — nama yang tidak ada di katalog dibuang. Semua ini teruji otomatis, 29 uji nol gagal.
>
> Griska Go. Satu klik, rencana jadi. Dan Anda tidak hanya tahu ke mana pergi, tapi juga bagaimana agar dihormati. Terima kasih."

---

<div align="center">

**Griska Go** · Naskah Video Demo · NAISC 2026
</div>
