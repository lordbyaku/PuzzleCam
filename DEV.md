# DEV.md — Puzzle Udara

Panduan untuk developer yang meneruskan atau memodifikasi permainan ini.

---

## 1. Ringkasan teknis

| Hal | Keputusan |
| --- | --- |
| Arsitektur | Satu berkas `index.html`, semua CSS dan JS inline |
| Build step | Tidak ada. Berkas yang kamu edit persis berkas yang dijalankan browser |
| Framework | Tidak ada. Vanilla JS, sintaks ES5 (`var`, tanpa arrow function) |
| Render | Satu `<canvas>` penuh layar. Tidak ada elemen DOM untuk UI permainan |
| Input | MediaPipe Hands → landmark tangan → kursor + gestur cubit |
| Aset | Di-host sendiri di `mediapipe/` dan `font/`; nol permintaan ke jaringan luar saat bermain |
| Penyimpanan | `localStorage` (`puzzleudara.kalibrasi`) + `sessionStorage` (`puzzleudara.pulih`), selalu di-guard try/catch |
| Offline | `sw.js` menyimpan seluruh aset; hanya aktif di `https://` |

**Kenapa satu berkas?** Target deploy-nya statis (Vercel) dan operatornya
staf hotel, bukan developer. Satu berkas berarti tidak ada langkah yang bisa
gagal antara "edit" dan "live". Kalau nanti game bertambah banyak, pecah
modul M6–M12 dulu — mesin tangannya (M3, M4, M7) yang dipakai bersama.

**Kenapa ES5?** Tablet lobi kadang memakai browser lama. Sintaks konservatif
menghindari halaman blank tanpa pesan error.

Yang dibatasi hanya **sintaksnya**. Built-in ES6 seperti `Promise` dan
`Math.hypot` tetap dipakai dan memang ada di kode — batas bawah yang
sesungguhnya ditentukan MediaPipe, yang menuntut WebAssembly SIMD, yaitu
browser 2021 ke atas. Browser yang tidak punya `Math.hypot` juga tidak akan
bisa memuat pelacak tangannya, jadi polyfill untuk itu hanya kode mati.

---

## 2. Menjalankan

```bash
npm run setup     # = bash setup-aset.sh, mengisi mediapipe/ (24 MB) + font/ (33 KB)
npm start         # = python -m http.server 5500
npm test          # = node test/harness.js
```

`npm` di sini hanya pembungkus perintah; proyek ini nol dependensi dan tidak
pernah butuh `npm install`. Skrip setup aman dijalankan berkali-kali.

Kamera hanya jalan di `https://` atau `http://localhost`. Membuka berkas
langsung (`file://`) akan menampilkan instruksi perbaikan, bukan permainan.

**Tanpa kamera:** buka `http://localhost:5500/?mouse=1`. Mouse menggerakkan
kursor, klik = mencubit. Hanya untuk pengembangan; nonaktif di produksi.

---

## 3. Peta modul

Setiap blok di `index.html` diberi penanda `M<n>` pada komentarnya.

