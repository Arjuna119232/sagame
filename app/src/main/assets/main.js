import * as THREE from 'three';
import { AssetLoader } from './AssetLoader.js';
import { SceneBuilder } from './SceneBuilder.js';
import { setupRenderer, setupLights, loadEnv, setDay } from './MaterialSetup.js';
import { SFX } from './SoundFx.js';
import { MUSIC } from './Music.js';
import { DUNIA, MAX_LALULINTAS, JUMLAH_NPC, jumlahMenara, komposisiNPC, rencanaLaluLintas, profilKotaHtml } from './KotaData.js';

// Ukuran dunia diturunkan dari KotaData.js (15x15 blok x 40 m = 600 m).
const NB=DUNIA.blok, HALF=(NB-1)/2, EDGE=DUNIA.sisi/2, BLOK=DUNIA.blokM;
const BATAS=EDGE+10, ZMIN=-(EDGE-25), TRW=EDGE-15, SPAWN=EDGE-20;

const $=id=>document.getElementById(id);
let mode='splash',cur='',prevScr='menu',ld=false,vp=false,ST={g:1,f:1,t:1,s:1,m:1,a:1},STAT={best:0,time:0,hits:0};
try{Object.assign(ST,JSON.parse(localStorage.getItem('pgs_st')||'{}'));Object.assign(STAT,JSON.parse(localStorage.getItem('pgs_stat')||'{}'))}catch(e){}
if(ST.a===0){SFX.setMuted(true);MUSIC.setMuted(true);}
const svS=()=>{try{localStorage.setItem('pgs_st',JSON.stringify(ST));localStorage.setItem('pgs_stat',JSON.stringify(STAT))}catch(e){}};
function show(id){cur=id;document.querySelectorAll('.scr').forEach(e=>e.style.display=e.id==id?'flex':'none');if(id&&id!=='')SFX.play('click')}
function startPlay(){mode='play';document.body.classList.add('play');show('');MUSIC.stop();SFX.play('start');SFX.setAmbientLevel(1)}
function pauseGame(){mode='pause';svS();show('pause');SFX.play('pause');SFX.setAmbientLevel(.3)}
function resumeGame(){mode='play';show('');SFX.play('resume');SFX.setAmbientLevel(1)}
function toMenu(){mode='menu';svS();document.body.classList.remove('play');show('menu');MUSIC.start();SFX.setAmbientLevel(.2)}
const SD=[['GRAFIS','g',['HEMAT','TINGGI']],['JARAK PANDANG','f',['DEKAT','SEDANG','JAUH']],['LALU LINTAS','t',['SEDIKIT','NORMAL','RAMAI']],['KEPEKAAN KEMUDI','s',['RENDAH','NORMAL','TINGGI']],['MINIMAP','m',['MATI','AKTIF']],['SUARA','a',['MATI','AKTIF']]];
function openSet(f){prevScr=f;show('sett');renderSet()}
function renderSet(){$('sl').innerHTML=SD.map((r,i)=>'<div class="mi row" onclick="chg('+i+')"><span>'+r[0]+'</span><b>'+r[2][ST[r[1]]]+'</b></div>').join('')}
function chg(i){const r=SD[i];ST[r[1]]=(ST[r[1]]+1)%r[2].length;svS();renderSet();if(r[1]=='a'){SFX.setMuted(ST.a===0);MUSIC.setMuted(ST.a===0)};window.AP&&AP()}
function showProfil(){$('pft').innerHTML=profilKotaHtml();show('profil')}
function showStats(){$('stt').innerHTML='SKOR TERTINGGI: '+STAT.best+'<br>WAKTU MAIN: '+(STAT.time/60|0)+' MENIT<br>TABRAKAN PEJALAN KAKI: '+STAT.hits;show('stats')}
function bk(){if(mode=='play')pauseGame();else if(cur=='pause')resumeGame();else if(cur=='sett')show(prevScr);else if(cur=='brief'||cur=='stats'||cur=='profil')show('menu');else if(cur=='menu'&&window.Android)Android.quit()}
const TIPS=['Dekati mobil lalu tekan MASUK untuk mengemudi.','Tahan LARI/REM saat menyetir untuk mengerem.','Di Jakarta kendaraan lewat di lajur kiri.','Makin banyak bintang, makin cepat polisi mengejar.','Monas ada di pusat kota, titik awal permainanmu.','Geser layar (sisi kanan) untuk melihat kiri/kanan.','Pohon, tiang, dan kendaraan itu padat. Jangan menabrak.'];
function setBar(p){$('barf').style.width=p+'%';$('pct').textContent='Memuat dunia Jakarta... '+Math.min(100,p|0)+'%'}
function skyline(){const c=$('sk'),x=c.getContext('2d');c.width=480;c.height=270;const g=x.createLinearGradient(0,0,0,270);g.addColorStop(0,'#2b1b4a');g.addColorStop(.6,'#e8693a');g.addColorStop(1,'#ffb35a');x.fillStyle=g;x.fillRect(0,0,480,270);x.fillStyle='#120c1c';for(let i=0;i<60;i++){const w=10+Math.random()*18,h=30+Math.random()*(i>20&&i<40?110:55);x.fillRect(i*8-10,270-h,w,h)}x.fillRect(236,70,8,200);x.beginPath();x.arc(240,66,6,0,6.3);x.fillStyle='#ffc830';x.fill()}
function toLoad(){if(ld)return;ld=true;mode='load';show('load');MUSIC.start();skyline();let k=0;$('tip').textContent=TIPS[0];const tv=setInterval(()=>{$('tip').textContent=TIPS[++k%TIPS.length]},1600);setBar(8);
  setTimeout(()=>setBar(30),400);
  setTimeout(async()=>{try{await boot(ST.g?2:1)}catch(e){console.error(e);$('pct').textContent='Gagal memuat: '+e.message;return}setBar(70);let p=70;const iv=setInterval(()=>{p+=6;setBar(p);if(p>=100){clearInterval(iv);clearInterval(tv);setTimeout(()=>{mode='menu';show('menu');SFX.play('menu')},300)}},120)},900)}

