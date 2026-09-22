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
  for(let i=0;i<40 && g.hoverT<g.DWELL;i++){ g.onResults(hand(cx,cy,false)); frames(1,60); }
  // pastikan kursor sudah menempel
  for(let i=0;i<30;i++){ g.onResults(hand(cx,cy,false)); frames(1,60); if(g.layar!=='main'&&g.hoverId===null&&g.hoverT===0) break; }
}

let lolos=0, gagal=0;
function t(nama,fn){ try{ fn(); lolos++; } catch(e){ gagal++; console.log('  GAGAL '+nama+': '+e.message); } }

const ukuran=[[1280,800],[1920,1080],[430,932],[390,844],[820,1180],[360,640],[1024,600],[2560,1440]];

console.log('— uji tata letak di berbagai ukuran layar —');
ukuran.forEach(([w,h])=>{
  t(w+'x'+h,()=>{
    g.window.innerWidth=w; g.window.innerHeight=h; g.ukur();
    ['mudah','sedang','sulit'].forEach(lv=>{
      g.tingkat=lv; g.GRID=g.TINGKAT[lv].grid; g.hitungPapan();
      assert(g.papan.s>0 && isFinite(g.papan.cell),'papan tidak valid');
      g.zonaSebar.forEach(z=>assert(z.w>0&&z.h>0&&isFinite(z.x)&&isFinite(z.y),'zona sebar tidak valid'));
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
  assert(g.keping.length===4,'harus 4 kepingan');

  // susun semua kepingan dengan cubit
  for(let n=0;n<4;n++){
    const p=g.keping.find(q=>!q.pas);
    const px=(p.x+g.papan.cell/2)/g.W, py=(p.y+g.papan.cell/2)/g.H;
    g.onResults(hand(px,py,false));
    for(let i=0;i<20;i++){ g.onResults(hand(px,py,false)); frames(1,16); }
    g.onResults(hand(px,py,true));              // cubit
    // kepingan bisa saling menumpuk; ambil yang benar-benar tergenggam
    const q=g.digenggam;
    assert(q,'tidak ada kepingan yang terambil pada langkah '+n);
    const tx=(q.col*g.papan.cell+g.papan.x+g.papan.cell/2)/g.W;
    const ty=(q.row*g.papan.cell+g.papan.y+g.papan.cell/2)/g.H;
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
  const p=g.keping[0];
  const px=(p.x+g.papan.cell/2)/g.W, py=(p.y+g.papan.cell/2)/g.H;
  for(let i=0;i<20;i++){ g.onResults(hand(px,py,false)); frames(1,16); }
  g.onResults(hand(px,py,true));
  assert(g.digenggam,'belum menggenggam');
  g.onResults({multiHandLandmarks:[]});         // tangan keluar frame
  assert(!g.digenggam,'kepingan harus dilepas saat tangan hilang');
  assert(!g.cubit,'status cubit harus mati');
  frames(10,16);
});
t('resize saat bermain tidak mengacak & kepingan tetap di area',()=>{
  const sebelum=g.keping.map(p=>({pas:p.pas}));
  g.window.innerWidth=430; g.window.innerHeight=932; g.ukur();
  g.keping.forEach((p,i)=>{
    assert(p.pas===sebelum[i].pas,'status kepingan berubah saat resize');
    assert(p.x>=-1 && p.x+g.papan.cell<=g.W+1,'kepingan keluar layar setelah resize');
    assert(p.y>=-1 && p.y+g.papan.cell<=g.H+1,'kepingan keluar layar setelah resize');
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
  g.keping[0].pas=true;
  g.acakKeping();
  assert(g.keping.every(p=>!p.pas),'acak harus mengosongkan papan');
  assert(g.digenggam===null,'genggaman harus dilepas');
});
t('kepingan yang dilepas tidak menutupi tombol',()=>{
  const p=g.keping[0];
  p.x=g.W-10; p.y=g.H-10; g.digenggam=p; g.lepas();
  const bawahTombol=Math.min.apply(null,g.tombol.map(b=>b.y));
  assert(p.y+g.papan.cell<=bawahTombol+1,'kepingan menimpa baris tombol');
});
t('dwell tidak aktif saat sedang mencubit',()=>{
  const b=g.tombol[0];
  const cx=(b.x+b.w/2)/g.W, cy=(b.y+b.h/2)/g.H;
  g.onResults(hand(cx,cy,true));
  frames(80,32);
  assert(g.hoverT===0,'dwell harus mati saat mencubit');
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
  assert(g.petunjuk,'petunjuk tidak muncul setelah '+g.JEDA_PETUNJUK+'ms');
  assert(g.petunjuk.p && !g.petunjuk.p.pas,'petunjuk menunjuk kepingan yang sudah pas');
  frames(200,32);
  assert(!g.petunjuk,'petunjuk tidak hilang');
});
t('animasi tempel & kilau selesai tanpa galat',()=>{
  const p=g.keping.find(q=>!q.pas);
  const px=(p.x+g.papan.cell/2)/g.W, py=(p.y+g.papan.cell/2)/g.H;
  for(let i=0;i<20;i++){ g.onResults(hand(px,py,false)); frames(1,16); }
  g.onResults(hand(px,py,true));
  const q=g.digenggam; assert(q,'tidak ada kepingan yang terambil');
  const tx=(g.papan.x+q.col*g.papan.cell+g.papan.cell/2)/g.W;
  const ty=(g.papan.y+q.row*g.papan.cell+g.papan.cell/2)/g.H;
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
    const kam=g.kotakKamera(), bil=g.bilahKotak();
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
      g.GRID=g.TINGKAT[lv].grid; g.hitungPapan(); g.buatKeping();
      const c=g.papan.cell, a=g.areaMain;
      g.keping.forEach((p,i)=>{
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
  assert(g.tanganAda===true,'tangan harusnya terdeteksi');
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
  assert(g.hoverT===0,'dwell harus berhenti saat aliran frame mati, hoverT='+g.hoverT);
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

console.log('\nhasil: '+lolos+' lolos, '+gagal+' gagal');
process.exit(gagal?1:0);
