/* ============================================================
   Uji otomatis Puzzle Udara — tanpa browser, tanpa dependensi.
   Jalankan dari akar repo:  node test/harness.js
   Skrip mengambil blok <script> terakhir dari index.html lalu
   menjalankannya di atas stub canvas/DOM, dan menyuntik landmark
   tangan palsu untuk mensimulasikan pemain.
   ============================================================ */
const fs=require('fs'), vm=require('vm'), assert=require('assert'), path=require('path');
const berkas=path.join(__dirname,'..','index.html');
const html=fs.readFileSync(berkas,'utf8');
const cocok=html.match(/<script>([\s\S]*?)<\/script>/g);
if(!cocok) throw new Error('blok <script> tidak ditemukan di index.html');
const js=cocok[cocok.length-1].replace(/^<script>/,'').replace(/<\/script>$/,'');

/* Perkiraan lebar huruf Baloo 2: ~0.52 em per karakter. Kasar, tapi cukup
   untuk menangkap label yang meluber keluar tombolnya di layar sempit. */
function lebarTeks(t,font){
  const m=/(\d+(?:\.\d+)?)px/.exec(font||'');
  return String(t).length*(m?parseFloat(m[1]):16)*0.52;
}
let jejakTeks=[];
function ctxStub(){
  const noop=()=>{};
  const c={font:'',textAlign:'center'};
  ['beginPath','moveTo','lineTo','arcTo','arc','closePath','fill','stroke','clip','save','restore',
   'fillRect','strokeRect','clearRect','translate','scale','rotate','setTransform','setLineDash',
   'drawImage','strokeText','rect'].forEach(k=>c[k]=noop);
  c.createRadialGradient=()=>({addColorStop:noop});
  c.createLinearGradient=()=>({addColorStop:noop});
  c.measureText=t=>({width:lebarTeks(t,c.font)});
  c.fillText=(t,x,y)=>{
    const w=lebarTeks(t,c.font);
    jejakTeks.push({t:String(t),x:x,y:y,w:w,rata:c.textAlign});
  };
  return c;
}
function el(){
  return {style:{},hidden:false,textContent:'',innerHTML:'',addEventListener(){},
          getContext:()=>ctxStub(),width:0,height:0,videoWidth:640,videoHeight:480,readyState:4};
}
let rafQueue=[];
// Dihitung, bukan dilakukan: loop() boleh memuat ulang halaman sekali kalau
// galatnya beruntun, dan itu yang perlu diuji.
let muatUlangN=0;
const sesi={};
const sandbox={
  console, Math, JSON, Date, Infinity, NaN, isNaN, parseInt, parseFloat, Promise,
  setTimeout:(f,t)=>0, clearTimeout(){},
  performance:{now:()=>Date.now()},
  requestAnimationFrame:f=>{rafQueue.push(f);return 1;},
  location:{protocol:'https:',search:'',reload(){muatUlangN++;}},
  navigator:{mediaDevices:{getUserMedia(){}}},
  document:{hidden:false,getElementById:()=>el(),createElement:()=>el(),
            addEventListener(){},fonts:{ready:Promise.resolve()}},
};
sandbox.window={innerWidth:1280,innerHeight:800,devicePixelRatio:2,addEventListener(){}};
sandbox.window.sessionStorage={
  getItem:k=>(Object.prototype.hasOwnProperty.call(sesi,k)?sesi[k]:null),
  setItem:(k,v)=>{sesi[k]=String(v);},
  removeItem:k=>{delete sesi[k];}
};
Object.assign(sandbox,{addEventListener(){}});
sandbox.window.AudioContext=undefined;
sandbox.globalThis=sandbox;
vm.createContext(sandbox);
vm.runInContext(js,sandbox,{filename:'game.js'});

const g=sandbox;
/* Pemain ke-i. Mode solo hanya punya satu, jadi P() tanpa argumen menunjuk
   satu-satunya pemain — itulah yang dipakai seluruh uji lama. */
function P(i){ return g.pemain[i||0]; }
// fx,fy = posisi layar 0..1 -> dibalik melewati GAIN supaya kursor mendarat tepat
function hand(fx,fy,pinch){
  const ix=Math.min(1,Math.max(0,(fx-0.5)/1.30+0.5));
  const iy=Math.min(1,Math.max(0,(fy-0.5)/1.30+0.5));
  const lm=[];
  for(let i=0;i<21;i++) lm.push({x:0.5,y:0.5,z:0});
  lm[0]={x:0.5,y:0.7};          // pergelangan
  lm[9]={x:0.5,y:0.45};         // jari tengah MCP -> skala telapak 0.25
  lm[8]={x:1-ix,y:iy};          // telunjuk (dicerminkan)
  lm[4]=pinch?{x:1-ix+0.005,y:iy+0.005}:{x:1-ix+0.25,y:iy+0.2};
  return {multiHandLandmarks:[lm]};
}
function frames(n,dt){ for(let i=0;i<n;i++){ g.perbarui(dt||16); g.gambar(); } }
function hover(btnId,ms){
  const b=g.tombol.find(x=>x.id===btnId);
  assert(b,'tombol tidak ada: '+btnId);
  const cx=(b.x+b.w/2)/g.W, cy=(b.y+b.h/2)/g.H;
  for(let i=0;i<40 && P().hoverT<g.DWELL;i++){ g.onResults(hand(cx,cy,false)); frames(1,60); }
  // pastikan kursor sudah menempel
  for(let i=0;i<30;i++){ g.onResults(hand(cx,cy,false)); frames(1,60); if(g.layar!=='main'&&P().hoverId===null&&P().hoverT===0) break; }
}

