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

function ctxStub(){
  const noop=()=>{};
  const c={};
  ['beginPath','moveTo','lineTo','arcTo','arc','closePath','fill','stroke','clip','save','restore',
   'fillRect','strokeRect','clearRect','translate','scale','rotate','setTransform','setLineDash',
   'drawImage','fillText','strokeText','rect'].forEach(k=>c[k]=noop);
  c.createRadialGradient=()=>({addColorStop:noop});
  c.createLinearGradient=()=>({addColorStop:noop});
  c.measureText=()=>({width:50});
  return c;
}
function el(){
  return {style:{},hidden:false,textContent:'',innerHTML:'',addEventListener(){},
          getContext:()=>ctxStub(),width:0,height:0,videoWidth:640,videoHeight:480,readyState:4};
}
let rafQueue=[];
const sandbox={
  console, Math, JSON, Date, Infinity, NaN, isNaN, parseInt, parseFloat, Promise,
  setTimeout:(f,t)=>0, clearTimeout(){},
  performance:{now:()=>Date.now()},
  requestAnimationFrame:f=>{rafQueue.push(f);return 1;},
  location:{protocol:'https:',search:''},
  navigator:{mediaDevices:{getUserMedia(){}}},
  document:{hidden:false,getElementById:()=>el(),createElement:()=>el(),
            addEventListener(){},fonts:{ready:Promise.resolve()}},
};
sandbox.window={innerWidth:1280,innerHeight:800,devicePixelRatio:2,addEventListener(){}};
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

console.log('\nhasil: '+lolos+' lolos, '+gagal+' gagal');
process.exit(gagal?1:0);
