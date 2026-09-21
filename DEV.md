# DEV.md — Puzzle Udara

Panduan untuk developer yang meneruskan atau memodifikasi permainan ini.

---

## 1. Ringkasan teknis

| Hal | Keputusan |
| --- | --- |
| Arsitektur | Satu berkas `index.html`, semua CSS dan JS inline |
| Build step | Tidak ada. Berkas yang kamu edit persis berkas yang dijalankan browser |
| Framework | Tidak ada. Vanilla JS, ES5-compatible (`var`, tanpa arrow function) |
| Render | Satu `<canvas>` penuh layar. Tidak ada elemen DOM untuk UI permainan |
| Input | MediaPipe Hands → landmark tangan → kursor + gestur cubit |
| Aset | Di-host sendiri di `mediapipe/`, nol permintaan ke CDN saat bermain |
| Penyimpanan | `localStorage` satu kunci (`puzzleudara.kalibrasi`), selalu di-guard try/catch |

**Kenapa satu berkas?** Target deploy-nya statis (Vercel) dan operatornya
staf hotel, bukan developer. Satu berkas berarti tidak ada langkah yang bisa
gagal antara "edit" dan "live". Kalau nanti game bertambah banyak, pecah
modul M6–M12 dulu — mesin tangannya (M3, M4, M7) yang dipakai bersama.

**Kenapa ES5?** Tablet lobi kadang memakai browser lama. Sintaks konservatif
menghindari halaman blank tanpa pesan error.

---

## 2. Menjalankan

```bash
bash setup-mediapipe.sh       # sekali saja, mengisi folder mediapipe/ (~24 MB)
python3 -m http.server 5500   # atau: VS Code → Live Server
# buka http://localhost:5500
```

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
| **M11** Kursor & kamera | `gambarKursor()`, `gambarKamera()` | Mengubah umpan balik gestur |
| **M12** Layar | Satu fungsi gambar per layar + `gambar()` sebagai dispatcher | Menambah layar baru |
| **M13** Suara | `bunyi()` berbasis WebAudio, tanpa berkas audio | Menambah efek suara |
| **M14** Cadangan mouse | Aktif hanya bila `?mouse=1` | — |
| **M15** Kamera + MediaPipe | Inisialisasi, penanganan error per `err.name` | Mengubah opsi model |
| **M16** Mulai | Penjaga protokol, pasang listener, mulai loop | — |

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
| `MODEL` | 1 | — | Set `0` untuk model ringan 2 MB di tablet lawas |

`CUBIT_ON` dan `CUBIT_OFF` adalah rasio terhadap panjang telapak
(pergelangan → pangkal jari tengah), **bukan** jarak absolut. Ini yang
membuat kepekaan tetap sama saat anak maju-mundur dari kamera — jangan
ganti jadi ambang jarak tetap.

---

## 5. Uji otomatis

```bash
node test/harness.js
```

Tidak butuh browser dan tidak butuh `npm install`. Skrip mengambil blok
`<script>` terakhir dari `index.html`, menjalankannya di `vm` Node di atas
stub canvas/DOM, lalu menyuntikkan landmark tangan palsu untuk meniru pemain.

Cakupannya 21 skenario:

- tata letak di 8 ukuran layar × 3 tingkat × 4 layar — semua tombol wajib di dalam viewport
- alur penuh menu → tingkat → hitung mundur → menyusun 4 kepingan → menang
- tangan hilang saat menggenggam
- resize saat bermain tidak mengacak kepingan
- kamera belum siap saat hitung mundur habis
- kepingan yang dilepas tidak menutupi baris tombol
- dwell nonaktif saat sedang mencubit
- toggle suara, sistem petunjuk, animasi tempel, layar kalibrasi
- 1000 frame tanpa tangan

**Jalankan ini sebelum setiap commit.** Kalau kamu menambah tombol atau layar,
tambahkan id-nya ke daftar layar di uji tata letak — itu yang paling sering
menangkap regresi.

Yang **tidak** dicakup: kualitas pelacakan tangan sungguhan, izin kamera,
dan tampilan visual. Ketiganya harus dicoba manual di perangkat asli.

---

## 6. Deploy

```bash
vercel --prod
```

- Folder `mediapipe/` **harus ikut ter-commit**. Jangan masukkan `.gitignore`.
  Ini penyebab paling umum "deploy sukses tapi layar blank".
- `vercel.json` memberi `Permissions-Policy: camera=(self)` dan
  `Cache-Control: immutable` untuk `/mediapipe/*`.
- Kalau mengganti versi MediaPipe, ganti juga nama foldernya
  (`mediapipe-v2/` + ubah `MP_DIR`) supaya cache lama tidak nyangkut.

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

---

## 9. Konvensi

- Nama variabel dan komentar dalam bahasa Indonesia, mengikuti bahasa UI.
- Komentar menjelaskan **kenapa**, bukan **apa**. Kode sudah menjelaskan apa.
- Tidak ada dependensi runtime baru tanpa alasan kuat — setiap dependensi
  adalah satu lagi hal yang bisa gagal di wifi tamu hotel.
- Setiap perubahan masuk `changelog.md` dengan semantic version.