let lolos=0, gagal=0;
function t(nama,fn){ try{ fn(); lolos++; } catch(e){ gagal++; console.log('  GAGAL '+nama+': '+e.message); } }

const ukuran=[[1280,800],[1920,1080],[430,932],[390,844],[820,1180],[360,640],[1024,600],[2560,1440]];

console.log('— uji tata letak di berbagai ukuran layar —');
ukuran.forEach(([w,h])=>{
  t(w+'x'+h,()=>{
    g.window.innerWidth=w; g.window.innerHeight=h; g.ukur();
    ['mudah','sedang','sulit'].forEach(lv=>{
      g.tingkat=lv; g.GRID=g.TINGKAT[lv].grid; g.hitungBelahan();
      assert(P().papan.s>0 && isFinite(P().papan.cell),'papan tidak valid');
      P().zonaSebar.forEach(z=>assert(z.w>0&&z.h>0&&isFinite(z.x)&&isFinite(z.y),'zona sebar tidak valid'));
      // semua tombol harus di dalam layar
      ['kalibrasi','menu','main','menang'].forEach(l=>{
        g.layar=l; g.susunTombol();
        g.tombol.forEach(b=>{
          assert(b.x>=0 && b.x+b.w<=g.W+0.5, l+'/'+b.id+' keluar layar horizontal');
          assert(b.y>=0 && b.y+b.h<=g.H+0.5, l+'/'+b.id+' keluar layar vertikal');
        });
      });
    });
    g.layar='menu'; g.susunTombol();
  });
});

console.log('— uji alur lengkap: menu → tingkat → foto → susun → menang —');
t('alur penuh',()=>{
  g.window.innerWidth=1280; g.window.innerHeight=800; g.ukur();
  g.keMenu();
  hover('lv-mudah');
  assert(g.layar==='mundur','harus masuk hitung mundur, dapat '+g.layar);
  for(let i=0;i<300 && g.layar==='mundur';i++) frames(1,32);
  assert(g.layar==='main','harus masuk permainan, dapat '+g.layar);
  assert(P().keping.length===4,'harus 4 kepingan');

  // susun semua kepingan dengan cubit
  for(let n=0;n<4;n++){
    const p=P().keping.find(q=>!q.pas);
    const px=(p.x+P().papan.cell/2)/g.W, py=(p.y+P().papan.cell/2)/g.H;
    g.onResults(hand(px,py,false));
    for(let i=0;i<20;i++){ g.onResults(hand(px,py,false)); frames(1,16); }
    g.onResults(hand(px,py,true));              // cubit
    // kepingan bisa saling menumpuk; ambil yang benar-benar tergenggam
    const q=P().digenggam;
    assert(q,'tidak ada kepingan yang terambil pada langkah '+n);
    const tx=(q.col*P().papan.cell+P().papan.x+P().papan.cell/2)/g.W;
    const ty=(q.row*P().papan.cell+P().papan.y+P().papan.cell/2)/g.H;
    for(let i=0;i<40;i++){ g.onResults(hand(tx,ty,true)); frames(1,16); }
    g.onResults(hand(tx,ty,false));             // buka tangan
    assert(q.pas,'kepingan '+n+' tidak menempel');
  }
  assert(g.layar==='menang','harus menang, dapat '+g.layar);
  frames(120,16);
});