| Modul | Isi | Kapan kamu menyentuhnya |
| --- | --- | --- |
| **M1** Elemen & setelan | Referensi DOM, tabel `TINGKAT`, semua konstanta tuning | Mengubah tingkat kesulitan, kepekaan gestur |
| **M2** Keadaan | Semua variabel global. Satu-satunya sumber kebenaran | Menambah state baru |
| **M3** Tata letak | `ukur()`, `hitungPapan()`. Menghitung posisi papan, zona sebar, area main dari ukuran jendela | Mengubah proporsi layar |
| **M4** Tombol dwell | `susunTombol()` per layar, `tbl()`, `kartuTingkat()` | Menambah/memindah tombol |
| **M5** Alur permainan | `mulaiTingkat` → `mulaiMundur` → `jepret` → `buatKeping` → `cekMenang` | Mengubah urutan permainan |
| **M6** Cubit | `ambil()` dan `lepas()`, termasuk logika snap | Mengubah cara kepingan diambil |
| **M7** Pelacakan tangan | `onResults()`. Landmark → posisi kursor + deteksi cubit | Mengubah gestur |
| **M8** Perbarui | `perbarui(dt)`. Satu-satunya tempat state berubah per frame | Menambah logika waktu |
| **M9** Primitif gambar | `bulat()`, `teks()`, `latar()`, `petakMini()`, `gambarTombol()` | Mengubah gaya visual |
| **M10** Papan & kepingan | `gambarPapan()`, `gambarKeping()`, `sorotSlot()` | Mengubah tampilan puzzle |
| **M11** Kursor & kamera | `gambarKursor()`, `gambarKamera()`, `kotakKamera()` | Mengubah umpan balik gestur |
| **M12** Layar | Satu fungsi gambar per layar, `gambarSiagaIdle()`, `gambar()` sebagai dispatcher, `loop()` | Menambah layar baru |
| **M13** Suara | `bunyi()` berbasis WebAudio, tanpa berkas audio | Menambah efek suara |
| **M14** Cadangan mouse & jalan keluar staf | `?mouse=1`, `ketukPojok()`, `cobaLayarPenuh()` | Mengubah kendali staf |
| **M15** Kamera + MediaPipe | Inisialisasi, penanganan error per `err.name`, `jagaLayarNyala()` | Mengubah opsi model |
| **M16** Mulai | Penjaga protokol, pasang listener, daftar service worker, mulai loop | — |

Berkas pendamping di luar `index.html`: `sw.js` (cache offline),
`manifest.webmanifest` + `ikon.svg` (mode layar penuh tablet).

### Aturan pemisahan

`perbarui()` **mengubah** state, `gambar()` **hanya membaca**. Jangan pernah
mengubah state di dalam fungsi gambar — itu membuat bug yang hanya muncul
saat frame drop. Kalau perlu animasi, simpan `{t, dur}` pada objeknya
(lihat `p.anim` dan `p.denyut`) lalu majukan di M8.

### Mesin layar

```
              kamera siap
                   │
     ┌─────────────▼──────────────┐
     │ kalibrasi (sekali seumur   │  auto-lanjut bila tangan
     │ perangkat, disimpan di     │  terlihat + pernah mencubit
     │ localStorage)              │
     └─────────────┬──────────────┘
                   ▼
   ┌────────────► menu ◄────────────┐
   │               │ pilih tingkat  │
   │               ▼                │
   │            mundur (3 dtk)      │
   │               │ jepret()       │
   │               ▼                │
   │             main ──────────────┤ Ganti tingkat
   │               │ semua pas      │
   │               ▼                │
   └──────────── menang ────────────┘
        Main lagi → mundur
```

---

## 4. Konstanta tuning (M1)

| Konstanta | Nilai | Naikkan bila… | Turunkan bila… |
| --- | --- | --- | --- |
| `DWELL` | 1000 ms | Anak tidak sengaja menekan tombol saat lewat | Anak bosan menunggu |
| `CUBIT_ON` | 0.45 | Tangan kecil susah terdeteksi mencubit | Kepingan terambil sendiri |
| `CUBIT_OFF` | 0.62 | Genggaman sering lepas di tengah jalan | Kepingan susah dilepas |
| `GAIN` | 1.30 | Sudut layar tidak terjangkau | Kursor terasa terlalu liar |
| `SNAP` | 0.55 | Kepingan susah menempel | Kepingan menempel ke slot yang salah |
| `DETIK_MUNDUR` | 3 | Anak perlu waktu bergaya | — |
| `JEDA_PETUNJUK` | 22000 ms | Petunjuk terlalu cepat muncul | Anak terlalu lama bingung |
| `IDLE_SIAGA` | 45000 ms | Anak sering dianggap pergi padahal masih main | Foto terlalu lama tertinggal di layar |
| `IDLE_PULANG` | 10000 ms | Peringatan terlalu cepat berlalu | — |
| `FRAME_MATI` | 2000 ms | Kamera lambat dan sering dianggap mati | — |
| `FRAME_SEGAR` | 400 ms | Dwell putus-putus di tablet lawas | — (**wajib tetap di bawah `DWELL`**) |
| `KETUK_ZONA` | 96 px | Staf susah mengenai pojoknya | Anak tidak sengaja memicunya |
| `KETUK_JEDA` | 1200 ms | Staf mengetuk terlalu pelan | — |
| `BATAS_GALAT` | 60 frame | Kios terlalu sering muat ulang sendiri | — |
| `BATAS_JARINGAN` (sw.js) | 3000 ms | Jaringan lambat tapi sehat sering dilewati | Kios terlalu lama diam di layar kosong |
| `MODEL` | 1 | — | Set `0` untuk model ringan 2 MB di tablet lawas |