function back(){show(prevScr)}
async function boot(Q){
const R=new THREE.WebGLRenderer({antialias:Q>1,alpha:true});
R.setPixelRatio(Q>1?Math.min(devicePixelRatio,2):1);R.setSize(innerWidth,innerHeight);R.domElement.id='g';document.body.prepend(R.domElement);
setupRenderer(R);
const S=new THREE.Scene(),{hemi,sun}=setupLights(S,Q>1);
const C=new THREE.PerspectiveCamera(65,innerWidth/innerHeight,.1,800);
const AL=new AssetLoader(),SB=new SceneBuilder(S,AL);
await AL.load('assets/manifest.json',p=>setBar(30+p*40));
await loadEnv(R,S,'assets/env/sky.hdr');
if(AL.missing.length)$('tip').textContent='Aset GLB belum lengkap: '+AL.missing.length+' file tidak ditemukan (lihat README).';
// ---- ground & langit (satu-satunya geometri prosedural yang diizinkan)
const std=(c,r)=>new THREE.MeshStandardMaterial({color:c,roughness:r??.95,metalness:0});
const flat=(w,x,z,y,mat)=>{const q=new THREE.Mesh(new THREE.PlaneGeometry(w,w),mat);q.rotation.x=-Math.PI/2;q.position.set(x,y,z);q.receiveShadow=true;S.add(q);return q};
flat(DUNIA.sisi+200,0,0,0,std(0x34373c));
flat(DUNIA.sisi+200,0,-(EDGE+40),.05,std(0x2f7fb0,.25)).scale.y=.15;
const sw=new THREE.InstancedMesh(new THREE.PlaneGeometry(28,28),std(0x8d9096),NB*NB),dm=new THREE.Matrix4(),qx=new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI/2,0,0)),one=new THREE.Vector3(1,1,1);let si=0;
for(let i=-HALF;i<=HALF;i++)for(let j=-HALF;j<=HALF;j++){dm.compose(new THREE.Vector3(i*BLOK,.03,j*BLOK),qx,one);sw.setMatrixAt(si++,dm)}
sw.receiveShadow=true;S.add(sw);
const st=[];for(let i=0;i<400;i++){const a=Math.random()*6.28,e=Math.random()*1.4;st.push(Math.cos(a)*Math.cos(e)*300,Math.sin(e)*300+10,Math.sin(a)*Math.cos(e)*300)}
const sg=new THREE.BufferGeometry();sg.setAttribute('position',new THREE.Float32BufferAttribute(st,3));
const stars=new THREE.Points(sg,new THREE.PointsMaterial({color:0xffffff,size:2,sizeAttenuation:false,transparent:true,opacity:0,fog:false}));S.add(stars);
// ---- data kota
const BU=[],CI=[],pk=a=>a[(Math.random()*a.length)|0],fv=a=>[Math.sin(a),Math.cos(a)],LM=[[0,0],[0,80],[-120,120],[120,-160],[-40,-160]];
const hit=(x,z,r)=>BU.some(b=>Math.abs(x-b.x)<b.r+r&&Math.abs(z-b.z)<b.r+r)||CI.some(c=>Math.abs(x-c[0])<c[2]+r&&Math.abs(z-c[1])<c[2]+r);
// Ambang distrik diskalakan dari layout 11 blok (v0.6) ke jumlah blok sekarang.
const DS=NB/11;
function dist(i,j){if(!i&&!j)return'Monas, Gambir';if(j<=-4*DS)return i<0?'Kota Tua':'Ancol';if(!i&&j==2)return'Bundaran HI, Thamrin';if(j>=5*DS)return'Blok M';if(i<=-3*DS&&j>=2)return'Senayan';if(j>=2&&i>=DS)return'Kuningan';if(j>=2)return'Sudirman - SCBD';if(i<=-2*DS)return'Tanah Abang';if(i>=2*DS)return'Menteng';return'Gambir, Jakarta Pusat'}
const LB=[];function lab(t,x,y,z){const e=document.createElement('div');e.className='lb';e.textContent=t;$('lbs').appendChild(e);LB.push({e,v:new THREE.Vector3(x,y,z)})}
function plang(t,x,z,rot){
  // plang jalan hijau fisik (bukan melayang): tiang + papan dengan teks
  const post=new THREE.Mesh(new THREE.CylinderGeometry(.08,.1,2.2,8),new THREE.MeshStandardMaterial({color:0x666666}));
  post.position.set(x,.9,z);S.add(post);
  const cv=document.createElement('canvas');cv.width=256;cv.height=96;
  const cx=cv.getContext('2d');
  cx.fillStyle='#1b7a3d';cx.fillRect(0,0,256,96);
  cx.strokeStyle='#ffffff';cx.lineWidth=4;cx.strokeRect(4,4,248,88);
  cx.fillStyle='#ffffff';cx.font='bold 26px Arial';cx.textAlign='center';cx.textBaseline='middle';
  // wrap text if long
  const words=t.split(' ');let line='';const lines=[];
  for(const w of words){const test=line?line+' '+w:w;if(cx.measureText(test).width>230){lines.push(line);line=w}else line=test}
  if(line)lines.push(line);
  const lh=30;const startY=48-(lines.length-1)*lh/2;
  lines.forEach((ln,i)=>cx.fillText(ln,128,startY+i*lh));
  const tex=new THREE.CanvasTexture(cv);tex.needsUpdate=true;
  const board=new THREE.Mesh(new THREE.PlaneGeometry(1.6,.6),new THREE.MeshBasicMaterial({map:tex,transparent:false}));
  board.position.set(x,2.0,z);board.rotation.y=rot||0;S.add(board);
  // papan belakang (hijau solid) supaya terlihat dari dua sisi
  const back=new THREE.Mesh(new THREE.PlaneGeometry(1.6,.6),new THREE.MeshBasicMaterial({color:0x1b7a3d}));
  back.position.set(x,2.0,z);back.rotation.y=(rot||0)+Math.PI;S.add(back);
}
const park=(x,z,c)=>flat(28,x,z,.06,std(c));
function put(id,x,z,rot){const o=SB.loadAsset(id,[x,0,z],rot||0);if(!o.userData.missing){const b=o.userData.size;BU.push({x,z,r:Math.max(b.x,b.z)/2*.9})}return o}
const PICK={sud:['gedung_pencakar_1','gedung_pencakar_2'],men:['rumah_menteng_1'],tan:['ruko_1','ruko_2'],kot:['gedung_kolonial_1'],anc:['gedung_umum_1'],sen:['gedung_umum_1','gedung_umum_2'],blk:['ruko_1','gedung_umum_2'],def:['gedung_umum_1','gedung_umum_2']};
let ferris=null;const SLOT=[];
for(let i=-HALF;i<=HALF;i++)for(let j=-HALF;j<=HALF;j++){
  const x=i*BLOK,z=j*BLOK,d=dist(i,j);
  if(!i&&!j){park(x,z,0x3f8f45);put('monas',x,z);SB.loadAsset('bendera',[x+8,0,z-8]);CI.push([x+8,z-8,.25]);lab('MONAS',x,48,z);continue}
  if(!i&&j==2){put('bundaran_hi',x,z);lab('BUNDARAN HI',x,22,z);continue}
  if(i==-3&&j==3){park(x,z,0x3f8f45);put('stadion_gbk',x,z);lab('GBK SENAYAN',x,18,z);continue}
  if(i==3&&j==-4){park(x,z,0x4a9a4a);const o=put('dufan_bianglala',x,z);o.traverse(n=>{if(!ferris&&/wheel|roda|bianglala|rotor/i.test(n.name))ferris=n});lab('DUFAN ANCOL',x,30,z);continue}
  const k=d=='Kuningan'||d[0]=='S'&&d[1]=='u'?'sud':d=='Menteng'?'men':d=='Tanah Abang'?'tan':d=='Kota Tua'?'kot':d=='Ancol'?'anc':d=='Senayan'?'sen':d=='Blok M'?'blk':'def';
  SLOT.push({x,z,k});
}
// tower apartemen: jumlahnya dari data (46.000 unit / 120 unit per menara vs 3.500 gedung audit)
const urut=SLOT.map(o=>[Math.random(),o]).sort((a,b)=>a[0]-b[0]).map(a=>a[1]),tower=new Set();
let sisaMenara=jumlahMenara();
for(const p of ['sud','tan','men']){for(const o of urut){if(sisaMenara<=0)break;if(o.k===p&&!tower.has(o)){tower.add(o);sisaMenara--}}}
for(const o of urut){if(sisaMenara<=0)break;if(!tower.has(o)){tower.add(o);sisaMenara--}}
// Bangunan dipasang sebagai InstancedMesh per tipe (225 gedung -> ~7 draw call,
// bukan ~800), supaya 600 m x 600 m tetap ringan di ponsel.
let menaraTerpasang=0;
const INST={};
const taruh=(id,x,z)=>{const b=SB.bounds(id);BU.push({x,z,r:Math.max(b.x,b.z)/2*.9});(INST[id]=INST[id]||[]).push({x,z,rot:(Math.random()*4|0)*Math.PI/2})};
for(const o of SLOT){
  if(tower.has(o)){taruh('apartemen_1',o.x,o.z);menaraTerpasang++;continue}
  if(o.k=='men'||o.k=='sen')park(o.x,o.z,0x3f8f45);if(o.k=='anc')park(o.x,o.z,0x4a9a4a);
  taruh(pk(PICK[o.k]),o.x,o.z)}