console.log('— uji kasus tepi —');
t('tangan hilang saat menggenggam',()=>{
  g.keMenu(); hover('lv-sedang');
  for(let i=0;i<300 && g.layar==='mundur';i++) frames(1,32);
  const p=P().keping[0];
  const px=(p.x+P().papan.cell/2)/g.W, py=(p.y+P().papan.cell/2)/g.H;
  for(let i=0;i<20;i++){ g.onResults(hand(px,py,false)); frames(1,16); }
  g.onResults(hand(px,py,true));
  assert(P().digenggam,'belum menggenggam');
  g.onResults({multiHandLandmarks:[]});         // tangan keluar frame
  assert(!P().digenggam,'kepingan harus dilepas saat tangan hilang');
  assert(!P().cubit,'status cubit harus mati');
  frames(10,16);
});
t('resize saat bermain tidak mengacak & kepingan tetap di area',()=>{
  const sebelum=P().keping.map(p=>({pas:p.pas}));
  g.window.innerWidth=430; g.window.innerHeight=932; g.ukur();
  P().keping.forEach((p,i)=>{
    assert(p.pas===sebelum[i].pas,'status kepingan berubah saat resize');
    assert(p.x>=-1 && p.x+P().papan.cell<=g.W+1,'kepingan keluar layar setelah resize');
    assert(p.y>=-1 && p.y+P().papan.cell<=g.H+1,'kepingan keluar layar setelah resize');
  });
  frames(5,16);
});
t('kamera belum siap saat hitung mundur',()=>{
  g.window.innerWidth=1280; g.window.innerHeight=800; g.ukur();
  const asli=g.video.videoWidth;
  g.video.videoWidth=0;
  g.mulaiMundur();
  frames(400,32);
  assert(g.layar==='mundur','harus tetap menunggu kamera');
  assert(g.mundurSisa===0,'hitungan tidak boleh minus');
  g.gambar();
  g.video.videoWidth=asli;
  frames(3,32);
  assert(g.layar==='main','harus lanjut begitu kamera siap');
});
t('tombol acak ulang saat bermain',()=>{
  P().keping[0].pas=true;
  g.acakKeping(P());
  assert(P().keping.every(p=>!p.pas),'acak harus mengosongkan papan');
  assert(P().digenggam===null,'genggaman harus dilepas');
});
t('kepingan yang dilepas tidak menutupi tombol',()=>{
  const p=P().keping[0];
  p.x=g.W-10; p.y=g.H-10; P().digenggam=p; g.lepas(P());
  const bawahTombol=Math.min.apply(null,g.tombol.map(b=>b.y));
  assert(p.y+P().papan.cell<=bawahTombol+1,'kepingan menimpa baris tombol');
});
t('dwell tidak aktif saat sedang mencubit',()=>{
  const b=g.tombol[0];
  const cx=(b.x+b.w/2)/g.W, cy=(b.y+b.h/2)/g.H;
  g.onResults(hand(cx,cy,true));
  frames(80,32);
  assert(P().hoverT===0,'dwell harus mati saat mencubit');
});
t('layar ekstrem 320x360',()=>{
  g.window.innerWidth=320; g.window.innerHeight=360; g.ukur();
  ['menu','main','menang','mundur'].forEach(l=>{ g.layar=l; g.susunTombol(); g.gambar(); });
});
t('1000 frame tanpa tangan',()=>{
  g.keMenu();
  g.onResults({multiHandLandmarks:[]});
  frames(1000,16);
});

console.log('— uji fitur UI baru —');
t('toggle suara mengganti label tombol',()=>{
  g.window.innerWidth=1280; g.window.innerHeight=800; g.ukur();
  g.keMenu();
  const a=g.tombol.find(b=>b.id==='suara'); assert(a,'tombol suara tidak ada');
  const labelAwal=a.label;
  g.gantiSuara();
  const b=g.tombol.find(x=>x.id==='suara');
  assert(b && b.label!==labelAwal,'label suara tidak berubah');
  assert(g.suaraAktif===false,'status suara tidak berubah');
  g.gantiSuara();
  assert(g.suaraAktif===true,'suara tidak kembali aktif');
});
t('petunjuk muncul setelah diam lama, lalu hilang',()=>{
  g.keMenu(); hover('lv-sedang');
  for(let i=0;i<300 && g.layar==='mundur';i++) frames(1,32);
  assert(g.layar==='main');
  g.onResults({multiHandLandmarks:[]});
  frames(Math.ceil(g.JEDA_PETUNJUK/32)+6,32);
  assert(P().petunjuk,'petunjuk tidak muncul setelah '+g.JEDA_PETUNJUK+'ms');
  assert(P().petunjuk.p && !P().petunjuk.p.pas,'petunjuk menunjuk kepingan yang sudah pas');
  frames(200,32);
  assert(!P().petunjuk,'petunjuk tidak hilang');
});
t('animasi tempel & kilau selesai tanpa galat',()=>{
  const p=P().keping.find(q=>!q.pas);
  const px=(p.x+P().papan.cell/2)/g.W, py=(p.y+P().papan.cell/2)/g.H;
  for(let i=0;i<20;i++){ g.onResults(hand(px,py,false)); frames(1,16); }
  g.onResults(hand(px,py,true));
  const q=P().digenggam; assert(q,'tidak ada kepingan yang terambil');
  const tx=(P().papan.x+q.col*P().papan.cell+P().papan.cell/2)/g.W;
  const ty=(P().papan.y+q.row*P().papan.cell+P().papan.cell/2)/g.H;
  for(let i=0;i<40;i++){ g.onResults(hand(tx,ty,true)); frames(1,16); }
  g.onResults(hand(tx,ty,false));
  assert(q.pas,'kepingan tidak menempel');
  assert(q.anim,'animasi tempel tidak dibuat');
  frames(60,16);
  assert(!q.anim,'animasi tidak selesai');
  assert(q.denyut===0,'denyut tidak reda');
});
t('layar kalibrasi selesai otomatis',()=>{
  g.layar='kalibrasi'; g.susunTombol();
  g.kalib={lihat:0,cubitOk:false,selesai:0};
  for(let i=0;i<20;i++){ g.onResults(hand(0.5,0.5,false)); frames(1,60); }
  g.onResults(hand(0.5,0.5,true)); g.onResults(hand(0.5,0.5,false));
  for(let i=0;i<60 && g.layar==='kalibrasi';i++){ g.onResults(hand(0.5,0.5,false)); frames(1,60); }
  assert(g.layar==='menu','kalibrasi tidak lanjut ke menu, dapat '+g.layar);
});

console.log('— uji tabrakan tata letak dengan pratinjau kamera —');
// Pratinjau kamera digambar paling akhir, jadi apa pun yang beririsan
// dengannya akan tertutup. Lebar HP adalah kasus yang paling sempit.
const sempit=[[320,360],[320,568],[360,640],[375,812],[390,844],[414,896],[430,932],[768,1024],[1280,800]];

