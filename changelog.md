# Changelog

Semua perubahan penting pada Puzzle Udara dicatat di berkas ini.

Format mengikuti [Keep a Changelog](https://keepachangelog.com/id/1.1.0/),
dan proyek ini memakai [Semantic Versioning](https://semver.org/lang/id/).

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