for(const id in INST)SB.loadInstanced(id,INST[id]);
[['KOTA TUA',-27,18,-190],['TANAH ABANG',-136,30,0],['MENTENG',136,16,0],['KUNINGAN',82,95,129],['SCBD',-27,95,129],['BLOK M',27,28,246],['TELUK JAKARTA',0,6,-326]].forEach(a=>lab(a[0],a[1],a[2],a[3]));
const lampL=[],treeL=[];
for(let i=-HALF;i<=HALF;i++)for(let j=-HALF;j<=HALF;j++){lampL.push({x:i*BLOK+13,z:j*BLOK+13});for(const[ox,oz]of[[-13,-13],[13,-13],[-13,13]])treeL.push({x:i*BLOK+ox,z:j*BLOK+oz,rot:Math.random()*6.28,s:.8+Math.random()*.5})}
if(SB.loadInstanced('tiang_lampu',lampL))lampL.forEach(l=>CI.push([l.x,l.z,.35]));
if(SB.loadInstanced('pohon_1',treeL))treeL.forEach(t=>CI.push([t.x,t.z,.5]));

// ---- marka jalan, jalur sepeda, flyover, lapangan GBK (Jakarta Selatan) ----
const roadMat=(c,o=1)=>new THREE.MeshBasicMaterial({color:c,transparent:o<1,opacity:o});
// jalan raya grid: garis tengah kuning + garis tepi putih
for(let k=-7;k<=7;k++){
  const z=k*40+20;
  // garis tengah (kuning putus-putus) sepanjang x
  for(let s=-7;s<=7;s++){
    const seg=new THREE.Mesh(new THREE.PlaneGeometry(6,1.2),roadMat(0xffd23a));
    seg.rotation.x=-Math.PI/2;seg.position.set(s*40+20,.04,z);S.add(seg);
  }
  // garis tepi putih
  for(const off of [-14,14]){
    const e=new THREE.Mesh(new THREE.PlaneGeometry(560,0.6),roadMat(0xffffff));
    e.rotation.x=-Math.PI/2;e.position.set(0,.04,z+off);S.add(e);
  }
}
for(let k=-7;k<=7;k++){
  const x=k*40+20;
  for(let s=-7;s<=7;s++){
    const seg=new THREE.Mesh(new THREE.PlaneGeometry(1.2,6),roadMat(0xffd23a));
    seg.rotation.x=-Math.PI/2;seg.position.set(x,.04,s*40+20);S.add(seg);
  }
  for(const off of [-14,14]){
    const e=new THREE.Mesh(new THREE.PlaneGeometry(0.6,560),roadMat(0xffffff));
    e.rotation.x=-Math.PI/2;e.position.set(x+off,.04,0);S.add(e);
  }
}
// jalur sepeda (hijau) di beberapa jalan
for(let k=-3;k<=3;k++){
  const z=k*40+20;
  const bl=new THREE.Mesh(new THREE.PlaneGeometry(560,3),roadMat(0x2ecc71,.85));
  bl.rotation.x=-Math.PI/2;bl.position.set(0,.05,z-10);S.add(bl);

}
// flyover (jalan layang) di atas salah satu jalan utama
const fly=new THREE.Mesh(new THREE.BoxGeometry(260,1,16),new THREE.MeshStandardMaterial({color:0x555555,roughness:.9}));
fly.position.set(0,9,0);S.add(fly);
// tiang penyangga flyover
for(let i=-4;i<=4;i++){const p=new THREE.Mesh(new THREE.CylinderGeometry(.6,.6,9,8),new THREE.MeshStandardMaterial({color:0x888888}));p.position.set(i*30,4.5,0);S.add(p)}
// lapangan GBK: alas hijau + tribun sederhana di sekitar stadion (stadion_gbk sudah di slot i=-3,j=3)
const gbkX=-3*40,gbkZ=3*40;
const field=new THREE.Mesh(new THREE.PlaneGeometry(90,120),new THREE.MeshStandardMaterial({color:0x2e8b57}));
field.rotation.x=-Math.PI/2;field.position.set(gbkX,.06,gbkZ);S.add(field);
// signage Jakarta Selatan (Indomaret dll) sebagai label di atas ruko area Kuningan
[['INDOMARET',82,129],['ALFAMART',92,119],['WARUNG NASI',70,118],['BENGKEL MOTOR',60,108]].forEach(a=>lab(a[0],a[1],16,a[2]));