t('bilah kemajuan tidak tertimpa pratinjau kamera',()=>{
  sempit.forEach(([w,h])=>{
    g.window.innerWidth=w; g.window.innerHeight=h; g.ukur();
    const kam=g.kotakKamera(), bil=g.bilahKotak(P());
    const beririsan = bil.x+bil.w > kam.x && bil.y < kam.y+kam.h && bil.y+bil.h > kam.y;
    assert(!beririsan, w+'x'+h+': bilah berakhir di '+(bil.x+bil.w).toFixed(0)+
                      ' sedangkan kamera mulai di '+kam.x.toFixed(0));
    assert(bil.w>=72, w+'x'+h+': bilah terlalu pendek untuk terbaca');
  });
});

t('judul menu punya ruang di bawah pratinjau kamera',()=>{
  sempit.forEach(([w,h])=>{
    g.window.innerWidth=w; g.window.innerHeight=h; g.ukur();
    g.layar='menu'; g.susunTombol();
    const kam=g.kotakKamera();
    const judul=Math.min(64,g.W*0.115);
    const celah=g.rakMenu.y-(kam.y+kam.h);
    assert(celah>=judul*0.62+40, w+'x'+h+': celah judul hanya '+celah.toFixed(0)+
                                 'px, butuh '+(judul*0.62+40).toFixed(0)+'px');
  });
});

t('kepingan hasil sebar tetap di dalam area main',()=>{
  sempit.forEach(([w,h])=>{
    g.window.innerWidth=w; g.window.innerHeight=h; g.ukur();
    ['mudah','sedang','sulit'].forEach(lv=>{
      g.GRID=g.TINGKAT[lv].grid; g.hitungBelahan(); g.buatKeping(P());
      const c=P().papan.cell, a=P().areaMain;
      P().keping.forEach((p,i)=>{
        assert(p.x>=a.x-0.5 && p.x+c<=a.x+a.w+0.5,
               w+'x'+h+'/'+lv+': kepingan '+i+' keluar area main horizontal');
        assert(p.y>=a.y-0.5 && p.y+c<=a.y+a.h+0.5,
               w+'x'+h+'/'+lv+': kepingan '+i+' keluar area main vertikal');
      });
    });
  });
  g.keMenu();
});

t('label tombol tidak meluber keluar pilnya',()=>{
  sempit.forEach(([w,h])=>{
    g.window.innerWidth=w; g.window.innerHeight=h; g.ukur();
    ['menu','main','menang','kalibrasi'].forEach(l=>{
      g.layar=l; g.susunTombol();
      g.tombol.forEach(b=>{
        jejakTeks.length=0;
        g.gambarTombol(b);
        jejakTeks.forEach(j=>{
          const kiri = j.rata==='left' ? j.x : j.x-j.w/2;
          assert(kiri>=b.x-1 && kiri+j.w<=b.x+b.w+1,
                 w+'x'+h+' '+l+'/'+b.id+': "'+j.t+'" selebar '+j.w.toFixed(0)+
                 'px tidak muat di pil '+b.w.toFixed(0)+'px');
        });
      });
    });
  });
  jejakTeks.length=0;
  g.keMenu();
});

console.log('— uji perilaku kios —');
// Semua uji di bawah berangkat dari layar main yang sudah berisi foto.
function keLayarMain(){
  g.window.innerWidth=1280; g.window.innerHeight=800; g.ukur();
  g.keMenu(); hover('lv-mudah');
  for(let i=0;i<300 && g.layar==='mundur';i++) frames(1,32);
  assert(g.layar==='main','gagal masuk layar main, dapat '+g.layar);
}

t('ditinggal pergi: pulang ke menu dan foto dihapus',()=>{
  keLayarMain();
  assert(g.foto,'harus ada foto sebelum ditinggal');
  g.onResults({multiHandLandmarks:[]});             // orangnya pergi
  frames(Math.ceil((g.IDLE_SIAGA+g.IDLE_PULANG)/50)+4,50);
  assert(g.layar==='menu','harus pulang ke menu, dapat '+g.layar);
  assert(g.foto===null,'foto anak tidak boleh tertinggal di layar lobi');
});

t('peringatan idle muncul, lalu batal saat orang kembali',()=>{
  keLayarMain();
  g.onResults({multiHandLandmarks:[]});
  frames(Math.ceil(g.IDLE_SIAGA/50)+2,50);
  assert(g.diam>=g.IDLE_SIAGA,'peringatan belum aktif, diam='+g.diam);
  assert(g.layar==='main','belum waktunya pulang');
  g.gambar();                                        // kartu peringatan tergambar
  g.onResults(hand(0.5,0.5,false));                  // orangnya kembali
  frames(1,16);
  assert(g.diam===0,'hitungan idle harus direset saat orang kembali');
  frames(Math.ceil(g.IDLE_PULANG/50)+4,50);
  assert(g.layar==='main','tidak boleh pulang setelah orangnya kembali');
});

