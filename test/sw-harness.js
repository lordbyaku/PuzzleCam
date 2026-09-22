/* ============================================================
   Uji otomatis sw.js — tanpa browser, tanpa dependensi.
   Jalankan dari akar PuzzleCam:  node test/sw-harness.js

   sw.js menentukan apakah kios menyala sama sekali saat jaringan
   bermasalah, jadi ia diuji terpisah dari permainannya: berkasnya
   dijalankan di `vm` Node di atas stub Cache API, fetch, dan self.
   ============================================================ */
const fs = require('fs'), vm = require('vm'), assert = require('assert'), path = require('path');

const ASAL = 'https://contoh.test';
const sumber = fs.readFileSync(path.join(__dirname, '..', 'sw.js'), 'utf8');

function respons(isi, opsi){
  opsi = opsi || {};
  return { isi: isi, status: opsi.status || 200, type: opsi.type || 'basic',
           clone: function(){ return respons(isi, opsi); } };
}
function permintaan(url, opsi){
  opsi = opsi || {};
  return { url: url.indexOf('http') === 0 ? url : ASAL + url,
           method: opsi.method || 'GET', mode: opsi.mode || 'no-cors' };
}

/* Stub Cache API yang cukup untuk perilaku yang diuji. */
function bikinLingkungan(){
  const gudang = new Map();               // nama cache -> Map(url -> respons)
  const kunci = (r) => (typeof r === 'string' ? (r.indexOf('http') === 0 ? r : ASAL + r.replace(/^\./, '')) : r.url);

  function bukaCache(nama){
    if (!gudang.has(nama)) gudang.set(nama, new Map());
    const isi = gudang.get(nama);
    return {
      match: (r) => Promise.resolve(isi.get(kunci(r))),
      put: (r, res) => { isi.set(kunci(r), res); return Promise.resolve(); },
      add: (u) => { isi.set(kunci(u), respons('awal:' + u)); return Promise.resolve(); },
      keys: () => Promise.resolve([...isi.keys()].map((u) => permintaan(u)))
    };
  }

  const caches = {
    open: (n) => Promise.resolve(bukaCache(n)),
    match: (r) => {
      for (const isi of gudang.values()){ const v = isi.get(kunci(r)); if (v) return Promise.resolve(v); }
      return Promise.resolve(undefined);
    },
    keys: () => Promise.resolve([...gudang.keys()]),
    delete: (n) => Promise.resolve(gudang.delete(n))
  };

  const pendengar = {};
  const jejakFetch = [];
  const lingkungan = {
    console, Math, JSON, Promise, URL, setTimeout, clearTimeout,
    caches,
    fetch: null,                          // diisi tiap uji
    jejakFetch,
    self: {
      addEventListener: (n, f) => { pendengar[n] = f; },
      location: { origin: ASAL },
      skipWaiting: () => Promise.resolve(),
      clients: { claim: () => Promise.resolve() }
    }
  };
  lingkungan.globalThis = lingkungan;
  vm.createContext(lingkungan);
  vm.runInContext(sumber, lingkungan, { filename: 'sw.js' });
  return { g: lingkungan, pendengar, gudang, caches };
}

/* Membungkus FetchEvent: menangkap apa pun yang dikirim ke respondWith. */
function tembakFetch(pendengar, req){
  let dijawab;
  pendengar.fetch({ request: req, respondWith: (p) => { dijawab = p; } });
  return dijawab;
}
function tembakInstall(pendengar){
  let tunggu;
  pendengar.install({ waitUntil: (p) => { tunggu = p; } });
  return tunggu;
}
function tembakActivate(pendengar){
  let tunggu;
  pendengar.activate({ waitUntil: (p) => { tunggu = p; } });
  return tunggu;
}

let lolos = 0, gagal = 0;
const antre = [];
function t(nama, fn){ antre.push({ nama, fn }); }

t('install menyimpan seluruh daftar aset', async () => {
  const { g, pendengar, gudang } = bikinLingkungan();
  g.fetch = () => Promise.resolve(respons('apa pun'));
  await tembakInstall(pendengar);
  const isi = gudang.get(g.VERSI);
  assert(isi, 'cache bernama ' + g.VERSI + ' tidak dibuat');
  assert.strictEqual(isi.size, g.ISI.length, 'jumlah berkas ter-cache ' + isi.size + ', harusnya ' + g.ISI.length);
});

t('satu aset gagal diunduh tidak menggagalkan seluruh install', async () => {
  const { g, pendengar, gudang } = bikinLingkungan();
  // Cache.add yang menolak untuk satu berkas: lebih baik cache separuh
  // terisi daripada kios tanpa cache sama sekali.
  const bukaAsli = g.caches.open;
  g.caches.open = (n) => bukaAsli(n).then((c) => {
    const addAsli = c.add;
    c.add = (u) => (/hand_landmark_full/.test(u) ? Promise.reject(new Error('404')) : addAsli(u));
    return c;
  });
  await tembakInstall(pendengar);
  const isi = gudang.get(g.VERSI);
  assert.strictEqual(isi.size, g.ISI.length - 1, 'sisanya harus tetap ter-cache');
});

t('activate membuang cache versi lama', async () => {
  const { g, pendengar, gudang, caches } = bikinLingkungan();
  await caches.open('puzzleudara-v0.9.0');
  await caches.open(g.VERSI);
  assert.strictEqual(gudang.size, 2);
  await tembakActivate(pendengar);
  assert.deepStrictEqual([...gudang.keys()], [g.VERSI], 'cache lama harus dihapus');
});