// Titik rumah warga di Poncol Jaya. Harus dideklarasikan SEBELUM blok plang OSM
// di bawah, karena blok itu sudah memakainya (dulu deklarasinya di bawah -> ReferenceError).
const RUMAH_PONCOL=[72,0,108];

// ---- plang jalan tambahan dari data OSM (Jakarta Selatan) ----
const JALAN_OSM = [
 ['JL. PONCOL GANG I',-22,-8],['JL. PONCOL GANG II',-14,-14],['JL. PONCOL GANG III',-6,-20],
 ['JL. PONCOL GANG IV',2,-24],['JL. PONCOL GANG V',10,-22],['JL. PONCOL GANG XI',22,2],
 ['JL. PONCOL GAN VIII',-10,-16],['JL. PONCOL',-28,4],['JL. BANGKA RAYA',40,-6],
 ['JL. BANGKA I',46,6],['JL. BANGKA II',52,14],['JL. BANGKA I A',44,-14],
 ['JL. KEBALAN I',-34,8],['JL. KEBALAN II',-40,16],['JL. KEBALAN III',-32,22],
 ['JL. KEBALAN IV',-26,28],['JL. KEBALAN V',-20,32],['JL. KEBALAN VI',-14,36],
 ['JL. KEBALAN VII',-8,40],['JL. RENGAS I',-46,-6],['JL. RENGAS II',-52,2],
 ['JL. RENGAS III',-44,10],['JL. RENGAS',-38,-12],['JL. TURI I',-30,-24],
 ['JL. TURI II',-24,-30],['JL. TURI III',-18,-34],['JL. PONDOK KARYA I',-44,24],
 ['JL. PONDOK KARYA II',-38,30],['JL. PONDOK KARYA III',-32,36],
 ['JL. LAKSANA I',34,-28],['JL. LAKSANA II',40,-22],['JL. LAKSANA III',46,-16],
 ['JL. BIRAH I',54,-8],['JL. BIRAH II',58,0],['JL. BIRAH III',52,8],
 ['JL. BIRAH IV',48,16],['JL. BIRAH RAYA',60,-14],['JL. EMPANG I',-48,-20],
 ['JL. SUREN II',-56,10],['JL. SUREN III',-50,18],['JL. CIPAKU',30,-34],
 ['JL. CIPAKU I',36,-30],['JL. CIASEM I',42,-26],['JL. CIASEM III',48,-20],
 ['JL. CIASEM IV',54,-14],['JL. CISANGGIRI II',24,-40],['JL. CISANGGIRI IV',30,-36],
 ['JL. CISANGGIRI V',36,-32],['JL. CINIRU III',18,-44],['JL. CINIRU VII',24,-48],
 ['JL. CIKATOMAS II',12,-42],['JL. WIDYA CHANDRA IX',-6,44],
 ['JL. WIJAYA I',-44,-34],['JL. WIJAYA II',-38,-30],['JL. WIJAYA KARTA I',-30,-38],
 ['JL. WIJAYA KARTA II',-24,-34],['JL. WIJAYA KARTA III',-18,-30],
 ['JL. WIJAYA KARTA IV',-12,-26],['JL. WIJAYA TIMUR I',6,-34],
 ['JL. WIJAYA TIMUR II',12,-30],['JL. WIJAYA TIMUR IV',18,-26],
 ['JL. WIJAYA TIMUR V',24,-22],['JL. WIJAYA TIMUR VI',30,-18],
 ['JL. WIJAYA TIMUR RAYA',14,-40],['JL. DARUSSALAM',-58,-24],
 ['JL. SENAYAN',-62,-10],['JL. SURYO RAYA',-56,-2], ['JL. SURYO',-50,6],
 ['JL. PANCOL GANG VI',-40,-40],['JL. PECANDRAN',-34,-44],
 ['JL. KOMPLEK POLRI',-28,-48],
 ['JL. PONDOK KARYA V',-22,-44],['JL. PONDOK KARYA',-16,-40],
 ['JL. PECANDRAN',-42,-34],['JL. HAJI ABDUL KARIM',-48,28],
 ['JL. HAJI HASAN',-52,34],['JL. HAJI MALIKI',-46,40],
 ['JL. HAJI MARAIS',-40,44],['JL. HAJI NAWAR',-34,48],
 ['JL. HAJI ROYANI',-28,44],['JL. JATI',-22,40],['JL. MENARA',-16,36],
 ['JL. SAIRI',-10,40],['JL. SWADAYA',-4,44],['JL. MINI 1',2,48],
 ['JL. MINI 2',8,44],['JL. MINI 3',14,40],
 ['JL. AMAL I',20,36],['JL. AMAL II',26,32],
 ['JL. KAPten Tendean'.upper(),-8,-50],
];
JALAN_OSM.forEach(([n,dx,dz],i)=>{
  const x=RUMAH_PONCOL[0]+dx, z=RUMAH_PONCOL[2]+dz;
  plang(n,x,z, (Math.abs(dx)>Math.abs(dz))?Math.PI/2:0);
});

