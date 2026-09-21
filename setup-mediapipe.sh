#!/usr/bin/env bash
# ============================================================
#  Puzzle Udara — unduh aset MediaPipe untuk di-host sendiri
#  Jalankan sekali dari folder yang berisi index.html:
#      bash setup-mediapipe.sh
#  Hasilnya folder ./mediapipe (~24 MB) yang siap ikut di-deploy.
# ============================================================
set -euo pipefail

HANDS_VER="0.4.1675469240"
CAMU_VER="0.3.1675466862"
TUJUAN="mediapipe"
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

echo "→ Memeriksa hasil"
KURANG=0
for b in "${BERKAS[@]}" camera_utils.js; do
  if [ ! -s "$TUJUAN/$b" ] && [ "$b" != "hands_solution_simd_wasm_bin.data" ]; then
    echo "   ✗ hilang atau kosong: $b"; KURANG=1
  fi
done
[ "$KURANG" -eq 0 ] || { echo "Ada berkas yang gagal disalin."; exit 1; }

echo
echo "✓ Selesai. Total: $(du -sh "$TUJUAN" | cut -f1) di ./$TUJUAN"
echo "  Uji lokal:  python3 -m http.server 5500  →  http://localhost:5500"
echo "  Deploy:     vercel --prod"
