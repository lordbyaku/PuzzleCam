# Puzzle Udara

Puzzle foto yang dimainkan sepenuhnya dengan gerakan tangan di depan kamera.
Tanpa mouse, tanpa keyboard, tanpa build step.

## Kendali

| Aksi | Gerakan |
| --- | --- |
| Gerakkan kursor | Telunjuk |
| Tekan tombol | Tahan telunjuk di atas tombol 1 detik sampai warnanya penuh |
| Ambil kepingan | Cubit jempol + telunjuk di atas kepingan |
| Seret | Tetap mencubit, gerakkan tangan |
| Lepas / tempel | Buka tangan di dekat slot tujuan |

Foto diambil otomatis lewat hitung mundur 3 detik, jadi tidak ada tombol
rana yang perlu diklik.

## Mode Versus

Dua anak bisa bertanding di satu layar. Pilih **2 Pemain** di menu, lalu satu
foto diambil memuat keduanya — masing-masing menyusun salinannya di belahan
layarnya sendiri, dan yang lebih dulu selesai menang.

| Hal | Keterangan |
| --- | --- |
| Posisi | Berdiri bersebelahan. Yang di kiri memegang papan kiri |
| Orientasi | **Hanya lanskap.** Di potret, pilihan 2 pemain tidak muncul |
| Tingkat | 2×2 dan 3×3. 4×4 khusus mode 1 pemain |
| Selama bertanding | Tiap belahan hanya punya tombol "Acak lagi" miliknya sendiri — tidak ada tombol keluar, supaya yang kalah tidak bisa membatalkan permainan lawannya |
| Waktu | Satu jam bersama di tengah layar. Ronde berakhir begitu salah satu selesai, jadi waktu yang tercatat adalah waktu pemenang |

Gestur kedua belahan tidak bisa saling tabrak: kursor tiap anak terkunci di
belahannya, dan kepingan lawan tidak bisa diambil walau kebetulan berada tepat
di bawah kursornya.

## Untuk staf hotel

| Situasi | Yang harus dilakukan |
| --- | --- |
| Kios nyangkut, pelacakan tangan tidak jalan | **Ketuk 3× pojok kiri-atas layar** — permainan kembali ke menu |
| Dua anak bertanding dan ingin berhenti | Ketuk 3× pojok kiri-atas. Selama bertanding memang tidak ada tombol keluar di layar |
| Anak pergi di tengah permainan | Tidak perlu apa-apa. Setelah 45 detik muncul peringatan, lalu kios kembali ke menu sendiri dan fotonya terhapus |
| Layar menampilkan kartu bantuan berisi langkah-langkah | Ikuti langkah di layar; biasanya cukup muat ulang halaman |

Foto anak **tidak pernah dikirim ke mana pun** — hanya ada di memori browser
dan hilang begitu kembali ke menu.

## Isi folder

```
index.html            permainan (satu berkas, tanpa dependensi build)
sw.js                 service worker: tetap jalan saat wifi putus
manifest.webmanifest  mode layar penuh untuk tablet kios
ikon.svg              ikon aplikasi
setup-aset.sh         pengunduh aset pelacak tangan + font
sync.bat              uji + cek versi + commit + kirim ke GitHub (Windows)
package.json          pintasan perintah; nol dependensi
test/harness.js       51 uji permainan, tanpa browser
test/sw-harness.js    10 uji service worker
vercel.json           header kamera + cache
.vercelignore         berkas internal yang tidak ikut terbit
DEV.md                panduan developer: peta modul & konstanta tuning
mediapipe/            aset MediaPipe, dibuat oleh setup-aset.sh (~24 MB)
font/                 Baloo 2 subset latin, dibuat oleh setup-aset.sh (~33 KB)
```

Setelah setup, permainan **tidak meminta apa pun ke jaringan luar** saat
dimainkan — tidak ke CDN, tidak ke Google Fonts.

## Menyiapkan

```bash
npm run setup                # mengisi mediapipe/ + font/, aman diulang
npm start                    # uji lokal di http://localhost:5500
npm test                     # 61 uji otomatis
```

## Mengirim perubahan ke GitHub

Klik dua kali `sync.bat`, atau dari terminal:

```bash
sync.bat                     # tanya pesan commit, lalu kirim
sync.bat "perbaiki kalibrasi"
sync.bat -cek                # hanya periksa, tidak commit & tidak kirim
```

Skripnya menjalankan uji dan memeriksa konsistensi versi **sebelum** commit.
Kalau salah satu gagal, tidak ada yang di-commit maupun dikirim — jadi tidak
mungkin mengirim kode yang ujinya merah atau yang `VERSI` di `sw.js`-nya
tertinggal.

Ia mengikuti **branch yang sedang aktif**, bukan mematok `main`. Pekerjaan
besar dikerjakan di branch supaya `main` — yang ter-deploy ke kios — selalu
berisi versi yang sudah terverifikasi di perangkat asli. Branch yang belum
ada di GitHub langsung dibuat oleh push pertama.

`npm` hanya jadi pembungkus perintah — tidak ada satu pun dependensi,
jadi `npm install` tidak pernah perlu dijalankan.

Kamera hanya bisa diakses lewat `https://` atau `http://localhost`.
Membuka `index.html` langsung sebagai berkas (`file://`) akan menampilkan
instruksi perbaikan, bukan permainan.

## Deploy ke Vercel

```bash
vercel --prod
```

Folder `mediapipe/` **harus ikut ter-commit** — jangan masuk `.gitignore`.
Kalau repo terasa berat, aktifkan Git LFS untuk `*.wasm`, `*.tflite`, `*.data`.

Akar repo ini sudah berisi `index.html` langsung, jadi **Root Directory di
Vercel tidak perlu disetel** — biarkan default.

## Setelan yang sering diubah

Semua di bagian atas blok `<script>` di `index.html`:

| Konstanta | Arti |
| --- | --- |
| `DWELL` | Lama menahan untuk menekan tombol (ms). Anak yang lebih kecil: naikkan ke 1300 |
| `CUBIT_ON` / `CUBIT_OFF` | Kepekaan cubit. Naikkan bila tangan kecil susah terdeteksi mencubit |
| `GAIN` | Perluasan jangkauan tangan ke tepi layar |
| `SNAP` | Toleransi tempel kepingan (× ukuran sel) |
| `DETIK_MUNDUR` | Lama hitung mundur sebelum foto |
| `MODEL` | `1` akurat, `0` model ringan untuk tablet lawas |

## Uji cepat tanpa kamera

Tambahkan `?mouse=1` pada URL untuk mengendalikan kursor dengan mouse
(klik = mencubit). Hanya untuk pengembangan; di produksi nonaktif.

## Catatan

- Satu-satunya berkas dari luar adalah font Baloo 2 dari Google Fonts.
  Bila jaringan memblokirnya, permainan tetap jalan dengan font sistem.
- Izin kamera dari browser tetap perlu diklik sekali di awal. Untuk mode
  kios, jalankan Chrome dengan
  `--use-fake-ui-for-media-stream` atau atur Site Settings → Camera → Allow
  untuk domainnya.
