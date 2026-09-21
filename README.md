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

## Isi folder

```
index.html            permainan (satu berkas, tanpa dependensi build)
setup-mediapipe.sh    pengunduh aset pelacak tangan
package.json          pintasan perintah; nol dependensi
test/harness.js       25 uji otomatis, tanpa browser
vercel.json           header kamera + cache
DEV.md                panduan developer: peta modul & konstanta tuning
mediapipe/            aset MediaPipe, dibuat oleh setup-mediapipe.sh (~24 MB)
```

## Menyiapkan

```bash
npm run setup                # mengisi folder mediapipe/, aman diulang
npm start                    # uji lokal di http://localhost:5500
npm test                     # 25 uji otomatis
```

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

Repo git berada satu tingkat di atas (`AIRTOUCH/`), jadi di Vercel set
**Root Directory** ke `PuzzleCam` supaya `vercel.json` ikut terbaca.

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