// ---- karakter & kendaraan (GLB)
const dims=(g,d)=>{const s=g.userData.size;g.userData.hw=s.x>0?s.x/2:d[0];g.userData.hl=s.z>0?s.z/2:d[1];return g};
const _hr0=SB.loadAsset('rumah_menteng_1',RUMAH_PONCOL,0);BU.push({x:RUMAH_PONCOL[0],z:RUMAH_PONCOL[2],r:Math.max(_hr0.userData.size.x,_hr0.userData.size.z)/2*.85});
// pintu rumah menghadap selatan; spawn tepat di depan pintu supaya tidak nyangkut di tembok
// ---- klaster Poncol Jaya: gang-gang sempit + rumah + toko (data nama gang dari OSM) ----
const GPN=[['Gang Poncol',RUMAH_PONCOL[0]-18,RUMAH_PONCOL[2]+6],['Gang Poncol Jaya',RUMAH_PONCOL[0]+4,RUMAH_PONCOL[2]+14],['Gang Poncol Gang XI',RUMAH_PONCOL[0]+22,RUMAH_PONCOL[2]+2],['Gang Poncol Gan VIII',RUMAH_PONCOL[0]-10,RUMAH_PONCOL[2]-16],['Gang Mini 1',RUMAH_PONCOL[0]+14,RUMAH_PONCOL[2]-12],['Gang Mini 2',RUMAH_PONCOL[0]-2,RUMAH_PONCOL[2]-22],['Gang Mini 3',RUMAH_PONCOL[0]+18,RUMAH_PONCOL[2]-20],['Gang Amal I',RUMAH_PONCOL[0]-24,RUMAH_PONCOL[2]+12],['Gang Amal II',RUMAH_PONCOL[0]+26,RUMAH_PONCOL[2]+10],['Gang Jati',RUMAH_PONCOL[0]-16,RUMAH_PONCOL[2]+24],['Gang Swadaya',RUMAH_PONCOL[0]+8,RUMAH_PONCOL[2]+26],['Gang Menara',RUMAH_PONCOL[0]+20,RUMAH_PONCOL[2]+20]];
GPN.forEach(([n,x,z],i)=>{plang(n,x,z, (i%2===0)?0:Math.PI/2);});
// rumah-rumah kecil sepanjang gang
for(let i=0;i<18;i++){const a=GPN[i%GPN.length];const rx=a[1]+(Math.random()-.5)*6,rz=a[2]+(Math.random()-.5)*6;const _h=SB.loadAsset('rumah_menteng_1',[rx,0,rz],(Math.random()*4|0)*Math.PI/2);BU.push({x:rx,z:rz,r:Math.max(_h.userData.size.x,_h.userData.size.z)/2*.85})}
// toko Indomaret/Alfamart di mulut gang
const _r1=SB.loadAsset('ruko_1',[RUMAH_PONCOL[0]+30,0,RUMAH_PONCOL[2]-8],Math.PI/2);BU.push({x:RUMAH_PONCOL[0]+30,z:RUMAH_PONCOL[2]-8,r:Math.max(_r1.userData.size.x,_r1.userData.size.z)/2*.85});plang('INDOMARET',RUMAH_PONCOL[0]+30,RUMAH_PONCOL[2]-8,Math.PI/2);
const _r2=SB.loadAsset('ruko_2',[RUMAH_PONCOL[0]-28,0,RUMAH_PONCOL[2]-6],-Math.PI/2);BU.push({x:RUMAH_PONCOL[0]-28,z:RUMAH_PONCOL[2]-6,r:Math.max(_r2.userData.size.x,_r2.userData.size.z)/2*.85});plang('ALFAMART',RUMAH_PONCOL[0]-28,RUMAH_PONCOL[2]-6,-Math.PI/2);
// jalan kapten tendean (jalan utama) label
plang('JL. KAPTEN TENDEAN',RUMAH_PONCOL[0],RUMAH_PONCOL[2]-40,0);
plang('JL. KUNINGAN BARAT RAYA',RUMAH_PONCOL[0]+50,RUMAH_PONCOL[2]+10,Math.PI/2);
lab('PONCOL JAYA',RUMAH_PONCOL[0],14,RUMAH_PONCOL[2]);
const P=SB.loadAsset('player',[RUMAH_PONCOL[0],0,RUMAH_PONCOL[2]-6]);SB.play(P,'idle');  // awal di depan rumah, Poncol Jaya
const car=dims(SB.loadAsset('mobil_player',[RUMAH_PONCOL[0]+8,0,RUMAH_PONCOL[2]-6]),[1.1,2.3]);
const spot=new THREE.SpotLight(0xfff2cc,0,70,.5,.5),stg=new THREE.Object3D();spot.position.set(0,1,2);stg.position.set(0,0,20);car.add(spot,stg);spot.target=stg;
const TR=[],PO=[],PD=[];
// komposisi mengikuti data Jakarta: 76% motor, 19% mobil, 4% truk, <1% bus (lihat KotaData.js)
const SPR={bus_transjakarta:[1.3,4.9],bajaj:[.85,1.5],motor_1:[.4,1.0],truk_1:[1.2,3.3],def:[1.1,2.3]};
rencanaLaluLintas(MAX_LALULINTAS).forEach((id,k)=>{const g=dims(SB.loadAsset(id),SPR[id]||SPR.def),u=g.userData;u.rad=u.hl+1.2;u.ver=k%2==0;u.line=20+BLOK*(((Math.random()*(NB-1))|0)-HALF);u.dir=Math.random()<.5?1:-1;u.p=(Math.random()-.5)*2*TRW;u.cd=0;TR.push(g)});
for(let k=0;k<3;k++){const g=dims(SB.loadAsset('mobil_polisi'),[1.1,2.3]);g.visible=false;g.userData.on=false;g.userData.li=[0xff2222,0x2266ff].map((c,n)=>{const l=new THREE.PointLight(c,0,18,2);l.position.set(n?.5:-.5,2,0);g.add(l);return l});PO.push(g)}
function spawn(m){let x,z;do{x=(Math.random()-.5)*2*SPAWN;z=(Math.random()-.5)*2*SPAWN}while(hit(x,z,1));m.position.set(x,0,z);m.visible=true;m.userData.dead=0}
// jumlah & komposisi umur pejalan kaki mengikuti data kota (KotaData.js)
for(const id of komposisiNPC(JUMLAH_NPC)){const m=SB.loadAsset(id),u=m.userData;u.id=id;u.a=0;u.t=0;u.dead=0;u.ph=Math.random()*6;SB.play(m,'walk');spawn(m);PD.push(m)}
// input
let jx=0,jy=0,run=false,jt=null,inCar=false,v=0,score=0,heat=0,msg='',msgT=0,tod=.42,last=performance.now(),ph=0,skyT=0,tm=0;
const J=$('joy'),K=$('knob'),A=$('act'),RU=$('run');
function jm(e){for(const t of e.changedTouches){if(t.identifier!==jt)continue;const r=J.getBoundingClientRect();let x=(t.clientX-r.left-68)/68,y=(t.clientY-r.top-68)/68;const l=Math.hypot(x,y);if(l>1){x/=l;y/=l}jx=x;jy=y;K.style.left=46+x*46+'px';K.style.top=46+y*46+'px'}}
J.addEventListener('touchstart',e=>{e.preventDefault();jt=e.changedTouches[0].identifier;jm(e)});
J.addEventListener('touchmove',e=>{e.preventDefault();jm(e)});
J.addEventListener('touchend',()=>{jt=null;jx=jy=0;K.style.left=K.style.top='46px'});
RU.addEventListener('touchstart',e=>{e.preventDefault();run=true});RU.addEventListener('touchend',()=>run=false);
A.addEventListener('touchstart',e=>{e.preventDefault();
  if(!inCar){if(P.position.distanceTo(car.position)<5){inCar=true;P.visible=false;v=0;A.textContent='KELUAR';SFX.play('carEnter');SFX.startEngine()}}
  else{inCar=false;v=0;const[a,b]=fv(car.rotation.y);P.position.set(car.position.x+b*3,0,car.position.z-a*3);P.rotation.y=car.rotation.y;P.visible=true;A.textContent='MASUK';SFX.play('carExit');SFX.stopEngine()}});