t('buka dari awal saat jaringan sehat: ambil versi terbaru, bukan cache', async () => {
  const { g, pendengar, caches } = bikinLingkungan();
  const c = await caches.open(g.VERSI);
  await c.put(permintaan('/'), respons('VERSI LAMA'));
  g.fetch = (req) => { g.jejakFetch.push(req.url); return Promise.resolve(respons('VERSI BARU')); };

  const res = await tembakFetch(pendengar, permintaan('/', { mode: 'navigate' }));
  assert.strictEqual(res.isi, 'VERSI BARU', 'harus dari jaringan, dapat ' + res.isi);
  assert.strictEqual(g.jejakFetch.length, 1, 'jaringan harus benar-benar dihubungi');

  const tersimpan = await caches.match(permintaan('/'));
  assert.strictEqual(tersimpan.isi, 'VERSI BARU', 'cache harus ikut diperbarui');
});

t('jaringan mati: pakai cache, kios tetap menyala', async () => {
  const { g, pendengar, caches } = bikinLingkungan();
  const c = await caches.open(g.VERSI);
  await c.put(permintaan('/'), respons('VERSI LAMA'));
  g.fetch = () => Promise.reject(new Error('offline'));

  const res = await tembakFetch(pendengar, permintaan('/', { mode: 'navigate' }));
  assert.strictEqual(res.isi, 'VERSI LAMA', 'harus jatuh ke cache');
});

t('wifi menggantung: jangan tunggu selamanya, pakai cache', async () => {
  const { g, pendengar, caches } = bikinLingkungan();
  g.BATAS_JARINGAN = 60;                 // dipercepat; di produksi 3000 ms
  const c = await caches.open(g.VERSI);
  await c.put(permintaan('/'), respons('VERSI LAMA'));
  // Persis mode gagal wifi tamu hotel: tersambung, tapi tidak pernah menjawab.
  g.fetch = () => new Promise(() => {});

  const mulai = Date.now();
  const res = await tembakFetch(pendengar, permintaan('/', { mode: 'navigate' }));
  const lama = Date.now() - mulai;
  assert.strictEqual(res.isi, 'VERSI LAMA', 'harus jatuh ke cache saat jaringan menggantung');
  assert(lama < 1000, 'terlalu lama menunggu: ' + lama + ' ms');
});

t('jaringan menggantung dan cache kosong: tetap tunggu jaringan', async () => {
  const { g, pendengar } = bikinLingkungan();
  g.BATAS_JARINGAN = 40;
  let bereskan;
  g.fetch = () => new Promise((r) => { bereskan = r; });

  const janji = tembakFetch(pendengar, permintaan('/', { mode: 'navigate' }));
  await new Promise((r) => setTimeout(r, 120));      // lewati batas waktunya
  bereskan(respons('AKHIRNYA DATANG'));              // jaringan telat menjawab
  const res = await janji;
  assert.strictEqual(res.isi, 'AKHIRNYA DATANG', 'tanpa cache tidak boleh menyerah');
});

t('aset biasa: cache dulu, jaringan tidak disentuh', async () => {
  const { g, pendengar, caches } = bikinLingkungan();
  const c = await caches.open(g.VERSI);
  await c.put(permintaan('/mediapipe/hands.js'), respons('hands ter-cache'));
  g.fetch = (req) => { g.jejakFetch.push(req.url); return Promise.resolve(respons('dari jaringan')); };

  const res = await tembakFetch(pendengar, permintaan('/mediapipe/hands.js'));
  assert.strictEqual(res.isi, 'hands ter-cache');
  assert.strictEqual(g.jejakFetch.length, 0, 'aset ter-cache tidak boleh menghubungi jaringan');
});

t('aset yang belum ter-cache diambil lalu disimpan', async () => {
  const { g, pendengar, caches } = bikinLingkungan();
  g.fetch = () => Promise.resolve(respons('baru diunduh'));
  const res = await tembakFetch(pendengar, permintaan('/mediapipe/hands.js'));
  assert.strictEqual(res.isi, 'baru diunduh');
  await new Promise((r) => setTimeout(r, 10));       // penyimpanan berjalan di belakang
  const tersimpan = await caches.match(permintaan('/mediapipe/hands.js'));
  assert(tersimpan, 'aset baru harus ikut disimpan');
});

t('permintaan non-GET dan lintas domain tidak disentuh', async () => {
  const { g, pendengar } = bikinLingkungan();
  g.fetch = () => Promise.resolve(respons('tidak boleh terpakai'));
  assert.strictEqual(tembakFetch(pendengar, permintaan('/', { method: 'POST', mode: 'navigate' })), undefined,
    'POST tidak boleh dicegat');
  assert.strictEqual(tembakFetch(pendengar, permintaan('https://lain.test/apa.js')), undefined,
    'permintaan lintas domain tidak boleh dicegat');
});

(async function jalankan(){
  console.log('— uji service worker —');
  for (const { nama, fn } of antre){
    try { await fn(); lolos++; }
    catch (e){ gagal++; console.log('  GAGAL ' + nama + ': ' + e.message); }
  }
  console.log('\nhasil sw: ' + lolos + ' lolos, ' + gagal + ' gagal');
  process.exit(gagal ? 1 : 0);
})();