`CUBIT_ON` dan `CUBIT_OFF` adalah rasio terhadap panjang telapak
(pergelangan → pangkal jari tengah), **bukan** jarak absolut. Ini yang
membuat kepekaan tetap sama saat anak maju-mundur dari kamera — jangan
ganti jadi ambang jarak tetap.

---

## 5. Uji otomatis

```bash
npm test          # = harness permainan + harness service worker
```

Dua berkas, dijalankan berurutan:

| Berkas | Isi |
| --- | --- |
| `test/harness.js` | 32 skenario permainan di atas stub canvas/DOM |
| `test/sw-harness.js` | 10 skenario `sw.js` di atas stub Cache API + fetch |

Tidak butuh browser dan tidak butuh `npm install`. Skrip mengambil blok
`<script>` terakhir dari `index.html`, menjalankannya di `vm` Node di atas
stub canvas/DOM, lalu menyuntikkan landmark tangan palsu untuk meniru pemain.

Cakupannya 32 skenario:

- tata letak di 8 ukuran layar × 3 tingkat × 4 layar — semua tombol wajib di dalam viewport
- alur penuh menu → tingkat → hitung mundur → menyusun 4 kepingan → menang
- tangan hilang saat menggenggam
- resize saat bermain tidak mengacak kepingan
- kamera belum siap saat hitung mundur habis
- kepingan yang dilepas tidak menutupi baris tombol
- dwell nonaktif saat sedang mencubit
- toggle suara, sistem petunjuk, animasi tempel, layar kalibrasi
- 1000 frame tanpa tangan
- bilah kemajuan tidak beririsan dengan pratinjau kamera di 9 ukuran layar
- judul menu punya ruang cukup di bawah pratinjau kamera
- kepingan hasil sebar awal tidak keluar dari area main
- label tombol muat di dalam pilnya di 9 ukuran layar × 4 layar
- ditinggal pergi: pulang ke menu dan foto terhapus
- peringatan idle muncul lalu batal saat orang kembali
- aliran frame kamera mati dianggap tidak ada orang
- kamera beku tidak menekan tombol sendiri
- ketuk 3× pojok memaksa pulang; ketuk di luar pojok tidak
- `loop()` memuat ulang sekali lalu menyerah dengan kartu bantuan

**Jalankan ini sebelum setiap commit.** Kalau kamu menambah tombol atau layar,
tambahkan id-nya ke daftar layar di uji tata letak — itu yang paling sering
menangkap regresi.

Uji tabrakan memakai `kotakKamera()` dan `bilahKotak()` sebagai kontrak
geometri. Kalau kamu memindahkan pratinjau kamera atau bilah kemajuan, ubah
kedua fungsi itu — jangan menulis ulang koordinatnya di fungsi gambar, karena
uji-nya membaca dari sana.

Stub canvas-nya menaksir lebar teks dari `ctx.font` (~0,52 em per karakter)
dan mencatat setiap `fillText`, jadi teks yang meluber keluar tombol ikut
tertangkap. Taksiran itu kasar; kalau kamu mengganti fontnya, sesuaikan
`lebarTeks()` di harness.

### Harness service worker

`test/sw-harness.js` menjalankan `sw.js` di atas stub Cache API dan `fetch`.
Cakupannya: install yang sebagian gagal, pembuangan cache versi lama, dan
tiga keadaan jaringan pada permintaan halaman — sehat (ambil versi terbaru),
mati (pakai cache), dan **menggantung** (pakai cache setelah `BATAS_JARINGAN`).

Yang ketiga itu yang paling penting dan paling mudah terlewat: wifi tamu
hotel lebih sering menggantung daripada menolak. Uji itu menurunkan
`BATAS_JARINGAN` jadi 60 ms supaya cepat; kalau kamu mengubah strategi
cache halaman, pastikan uji itu tetap selesai — pada versi tanpa batas
waktu, harness-nya menggantung selamanya, persis seperti kiosnya.

