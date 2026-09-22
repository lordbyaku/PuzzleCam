# Changelog

Semua perubahan penting pada Puzzle Udara dicatat di berkas ini.

Format mengikuti [Keep a Changelog](https://keepachangelog.com/id/1.1.0/),
dan proyek ini memakai [Semantic Versioning](https://semver.org/lang/id/).

---

## [1.4.0] — 2026-09-22

Rilis yang mengubah permainan ini dari "demo yang bagus" menjadi sesuatu yang
boleh ditinggal tanpa pengawasan di lobi.

### Ditambahkan
- **Pulang otomatis saat ditinggal.** Setelah 45 detik tanpa orang di layar
  yang memuat foto, muncul peringatan 10 detik, lalu permainan kembali ke menu
  — yang sekaligus menghapus fotonya. Sebelumnya foto anak bisa terpampang di
  layar lobi tanpa batas waktu sampai ada orang lain bermain. Atur lewat
  `IDLE_SIAGA` dan `IDLE_PULANG`.
- **Penjaga aliran frame** (`FRAME_MATI`). Kalau pipeline kamera berhenti,
  `tanganAda` beku di nilai terakhir. Untuk urusan kios itu kini dibaca sebagai
  "tidak ada orang", sehingga kios tetap pulang ke menu alih-alih menggantung.
- **Jalan keluar untuk staf:** ketuk tiga kali di pojok kiri-atas untuk memaksa
  kembali ke menu. Sebelumnya, kalau pelacakan tangan bermasalah, staf hotel
  sama sekali tidak bisa mengendalikan kios tanpa me-reload browser.
- **Wake lock.** Layar tablet tidak lagi tidur di tengah sesi. Kuncinya diminta
  ulang setiap kali tab kembali terlihat, karena browser melepasnya saat tab
  tersembunyi.
- **Service worker** (`sw.js`). Permainan tetap bisa dimuat walau wifi tamu
  putus. `index.html` memakai jaringan dulu supaya deploy baru langsung
  terlihat; aset lainnya dari cache dulu. Hanya aktif di `https://` — di
  localhost cache cuma menyulitkan pengembangan.
- **Manifest PWA + ikon** (`manifest.webmanifest`, `ikon.svg`) dengan
  `display: fullscreen`, dan permintaan layar penuh saat layar disentuh.
  Catatan: browser menolak layar penuh tanpa gestur, jadi mode kios lewat flag
  Chrome tetap jalur yang lebih andal.
- **Pemulihan otomatis dari galat beruntun.** 60 frame galat berturut-turut
  memicu satu kali muat ulang; kalau setelah itu masih rusak, muncul kartu
  bantuan untuk staf. Sebelumnya layar kios bisa membeku diam-diam.
- `.vercelignore` — `DEV.md`, `changelog.md`, `test/`, dan skrip setup tidak
  lagi ikut terbit dan bisa dibuka publik di `https://<situs>/DEV.md`.
- Tujuh uji regresi baru (total 32), semuanya sudah diverifikasi **gagal** pada
  v1.3.1. Stub harness kini punya `sessionStorage` dan `location.reload`
  terhitung, sehingga jalur muat-ulang bisa diuji tanpa browser.

### Diubah
- **Font Baloo 2 di-host sendiri** di `font/` (satu berkas variable, 33 KB).
  Ini menutup satu-satunya permintaan ke jaringan luar yang tersisa saat
  bermain — janji yang sudah tertulis di DEV.md tapi belum ditepati.
- `setup-mediapipe.sh` → **`setup-aset.sh`**, karena sekarang juga mengunduh
  font. Titik masuknya tetap `npm run setup`.
- `vercel.json`: `sw.js` dan `manifest.webmanifest` tidak boleh di-cache lama
  (itu jalur update-nya), `font/` ikut `immutable`, dan ditambah
  `Referrer-Policy: same-origin`.
- M14 kini bernama "Cadangan mouse & jalan keluar staf".

---

## [1.3.1] — 2026-09-21

### Diperbaiki
- Dialog browser berbahasa Inggris "Failed to acquire camera feed: …" muncul
  saat izin kamera ditolak. Itu datang dari `camera_utils`, yang memanggil
  `alert()` sendiri sebelum melempar error. `alert` kini dibungkam selama
  `kamera.start()` sehingga yang terlihat hanya kartu bantuan bahasa Indonesia.
- Pelacakan tangan bisa berhenti diam-diam selamanya. `Camera.onFrame()`
  dipanggil pustakanya tanpa `try/catch` dan rantai `requestAnimationFrame`-nya
  hanya dilanjutkan lewat `.then()`, jadi satu lemparan sinkron dari
  `hands.send()` mematikan pengiriman frame — permainan tetap tergambar tapi
  tangan tidak lagi terdeteksi, tanpa pesan apa pun.
- Bilah kemajuan dan pencacah kepingan tertimpa pratinjau kamera di semua
  lebar HP (320–414 px). Keduanya kini rata kiri dan lebarnya berhenti sebelum
  kotak pratinjau.
- Judul di layar menu menyenggol pratinjau kamera di layar sempit. Kartu
  tingkat kini dimulai cukup jauh di bawah pratinjau sehingga judul kebagian
  ruang.
- `setup-mediapipe.sh` gagal "Permission denied" saat dijalankan ulang: tarball
  npm memasang berkasnya mode 444 dan `cp` biasa tidak bisa menimpanya. Karena
  `set -e`, skrip berhenti di tengah dan menyisakan `mediapipe/` separuh jadi.
- Posisi awal kepingan tidak pernah dijepit ke area main — di layar sangat
  pendek zona sebar bisa melewatinya. `sebar()` kini memanggil `jagaDiArea()`,
  sama seperti `lepas()`.
- Label tombol meluber keluar pilnya di lebar HP — "Ganti tingkat" butuh
  ~130 px sedangkan pilnya hanya 101 px di layar 375 px. Huruf kini mengecil
  otomatis sampai muat.

### Ditambahkan
- `package.json` dengan `npm test`, `npm start`, dan `npm run setup`. Tetap
  nol dependensi; `npm install` tidak pernah perlu dijalankan.
- Empat uji regresi baru (total 25): tabrakan bilah kemajuan dengan pratinjau
  kamera, ruang judul menu, penyebaran kepingan, dan label tombol yang muat di
  pilnya. Keempatnya sudah diverifikasi **gagal** pada kode sebelum perbaikan.
- `kotakKamera()` dan `bilahKotak()` sebagai satu-satunya sumber geometri
  pratinjau kamera dan bilah kemajuan, supaya bisa diuji tanpa menggambar.
- `teksMuat()` di M9: menggambar teks sambil mengecilkan hurufnya sampai muat
  di lebar yang diberikan.
- Stub canvas di harness kini menaksir lebar teks dari `ctx.font` dan mencatat
  setiap `fillText`, sehingga teks yang meluber bisa ditangkap tanpa browser.
- `.gitattributes` yang memaksa LF — Git di Windows meng-checkout
  `setup-mediapipe.sh` dengan CRLF dan bash menolak menjalankannya.

### Diubah
- `test/harness.js` dipindahkan dari akar folder. Berkasnya mencari
  `__dirname/../index.html` dan DEV.md menyebut `node test/harness.js`, jadi
  dijalankan apa adanya selalu ENOENT.
- Google Fonts dimuat non-blocking. Bila wifi tamu memblokir
  `fonts.googleapis.com`, halaman tampil seketika dengan font sistem alih-alih
  menunggu DNS timeout.
- DEV.md meluruskan klaim "ES5-compatible": yang dibatasi hanya sintaksnya,
  sedangkan built-in ES6 (`Promise`, `Math.hypot`) memang dipakai dan aman
  karena MediaPipe sendiri menuntut browser 2021 ke atas.
- Perhitungan teks kartu tingkat disederhanakan; satu cabang lama tidak pernah
  terpakai.

---

## [1.3.0] — 2026-09-21

### Ditambahkan
- Layar kalibrasi sekali-jalan: pratinjau kamera besar dengan rangka tangan
  dan dua ceklis (tangan terlihat, coba mencubit). Lanjut otomatis ke menu,
  status disimpan di `localStorage` agar tidak muncul lagi.
- Cincin dwell mengelilingi kursor, jadi anak melihat progres tekan di tempat
  matanya sedang tertuju — bukan hanya pada tombolnya.
- Kartu tingkat kesulitan dengan pratinjau petak 2×2 / 3×3 / 4×4, menggantikan
  tombol teks polos.
- Bilah kemajuan dan pencacah kepingan di layar main.
- Sistem petunjuk: setelah 22 detik tanpa kemajuan, slot tujuan salah satu
  kepingan berkedip. `JEDA_PETUNJUK` bisa diatur.
- Animasi tempel kepingan (easing 170 ms), denyut konfirmasi, dan semburan
  kilau di slot yang benar.
- Tombol suara aktif/mati di menu.
- Tiga bintang melayang di layar menang.
- Latar menu dengan siluet kepingan yang hanyut pelan.
- Dukungan `prefers-reduced-motion`: semua animasi dekoratif dimatikan.
- Uji otomatis `test/harness.js` — 21 skenario, tanpa browser dan tanpa
  `npm install`. Menjalankan kode asli dari `index.html` di atas stub canvas.
- `DEV.md` berisi peta modul M1–M16, tabel konstanta tuning, dan catatan deploy.

### Diubah
- Palet dipertegas (`#140A38` → `#34177E`) dengan gradien tiga titik.
- Pratinjau kamera kini selalu tampil, diberi pigura, dan bingkainya menyala
  hijau saat tangan terdeteksi.
- Kepingan yang diangkat membesar 7% dengan bayangan lebih dalam.
- Tata letak menu adaptif: kartu menyusut otomatis di layar pendek sehingga
  tetap muat di 320×360.
- Seluruh kode diberi penanda modul `M1`–`M16` yang dirujuk `DEV.md`.

---

## [1.2.0] — 2026-09-21

### Diubah
- Seluruh aset MediaPipe (model tangan, wasm, binarypb) di-host sendiri di
  `mediapipe/`. Tidak ada lagi permintaan ke `cdn.jsdelivr.net` saat bermain,
  sehingga loading cepat dan tidak bergantung jaringan luar.
- Pesan kegagalan pemuatan pustaka kini menunjuk folder lokal dan skrip setup,
  bukan CDN.

### Ditambahkan
- `setup-mediapipe.sh` — mengunduh versi yang dipatok dari registry npm,
  menyalin hanya berkas yang dipakai, lalu memverifikasi hasilnya.
- Konstanta `MP_DIR` (lokasi folder aset) dan `MODEL` (0 = model ringan 2 MB
  untuk tablet lawas, 1 = akurat).
- `vercel.json`: `Cache-Control: immutable` untuk `/mediapipe/*`.
- `README.md` berisi langkah setup dan deploy.

---

## [1.1.0] — 2026-09-21

### Diperbaiki
- Hitung mundur bisa menampilkan angka nol dan minus bila kamera belum
  mengirim frame saat hitungan habis. Kini dijepit di 0, teks berubah menjadi
  "Menunggu kamera…", dan otomatis lanjut begitu frame pertama masuk.
- Kepingan teracak ulang setiap kali jendela diubah ukurannya atau HP diputar.
  Posisi kini diskalakan proporsional.
- Kepingan yang dilepas di dekat tepi bawah bisa menutupi baris tombol.
- `AudioContext.resume()` menghasilkan unhandled promise rejection di Chrome
  sebelum ada interaksi pengguna.
- Satu exception saat menggambar memutus rantai `requestAnimationFrame` dan
  membekukan permainan selamanya. Loop dan callback `onResults` kini dibungkus
  try/catch.
- Zona sebar bisa bernilai negatif di layar sangat sempit.
- Pratinjau kamera hilang saat tangan tidak terdeteksi.

### Ditambahkan
- Pesan error kamera spesifik per `err.name`: izin ditolak, kamera tidak
  ditemukan, kamera dipakai aplikasi lain — masing-masing dengan langkah
  perbaikannya.
- Timeout 20 detik bila pelacak tangan tidak kunjung dimuat.
- Penyebaran kepingan memakai 14 percobaan untuk memilih titik paling renggang.
- `document.hidden` menghentikan pengiriman frame saat tab tidak aktif.
- `vercel.json` dengan `Permissions-Policy: camera=(self)`.

### Diubah
- Cadangan mouse yang dulu selalu aktif kini hanya jalan bila URL memuat
  `?mouse=1`, sehingga produksi benar-benar bebas mouse.

---

## [1.0.0] — 2026-09-21

Rilis pertama. Terinspirasi dari puzzle-cam, dirombak agar benar-benar bebas
mouse dan keyboard.

### Ditambahkan
- Puzzle foto dari jepretan webcam, dimainkan sepenuhnya dengan gerakan tangan.
- Dwell click: menahan telunjuk 1 detik di atas tombol menggantikan klik,
  sehingga tombol rana dan reset tidak lagi butuh mouse.
- Deteksi cubit relatif terhadap ukuran telapak dengan histeresis, sehingga
  kepekaan tetap sama saat anak maju-mundur dari kamera.
- Foto otomatis lewat hitung mundur 3 detik.
- Tiga tingkat kesulitan: 2×2 (5–6 tahun), 3×3 (7–9 tahun), 4×4 (10–13 tahun).
- Bantuan visual: bayangan gambar utuh di papan, slot tujuan menyala saat
  kepingan mendekat, kursor besar, toleransi tempel 55% ukuran sel.
- Penghalusan kursor adaptif dan perluasan jangkauan 1,3× untuk tangan kecil.
- Tata letak responsif potret dan lanskap.
- Konfeti dan efek suara WebAudio tanpa berkas audio.