addEventListener('resize',()=>{R.setSize(innerWidth,innerHeight);C.aspect=innerWidth/innerHeight;C.updateProjectionMatrix()});
// siang-malam
const cD=new THREE.Color(0x9fd0f0),cN=new THREE.Color(0x070b1a),cK=new THREE.Color(0xff8a50),zD=new THREE.Color(0x3f86d6),zN=new THREE.Color(0x02040c),tmp=new THREE.Color(),zen=new THREE.Color();let nf=0;
// Jam dinding WIB (UTC+7, tanpa DST) dalam format 24 jam, mis. "17:19".
// Dipakai HUD supaya tidak menampilkan jam UTC/game yang mengaku "WIB".
function jamWIB(t = Date.now()) {
  const d = new Date(t + 7 * 3600 * 1000);
  return String(d.getUTCHours()).padStart(2, '0') + ':' + String(d.getUTCMinutes()).padStart(2, '0');
}

function sky(dt,T){tod=(tod+dt/300)%1;const th=(tod-.25)*6.2832,cs=Math.cos(th),sn=Math.sin(th),dayF=Math.max(0,Math.min(1,sn*3+.5)),dusk=Math.max(0,1-Math.abs(sn)*4);nf=1-dayF;
  tmp.copy(cN).lerp(cD,dayF).lerp(cK,dusk*.55);S.fog.color.copy(tmp);zen.copy(zN).lerp(zD,dayF).lerp(cK,dusk*.25);
  skyT-=dt;if(skyT<=0){skyT=.25;document.body.style.background='linear-gradient(#'+zen.getHexString()+',#'+tmp.getHexString()+' 58%)'}
  sun.intensity=dayF*3;sun.color.setHex(dusk>.3?0xffb070:0xfff0d0);hemi.intensity=.3+dayF*.9;hemi.color.setHex(dayF>.4?0xbfd8ff:0x4a5a99);
  sun.position.set(T.position.x+cs*90,Math.max(sn,.2)*90,T.position.z+27);sun.target.position.set(T.position.x,0,T.position.z);
  
  stars.position.copy(C.position);stars.material.opacity=nf>.5?(nf-.5)*2:0;
  setDay(nf);spot.intensity=inCar?nf*250:0}
