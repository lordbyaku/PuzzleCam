/* ============================================================
   Memastikan versi sama di empat tempat sekaligus.

   Aturannya ada di CLAUDE.md, tapi aturan yang cuma tertulis pasti
   suatu saat terlewat — terutama `VERSI` di sw.js, yang tidak pernah
   terlihat saat mengedit permainannya. Dipanggil sync.bat sebelum
   commit, dan bisa dijalankan sendiri: npm run cek-versi
   ============================================================ */
const fs = require('fs'), path = require('path');
const akar = path.join(__dirname, '..');
const baca = (f) => fs.readFileSync(path.join(akar, f), 'utf8');
const cari = (isi, pola) => (isi.match(pola) || [])[1];

const versi = {
  'index.html': cari(baca('index.html'), /PUZZLE UDARA v([\d.]+)/),
  'package.json': JSON.parse(baca('package.json')).version,
  'sw.js': cari(baca('sw.js'), /puzzleudara-v([\d.]+)/),
  'changelog.md': cari(baca('changelog.md'), /##\s*\[([\d.]+)\]/)
};

const nilai = Object.keys(versi).map((k) => versi[k]);
const unik = nilai.filter((v, i) => v && nilai.indexOf(v) === i);

if (unik.length === 1 && nilai.every(Boolean)){
  console.log('OK versi konsisten di empat tempat: ' + unik[0]);
  process.exit(0);
}

console.log('Versi TIDAK konsisten:');
Object.keys(versi).forEach((k) => {
  const v = versi[k] || '(tidak ditemukan)';
  console.log('   ' + (k + '              ').slice(0, 14) + v);
});
console.log('');
console.log('Samakan keempatnya sebelum commit — lihat CLAUDE.md, bagian "Aturan kerja".');
console.log('Kalau VERSI di sw.js tertinggal, kios akan terus menyajikan aset lama');
console.log('dari cache lawas dan perubahan aset Anda tidak pernah sampai.');
process.exit(1);
