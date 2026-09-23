/* ============================================================
   Service worker Puzzle Udara

   Tujuannya satu: kios di lobi hotel tetap bisa dimainkan walau wifi
   tamu putus. Tanpa ini, satu kali reload saat jaringan mati sudah
   cukup untuk menampilkan layar kosong sampai ada staf yang sadar.

   Aturan cache sengaja dibedakan, mengikuti header di vercel.json:
     - index.html  -> jaringan dulu. Deploy baru harus langsung terlihat;
                      cache hanya dipakai kalau jaringannya gagal.
     - sisanya     -> cache dulu. Aset MediaPipe dan font tidak pernah
                      berubah tanpa ganti nama berkas, jadi aman.

   Naikkan VERSI setiap rilis. Yang jadi basi kalau lupa hanya aset di
   cache (font, ikon, manifest, mediapipe) — kode permainannya tetap
   ter-update karena index.html disajikan jaringan-dulu. Lihat DEV.md
   bagian 9.

   Diuji oleh test/sw-harness.js, tanpa browser.
   ============================================================ */
var VERSI = 'puzzleudara-v1.7.0';

var ISI = [
  './',
  './index.html',
  './manifest.webmanifest',
  './ikon.svg',
  './font/baloo2-latin.woff2',
  './mediapipe/hands.js',
  './mediapipe/camera_utils.js',
  './mediapipe/hands.binarypb',
  './mediapipe/hands_solution_packed_assets.data',
  './mediapipe/hands_solution_packed_assets_loader.js',
  './mediapipe/hands_solution_simd_wasm_bin.js',
  './mediapipe/hands_solution_simd_wasm_bin.wasm',
  './mediapipe/hands_solution_simd_wasm_bin.data',
  './mediapipe/hands_solution_wasm_bin.js',
  './mediapipe/hands_solution_wasm_bin.wasm',
  './mediapipe/hand_landmark_full.tflite',
  './mediapipe/hand_landmark_lite.tflite'
];

self.addEventListener('install', function(e){
  // Satu berkas gagal diunduh tidak boleh menggagalkan seluruh instalasi —
  // lebih baik cache separuh terisi daripada tidak ada cache sama sekali.
  e.waitUntil(
    caches.open(VERSI).then(function(c){
      return Promise.all(ISI.map(function(u){
        return c.add(u)['catch'](function(){});
      }));
    }).then(function(){ return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function(e){
  e.waitUntil(
    caches.keys().then(function(nama){
      return Promise.all(nama.map(function(n){
        return n === VERSI ? null : caches['delete'](n);
      }));
    }).then(function(){ return self.clients.claim(); })
  );
});

function halamanUtama(req){
  return req.mode === 'navigate' || /\/(index\.html)?$/.test(new URL(req.url).pathname);
}

/* Jaringan dulu supaya membuka browser dari awal selalu mengambil versi
   terbaru — TAPI dengan batas waktu.

   Wifi tamu hotel punya mode gagal yang khas: tersambung, tapi tidak
   mengantar ke mana-mana (captive portal, gateway ngadat). Di situ fetch()
   tidak menolak, ia menggantung — dan tanpa batas waktu kios menampilkan
   layar kosong berpuluh detik padahal salinan yang baik ada di cache.

   Permintaan jaringannya tetap dibiarkan jalan di belakang layar. Kalau
   akhirnya datang, cache ikut diperbarui, jadi pembukaan berikutnya sudah
   memakai versi baru. */
var BATAS_JARINGAN = 3000;   // ms

function ambilHalaman(req){
  var jaringan = fetch(req).then(function(res){
    var salinan = res.clone();
    caches.open(VERSI).then(function(c){ c.put(req, salinan); })['catch'](function(){});
    return res;
  });

  var gagalJadiKosong = jaringan['catch'](function(){ return null; });
  var jeda = new Promise(function(lanjut){
    setTimeout(function(){ lanjut(null); }, BATAS_JARINGAN);
  });

  return Promise.race([gagalJadiKosong, jeda]).then(function(res){
    if (res) return res;
    return caches.match(req).then(function(c){
      if (c) return c;
      return caches.match('./index.html').then(function(c2){
        return c2 || jaringan;      // belum punya cache sama sekali: tunggu saja
      });
    });
  });
}

self.addEventListener('fetch', function(e){
  var req = e.request;
  if (req.method !== 'GET') return;
  if (new URL(req.url).origin !== self.location.origin) return;

  if (halamanUtama(req)){
    e.respondWith(ambilHalaman(req));
    return;
  }

  e.respondWith(
    caches.match(req).then(function(c){
      if (c) return c;
      return fetch(req).then(function(res){
        if (res && res.status === 200 && res.type === 'basic'){
          var salinan = res.clone();
          caches.open(VERSI).then(function(k){ k.put(req, salinan); })['catch'](function(){});
        }
        return res;
      });
    })
  );
});