function slide(g,s,dt,r){const[a,b]=fv(g.rotation.y),nx=g.position.x+a*s*dt,nz=g.position.z+b*s*dt;if(!hit(nx,g.position.z,r))g.position.x=nx;if(!hit(g.position.x,nz,r))g.position.z=nz}
const mm=$('mm'),X=mm.getContext('2d');
function tick(t){
  const dt=mode=='pause'?0:Math.min((t-last)/1000,.05);last=t;tm+=dt;if(ferris)ferris.rotation.z+=dt*.15;SB.update(dt);const sv=[.7,1,1.4][ST.s];if(mode=='play'){STAT.time+=dt;STAT.best=Math.max(STAT.best,score);svT-=dt;if(svT<=0){svT=15;svS()}}
  const T=inCar?car:P,rad=inCar?2:.5,f=-jy;let sp;
  let a,b;const rr=inCar?1.4:.5;
  if(inCar){v+=f*20*dt;v*=1-dt;if(run)v*=1-4*dt;T.rotation.y-=jx*sv*1.8*dt*Math.max(-1,Math.min(1,v/8));sp=v;[a,b]=fv(T.rotation.y)}
  else{const ml=Math.min(1,Math.hypot(jx,jy)),fx=Math.sin(cy),fz=Math.cos(cy);if(ml>.12){const dx=fx*f-fz*jx,dz=fz*f+fx*jx,dl=Math.hypot(dx,dz)||1;a=dx/dl;b=dz/dl;let df=Math.atan2(a,b)-P.rotation.y;df=Math.atan2(Math.sin(df),Math.cos(df));P.rotation.y+=df*Math.min(1,12*dt);sp=ml*(run?9:4)}else{a=b=0;sp=0}}
  const nx=Math.max(-BATAS,Math.min(BATAS,T.position.x+a*sp*dt)),nz=Math.max(ZMIN,Math.min(BATAS,T.position.z+b*sp*dt));
  const ph2=(x,z)=>!inCar&&PD.some(m=>m.visible&&m.userData.dead<=0&&Math.hypot(x-m.position.x,z-m.position.z)<rr+.45);
  let o=vb(nx,T.position.z,rr);if(!hit(nx,T.position.z,rad)&&!o&&!ph2(nx,T.position.z))T.position.x=nx;else if(inCar){v*=-.3;if(o&&o!==car&&o.userData.cd<=0){o.userData.cd=2;heat+=.6}if(!o&&crashT<=0){SFX.play('crash');crashT=.6}}
  o=vb(T.position.x,nz,rr);if(!hit(T.position.x,nz,rad)&&!o&&!ph2(T.position.x,nz))T.position.z=nz;else if(inCar){v*=-.3;if(o&&o!==car&&o.userData.cd<=0){o.userData.cd=2;heat+=.6}if(!o&&crashT<=0){SFX.play('crash');crashT=.6}}
  const mv=!inCar&&sp>.3?1:0;ph+=mv*(run?11:7)*dt;if(pT>0)pT-=dt;
  // footsteps
  if(mode=='play'&&!inCar&&mv){stepT-=dt;if(stepT<=0){SFX.play(run?'stepRun':'step');stepT=run?.28:.42}}else stepT=0;SB.play(P,pT>0?'punch':mv?(run?'run':'walk'):'idle');
  car.userData.wh.forEach(w=>w.rotation.x+=v*dt/.38);
  if(inCar)SFX.setEngineSpeed(Math.min(1,Math.abs(v)/25));
  if(punch){punch=false;for(const m of PD){if(m.userData.dead>0||!m.visible)continue;const dx=m.position.x-P.position.x,dz=m.position.z-P.position.z,d=Math.hypot(dx,dz),[fa,fb]=fv(P.rotation.y);if(d<1.9&&(dx*fa+dz*fb)/d>.3){m.userData.dead=4;m.rotation.x=-1.5;score+=10;heat+=.5;STAT.hits++;SFX.play('npcHit');SFX.play('score')}}}
  for(const m of PD){const u=m.userData;
    if(u.dead>0){u.dead-=dt;if(u.dead<=0){m.rotation.x=0;spawn(m)}continue}
    u.t-=dt;if(u.t<=0){u.a=Math.random()*6.28;u.t=2+Math.random()*3}u.ph+=dt*7;SB.play(m,'walk');m.rotation.y=u.a;
    const[pa,pb]=fv(u.a),px=m.position.x+pa*1.5*dt,pz=m.position.z+pb*1.5*dt;
    if(hit(px,pz,.4)||vb(px,pz,.45)||(!inCar&&mode=='play'&&Math.hypot(px-P.position.x,pz-P.position.z)<.9))u.t=0;else{m.position.x=px;m.position.z=pz}
    if(inCar&&Math.abs(v)>5&&m.position.distanceTo(car.position)<2.4){u.dead=4;m.visible=false;score+=10;heat+=1.2;STAT.hits++;SFX.play('npcHit');SFX.play('score')}}
  for(const g of TR){const u=g.userData,[fa,fb]=fv(g.rotation.y),fl=(u.hl||2.3)+3.5,nr=q=>Math.hypot(g.position.x+fa*fl-q.position.x,g.position.z+fb*fl-q.position.z)<3.5,sp2=(nr(T)||(!inCar&&nr(car)))?0:8;u.p+=u.dir*sp2*dt;if(Math.abs(u.p)>TRW)u.p=-TRW*u.dir;u.cd-=dt;g.userData.wh.forEach(w=>w.rotation.x+=sp2*dt/.38);
    if(u.ver){g.position.set(u.line+u.dir*3,0,u.p);g.rotation.y=u.dir>0?0:Math.PI}else{g.position.set(u.p,0,u.line-u.dir*3);g.rotation.y=u.dir>0?Math.PI/2:-Math.PI/2}
    if(g.visible&&inCar&&u.cd<=0&&g.position.distanceTo(car.position)<u.rad){u.cd=2;v*=-.5;heat+=.6;SFX.play('carHit')}}
  heat=Math.min(heat,3.99);const stn=Math.floor(heat);let near=999;
  PO.forEach((g,k)=>{const u=g.userData;
    if(k>=stn){g.visible=false;u.on=false;return}
    if(!u.on){let x,z,n=0;do{const an=Math.random()*6.28;x=T.position.x+Math.sin(an)*80;z=T.position.z+Math.cos(an)*80;n++}while((hit(x,z,2)||Math.abs(x)>BATAS||Math.abs(z)>BATAS)&&n<50);g.position.set(x,0,z);u.on=true;g.visible=true}
    const dx=T.position.x-g.position.x,dz=T.position.z-g.position.z,d=Math.hypot(dx,dz);near=Math.min(near,d);
    g.rotation.y=Math.atan2(dx,dz);slide(g,9+stn*3,dt,2);g.userData.wh.forEach(w=>w.rotation.x+=10*dt);
    const fl=Math.floor(tm*6)%2==0;g.userData.li[0].intensity=fl?40:0;g.userData.li[1].intensity=fl?0:40;
    if(d<3&&Math.abs(inCar?v:0)<4){heat=0;score=Math.max(0,score-50);inCar=false;v=0;P.visible=true;P.position.set(RUMAH_PONCOL[0],0,RUMAH_PONCOL[2]-6);car.position.set(RUMAH_PONCOL[0]+8,0,RUMAH_PONCOL[2]-6);car.rotation.y=0;A.textContent='MASUK';msg='TERTANGKAP! -50';msgT=3;SFX.play('caught');SFX.stopEngine()}});
  heat=Math.max(0,heat-dt*(near>70?.25:.04));msgT-=dt;if(crashT>0)crashT-=dt;
  // ambient traffic/city sounds
  if(mode=='play'){trafT-=dt;if(trafT<=0){SFX.trafficPass();trafT=3+Math.random()*5}cityT-=dt;if(cityT<=0){SFX.cityWind();cityT=8+Math.random()*6}npcStepT-=dt;if(npcStepT<=0){SFX.npcStep();npcStepT=1.5+Math.random()*2}}
  // sound: siren when heat high or police near; ambient level by heat
  try{SFX.setSiren(heat>1.5||near<40);SFX.setAmbientLevel(mode=='play'?(.6+heat*.1):.3)}catch(e){}
  if(mode=='play'||mode=='pause'){lookT-=dt;if(inCar&&lookT<=0&&lt===null){let df=T.rotation.y-cy;df=Math.atan2(Math.sin(df),Math.cos(df));cy+=df*Math.min(1,3*dt)}
    const d2=inCar?9:5.5,ch=Math.cos(pitch)*d2;let qx=T.position.x-Math.sin(cy)*ch,qz=T.position.z-Math.cos(cy)*ch;
    for(let k=0;k<5&&hit(qx,qz,.6);k++){qx=T.position.x+(qx-T.position.x)*.7;qz=T.position.z+(qz-T.position.z)*.7}
    C.position.lerp(new THREE.Vector3(qx,1.4+Math.sin(pitch)*d2+(inCar?.8:.3),qz),Math.min(1,10*dt));C.lookAt(T.position.x,1.4,T.position.z)}
  else{const o=tm*.08;C.position.set(Math.sin(o)*75,38+Math.sin(o*.7)*6,Math.cos(o)*75);C.lookAt(0,20,0)}
  C.fov+=(65+Math.min(18,Math.abs(v)*.7)-C.fov)*Math.min(1,4*dt);C.updateProjectionMatrix();
  sky(dt,T);
  $('hit').style.display=inCar?'none':'flex';$('score').textContent=score;$('stars').textContent='\u2605'.repeat(Math.floor(heat))+'\u2606'.repeat(3-Math.floor(heat));
  const bi=Math.round(T.position.x/40),bj=Math.round(T.position.z/40);$('dist').textContent=dist(bi,bj)+' \u2022 '+jamWIB()+' WIB';
  $('spd').textContent=Math.abs(inCar?v:sp)*3.6|0;$('msg').style.display=msgT>0?'block':'none';$('msg').textContent=msg;
  const h=T.rotation.y,co=Math.cos(h),si=Math.sin(h),s=.5,px=T.position.x,pz=T.position.z;
  X.setTransform(1,0,0,1,0,0);X.clearRect(0,0,120,120);
  X.setTransform(-s*co,-s*si,s*si,-s*co,60+s*co*px-s*si*pz,60+s*si*px+s*co*pz);
  X.fillStyle='#2f7fb0';X.fillRect(-EDGE-10,-(EDGE+85),2*(EDGE+10),90);X.fillStyle='#7a8aa0';for(const q of BU)X.fillRect(q.x-q.r,q.z-q.r,q.r*2,q.r*2);
  X.fillStyle='#ffd23a';for(const q of LM)X.fillRect(q[0]-5,q[1]-5,10,10);X.fillStyle='#fd2';for(const g of TR)X.fillRect(g.position.x-3,g.position.z-3,6,6);
  X.fillStyle='#38f';for(const g of PO)if(g.visible)X.fillRect(g.position.x-4,g.position.z-4,8,8);
  X.setTransform(1,0,0,1,0,0);X.fillStyle='#fff';X.beginPath();X.arc(60,60,4,0,6.3);X.fill();
  const lv=mode=='menu'||mode=='play'||mode=='pause';for(const l of LB){const q=l.v.clone().project(C);if(!lv||q.z>1||C.position.distanceTo(l.v)>EDGE-15){l.e.style.display='none';continue}l.e.style.display='block';l.e.style.left=(q.x*.5+.5)*innerWidth+'px';l.e.style.top=(-q.y*.5+.5)*innerHeight+'px'}
  R.render(S,C);requestAnimationFrame(tick)}
