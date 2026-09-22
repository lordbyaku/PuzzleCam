# Puzzle Udara

Permainan *air-touch*: dikendalikan gerakan tangan di depan kamera, tanpa
mouse dan tanpa keyboard. Target pemakaiannya kios/tablet di lobi hotel,
dioperasikan staf non-teknis.

Folder ini adalah akar repo-nya sendiri
([lordbyaku/PuzzleCam](https://github.com/lordbyaku/PuzzleCam)). Ia kebetulan
berada di dalam `AIRTOUCH/`, yang cuma wadah di disk untuk menampung beberapa
game air-touch — **`AIRTOUCH/` bukan repo**, dan tiap game punya repo sendiri.
Jangan pernah membuat repo di tingkat `AIRTOUCH/`.

## Perintah

Semua dijalankan dari akar repo ini:

```bash
npm run setup     # unduh aset ke mediapipe/ (24 MB) + font/ (33 KB), aman diulang
npm start         # server uji lokal di http://localhost:5500
npm test          # 42 uji otomatis, tanpa browser, tanpa npm install
```

Tidak ada build step dan tidak ada dependensi runtime. Berkas yang diedit
persis berkas yang dijalankan browser.

## Aturan kerja

- **`npm test` harus hijau sebelum commit.** Setiap perbaikan bug yang bisa
  diuji tanpa browser wajib membawa satu skenario baru di `test/harness.js`
  (atau `test/sw-harness.js` untuk service worker), dan skenario itu harus
  terbukti **gagal** pada kode sebelum perbaikan.
- Bahasa Indonesia untuk nama variabel, komentar, pesan UI, dan changelog —
  mengikuti bahasa antarmukanya.
- Komentar menjelaskan **kenapa**, bukan **apa**.
- Versi diubah di **empat** tempat sekaligus: komentar kepala `index.html`,
  `package.json`, `changelog.md`, dan `VERSI` di `sw.js` (semantic versioning).
- Jangan menambah dependensi runtime tanpa alasan kuat. Setiap dependensi
  adalah satu lagi hal yang bisa gagal di wifi tamu hotel.

## Yang mudah bikin celaka

- **`mediapipe/` dan `font/` wajib ikut ter-commit.** Menaruhnya di
  `.gitignore` adalah penyebab paling umum "deploy sukses tapi layar blank".
- **Lupa menaikkan `VERSI` di `sw.js` = aset lama tetap disajikan dari
  cache.** Yang terkena hanya `font/`, `ikon.svg`, `manifest.webmanifest`,
  dan `mediapipe/`; `index.html` jaringan-dulu jadi kode permainan tetap
  ikut ter-update.
- **Update tidak sampai ke kios yang tabnya tidak pernah dimuat ulang.**
  Tidak ada pemicu muat ulang otomatis di kode; lihat DEV.md bagian 6.
- **`.gitattributes` memaksa LF.** Tanpa itu Git di Windows meng-checkout
  `setup-aset.sh` dengan CRLF dan bash menolak menjalankannya.
- **Kamera butuh `https://` atau `http://localhost`.** Membuka `index.html`
  lewat `file://` tidak akan pernah jalan.
- Folder ini berada di bawah `D:\0ANTIGRAVITY`, yang dimiliki akun Windows
  lain. Git menolaknya sebagai *dubious ownership* sampai ada
  `git config --global --add safe.directory D:/0ANTIGRAVITY/AIRTOUCH/PuzzleCam`.

Karena akar repo ini sudah berisi `index.html` langsung, **Root Directory di
Vercel tidak perlu disetel** — biarkan default.

## Uji tanpa kamera

Tambahkan `?mouse=1` pada URL: mouse menggerakkan kursor, klik = mencubit.
Hanya untuk pengembangan; tidak aktif di produksi.

## Perilaku kios yang wajib dipertahankan

Ketiganya membuat permainan boleh ditinggal tanpa pengawasan. Jangan
dilepas tanpa penggantinya:

- **Pulang otomatis saat ditinggal** — foto anak tidak boleh tertinggal di
  layar lobi. Keputusannya lewat `adaOrang()`, yang juga memeriksa apakah
  aliran frame kamera masih hidup.
- **Ketuk 3× pojok kiri-atas** — satu-satunya kendali staf tanpa gestur
  tangan.
- **Muat ulang sekali saat galat beruntun**, lalu kartu bantuan. Jangan
  pernah dibuat berputar muat ulang tanpa henti.