Yang **tidak** dicakup: kualitas pelacakan tangan sungguhan, izin kamera,
dan tampilan visual. Ketiganya harus dicoba manual di perangkat asli.

---

## 6. Deploy

```bash
vercel --prod
```

- Folder `mediapipe/` dan `font/` **harus ikut ter-commit**. Jangan masukkan
  `.gitignore`. Ini penyebab paling umum "deploy sukses tapi layar blank".
- **Naikkan `VERSI` di `sw.js` setiap rilis.** Yang jadi basi kalau lupa
  hanya aset di cache — `font/`, `ikon.svg`, `manifest.webmanifest`, dan
  `mediapipe/`. Kode permainannya sendiri tetap ikut ter-update, karena
  `index.html` disajikan jaringan-dulu. Jadi ini baru benar-benar menggigit
  saat Anda mengubah salah satu dari keempat aset itu — tapi biasakan saja
  menaikkannya, karena kasus itu paling sulit didiagnosis.
- `vercel.json` memberi `Permissions-Policy: camera=(self)`,
  `Cache-Control: immutable` untuk `/mediapipe/*` dan `/font/*`, serta
  sengaja **melarang** cache panjang untuk `/sw.js` dan
  `/manifest.webmanifest` — keduanya jalur update.
- Kalau mengganti versi MediaPipe, ganti juga nama foldernya
  (`mediapipe-v2/` + ubah `MP_DIR`) supaya cache lama tidak nyangkut. Daftar
  berkas di `sw.js` ikut diubah.
- `.vercelignore` menahan `DEV.md`, `changelog.md`, `README.md`, `test/`, dan
  `setup-aset.sh` supaya tidak bisa dibuka publik di situsnya.
- Akar repo ini sudah berisi `index.html` langsung, jadi **Root Directory di
  Vercel tidak perlu disetel**. Tiap game air-touch punya repo sendiri; folder
  `AIRTOUCH/` di disk cuma wadah dan bukan repo (lihat bagian 7).
- `.gitattributes` memaksa LF. Tanpa itu, Git di Windows meng-checkout
  `setup-aset.sh` dengan CRLF dan bash menolak menjalankannya.

Repo jadi ~24 MB. Untuk merampingkan, hapus `hands_solution_wasm_bin.js`
dan `.wasm` (fallback non-SIMD, 6 MB) — semua browser sejak 2021 mendukung
SIMD. Sisakan kalau perangkat targetnya tua.

---

## 7. Menambah game baru ke arena

Rencananya permainan ini bergabung dengan game air-touch lain dalam satu menu.
Yang bisa dipakai ulang tanpa perubahan:

- **M3** tata letak responsif
- **M4** sistem tombol dwell
- **M7** pelacakan tangan + deteksi cubit
- **M9** primitif gambar
- **M11** kursor dan pratinjau kamera
- **M13** suara
- **M15** inisialisasi kamera dan penanganan error

Yang game-specific hanya M5, M6, M10, dan fungsi gambar layarnya di M12.
Saat memecah, ekspor tujuh modul di atas sebagai `airtouch.js` dan biarkan
setiap game mendaftarkan `{ perbarui, gambar, susunTombol }` miliknya sendiri.

**Satu game, satu repo.** Folder `AIRTOUCH/` di disk hanya wadah agar
game-game bersebelahan saat dikerjakan; ia bukan repo dan tidak boleh
dijadikan repo. Konsekuensinya, `airtouch.js` nanti tidak bisa sekadar
di-`import` lintas folder — ia perlu repo sendiri dan disalin (atau dipasang
sebagai submodule) ke tiap game. Itu harga yang dibayar untuk deploy Vercel
yang sederhana: tiap repo langsung berisi `index.html` di akarnya, tanpa
Root Directory yang bisa lupa disetel.

---

## 8. Jebakan yang sudah pernah kena

