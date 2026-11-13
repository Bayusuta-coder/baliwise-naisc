# Gambar carousel hero — Griska Go

Gambar ini dipakai pada carousel utama di section Hero.

## Format

| File | Ukuran | Peran |
|---|---|---|
| `hero-1.jpg` … `hero-5.jpg` | 1400–1600 px, **format 1:1 (persegi)** | Varian besar (desktop / tablet). Dipakai otomatis oleh `srcset`. |
| `hero-1-800.jpg` … `hero-5-800.jpg` | 800 px, 1:1 | Varian kecil (mobile), dipilih otomatis oleh `srcset`. |

- Resolusi minimal **1600 px sisi lebar** (atau 1400 px untuk foto yang sangat detail) supaya tidak pecah di layar besar.
- Rasio **1:1** disengaja: carousel desktop memakai bidang yang lebih lebar, sehingga foto bisa digeser secara vertikal lewat `object-position` tanpa kehilangan resolusi.
- Disarankan di bawah ±700 KB per file (versi `-800` di bawah ±300 KB).
- Format JPG, kualitas 66–72.

## Framing (posisi subjek utama)

Framing dasar sudah dipotong rapi di sisi server (focal point per foto), lalu
diperhalus lagi lewat `object-position` yang tersimpan di HTML:

```html
<article class="carousel__slide" data-posisi="center 65%" ...>
```

| Slide | Destinasi | `data-posisi` | Arti |
|---|---|---|---|
| hero-1 | Ulun Danu Beratan (Bedugul) | `center 65%` | Fokus ke pura, langit berkabut terpotong sebagian |
| hero-2 | Uluwatu (sunset & Tari Kecak) | `center 55%` | Fokus ke tebing & puranya, langit dipangkas |
| hero-3 | Tegallalang (sawah terasering) | `center 50%` | Terasering mengisi frame |
| hero-4 | Nusa Penida (Kelingking) | `center 40%` | Fokus ke tebing T-Rex, pantai di bawahnya |
| hero-5 | Tanah Lot (pura di atas laut) | `center 60%` | Fokus ke siluet pura & matahari terbenam |

**Cara menyesuaikan:** ubah nilai `data-posisi` pada `<article class="carousel__slide">`
di `index.html`. Format: `horizontal vertical` (contoh `center 40%`, `left 30% 55%`).
Nilai ini langsung berlaku, tanpa perlu mengubah CSS.

## Mengganti foto

1. Simpan foto baru (minimal 1600 px, rasio 1:1) sebagai `hero-N.jpg` di folder ini.
2. Opsional: buat juga `hero-N-800.jpg` untuk varian mobile.
3. Refresh browser — tidak ada perubahan kode yang diperlukan.

## Credit

Foto saat ini: Unsplash (lisensi bebas pakai dengan atribusi). Angka & lokasi
foto/focal point sudah disesuaikan agar subjek utama selalu terlihat jelas.