t('aliran frame kamera mati dianggap tidak ada orang',()=>{
  keLayarMain();
  g.onResults(hand(0.5,0.5,false));                  // tangan terlihat…
  assert(P().hadir===true,'tangan harusnya terdeteksi');
  // …lalu pipeline kamera berhenti total: tidak ada onResults lagi sama sekali.
  // Tanpa penjaga sejakFrame, tanganAda beku di true dan kios tidak pernah pulang.
  // Anggarannya termasuk FRAME_MATI: hitungan idle baru mulai setelah itu.
  frames(Math.ceil((g.FRAME_MATI+g.IDLE_SIAGA+g.IDLE_PULANG)/50)+6,50);
  assert(g.layar==='menu','frame mati harus tetap memicu pulang, dapat '+g.layar);
});

t('kamera beku tidak boleh menekan tombol sendiri',()=>{
  keLayarMain();
  // "Ganti tingkat" dipilih supaya tombol yang tertekan sendiri langsung
  // terlihat sebagai perpindahan layar, bukan efek samping yang senyap.
  const b=g.tombol.find(x=>x.id==='menu');
  assert(b,'tombol Ganti tingkat tidak ada di layar main');
  const cx=(b.x+b.w/2)/g.W, cy=(b.y+b.h/2)/g.H;
  g.onResults(hand(cx,cy,false));               // kursor mendarat di atas tombol
  for(let i=0;i<10;i++){ g.onResults(hand(cx,cy,false)); frames(1,16); }
  // Aliran frame berhenti di sini. tanganAda tetap true, kursor tetap di
  // tombol — tanpa penjaga kesegaran, dwell akan menekannya sendiri.
  frames(Math.ceil((g.FRAME_MATI+g.DWELL)/16)+20,16);
  assert(g.layar==='main','tombol tertekan sendiri oleh kamera beku, layar jadi '+g.layar);
  assert(P().hoverT===0,'dwell harus berhenti saat aliran frame mati, hoverT='+P().hoverT);
});

t('ketuk 3x pojok kiri-atas memaksa pulang ke menu',()=>{
  keLayarMain();
  g.ketukN=0;
  assert(g.ketukPojok(20,20)===false,'satu ketukan belum boleh memicu');
  assert(g.ketukPojok(30,30)===false,'dua ketukan belum boleh memicu');
  assert(g.ketukPojok(25,25)===true,'ketukan ketiga harus memicu');
  assert(g.layar==='menu','harus di menu, dapat '+g.layar);
});

t('ketuk di luar pojok tidak mengubah apa pun',()=>{
  keLayarMain();
  g.ketukN=0;
  for(let i=0;i<6;i++) g.ketukPojok(g.W/2,g.H/2);
  assert(g.layar==='main','ketukan di tengah layar tidak boleh memulangkan');
  // Ketukan jauh juga harus memutus hitungan, bukan menumpuk
  g.ketukPojok(20,20); g.ketukPojok(g.W-10,10); g.ketukPojok(20,20); g.ketukPojok(20,20);
  assert(g.layar==='main','hitungan ketukan harus putus oleh ketukan di luar pojok');
});

t('loop memuat ulang sekali, lalu menyerah dengan kartu bantuan',()=>{
  const tombolAsli=g.tombol, konsolAsli=g.console;
  muatUlangN=0; delete sesi['puzzleudara.pulih'];
  g.bootHelp.hidden=true;
  g.galatBeruntun=0;
  g.tombol=null;                                     // paksa gambar() melempar
  g.console={error(){}};                             // galatnya memang disengaja
  try {
    for(let i=0;i<g.BATAS_GALAT+10;i++) g.loop(i*16);
    assert(muatUlangN===1,'harus memuat ulang tepat sekali, dapat '+muatUlangN);
    assert(g.bootHelp.hidden===true,'jangan menyerah pada percobaan pertama');

    g.galatBeruntun=0;                               // rusak lagi setelah muat ulang
    for(let i=0;i<g.BATAS_GALAT+10;i++) g.loop(5000+i*16);
    assert(muatUlangN===1,'tidak boleh memuat ulang berulang kali');
    assert(g.bootHelp.hidden===false,'kartu bantuan untuk staf tidak muncul');
  } finally {
    g.console=konsolAsli;
    g.tombol=tombolAsli; g.galatBeruntun=0; g.bootHelp.hidden=true;
    delete sesi['puzzleudara.pulih'];
    g.keMenu();
  }
});

console.log('— uji mode versus: isolasi antar belahan —');

/* Satu tangan di belahan kamera `sisi`, menunjuk ke (fx,fy) yang diukur
   relatif terhadap BELAHAN pemain itu, bukan terhadap layar penuh. */