let svT=15,cy=0,pitch=.35,lt=null,lx=0,ly=0,lookT=0,punch=false,pT=0,stepT=0,crashT=0,trafT=4,cityT=6,npcStepT=1;
const bx=(g,x,z,r)=>{const hw=g.userData.hw||1.1,hl=g.userData.hl||2.3,dx=x-g.position.x,dz=z-g.position.z,s=Math.sin(g.rotation.y),c=Math.cos(g.rotation.y);return Math.abs(dx*s+dz*c)<hl+r&&Math.abs(dx*c-dz*s)<hw+r};
const vb=(x,z,r)=>{for(const g of TR)if(g.visible&&bx(g,x,z,r))return g;for(const g of PO)if(g.visible&&bx(g,x,z,r))return g;if(!inCar&&bx(car,x,z,r))return car;return null};
document.addEventListener('touchstart',e=>{if(mode!='play'||lt!==null)return;for(const t of e.changedTouches){if(t.target.closest&&t.target.closest('#joy,.b,.scr'))continue;lt=t.identifier;lx=t.clientX;ly=t.clientY;break}},{passive:false});
document.addEventListener('touchmove',e=>{for(const t of e.changedTouches){if(t.identifier!==lt)continue;e.preventDefault();cy-=(t.clientX-lx)*.006;pitch=Math.max(.05,Math.min(1.2,pitch+(t.clientY-ly)*.004));lx=t.clientX;ly=t.clientY;lookT=1.5}},{passive:false});
const le=e=>{for(const t of e.changedTouches)if(t.identifier===lt)lt=null};document.addEventListener('touchend',le);document.addEventListener('touchcancel',le);
$('hit').addEventListener('touchstart',e=>{e.preventDefault();if(!inCar&&mode=='play'&&pT<=0){punch=true;pT=.3;SFX.play('punch')}});
// Ringkasan dunia untuk cek cepat (dipakai uji headless & manual di konsol).
window.infoDunia=()=>({bangunan:BU.length,terjebak:hit(P.position.x,P.position.z,.5),pos:[+P.position.x.toFixed(2),+P.position.z.toFixed(2)],menara:menaraTerpasang,npc:PD.length,anak:PD.filter(m=>m.userData.id==='ped_a1').length,kendaraan:TR.length,tampil:TR.filter(g=>g.visible).length,sisi:DUNIA.sisi,panggilan:R.info.render.calls,segitiga:R.info.render.triangles,tekstur:R.info.memory.textures,geometri:R.info.memory.geometries});
window.AP=()=>{const hi=ST.g>0;R.setPixelRatio(hi?Math.min(devicePixelRatio,2):1);R.setSize(innerWidth,innerHeight);R.shadowMap.enabled=hi;sun.castShadow=hi;S.traverse(o=>{if(o.material)[].concat(o.material).forEach(m=>m.needsUpdate=true)});S.fog.far=[EDGE-50,EDGE+20,EDGE+140][ST.f];S.fog.near=S.fog.far*.3;TR.forEach((g,k)=>g.visible=k<[Math.round(MAX_LALULINTAS*.36),Math.round(MAX_LALULINTAS*.67),MAX_LALULINTAS][ST.t]);mm.style.display=ST.m?'':'none'};
AP();requestAnimationFrame(tick);
}

const vd=$('vid');vd.onplaying=()=>{vp=true;vd.style.display='block';$('sp').style.display='none'};vd.onended=toLoad;vd.onerror=()=>{};
if(vd.play)try{vd.play().catch(()=>{})}catch(e){}
setTimeout(()=>{if(!vp)toLoad()},5800);show('splash');

Object.assign(window,{show,startPlay,pauseGame,resumeGame,toMenu,openSet,chg,showStats,showProfil,bk,back,toLoad});
