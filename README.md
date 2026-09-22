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

## Untuk staf hotel

| Situasi | Yang harus dilakukan |
| --- | --- |
| Kios nyangkut, pelacakan tangan tidak jalan | **Ketuk 3× pojok kiri-atas layar** — permainan kembali ke menu |
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
test/harness.js       32 uji permainan, tanpa browser
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
npm test                     # 42 uji otomatis
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