function lmSisi(sisi,fx,fy,pinch){
  const u=Math.min(1,Math.max(0,(fx-0.5)/1.30+0.5));
  const iy=Math.min(1,Math.max(0,(fy-0.5)/1.30+0.5));
  const xJari=u/2+sisi*0.5;
  const xPgl=sisi*0.5+0.25;              // pergelangan di tengah belahannya
  const lm=[];
  for(let i=0;i<21;i++) lm.push({x:0.5,y:0.5,z:0});
  lm[0]={x:1-xPgl,y:0.7};
  lm[9]={x:1-xPgl,y:0.45};               // skala telapak 0.25
  lm[8]={x:1-xJari,y:iy};
  lm[4]=pinch?{x:1-xJari+0.005,y:iy+0.005}:{x:1-xJari+0.25,y:iy+0.2};
  return lm;
}
function duaTangan(a,b){
  const d=[]; if(a) d.push(a); if(b) d.push(b);
  return {multiHandLandmarks:d};
}
function versusMain(w,h){
  g.window.innerWidth=w||1280; g.window.innerHeight=h||800; g.ukur();
  g.mode='solo'; g.gantiMode('versus');
  g.keMenu();
  g.tingkat='mudah'; g.GRID=2;
  // Layar dulu, baru tata letak: belahan hanya berlaku di layar bermain, dan
  // urutan terbalik menghasilkan keadaan yang tidak pernah terjadi sungguhan.
  g.layar='main';
  g.hitungBelahan();
  g.foto=g.document.createElement('canvas');
  for(let i=0;i<g.pemain.length;i++) g.buatKeping(g.pemain[i]);
  g.susunTombol();
  assert(g.pemain.length===2,'mode versus harus punya dua pemain');
  return g.pemain;
}
function tuju(pm,x,y){   // titik layar -> pecahan di dalam belahan pemain
  return [(x-pm.kotak.x)/pm.kotak.w, (y-pm.kotak.y)/pm.kotak.h];
}

t('tangan di belahan kiri tidak menggerakkan pemain kanan',()=>{
  versusMain();
  const kanan=P(1), x0=kanan.cursor.x, y0=kanan.cursor.y;
  for(let i=0;i<25;i++){ g.onResults(duaTangan(lmSisi(0,0.2,0.3,false),null)); frames(1,16); }
  assert(Math.abs(kanan.cursor.x-x0)<0.01 && Math.abs(kanan.cursor.y-y0)<0.01,
    'kursor pemain kanan bergeser padahal tangannya tidak ada');
  assert(!kanan.hadir,'pemain kanan dianggap hadir padahal tangannya di belahan kiri');
  assert(P(0).hadir && P(0).cursor.x < g.W/2,'pemain kiri tidak menerima tangannya');
});

t('kursor tiap pemain tidak pernah melewati garis tengah',()=>{
  versusMain();
  // keduanya mendorong sekuat tenaga ke arah garis tengah
  for(let i=0;i<40;i++){
    g.onResults(duaTangan(lmSisi(0,1.6,0.5,false), lmSisi(1,-0.6,0.5,false)));
    frames(1,16);
  }
  assert(P(0).cursor.x<=g.W/2+0.5,'kursor kiri melewati garis tengah: '+P(0).cursor.x.toFixed(1));
  assert(P(1).cursor.x>=g.W/2-0.5,'kursor kanan melewati garis tengah: '+P(1).cursor.x.toFixed(1));
});

t('cubit di garis tengah tidak mengambil kepingan lawan',()=>{
  const [kiri,kanan]=versusMain();
  const c=kiri.papan.cell, y=kiri.areaMain.y+40;
  // dua kepingan milik pemain berbeda, berdempetan tepat di garis tengah
  kiri.keping[0].x=g.W/2-c-2;  kiri.keping[0].y=y;
  kanan.keping[0].x=g.W/2+2;   kanan.keping[0].y=y;
  const [fx,fy]=tuju(kiri, kiri.keping[0].x+c/2, y+c/2);
  for(let i=0;i<25;i++){ g.onResults(duaTangan(lmSisi(0,fx,fy,false),null)); frames(1,16); }
  g.onResults(duaTangan(lmSisi(0,fx,fy,true),null));
  assert(kiri.digenggam,'pemain kiri tidak berhasil mengambil kepingannya sendiri');
  assert(kanan.keping.indexOf(kiri.digenggam)<0,'yang terambil justru kepingan lawan');
  assert(kanan.digenggam===null,'pemain kanan ikut menggenggam');
});

t('kepingan lawan tidak terambil walau tepat di bawah kursor',()=>{
  const [kiri,kanan]=versusMain();
  const c=kiri.papan.cell;
  // Uji yang sesungguhnya atas jaminan kepemilikan: kepingan KANAN ditaruh
  // persis di bawah kursor pemain kiri, sementara kepingan kiri disingkirkan
  // jauh. Kalau ambil() tidak terkurung ke pm.keping, pemain kiri akan
  // menggenggam kepingan lawannya di sini.
  const tx=kiri.kotak.x+kiri.kotak.w*0.5, ty=kiri.areaMain.y+60;
  kiri.keping.forEach(k=>{
    k.x=kiri.kotak.x+4;
    k.y=kiri.areaMain.y+kiri.areaMain.h-c-4;
  });
  kanan.keping[0].x=tx-c/2; kanan.keping[0].y=ty-c/2;

  const [fx,fy]=tuju(kiri,tx,ty);
  for(let i=0;i<25;i++){ g.onResults(duaTangan(lmSisi(0,fx,fy,false),null)); frames(1,16); }
  g.onResults(duaTangan(lmSisi(0,fx,fy,true),null));
  assert(kiri.digenggam===null,
    'pemain kiri menggenggam kepingan yang ada di bawah kursornya padahal milik lawan');
  assert(kanan.digenggam===null,'kepingan kanan ikut tergenggam');
});

