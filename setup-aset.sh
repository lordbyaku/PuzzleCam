#!/usr/bin/env bash
# ============================================================
#  Puzzle Udara — unduh semua aset yang di-host sendiri
#  Jalankan dari folder yang berisi index.html:
#      npm run setup        (= bash setup-aset.sh)
#  Hasilnya ./mediapipe (~24 MB) dan ./font (~33 KB), keduanya
#  siap ikut di-deploy. Aman dijalankan berkali-kali.
#
#  Setelah selesai, permainan tidak meminta apa pun ke jaringan
#  luar saat dimainkan — itu syaratnya supaya tetap jalan di wifi
#  tamu hotel yang lambat atau memblokir domain tertentu.
# ============================================================
set -euo pipefail

HANDS_VER="0.4.1675469240"
CAMU_VER="0.3.1675466862"
TUJUAN="mediapipe"
FONT_DIR="font"
# Baloo 2 v23, subset latin. Google Fonts menyajikan satu berkas variable
# untuk seluruh bobot 400-800, jadi cukup satu unduhan.
FONT_URL="https://fonts.gstatic.com/s/baloo2/v23/wXKrE3kTposypRyd51jcAA.woff2"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

echo "→ Mengunduh @mediapipe/hands@${HANDS_VER}"
curl -fsSL -o "$TMP/hands.tgz" \
  "https://registry.npmjs.org/@mediapipe/hands/-/hands-${HANDS_VER}.tgz"

echo "→ Mengunduh @mediapipe/camera_utils@${CAMU_VER}"
curl -fsSL -o "$TMP/camu.tgz" \
  "https://registry.npmjs.org/@mediapipe/camera_utils/-/camera_utils-${CAMU_VER}.tgz"

echo "→ Mengekstrak"
mkdir -p "$TMP/hands" "$TMP/camu" "$TUJUAN"
tar xzf "$TMP/hands.tgz" -C "$TMP/hands" --strip-components=1
tar xzf "$TMP/camu.tgz"  -C "$TMP/camu"  --strip-components=1

# Hanya berkas yang benar-benar dipakai saat bermain.
BERKAS=(
  hands.js
  hands.binarypb
  hands_solution_packed_assets.data
  hands_solution_packed_assets_loader.js
  hands_solution_simd_wasm_bin.js
  hands_solution_simd_wasm_bin.wasm
  hands_solution_simd_wasm_bin.data
  hands_solution_wasm_bin.js
  hands_solution_wasm_bin.wasm
  hand_landmark_full.tflite
  hand_landmark_lite.tflite
)
# -f wajib: tarball npm memasang berkasnya mode 444, jadi cp biasa gagal
# "Permission denied" saat skrip ini dijalankan ulang dan set -e menghentikan
# semuanya di tengah jalan, menyisakan mediapipe/ yang separuh jadi.
for b in "${BERKAS[@]}"; do
  cp -f "$TMP/hands/$b" "$TUJUAN/$b"
  chmod u+w "$TUJUAN/$b"
done
cp -f "$TMP/camu/camera_utils.js" "$TUJUAN/camera_utils.js"
chmod u+w "$TUJUAN/camera_utils.js"

echo "→ Mengunduh font Baloo 2 (subset latin)"
mkdir -p "$FONT_DIR"
curl -fsSL -o "$TMP/baloo2.woff2" "$FONT_URL"
cp -f "$TMP/baloo2.woff2" "$FONT_DIR/baloo2-latin.woff2"
chmod u+w "$FONT_DIR/baloo2-latin.woff2"
cat > "$FONT_DIR/LISENSI.txt" <<'LISENSI'
Baloo 2 — SIL Open Font License 1.1
Hak cipta pemilik font-nya, bukan proyek ini.
Teks lisensi: https://openfontlicense.org
Sumber berkas: Google Fonts, subset latin, versi v23.
Berkas ini boleh ikut disebarkan bersama aplikasi selama lisensinya
ikut serta — itulah gunanya berkas ini.
LISENSI

echo "→ Memeriksa hasil"
KURANG=0
for b in "${BERKAS[@]}" camera_utils.js; do
  if [ ! -s "$TUJUAN/$b" ] && [ "$b" != "hands_solution_simd_wasm_bin.data" ]; then
    echo "   ✗ hilang atau kosong: $b"; KURANG=1
  fi
done
if [ ! -s "$FONT_DIR/baloo2-latin.woff2" ]; then
  echo "   ✗ hilang atau kosong: $FONT_DIR/baloo2-latin.woff2"; KURANG=1
fi
[ "$KURANG" -eq 0 ] || { echo "Ada berkas yang gagal disalin."; exit 1; }

echo
echo "✓ Selesai."
echo "  $(du -sh "$TUJUAN" | cut -f1) di ./$TUJUAN"
echo "  $(du -sh "$FONT_DIR" | cut -f1) di ./$FONT_DIR"
echo "  Uji lokal:  npm start  →  http://localhost:5500"
echo "  Deploy:     vercel --prod"