| Gejala | Sebab | Sudah diatasi di |
| --- | --- | --- |
| Hitung mundur menampilkan angka minus | `jepret()` gagal saat kamera belum kirim frame, tapi timer jalan terus | v1.1.0 |
| Kepingan teracak saat HP diputar | resize memanggil re-scatter | v1.1.0 |
| Kepingan menutupi tombol | tidak ada clamp saat dilepas | v1.1.0 |
| Unhandled promise rejection di Chrome | `AudioContext.resume()` tanpa interaksi | v1.1.0 |
| Game membeku total | satu exception memutus rantai `requestAnimationFrame` | v1.1.0 |
| Kursor meleset dari titik yang dituju | lupa membalik `GAIN` saat memetakan balik koordinat | uji harness |
| Dialog Inggris "Failed to acquire camera feed" muncul di kios | `camera_utils` memanggil `alert()` sendiri sebelum melempar error | v1.3.1 |
| Tangan berhenti terdeteksi diam-diam, permainan tetap tergambar | `Camera.onFrame()` dipanggil tanpa `try/catch` oleh pustakanya; satu lemparan sinkron memutus rantai frame-nya | v1.3.1 |
| Bilah kemajuan terpotong pratinjau kamera di HP | bilah di-tengah, pratinjau di pojok kanan-atas, dan pratinjau digambar belakangan | v1.3.1 |
| `setup-aset.sh` gagal saat dijalankan ulang | tarball npm memasang berkas mode 444, `cp` biasa tidak bisa menimpa | v1.3.1 |
| Label tombol meluber keluar pilnya di HP | ukuran huruf dipatok, lebar pil ikut lebar layar | v1.3.1 |
| Foto anak tertinggal di layar lobi tanpa batas waktu | tidak ada konsep "ditinggal pergi" sama sekali | v1.4.0 |
| Kios tidak bisa diapa-apakan staf saat pelacakan bermasalah | aplikasi tidak mendengarkan satu pun sentuhan | v1.4.0 |
| Kamera beku menekan tombol sendiri | `tanganAda` beku di `true`; kursor yang kebetulan berhenti di atas tombol menyelesaikan dwell tanpa ada orang | v1.4.0 |

### Yang belum kena tapi sudah dijaga

- Posisi awal kepingan tidak pernah dijepit ke area main; di layar sangat
  pendek zona sebar bisa melewatinya. Sekarang `sebar()` memanggil
  `jagaDiArea()` dan ada uji regresinya.
- `tanganAda` beku di nilai terakhir kalau aliran frame kamera berhenti.
  Untuk keputusan kios, bacaannya lewat `adaOrang()` yang ikut memeriksa
  `sejakFrame` — kalau tidak, kios yang kameranya mati tidak pernah pulang.

### Hal yang sengaja tidak dilakukan

- **Tidak ada polyfill `Math.hypot`.** Browser yang tidak punya itu juga
  tidak bisa memuat WASM SIMD milik MediaPipe, jadi polyfill-nya kode mati.
- **Service worker tidak aktif di localhost.** Cache yang menahan berkas
  hasil edit jauh lebih merepotkan daripada manfaatnya saat mengembangkan.
- **Layar penuh tidak dipaksa.** Browser menolaknya tanpa gestur pengguna,
  dan permainan ini sengaja bebas gestur. Mode kios lewat flag Chrome tetap
  jalur yang andal; `cobaLayarPenuh()` hanya memanfaatkan sentuhan yang
  kebetulan ada.

---

## 9. Konvensi

- Nama variabel dan komentar dalam bahasa Indonesia, mengikuti bahasa UI.
- Komentar menjelaskan **kenapa**, bukan **apa**. Kode sudah menjelaskan apa.
- Tidak ada dependensi runtime baru tanpa alasan kuat — setiap dependensi
  adalah satu lagi hal yang bisa gagal di wifi tamu hotel.
- Setiap perubahan masuk `changelog.md` dengan semantic version, dan versinya
  ikut diubah di **empat** tempat: komentar kepala `index.html`,
  `package.json`, `changelog.md`, dan `VERSI` di `sw.js`. Yang terakhir paling
  mudah terlupa dan akibatnya paling membingungkan — kios menyajikan aset lama
  dari cache dan perubahan Anda seolah-olah tidak pernah ter-deploy.
- `npm test` harus hijau sebelum commit. Setiap perbaikan bug yang bisa
  diuji tanpa browser wajib membawa satu skenario baru di `test/harness.js` —
  pastikan skenario itu **gagal** pada kode sebelum perbaikan.