t('dua tangan di belahan yang sama hanya menggerakkan satu pemain',()=>{
  versusMain();
  const kanan=P(1), x0=kanan.cursor.x;
  // satu anak memakai dua tangan sekaligus, keduanya di belahan kiri
  for(let i=0;i<25;i++){
    g.onResults(duaTangan(lmSisi(0,0.2,0.3,false), lmSisi(0,0.8,0.7,false)));
    frames(1,16);
  }
  assert(P(0).hadir,'pemain kiri harus menerima salah satu tangan');
  assert(!kanan.hadir,'satu anak berhasil menguasai dua papan');
  assert(Math.abs(kanan.cursor.x-x0)<0.01,'kursor kanan ikut bergerak');
});

t('tombol Acak lagi bertuan dan hanya mengurus pemiliknya',()=>{
  const [kiri,kanan]=versusMain();
  const b=g.tombol.find(x=>x.id==='acak-0');
  assert(b,'tombol acak-0 tidak ada di layar main versus');
  assert(b.tuan===kiri,'tombol acak-0 harus bertuan pemain kiri');
  assert(!g.tombol.some(x=>x.id==='menu'||x.id==='foto'),
    'selama bertanding tidak boleh ada tombol keluar');

  // kursor pemain kanan dipaksa menahan tombol milik kiri
  kanan.hadir=true; kanan.cursor.ada=true;
  kanan.cursor.x=kanan.target.x=b.x+b.w/2;
  kanan.cursor.y=kanan.target.y=b.y+b.h/2;
  for(let i=0;i<Math.ceil(g.DWELL/16)+25;i++){ kanan.segar=0; frames(1,16); }
  assert(kanan.hoverId===null,'kursor lawan bisa menahan tombol bertuan');

  // aksinya pun hanya menyentuh kepingan pemiliknya
  kanan.keping[0].pas=true;
  b.aksi();
  assert(kanan.keping[0].pas===true,'Acak lagi milik kiri ikut mengacak kepingan kanan');
  assert(kiri.keping.every(k=>!k.pas),'Acak lagi tidak mengacak kepingan pemiliknya');
});

t('tangan yang menyeberang saat menggenggam tidak berpindah pemain',()=>{
  const [kiri,kanan]=versusMain();
  const kp=kiri.keping[0], c=kiri.papan.cell;
  const [fx,fy]=tuju(kiri, kp.x+c/2, kp.y+c/2);
  for(let i=0;i<25;i++){ g.onResults(duaTangan(lmSisi(0,fx,fy,false),null)); frames(1,16); }
  g.onResults(duaTangan(lmSisi(0,fx,fy,true),null));
  assert(kiri.digenggam,'belum menggenggam sebelum menyeberang');

  // pergelangan menyeberang sedikit melewati garis tengah, masih di dalam
  // SISI_MARGIN — kendali harus bertahan di pemain kiri
  const lm=lmSisi(0,0.95,fy,true);
  const xPgl=0.5+g.SISI_MARGIN*0.5;
  lm[0]={x:1-xPgl,y:0.7}; lm[9]={x:1-xPgl,y:0.45};
  for(let i=0;i<12;i++){ g.onResults(duaTangan(lm,null)); frames(1,16); }
  assert(kiri.digenggam,'genggaman lepas saat pergelangan menyeberang sedikit');
  assert(!kanan.hadir,'tangan yang sedang menggenggam berpindah ke lawan');
});

console.log('— uji mode versus: permainan & tata letak —');

t('yang lebih dulu selesai jadi pemenang, penyusul tidak menimpa',()=>{
  const [kiri,kanan]=versusMain();
  kanan.keping.forEach(k=>{ k.pas=true; });
  g.cekMenang(kanan);
  assert(g.layar==='menang','harus pindah ke layar menang');
  assert(g.pemenang===kanan,'pemenangnya salah');
  kiri.keping.forEach(k=>{ k.pas=true; });
  g.cekMenang(kiri);
  assert(g.pemenang===kanan,'pemenang tertimpa oleh yang menyusul');
  g.gambar();
});

t('tata letak versus muat dan kedua papan tidak saling tindih',()=>{
  [[1280,800],[1920,1080],[1024,600]].forEach(([w,h])=>{
    const [kiri,kanan]=versusMain(w,h);
    ['main','menang'].forEach(l=>{
      g.layar=l; g.susunTombol();
      g.tombol.forEach(b=>{
        assert(b.x>=0 && b.x+b.w<=g.W+0.5, w+'x'+h+' '+l+'/'+b.id+' keluar layar horizontal');
        assert(b.y>=0 && b.y+b.h<=g.H+0.5, w+'x'+h+' '+l+'/'+b.id+' keluar layar vertikal');
      });
    });
    assert(kiri.papan.x+kiri.papan.s<=g.W/2+0.5, w+'x'+h+': papan kiri melewati garis tengah');
    assert(kanan.papan.x>=g.W/2-0.5,            w+'x'+h+': papan kanan melewati garis tengah');
    [kiri,kanan].forEach((pm,i)=>{
      assert(pm.papan.s>=160, w+'x'+h+': papan pemain '+i+' terlalu kecil');
      pm.zonaSebar.forEach(z=>{
        assert(z.x>=pm.kotak.x-0.5 && z.x+z.w<=pm.kotak.x+pm.kotak.w+0.5,
          w+'x'+h+': zona sebar pemain '+i+' keluar belahannya');
      });
      pm.keping.forEach((kp,j)=>{
        assert(kp.x>=pm.kotak.x-0.5 && kp.x+pm.papan.cell<=pm.kotak.x+pm.kotak.w+0.5,
          w+'x'+h+': kepingan '+j+' pemain '+i+' lahir di luar belahannya');
      });
    });
  });
});

t('menu versus menyembunyikan 4x4 dan tidak muncul di potret',()=>{
  g.window.innerWidth=1280; g.window.innerHeight=800; g.ukur();
  g.mode='solo'; g.gantiMode('versus'); g.keMenu();
  assert(g.tombol.some(b=>b.id==='lv-mudah') && g.tombol.some(b=>b.id==='lv-sedang'),
    '2x2 dan 3x3 harus tersedia di versus');
  assert(!g.tombol.some(b=>b.id==='lv-sulit'),'kartu Sulit tidak boleh muncul di versus');
  assert(g.tombol.some(b=>b.id==='mode-versus'),'baris mode harus ada di lanskap');

  // Potret: versus tidak ditawarkan sama sekali
  g.window.innerWidth=390; g.window.innerHeight=844; g.ukur();
  g.mode='solo'; g.keMenu();
  assert(!g.tombol.some(b=>b.id==='mode-versus'),
    'baris mode tidak boleh muncul di potret');
  assert(g.tombol.some(b=>b.id==='lv-sulit'),'di solo potret, 4x4 harus tetap ada');
});

t('di menu versus setiap tombol terjangkau kedua pemain',()=>{
  [[1920,1080],[1280,800],[1024,600]].forEach(([w,h])=>{
    g.window.innerWidth=w; g.window.innerHeight=h; g.ukur();
    g.mode='solo'; g.gantiMode('versus'); g.keMenu();
    assert(g.pemain.length===2,'harus dua pemain');
    // Menu dipakai bersama: belahan layar tidak boleh berlaku di sini, kalau
    // tidak separuh kartu tingkat mustahil disentuh salah satu pemain.
    g.pemain.forEach((pm,i)=>{
      assert(pm.kotak.x===0 && Math.abs(pm.kotak.w-g.W)<0.5,
        w+'x'+h+': pemain '+i+' masih terkunci di separuh layar saat di menu');
    });
    g.tombol.forEach(b=>{
      g.pemain.forEach((pm,i)=>{
        assert(!b.tuan,w+'x'+h+': tombol menu '+b.id+' tidak boleh bertuan');
        assert(b.x>=pm.kotak.x-0.5 && b.x+b.w<=pm.kotak.x+pm.kotak.w+0.5,
          w+'x'+h+': tombol '+b.id+' di luar jangkauan pemain '+i);
      });
    });
  });
});

t('saat bertanding pratinjau kamera di tengah dan bilah di tepi luar',()=>{
  [[1920,1080],[1280,800],[1024,600]].forEach(([w,h])=>{
    const [kiri,kanan]=versusMain(w,h);
    const kam=g.kotakKamera();
    // Di tengah, supaya kedua anak sama-sama terlihat memastikan dirinya
    assert(Math.abs((kam.x+kam.w/2)-g.W/2)<1,
      w+'x'+h+': pratinjau kamera tidak di tengah, pusatnya '+(kam.x+kam.w/2).toFixed(0));

    const bk=g.bilahKotak(kiri), bn=g.bilahKotak(kanan);
    assert(bk.rata==='left' && bn.rata==='right',
      w+'x'+h+': label kanan harus rata kanan, dapat '+bn.rata);
    assert(Math.abs((bn.x+bn.w)-(kanan.kotak.x+kanan.kotak.w-16))<1,
      w+'x'+h+': bilah kanan tidak menempel tepi kanan layar');
    assert(Math.abs(bk.x-16)<1, w+'x'+h+': bilah kiri tidak menempel tepi kiri layar');

    // Tidak satu pun bilah boleh tertimpa pratinjau di tengah
    [[bk,'kiri'],[bn,'kanan']].forEach(([b,nm])=>{
      const beririsan = b.x+b.w > kam.x && b.x < kam.x+kam.w &&
                        b.y < kam.y+kam.h && b.y+b.h > kam.y;
      assert(!beririsan, w+'x'+h+': bilah '+nm+' tertimpa pratinjau kamera');
    });
  });
});

t('pulang-otomatis tetap jalan dengan dua pemain',()=>{
  const [kiri,kanan]=versusMain();
  // salah satu masih terlihat -> jangan pulang
  for(let i=0;i<Math.ceil((g.IDLE_SIAGA+g.IDLE_PULANG)/50)+6;i++){
    g.onResults(duaTangan(lmSisi(0,0.5,0.5,false),null));
    frames(1,50);
  }
  assert(g.layar==='main','pulang padahal salah satu pemain masih terlihat');
  // keduanya pergi
  g.onResults(duaTangan(null,null));
  frames(Math.ceil((g.FRAME_MATI+g.IDLE_SIAGA+g.IDLE_PULANG)/50)+8,50);
  assert(g.layar==='menu','tidak pulang setelah kedua pemain pergi');
  assert(g.foto===null,'foto tidak dihapus saat pulang');
});

console.log('\nhasil: '+lolos+' lolos, '+gagal+' gagal');
process.exit(gagal?1:0);
