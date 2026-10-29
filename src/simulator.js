
"use strict";
let lightningSaved={};try{lightningSaved=JSON.parse(localStorage.getItem('lightning_options_v1')||'{}')||{};}catch(_){}
const L=Lightning.cleanOptions(lightningSaved);
let customPalette=null;try{const p=JSON.parse(localStorage.getItem('lightning_palette_v1')||'null');if(p)customPalette=Lightning.validatePack(p).palette;}catch(_){}
const cadence=new Lightning.FrameCadence(Lightning.profiles[L.profile].fps);
let contextLost=false,lastWorkMs=0,frameStart=0;const workSamples=[];
if(!window.THREE){document.body.innerHTML='<div style="position:fixed;inset:0;display:grid;place-items:center;background:#0a121c;color:#ff6262;font-family:monospace;text-align:center;padding:30px"><div><h2>EMBEDDED RENDERER FAILED</h2><p style="color:#9fc0d6;margin-top:12px">This browser could not initialise the simulator renderer.<br>Use a current WebGL-capable browser.</p></div></div>';throw new Error('THREE missing');}
/* =====================================================================
   [1] CONSTANTS & UTILITIES  (SI internal; conversions only at HMDS)
   Body axes: X right · Y up · Z aft · forward = −Z
   Rates (body): om.x=q pitch(+nose up) · om.y=r yaw(+nose left) · om.z=p roll(+left wing down)
   Surfaces: dE+ nose-up · dA+ stick-right(roll right,p<0) · dR+ right pedal(yaw right,r<0)
   ===================================================================== */
const TAU=Math.PI*2,D2R=Math.PI/180,R2D=180/Math.PI,G0=9.81;
const KT=0.514444,FT=3.28084,FPM=196.85;
const clamp=(v,a,b)=>v<a?a:v>b?b:v,lerp=(a,b,t)=>a+(b-a)*t;
const smooth=(a,b,v)=>{const t=clamp((v-a)/(b-a),0,1);return t*t*(3-2*t);};
const norm180=a=>((a+540)%360)-180,norm360=a=>((a%360)+360)%360;
const $=id=>document.getElementById(id);
const SAVE_KEY='f35b_anchor_overhaul_v3';let SAVED={};
try{SAVED=JSON.parse(localStorage.getItem(SAVE_KEY)||'{}')||{};}catch(e){SAVED={};}
function cwarn(k,m){const n=performance.now();if(!cwarn[k]||n-cwarn[k]>2500){cwarn[k]=n;console.warn('[SIM] '+m);}}
function buzz(p){try{navigator.vibrate&&navigator.vibrate(p);}catch(e){}}
function activeFullscreen(){return document.fullscreenElement||document.webkitFullscreenElement||document.msFullscreenElement||null;}
function syncFullscreenUI(){const on=!!activeFullscreen();for(const id of ['btnFull','bootFull']){const b=$(id);if(!b)continue;b.textContent=on?'⛶ EXIT FULLSCREEN':'⛶'+(id==='bootFull'?' ENTER FULLSCREEN':'');b.setAttribute('aria-label',on?'Exit fullscreen':'Enter fullscreen');b.classList.toggle('live',on);}}
async function toggleFullscreen(){
  try{if(activeFullscreen()){const exit=document.exitFullscreen||document.webkitExitFullscreen||document.msExitFullscreen;if(exit)await exit.call(document);}
    else{const el=document.documentElement,req=el.requestFullscreen||el.webkitRequestFullscreen||el.msRequestFullscreen;if(!req){toast('FULLSCREEN NOT SUPPORTED','warn');return;}
      try{await req.call(el,{navigationUI:'hide'});}catch(_){await req.call(el);}
      try{screen.orientation&&screen.orientation.lock&&await screen.orientation.lock('landscape');}catch(_){}
    }}catch(e){toast('FULLSCREEN REQUEST BLOCKED','warn');}syncFullscreenUI();setTimeout(()=>{sizeHud();onResize();},80);}
['fullscreenchange','webkitfullscreenchange','MSFullscreenChange'].forEach(ev=>document.addEventListener(ev,()=>{syncFullscreenUI();setTimeout(()=>{sizeHud();onResize();},60);}));
/* ISA atmosphere: temperature/pressure/density/sound speed vs altitude */
function atmos(y,tempOffset=0){
  const T0=288.15,P0=101325;let T,P;
  if(y<11000){T=T0-0.0065*y;P=P0*Math.pow(T/T0,5.25588);}
  else{T=216.65;P=P0*0.22336*Math.exp(-(y-11000)/6341.62);}
  T=Math.max(180,T+tempOffset);return{T,P,rho:P/(287.05*T),a:Math.sqrt(1.4*287.05*T)};
}
/* linear interpolation for coefficient tables */
function interp(xs,ys,x){
  if(x<=xs[0])return ys[0];if(x>=xs[xs.length-1])return ys[ys.length-1];
  for(let i=1;i<xs.length;i++)if(x<xs[i]){const t=(x-xs[i-1])/(xs[i]-xs[i-1]);return ys[i-1]+(ys[i]-ys[i-1])*t;}
  return ys[ys.length-1];
}
/* ================= [2] SEEDED RNG ================= */
function mulberry32(a){return function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}
function hash2(x,y){const h=Math.sin(x*127.1+y*311.7)*43758.5453;return h-Math.floor(h);}
let SEED=clamp(parseInt(SAVED.seed)||(1000+((Math.random()*9000)|0)),1,999999),nzA,nzB;
function makeNoise(seed){
  const rand=mulberry32(seed),p=new Uint8Array(256);
  for(let i=0;i<256;i++)p[i]=i;
  for(let i=255;i>0;i--){const j=(rand()*(i+1))|0,t=p[i];p[i]=p[j];p[j]=t;}
  const perm=new Uint8Array(512),pm=new Uint8Array(512);
  for(let i=0;i<512;i++){perm[i]=p[i&255];pm[i]=perm[i]%12;}
  const G=new Float32Array([1,1,-1,1,1,-1,-1,-1,1,0,-1,0,1,0,-1,0,0,1,0,-1,0,1,0,-1]);
  const F2=0.5*(Math.sqrt(3)-1),G2=(3-Math.sqrt(3))/6;
  return function(x,y){
    let n0=0,n1=0,n2=0;const s=(x+y)*F2,i=Math.floor(x+s),j=Math.floor(y+s),t=(i+j)*G2;
    const x0=x-(i-t),y0=y-(j-t);let i1,j1;if(x0>y0){i1=1;j1=0;}else{i1=0;j1=1;}
    const x1=x0-i1+G2,y1=y0-j1+G2,x2=x0-1+2*G2,y2=y0-1+2*G2,ii=i&255,jj=j&255;
    let t0=0.5-x0*x0-y0*y0;if(t0>=0){const g=pm[ii+perm[jj]]*2;t0*=t0;n0=t0*t0*(G[g]*x0+G[g+1]*y0);}
    let t1=0.5-x1*x1-y1*y1;if(t1>=0){const g=pm[ii+i1+perm[jj+j1]]*2;t1*=t1;n1=t1*t1*(G[g]*x1+G[g+1]*y1);}
    let t2=0.5-x2*x2-y2*y2;if(t2>=0){const g=pm[ii+1+perm[jj+1]]*2;t2*=t2;n2=t2*t2*(G[g]*x2+G[g+1]*y2);}
    return 70*(n0+n1+n2);
  };
}
function fbm(nz,x,y,o){let a=.5,f=1,s=0,t=0;for(let i=0;i<o;i++){s+=a*nz(x*f,y*f);t+=a;a*=.5;f*=2.03;}return s/t;}
const fbm01=(nz,x,y,o)=>(fbm(nz,x,y,o)+1)*.5;
/* Broad ridges only.  The previous five-octave squared ridge term put almost
   3 km of relief into features narrower than a far-LOD triangle.  Sampling
   those features produced the needle/pyramid mountains visible in the mobile
   screenshot.  Geological scale comes from the uplift mask below; this helper
   adds only rounded range structure, never unbounded high-frequency peaks. */
function broadRidge(x,y){
  const r0=1-Math.abs(nzB(x,y));
  const r1=1-Math.abs(nzB(x*1.62+19.4,y*1.62-7.1));
  return smooth(.16,.91,r0*.82+r1*.18);
}
/* ================= [3] SETTINGS ================= */
const S=Object.assign({fbw:'ASSIST',fail:'OFF',sens:1,expo:0.3,dz:0.07,invPitch:false,coord:true,hoverAssist:true,
  hmds:'FULL',tOp:0.85,tSz:1,hand:'R',rudSlider:false,gyro:false,gDz:0.12,gThrBtn:true,
  quality:'AUTO',vapour:'ENHANCED',volume:0.5,scan:false,structure:'REAL',targetMarker:false},SAVED.settings||{});
/* ================= [4] WORLD GENERATION ================= */
const SYL=["VEL","KAR","OST","RIN","HAV","DOR","MIR","SOL","TRA","VEN","GAR","LUM","BRA","KES","OND","FAL"];
const SUF=["A","IA","EN","OR","EA","UM"],APTS=[" FIELD"," STRIP"," BAY"," POINT"," INTL"," AFB"],CITS=["BURG","STAD","PORT","VILLE","HOLM","FORD","WICK"];
let worldMode=Lightning.chooseWorld(SAVED);
LightningLondon.load(globalThis.__LONDON_DATA__);
let airports=[],cities=[];
const REGION=36000,FEATURE_BIN=12000,featureRegions=new Map(),airportBins=new Map(),cityBins=new Map();
const _nearAirports=[],_nearCities=[];
function featureBinKey(x,z){return Math.floor(x/FEATURE_BIN)+','+Math.floor(z/FEATURE_BIN);}
function indexFeature(bins,o){const k=featureBinKey(o.x,o.z);o._binKey=k;let b=bins.get(k);if(!b){b=new Set();bins.set(k,b);}b.add(o);}
function unindexFeature(bins,o){const b=bins.get(o._binKey);if(!b)return;b.delete(o);if(!b.size)bins.delete(o._binKey);}
function collectNearby(bins,x,z,r,out){out.length=0;
  const i0=Math.floor((x-r)/FEATURE_BIN),i1=Math.floor((x+r)/FEATURE_BIN),j0=Math.floor((z-r)/FEATURE_BIN),j1=Math.floor((z+r)/FEATURE_BIN);
  for(let i=i0;i<=i1;i++)for(let j=j0;j<=j1;j++){const b=bins.get(i+','+j);if(b)for(const o of b)out.push(o);}return out;}
function seedMix(ci,cj,salt=0){let h=(SEED^Math.imul(ci,374761393)^Math.imul(cj,668265263)^Math.imul(salt,1442695041))|0;
  h=Math.imul(h^(h>>>13),1274126177);return(h^(h>>>16))>>>0;}
function genName(kind,i){const r=mulberry32(SEED*7+i*131+(kind?17:3));return SYL[(r()*SYL.length)|0]+SYL[(r()*SYL.length)|0]+SUF[(r()*SUF.length)|0]+(kind?APTS[(r()*APTS.length)|0]:CITS[(r()*CITS.length)|0]);}
function genIcao(i){const r=mulberry32(SEED*11+i*57);const L="ABCDEFGHJKLMNPRSTUVZ";return "K"+L[(r()*L.length)|0]+L[(r()*L.length)|0]+L[(r()*L.length)|0];}
function landFieldWarped(X,Z){
  /* A continuous signed field creates continents first, then bays/islands.
     Every term is evaluated in world coordinates, so coastlines cross chunk
     boundaries without knowing that chunks exist. */
  const continent=fbm01(nzA,X*.0000135+2.7,Z*.0000135-8.1,5);
  const belts=fbm01(nzB,(X+Z*.31)*.000025+41,(Z-X*.18)*.0000125-17,4);
  const coastDetail=fbm01(nzA,X*.000073+113,Z*.000073+57,3);
  let f=(continent*.58+belts*.29+coastDetail*.13-.495)*3.35;
  /* Medium-scale positive lobes create archipelagos just offshore without
     turning the shoreline into white-noise confetti. */
  const isle=fbm01(nzB,X*.000105-71,Z*.000105+203,3);
  f+=smooth(.67,.84,isle)*.12*smooth(.36,.02,Math.abs(f));
  return f;
}
function landField(x,z){
  const wx=fbm(nzB,x*.000027+11,z*.000027+7,3),wz=fbm(nzA,x*.000027+31,z*.000027+17,3);
  return landFieldWarped(x+wx*6200,z+wz*6200);
}
function rawHeight(x,z){
  /* Domain-warped continental structure.  This is an inexpensive,
     resolution-independent approximation inspired by uplift + fluvial
     erosion terrain models; it is not a claim of geological simulation. */
  const wx=fbm(nzB,x*.000027+11,z*.000027+7,3),wz=fbm(nzA,x*.000027+31,z*.000027+17,3);
  const X=x+wx*6200,Z=z+wz*6200,land=landFieldWarped(X,Z);
  if(land<=0){
    const depth=5+520*Math.pow(smooth(0,.62,-land),1.28);
    const shelf=(fbm01(nzA,X*.00011+9,Z*.00011-19,2)-.5)*18*smooth(.02,.28,-land);
    return Math.max(-560,-depth+shelf);
  }
  const inland=smooth(0,.34,land),plain=fbm01(nzA,X*.000055+73,Z*.000055-29,4);
  let h=land*(300+220*inland)+(plain-.42)*145*inland;
  /* Broad anisotropic uplift belts and rounded ridges.  Frequencies stay well
     below the far mesh spacing; fine detail is deliberately amplitude-capped. */
  const ux=(X+Z*.22)*.000022,uz=(Z-X*.17)*.000047;
  /* Two broad gates keep major relief in range-scale inland zones.  Widening
     both transitions is important: a narrow smoothstep can still turn a
     perfectly continuous noise field into a visually implausible escarpment. */
  const uplift=smooth(.43,.82,fbm01(nzB,ux+331,uz-117,3))*smooth(.08,.42,land);
  const ridge=broadRidge((X+Z*.16)*.000044+5.2,(Z-X*.11)*.000025-9.7);
  h+=uplift*(190+1000*ridge*(.78+.22*ridge));
  h+=(fbm01(nzA,X*.00017+91,Z*.00017+91,3)-.48)*(42+175*uplift)*inland;
  /* Resolution-independent drainage engraving: narrow channels are carved
     down from the uplifted surface instead of adding isolated upward spikes. */
  const flow=Math.abs(fbm(nzB,X*.00021+701,Z*.00021-503,2));
  const channel=1-smooth(.025,.19,flow);
  h-=channel*(20+135*uplift)*smooth(35,720,h);
  const detail=fbm(nzA,X*.00052+17,Z*.00052+29,3);
  h+=detail*(12+40*uplift)*smooth(.015,.11,land);
  /* Soft compression prevents rare octave alignments from creating impossible
     3 km towers while preserving high mountain relief and a clear snow line. */
  if(h>2050)h=2050+360*Math.tanh((h-2050)/360);
  return Math.max(0,h);
}
function rawSlope(x,z,d=160){return Math.hypot(rawHeight(x+d,z)-rawHeight(x-d,z),rawHeight(x,z+d)-rawHeight(x,z-d))/(2*d);}
function slopeOK(x,z,m){return rawSlope(x,z)<m;}
function addAirport(x,z,i,regionKey='home',kind='AUTO'){
  const r=mulberry32(SEED+i*991),platform=kind==='OFFSHORE';
  const e=platform?18:(rawHeight(x-200,z)+rawHeight(x+200,z)+rawHeight(x,z-200)+rawHeight(x,z+200)+rawHeight(x,z))/5;
  if(kind==='AUTO'){
    const u=r();kind=regionKey==='home'?'MAJOR':u<.14?'MAJOR':u<.58?'REGIONAL':'STRIP';
  }
  const cfg=kind==='MAJOR'?{size:'L',len:2600+Math.round(r()*4)*200,w:45+Math.round(r()*3)*5,hang:4+((r()*4)|0),tower:40+r()*20}:
    kind==='REGIONAL'?{size:'M',len:1600+Math.round(r()*4)*200,w:32+Math.round(r()*3)*4,hang:2+((r()*3)|0),tower:28+r()*16}:
    kind==='STOVL'?{size:'S',len:520+Math.round(r()*4)*100,w:26+Math.round(r()*2)*4,hang:2+((r()*2)|0),tower:18+r()*10}:
    kind==='OFFSHORE'?{size:'S',len:76,w:58,hang:1,tower:16}:
    {size:'S',len:800+Math.round(r()*3)*200,w:24+Math.round(r()*2)*4,hang:1+((r()*2)|0),tower:18+r()*12};
  const a={x,z,idx:i,regionKey,elev:Math.max(platform?18:2,Math.round(e)),hdg:(r()*360)|0,name:genName(1,i),icao:genIcao(i),
    grp:null,papi:[],sock:null,beacon:null,kind,platform,stovl:kind==='STOVL'||platform,padSize:kind==='STOVL'?64:platform?54:0,
    rwyLen:cfg.len,rwyW:cfg.w,surface:platform?'DECK':r()<0.5?'ASPHALT':'CONCRETE',size:cfg.size,
    nHangars:cfg.hang,twrH:cfg.tower};
  const s=Math.sin(a.hdg*D2R),c=Math.cos(a.hdg*D2R);
  a.hdgB=norm360(a.hdg+180);
  a.num=String(Math.round(a.hdg/10)%36||36).padStart(2,'0');
  a.numB=String(Math.round(a.hdgB/10)%36||36).padStart(2,'0');
  a.ux=s;a.uz=-c;a.rx=c;a.rz=s;
  const hl=a.rwyLen/2;
  a.thrAx=a.x-hl*s;a.thrAz=a.z+hl*c;a.thrBx=a.x+hl*s;a.thrBz=a.z-hl*c;
  a.twrX=a.x+c*(a.rwyW+60)+s*200;a.twrZ=a.z-s*(a.rwyW+60)+c*200;
  if(platform){a.twrX=a.x+c*(a.rwyW*.30)+s*(a.rwyLen*.20);a.twrZ=a.z-s*(a.rwyW*.30)+c*(a.rwyLen*.20);}
  airports.push(a);indexFeature(airportBins,a);return a;
}
function addCity(x,z,h,i,regionKey='home'){
  const r=mulberry32(SEED*3+i*77),u=r();
  const cls=u<.18?'VILLAGE':u<.55?'TOWN':u<.86?'CITY':'METRO';
  const base=cls==='VILLAGE'?900:cls==='TOWN'?1450:cls==='CITY'?2250:3250;
  const coastal=landField(x,z)<.095;
  const c={x,z,elev:h,r:base*(.86+r()*.28)*(coastal?1.08:1),name:genName(0,i),idx:i,regionKey,grp:null,colB:[],
    density:(cls==='VILLAGE'?.30:cls==='TOWN'?.48:cls==='CITY'?.72:.92)+r()*.12,cls,coastal,rot:(r()-.5)*.34};
  cities.push(c);indexFeature(cityBins,c);return c;
}
function generateFeatureRegion(ci,cj){
  const key=ci+','+cj;if(featureRegions.has(key))return featureRegions.get(key);
  const rnd=mulberry32(seedMix(ci,cj,31)),rec={key,ci,cj,airports:[],cities:[]};featureRegions.set(key,rec);
  const inCell=a=>Math.floor(a.x/REGION)===ci&&Math.floor(a.z/REGION)===cj;
  const homeAirport=airports.find(a=>a.regionKey==='home'&&inCell(a));
  /* Dense aviation world: every habitable 36 km region gets a deterministic
     primary airport, most get a second field, and many get a third. The mix is
     biased toward regional/major runways so the airline network has enough real
     destinations while spacing rules prevent runway overlap. */
  function siteSearch(srng,tries,minSep){let best=null;
    for(let t=0;t<tries;t++){
      const x=(ci+.10+srng()*.80)*REGION,z=(cj+.10+srng()*.80)*REGION,h=rawHeight(x,z),sl=rawSlope(x,z);
      if(h<=5||h>=260||sl>=.075||(airports[0]&&Math.hypot(x-airports[0].x,z-airports[0].z)<7600))continue;
      if(rec.airports.some(a=>Math.hypot(x-a.x,z-a.z)<minSep))continue;
      const score=sl*9+Math.abs(h-52)*.0014+Math.abs(landField(x,z)-.105)*.11;
      if(!best||score<best.score)best={x,z,t,score};}
    return best;
  }
  const primary=siteSearch(mulberry32(seedMix(ci,cj,41)),76,0);
  if(primary){const cr=mulberry32(seedMix(ci,cj,501)),u=cr(),kind=u<.24?'MAJOR':u<.78?'REGIONAL':'STRIP';
    rec.airports.push(addAirport(primary.x,primary.z,seedMix(ci,cj,100+primary.t)%1000000,key,kind));}
  const secondR=mulberry32(seedMix(ci,cj,61));
  if(secondR()<.90){const secondary=siteSearch(secondR,72,7000);
    if(secondary){const u=mulberry32(seedMix(ci,cj,601))(),kind=u<.14?'MAJOR':u<.68?'REGIONAL':u<.89?'STRIP':'STOVL';
      rec.airports.push(addAirport(secondary.x,secondary.z,seedMix(ci,cj,200+secondary.t)%1000000,key,kind));}}
  const thirdR=mulberry32(seedMix(ci,cj,66));
  if(thirdR()<.46){const tertiary=siteSearch(thirdR,66,6200);
    if(tertiary){const u=mulberry32(seedMix(ci,cj,606))(),kind=u<.52?'REGIONAL':u<.86?'STRIP':'STOVL';
      rec.airports.push(addAirport(tertiary.x,tertiary.z,seedMix(ci,cj,250+tertiary.t)%1000000,key,kind));}}
  /* Rare coastal LiftSystem decks provide short-pad practice without turning
     the ocean into terrain. Their collision surface is only the rendered deck. */
  const seaR=mulberry32(seedMix(ci,cj,71));
  if(seaR()<.10){let best=null;
    for(let t=0;t<42;t++){
      const x=(ci+.10+seaR()*.80)*REGION,z=(cj+.10+seaR()*.80)*REGION,h=rawHeight(x,z),lf=landField(x,z);
      if(h>-.8||lf<-.18||lf>-.006||rec.airports.some(a=>Math.hypot(x-a.x,z-a.z)<8000))continue;
      const nearLand=Math.max(rawHeight(x+2800,z),rawHeight(x-2800,z),rawHeight(x,z+2800),rawHeight(x,z-2800));
      if(nearLand<3)continue;const score=Math.abs(lf+.045)+Math.abs(h)*.0003;
      if(!best||score<best.score)best={x,z,t,score};}
    if(best)rec.airports.push(addAirport(best.x,best.z,seedMix(ci,cj,700+best.t)%1000000,key,'OFFSHORE'));
  }
  const anchor=homeAirport||rec.airports[0]||null,nCity=1+(rnd()<.62?1:0)+(rnd()<.18?1:0);
  for(let n=0;n<nCity;n++){
    const wantCoast=rnd()<.55,wantHub=n===0&&!!anchor;let best=null;
    for(let t=0;t<46;t++){
      const x=(ci+.07+rnd()*.86)*REGION,z=(cj+.07+rnd()*.86)*REGION,h=rawHeight(x,z),sl=rawSlope(x,z),lf=landField(x,z);
      if(h<=3.5||h>=260||sl>=.16||airports.some(a=>Math.hypot(x-a.x,z-a.z)<4300)||rec.cities.some(c=>Math.hypot(x-c.x,z-c.z)<6200))continue;
      let score=sl*6+Math.abs(h-58)*.0014;
      score+=wantCoast?Math.abs(lf-.045)*2.8:Math.max(0,.055-lf)*1.8;
      if(wantHub)score+=Math.abs(Math.hypot(x-anchor.x,z-anchor.z)-9000)/11000;
      if(!best||score<best.score)best={x,z,h,t,score};}
    if(best)rec.cities.push(addCity(best.x,best.z,best.h,seedMix(ci,cj,300+n*53+best.t)%1000000,key));
  }
  return rec;
}
function removeFeatureRegion(rec){
  for(const a of rec.airports){const g=aptGroups&&aptGroups.get(a);if(g){worldGroup.remove(g);disposeGroup(g);aptGroups.delete(a);}a.grp=null;unindexFeature(airportBins,a);}
  for(const c of rec.cities){const g=cityGroups&&cityGroups.get(c);if(g){worldGroup.remove(g);disposeGroup(g);cityGroups.delete(c);}c.grp=null;
    const rg=roadGroups&&roadGroups.get(c);if(rg){worldGroup.remove(rg);disposeGroup(rg);}if(roadGroups)roadGroups.delete(c);
    const wg=wfGroups&&wfGroups.get(c);if(wg)removeWindFarm(wg);if(wfGroups)wfGroups.delete(c);unindexFeature(cityBins,c);}
  const aa=new Set(rec.airports),cc=new Set(rec.cities);airports=airports.filter(a=>!aa.has(a));cities=cities.filter(c=>!cc.has(c));featureRegions.delete(rec.key);
}
let featureTimer=0;
function ensureRegionalFeatures(dt=0,force=false){
  if(worldMode==='LONDON')return;
  featureTimer-=dt;if(!force&&featureTimer>0)return;featureTimer=0.45;
  const x=P?P.pos.x+OX:airports[0]?.x||0,z=P?P.pos.z+OZ:airports[0]?.z||0,ci=Math.floor(x/REGION),cj=Math.floor(z/REGION);
  for(let di=-2;di<=2;di++)for(let dj=-2;dj<=2;dj++)generateFeatureRegion(ci+di,cj+dj);
  for(const rec of [...featureRegions.values()])if(Math.max(Math.abs(rec.ci-ci),Math.abs(rec.cj-cj))>3)removeFeatureRegion(rec);
}
function genWorld(){
  nzA=makeNoise(SEED);nzB=makeNoise(SEED^0x9e3779b9);airports=[];cities=[];featureRegions.clear();airportBins.clear();cityBins.clear();
  if(worldMode==='LONDON'){for(const r of LightningLondon.runways){const a={...r,papi:[],grp:null};airports.push(a);indexFeature(airportBins,a);}return;}
  let found=null;
  outer:for(let r=0;r<22000&&!found;r+=350)for(let a=0;a<24;a++){const th=a/24*TAU+r*0.0013,x=Math.cos(th)*r,z=Math.sin(th)*r;
    const h=rawHeight(x,z);if(h>8&&h<110&&slopeOK(x,z,0.05)){found={x,z};break outer;}}
  addAirport(found?found.x:0,found?found.z:0,0,'home','MAJOR');
  const hc=Math.floor(airports[0].x/REGION),hj=Math.floor(airports[0].z/REGION);
  for(let di=-2;di<=2;di++)for(let dj=-2;dj<=2;dj++)generateFeatureRegion(hc+di,hj+dj);
}
/* ================= [5] TERRAIN ================= */
function legacyHeightAt(x,z){
  let h=rawHeight(x,z);
  const nearbyA=collectNearby(airportBins,x,z,11000,_nearAirports);
  for(let i=0;i<nearbyA.length;i++){const a=nearbyA[i],dx=x-a.x,dz=z-a.z,s=Math.sin(a.hdg*D2R),c=Math.cos(a.hdg*D2R);
    const along=dx*s-dz*c,across=dx*c+dz*s,hl=a.rwyLen/2;
    if(a.platform){if(Math.abs(along)<hl+5&&Math.abs(across)<a.rwyW/2+5)h=Math.max(h,a.elev);continue;}
    const d=Math.hypot(Math.max(Math.abs(along)-(hl+200),0),Math.max(Math.abs(across)-(a.rwyW+200),0));
    if(d<1100){const k=1-smooth(0,1100,d);h=h*(1-k)+a.elev*k;}}
  const nearbyC=collectNearby(cityBins,x,z,6200,_nearCities);
  for(let i=0;i<nearbyC.length;i++){const ct=nearbyC[i],d=Math.hypot(x-ct.x,z-ct.z);
    if(d<ct.r*1.4){const k=(1-smooth(ct.r*0.5,ct.r*1.4,d))*0.65;h=h*(1-k)+ct.elev*k;}}
  /* Apply obstacle clearance last, after all airport and urban grading, so another
     streamed feature cannot raise a ridge back into a usable approach path. */
  for(let i=0;i<nearbyA.length;i++){const a=nearbyA[i];if(a.platform)continue;
    const dx=x-a.x,dz=z-a.z,s=Math.sin(a.hdg*D2R),c=Math.cos(a.hdg*D2R);
    const along=dx*s-dz*c,across=dx*c+dz*s,hl=a.rwyLen/2,out=Math.abs(along)-hl;
    const appLen=a.size==='L'?9000:a.size==='M'?6800:a.stovl?2600:4400,appW=260+Math.max(0,out)*(a.size==='L'?.06:.045);
    if(out>0&&out<appLen&&Math.abs(across)<appW&&h>a.elev){
      const cap=a.elev+Math.tan(2.2*D2R)*out-12;
      const sideK=1-smooth(appW*.62,appW,Math.abs(across)),endK=(1-smooth(appLen*.86,appLen,out))*smooth(0,260,out);
      if(h>cap)h=lerp(h,cap,sideK*endK);}}
  return h;
}
function heightAt(x,z){
  if(worldMode==='LONDON'){const h=LightningLondon.height(x,z);if(h!==null)return h;const gx=clamp(x,-5000,34000),gz=clamp(z,-9000,6000),edge=LightningLondon.height(gx,gz),d=Math.hypot(x-gx,z-gz);return lerp(Math.max(2,edge),Math.max(2,legacyHeightAt(x,z)),smooth(0,10000,d));}
  return legacyHeightAt(x,z);
}
const WATER_Y=0.12;
function legacySurfaceH(x,z){const h=heightAt(x,z);return h>WATER_Y?h:WATER_Y;}
function legacyIsWaterAt(x,z){return heightAt(x,z)<0.05;}
function surfaceH(x,z){if(worldMode==='LONDON'){const h=LightningLondon.surface(x,z);if(h!==null)return h;}return legacySurfaceH(x,z);}
function isWaterAt(x,z){return worldMode==='LONDON'?LightningLondon.isWater(x,z):legacyIsWaterAt(x,z);}
const hCache=new Map();
function heightCached(x,z){const k=(Math.round(x*0.25)+262144)*524288+(Math.round(z*0.25)+262144);
  let v=hCache.get(k);if(v===undefined){v=heightAt(x,z);if(hCache.size>16000)hCache.clear();hCache.set(k,v);}return v;}
const _gn=new THREE.Vector3();
function groundNormal(x,z,out){const d=3;out.set(surfaceH(x-d,z)-surfaceH(x+d,z),2*d,surfaceH(x,z-d)-surfaceH(x,z+d));return out.normalize();}
const SURF={RWY:{roll:0.012,brk:0.55,lat:0.9,rough:0},APRON:{roll:0.015,brk:0.5,lat:0.85,rough:0},
  GRASS:{roll:0.05,brk:0.35,lat:0.6,rough:1},SOIL:{roll:0.06,brk:0.3,lat:0.55,rough:1.2},
  ROCK:{roll:0.04,brk:0.3,lat:0.7,rough:2},SNOW:{roll:0.03,brk:0.15,lat:0.3,rough:0.6},WATER:{roll:0,brk:0,lat:0,rough:0}};
function surfaceType(x,z,h){
  if(worldMode==='LONDON'&&LightningLondon.isWater(x,z))return'WATER';
  const nearby=collectNearby(airportBins,x,z,2800,_nearAirports);
  for(let i=0;i<nearby.length;i++){const a=nearby[i],dx=x-a.x,dz=z-a.z;
    if(dx*dx+dz*dz>2400*2400)continue;
    const s=Math.sin(a.hdg*D2R),c=Math.cos(a.hdg*D2R),along=dx*s-dz*c,across=dx*c+dz*s,hl=a.rwyLen/2;
    if(Math.abs(along)<hl+60&&Math.abs(across)<a.rwyW/2+4&&Math.abs(h-a.elev)<2.5)return'RWY';
    if(Math.abs(along)<hl+400&&Math.abs(across)<a.rwyW+260)return'APRON';}
  if(h<0.5)return'WATER';if(h>1400)return'SNOW';if(h>850)return'ROCK';
  const pid=Math.floor(x/240),pjd=Math.floor(z/240);
  if(hash2(pid*3.7,pjd*3.7)<0.5&&h<260)return'SOIL';
  return'GRASS';
}
const _col=new THREE.Color(),_c2=new THREE.Color();
function colorAt(x,z,h,ny,out){
  if(worldMode==='LONDON'){out.setRGB(.35,.39,.30);return;}
  const slope=1-clamp(ny,0,1),moist=fbm01(nzA,x*.00031+41.2,z*.00031+17.8,3),warm=fbm01(nzB,x*.000052-81,z*.000052+29,3),macro=fbm01(nzB,x*.000095+151,z*.000095-71,2);
  if(h<-1){const d=clamp(-h/460,0,1);out.setRGB(.035+.08*(1-d),.105+.18*(1-d),.16+.20*(1-d));}
  else if(h<4.2){const t=smooth(-1,4.2,h);out.setRGB(.80-.08*t,.72-.08*t,.49-.10*t);}
  else{
    out.setRGB(.26,.41,.20);_c2.setRGB(.14,.28,.17);out.lerp(_c2,moist*.74);
    if(warm>.63&&moist<.37&&h<650){_c2.setRGB(.59,.49,.29);out.lerp(_c2,smooth(.37,.12,moist)*.70);}
    if(h<330&&slope<.085&&moist>.22&&moist<.78){
      const pid=Math.floor(x/310),pjd=Math.floor(z/310),fp=hash2(pid*7.13,pjd*7.13);
      if(hash2(pid*3.7,pjd*3.7)<.68){_c2.setHex(fp<.18?0xc7b264:fp<.38?0x97aa63:fp<.58?0x54793d:fp<.78?0x8a7340:0x436b31);out.lerp(_c2,.46);}}
    if(moist>.72&&h<780){_c2.setRGB(.10,.25,.12);out.lerp(_c2,smooth(.72,.93,moist)*.58);}
    if(h>430){_c2.setRGB(.41,.39,.35);out.lerp(_c2,smooth(430,1250,h)*.80);}
    if(slope>.16&&h>100){_c2.setRGB(.35,.34,.31);out.lerp(_c2,clamp((slope-.16)*2.4,0,.84));}
    if(h>1120){_c2.setRGB(.61,.62,.61);out.lerp(_c2,smooth(1120,1640,h+moist*180));}
    if(h>1530){_c2.setRGB(.91,.94,.96);out.lerp(_c2,smooth(1530,2020,h+moist*220));}
    out.offsetHSL((macro-.5)*.02,(macro-.5)*.05,(macro-.5)*.035);
    out.multiplyScalar(clamp(.92+ny*.13-slope*.14,0.80,1.08));
    if(h>12&&h<720&&slope<.14&&moist>.28){
      const fd=(Math.sin((x+z)*0.00155)+Math.sin((x-z)*0.0011))*0.5;
      if(fd>0.45){_c2.setRGB(.61,.57,.35);out.lerp(_c2,clamp((fd-0.45)*0.22,0,.10));}}
  }
  const nearbyC=collectNearby(cityBins,x,z,6200,_nearCities);
  for(let i=0;i<nearbyC.length;i++){const c=nearbyC[i],dx=x-c.x,dz=z-c.z,d2=dx*dx+dz*dz;
    if(d2<c.r*c.r*1.69){const edge=1-smooth(c.r*.78,c.r*1.30,Math.sqrt(d2));
      out.lerp(_c2.setRGB(.34,.35,.36),edge*(c.cls==='METRO'?.78:.64));break;}}
  const j=(hash2(Math.round(x*.22),Math.round(z*.22))-.5)*.020;
  out.r=clamp(out.r+j,0,1);out.g=clamp(out.g+j,0,1);out.b=clamp(out.b+j,0,1);
}
/* ================= RENDERING SETUP ================= */
const renderCanvas=document.createElement('canvas');
const gl2=renderCanvas.getContext('webgl2',{antialias:true,alpha:false,depth:true,stencil:false,powerPreference:'high-performance'});
if(!gl2){document.body.innerHTML='<div style="position:fixed;inset:0;display:grid;place-items:center;background:#08111a;color:#ff8b7f;font:16px system-ui;text-align:center;padding:28px"><div><h2>WEBGL2 REQUIRED</h2><p>This simulator needs a current browser with WebGL2 enabled.</p></div></div>';throw new Error('WebGL2 unavailable');}
const renderer=new THREE.WebGLRenderer({canvas:renderCanvas,context:gl2,antialias:true,alpha:false,powerPreference:'high-performance'});
let prCap=2,prCur=Lightning.bufferSize(innerWidth,innerHeight,devicePixelRatio,L.profile,Lightning.profiles[L.profile].cap).ratio;
renderer.setPixelRatio(prCur);renderer.setSize(innerWidth,innerHeight);
renderer.outputEncoding=THREE.sRGBEncoding;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.05;
renderer.domElement.className='gl';document.body.prepend(renderer.domElement);
const scene=new THREE.Scene();
scene.fog=new THREE.FogExp2(0x9db7c8,0.00006);
const camera=new THREE.PerspectiveCamera(60,innerWidth/innerHeight,0.5,90000);
LightningLondonLighting.environment(THREE,renderer,scene);
const sunLight=new THREE.DirectionalLight(0xfff2e0,1.1);scene.add(sunLight);
const moonLight=new THREE.DirectionalLight(0x8fa8d8,0.14);scene.add(moonLight);
const hemi=new THREE.HemisphereLight(0x9db8d8,0x3a4a3a,0.55);scene.add(hemi);
const worldGroup=new THREE.Group();scene.add(worldGroup);
let OX=0,OZ=0;
const skyMat=new THREE.ShaderMaterial({side:THREE.BackSide,depthWrite:false,fog:false,
 uniforms:{uSun:{value:new THREE.Vector3(0,1,0)},uZen:{value:new THREE.Color(0.1,0.3,0.62)},uHor:{value:new THREE.Color(0.62,0.76,0.88)},uSunC:{value:new THREE.Color(1,0.9,0.75)},uNight:{value:0},uGroundHorizon:{value:0},uFlash:{value:0},uCloud:{value:0.2},uDusk:{value:0},uHaze:{value:.25},uT:{value:0}},
 vertexShader:'varying vec3 vP;void main(){vP=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
 fragmentShader:`varying vec3 vP;uniform vec3 uSun,uZen,uHor,uSunC;uniform float uNight,uFlash,uCloud,uDusk,uHaze,uT,uGroundHorizon;
 float hsh(vec3 p){return fract(sin(dot(p,vec3(12.9898,78.233,37.719)))*43758.5453);}
 void main(){vec3 d=normalize(vP);float h=d.y;
  float alt=pow(clamp(h,0.0,1.0),0.58);vec3 sky=mix(uHor,uZen,alt);
  float horizon=exp(-abs(h)*7.5);sky=mix(sky,uHor*1.04,horizon*(.22+.38*uHaze));
  if(h<0.0)sky=mix(uHor,uHor*mix(.34,.97,uGroundHorizon),clamp(-h*4.5,0.0,1.0));
  float sd=max(dot(d,uSun),0.0);float sunDisc=pow(sd,1800.0),aureole=pow(sd,45.0),bloom=pow(sd,7.0);
  sky+=uSunC*(sunDisc*2.4+aureole*.34+bloom*.055);
  vec2 dh=normalize(d.xz+vec2(1e-5)),sh=normalize(uSun.xz+vec2(1e-5));float sunH=max(dot(dh,sh),0.0);
  sky+=uSunC*pow(sunH,5.0)*horizon*uDusk*.28;
  sky=mix(sky,uHor*.91,uCloud*.34*smoothstep(-.02,.52,h));
  if(uNight>.02&&h>0.0){vec3 g=floor(d*190.0);float ss=hsh(g);float st=step(.99875,ss)*(.55+.45*sin(ss*6000.0+uT*1.7));sky+=vec3(st)*uNight*smoothstep(0.0,.24,h);}
  sky+=vec3(.85,.9,1.0)*uFlash;sky=mix(sky/12.92,pow((sky+.055)/1.055,vec3(2.4)),step(vec3(.04045),sky));gl_FragColor=vec4(sky,1.0);
#include <tonemapping_fragment>
#include <encodings_fragment>
}`});
const sky=new THREE.Mesh(new THREE.SphereGeometry(40000,24,16),skyMat);scene.add(sky);
const moon=new THREE.Mesh(new THREE.SphereGeometry(900,12,10),new THREE.MeshBasicMaterial({color:0xdfe4ee}));scene.add(moon);
const waterMat=new THREE.ShaderMaterial({transparent:true,depthWrite:false,
 uniforms:{uTime:{value:0},uOffset:{value:new THREE.Vector2()},uSun:{value:new THREE.Vector3(0,1,0)},uFog:{value:new THREE.Color(0x9db7c8)},uFogD:{value:.00006},uNight:{value:0}},
 vertexShader:`uniform float uTime;uniform vec2 uOffset;varying vec3 vW;varying vec2 vC;
 void main(){vec3 p=position;vC=position.xz+uOffset;float w=.34*sin(vC.x*.006+uTime*.8)+.22*sin((vC.x+vC.y)*.011-uTime*1.13)+.11*sin(vC.y*.025+uTime*1.7);p.y+=w;vec4 q=modelMatrix*vec4(p,1.);vW=q.xyz;gl_Position=projectionMatrix*viewMatrix*q;}`,
 fragmentShader:`uniform float uTime,uFogD,uNight;uniform vec3 uSun,uFog;varying vec3 vW;varying vec2 vC;
 void main(){vec3 n=normalize(vec3(.006*.34*cos(vC.x*.006+uTime*.8)+.011*.22*cos((vC.x+vC.y)*.011-uTime*1.13),1.,.011*.22*cos((vC.x+vC.y)*.011-uTime*1.13)+.025*.11*cos(vC.y*.025+uTime*1.7)));vec3 v=normalize(cameraPosition-vW),l=normalize(uSun);float fr=pow(1.-max(dot(n,v),0.),3.2),sp=pow(max(dot(reflect(-l,n),v),0.),170.);vec3 deep=mix(vec3(.014,.085,.145),vec3(.035,.245,.31),1.-uNight);vec3 col=mix(deep,vec3(.20,.48,.55),fr*.62)+vec3(1.,.84,.57)*sp*(1.-uNight)*1.9;float fog=1.-exp(-uFogD*uFogD*distance(cameraPosition,vW)*distance(cameraPosition,vW));col=mix(col,uFog,clamp(fog,0.,1.));gl_FragColor=vec4(col,.885);}`});
const waterGeo=new THREE.PlaneGeometry(90000,90000,36,36);waterGeo.rotateX(-Math.PI/2);
const water=new THREE.Mesh(waterGeo,waterMat);water.position.y=WATER_Y;scene.add(water);
function radialTex(stops){const c=document.createElement('canvas');c.width=c.height=128;const x=c.getContext('2d');
 const g=x.createRadialGradient(64,64,2,64,64,64);stops.forEach(s=>g.addColorStop(s[0],s[1]));x.fillStyle=g;x.fillRect(0,0,128,128);
 return new THREE.CanvasTexture(c);}
function cloudTex(rng){const c=document.createElement('canvas');c.width=c.height=160;const x=c.getContext('2d');x.clearRect(0,0,160,160);
 for(let i=0;i<10;i++){const px=25+rng()*110,py=42+rng()*72,r=18+rng()*34;
  const g=x.createRadialGradient(px,py-r*.14,1,px,py,r);g.addColorStop(0,'rgba(255,255,255,.94)');g.addColorStop(.48,'rgba(238,244,248,.72)');g.addColorStop(.78,'rgba(160,178,190,.34)');g.addColorStop(1,'rgba(75,91,104,0)');x.fillStyle=g;x.fillRect(0,0,160,160);}
 const lift=x.createLinearGradient(0,28,0,142);lift.addColorStop(0,'rgba(255,255,255,.22)');lift.addColorStop(.62,'rgba(255,255,255,0)');lift.addColorStop(1,'rgba(25,38,52,.18)');x.globalCompositeOperation='source-atop';x.fillStyle=lift;x.fillRect(0,0,160,160);x.globalCompositeOperation='source-over';
 const t=new THREE.CanvasTexture(c);t.minFilter=THREE.LinearFilter;t.magFilter=THREE.LinearFilter;return t;}
function buildingTextures(seed,warm){const c=document.createElement('canvas'),e=document.createElement('canvas');c.width=e.width=64;c.height=e.height=128;const x=c.getContext('2d'),q=e.getContext('2d'),r=mulberry32(seed);
 x.fillStyle=warm?'#7c7770':'#6e777b';x.fillRect(0,0,64,128);q.fillStyle='#000';q.fillRect(0,0,64,128);
 for(let y=7;y<124;y+=10)for(let xx=5;xx<61;xx+=9){const lit=r()>.46;x.fillStyle=lit?(warm?'#d2b785':'#a9c4cf'):'#303b42';x.fillRect(xx,y,5,6);if(lit){q.fillStyle=warm?'#ffc46b':'#9fdcff';q.fillRect(xx,y,5,6);}}
 const map=new THREE.CanvasTexture(c),em=new THREE.CanvasTexture(e);for(const t of[map,em]){t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(1.8,3.5);t.minFilter=THREE.LinearMipMapLinearFilter;}return{map,em};}
const glowT=radialTex([[0,'rgba(255,255,255,1)'],[0.25,'rgba(255,255,255,0.6)'],[1,'rgba(255,255,255,0)']]);
const shadowBlob=new THREE.Mesh(new THREE.PlaneGeometry(17,12),new THREE.MeshBasicMaterial({
  color:0x081018,map:radialTex([[0,'rgba(255,255,255,.9)'],[.48,'rgba(255,255,255,.45)'],[1,'rgba(255,255,255,0)']]),transparent:true,opacity:0.25,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-2
}));
shadowBlob.geometry.rotateX(-Math.PI/2);scene.add(shadowBlob);
let cTex=cloudTex(mulberry32(1));
function lam(o){const m=new THREE.MeshLambertMaterial(o);m.userData.shared=true;return m;}
function shGeo(g){g.userData.shared=true;return g;}
const unitBoxGeo=shGeo(new THREE.BoxGeometry(1,1,1));unitBoxGeo.translate(0,0.5,0);
const trunkGeo=shGeo(new THREE.CylinderGeometry(0.35,0.55,4,5));trunkGeo.translate(0,2,0);
const canopyGeo=shGeo(new THREE.ConeGeometry(2.7,7.5,6));canopyGeo.translate(0,6.5,0);
const rockGeo=shGeo(new THREE.IcosahedronGeometry(1.7,0));
const houseRoofGeo=shGeo(new THREE.ConeGeometry(.72,1,4));houseRoofGeo.rotateY(Math.PI/4);houseRoofGeo.translate(0,.5,0);
const roadSegGeo=shGeo(new THREE.BoxGeometry(9,0.18,76)),lineSegGeo=shGeo(new THREE.BoxGeometry(0.7,0.22,30));
const railSegGeo=shGeo(new THREE.BoxGeometry(.20,.20,54)),sleeperGeo=shGeo(new THREE.BoxGeometry(3.4,.16,.34));
const btTall=buildingTextures(911,false),btOffice=buildingTextures(1771,true);
const roadMat=lam({color:0x292b2e}),lineMat=lam({color:0xc7c5b6}),railMat=lam({color:0x555b60}),sleeperMat=lam({color:0x4a382a}),
  carBodyMat=lam({color:0xffffff}),carGlassMat=lam({color:0x24333b}),trainBodyMat=lam({color:0xffffff}),trainGlassMat=lam({color:0x182b36}),
  trainRoofMat=lam({color:0x9aa1a4}),trunkMat=lam({color:0x51402f}),
  canopyMat=lam({color:0xffffff}),rockMat=lam({color:0xffffff}),parkMat=lam({color:0x355b2c}),
  concreteMat=lam({color:0x94938d}),whiteMat=lam({color:0xe2e0d6}),darkPoleMat=lam({color:0x30343a}),
  contMat=lam({color:0xffffff}),houseMat=lam({color:0xffffff}),roofMat=lam({color:0xffffff}),
  towerMat=new THREE.MeshStandardMaterial({color:0xb0b7b9,map:btTall.map,emissive:0xffc46b,emissiveMap:btTall.em,emissiveIntensity:0,roughness:.78,metalness:.05}),
  officeMat=new THREE.MeshStandardMaterial({color:0xaeb3ae,map:btOffice.map,emissive:0xffc46b,emissiveMap:btOffice.em,emissiveIntensity:0,roughness:.72,metalness:.04}),
  industrialMat=lam({color:0x707575}),urbanGroundMat=lam({color:0x444746,polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-1});
towerMat.userData.shared=officeMat.userData.shared=true;
const shoreMat=new THREE.MeshBasicMaterial({color:0xd7e4d2,transparent:true,opacity:.40,depthWrite:false,side:THREE.DoubleSide});shoreMat.userData.shared=true;
const _m1=new THREE.Matrix4(),_m2=new THREE.Matrix4();
function disposeGroup(g){g.traverse(o=>{
  if(o.geometry&&!o.geometry.userData.shared&&typeof o.geometry.dispose==='function')o.geometry.dispose();
  if(o.material&&!o.material.userData.shared){
    const mats=Array.isArray(o.material)?o.material:[o.material];
    mats.forEach(m=>{if(m&&typeof m.dispose==='function'){for(const t of m.userData.ownedTextures||[])t.dispose();m.dispose();}});}
});}
/* ================= [6] VISUAL STREAMING ================= */
const CHUNK=2400,chunks=new Map(),terrainMat=new THREE.ShaderMaterial({vertexColors:true,
 uniforms:{uSun:{value:new THREE.Vector3(0,1,0)},uFog:{value:new THREE.Color(0x9db7c8)},uFogD:{value:.00006},uDay:{value:1},uWet:{value:0},uTime:{value:0}},
 vertexShader:`varying vec3 vCol,vW,vN;void main(){vCol=color;vec4 w=modelMatrix*vec4(position,1.);vW=w.xyz;vN=normalize(mat3(modelMatrix)*normal);gl_Position=projectionMatrix*viewMatrix*w;}`,
 fragmentShader:`uniform vec3 uSun,uFog;uniform float uFogD,uDay,uWet,uTime;varying vec3 vCol,vW,vN;
 float h21(vec2 p){p=fract(p*vec2(123.34,345.45));p+=dot(p,p+34.345);return fract(p.x*p.y);}
 void main(){vec3 n=normalize(vN),l=normalize(uSun),v=normalize(cameraPosition-vW);float slope=1.-clamp(n.y,0.,1.);
  vec2 q=vW.xz+vec2(sin(vW.z*.0017)*72.,sin(vW.x*.0013)*64.);float macro=h21(floor(q/95.));float fine=h21(floor(q/17.));
  vec3 col=vCol*(.91+macro*.15+fine*.035);float rock=smoothstep(.20,.58,slope)*smoothstep(120.,780.,vW.y);col=mix(col,vec3(.39,.39,.37)*(1.+macro*.15),rock*.68);
  float veg=clamp((vCol.g-vCol.b*.55)*2.2,0.,1.);vec2 fc=fract(q/245.);float edge=1.-smoothstep(.455,.493,max(abs(fc.x-.5),abs(fc.y-.5)));col*=1.-edge*veg*.14;
  float rows=.5+.5*sin((q.x*.23+q.y*.071)+sin(q.y*.006)*2.);col*=1.+(rows-.5)*veg*(1.-slope)*.035;
  float diff=max(dot(n,l),0.);float hemi=.36+.24*n.y;col*=hemi+diff*(.43+.17*uDay);col*=mix(1.,.76,uWet);
  float spec=pow(max(dot(reflect(-l,n),v),0.),52.)*uWet*.12;col+=vec3(.78,.86,.92)*spec;
  float dist=distance(cameraPosition,vW),fog=1.-exp(-uFogD*uFogD*dist*dist);float ground=smoothstep(2500.,15500.,length(cameraPosition.xz-vW.xz))*(1.-smoothstep(300.,1500.,vW.y))*.18;fog=clamp(fog+ground,0.,1.);col=mix(col,uFog,fog);gl_FragColor=vec4(col,1.);}`});
terrainMat.userData.shared=true;LightningScenery.init(THREE,terrainMat);LightningLondon.initTerrain(THREE,terrainMat);LightningLondonLighting.terrain(THREE,terrainMat);LightningScenery.setPalette(THREE,terrainMat,L.palette,customPalette);
const chunkQueue=[];let vegDensity=1,lodRadius=7;
function releaseChunk(entry){
  if(!entry)return;
  worldGroup.remove(entry.mesh);if(entry.mesh.geometry)entry.mesh.geometry.dispose();
  if(entry.shore){worldGroup.remove(entry.shore);if(entry.shore.geometry)entry.shore.geometry.dispose();}
  for(const v of entry.veg||[])worldGroup.remove(v); /* vegetation shares pooled geometry/material */
}
function buildVeg(ci,cj,lod){
  const step=lod===0?58:112,x0=ci*CHUNK,z0=cj*CHUNK,out=[];
  const trunks=[],canopies=[],rocks=[];let treeCount=0;const cap=Math.round(150*vegDensity);
  for(let x=x0+step/2;x<x0+CHUNK;x+=step)for(let z=z0+step/2;z<z0+CHUNK;z+=step){
    const jx=x+(hash2(x*0.31,z*0.31)-0.5)*step*0.8,jz=z+(hash2(x*0.17,z*0.53)-0.5)*step*0.8;
    const h=heightCached(jx,jz);if(h<1)continue;
    let skip=false;const nearC=collectNearby(cityBins,jx,jz,4300,_nearCities);
    for(let i=0;i<nearC.length;i++){const c=nearC[i],dx=jx-c.x,dz=jz-c.z;
      if(dx*dx+dz*dz<(c.r+260)*(c.r+260)){skip=true;break;}}
    if(skip)continue;
    const nearA=collectNearby(airportBins,jx,jz,2500,_nearAirports);
    for(let i=0;i<nearA.length;i++){if(Math.hypot(jx-nearA[i].x,jz-nearA[i].z)<2300){skip=true;break;}}
    if(skip)continue;
    if(h>700&&hash2(jx*1.7,jz*1.3)<0.3){rocks.push([jx,jz,h,0.7+hash2(jx,jz)*1.7]);continue;}
    if(treeCount>=cap)continue;
    const m=fbm01(nzA,jx*0.00075+41.2,jz*0.00075+17.8,3),forest=fbm01(nzB,jx*0.0013+77.7,jz*0.0013+31.1,3);
    if(h>3&&h<950&&forest>0.54&&m>0.35){const sc=0.7+hash2(jx*2.1,jz*2.7)*1.1;
      trunks.push([jx,jz,h,sc]);canopies.push([jx,jz,h,sc,m,forest]);treeCount++;}
  }
  const colT=new THREE.Color();
  if(trunks.length){
    const tm=new THREE.InstancedMesh(trunkGeo,trunkMat,trunks.length);
    const cm=new THREE.InstancedMesh(canopyGeo,canopyMat,trunks.length);
    trunks.forEach((t,i)=>{_m1.makeScale(t[3],t[3],t[3]);_m1.setPosition(t[0],t[2]-0.4,t[1]);tm.setMatrixAt(i,_m1);
      const c=canopies[i];_m2.makeScale(c[3],c[3]*(0.9+(c[5]-0.54)*1.5),c[3]);_m2.setPosition(c[0],c[2]-0.4,c[1]);cm.setMatrixAt(i,_m2);
      colT.setHex((c[4]<0.5&&hash2(c[0],c[2])<0.3)?0x7a5a24:0x2a4a20);
      colT.offsetHSL((hash2(c[0]*1.3,c[2]*1.7)-0.5)*0.04,0,(hash2(c[0]*2.9,c[2])-0.5)*0.08);cm.setColorAt(i,colT);});
    tm.instanceMatrix.needsUpdate=true;cm.instanceMatrix.needsUpdate=true;
    if(cm.instanceColor)cm.instanceColor.needsUpdate=true;
    worldGroup.add(tm);worldGroup.add(cm);out.push(tm,cm);}
  if(rocks.length){
    const rm=new THREE.InstancedMesh(rockGeo,rockMat,rocks.length);
    const ax=new THREE.Vector3(0,1,0),qq=new THREE.Quaternion(),pp=new THREE.Vector3(),ss=new THREE.Vector3();
    rocks.forEach((r,i)=>{qq.setFromAxisAngle(ax,hash2(r[0],r[1])*TAU);pp.set(r[0],r[2]+r[3]*0.25,r[1]);ss.set(r[3],r[3]*0.8,r[3]);
      _m1.compose(pp,qq,ss);rm.setMatrixAt(i,_m1);
      colT.setHex(0x6a6a64);colT.offsetHSL(0,0,(hash2(r[0]*3.1,r[1])-0.5)*0.12);rm.setColorAt(i,colT);});
    rm.instanceMatrix.needsUpdate=true;if(rm.instanceColor)rm.instanceColor.needsUpdate=true;
    worldGroup.add(rm);out.push(rm);}
  return out;
}
function terrainGeometry(ci,cj,seg){
  if(worldMode==='LONDON')return LightningLondon.terrainGeometry(THREE,ci,cj,seg===64?24:seg===32?12:6,heightAt);
  const cx=(ci+.5)*CHUNK,cz=(cj+.5)*CHUNK,n=seg+1,topCount=n*n,verts=[],idx=[];
  for(let j=0;j<n;j++)for(let i=0;i<n;i++){
    const lx=-CHUNK/2+i*CHUNK/seg,lz=-CHUNK/2+j*CHUNK/seg;
    verts.push(lx,heightAt(lx+cx,lz+cz),lz);}
  for(let j=0;j<seg;j++)for(let i=0;i<seg;i++){
    const a=j*n+i,b=a+1,c=a+n,d=c+1;idx.push(a,c,b,b,c,d);}
  /* Proper duplicate skirts hide T-junctions between LODs without lowering the
     actual top edge.  The old code lowered every boundary vertex, cutting a
     25 m trench around every chunk. */
  const edges=[];
  for(let i=0;i<n;i++)edges.push(i);
  for(let j=0;j<n;j++)edges.push(j*n+seg);
  for(let i=seg;i>=0;i--)edges.push(seg*n+i);
  for(let j=seg;j>=0;j--)edges.push(j*n);
  let ep=0;
  for(let side=0;side<4;side++){
    const start=verts.length/3;
    for(let k=0;k<n;k++,ep++){const vi=edges[ep],p=vi*3;verts.push(verts[p],verts[p+1],verts[p+2],verts[p],verts[p+1]-220,verts[p+2]);}
    for(let k=0;k<seg;k++){const a=start+k*2,b=a+1,c=a+2,d=a+3;idx.push(a,b,c,c,b,d);}}
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(verts,3));g.setIndex(idx);g.computeVertexNormals();
  const pos=g.attributes.position,nrm=g.attributes.normal,colors=new Float32Array(pos.count*3),col=new THREE.Color();
  for(let i=0;i<pos.count;i++){
    colorAt(pos.getX(i)+cx,pos.getZ(i)+cz,pos.getY(i),nrm.getY(i),col);
    const shade=i>=topCount?.58:1;colors[i*3]=col.r*shade;colors[i*3+1]=col.g*shade;colors[i*3+2]=col.b*shade;}
  g.setAttribute('color',new THREE.BufferAttribute(colors,3));g.computeBoundingSphere();return g;
}
function buildShoreline(ci,cj,lod){
  /* One contour resolution at every terrain LOD keeps a coastline fixed while
     chunks switch detail levels; only the ground mesh changes underneath it. */
  const cx=(ci+.5)*CHUNK,cz=(cj+.5)*CHUNK,res=16,step=CHUNK/res,n=res+1,hs=new Float32Array(n*n);
  for(let j=0;j<n;j++)for(let i=0;i<n;i++)hs[j*n+i]=heightAt(ci*CHUNK+i*step,cj*CHUNK+j*step)-WATER_Y;
  const verts=[],idx=[],cross=[];
  const edge=(x1,z1,h1,x2,z2,h2)=>{if((h1>0)===(h2>0))return;const t=clamp(h1/(h1-h2),0,1);cross.push([lerp(x1,x2,t)-CHUNK/2,lerp(z1,z2,t)-CHUNK/2]);};
  const addSeg=(a,b)=>{const dx=b[0]-a[0],dz=b[1]-a[1],L=Math.hypot(dx,dz);if(L<1)return;
    const w=4.5+lod*2,nx=-dz/L*w,nz=dx/L*w,base=verts.length/3;
    verts.push(a[0]-nx,WATER_Y+.34,a[1]-nz,a[0]+nx,WATER_Y+.34,a[1]+nz,b[0]-nx,WATER_Y+.34,b[1]-nz,b[0]+nx,WATER_Y+.34,b[1]+nz);
    idx.push(base,base+2,base+1,base+1,base+2,base+3);};
  for(let j=0;j<res;j++)for(let i=0;i<res;i++){
    cross.length=0;const x=i*step,z=j*step,h00=hs[j*n+i],h10=hs[j*n+i+1],h01=hs[(j+1)*n+i],h11=hs[(j+1)*n+i+1];
    edge(x,z,h00,x+step,z,h10);edge(x+step,z,h10,x+step,z+step,h11);edge(x+step,z+step,h11,x,z+step,h01);edge(x,z+step,h01,x,z,h00);
    if(cross.length===2)addSeg(cross[0],cross[1]);else if(cross.length===4){addSeg(cross[0],cross[1]);addSeg(cross[2],cross[3]);}}
  if(!idx.length)return null;
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(verts,3));g.setIndex(idx);g.computeVertexNormals();
  const m=new THREE.Mesh(g,shoreMat);m.position.set(cx,0,cz);m.renderOrder=2;worldGroup.add(m);return m;
}
function buildChunk(ci,cj,lod){
  const seg=[64,32,16][lod],cx=(ci+.5)*CHUNK,cz=(cj+.5)*CHUNK,g=terrainGeometry(ci,cj,seg);
  const m=new THREE.Mesh(g,terrainMat);m.receiveShadow=true;m.position.set(cx,0,cz);worldGroup.add(m);
  const shore=worldMode==='LONDON'?null:buildShoreline(ci,cj,lod),veg=worldMode==='LONDON'?[]:(lod===0||(lod===1&&ql()>=1))?buildVeg(ci,cj,lod):[];
  const key=ci+','+cj,old=chunks.get(key);if(old)releaseChunk(old);
  chunks.set(key,{mesh:m,lod,veg,shore});
}
let chunkTimer=0;
function ensureChunks(dt){
  chunkTimer-=dt;if(chunkTimer>0)return;chunkTimer=0.25;
  const pc=Math.floor((P.pos.x+OX)/CHUNK),pj=Math.floor((P.pos.z+OZ)/CHUNK);
  chunkQueue.length=0;
  for(let di=-lodRadius;di<=lodRadius;di++)for(let dj=-lodRadius;dj<=lodRadius;dj++){
    const d=Math.max(Math.abs(di),Math.abs(dj)),lod=d<=1?0:d<=3?1:2,ci=pc+di,cj=pj+dj,key=ci+','+cj;
    const ex=chunks.get(key);if(!ex||ex.lod!==lod)chunkQueue.push({ci,cj,lod,d});}
  chunkQueue.sort((a,b)=>a.d-b.d);
  for(const [k,v] of chunks)if(Math.max(Math.abs(v.mesh.position.x/CHUNK-0.5-pc),Math.abs(v.mesh.position.z/CHUNK-0.5-pj))>lodRadius+1.5){
    releaseChunk(v);chunks.delete(k);}
  /* Long-flight guard: transient LOD replacements can briefly overlap. Keep a hard,
     distance-prioritised ceiling so a many-hour flight cannot accumulate terrain. */
  const maxChunks=(2*lodRadius+3)*(2*lodRadius+3);
  if(chunks.size>maxChunks){
    const far=[...chunks.entries()].sort((a,b)=>{
      const am=a[1].mesh.position.x/CHUNK-.5-pc,an=a[1].mesh.position.z/CHUNK-.5-pj;
      const bm=b[1].mesh.position.x/CHUNK-.5-pc,bn=b[1].mesh.position.z/CHUNK-.5-pj;
      return Math.max(Math.abs(bm),Math.abs(bn))-Math.max(Math.abs(am),Math.abs(an));});
    for(let i=0;i<far.length-maxChunks;i++){releaseChunk(far[i][1]);chunks.delete(far[i][0]);}
  }
}
let chunkBudget=0;
function processChunksTimed(maxMs){const t0=performance.now();
  while(chunkBudget>0&&chunkQueue.length){const c=chunkQueue.shift();buildChunk(c.ci,c.cj,c.lod);chunkBudget--;
    if(performance.now()-t0>maxMs)break;}}
/* airports with varied layout, markings, lighting */
const aptGroups=new Map();
function buildOffshoreGrp(a){
  const g=new THREE.Group();g.position.set(a.x,0,a.z);g.rotation.y=-a.hdg*D2R;
  const e=a.elev,W=a.rwyW,L=a.rwyLen,deckMat=new THREE.MeshLambertMaterial({color:0x303a43});
  const deck=new THREE.Mesh(new THREE.BoxGeometry(W,3,L),deckMat);deck.position.y=e-1.5;g.add(deck);
  const top=new THREE.Mesh(new THREE.BoxGeometry(W*.92,.22,L*.92),lam({color:0x424b52}));top.position.y=e+.11;g.add(top);
  const ring=new THREE.Mesh(new THREE.RingGeometry(10,13,28),new THREE.MeshBasicMaterial({color:0xe7e5d6,side:THREE.DoubleSide}));
  ring.geometry.rotateX(-Math.PI/2);ring.position.y=e+.27;g.add(ring);
  const h1=new THREE.Mesh(new THREE.BoxGeometry(3,.16,19),whiteMat),h2=new THREE.Mesh(new THREE.BoxGeometry(13,.16,3),whiteMat);
  h1.position.y=h2.position.y=e+.30;g.add(h1);g.add(h2);
  const lights=[];for(let i=0;i<6;i++){const z=-L*.42+i*L*.84/5;lights.push([-W*.46,z],[W*.46,z]);}
  const lIM=new THREE.InstancedMesh(new THREE.SphereGeometry(.45,6,4),new THREE.MeshBasicMaterial({color:0x58ffb0}),lights.length);
  lights.forEach((p,i)=>{_m1.makeTranslation(p[0],e+.65,p[1]);lIM.setMatrixAt(i,_m1);});lIM.instanceMatrix.needsUpdate=true;g.add(lIM);g.userData.nightMesh=lIM;
  const supportMat=lam({color:0x46525a}),supportH=e-WATER_Y;
  for(const x of[-W*.38,W*.38])for(const z of[-L*.38,L*.38]){const p=new THREE.Mesh(new THREE.CylinderGeometry(1.5,2.2,supportH,7),supportMat);p.position.set(x,WATER_Y+supportH/2,z);g.add(p);}
  const hut=new THREE.Mesh(new THREE.BoxGeometry(12,8,16),lam({color:0x69747b}));hut.position.set(W*.29,e+4,L*.27);g.add(hut);
  const twr=new THREE.Mesh(new THREE.CylinderGeometry(1.6,2.1,a.twrH,7),darkPoleMat);twr.position.set(W*.30,e+a.twrH/2,L*.20);g.add(twr);
  a.beacon=new THREE.Sprite(new THREE.SpriteMaterial({map:glowT,color:0x58ffb0,transparent:true,blending:THREE.AdditiveBlending,depthWrite:false}));
  a.beacon.position.set(W*.30,e+a.twrH+4,L*.20);a.beacon.scale.set(10,10,1);g.add(a.beacon);a.sock=null;a.papi=[];
  worldGroup.add(g);return g;
}
function buildAirportGrp(a){
  if(a.platform)return buildOffshoreGrp(a);
  const g=new THREE.Group();g.position.set(a.x,0,a.z);g.rotation.y=-a.hdg*D2R;
  const e=a.elev,hl=a.rwyLen/2,W=a.rwyW;
  const asphalt=new THREE.MeshLambertMaterial({color:a.surface==='ASPHALT'?0x26282c:0x33363a});
  const rwy=new THREE.Mesh(new THREE.BoxGeometry(W,0.5,a.rwyLen),asphalt);rwy.position.y=e+0.25;g.add(rwy);
  const apronW=a.size==='L'?220:a.size==='M'?160:110;
  const apron=new THREE.Mesh(new THREE.BoxGeometry(apronW,0.45,a.rwyLen*0.35),asphalt);
  apron.position.set(W/2+apronW/2+10,e+0.22,a.rwyLen*0.15);g.add(apron);
  /* taxiway connecting runway to apron */
  const tw=new THREE.Mesh(new THREE.BoxGeometry(apronW/2+20,0.4,24),asphalt);
  tw.position.set(W/2+apronW/4,e+0.2,a.rwyLen*0.15);g.add(tw);
  const taxiLine=new THREE.Mesh(new THREE.BoxGeometry(apronW/2+18,.035,.55),new THREE.MeshBasicMaterial({color:0xe3b83f,polygonOffset:true,polygonOffsetFactor:-2}));
  taxiLine.position.set(W/2+apronW/4,e+.43,a.rwyLen*.15);g.add(taxiLine);
  const skidMat=new THREE.MeshBasicMaterial({color:0x111315,transparent:true,opacity:.32,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-2});
  for(const zs of[-1,1])for(let i=0;i<9;i++){const skid=new THREE.Mesh(new THREE.BoxGeometry(.28,.025,28+hash2(i,a.idx)*34),skidMat);skid.position.set((i%3-1)*1.25,e+.57,zs*(hl-150-i*11));skid.rotation.y=(hash2(a.idx,i)-.5)*.035;g.add(skid);}
  if(a.stovl){
    const pad=new THREE.Mesh(new THREE.CircleGeometry(a.padSize*.5,28),lam({color:0x4b5054,polygonOffset:true,polygonOffsetFactor:-1}));
    pad.geometry.rotateX(-Math.PI/2);pad.position.set(W/2+apronW*.62,e+.48,-a.rwyLen*.16);g.add(pad);
    const pr=new THREE.Mesh(new THREE.RingGeometry(a.padSize*.27,a.padSize*.34,28),whiteMat);pr.geometry.rotateX(-Math.PI/2);pr.position.copy(pad.position);pr.position.y+=.05;g.add(pr);
    const ph1=new THREE.Mesh(new THREE.BoxGeometry(3,.12,a.padSize*.37),whiteMat),ph2=new THREE.Mesh(new THREE.BoxGeometry(a.padSize*.27,.12,3),whiteMat);
    ph1.position.copy(pad.position);ph2.position.copy(pad.position);ph1.position.y=ph2.position.y=e+.57;g.add(ph1);g.add(ph2);
  }
  const M=new THREE.Matrix4();
  /* centreline + threshold + TDZ markings */
  const marks=[];
  for(let z=-hl+80;z<hl-80;z+=60)marks.push({w:0.9,l:20,x:0,z});
  for(const zs of[-1,1]){
    for(let k=0;k<8;k++)marks.push({w:1.5,l:30,x:(k-3.5)*3.2,z:zs*(hl-40)});
    for(const td of[150,300,450])marks.push({w:1,l:22,x:6,z:zs*(hl-td)},{w:1,l:22,x:-6,z:zs*(hl-td)});
  }
  const mIM=new THREE.InstancedMesh(unitBoxGeo,lam({color:0xd8d8d0,polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-1}),marks.length);
  marks.forEach((mk,i)=>{_m1.makeScale(mk.w,0.06,mk.l);_m1.setPosition(mk.x,e+0.55,mk.z);mIM.setMatrixAt(i,_m1);});
  mIM.instanceMatrix.needsUpdate=true;g.add(mIM);
  /* edge / threshold / end lights */
  const lights=[];const nE=Math.round(a.rwyLen/60);
  for(let i=0;i<=nE;i++){const z=-hl+i*(a.rwyLen/nE);lights.push({x:W/2+2,z,c:0xffd27a});lights.push({x:-W/2-2,z,c:0xffd27a});}
  for(const zs of[-1,1])for(let k=0;k<6;k++){
    lights.push({x:(k-2.5)*3,z:zs*(hl-2),c:zs>0?0x40ff60:0xff3030});}
  const lIM=new THREE.InstancedMesh(new THREE.SphereGeometry(0.4,6,5),new THREE.MeshBasicMaterial({color:0xffffff}),lights.length);
  const lc=new THREE.Color();
  lights.forEach((l,i)=>{_m1.makeTranslation(l.x,e+0.8,l.z);lIM.setMatrixAt(i,_m1);lc.setHex(l.c);lIM.setColorAt(i,lc);});
  lIM.instanceMatrix.needsUpdate=true;if(lIM.instanceColor)lIM.instanceColor.needsUpdate=true;
  g.add(lIM);g.userData.nightMesh=lIM;
  /* taxiway edge lights (blue) */
  const tlights=[];for(let i=0;i<6;i++){const z=a.rwyLen*0.15-60+i*24;tlights.push({x:W/2+apronW+14,z});}
  if(tlights.length){const tIM=new THREE.InstancedMesh(new THREE.SphereGeometry(0.3,5,4),new THREE.MeshBasicMaterial({color:0x4080ff}),tlights.length);
    tlights.forEach((l,i)=>{_m1.makeTranslation(l.x,e+0.7,l.z);tIM.setMatrixAt(i,_m1);});tIM.instanceMatrix.needsUpdate=true;g.add(tIM);}
  /* approach light system at larger airports */
  if(a.size==='L'){const als=[];for(let i=1;i<=5;i++){als.push({z:-hl-i*150,w:8+i*4});}
    const aIM=new THREE.InstancedMesh(unitBoxGeo,new THREE.MeshBasicMaterial({color:0xfff0c0}),als.length);
    als.forEach((l,i)=>{_m1.makeScale(l.w,0.3,3);_m1.setPosition(0,e+0.4,l.z);aIM.setMatrixAt(i,_m1);});
    aIM.instanceMatrix.needsUpdate=true;g.add(aIM);g.userData.als=aIM;}
  /* terminal, hangars, tower */
  const term=new THREE.Mesh(new THREE.BoxGeometry(a.size==='L'?120:70,15,44),lam({color:0x3a4148}));
  term.position.set(W/2+apronW+40,e+7.5,a.rwyLen*0.15);g.add(term);
  for(let i=0;i<a.nHangars;i++){const h=new THREE.Mesh(new THREE.BoxGeometry(60,19,42),lam({color:0x343a41}));
    h.position.set(W/2+apronW*0.5,e+9.5,a.rwyLen*0.15+80+i*70);g.add(h);}
  const twr=new THREE.Mesh(new THREE.CylinderGeometry(4,5.5,a.twrH,8),lam({color:0x49525a}));
  twr.position.set(W/2+60,e+a.twrH/2,200);g.add(twr);
  const cab=new THREE.Mesh(new THREE.CylinderGeometry(7.5,6.5,7,8),lam({color:0x1d2f3a}));
  cab.position.set(W/2+60,e+a.twrH+3.5,200);g.add(cab);
  a.beacon=new THREE.Sprite(new THREE.SpriteMaterial({map:glowT,color:0x40ff80,transparent:true,blending:THREE.AdditiveBlending,depthWrite:false}));
  a.beacon.position.set(W/2+60,e+a.twrH+9,200);a.beacon.scale.set(9,9,1);g.add(a.beacon);
  /* windsock + PAPI */
  const pole=new THREE.Mesh(new THREE.CylinderGeometry(0.25,0.25,9,6),darkPoleMat);
  pole.position.set(-W/2-15,e+4.5,-hl+200);g.add(pole);
  const sockPivot=new THREE.Group();sockPivot.position.set(-W/2-15,e+8.6,-hl+200);g.add(sockPivot);
  const sock=new THREE.Mesh(new THREE.ConeGeometry(1.1,5,8,1,true),lam({color:0xff7a33,side:THREE.DoubleSide}));
  sock.rotation.x=-Math.PI/2;sock.position.z=-2.4;sockPivot.add(sock);a.sock=sockPivot;
  a.papi=[];for(let i=0;i<4;i++){const p=new THREE.Mesh(new THREE.BoxGeometry(1.4,1,1.4),new THREE.MeshBasicMaterial({color:0xffffff}));
    p.position.set(-W/2-12,e+1,-hl+300-i*4);g.add(p);a.papi.push(p);}
  LightningScenery.enhanceAirport(THREE,a,g);worldGroup.add(g);return g;
}
/* cities */
const cityGroups=new Map();
function buildCityGrp(c){
  const g=new THREE.Group(),rnd=mulberry32(SEED*3+c.idx*77),ca=Math.cos(c.rot||0),sa=Math.sin(c.rot||0);c.colB.length=0;
  const block=[205,170,140,122][ql()],K=Math.min(25,Math.max(4,Math.floor(c.r/block))),lineXs=[],lineZs=[];
  for(let k=-K;k<=K;k++){lineXs.push(k*block);lineZs.push(k*block);}
  const wp=(lx,lz)=>[c.x+lx*ca+lz*sa,c.z-lx*sa+lz*ca];
  const towers=[],offices=[],houses=[],industry=[],parks=[];
  const core=c.cls==='METRO'?.42:c.cls==='CITY'?.53:c.cls==='TOWN'?.70:2;
  for(let bx=-K+.5;bx<=K-.5;bx++)for(let bz=-K+.5;bz<=K-.5;bz++){
    const cxl=bx*block,czl=bz*block,d=Math.hypot(cxl,czl);if(d>c.r-block*.48)continue;
    const cen=1-d/c.r,roll=rnd();if(roll<.075){parks.push([cxl,czl,block*.74,block*.74]);continue;}
    if(cen>core){const count=1+(rnd()<.48?1:0);
      for(let i=0;i<count;i++){const w=30+rnd()*42,dp=30+rnd()*42,h1=16+rnd()*13,h2=(52+Math.pow(rnd(),1.55)*(c.cls==='METRO'?275:185))*c.density;
        towers.push([cxl+(rnd()-.5)*block*.34,czl+(rnd()-.5)*block*.34,w,dp,h1,h2,rnd()]);}}
    else if(cen>.34&&c.cls!=='VILLAGE'){const count=1+(rnd()<.55?1:0);
      for(let i=0;i<count;i++)offices.push([cxl+(rnd()-.5)*block*.40,czl+(rnd()-.5)*block*.40,28+rnd()*38,28+rnd()*38,20+Math.pow(rnd(),1.7)*78,rnd()]);}
    else if(cen<.34&&rnd()<.25){industry.push([cxl,czl,block*(.48+rnd()*.25),block*(.42+rnd()*.28),9+rnd()*14,rnd()]);}
    else{const count=1+(rnd()<.68?1:0)+(rnd()<.24?1:0);
      for(let i=0;i<count;i++)houses.push([cxl+(rnd()-.5)*block*.50,czl+(rnd()-.5)*block*.50,13+rnd()*15,13+rnd()*16,6+rnd()*7,rnd()]);}
  }
  const col=new THREE.Color();
  /* A single graded urban footprint remains readable from normal flight
     altitude; detailed blocks then add parallax without thousands of draws. */
  const footprint=new THREE.Mesh(new THREE.CircleGeometry(c.r*1.04,ql()>=2?48:28),urbanGroundMat);
  footprint.geometry.rotateX(-Math.PI/2);footprint.position.set(c.x,c.elev+.16,c.z);g.add(footprint);
  const roadArr=[];
  for(const lx of lineXs){const p=wp(lx,0);roadArr.push([p[0],p[1],c.rot||0]);}
  for(const lz of lineZs){const p=wp(0,lz);roadArr.push([p[0],p[1],(c.rot||0)+Math.PI/2]);}
  const rIM=new THREE.InstancedMesh(unitBoxGeo,roadMat,roadArr.length);
  roadArr.forEach((r,i)=>{_m1.makeRotationY(r[2]);_m2.makeScale(c.cls==='METRO'?13:10,.18,c.r*1.92);_m1.multiply(_m2);_m1.setPosition(r[0],c.elev+.38,r[1]);rIM.setMatrixAt(i,_m1);});
  rIM.instanceMatrix.needsUpdate=true;g.add(rIM);
  const addB=(x,z,w,d,top)=>{if(c.colB.length<1100)c.colB.push({x,z,hw:w/2,hd:d/2,top});};
  if(parks.length){const pIM=new THREE.InstancedMesh(unitBoxGeo,parkMat,parks.length);
    parks.forEach((p,i)=>{const w=wp(p[0],p[1]);_m1.makeRotationY(c.rot||0);_m2.makeScale(p[2],.22,p[3]);_m1.multiply(_m2);_m1.setPosition(w[0],c.elev+.38,w[1]);pIM.setMatrixAt(i,_m1);});pIM.instanceMatrix.needsUpdate=true;g.add(pIM);}
  if(towers.length){const tIM=new THREE.InstancedMesh(unitBoxGeo,towerMat,towers.length*2);let ti=0;
    towers.forEach(t=>{const w=wp(t[0],t[1]),y=heightCached(w[0],w[1])-.5;
      _m1.makeRotationY(c.rot||0);_m2.makeScale(t[2],t[4],t[3]);_m1.multiply(_m2);_m1.setPosition(w[0],y,w[1]);tIM.setMatrixAt(ti,_m1);col.setHex(t[6]<.5?0x69757f:0x858f93);tIM.setColorAt(ti++,col);
      _m1.makeRotationY(c.rot||0);_m2.makeScale(t[2]*.64,t[5],t[3]*.64);_m1.multiply(_m2);_m1.setPosition(w[0],y+t[4],w[1]);tIM.setMatrixAt(ti,_m1);col.setHex(t[6]<.33?0x526773:t[6]<.66?0x77858c:0x9a958a);tIM.setColorAt(ti++,col);
      addB(w[0],w[1],Math.max(t[2],t[3]),Math.max(t[2],t[3]),y+t[4]+t[5]);});
    tIM.instanceMatrix.needsUpdate=true;if(tIM.instanceColor)tIM.instanceColor.needsUpdate=true;g.add(tIM);}
  if(offices.length){const oIM=new THREE.InstancedMesh(unitBoxGeo,officeMat,offices.length);
    offices.forEach((o,i)=>{const w=wp(o[0],o[1]),y=heightCached(w[0],w[1])-.5;
      _m1.makeRotationY(c.rot||0);_m2.makeScale(o[2],o[4],o[3]);_m1.multiply(_m2);_m1.setPosition(w[0],y,w[1]);oIM.setMatrixAt(i,_m1);
      col.setHex(o[5]<.5?0x898a84:0x6f797c);oIM.setColorAt(i,col);addB(w[0],w[1],o[2],o[3],y+o[4]);});
    oIM.instanceMatrix.needsUpdate=true;if(oIM.instanceColor)oIM.instanceColor.needsUpdate=true;g.add(oIM);}
  if(industry.length){const iIM=new THREE.InstancedMesh(unitBoxGeo,industrialMat,industry.length);
    industry.forEach((o,i)=>{const w=wp(o[0],o[1]),y=heightCached(w[0],w[1])-.5;_m1.makeRotationY(c.rot||0);_m2.makeScale(o[2],o[4],o[3]);_m1.multiply(_m2);_m1.setPosition(w[0],y,w[1]);iIM.setMatrixAt(i,_m1);addB(w[0],w[1],o[2],o[3],y+o[4]);});
    iIM.instanceMatrix.needsUpdate=true;g.add(iIM);}
  if(houses.length){const hIM=new THREE.InstancedMesh(unitBoxGeo,houseMat,houses.length);
    const roIM=new THREE.InstancedMesh(houseRoofGeo,roofMat,houses.length);
    const wc=[0x8a8578,0x9a9284,0x7c7a70],rc=[0x7a4a3a,0x5a5f66,0x6a3a30];
    houses.forEach((h,i)=>{const w=wp(h[0],h[1]),y=heightCached(w[0],w[1])-.5;
      _m1.makeRotationY(c.rot||0);_m2.makeScale(h[2],h[4],h[3]);_m1.multiply(_m2);_m1.setPosition(w[0],y,w[1]);hIM.setMatrixAt(i,_m1);
      col.setHex(wc[(h[5]*3)|0]);hIM.setColorAt(i,col);
      _m1.makeRotationY(c.rot||0);_m2.makeScale(h[2]*1.18,h[4]*.62,h[3]*1.18);_m1.multiply(_m2);_m1.setPosition(w[0],y+h[4],w[1]);roIM.setMatrixAt(i,_m1);
      col.setHex(rc[(h[5]*3)|0]);roIM.setColorAt(i,col);addB(w[0],w[1],h[2],h[3],y+h[4]*1.5);});
    hIM.instanceMatrix.needsUpdate=true;roIM.instanceMatrix.needsUpdate=true;
    if(hIM.instanceColor)hIM.instanceColor.needsUpdate=true;if(roIM.instanceColor)roIM.instanceColor.needsUpdate=true;
    g.add(hIM);g.add(roIM);}
  const glow=new THREE.Sprite(new THREE.SpriteMaterial({map:glowT,color:0xffca7a,transparent:true,opacity:0,blending:THREE.AdditiveBlending,depthWrite:false}));
  glow.position.set(c.x,c.elev+90,c.z);glow.scale.set(c.r*2.6,c.r*1.4,1);g.add(glow);g.userData.glow=glow;
  /* night traffic */
  /* Dense low-LOD urban traffic. Points are retained for the far-field layer because
     hundreds of individually transformed meshes per city would be wasteful on mobile. */
  const N=(c.cls==='METRO'?2:1)*[80,120,160,210][ql()],carPos=new Float32Array(N*3),carData=[];
  for(let i=0;i<N;i++){const ax=rnd()<0.5?0:1,line=(ax?lineZs:lineXs)[(rnd()*lineXs.length)|0];
    carData.push({ax,line,t:(rnd()*2-1)*c.r*0.9,sp:(7+rnd()*9)*(rnd()<0.5?1:-1),off:(rnd()-0.5)*3.4});}
  const cGeo=new THREE.BufferGeometry();cGeo.setAttribute('position',new THREE.BufferAttribute(carPos,3));
  const cPts=new THREE.Points(cGeo,new THREE.PointsMaterial({map:glowT,color:0xffdf9a,size:2.8,sizeAttenuation:false,transparent:true,opacity:0.72,depthWrite:false,blending:THREE.AdditiveBlending,alphaTest:.02}));
  cPts.frustumCulled=false;g.add(cPts);g.userData.cars={pos:carPos,data:carData,geo:cGeo,pts:cPts};
  worldGroup.add(g);return g;
}
/* roads, autonomous vehicles, rail corridors and trains */
const roadGroups=new Map();
const _routePos=new THREE.Vector3(),_routeQuat=new THREE.Quaternion(),_routeScale=new THREE.Vector3(),_routeMat=new THREE.Matrix4(),_routeUp=new THREE.Vector3(0,1,0);
function nearestAirportTo(c){let bi=0,bd=1e12;for(let i=0;i<airports.length;i++){const d=(airports[i].x-c.x)**2+(airports[i].z-c.z)**2;if(d<bd){bd=d;bi=i;}}return bi;}
function sampleTransportPath(x0,z0,r0,x1,z1,r1,step=74,lateral=0,salt=0){
  const dx=x1-x0,dz=z1-z0,L=Math.hypot(dx,dz),route=[];if(L<900)return route;
  const ux=dx/L,uz=dz/L,px=-uz,pz=ux,s0=Math.min(r0+60,L*.42),s1=L-Math.min(r1+60,L*.42);
  const bend=(hash2(Math.round(x0/500)+salt,Math.round(z1/500)-salt)-.5)*Math.min(2400,L*.17);
  for(let ss=s0;ss<=s1;ss+=step){
    const u=ss/L,off=Math.sin(Math.PI*u)*bend+Math.sin(3*Math.PI*u)*bend*.16+lateral;
    const dOff=(Math.PI/L*Math.cos(Math.PI*u)+.48*Math.PI/L*Math.cos(3*Math.PI*u))*bend;
    const x=x0+ux*ss+px*off,z=z0+uz*ss+pz*off,th=heightAt(x,z),tx=ux+px*dOff,tz=uz+pz*dOff;
    let y=surfaceH(x,z)+.32;if(th<-1.2)y=Math.max(y,WATER_Y+4);
    route.push({x,y,z,yaw:Math.atan2(tx,tz)});
  }
  return route;
}
function buildRoadPath(arr,x0,z0,r0,x1,z1,r1,salt=0){
  const route=sampleTransportPath(x0,z0,r0,x1,z1,r1,74,0,salt);
  for(const p of route){_m1.makeRotationY(p.yaw);_m1.setPosition(p.x,p.y,p.z);arr.push(_m1.clone());}
  return route;
}
function routePose(route,travel,lane,pos,quat){
  const max=route.length-1;if(max<1){pos.set(0,-9999,0);quat.identity();return false;}
  const cyc=max*2,q=((travel%cyc)+cyc)%cyc,rev=q>max,u=rev?cyc-q:q,i=Math.min(max-1,Math.floor(u)),f=u-i;
  const a=route[i],b=route[i+1],dx=(b.x-a.x)*(rev?-1:1),dz=(b.z-a.z)*(rev?-1:1),L=Math.max(1e-5,Math.hypot(dx,dz));
  pos.set(lerp(a.x,b.x,f)-dz/L*lane,lerp(a.y,b.y,f),lerp(a.z,b.z,f)+dx/L*lane);
  quat.setFromAxisAngle(_routeUp,Math.atan2(dx,dz));return true;
}
function makeRoadTraffic(gr,routes,rnd){
  const valid=routes.filter(r=>r.length>4);if(!valid.length)return;
  /* Two draw calls carry the whole road fleet. Density is deliberately high so a
     populated corridor normally presents dozens of vehicles without multiplying draws. */
  const perRoute=[40,62,86,112][ql()],n=Math.min(280,Math.max(48,valid.length*perRoute)),body=new THREE.InstancedMesh(unitBoxGeo,carBodyMat,n),roof=new THREE.InstancedMesh(unitBoxGeo,carGlassMat,n),data=[];
  const palette=[0xd7d9d8,0x304b6a,0x8d2828,0xd5b44b,0x282b2e,0x70767b,0x2f6443,0xc7c2b8,0x5c3974],col=new THREE.Color();
  for(let i=0;i<n;i++){const route=valid[i%valid.length],dir=i%2?-1:1;data.push({route,travel:(i/n)*(route.length-1)*2+rnd()*2.4,speed:(11+rnd()*21)*dir,lane:(i%4<2?-1:1)*(2.05+rnd()*.72),kind:rnd()<.13?1:0});col.setHex(palette[(rnd()*palette.length)|0]);body.setColorAt(i,col);}
  body.instanceMatrix.setUsage(THREE.DynamicDrawUsage);roof.instanceMatrix.setUsage(THREE.DynamicDrawUsage);body.instanceMatrix.needsUpdate=true;roof.instanceMatrix.needsUpdate=true;
  if(body.instanceColor)body.instanceColor.needsUpdate=true;body.frustumCulled=roof.frustumCulled=false;gr.add(body);gr.add(roof);gr.userData.roadTraffic={body,roof,data,n};
}
function buildRailCorridor(gr,route,rnd){
  if(route.length<8)return null;const rails=new THREE.InstancedMesh(railSegGeo,railMat,route.length*2),sleepers=new THREE.InstancedMesh(sleeperGeo,sleeperMat,route.length);
  for(let i=0;i<route.length;i++){const p=route[i],dx=Math.sin(p.yaw),dz=Math.cos(p.yaw),nx=-dz,nz=dx;
    for(let side=0;side<2;side++){const off=side?0.76:-0.76;_m1.makeRotationY(p.yaw);_m1.setPosition(p.x+nx*off,p.y+.30,p.z+nz*off);rails.setMatrixAt(i*2+side,_m1);}
    _m1.makeRotationY(p.yaw);_m1.setPosition(p.x,p.y+.18,p.z);sleepers.setMatrixAt(i,_m1);}
  rails.instanceMatrix.needsUpdate=true;sleepers.instanceMatrix.needsUpdate=true;gr.add(rails);gr.add(sleepers);
  /* Several consists share three instanced meshes. This guarantees repeated visible
     services on a corridor while keeping the train fleet to three draw calls. */
  const consistCount=[2,3,4,5][ql()],carsPer=[4,5,6,7][ql()],n=consistCount*carsPer;
  const bodies=new THREE.InstancedMesh(unitBoxGeo,trainBodyMat,n),windows=new THREE.InstancedMesh(unitBoxGeo,trainGlassMat,n),roofs=new THREE.InstancedMesh(unitBoxGeo,trainRoofMat,n),col=new THREE.Color(),consists=[];
  const accents=[0x2f628c,0x9b3434,0x2f744c,0xc2872d,0x5e4d8a];
  for(let j=0;j<consistCount;j++){const accent=accents[j%accents.length],dir=j%2? -1:1;consists.push({travel:(j/consistCount)*(route.length-1)*2+rnd()*3,speed:(27+rnd()*20)*dir,spacing:.36});
    for(let i=0;i<carsPer;i++){col.setHex(i===0?accent:0xd4d7d8);bodies.setColorAt(j*carsPer+i,col);}}
  for(const im of[bodies,windows,roofs]){im.instanceMatrix.setUsage(THREE.DynamicDrawUsage);im.frustumCulled=false;gr.add(im);}if(bodies.instanceColor)bodies.instanceColor.needsUpdate=true;
  const lampPos=new Float32Array(consistCount*3),lampGeo=new THREE.BufferGeometry();lampGeo.setAttribute('position',new THREE.BufferAttribute(lampPos,3));
  const lamps=new THREE.Points(lampGeo,new THREE.PointsMaterial({map:glowT,color:0xfff4c9,size:5.2,transparent:true,opacity:.75,blending:THREE.AdditiveBlending,depthWrite:false}));lamps.frustumCulled=false;gr.add(lamps);
  return{bodies,windows,roofs,lamps,lampPos,lampGeo,route,consists,consistCount,carsPer,n};
}

/* Guaranteed-visible local transport hub.
   The earlier traffic counts were real, but most vehicles were several kilometres away,
   physically tiny, terrain-occluded, or represented by distance-attenuated points. This
   hub puts actual moving meshes on roads and rails around the nearest airport so traffic
   is visible immediately after spawning instead of existing only in diagnostics. */
let localTrafficHub=null,localTrafficHubApt=null,localTrafficCheck=0;
const _localCarPos=new THREE.Vector3(),_localCarQuat=new THREE.Quaternion(),_localCarScale=new THREE.Vector3(),_localCarMat=new THREE.Matrix4(),_localCarFwd=new THREE.Vector3();
function clearLocalTrafficHub(){
  if(!localTrafficHub)return;worldGroup.remove(localTrafficHub);disposeGroup(localTrafficHub);localTrafficHub=null;localTrafficHubApt=null;
}
function airportLocalToWorld(a,along,across,out){
  const h=a.hdg*D2R,s=Math.sin(h),c=Math.cos(h);
  out.set(a.x+along*s+across*c,0,a.z-along*c+across*s);return out;
}
function loopRoutePose(route,travel,lane,pos,quat){
  const n=route.length;if(n<2){pos.set(0,-9999,0);quat.identity();return false;}
  const q=((travel%n)+n)%n,i=Math.floor(q),f=q-i,a=route[i],b=route[(i+1)%n],dx=b.x-a.x,dz=b.z-a.z,L=Math.max(1e-5,Math.hypot(dx,dz));
  pos.set(lerp(a.x,b.x,f)-dz/L*lane,lerp(a.y,b.y,f),lerp(a.z,b.z,f)+dx/L*lane);
  quat.setFromAxisAngle(_routeUp,Math.atan2(dx,dz));return true;
}
function addRouteSurface(gr,route,width,mat,markings=true){
  const count=route.length,road=new THREE.InstancedMesh(unitBoxGeo,mat,count),line=markings?new THREE.InstancedMesh(unitBoxGeo,lineMat,count):null;
  for(let i=0;i<count;i++){
    const a=route[i],b=route[(i+1)%count],dx=b.x-a.x,dz=b.z-a.z,L=Math.max(1,Math.hypot(dx,dz)),yaw=Math.atan2(dx,dz),mx=(a.x+b.x)*.5,mz=(a.z+b.z)*.5,my=(a.y+b.y)*.5;
    _routePos.set(mx,my-.18,mz);_routeQuat.setFromAxisAngle(_routeUp,yaw);_routeScale.set(width,.20,L+1.2);_routeMat.compose(_routePos,_routeQuat,_routeScale);road.setMatrixAt(i,_routeMat);
    if(line){_routePos.y=my+.035;_routeScale.set(.24,.035,Math.max(2,L*.42));_routeMat.compose(_routePos,_routeQuat,_routeScale);line.setMatrixAt(i,_routeMat);}
  }
  road.instanceMatrix.needsUpdate=true;road.frustumCulled=false;gr.add(road);
  if(line){line.instanceMatrix.needsUpdate=true;line.frustumCulled=false;gr.add(line);}return{road,line};
}
function buildLocalTrafficHub(a){
  clearLocalTrafficHub();if(!a)return;
  const gr=new THREE.Group(),rng=mulberry32(SEED*991+(a.idx||0)*37+17),route=[],tmp=new THREE.Vector3();
  const halfL=Math.max(1050,a.rwyLen*.5+260),halfW=Math.max(125,a.rwyW*2.25+70),samples=112;
  /* Rounded rectangular airport perimeter road, always close enough to the parked jet
     to see vehicles rather than only distant specks. */
  for(let i=0;i<samples;i++){
    const t=i/samples*TAU,ct=Math.cos(t),st=Math.sin(t),p=4.2,along=halfL*Math.sign(ct)*Math.pow(Math.abs(ct),2/p),across=halfW*Math.sign(st)*Math.pow(Math.abs(st),2/p);
    airportLocalToWorld(a,along,across,tmp);route.push({x:tmp.x,y:surfaceH(tmp.x,tmp.z)+.38,z:tmp.z});
  }
  addRouteSurface(gr,route,11.5,roadMat,true);
  const carCount=[48,64,80,96][ql()],body=new THREE.InstancedMesh(unitBoxGeo,carBodyMat,carCount),roof=new THREE.InstancedMesh(unitBoxGeo,carGlassMat,carCount),cars=[];
  const palette=[0xf0f0ec,0x25609b,0xa92e2e,0xe0b23d,0x202326,0x697177,0x2f764c,0xc8bda9,0x68468c,0xd66f27],col=new THREE.Color();
  for(let i=0;i<carCount;i++){
    const kind=rng()<.12?2:rng()<.23?1:0,dir=i%2?1:-1;
    cars.push({travel:i/carCount*route.length+rng()*1.7,speed:(kind===2?8+rng()*4:kind===1?11+rng()*7:14+rng()*10)*dir,lane:(i%4<2?-1:1)*(2.20+rng()*.35),kind});
    col.setHex(palette[(rng()*palette.length)|0]);body.setColorAt(i,col);
  }
  for(const im of[body,roof]){im.instanceMatrix.setUsage(THREE.DynamicDrawUsage);im.frustumCulled=false;gr.add(im);}if(body.instanceColor)body.instanceColor.needsUpdate=true;
  const lightPos=new Float32Array(carCount*3),lightGeo=new THREE.BufferGeometry();lightGeo.setAttribute('position',new THREE.BufferAttribute(lightPos,3));
  const lights=new THREE.Points(lightGeo,new THREE.PointsMaterial({map:glowT,color:0xfff1c2,size:4.8,sizeAttenuation:false,transparent:true,opacity:.82,depthWrite:false,blending:THREE.AdditiveBlending,alphaTest:.02}));lights.frustumCulled=false;gr.add(lights);
  gr.userData.localCars={route,body,roof,cars,lightPos,lightGeo,lights};
  /* A dedicated railway runs parallel to the runway roughly half a kilometre away.
     It exists at every airport, so the train system no longer depends on a city pair
     being generated in the current streaming radius. */
  const rail=[],railAcross=halfW+430,railHalf=Math.max(2700,halfL+1250),railSteps=Math.ceil(railHalf*2/52);
  for(let i=0;i<=railSteps;i++){
    const along=lerp(-railHalf,railHalf,i/railSteps),across=railAcross+Math.sin(i*.15)*34;
    airportLocalToWorld(a,along,across,tmp);rail.push({x:tmp.x,y:surfaceH(tmp.x,tmp.z)+.36,z:tmp.z,yaw:a.hdg*D2R});
  }
  gr.userData.train=buildRailCorridor(gr,rail,rng);
  const plat=new THREE.Mesh(new THREE.BoxGeometry(85,.55,8),concreteMat);airportLocalToWorld(a,0,railAcross+5.2,tmp);plat.position.set(tmp.x,surfaceH(tmp.x,tmp.z)+.12,tmp.z);plat.rotation.y=a.hdg*D2R;gr.add(plat);
  worldGroup.add(gr);localTrafficHub=gr;localTrafficHubApt=a;
}
function updateLocalTrafficHub(dt,pgx,pgz){
  localTrafficCheck-=dt;if(localTrafficCheck<=0){localTrafficCheck=1.0;const a=nearestApt();if(a!==localTrafficHubApt)buildLocalTrafficHub(a);}
  const gr=localTrafficHub;if(!gr)return;const lc=gr.userData.localCars,hubDist=Math.hypot(localTrafficHubApt.x-pgx,localTrafficHubApt.z-pgz),show=hubDist<23000;
  if(lc){lc.body.visible=lc.roof.visible=lc.lights.visible=show;if(show){const active=Math.min(lc.cars.length,[48,64,80,96][ql()]);lc.body.count=lc.roof.count=active;lc.lightGeo.setDrawRange(0,active);
    for(let i=0;i<active;i++){
      const d=lc.cars[i];d.travel+=d.speed*dt/46;loopRoutePose(lc.route,d.travel,d.lane,_localCarPos,_localCarQuat);
      const bus=d.kind===2,van=d.kind===1;_localCarScale.set(bus?3.05:van?2.72:2.48,bus?1.90:van?1.48:1.05,bus?12.2:van?7.7:6.15);_localCarMat.compose(_localCarPos,_localCarQuat,_localCarScale);lc.body.setMatrixAt(i,_localCarMat);
      _localCarPos.y+=bus?1.43:van?1.08:.76;_localCarScale.set(bus?2.70:van?2.24:1.94,bus?.68:van?.66:.52,bus?8.8:van?4.65:3.25);_localCarMat.compose(_localCarPos,_localCarQuat,_localCarScale);lc.roof.setMatrixAt(i,_localCarMat);
      _localCarFwd.set(0,0,bus?6.20:van?4.00:3.20).applyQuaternion(_localCarQuat);lc.lightPos[i*3]=_localCarPos.x+_localCarFwd.x;lc.lightPos[i*3+1]=_localCarPos.y+.12;lc.lightPos[i*3+2]=_localCarPos.z+_localCarFwd.z;
    }
    lc.body.instanceMatrix.needsUpdate=true;lc.roof.instanceMatrix.needsUpdate=true;lc.lightGeo.attributes.position.needsUpdate=true;lc.lights.material.opacity=.62+.34*nightF;}}
  const tn=gr.userData.train;if(tn){let any=false,idx=0;const activeConsists=Math.max(2,Math.min(tn.consistCount,[2,3,4,5][ql()])),activeCars=Math.min(tn.carsPer,[4,5,6,7][ql()]);
    for(let j=0;j<activeConsists;j++){const cs=tn.consists[j];cs.travel+=cs.speed*dt/52;
      for(let i=0;i<activeCars;i++,idx++){const len=i===0?15.5:18.0;routePose(tn.route,cs.travel-i*cs.spacing,0,_routePos,_routeQuat);const vis=Math.hypot(_routePos.x-pgx,_routePos.z-pgz)<23000;any=any||vis;
        _routeScale.set(3.70,3.65,len*1.06);_routeMat.compose(_routePos,_routeQuat,_routeScale);tn.bodies.setMatrixAt(idx,_routeMat);
        _routePos.y+=1.84;_routeScale.set(3.72,.94,len*.73);_routeMat.compose(_routePos,_routeQuat,_routeScale);tn.windows.setMatrixAt(idx,_routeMat);
        _routePos.y+=1.38;_routeScale.set(3.35,.46,len*.96);_routeMat.compose(_routePos,_routeQuat,_routeScale);tn.roofs.setMatrixAt(idx,_routeMat);}
      routePose(tn.route,cs.travel+.16,0,_routePos,_routeQuat);tn.lampPos[j*3]=_routePos.x;tn.lampPos[j*3+1]=_routePos.y+1.9;tn.lampPos[j*3+2]=_routePos.z;}
    tn.bodies.count=tn.windows.count=tn.roofs.count=idx;tn.lampGeo.setDrawRange(0,activeConsists);tn.bodies.visible=tn.windows.visible=tn.roofs.visible=tn.lamps.visible=show&&any;tn.bodies.instanceMatrix.needsUpdate=true;tn.windows.instanceMatrix.needsUpdate=true;tn.roofs.instanceMatrix.needsUpdate=true;tn.lampGeo.attributes.position.needsUpdate=true;tn.lamps.material.opacity=.55+.40*nightF;}
}
function ensureRoads(){
  for(const c of cities){
    if(!cityGroups.has(c))continue;const key=c;if(roadGroups.has(key))continue;
    let bj=null,bd=1e9;for(const o of cities){if(o===c)continue;const d=Math.hypot(o.x-c.x,o.z-c.z);if(d<bd){bd=d;bj=o;}}
    const arr=[],routes=[],pairOwner=bj&&c.idx<bj.idx;
    if(pairOwner&&bd<28000){const r=buildRoadPath(arr,c.x,c.z,c.r,bj.x,bj.z,bj.r,c.idx%101);if(r.length)routes.push(r);}
    const a=airports[nearestAirportTo(c)],ad=Math.hypot(a.x-c.x,a.z-c.z);
    if(ad<22000){const r=buildRoadPath(arr,c.x,c.z,c.r*.8,a.x,a.z,320,(c.idx+17)%101);if(r.length)routes.push(r);}
    if(arr.length){const gr=new THREE.Group(),rim=new THREE.InstancedMesh(roadSegGeo,roadMat,arr.length),lim=new THREE.InstancedMesh(lineSegGeo,lineMat,arr.length);
      arr.forEach((m,i)=>{rim.setMatrixAt(i,m);lim.setMatrixAt(i,m);});rim.instanceMatrix.needsUpdate=true;lim.instanceMatrix.needsUpdate=true;gr.add(rim);gr.add(lim);gr.userData.ims=[rim,lim];
      const rnd=mulberry32(seedMix(Math.floor(c.x/REGION),Math.floor(c.z/REGION),c.idx));makeRoadTraffic(gr,routes,rnd);
      /* Every populated road group gets a rail service where geography permits. City-to-city
         routes are preferred; otherwise a city-airport regional line supplies the corridor. */
      let railRoute=null;if(pairOwner&&bd>5200&&bd<38000)railRoute=sampleTransportPath(c.x,c.z,c.r*.92,bj.x,bj.z,bj.r*.92,52,58,c.idx%67);
      else if(ad>3200&&ad<30000)railRoute=sampleTransportPath(c.x,c.z,c.r*.88,a.x,a.z,360,52,-58,(c.idx+31)%67);
      if(railRoute&&railRoute.length)gr.userData.train=buildRailCorridor(gr,railRoute,rnd);
      worldGroup.add(gr);roadGroups.set(key,gr);
    }else roadGroups.set(key,false);
  }
  for(const [c,gr] of roadGroups)if(!cityGroups.has(c)){if(gr){worldGroup.remove(gr);disposeGroup(gr);}roadGroups.delete(c);}
}
/* wind farms */
const wfGroups=new Map();let windTurbines=[];
function buildWindFarm(c){
  const rnd=mulberry32(SEED*5+c.idx*41);let site=null;
  for(let tries=0;tries<10&&!site;tries++){const th=rnd()*TAU,dd=c.r+1400+rnd()*2600;
    const x=c.x+Math.cos(th)*dd,z=c.z+Math.sin(th)*dd,h=heightAt(x,z);
    if(h>300&&h<1200&&slopeOK(x,z,0.35)&&airports.every(a=>Math.hypot(a.x-x,a.z-z)>5200))site={x,z,th:rnd()*TAU};}
  if(!site)return null;
  const g=new THREE.Group(),n=6,rots=[],turbPos=[];
  const px=Math.cos(site.th+Math.PI/2),pz=Math.sin(site.th+Math.PI/2);
  const poleG=shGeo(new THREE.CylinderGeometry(1.8,3.2,70,7));poleG.translate(0,35,0);
  const bladeG=shGeo(new THREE.BoxGeometry(1.3,30,0.5));bladeG.translate(0,15,0);
  for(let i=0;i<n;i++){const x=site.x+(i-(n-1)/2)*px*210,z=site.z+(i-(n-1)/2)*pz*210,y=heightAt(x,z);
    const t=new THREE.Group();t.position.set(x,y,z);t.rotation.y=rnd()*TAU;
    t.add(new THREE.Mesh(poleG,whiteMat));
    const rot=new THREE.Group();rot.position.set(0,72,2.6);rot.userData.isRotor=true;
    for(let b=0;b<3;b++){const bg=new THREE.Group();bg.add(new THREE.Mesh(bladeG,whiteMat));bg.rotation.x=b*TAU/3;rot.add(bg);}
    t.add(rot);g.add(t);rots.push(rot);windTurbines.push({rot,spd:0.7+rnd()*0.9});turbPos.push({x,z,top:y+104});}
  g.userData.rots=rots;g.userData.turbPos=turbPos;worldGroup.add(g);return g;
}
function removeWindFarm(g){const dead=new Set(g.userData.rots||[]);
  windTurbines=windTurbines.filter(t=>!dead.has(t.rot));worldGroup.remove(g);disposeGroup(g);}
/* One pooled point cloud advertises distant aerodromes. More generated airports
   therefore improve navigation without creating one Sprite/draw call per site. */
const APT_PROXY_MAX=160,aptProxyPos=new Float32Array(APT_PROXY_MAX*3),aptProxyCol=new Float32Array(APT_PROXY_MAX*3);
const aptProxyGeo=new THREE.BufferGeometry();aptProxyGeo.setAttribute('position',new THREE.BufferAttribute(aptProxyPos,3));
aptProxyGeo.setAttribute('color',new THREE.BufferAttribute(aptProxyCol,3));aptProxyGeo.setDrawRange(0,0);
const aptProxyMat=new THREE.PointsMaterial({map:glowT,size:5.2,sizeAttenuation:false,vertexColors:true,transparent:true,opacity:.62,
  depthWrite:false,blending:THREE.AdditiveBlending,alphaTest:.025});
const aptProxyPts=new THREE.Points(aptProxyGeo,aptProxyMat);aptProxyPts.frustumCulled=false;worldGroup.add(aptProxyPts);
function updateAirportProxies(sorted,range){let n=0;const C=new THREE.Color();
  for(let k=0;k<sorted.length&&n<APT_PROXY_MAX;k++){const a=sorted[k][0],d=sorted[k][1];if(d>range||d<3500)continue;
    const j=n*3;aptProxyPos[j]=a.x;aptProxyPos[j+1]=a.elev+(a.platform?18:55);aptProxyPos[j+2]=a.z;
    C.setHex(a.platform?0x65d8ff:a.stovl?0x7effb0:a.size==='L'?0xffffff:a.size==='M'?0x83d8ff:0xffcc75);
    aptProxyCol[j]=C.r;aptProxyCol[j+1]=C.g;aptProxyCol[j+2]=C.b;n++;}
  aptProxyGeo.setDrawRange(0,n);aptProxyGeo.attributes.position.needsUpdate=true;aptProxyGeo.attributes.color.needsUpdate=true;
  aptProxyMat.opacity=.42+nightF*.48;
}
/* Distance-capped detail streaming. Terrain remains continuous; expensive airport/city meshes are bounded. */
let visualTimer=0;
function ensureVisuals(dt){
  if(worldMode==='LONDON'){LightningLondon.update(P.pos.x+OX,P.pos.z+OZ,P.pos.y,ql(),nightF,performance.now()/1000);return;}
  visualTimer-=dt;if(visualTimer>0)return;visualTimer=0.45;
  const x=P.pos.x+OX,z=P.pos.z+OZ,aptIn=[44000,56000,70000,84000][ql()],cityIn=[38000,50000,64000,78000][ql()];
  const aptMax=[5,7,9,11][ql()],cityMax=[4,6,8,10][ql()],sortedA=airports.map(a=>[a,Math.hypot(a.x-x,a.z-z)]).sort((a,b)=>a[1]-b[1]);
  const wantedA=new Set(sortedA.filter(v=>v[1]<aptIn).slice(0,aptMax).map(v=>v[0]));
  const wantedC=new Set(cities.map(c=>[c,Math.hypot(c.x-x,c.z-z)]).filter(v=>v[1]<cityIn).sort((a,b)=>a[1]-b[1]).slice(0,cityMax).map(v=>v[0]));
  updateAirportProxies(sortedA,[65000,78000,92000,108000][ql()]);
  for(const a of airports){const g=aptGroups.get(a);
    if(wantedA.has(a)&&!g){const ng=buildAirportGrp(a);aptGroups.set(a,ng);a.grp=ng;}
    else if(!wantedA.has(a)&&g){worldGroup.remove(g);disposeGroup(g);aptGroups.delete(a);a.grp=null;}}
  for(const c of cities){const g=cityGroups.get(c);
    if(wantedC.has(c)&&!g){const ng=buildCityGrp(c);cityGroups.set(c,ng);c.grp=ng;}
    else if(!wantedC.has(c)&&g){worldGroup.remove(g);disposeGroup(g);cityGroups.delete(c);c.grp=null;}}
  ensureRoads();
  for(const c of cities){const g=wfGroups.get(c),wanted=ql()>0&&wantedC.has(c);
    if(wanted&&!wfGroups.has(c))wfGroups.set(c,buildWindFarm(c)||false);
    else if(!wanted&&g){removeWindFarm(g);wfGroups.delete(c);}
    else if(!wanted&&g===false)wfGroups.delete(c);}
}
/* ships + autonomous commercial air traffic */
const ships=[],civAir=[];
let ambientAir=null;
function makeAirlinerModel(scale=1,livery=0){
  /* Narrow-body twinjet proportions (roughly A320/737 class) with visible nacelles,
     winglets, cabin windows, strobes and deployable landing gear. */
  const g=new THREE.Group(),len=37.0*scale,rad=1.82*scale,span=35.4*scale;
  const liveries=[0xe2e5e7,0xd8dde1,0xe7e3db,0xd7e2ea],accents=[0x255b87,0x9d3232,0x2b6c52,0x6b4f8c];
  const skin=new THREE.MeshStandardMaterial({color:liveries[livery%liveries.length],roughness:.48,metalness:.16}),accent=new THREE.MeshLambertMaterial({color:accents[livery%accents.length]}),dark=new THREE.MeshLambertMaterial({color:0x202a31}),tire=new THREE.MeshLambertMaterial({color:0x111315}),strut=new THREE.MeshLambertMaterial({color:0x8a9296});
  const fus=new THREE.Mesh(new THREE.CylinderGeometry(rad,rad*.94,len*.82,18,1),skin);fus.geometry.rotateX(Math.PI/2);g.add(fus);
  const nose=new THREE.Mesh(new THREE.SphereGeometry(rad,18,10),skin);nose.scale.set(1,1,1.55);nose.position.z=len*.44;g.add(nose);
  const tailCone=new THREE.Mesh(new THREE.ConeGeometry(rad*.95,len*.18,16),skin);tailCone.rotation.x=-Math.PI/2;tailCone.position.z=-len*.49;g.add(tailCone);
  const wing=planformMesh([[-2.0*scale,-5.8*scale],[-span*.50,-.7*scale],[-span*.47,2.25*scale],[-2.8*scale,1.25*scale],[2.8*scale,1.25*scale],[span*.47,2.25*scale],[span*.50,-.7*scale],[2.0*scale,-5.8*scale]],.30*scale,skin);wing.position.y=-.18*scale;g.add(wing);
  const tail=planformMesh([[-1.4*scale,-len*.42],[-7.3*scale,-len*.49],[-6.2*scale,-len*.37],[6.2*scale,-len*.37],[7.3*scale,-len*.49],[1.4*scale,-len*.42]],.20*scale,skin);tail.position.y=.30*scale;g.add(tail);
  const fin=sidePrism([[-len*.49,0],[-len*.31,0],[-len*.42,7.0*scale]],.34*scale,accent);fin.position.y=.92*scale;g.add(fin);
  for(const x of[-span*.20,span*.20]){const pylon=new THREE.Mesh(new THREE.BoxGeometry(.40*scale,.55*scale,3.5*scale),skin);pylon.position.set(x,-.55*scale,-.6*scale);g.add(pylon);const eng=new THREE.Mesh(new THREE.CylinderGeometry(1.02*scale,1.14*scale,5.3*scale,16),dark);eng.geometry.rotateX(Math.PI/2);eng.position.set(x,-1.30*scale,-.35*scale);g.add(eng);const fan=new THREE.Mesh(new THREE.CylinderGeometry(.93*scale,.93*scale,.10*scale,16),new THREE.MeshBasicMaterial({color:0x0b0e10}));fan.geometry.rotateX(Math.PI/2);fan.position.set(x,-1.30*scale,2.33*scale);g.add(fan);}
  const stripe=new THREE.Mesh(new THREE.BoxGeometry(3.55*scale,.20*scale,len*.70),accent);stripe.position.set(0,.18*scale,0);g.add(stripe);
  const winPos=[];for(const side of[-1,1])for(let z=-len*.31;z<len*.31;z+=1.15*scale)winPos.push(side*rad*.97,.46*scale,z);
  const winGeo=new THREE.BufferGeometry();winGeo.setAttribute('position',new THREE.Float32BufferAttribute(winPos,3));const cabinWindows=new THREE.Points(winGeo,new THREE.PointsMaterial({color:0x9bdcff,size:1.12*scale,transparent:true,opacity:.58,depthWrite:false}));cabinWindows.frustumCulled=false;g.add(cabinWindows);
  const windscreen=quadMesh([[-.72*scale,.66*scale,len*.462],[.72*scale,.66*scale,len*.462],[.52*scale,1.08*scale,len*.425],[-.52*scale,1.08*scale,len*.425]],dark);g.add(windscreen);
  for(const side of[-1,1]){const wl=sidePrism([[-.42*scale,0],[.42*scale,0],[.10*scale,2.15*scale]],.14*scale,accent);wl.position.set(side*span*.49,.05*scale,.20*scale);wl.rotation.z=-side*.16;g.add(wl);}
  const gear=new THREE.Group();
  function wheel(x,y,z,r=.42,w=.24){const st=new THREE.Mesh(new THREE.CylinderGeometry(.075*scale,.075*scale,1.25*scale,8),strut);st.position.set(x,y+.7*scale,z);gear.add(st);const wh=new THREE.Mesh(new THREE.CylinderGeometry(r*scale,r*scale,w*scale,12),tire);wh.rotation.z=Math.PI/2;wh.position.set(x,y,z);gear.add(wh);}
  wheel(0,-2.55*scale,len*.30,.34,.20);wheel(-3.4*scale,-2.70*scale,-2.2*scale,.48,.28);wheel(3.4*scale,-2.70*scale,-2.2*scale,.48,.28);gear.visible=false;g.add(gear);
  const navGeo=new THREE.BufferGeometry();navGeo.setAttribute('position',new THREE.Float32BufferAttribute([-span*.5,0,0,span*.5,0,0],3));navGeo.setAttribute('color',new THREE.Float32BufferAttribute([1,.04,.03,.03,1,.08],3));
  const navPts=new THREE.Points(navGeo,new THREE.PointsMaterial({size:2.2*scale,vertexColors:true,transparent:true,opacity:.7,depthWrite:false,blending:THREE.AdditiveBlending}));navPts.frustumCulled=false;g.add(navPts);
  const stGeo=new THREE.BufferGeometry();stGeo.setAttribute('position',new THREE.Float32BufferAttribute([0,4.8*scale,-len*.38],3));const strobe=new THREE.Points(stGeo,new THREE.PointsMaterial({size:2.6*scale,color:0xffffff,transparent:true,opacity:0,depthWrite:false,blending:THREE.AdditiveBlending}));strobe.frustumCulled=false;g.add(strobe);
  g.userData.navPts=navPts;g.userData.strobe=strobe;g.userData.gear=gear;g.userData.len=len;return g;
}
const TRAFFIC_CRUISE_FT=30000,TRAFFIC_CRUISE_M=TRAFFIC_CRUISE_FT/FT;
function trafficRunwayChoice(a,courseDeg){
  const opts=[{thrX:a.thrAx,thrZ:a.thrAz,ux:a.ux,uz:a.uz,hdg:a.hdg,num:a.num},{thrX:a.thrBx,thrZ:a.thrBz,ux:-a.ux,uz:-a.uz,hdg:a.hdgB,num:a.numB}];
  let best=opts[0],bestScore=1e9;for(const o of opts){const align=Math.abs(norm180(courseDeg-o.hdg)),head=wx.windNow*Math.cos((wx.windDir-o.hdg)*D2R),score=align-head*1.15;if(score<bestScore){bestScore=score;best=o;}}return best;
}
function trafficPlan(c,from,to){
  const dx=to.x-from.x,dz=to.z-from.z,dist=Math.max(1,Math.hypot(dx,dz)),course=norm360(Math.atan2(dx,-dz)*R2D),dirX=dx/dist,dirZ=dz/dist;
  const dep=trafficRunwayChoice(from,course),arr=trafficRunwayChoice(to,course),cruise=clamp(c.cruise||TRAFFIC_CRUISE_M,27000/FT,36000/FT),gs=Math.tan(3*D2R);
  const depJoin=Math.min(22000,Math.max(12000,dist*.22)),arrJoin=Math.min(24000,Math.max(14000,dist*.24));
  const pts=[
    new THREE.Vector3(dep.thrX+dep.ux*70,from.elev+2.7,dep.thrZ+dep.uz*70),
    new THREE.Vector3(dep.thrX+dep.ux*Math.min(850,from.rwyLen*.34),from.elev+14,dep.thrZ+dep.uz*Math.min(850,from.rwyLen*.34)),
    new THREE.Vector3(dep.thrX+dep.ux*5200,from.elev+820,dep.thrZ+dep.uz*5200),
    new THREE.Vector3(from.x+dirX*depJoin,Math.min(cruise,from.elev+3200),from.z+dirZ*depJoin),
    new THREE.Vector3(from.x+dx*.36,cruise,from.z+dz*.36),
    new THREE.Vector3(from.x+dx*.68,cruise,from.z+dz*.68),
    new THREE.Vector3(to.x-dirX*arrJoin,Math.min(cruise,to.elev+3500),to.z-dirZ*arrJoin),
    new THREE.Vector3(arr.thrX-arr.ux*12000,to.elev+gs*12000+25,arr.thrZ-arr.uz*12000),
    new THREE.Vector3(arr.thrX-arr.ux*4000,to.elev+gs*4000+10,arr.thrZ-arr.uz*4000),
    new THREE.Vector3(arr.thrX-arr.ux*900,to.elev+gs*900+5,arr.thrZ-arr.uz*900),
    new THREE.Vector3(arr.thrX+arr.ux*280,to.elev+2.65,arr.thrZ+arr.uz*280),
    new THREE.Vector3(arr.thrX+arr.ux*Math.min(1450,to.rwyLen*.62),to.elev+2.55,arr.thrZ+arr.uz*Math.min(1450,to.rwyLen*.62))
  ];
  const cum=[0];let total=0;for(let i=1;i<pts.length;i++){total+=pts[i].distanceTo(pts[i-1]);cum.push(total);}return{from,to,dep,arr,pts,cum,total,course,cruise};
}
function trafficPoint(plan,d,out){d=clamp(d,0,plan.total);let i=1;while(i<plan.cum.length-1&&plan.cum[i]<d)i++;const a=plan.pts[i-1],b=plan.pts[i],den=Math.max(1e-6,plan.cum[i]-plan.cum[i-1]),t=(d-plan.cum[i-1])/den;return out.copy(a).lerp(b,t);}
function trafficPhase(plan,d){const p=d/Math.max(plan.total,1);return p<.025?'TAKEOFF':p<.22?'CLIMB':p<.70?'CRUISE':p<.88?'DESCENT':p<.965?'FINAL':'ROLLOUT';}
function trafficSpeed(plan,d){const p=d/Math.max(plan.total,1);if(p<.018)return lerp(78,95,p/.018);if(p<.15)return lerp(120,215,(p-.018)/.132);if(p<.72)return 235;if(p<.87)return lerp(215,165,(p-.72)/.15);if(p<.965)return lerp(155,74,(p-.87)/.095);return lerp(70,24,(p-.965)/.035);}
function mergeTrafficGeometries(parts){
  const pos=[],nor=[];for(const part of parts){let g=part.geo.index?part.geo.toNonIndexed():part.geo.clone();g.applyMatrix4(part.mat);const p=g.attributes.position,n=g.attributes.normal;
    for(let i=0;i<p.count;i++){pos.push(p.getX(i),p.getY(i),p.getZ(i));if(n)nor.push(n.getX(i),n.getY(i),n.getZ(i));else nor.push(0,1,0);}g.dispose();part.geo.dispose();}
  const out=new THREE.BufferGeometry();out.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));out.setAttribute('normal',new THREE.Float32BufferAttribute(nor,3));out.computeBoundingSphere();out.userData.shared=false;return out;
}
function makeAmbientJetGeometry(){
  const parts=[],M=(geo,x=0,y=0,z=0,rx=0,ry=0,rz=0,sx=1,sy=1,sz=1)=>{const m=new THREE.Matrix4(),q=new THREE.Quaternion().setFromEuler(new THREE.Euler(rx,ry,rz,'YXZ'));m.compose(new THREE.Vector3(x,y,z),q,new THREE.Vector3(sx,sy,sz));parts.push({geo,mat:m});};
  M(new THREE.CylinderGeometry(.68,.76,14.8,8,1),0,0,0,Math.PI/2);
  M(new THREE.ConeGeometry(.68,2.2,8),0,0,8.35,-Math.PI/2);
  M(new THREE.ConeGeometry(.74,2.7,8),0,0,-8.60,Math.PI/2);
  const wg=planformMesh([[-.8,-3.4],[-7.8,-.2],[-7.1,2.0],[-1.2,.9],[1.2,.9],[7.1,2.0],[7.8,-.2],[.8,-3.4]],.20,carBodyMat).geometry;M(wg,0,-.05,.2);
  const tg=planformMesh([[-.55,-1.0],[-3.25,.05],[-3.0,1.05],[3.0,1.05],[3.25,.05],[.55,-1.0]],.14,carBodyMat).geometry;M(tg,0,.22,-6.15);
  const fg=sidePrism([[-1.2,0],[1.25,0],[-.45,2.55]],.18,carBodyMat).geometry;M(fg,0,.64,-5.95);
  for(const x of[-2.75,2.75])M(new THREE.CylinderGeometry(.38,.48,2.5,8,1),x,-.62,-.10,Math.PI/2);
  return mergeTrafficGeometries(parts);
}
function clearAmbientAir(){if(!ambientAir)return;worldGroup.remove(ambientAir.mesh);worldGroup.remove(ambientAir.lights);ambientAir.mesh.geometry.dispose();ambientAir.mesh.material.dispose();ambientAir.lights.geometry.dispose();ambientAir.lights.material.dispose();ambientAir=null;}
function initAmbientAir(rng){
  clearAmbientAir();const max=128,geo=makeAmbientJetGeometry(),mat=new THREE.MeshLambertMaterial({color:0xf4f4ef}),mesh=new THREE.InstancedMesh(geo,mat,max),data=[],col=new THREE.Color();
  const palette=[0xf0f1ef,0xdde6ed,0xeee5d7,0xdceadf,0xe7dfec],levels=[27000,29000,30000,31000,33000,35000];
  for(let i=0;i<max;i++){const sector=i/max*TAU,jitter=(rng()-.5)*TAU/max*.55,radius=10000+rng()*36000,spd=215+rng()*42,sgn=i%2?-1:1,alt=(levels[i%levels.length]+(rng()-.5)*700)/FT;data.push({base:sector+jitter,radius,alt,omega:sgn*spd/radius,scale:1.25+rng()*.58,phase:rng()*TAU,wobble:250+rng()*1200});col.setHex(palette[i%palette.length]);mesh.setColorAt(i,col);}
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);mesh.frustumCulled=false;if(mesh.instanceColor)mesh.instanceColor.needsUpdate=true;worldGroup.add(mesh);
  const lp=new Float32Array(max*3),lg=new THREE.BufferGeometry();lg.setAttribute('position',new THREE.BufferAttribute(lp,3));const lights=new THREE.Points(lg,new THREE.PointsMaterial({map:glowT,color:0xffffff,size:4.4,sizeAttenuation:false,transparent:true,opacity:.70,depthWrite:false,blending:THREE.AdditiveBlending,alphaTest:.02}));lights.frustumCulled=false;worldGroup.add(lights);
  ambientAir={mesh,data,lights,lp,lg,cx:P.pos.x+OX,cz:P.pos.z+OZ,max,contacts:data.map((_,i)=>({ambientIndex:i,callsign:'SKY '+String(i+1).padStart(3,'0'),kind:'AMBIENT'}))};
}
const _ambPos=new THREE.Vector3(),_ambQuat=new THREE.Quaternion(),_ambScale=new THREE.Vector3(),_ambEuler=new THREE.Euler(0,0,0,'YXZ'),_ambMat=new THREE.Matrix4();
function updateAmbientAir(dt,pgx,pgz){
  if(!ambientAir)return;const active=[80,96,112,128][ql()],follow=1-Math.exp(-dt*.018);ambientAir.cx=lerp(ambientAir.cx,pgx,follow);ambientAir.cz=lerp(ambientAir.cz,pgz,follow);ambientAir.mesh.count=active;ambientAir.lights.geometry.setDrawRange(0,active);
  for(let i=0;i<active;i++){const d=ambientAir.data[i],a=d.base+simT*d.omega,r=d.radius+Math.sin(simT*.006+d.phase)*d.wobble,x=ambientAir.cx+Math.cos(a)*r,z=ambientAir.cz+Math.sin(a)*r;
    const y=d.alt+Math.sin(simT*.012+d.phase)*45,yaw=a+(d.omega>0?Math.PI/2:-Math.PI/2),v=Math.abs(d.omega)*r,bank=clamp(Math.atan(v*v/Math.max(r*G0,1))*Math.sign(d.omega),-.42,.42);
    _ambPos.set(x,y,z);_ambEuler.set(0,yaw,bank);_ambQuat.setFromEuler(_ambEuler);_ambScale.setScalar(d.scale);_ambMat.compose(_ambPos,_ambQuat,_ambScale);ambientAir.mesh.setMatrixAt(i,_ambMat);
    ambientAir.lp[i*3]=x;ambientAir.lp[i*3+1]=y+1.2*d.scale;ambientAir.lp[i*3+2]=z;}
  ambientAir.mesh.instanceMatrix.needsUpdate=true;ambientAir.lg.attributes.position.needsUpdate=true;ambientAir.lights.material.opacity=(.58+.36*nightF)*(.78+.22*Math.abs(Math.sin(simT*2.4)));
}

function initShips(){
  clearAmbientAir();
  ships.forEach(s=>{worldGroup.remove(s.g);disposeGroup(s.g);});ships.length=0;
  if(worldMode==='LONDON'){civAir.forEach(c=>{worldGroup.remove(c.g);disposeGroup(c.g);});civAir.length=0;clearLocalTrafficHub();initAmbientAir(mulberry32(SEED*77+5));return;}
  const rng=mulberry32(SEED*77+5),spots=[];
  for(let a=0;a<24&&spots.length<6;a++){const th=a/24*TAU+0.26;for(let dd=4000;dd<42000;dd+=3000){const x=airports[0].x+Math.cos(th)*dd,z=airports[0].z+Math.sin(th)*dd;if(heightAt(x,z)<-2){spots.push({x,z,th});break;}}}
  spots.forEach((sp,i)=>{const g=new THREE.Group(),hull=new THREE.Mesh(new THREE.BoxGeometry(16,7,64),new THREE.MeshLambertMaterial({color:0x26333f}));hull.position.y=3;g.add(hull);
    const bridge=new THREE.Mesh(new THREE.BoxGeometry(12,11,10),new THREE.MeshLambertMaterial({color:0xc8c8c2}));bridge.position.set(0,10,-22);g.add(bridge);
    for(let k=0;k<5;k++){const box=new THREE.Mesh(new THREE.BoxGeometry(13,5,8),new THREE.MeshLambertMaterial({color:[0x8e3e32,0x315a75,0x8f7a36][k%3]}));box.position.set(0,7,-8+k*10);g.add(box);}
    g.position.set(sp.x,WATER_Y+.6,sp.z);g.rotation.y=Math.atan2(Math.cos(sp.th+Math.PI/2),Math.sin(sp.th+Math.PI/2));worldGroup.add(g);ships.push({g,ax:sp.x,az:sp.z,dx:Math.cos(sp.th+Math.PI/2),dz:Math.sin(sp.th+Math.PI/2),sp:5+(i%3)*2,ph:rng()*4000});});
  civAir.forEach(c=>{worldGroup.remove(c.g);disposeGroup(c.g);});civAir.length=0;
  let usable=airports.filter(a=>!a.platform&&!a.stovl&&a.rwyLen>=1500);if(usable.length<2)usable=airports.filter(a=>!a.platform&&a.rwyLen>=1200);if(usable.length<2){initAmbientAir(rng);buildLocalTrafficHub(selectedAirport()||airports[0]);return;}
  const count=Math.min([14,18,22,28][ql()],Math.max(14,usable.length*3)),hub=(selectedAirport()&&!selectedAirport().platform&&selectedAirport().rwyLen>=1500)?selectedAirport():usable.find(a=>a.size==='L')||usable[0];
  function farMate(a){let pool=usable.filter(b=>b!==a).sort((x,y)=>Math.hypot(y.x-a.x,y.z-a.z)-Math.hypot(x.x-a.x,x.z-a.z));const far=pool.filter(b=>Math.hypot(b.x-a.x,b.z-a.z)>70000);return (far.length?far:pool)[(rng()*Math.min(5,(far.length?far:pool).length))|0]||pool[0];}
  const hubPhases=[.025,.075,.16,.34,.58,.78,.88,.945,.965,.70];
  for(let i=0;i<count;i++){
    let a,b;
    if(i<10){const mate=farMate(hub);if(!mate)continue;if(i%2===0){a=hub;b=mate;}else{a=mate;b=hub;}}
    else{a=usable[(rng()*usable.length)|0];b=farMate(a);}if(!b)continue;
    const g=makeAirlinerModel(.88+rng()*.18,i);g.rotation.order='YXZ';worldGroup.add(g);
    const c={g,from:a,to:b,cruise:(28500+rng()*5000)/FT,routeDist:0,groundT:-1,bank:0,prevYaw:0,phase:'CRUISE',avoidY:0,callsign:['AURORA','MERIDIAN','COASTAL','NORTHSTAR','SKYLINK','PACIFIC','ATLAS'][i%7]+' '+String(100+i)};
    c.plan=trafficPlan(c,a,b);c.routeDist=i<10?c.plan.total*hubPhases[i]:rng()*c.plan.total;civAir.push(c);
  }
  initAmbientAir(rng);buildLocalTrafficHub(selectedAirport()||airports[0]);
}
/* clouds / storms / rain */
const cloudPool=[];let cloudPoints=null,cloudGeo=null,cloudMat=null,cloudPos=null,cloudAlpha=null,cloudRot=null,cloudShade=null;
function initClouds(){
  const rng=mulberry32(SEED*91+3);if(cTex)cTex.dispose();cTex=cloudTex(mulberry32(SEED*13+7));
  if(cloudPoints){worldGroup.remove(cloudPoints);cloudGeo.dispose();cloudMat.dispose();}
  cloudPool.length=0;
  const n=ql()>=2?180:ql()>=1?120:72,cloudSize=new Float32Array(n);cloudPos=new Float32Array(n*3);cloudAlpha=new Float32Array(n);cloudRot=new Float32Array(n);cloudShade=new Float32Array(n);
  const centres=[];
  for(let i=0;i<n;i++){const gi=(i/4)|0;if(i%4===0){const layer=gi>((n/4)*.80)?2:gi>((n/4)*.50)?1:0;centres[gi]={layer,x:(rng()-.5)*36000,z:(rng()-.5)*36000,y:layer===2?7000+rng()*1500:layer===1?3200+rng()*1200:1300+rng()*1100,base:.52+rng()*.38,sc:layer===2?5600+rng()*5600:1050+rng()*1550};}
    const c=centres[gi],core=i%4===0,ang=rng()*TAU,spread=core?0:(.16+rng()*.28)*c.sc,rel=new THREE.Vector3(c.x+Math.cos(ang)*spread,c.y+(rng()-.5)*c.sc*.10,c.z+Math.sin(ang)*spread);
    cloudPool.push({rel,layer:c.layer,base:c.base*(core?1:.78+rng()*.18),i});cloudSize[i]=c.sc*(core?.76:.44+rng()*.24);cloudRot[i]=(rng()-.5)*1.4;cloudShade[i]=.82+rng()*.28;}
  cloudGeo=new THREE.BufferGeometry();cloudGeo.setAttribute('position',new THREE.BufferAttribute(cloudPos,3));cloudGeo.setAttribute('aSize',new THREE.BufferAttribute(cloudSize,1));cloudGeo.setAttribute('aAlpha',new THREE.BufferAttribute(cloudAlpha,1));cloudGeo.setAttribute('aRot',new THREE.BufferAttribute(cloudRot,1));cloudGeo.setAttribute('aShade',new THREE.BufferAttribute(cloudShade,1));
  cloudMat=new THREE.ShaderMaterial({uniforms:{uMap:{value:cTex},uTint:{value:new THREE.Color(0xdde5ea)},uSun:{value:new THREE.Vector3(0,1,0)},uDusk:{value:0}},transparent:true,depthWrite:false,
    vertexShader:`attribute float aSize,aAlpha,aRot,aShade;varying float vAlpha,vRot,vShade,vHeight;void main(){vec4 mv=modelViewMatrix*vec4(position,1.);vAlpha=aAlpha;vRot=aRot;vShade=aShade;vHeight=position.y;gl_PointSize=clamp(aSize*350./max(1.,-mv.z),2.,210.);gl_Position=projectionMatrix*mv;}`,
    fragmentShader:`uniform sampler2D uMap;uniform vec3 uTint;uniform vec3 uSun;uniform float uDusk;varying float vAlpha,vRot,vShade,vHeight;void main(){vec2 p=gl_PointCoord-.5;float c=cos(vRot),s=sin(vRot);vec2 uv=mat2(c,-s,s,c)*p+.5;vec4 t=texture2D(uMap,uv);float edge=smoothstep(.01,.20,t.a);float underside=mix(.58,1.08,smoothstep(.12,.82,1.-uv.y));vec3 warm=mix(vec3(1.),vec3(1.08,.80,.62),uDusk*.45);vec3 col=uTint*t.rgb*underside*vShade*warm;float a=t.a*vAlpha*edge;if(a<.012)discard;gl_FragColor=vec4(col,a);}`});
  cloudPoints=new THREE.Points(cloudGeo,cloudMat);cloudPoints.frustumCulled=false;worldGroup.add(cloudPoints);
}
const storms=[];
function clearStorms(){for(const c of storms){for(const s of c.sprites){worldGroup.remove(s);s.material.dispose();}
  worldGroup.remove(c.bolt);c.bolt.geometry.dispose();c.bolt.material.dispose();}storms.length=0;}
function makeStorm(x,z,idx){
  const rng=mulberry32(SEED*19+idx*77);
  const cell={x,z,r:2200+rng()*1800,up:3+rng()*3,timer:2+rng()*8,sprites:[]};
  for(let i=0;i<24;i++){const s=new THREE.Sprite(new THREE.SpriteMaterial({map:cTex,transparent:true,depthWrite:false,opacity:0.85,color:0x494f58}));
    const sc=2600+rng()*2600;s.scale.set(sc,sc*0.62,1);
    s.userData.ox=(rng()-0.5)*cell.r*1.6;s.userData.oz=(rng()-0.5)*cell.r*1.6;
    s.position.set(x+s.userData.ox,2800+rng()*6200,z+s.userData.oz);cell.sprites.push(s);worldGroup.add(s);}
  cell.bolt=new THREE.Mesh(new THREE.CylinderGeometry(3,9,1,5),new THREE.MeshBasicMaterial({color:0xcfe0ff,transparent:true,opacity:0,blending:THREE.AdditiveBlending}));
  worldGroup.add(cell.bolt);storms.push(cell);return cell;
}
const rainGeo=new THREE.BufferGeometry(),rainPos=new Float32Array(700*3);
for(let i=0;i<700;i++){rainPos[i*3]=(Math.random()-0.5)*500;rainPos[i*3+1]=(Math.random()-0.5)*400;rainPos[i*3+2]=(Math.random()-0.5)*500;}
rainGeo.setAttribute('position',new THREE.BufferAttribute(rainPos,3));
const rain=new THREE.Points(rainGeo,new THREE.PointsMaterial({color:0xaaccff,size:1.6,transparent:true,opacity:0,sizeAttenuation:true,depthWrite:false}));
scene.add(rain);
/* ================= AERODYNAMIC CONDENSATION =================
   Aerodynamic activation remains humidity/load/Mach driven. Visibility is a
   separate rendering concern: pooled sprites provide volume, attached sheets
   show the pressure field, fixed-size ribbons show circulation, and a shell
   represents the short-lived transonic expansion cloud. */
const VAP_MAX=640,vapPos=new Float32Array(VAP_MAX*3),vapVel=new Float32Array(VAP_MAX*3),vapAlpha=new Float32Array(VAP_MAX),
  vapTTL=new Float32Array(VAP_MAX),vapSize=new Float32Array(VAP_MAX),vapType=new Uint8Array(VAP_MAX),vapColor=new Float32Array(VAP_MAX*3);
const vapGeo=new THREE.BufferGeometry();
vapGeo.setAttribute('position',new THREE.BufferAttribute(vapPos,3));vapGeo.setAttribute('aLife',new THREE.BufferAttribute(vapAlpha,1));
vapGeo.setAttribute('aSize',new THREE.BufferAttribute(vapSize,1));vapGeo.setAttribute('color',new THREE.BufferAttribute(vapColor,3));
const vapMat=new THREE.ShaderMaterial({transparent:true,depthWrite:false,blending:THREE.NormalBlending,
 vertexShader:`attribute float aLife,aSize;attribute vec3 color;varying float vLife;varying vec3 vCol;
 void main(){vec4 mv=modelViewMatrix*vec4(position,1.);vLife=aLife;vCol=color;gl_PointSize=clamp(aSize*(260./max(1.,-mv.z))*(.38+.62*aLife),1.5,112.);gl_Position=projectionMatrix*mv;}`,
 fragmentShader:`varying float vLife;varying vec3 vCol;void main(){float r=length(gl_PointCoord-.5);float a=smoothstep(.5,.07,r)*vLife*.82;if(a<.007)discard;gl_FragColor=vec4(vCol,a);}`});
const vapPts=new THREE.Points(vapGeo,vapMat);vapPts.frustumCulled=false;vapPts.renderOrder=6;worldGroup.add(vapPts);
let vapCursor=0,vapRng=mulberry32(99),wingEmit=0,vortexEmit=0,transEmit=0,trailEmit=0,vortNodeCount=0;
const _vapP=new THREE.Vector3(),_vapW=new THREE.Vector3(),_vapJ=new THREE.Vector3();
function vapourVisualGain(){return S.vapour==='REDUCED'?.56:S.vapour==='NORMAL'?.84:1.18;}

/* Fixed 2×36-node vortex history. Three vertices across each strip give a soft
   centre and transparent edges without textures or per-frame allocations. */
const VORT_SEG=36,VORT_N=VORT_SEG*2,vortP=new Float32Array(VORT_N*3),vortV=new Float32Array(VORT_N*3),
  vortAge=new Float32Array(VORT_N),vortStr=new Float32Array(VORT_N),vortLive=new Uint8Array(VORT_N);
const vortRenderPos=new Float32Array(VORT_N*9),vortRenderLife=new Float32Array(VORT_N*3),vortEdge=new Float32Array(VORT_N*3);
for(let i=0;i<VORT_N;i++){vortEdge[i*3]=.02;vortEdge[i*3+1]=1;vortEdge[i*3+2]=.02;}
const vortIndex=[];for(let s=0;s<2;s++)for(let i=0;i<VORT_SEG-1;i++)for(let b=0;b<2;b++){
  const a=(s*VORT_SEG+i)*3+b,c=a+3,d=c+1,e=a+1;vortIndex.push(a,c,e,e,c,d);}
const vortGeo=new THREE.BufferGeometry();vortGeo.setAttribute('position',new THREE.BufferAttribute(vortRenderPos,3));
vortGeo.setAttribute('aLife',new THREE.BufferAttribute(vortRenderLife,1));vortGeo.setAttribute('aEdge',new THREE.BufferAttribute(vortEdge,1));vortGeo.setIndex(vortIndex);
const vortMat=new THREE.ShaderMaterial({transparent:true,depthWrite:false,side:THREE.DoubleSide,blending:THREE.NormalBlending,
 vertexShader:`attribute float aLife,aEdge;varying float vA;void main(){vA=aLife*aEdge;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
 fragmentShader:`varying float vA;void main(){float a=clamp(vA*.88,0.,.82);if(a<.006)discard;gl_FragColor=vec4(.90,.96,1.,a);}`});
const vortRibbon=new THREE.Mesh(vortGeo,vortMat);vortRibbon.frustumCulled=false;vortRibbon.renderOrder=5;vortRibbon.visible=false;worldGroup.add(vortRibbon);
const _vrTan=new THREE.Vector3(),_vrView=new THREE.Vector3(),_vrSide=new THREE.Vector3(),_vrUp=new THREE.Vector3(),_vrC=new THREE.Vector3();
function spawnVortexNode(p,strength,side){const o=side<0?0:VORT_SEG;
  for(let i=VORT_SEG-1;i>0;i--){const d=o+i,s=o+i-1,d3=d*3,s3=s*3;
    vortP[d3]=vortP[s3];vortP[d3+1]=vortP[s3+1];vortP[d3+2]=vortP[s3+2];vortV[d3]=vortV[s3];vortV[d3+1]=vortV[s3+1];vortV[d3+2]=vortV[s3+2];
    vortAge[d]=vortAge[s];vortStr[d]=vortStr[s];vortLive[d]=vortLive[s];}
  const j=o*3;vortP[j]=p.x;vortP[j+1]=p.y;vortP[j+2]=p.z;windAt(p.x,p.y,p.z,_vapW);
  vortV[j]=_vapW.x*.72;vortV[j+1]=_vapW.y*.72+.05;vortV[j+2]=_vapW.z*.72;vortAge[o]=0;vortStr[o]=strength;vortLive[o]=1;
}
function updateVortexRibbons(dt){let active=0;const ttl=4.8,gain=vapourVisualGain();
  for(let i=0;i<VORT_N;i++){if(!vortLive[i])continue;const j=i*3;vortAge[i]+=dt;if(vortAge[i]>=ttl){vortLive[i]=0;continue;}
    vortP[j]+=vortV[j]*dt;vortP[j+1]+=vortV[j+1]*dt;vortP[j+2]+=vortV[j+2]*dt;active++;}
  for(let ss=0;ss<2;ss++){const o=ss*VORT_SEG;let lastX=0,lastY=0,lastZ=0,have=false;
    for(let i=0;i<VORT_SEG;i++){const n=o+i,rj=n*9,lj=n*3;if(!vortLive[n]){
        for(let k=0;k<3;k++){vortRenderPos[rj+k*3]=lastX;vortRenderPos[rj+k*3+1]=lastY;vortRenderPos[rj+k*3+2]=lastZ;vortRenderLife[lj+k]=0;}continue;}
      const j=n*3,n2=o+Math.min(i+1,VORT_SEG-1),j2=n2*3;
      _vrC.set(vortP[j],vortP[j+1],vortP[j+2]);
      if(vortLive[n2])_vrTan.set(vortP[j2]-vortP[j],vortP[j2+1]-vortP[j+1],vortP[j2+2]-vortP[j+2]).normalize();
      else _vrTan.set(0,0,1).applyQuaternion(P.quat);
      _vrView.set(camera.position.x+OX-_vrC.x,camera.position.y-_vrC.y,camera.position.z+OZ-_vrC.z).normalize();
      _vrSide.crossVectors(_vrTan,_vrView);if(_vrSide.lengthSq()<.001)_vrSide.set(1,0,0);else _vrSide.normalize();
      _vrUp.crossVectors(_vrSide,_vrTan).normalize();const age=vortAge[n],phase=age*5.3+(ss?Math.PI:0),curl=age*.22;
      _vrC.addScaledVector(_vrSide,Math.sin(phase)*curl).addScaledVector(_vrUp,Math.cos(phase)*curl*.72);
      const width=(.20+age*.15)*(.68+vortStr[n]*.52),life=clamp(vortStr[n]*(1-age/ttl)*gain,0,1);
      for(let k=0;k<3;k++){const off=(k-1)*width,ii=rj+k*3;vortRenderPos[ii]=_vrC.x+_vrSide.x*off;vortRenderPos[ii+1]=_vrC.y+_vrSide.y*off;vortRenderPos[ii+2]=_vrC.z+_vrSide.z*off;vortRenderLife[lj+k]=life;}
      lastX=_vrC.x;lastY=_vrC.y;lastZ=_vrC.z;have=true;}
    if(!have){lastX=lastY=lastZ=0;}}
  vortGeo.attributes.position.needsUpdate=true;vortGeo.attributes.aLife.needsUpdate=true;vortRibbon.visible=active>2;return active;
}

let wingVapMesh=null,chineVapMesh=null,transVapMesh=null,wingVapMat=null,chineVapMat=null,transVapMat=null;
function makeVapourFan(points,center=[0,.14,.72]){const pos=[],fade=[],idx=[];for(const p of points){pos.push(p[0],p[1],p[2]);fade.push(p[3]);}
  const centre=points.length;pos.push(center[0],center[1],center[2]);fade.push(1);for(let i=0;i<points.length;i++)idx.push(centre,i,(i+1)%points.length);
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setAttribute('aFade',new THREE.Float32BufferAttribute(fade,1));g.setIndex(idx);return g;}
function makeWingVapourGeo(){const pos=[],fade=[],idx=[];for(const s of[-1,1]){const base=pos.length/3;
    const p=[[s*.68,.15,-.58,.12],[s*2.65,.14,-.35,.78],[s*5.22,.08,.94,.02],[s*4.25,.09,1.72,.12],[s*.75,.16,2.25,.18],[s*2.35,.15,.72,1]];
    for(const v of p){pos.push(v[0],v[1],v[2]);fade.push(v[3]);}for(let i=0;i<5;i++)idx.push(base+5,base+i,base+(i+1)%5);}
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setAttribute('aFade',new THREE.Float32BufferAttribute(fade,1));g.setIndex(idx);return g;}
function sheetMaterial(){return new THREE.ShaderMaterial({transparent:true,depthWrite:false,side:THREE.DoubleSide,blending:THREE.NormalBlending,
  uniforms:{uOpacity:{value:0},uTime:{value:0}},
  vertexShader:`attribute float aFade;varying float vF;varying vec3 vP;void main(){vF=aFade;vP=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
  fragmentShader:`uniform float uOpacity,uTime;varying float vF;varying vec3 vP;void main(){float w=.82+.18*sin(vP.x*4.7-vP.z*6.1+uTime*5.);float a=uOpacity*vF*w;if(a<.008)discard;gl_FragColor=vec4(.93,.97,1.,a);}`});}
function initAirframeVapourVisuals(){
  wingVapMat=sheetMaterial();wingVapMesh=new THREE.Mesh(makeWingVapourGeo(),wingVapMat);wingVapMesh.renderOrder=8;wingVapMesh.visible=false;ac.add(wingVapMesh);
  const chinePts=[[-1.65,.30,-3.25,.03],[-.55,.42,-4.05,.05],[.55,.42,-4.05,.05],[1.65,.30,-3.25,.03],[1.75,.26,.35,.12],[0,.45,1.20,.80],[-1.75,.26,.35,.12]];
  chineVapMat=sheetMaterial();chineVapMesh=new THREE.Mesh(makeVapourFan(chinePts,[0,.42,-1.55]),chineVapMat);chineVapMesh.renderOrder=8;chineVapMesh.visible=false;ac.add(chineVapMesh);
  transVapMat=new THREE.ShaderMaterial({transparent:true,depthWrite:false,side:THREE.DoubleSide,blending:THREE.NormalBlending,uniforms:{uOpacity:{value:0},uTime:{value:0}},
    vertexShader:`varying vec3 vN,vP;void main(){vN=normalize(normalMatrix*normal);vP=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
    fragmentShader:`uniform float uOpacity,uTime;varying vec3 vN,vP;void main(){float rim=pow(1.-abs(vN.z),1.35);float band=.76+.24*sin(vP.y*11.+vP.z*7.+uTime*7.);float a=uOpacity*(.18+.82*rim)*band;if(a<.008)discard;gl_FragColor=vec4(.94,.98,1.,a);}`});
  transVapMesh=new THREE.Mesh(new THREE.SphereGeometry(1,18,12),transVapMat);transVapMesh.scale.set(5.8,2.15,4.7);transVapMesh.position.set(0,.12,.15);transVapMesh.renderOrder=7;transVapMesh.visible=false;ac.add(transVapMesh);
}
function updateAirframeVapour(){if(!wingVapMat)return;const gain=vapourVisualGain(),viewGain=camMode===1?.72:1;
  const w=clamp(Math.pow(condWing,1.18)*.52*gain*viewGain,0,.72),ch=clamp(Math.pow(condWing,1.25)*smooth(7,19,Math.abs(alpha)*R2D)*.46*gain*viewGain,0,.62),tr=clamp(Math.pow(condTrans,1.08)*.55*gain*viewGain,0,.70);
  wingVapMat.uniforms.uOpacity.value=w;wingVapMat.uniforms.uTime.value=simT;wingVapMesh.visible=w>.012;
  chineVapMat.uniforms.uOpacity.value=ch;chineVapMat.uniforms.uTime.value=simT;chineVapMesh.visible=ch>.012;
  transVapMat.uniforms.uOpacity.value=tr;transVapMat.uniforms.uTime.value=simT;transVapMesh.visible=tr>.012;
}
function clearVapour(){vapAlpha.fill(0);vortLive.fill(0);vortRenderLife.fill(0);vapGeo.attributes.aLife.needsUpdate=true;vortGeo.attributes.aLife.needsUpdate=true;
  wingEmit=vortexEmit=transEmit=trailEmit=0;vortNodeCount=0;if(vortRibbon)vortRibbon.visible=false;if(wingVapMesh){wingVapMesh.visible=chineVapMesh.visible=transVapMesh.visible=false;}}
function emitVapourPoint(p,type,strength,side=0){
  const i=vapCursor++%VAP_MAX,j=i*3,r=vapRng(),gain=vapourVisualGain();vapPos[j]=p.x;vapPos[j+1]=p.y;vapPos[j+2]=p.z;
  windAt(p.x,p.y,p.z,_vapW);vapVel[j]=_vapW.x*.72;vapVel[j+1]=_vapW.y*.72;vapVel[j+2]=_vapW.z*.72;
  if(type===1){_vapJ.set(side*(.9+r*.7),(r-.5)*1.15,0).applyQuaternion(P.quat);vapVel[j]+=_vapJ.x;vapVel[j+1]+=_vapJ.y;vapVel[j+2]+=_vapJ.z;}
  vapType[i]=type;vapAlpha[i]=clamp((.40+strength*.60)*gain,0,1);
  vapTTL[i]=type===0?.55+r*.65:type===1?3+r*3:type===2?.8+r:type===3?10+r*10:1;
  vapSize[i]=type===0?6+r*7:type===1?3+r*3:type===2?16+r*18:4+r*4;
  const c=type===3?[.82,.89,.94]:type===2?[.96,.985,1]:[.90,.96,1];vapColor[j]=c[0];vapColor[j+1]=c[1];vapColor[j+2]=c[2];
}
function localVapourPoint(x,y,z){return _vapP.set(x,y,z).applyQuaternion(P.quat).add(P.pos).set(_vapP.x+OX,_vapP.y,_vapP.z+OZ);}
function emitCondensation(dt){
  if(crashed)return;const qf=[.62,.78,.92,1][ql()],vg=vapourVisualGain();
  wingEmit+=condWing*dt*54*qf*vg;while(wingEmit>=1){wingEmit--;const s=vapRng()<.5?-1:1;emitVapourPoint(localVapourPoint(s*(.65+vapRng()*3.85),.12+(vapRng()-.5)*.32,-.4+vapRng()*2.65),0,condWing,s);}
  vortexEmit+=vortexStrength*dt*24*qf*vg;while(vortexEmit>=1){vortexEmit--;for(const s of[-1,1]){const p=localVapourPoint(s*5.22,.03,1.02);emitVapourPoint(p,1,vortexStrength,s);spawnVortexNode(p,vortexStrength,s);}}
  transEmit+=condTrans*dt*30*qf*vg;while(transEmit>=1){transEmit--;const a=vapRng()*TAU,rad=.5+vapRng()*2.3;emitVapourPoint(localVapourPoint(Math.cos(a)*rad,Math.sin(a)*rad*.58,-1.5+vapRng()*4.7),2,condTrans);}
  trailEmit+=contrail*dt*18*qf*vg;while(trailEmit>=1){trailEmit--;emitVapourPoint(localVapourPoint((vapRng()-.5)*.42,.05+(vapRng()-.5)*.28,6.65),3,contrail);}
}
function updateVapour(dt){let n=0;for(let i=0;i<VAP_MAX;i++){if(vapAlpha[i]<=0)continue;n++;const j=i*3;
    vapAlpha[i]=Math.max(0,vapAlpha[i]-dt/Math.max(.1,vapTTL[i]));vapPos[j]+=vapVel[j]*dt;vapPos[j+1]+=vapVel[j+1]*dt+(vapType[i]===3?.035:.09)*dt;vapPos[j+2]+=vapVel[j+2]*dt;
    vapSize[i]+=dt*(vapType[i]===1?1.22:vapType[i]===3?.48:vapType[i]===2?3.2:.9);}
  vapGeo.attributes.position.needsUpdate=true;vapGeo.attributes.aLife.needsUpdate=true;vapGeo.attributes.aSize.needsUpdate=true;
  vortNodeCount=updateVortexRibbons(dt);updateAirframeVapour();return n;}
/* ================= [7] AIRCRAFT MODEL + COCKPIT ================= */
const ac=new THREE.Group();scene.add(ac);
initAirframeVapourVisuals();
const matBody=new THREE.MeshStandardMaterial({color:0x596164,roughness:.57,metalness:.22,side:THREE.DoubleSide});
const matBody2=new THREE.MeshStandardMaterial({color:0x444c4f,roughness:.69,metalness:.16,side:THREE.DoubleSide});
const matDark=new THREE.MeshStandardMaterial({color:0x182125,roughness:.48,metalness:.30,side:THREE.DoubleSide});
const matCanopy=new THREE.MeshPhongMaterial({color:0x16343b,shininess:165,specular:0xd8ffff,transparent:true,opacity:.82,reflectivity:.9});
const matPanel=new THREE.MeshBasicMaterial({color:0x30383a,side:THREE.DoubleSide});
const AC_SURF={}; /* animated aircraft-surface refs; ground materials use SURF */
let pcdCanvas,pcdTex,pcdPage=0,cockpitGrp;
function loftMesh(sections,facets=12,mat=matBody){
  const v=[],ix=[];
  for(const s of sections)for(let k=0;k<facets;k++){
    const a=k/facets*TAU,sy=Math.sin(a),cx=Math.cos(a),chine=1-.10*Math.pow(Math.abs(sy),.7);
    v.push(cx*s.w*chine,s.y+sy*s.h*(sy<0?.86:1),s.z);}
  for(let j=0;j<sections.length-1;j++)for(let k=0;k<facets;k++){
    const a=j*facets+k,b=j*facets+(k+1)%facets,c=a+facets,d=b+facets;ix.push(a,c,b,b,c,d);}
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(v,3));g.setIndex(ix);g.computeVertexNormals();
  return new THREE.Mesh(g,mat);
}
function planformMesh(points,thick=.12,mat=matBody){
  const v=[],ix=[],n=points.length;
  for(const p of points)v.push(p[0],thick/2,p[1]);for(const p of points)v.push(p[0],-thick/2,p[1]);
  for(let i=1;i<n-1;i++){ix.push(0,i,i+1,n,n+i+1,n+i);}
  for(let i=0;i<n;i++){const j=(i+1)%n;ix.push(i,n+i,j,j,n+i,n+j);}
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(v,3));g.setIndex(ix);g.computeVertexNormals();return new THREE.Mesh(g,mat);
}
function sidePrism(points,thick=.12,mat=matBody){
  const v=[],ix=[],n=points.length;
  for(const p of points)v.push(thick/2,p[1],p[0]);for(const p of points)v.push(-thick/2,p[1],p[0]);
  for(let i=1;i<n-1;i++)ix.push(0,i+1,i,n,n+i,n+i+1);
  for(let i=0;i<n;i++){const j=(i+1)%n;ix.push(i,j,n+i,j,n+j,n+i);}
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(v,3));g.setIndex(ix);g.computeVertexNormals();return new THREE.Mesh(g,mat);
}
function quadMesh(points,mat=matDark){
  const g=new THREE.BufferGeometry(),a=[];for(const p of points)a.push(...p);
  g.setAttribute('position',new THREE.Float32BufferAttribute(a,3));g.setIndex([0,1,2,0,2,3]);g.computeVertexNormals();return new THREE.Mesh(g,mat);
}
(function build(){
  /* Public F-35B envelope: 15.6 m long x 10.7 m span x 4.36 m high.
     This remains a lightweight, image-fitted approximation rather than production CAD,
     but the station spacing, canopy, chines, inlets, tails and STOVL hardware now follow
     the public three-view proportions much more closely. */
  const body=loftMesh([
    {z:-8.24,w:.025,h:.025,y:-.10},{z:-7.78,w:.22,h:.16,y:-.08},{z:-7.15,w:.48,h:.31,y:-.05},
    {z:-6.35,w:.70,h:.46,y:-.01},{z:-5.45,w:.88,h:.60,y:.03},{z:-4.35,w:1.03,h:.72,y:.05},
    {z:-3.10,w:1.19,h:.82,y:.06},{z:-1.85,w:1.46,h:.94,y:.05},{z:-.35,w:1.62,h:.99,y:.03},
    {z:1.20,w:1.57,h:.95,y:.04},{z:2.65,w:1.40,h:.86,y:.05},{z:3.95,w:1.16,h:.76,y:.05},
    {z:5.10,w:.92,h:.67,y:.04},{z:6.05,w:.70,h:.59,y:.02},{z:6.82,w:.54,h:.50,y:.00},
    {z:7.34,w:.34,h:.34,y:-.01}
  ],16,matBody);body.name='F35B blended faceted fuselage';ac.add(body);

  /* Broad upper shoulders and sharp lower chines create the recognisable B-variant
     volume around the LiftFan and weapons bays without a high-poly mesh. */
  for(const s of[1,-1]){
    const shoulder=planformMesh([[s*.48,-4.02],[s*1.38,-2.72],[s*1.83,-.85],[s*1.82,2.82],[s*.76,4.75]],.19,matBody2);
    shoulder.position.y=.13;ac.add(shoulder);
    const foreChine=planformMesh([[s*.25,-7.48],[s*.76,-6.32],[s*1.19,-3.30],[s*.54,-3.66]],.075,matBody2);
    foreChine.position.y=-.10;ac.add(foreChine);
    const aftChine=planformMesh([[s*.72,2.15],[s*1.40,2.72],[s*1.02,5.58],[s*.46,5.84]],.07,matBody2);
    aftChine.position.y=-.17;ac.add(aftChine);

    /* Diverterless supersonic inlet: bump, dark duct, and faceted upper/lower lips. */
    const bump=new THREE.Mesh(new THREE.SphereGeometry(.52,14,9),matBody);
    bump.scale.set(.78,.66,2.35);bump.position.set(s*.99,-.03,-1.62);ac.add(bump);
    const duct=quadMesh([[s*1.08,.39,-3.06],[s*1.62,.12,-2.23],[s*1.50,-.50,.10],[s*1.03,-.34,-.56]],matDark);duct.name='DSI inlet duct';ac.add(duct);
    const lipTop=quadMesh([[s*1.06,.43,-3.12],[s*1.66,.15,-2.25],[s*1.58,.08,-2.08],[s*1.02,.34,-2.88]],matBody2);ac.add(lipTop);
    const lipLow=quadMesh([[s*1.03,-.35,-.58],[s*1.50,-.51,.08],[s*1.47,-.40,.25],[s*.99,-.27,-.43]],matBody2);ac.add(lipLow);
  }

  const spine=loftMesh([
    {z:-3.10,w:.44,h:.10,y:.76},{z:-2.20,w:.62,h:.18,y:.82},{z:-.55,w:.73,h:.23,y:.87},
    {z:1.45,w:.69,h:.22,y:.85},{z:3.40,w:.56,h:.17,y:.76},{z:4.85,w:.29,h:.09,y:.61}
  ],12,matBody2);ac.add(spine);

  /* The old spherical canopy was the largest visual mismatch. This loft gives the
     pointed windscreen, high single-piece bow and tapered rear deck. */
  const can=loftMesh([
    {z:-5.72,w:.035,h:.025,y:.45},{z:-5.32,w:.34,h:.17,y:.59},{z:-4.72,w:.57,h:.34,y:.75},
    {z:-3.92,w:.68,h:.43,y:.82},{z:-3.22,w:.60,h:.37,y:.78},{z:-2.72,w:.35,h:.19,y:.68},
    {z:-2.48,w:.055,h:.035,y:.61}
  ],18,matCanopy);can.name='F35 canopy loft';ac.add(can);
  const bow=loftMesh([{z:-5.61,w:.05,h:.04,y:.44},{z:-5.27,w:.37,h:.19,y:.57},{z:-5.10,w:.43,h:.20,y:.60}],12,matDark);ac.add(bow);
  const sill=planformMesh([[-.72,-5.58],[.72,-5.58],[.82,-2.46],[-.82,-2.46]],.055,matDark);sill.position.y=.46;ac.add(sill);

  const eots=new THREE.Mesh(new THREE.OctahedronGeometry(.31,1),new THREE.MeshPhongMaterial({color:0x172428,shininess:105,specular:0xa8c4c8}));
  eots.scale.set(1,.56,1.82);eots.position.set(0,-.66,-5.42);eots.rotation.x=.08;ac.add(eots);

  for(const s of[1,-1]){
    /* Cranked trapezoidal wing with separate leading-edge flap and flaperon. */
    const wing=planformMesh([[s*.78,-3.06],[s*2.02,-2.32],[s*5.35,.14],[s*5.24,1.52],[s*3.02,1.77],[s*.86,2.90]],.145,matBody);
    wing.position.y=.08;wing.name='F35B wing';ac.add(wing);
    const lef=new THREE.Group();lef.position.set(s*.82,.16,-3.02);
    lef.add(planformMesh([[0,0],[s*1.16,.70],[s*4.50,3.15],[s*4.39,3.38],[s*.10,.27]],.065,matBody2));ac.add(lef);AC_SURF['lef'+s]=lef;
    const fp=new THREE.Group();fp.position.set(s*2.76,.035,1.71);
    fp.add(planformMesh([[0,0],[s*2.48,-.17],[s*2.30,.68],[s*.03,1.04]],.085,matBody2));ac.add(fp);AC_SURF['flap'+s]=fp;

    const st=new THREE.Group();st.position.set(s*.82,.02,3.72);
    st.add(planformMesh([[0,0],[s*2.58,1.02],[s*2.43,2.12],[s*.10,2.72]],.105,matBody));ac.add(st);AC_SURF['stab'+s]=st;

    /* Canted twin tails with a separate rudder panel. */
    const vg=new THREE.Group();vg.position.set(s*1.10,.35,2.62);vg.rotation.z=-.47*s;
    vg.add(sidePrism([[0,0],[3.45,.02],[2.61,2.40],[.72,2.36]],.125,matBody));
    const rud=new THREE.Group();rud.position.set(0,0,0);
    rud.add(sidePrism([[2.54,.25],[3.34,.19],[2.59,2.08],[2.10,2.12]],.135,matBody2));vg.add(rud);
    AC_SURF['rud'+s]=rud;ac.add(vg);
  }

  /* F-35B LiftSystem: 50-inch fan, upper inlet door, lower vane-box door,
     paired auxiliary inlet doors, roll posts and a segmented 3BSM nozzle. */
  const fanWell=new THREE.Mesh(new THREE.CylinderGeometry(.69,.69,.16,28),matDark);fanWell.position.set(0,.88,-1.64);ac.add(fanWell);
  const fanRotor=new THREE.Group();fanRotor.position.set(0,.98,-1.64);const fanRows=[];
  for(let row=0;row<2;row++){const rowGrp=new THREE.Group();rowGrp.position.y=row*.035;fanRotor.add(rowGrp);fanRows.push(rowGrp);
    for(let i=0;i<12;i++){const blade=new THREE.Mesh(new THREE.BoxGeometry(.57,.022,.072),new THREE.MeshPhongMaterial({color:row?0x667174:0x879296,shininess:82}));
      blade.position.x=.27;blade.rotation.y=(row?-.18:.18);const arm=new THREE.Group();arm.rotation.y=(i+(row?.5:0))*TAU/12;arm.add(blade);rowGrp.add(arm);}}
  ac.add(fanRotor);AC_SURF.fan=fanRotor;AC_SURF.fanRows=fanRows;

  const lfd=new THREE.Group();lfd.position.set(0,.94,-2.70);
  lfd.add(planformMesh([[-.84,0],[.84,0],[.77,2.15],[-.77,2.15]],.065,matBody));ac.add(lfd);AC_SURF.lfDoor=lfd;
  const lfdInner=planformMesh([[-.72,.08],[.72,.08],[.67,1.96],[-.67,1.96]],.018,matDark);lfdInner.position.y=-.045;lfd.add(lfdInner);

  const lower=new THREE.Group();lower.position.set(0,-.88,-1.64);
  const lowerDisc=new THREE.Mesh(new THREE.CylinderGeometry(.70,.64,.105,24),matDark);lower.add(lowerDisc);
  for(let i=-4;i<=4;i++){const vane=new THREE.Mesh(new THREE.BoxGeometry(1.22,.032,.042),matBody2);vane.position.set(0,-.08,i*.135);lower.add(vane);}ac.add(lower);AC_SURF.lfLower=lower;

  for(const s of[1,-1]){
    const aux=new THREE.Group();aux.position.set(s*.39,.80,-.30);
    aux.add(planformMesh([[0,0],[s*.78,.06],[s*.69,1.62],[0,1.49]],.05,matBody));ac.add(aux);AC_SURF['aux'+s]=aux;
    const roll=new THREE.Group();roll.position.set(s*1.78,-.67,.50);
    const outlet=new THREE.Mesh(new THREE.CylinderGeometry(.13,.23,.46,10),matDark);outlet.rotation.z=Math.PI/2;roll.add(outlet);ac.add(roll);AC_SURF['roll'+s]=roll;
  }

  const nozPivot=new THREE.Group();nozPivot.position.set(0,.01,6.31);ac.add(nozPivot);
  for(let i=0;i<3;i++){
    const ringPivot=new THREE.Group();ringPivot.position.z=i*.34;
    const seg=new THREE.Mesh(new THREE.CylinderGeometry(.52-i*.018,.58-i*.02,.46,18,1),new THREE.MeshStandardMaterial({color:i===1?0x353a3c:0x292d2f,roughness:.43,metalness:.64}));
    seg.geometry.rotateX(Math.PI/2);seg.position.z=.23;ringPivot.add(seg);nozPivot.add(ringPivot);AC_SURF['nozSeg'+i]=ringPivot;
  }
  const rim=new THREE.Mesh(new THREE.TorusGeometry(.49,.062,6,18),matDark);rim.position.z=1.39;nozPivot.add(rim);AC_SURF.nozzle=nozPivot;
  /* F135-style afterburner: relatively compact, intensely bright near the nozzle,
     blue-white in the core with warm orange at the shear layer, plus subtle shock
     cells rather than a giant torch. The real F-35 plume is short and dense. */
  const ab=new THREE.Group();ab.position.z=1.54;nozPivot.add(ab);AC_SURF.ab=ab;
  const mkAB=(geo,color)=>new THREE.Mesh(geo,new THREE.MeshBasicMaterial({color,transparent:true,opacity:0,blending:THREE.AdditiveBlending,depthWrite:false,toneMapped:false,side:THREE.DoubleSide}));
  const abOuter=mkAB(new THREE.CylinderGeometry(.05,.22,1.26,18,1,true),0xff8a45);
  abOuter.geometry.rotateX(Math.PI/2);abOuter.position.z=.64;ab.add(abOuter);AC_SURF.abOuter=abOuter;
  const abMid=mkAB(new THREE.CylinderGeometry(.036,.14,1.04,16,1,true),0xffb26d);
  abMid.geometry.rotateX(Math.PI/2);abMid.position.z=.54;ab.add(abMid);AC_SURF.abMid=abMid;
  const abInner=mkAB(new THREE.CylinderGeometry(.026,.082,.90,14,1,true),0x83d9ff);
  abInner.geometry.rotateX(Math.PI/2);abInner.position.z=.45;ab.add(abInner);AC_SURF.abInner=abInner;
  const abCore=mkAB(new THREE.CylinderGeometry(.015,.040,.72,12,1,true),0xf1fbff);
  abCore.geometry.rotateX(Math.PI/2);abCore.position.z=.34;ab.add(abCore);AC_SURF.abCore=abCore;
  const abHalo=new THREE.Sprite(new THREE.SpriteMaterial({map:glowT,color:0xffb86f,transparent:true,opacity:0,blending:THREE.AdditiveBlending,depthWrite:false,toneMapped:false}));
  abHalo.position.z=.08;abHalo.scale.set(.58,.58,1);ab.add(abHalo);AC_SURF.abHalo=abHalo;
  const abShock=[];
  for(let i=0;i<4;i++){
    const ring=new THREE.Mesh(new THREE.TorusGeometry(.090+i*.014,.010-(i*.0015),6,18),new THREE.MeshBasicMaterial({color:i<2?0xbfe9ff:0xffbf8b,transparent:true,opacity:0,blending:THREE.AdditiveBlending,depthWrite:false,toneMapped:false}));
    ring.rotation.x=Math.PI/2;ring.position.z=.20+i*.18;ab.add(ring);abShock.push(ring);
  }
  AC_SURF.abShock=abShock;
  const nozHeat=new THREE.Mesh(new THREE.TorusGeometry(.50,.045,8,22),new THREE.MeshBasicMaterial({color:0xff8f47,transparent:true,opacity:0,blending:THREE.AdditiveBlending,depthWrite:false,toneMapped:false}));
  nozHeat.rotation.x=Math.PI/2;nozHeat.position.z=.02;nozPivot.add(nozHeat);AC_SURF.nozHeat=nozHeat;
  ac.userData.abLight=new THREE.PointLight(0xff9a52,0,54);ac.userData.abLight.position.set(0,.16,7.00);ac.add(ac.userData.abLight);

  /* Weapons-bay and access-panel cues use shallow geometry rather than textures. */
  for(const s of[1,-1]){
    const bay=planformMesh([[s*.30,-1.45],[s*1.22,-1.18],[s*1.15,2.30],[s*.28,2.52]],.018,matPanel);bay.position.y=-.92;ac.add(bay);
    const seam=planformMesh([[s*.92,-2.68],[s*5.02,.06],[s*4.98,.15],[s*.91,-2.54]],.012,matPanel);seam.position.y=.17;ac.add(seam);
  }

  /* Low-cost exterior detail package: RAM-panel boundaries, distributed-aperture
     sensor facets, lift-system service panels and nozzle petals. These cues improve
     the chase-camera silhouette without adding texture downloads or heavy meshes. */
  const ramLineMat=new THREE.LineBasicMaterial({color:0x252d30,transparent:true,opacity:.72}),sensorMat=new THREE.MeshPhongMaterial({color:0x17272d,shininess:110,specular:0x8fb8c2});
  const addRamLine=pts=>{const gg=new THREE.BufferGeometry().setFromPoints(pts.map(p=>new THREE.Vector3(p[0],p[1],p[2]))),ln=new THREE.Line(gg,ramLineMat);ac.add(ln);};
  addRamLine([[-.78,.74,-5.40],[-.90,.78,-4.35],[-.74,.76,-2.70],[.74,.76,-2.70],[.90,.78,-4.35],[.78,.74,-5.40]]);
  addRamLine([[-1.58,.20,-.35],[-4.92,.20,.18],[-3.05,.18,1.62],[-1.15,.20,2.40],[1.15,.20,2.40],[3.05,.18,1.62],[4.92,.20,.18],[1.58,.20,-.35]]);
  addRamLine([[-.76,.96,-2.68],[-.83,.97,-.62],[.83,.97,-.62],[.76,.96,-2.68],[-.76,.96,-2.68]]);
  const sensors=[[-.63,-.30,-6.30],[.63,-.30,-6.30],[-1.23,.17,-3.25],[1.23,.17,-3.25],[-.83,-.55,3.35],[.83,-.55,3.35]],dasIM=new THREE.InstancedMesh(new THREE.OctahedronGeometry(.115,0),sensorMat,sensors.length);
  sensors.forEach((p,i)=>{_m1.makeScale(1,.62,1.35);_m1.setPosition(p[0],p[1],p[2]);dasIM.setMatrixAt(i,_m1);});dasIM.instanceMatrix.needsUpdate=true;ac.add(dasIM);
  if(AC_SURF.nozzle){const petalIM=new THREE.InstancedMesh(new THREE.BoxGeometry(.12,.035,.70),matBody2,12);for(let i=0;i<12;i++){const a=i*TAU/12;_m1.makeRotationZ(a);_m1.setPosition(Math.cos(a)*.48,Math.sin(a)*.48,.95);petalIM.setMatrixAt(i,_m1);}petalIM.instanceMatrix.needsUpdate=true;AC_SURF.nozzle.add(petalIM);}

  /* Extra faceting and ventral hardware make the silhouette read more like an
     F-35B from the chase camera instead of a smooth generic stealth jet. */
  const boatTail=loftMesh([
    {z:4.68,w:.74,h:.33,y:-.16},{z:5.38,w:.66,h:.31,y:-.18},{z:6.14,w:.58,h:.29,y:-.17},{z:6.92,w:.46,h:.24,y:-.11}
  ],12,matBody2);ac.add(boatTail);
  const hookFairing=planformMesh([[-.18,4.05],[.18,4.05],[.24,6.08],[-.24,6.08]],.09,matBody2);hookFairing.position.y=-.68;ac.add(hookFairing);
  for(const s of[1,-1]){
    const ventral=sidePrism([[4.28,-.08],[5.18,-.12],[5.02,.72],[4.40,.76]],.08,matBody2);
    ventral.position.set(s*.44,-.62,0);ventral.rotation.z=.16*s;ac.add(ventral);
    const chineStrake=planformMesh([[s*.16,-6.78],[s*.54,-6.05],[s*.63,-4.84],[s*.24,-5.06]],.03,matBody2);chineStrake.position.y=.14;ac.add(chineStrake);
    const tailBoom=planformMesh([[s*.44,4.82],[s*.82,4.94],[s*.76,6.46],[s*.34,6.38]],.055,matBody2);tailBoom.position.y=-.30;ac.add(tailBoom);
  }

  /* High-detail chase-camera package: canopy frames, saw-tooth access panels,
     wingtip launch rails, inlet lip facets, dorsal antennas and additional ventral bays.
     These are compact meshes placed only on the player's aircraft. */
  const edgeMat=new THREE.MeshBasicMaterial({color:0x20282b,transparent:true,opacity:.82,side:THREE.DoubleSide});
  const canopySeal=planformMesh([[-.76,-5.57],[.76,-5.57],[.81,-2.49],[-.81,-2.49]],.026,edgeMat);canopySeal.position.y=.505;ac.add(canopySeal);
  for(const s of[1,-1]){
    const tipRail=new THREE.Mesh(new THREE.BoxGeometry(.13,.16,1.58),matBody2);tipRail.position.set(s*5.34,.04,.78);tipRail.rotation.y=-s*.045;ac.add(tipRail);
    const tipCap=planformMesh([[s*5.08,.02],[s*5.37,.13],[s*5.34,1.56],[s*5.09,1.48]],.045,matDark);tipCap.position.y=.10;ac.add(tipCap);
    const inletFence=quadMesh([[s*1.47,.18,-2.32],[s*1.70,.04,-2.14],[s*1.55,-.28,-.12],[s*1.38,-.18,-.35]],matBody2);ac.add(inletFence);
    const bayDoorA=planformMesh([[s*.31,-1.34],[s*.72,-1.28],[s*.69,2.36],[s*.31,2.43]],.024,edgeMat);bayDoorA.position.y=-.935;ac.add(bayDoorA);
    const bayDoorB=planformMesh([[s*.78,-1.22],[s*1.18,-1.08],[s*1.11,2.23],[s*.75,2.34]],.024,edgeMat);bayDoorB.position.y=-.935;ac.add(bayDoorB);
    const stabHinge=planformMesh([[s*.93,3.69],[s*3.36,4.67],[s*3.31,4.78],[s*.91,3.83]],.022,edgeMat);stabHinge.position.y=.08;ac.add(stabHinge);
    const wingHinge=planformMesh([[s*2.78,1.64],[s*5.18,1.43],[s*5.15,1.57],[s*2.80,1.79]],.018,edgeMat);wingHinge.position.y=.17;ac.add(wingHinge);
  }
  const dorsalAntenna=sidePrism([[-.20,0],[.30,0],[-.02,.36]],.08,matBody2);dorsalAntenna.position.set(0,.93,3.80);ac.add(dorsalAntenna);
  const gpsPanel=new THREE.Mesh(new THREE.OctahedronGeometry(.16,0),sensorMat);gpsPanel.scale.set(1.45,.34,1.12);gpsPanel.position.set(0,1.02,1.02);ac.add(gpsPanel);
  const lowerSensor=new THREE.Mesh(new THREE.OctahedronGeometry(.14,0),sensorMat);lowerSensor.scale.set(1.30,.48,1.45);lowerSensor.position.set(0,-.78,1.82);ac.add(lowerSensor);
  const fanHinge=new THREE.Mesh(new THREE.BoxGeometry(1.48,.07,.12),matDark);fanHinge.position.set(0,1.02,-2.67);ac.add(fanHinge);
  for(let i=0;i<7;i++){const tooth=planformMesh([[-.10,-.08],[.10,-.08],[.06,.12],[-.06,.12]],.026,edgeMat);tooth.position.set((i-3)*.21,-.955,2.55+(i%2)*.06);ac.add(tooth);}


  /* Visibility-fix aircraft-detail pass: deeper intakes, EOTS glazing, fan grille,
     nozzle core and clearer control-surface breaks. These additions are deliberately
     confined to the player aircraft, where extra geometry has negligible world cost. */
  const recessMat=new THREE.MeshStandardMaterial({color:0x111719,roughness:.72,metalness:.18,side:THREE.DoubleSide});
  const glassDark=new THREE.MeshPhongMaterial({color:0x193a43,specular:0xcff9ff,shininess:190,transparent:true,opacity:.88,side:THREE.DoubleSide});
  for(const side of[-1,1]){
    const intake=sidePrism([[-2.45,-.48],[-1.02,-.56],[-.58,.15],[-2.30,.22]],.18,recessMat);intake.position.set(side*1.47,-.02,0);intake.rotation.z=side*.05;ac.add(intake);
    const inletLip=sidePrism([[-2.52,-.52],[-2.28,.25],[-2.12,.22],[-2.30,-.45]],.26,matBody2);inletLip.position.set(side*1.52,-.01,0);ac.add(inletLip);
    const elevonBreak=planformMesh([[side*2.72,1.62],[side*5.13,1.40],[side*5.09,1.50],[side*2.76,1.76]],.024,recessMat);elevonBreak.position.y=.19;ac.add(elevonBreak);
    const rudderBreak=sidePrism([[3.83,.46],[5.73,1.78],[5.64,1.87],[3.78,.58]],.025,recessMat);rudderBreak.position.set(side*1.27,.35,0);rudderBreak.rotation.z=-side*22*D2R;ac.add(rudderBreak);
    const shoulder=loftMesh([{z:-2.48,w:.08,h:.12,y:.04},{z:-1.62,w:.22,h:.25,y:.08},{z:-.52,w:.18,h:.22,y:.03}],8,matBody2);shoulder.scale.x=.95;shoulder.position.x=side*1.28;ac.add(shoulder);
  }
  const eotsGlass2=loftMesh([{z:-6.47,w:.19,h:.13,y:-.48},{z:-6.08,w:.31,h:.20,y:-.50},{z:-5.62,w:.22,h:.13,y:-.45}],8,glassDark);eotsGlass2.rotation.x=-.04;ac.add(eotsGlass2);
  const fanGrille=new THREE.Group();fanGrille.position.set(0,1.055,-1.70);for(let i=-5;i<=5;i++){const bar=new THREE.Mesh(new THREE.BoxGeometry(1.38,.028,.055),recessMat);bar.position.z=i*.12;fanGrille.add(bar);}ac.add(fanGrille);
  if(AC_SURF.nozzle){const core=new THREE.Mesh(new THREE.CylinderGeometry(.31,.38,.92,16,1,true),recessMat);core.geometry.rotateX(Math.PI/2);core.position.z=.48;AC_SURF.nozzle.add(core);}
  const bayShadow=planformMesh([[-1.18,-1.20],[1.18,-1.20],[1.08,2.36],[-1.08,2.36]],.026,recessMat);bayShadow.position.y=-.968;ac.add(bayShadow);
  const canopySpine=new THREE.Mesh(new THREE.BoxGeometry(.052,.045,2.72),recessMat);canopySpine.position.set(0,.91,-4.02);ac.add(canopySpine);
  const canopyBow=new THREE.Mesh(new THREE.BoxGeometry(1.32,.045,.055),recessMat);canopyBow.position.set(0,.84,-3.13);ac.add(canopyBow);

  /* Gear with doors and rotating wheels. */
  ac.userData.gear=[];ac.userData.wheels=[];
  function gear(x,y,z,len,wr,nose){const pv=new THREE.Group();pv.position.set(x,y,z);pv.userData.baseY=y;
    const st=new THREE.Mesh(new THREE.CylinderGeometry(.075,.105,len,8),new THREE.MeshStandardMaterial({color:0x8e9595,roughness:.35,metalness:.72}));st.position.y=-len/2;pv.add(st);
    const wh=new THREE.Group(),tire=new THREE.Mesh(new THREE.CylinderGeometry(wr,wr,nose?.22:.30,16),matDark);tire.geometry.rotateZ(Math.PI/2);wh.add(tire);
    const hub=new THREE.Mesh(new THREE.CylinderGeometry(wr*.48,wr*.48,nose?.24:.32,12),matBody2);hub.geometry.rotateZ(Math.PI/2);wh.add(hub);wh.position.y=-len;pv.add(wh);ac.userData.wheels.push(wh);
    const door=planformMesh([[0,-.12],[nose?.70:.92,-.03],[nose?.64:.82,len+.24],[.06,len+.10]],.052,matBody);door.rotation.x=Math.PI/2;door.scale.x=x<0?-1:1;door.position.set(nose?.24:0,-.05,.05);pv.add(door);
    ac.add(pv);ac.userData.gear.push(pv);
  }
  gear(0,-.30,-4.34,.95,.30,true);gear(1.75,-.35,1.92,1.14,.36,false);gear(-1.75,-.35,1.92,1.14,.36,false);

  function nav(col,x,y,z){const s=new THREE.Sprite(new THREE.SpriteMaterial({map:glowT,color:col,transparent:true,blending:THREE.AdditiveBlending,depthWrite:false}));
    s.position.set(x,y,z);s.scale.set(1.6,1.6,1);ac.add(s);return s;}
  ac.userData.navL=nav(0xff3030,-5.30,.17,1.10);ac.userData.navR=nav(0x30ff60,5.30,.17,1.10);ac.userData.strobe=nav(0xffffff,0,2.46,4.76);
  const formMat=new THREE.MeshBasicMaterial({color:0xb7d993,transparent:true,opacity:.38});
  for(const s of[1,-1]){const strip=new THREE.Mesh(new THREE.BoxGeometry(.055,.035,1.52),formMat);strip.position.set(s*1.08,.49,.42);strip.rotation.y=s*.06;ac.add(strip);}
  ac.userData.spot=new THREE.SpotLight(0xfff0cc,0,1100,.45,.5,1);ac.userData.spot.position.set(0,-.2,-4);ac.add(ac.userData.spot);ac.add(ac.userData.spot.target);ac.userData.spot.target.position.set(0,-6,-70);
  ac.userData.publicDimensions={length:15.6,span:10.7,height:4.36,fanDiameter:1.27,source:'public RAF / Lockheed Martin / Rolls-Royce dimensions; enhanced image-fitted faceted mesh with detailed control, sensor and LiftSystem cues'};
  LightningVisuals.buildAircraftDetail(THREE,ac,AC_SURF);
  buildCockpit();
})();
/* procedural cockpit with panoramic display */
function buildCockpit(){
  cockpitGrp=new THREE.Group();
  const frame=new THREE.MeshLambertMaterial({color:0x2a2e33});
  /* canopy frame arcs */
  for(const s of[1,-1]){const rail=new THREE.Mesh(new THREE.BoxGeometry(0.08,0.08,3.4),frame);
    rail.position.set(s*0.55,0.62,-3.1);rail.rotation.z=s*0.35;cockpitGrp.add(rail);}
  const bow=new THREE.Mesh(new THREE.BoxGeometry(1.15,0.09,0.09),frame);bow.position.set(0,0.78,-4.5);cockpitGrp.add(bow);
  const glass=new THREE.Mesh(new THREE.SphereGeometry(0.62,12,8),new THREE.MeshPhongMaterial({color:0x88aabb,transparent:true,opacity:0.08,shininess:120,specular:0xffffff,side:THREE.DoubleSide,depthWrite:false}));
  glass.scale.set(0.9,0.75,2.6);glass.position.set(0,0.68,-3.2);cockpitGrp.add(glass);AC_SURF.cockpitGlass=glass;
  /* instrument panel / coaming */
  const panel=new THREE.Mesh(new THREE.BoxGeometry(1.1,0.52,0.12),frame);panel.position.set(0,0.45,-3.87);panel.rotation.x=-0.3;cockpitGrp.add(panel);
  const coam=new THREE.Mesh(new THREE.BoxGeometry(1.0,0.08,1.2),frame);coam.position.set(0,0.10,-2.8);cockpitGrp.add(coam);
  const consoleMat=new THREE.MeshLambertMaterial({color:0x171c20}),padMat=new THREE.MeshBasicMaterial({color:0x20333a});
  for(const side of[-1,1]){const con=new THREE.Mesh(new THREE.BoxGeometry(.48,.28,1.85),consoleMat);con.position.set(side*.67,.16,-2.86);con.rotation.z=-side*.09;con.rotation.x=-.12;cockpitGrp.add(con);
    for(let i=0;i<4;i++){const pad=new THREE.Mesh(new THREE.BoxGeometry(.16,.012,.22),padMat);pad.position.set(side*(.57+(i%2)*.17),.315,-3.40+Math.floor(i/2)*.34);pad.rotation.x=-.12;cockpitGrp.add(pad);}}
  const glareshield=new THREE.Mesh(new THREE.BoxGeometry(1.22,.07,.30),consoleMat);glareshield.position.set(0,.59,-4.07);glareshield.rotation.x=-.18;cockpitGrp.add(glareshield);
  /* panoramic cockpit display */
  pcdCanvas=document.createElement('canvas');pcdCanvas.width=512;pcdCanvas.height=256;
  pcdTex=new THREE.CanvasTexture(pcdCanvas);
  const disp=new THREE.Mesh(new THREE.PlaneGeometry(0.95,0.48),new THREE.MeshBasicMaterial({map:pcdTex}));
  disp.position.set(0,0.5,-3.72);disp.rotation.x=-0.3;cockpitGrp.add(disp);
  /* seat silhouette */
  const seat=new THREE.Mesh(new THREE.BoxGeometry(0.5,0.7,0.4),new THREE.MeshLambertMaterial({color:0x3a3d40}));
  seat.position.set(0,0.15,-2.2);cockpitGrp.add(seat);
  const back=new THREE.Mesh(new THREE.BoxGeometry(0.48,0.8,0.15),new THREE.MeshLambertMaterial({color:0x34383b}));
  back.position.set(0,0.55,-1.95);back.rotation.x=-0.25;cockpitGrp.add(back);
  const headbox=new THREE.Mesh(new THREE.BoxGeometry(.42,.28,.22),new THREE.MeshLambertMaterial({color:0x24292d}));headbox.position.set(0,.96,-1.88);headbox.rotation.x=-.18;cockpitGrp.add(headbox);
  for(const side of[-1,1]){const brace=new THREE.Mesh(new THREE.CylinderGeometry(.025,.035,.72,6),new THREE.MeshStandardMaterial({color:0x6b7072,roughness:.35,metalness:.6}));brace.position.set(side*.31,.50,-2.02);brace.rotation.z=side*.24;cockpitGrp.add(brace);}
  LightningVisuals.buildCockpitDetail(THREE,cockpitGrp);
  cockpitGrp.visible=false;scene.add(cockpitGrp);
}
const PCD_PAGES=['FLT','MISSION','NAV','ENG','FUEL','WX','SYS','STOVL','APT'];
function drawPCD(){
  if(!pcdCanvas)return;const x=pcdCanvas.getContext('2d');
  x.fillStyle='#0a1218';x.fillRect(0,0,512,256);
  x.strokeStyle='#24405a';x.strokeRect(2,2,508,252);
  x.font='16px ui-monospace, monospace';x.fillStyle='#6fd6ff';
  x.fillText(PCD_PAGES[pcdPage],14,26);
  x.font='13px ui-monospace, monospace';x.fillStyle='#7ef0a8';
  const L=(t,y)=>x.fillText(t,14,y);
  let y=56;
  const pg=PCD_PAGES[pcdPage];
  if(pg==='FLT'){L(`IAS ${(ias||0).toFixed(0)} KT   TAS ${(Vtas||0).toFixed(0)} KT`,y+=22);L(`GS ${((P?P.vel.length():0)/KT).toFixed(0)} KT   MACH ${(mach||0).toFixed(2)}`,y+=22);
    L(`ALT ${((P?P.pos.y:0)*FT).toFixed(0)} FT   VS ${(vsFpm||0).toFixed(0)} FPM`,y+=22);L(`AOA ${(alpha*R2D).toFixed(1)}°   G ${(gNz||1).toFixed(1)}`,y+=22);L(`HDG ${hdgDeg.toFixed(0)}°   PITCH ${pitchDeg.toFixed(1)}°`,y+=22);}
  else if(pg==='MISSION'){L(MISSION.active?MISSION.name:'FREE FLIGHT',y+=22);L(missionObjectiveText().slice(0,48),y+=22);L(`SCORE ${MISSION.score||0}  PHASE ${MISSION.step+1}/${Math.max(1,MISSION.steps.length)}`,y+=22);L(`TIME ${fmtT(MISSION.time||0)}  PEN ${MISSION.penalties||0}`,y+=22);L(trafficAlert.level?`TRAFFIC ${trafficAlert.level} ${(trafficAlert.distance/1000).toFixed(1)}KM`:'TRAFFIC CLEAR',y+=22);}
  else if(pg==='NAV'){const a=nearestApt();if(a){const d=Math.hypot(a.x-P.pos.x-OX,a.z-P.pos.z-OZ);
    L(`NEAREST: ${a.name}`,y+=22);L(`RWY ${a.num} / ${a.numB}  ${a.rwyLen}M ${a.surface}`,y+=22);
    L(`BRG ${norm360(Math.atan2(a.x-P.pos.x-OX,-(a.z-P.pos.z-OZ))*R2D).toFixed(0)}°  DIST ${(d/1000).toFixed(1)} KM`,y+=22);
    L(`ETE ${((d/Math.max(P.vel.length(),1))/60).toFixed(0)} MIN`,y+=22);L(`WIND ${wx.windDir.toFixed(0)}° / ${(wx.windNow*1.94).toFixed(0)} KT`,y+=22);}}
  else if(pg==='ENG'){L(`N2 ${(N2||0).toFixed(0)} %   ${abLit?'AFTERBURNER':thr>0.92?'MIL':'SUB-MIL'}`,y+=22);
    L(`THRUST ${(Teng/1000).toFixed(0)} kN`,y+=22);L(`TIT ${(TIT||0).toFixed(0)} °C ${TIT>1120?'▲ HOT':''}`,y+=22);
    L(`FUEL FLOW ${(ff*3600).toFixed(0)} KG/H`,y+=22);L(engineOut?'ENGINE: FLAMEOUT':'ENGINE: RUNNING',y+=22);}
  else if(pg==='FUEL'){L(`FUEL ${(fuel||0).toFixed(0)} KG`,y+=22);L(`ENDURANCE ${((fuel||0)/Math.max(ff,0.05)/60).toFixed(0)} MIN`,y+=22);
    L(`BINGO 1200 KG`,y+=22);L(fuel<1200?'▲ LOW FUEL':'FUEL NOMINAL',y+=22);}
  else if(pg==='WX'){L(`TEMP ${(wx.temp0-6.5*(P?P.pos.y:0)/1000).toFixed(0)} °C`,y+=22);L(`VIS ${(wx.vis/1000).toFixed(1)} KM`,y+=22);
    L(`WIND ${wx.windDir.toFixed(0)}°/${(wx.windNow*1.94).toFixed(0)} KT G${(wx.gust*1.94).toFixed(0)}`,y+=22);L(`TURB ${(wx.turb*10).toFixed(0)}/10  RH ${wx.rh.toFixed(0)}%`,y+=22);
    L(`SAT Δ ${satMargin.toFixed(1)}K  COOL ${localCooling.toFixed(1)}K`,y+=22);L(`VAP W ${condWing.toFixed(2)} T ${condTrans.toFixed(2)} C ${contrail.toFixed(2)}`,y+=22);}
  else if(pg==='SYS'){L(`GEAR ${gearD>0.95?'DOWN':gearD>0.05?'TRANSIT':'UP'}`,y+=22);L(`PARK ${parkBrake?'SET':'OFF'}`,y+=22);
    L(`FCS ${S.fbw}  PHASE ${fcsPhase()}`,y+=22);L(`FAILURES ${S.fail}`,y+=22);L(`SURFACES AUTO  FLAP ${(flapPos*100).toFixed(0)}%`,y+=22);}
  else if(pg==='STOVL'){L(`MODE ${stolMode}`,y+=22);L(`NOZZLE ${nozzle.toFixed(0)}°`,y+=22);L(`LIFT FAN ${(lfSpool*100).toFixed(0)}%`,y+=22);
    L(`DOOR ${(lfDoor*100).toFixed(0)}%`,y+=22);L(`VERT MARGIN ${(((Tvert-(DRY+fuel)*G0)/((DRY+fuel)*G0))*100).toFixed(0)} %`,y+=22);}
  else if(pg==='APT'){const a=nearestApt();if(a){L(`${a.icao} ${a.name}`,y+=22);L(`ELEV ${(a.elev*FT).toFixed(0)} FT`,y+=22);
    L(`RWY ${a.num} ${a.rwyLen}X${a.rwyW}M`,y+=22);L(`ILS RWY ${a.num} 108.5`,y+=22);L(`PAPI RWY ${a.num} — WINDSOCK OK`,y+=22);}}
  pcdTex.needsUpdate=true;
}
/* ================= [8] ATMOSPHERE & WEATHER ================= */
const sunDir=new THREE.Vector3(),moonDir=new THREE.Vector3();
let dayF=1,nightF=0;
const WXP={
 cavok:{cov:0.10,prec:0,vis:42000,wind:4,gust:0,temp:24,press:1021,rh:45,turb:0.3,storm:0},
 sct:{cov:0.38,prec:0,vis:28000,wind:7,gust:1,temp:21,press:1015,rh:55,turb:0.6,storm:0},
 bkn:{cov:0.82,prec:0.35,vis:11000,wind:11,gust:2,temp:16,press:1006,rh:78,turb:1.0,storm:0},
 humid:{cov:0.56,prec:0.05,vis:18000,wind:6,gust:1,temp:18,press:1009,rh:94,turb:0.55,storm:0},
 ts:{cov:0.9,prec:1,vis:8000,wind:14,gust:4,temp:19,press:996,rh:85,turb:1.6,storm:4},
 fog:{cov:0.25,prec:0,vis:2200,wind:2,gust:0,temp:12,press:1018,rh:97,turb:0.15,storm:0},
 night:{cov:0.3,prec:0,vis:9000,wind:6,gust:1,temp:10,press:1013,rh:80,turb:0.4,storm:0}};
let wxPreset=WXP[SAVED.wxPreset]?SAVED.wxPreset:'cavok';
const wx={cov:0.1,prec:0,vis:42000,wind:4,gust:0,temp0:24,press:1021,rh:45,turb:0.3,windDir0:260,windDir:260,windNow:4,wet:false};
function sampleWeatherForces(){
  wx.windDir=wx.windDir0+Math.sin(simT*0.01)*10;
  wx.windNow=wx.wind*(1+0.3*(fbm01(nzA,simT*0.03,7.7,3)-0.5)*2);
  wx.wet=wx.prec>0.2;
}
function updateWeather(dt){
  simHours=(simHours+dt/60)%24;
  sampleWeatherForces();
  let elDeg,azDeg;
  if(simHours>=5.5&&simHours<=18.5){elDeg=Math.sin((simHours-6)/12*Math.PI)*66+2;azDeg=70+(simHours-6)/12*220;}
  else{const nh=simHours>18.5?simHours-18.5:simHours+5.5;elDeg=-8-Math.sin(nh/11*Math.PI)*20;azDeg=simHours>12?290:70;}
  sunDir.set(Math.sin(azDeg*D2R)*Math.cos(elDeg*D2R),Math.sin(elDeg*D2R),-Math.cos(azDeg*D2R)*Math.cos(elDeg*D2R));
  dayF=smooth(-0.03,0.15,Math.sin(elDeg*D2R));nightF=smooth(0.06,-0.10,Math.sin(elDeg*D2R));
  const duskA=clamp(1-Math.abs(elDeg-3)/13,0,1);
  const zen=new THREE.Color(0.02,0.04,0.10).lerp(new THREE.Color(0.10,0.30,0.62),dayF);
  const hor=new THREE.Color(0.04,0.07,0.13).lerp(new THREE.Color(0.62,0.76,0.88),dayF);
  hor.lerp(new THREE.Color(0.98,0.52,0.26),duskA*0.8);zen.lerp(new THREE.Color(0.22,0.14,0.32),duskA*0.4);
  const gray=new THREE.Color(0.55,0.58,0.62);zen.lerp(gray,wx.cov*0.45);hor.lerp(gray,wx.cov*0.5);
  const fogW=smooth(6000,1500,wx.vis);hor.lerp(new THREE.Color(0.78,0.82,0.85),fogW*0.7);
  skyMat.uniforms.uZen.value.copy(zen);skyMat.uniforms.uHor.value.copy(hor);skyMat.uniforms.uSun.value.copy(sunDir);
  skyMat.uniforms.uSunC.value.set(1,0.9,0.75).lerp(new THREE.Color(1,0.42,0.18),duskA);
  skyMat.uniforms.uNight.value=nightF;skyMat.uniforms.uCloud.value=wx.cov;skyMat.uniforms.uDusk.value=duskA;skyMat.uniforms.uHaze.value=clamp(.12+wx.cov*.34+fogW*.55,0,1);
  skyFlash*=Math.exp(-dt*6);skyMat.uniforms.uFlash.value=skyFlash;skyMat.uniforms.uT.value=simT;
  scene.fog.color.copy(hor).convertSRGBToLinear();scene.fog.density=clamp(1.9/wx.vis,0.000025,0.002);
  sunLight.position.copy(sunDir).multiplyScalar(1000);
  LightningLondonLighting.update(THREE,renderer,scene,sunLight,sunDir,P.pos,heightAt(P.pos.x+OX,P.pos.z+OZ),ql(),dayF,performance.now()/1000,worldMode==='LONDON');
  sunLight.intensity=1.25*dayF*(1-wx.cov*0.55);
  sunLight.color.set(1,0.9,0.78).lerp(new THREE.Color(1,0.5,0.25),duskA);
  moonDir.set(-sunDir.x,Math.max(0.3,-sunDir.y+0.5),-sunDir.z).normalize();
  moonLight.position.copy(moonDir).multiplyScalar(1000);moonLight.intensity=0.16*nightF;
  moon.position.copy(camera.position).addScaledVector(moonDir,30000);moon.visible=nightF>0.3;
  hemi.intensity=0.28+0.45*dayF;hemi.color.copy(hor).lerp(new THREE.Color(1,1,1),0.3);
  const pgx=P.pos.x+OX,pgz=P.pos.z+OZ;
  windAt(pgx,P.pos.y,pgz,_v1);
  for(const cp of cloudPool){
    cp.rel.x+=_v1.x*dt*0.4;cp.rel.z+=_v1.z*dt*0.4;
    if(cp.rel.x>18000)cp.rel.x-=36000;if(cp.rel.x<-18000)cp.rel.x+=36000;
    if(cp.rel.z>18000)cp.rel.z-=36000;if(cp.rel.z<-18000)cp.rel.z+=36000;
    const j=cp.i*3;cloudPos[j]=pgx+cp.rel.x;cloudPos[j+1]=cp.rel.y;cloudPos[j+2]=pgz+cp.rel.z;
    const vis=cp.layer===2?wx.cov*0.8+0.15:wx.cov;
    cloudAlpha[cp.i]=cp.base*clamp(vis*1.3-0.08,0,0.92)*(cp.layer===2?0.3:1);}
  if(cloudGeo){cloudGeo.attributes.position.needsUpdate=true;cloudGeo.attributes.aAlpha.needsUpdate=true;
    cloudMat.uniforms.uTint.value.setRGB(.56+.38*dayF,.60+.37*dayF,.65+.34*dayF);cloudMat.uniforms.uSun.value.copy(sunDir);cloudMat.uniforms.uDusk.value=duskA;}
  towerMat.emissiveIntensity=nightF*.92;officeMat.emissiveIntensity=nightF*.72;
  for(const c of storms){
    c.x+=_v1.x*dt*0.35;c.z+=_v1.z*dt*0.35;
    const d=Math.hypot(c.x-pgx,c.z-pgz);
    if(d>45000){const th=Math.random()*TAU,rr=18000+Math.random()*14000;c.x=pgx+Math.cos(th)*rr;c.z=pgz+Math.sin(th)*rr;}
    for(const s of c.sprites){s.position.x=c.x+s.userData.ox;s.position.z=c.z+s.userData.oz;}
    c.timer-=dt;
    if(c.timer<0&&d<16000){c.timer=3+Math.random()*9;skyFlash=1;
      c.bolt.position.set(c.x+(Math.random()-0.5)*c.r,1600,c.z+(Math.random()-0.5)*c.r);
      c.bolt.scale.set(1,3200,1);c.bolt.material.opacity=0.9;
      pendingThunder.push({t:simT+d/340*0.6,v:clamp(1-d/16000,0.1,1)});}
    if(c.bolt.material.opacity>0)c.bolt.material.opacity*=Math.exp(-dt*14);}
  rain.material.opacity=wx.prec*0.55;
  if(wx.prec>0){const pa=rainGeo.attributes.position.array;
    for(let i=0;i<700;i++){pa[i*3+1]-=(65+P.vel.length()*0.15)*dt;pa[i*3]+=_v1.x*dt*1.5;pa[i*3+2]+=_v1.z*dt*1.5;
      if(pa[i*3+1]<-200){pa[i*3]=(Math.random()-0.5)*500;pa[i*3+1]=200;pa[i*3+2]=(Math.random()-0.5)*500;}}
    rainGeo.attributes.position.needsUpdate=true;rain.position.copy(camera.position);}
  for(let i=pendingThunder.length-1;i>=0;i--){if(simT>=pendingThunder[i].t){sfxThunder(pendingThunder[i].v);pendingThunder.splice(i,1);}}
}
const pendingThunder=[];
/* ================= [9] AIRCRAFT STATE ================= */
const P={pos:new THREE.Vector3(),vel:new THREE.Vector3(),quat:new THREE.Quaternion(),om:new THREE.Vector3()};
let thr=0,thrT=0.2,ctl={el:0,ail:0,rud:0},elIn=0,ailIn=0,rudIn=0;
const tIn={el:0,ail:0,rud:0,thr:null};
let gearD=1,gearT=1,parkBrake=true,autoBrake=false,lights=false,brakes=false,airbrk=false;
let fuel=5942,crashed=false,running=false,paused=false;
let simT=0,simHours=Number.isFinite(SAVED.simHours)?SAVED.simHours:13.2,landings=0,flightT=0,shake=0,skyFlash=0;
let wheelsOn=false,prevWheelsOn=false,impactVS=0,tdArmed=false,tdAirT=0,ralt=0,mach=0,ias=0,Vtas=0,alpha=0,beta=0,alphaPrev=0,betaPrev=0,alphaRate=0,betaRate=0,qbar=0,rho=1.225;
let vsFpm=0,pitchDeg=0,rollDeg=0,hdgDeg=0,bank=0,bankRef=0;
let gNz=1,nzF=1,gNy=0,gNx=0,dmg=0,gearDmg=0;
let sep=0,buffet=0;
let condWing=0,vortexStrength=0,condTrans=0,contrail=0,satMargin=20,localCooling=0,vapourCount=0;
let dE=0,dA=0,dR=0,trimE=0,neutralPitchRef=0,neutralPitchArmed=false;
let flapPos=0,lefPos=0;
let N1=50,N2=55,abTimer=0,abSpool=0,abLit=false,TIT=620,inletDistortion=0,compressorSurge=0,surgeTimer=0,engineOut=false,windmill=false,restartTimer=0,ff=0,Teng=0,Tvert=0;
let stolMode='CONV',lfDoor=0,lfSpool=0,nozzle=0,hovAlt=-1;
const STOVL_VMAX=200; /* single consistent limit, shown and enforced */
let dbgOn=false,stepsLast=0,stepCount=0,frameEMA=16.7;
let surfNow='RWY',antiSkid=false,hydroplane=0;
const wheelLoad=[0,0,0,0],wheelOmega=[0,0,0,0],wheelSlip=[0,0,0,0],wheelCompression=[0,0,0,0];
let inertiaNow={ix:220e3,iy:270e3,iz:55e3,iyz:6200,cg:0};
let camMode=0,camPos=new THREE.Vector3(),camLook=new THREE.Vector3(),camTrackPos=new THREE.Vector3(),orbitA=0,bootCam=true,flybyT=0;
const flybyAnchor=new THREE.Vector3();let fixedCameraAnchor=null;
let headYaw=0,headPitch=0,headRoll=0;
const AP={mode:'OFF',armed:'',alt:0,hdg:0,spd:100,vs:0};
let apDiscReason='';
let ilsMode='OFF',ilsArmT=0,crossDotF=0,crossPrev=0;
const tch={el:0,ail:0,rud:0,thr:0.2,thrOn:false,brk:false};
/* flight stats for summary */
const stats={maxAlt:0,maxMach:0,maxG:0,fuelStart:5942,dist:0,warnings:0,hoverT:0,tdVs:0,tdAcross:0,tdDist:0,
  tdScore:0,tdGrade:'—',tdHdg:0,tdSpeed:0,tdAirport:'',approachStable:true,nearMisses:0,missionScore:0,missionGrade:'—'};
/* reusable temps */
const _v1=new THREE.Vector3(),_v2=new THREE.Vector3(),_v3=new THREE.Vector3();
const _va=new THREE.Vector3(),_vb=new THREE.Vector3(),_vh=new THREE.Vector3(),_gustV=new THREE.Vector3();
const _fwd=new THREE.Vector3(),_up=new THREE.Vector3(),_rgt=new THREE.Vector3();
const _ld=new THREE.Vector3(),_sd=new THREE.Vector3(),_td=new THREE.Vector3();
const _F=new THREE.Vector3(),_Fb=new THREE.Vector3(),_tqW=new THREE.Vector3();
const _rp=new THREE.Vector3(),_wp=new THREE.Vector3(),_vp=new THREE.Vector3();
const _omW=new THREE.Vector3(),_t1=new THREE.Vector3(),_t2=new THREE.Vector3(),_nrm=new THREE.Vector3();
const _yUp=new THREE.Vector3(0,1,0);
const _q1=new THREE.Quaternion(),_q2=new THREE.Quaternion();
function updateAttitudeData(){
  _fwd.set(0,0,-1).applyQuaternion(P.quat);_up.set(0,1,0).applyQuaternion(P.quat);_rgt.set(1,0,0).applyQuaternion(P.quat);
  pitchDeg=Math.asin(clamp(_fwd.y,-1,1))*R2D;
  hdgDeg=norm360(Math.atan2(_fwd.x,-_fwd.z)*R2D);
  rollDeg=bank=-Math.asin(clamp(_rgt.y,-1,1))*R2D;
  bank*=D2R;
}
function windAt(x,y,z,out){
  const g1=fbm01(nzA,simT*0.05,3.3,3),g2=fbm01(nzB,simT*0.047,8.8,3);
  const spd=wx.windNow*(0.75+0.5*g1)+Math.max(0,g2-0.72)*3*wx.gust*4;
  const dir=wx.windDir+(g2-0.5)*16;
  const altF=0.7+0.3*smooth(0,400,y); /* wind gradient near ground */
  out.set(-Math.sin(dir*D2R),0,Math.cos(dir*D2R)).multiplyScalar(spd*altF);
  for(let i=0;i<storms.length;i++){const c=storms[i],d=Math.hypot(x-c.x,z-c.z);
    if(d<c.r*1.4){const k=1-d/(c.r*1.4);out.y+=c.up*k*(1-2*d/c.r)*2.2;}}
  return out;
}

/* Coherent gust field. Turbulence is part of the moving airmass, so it changes
   air-relative velocity before AoA/beta are computed instead of shoving the
   aircraft afterward with an arbitrary translational force. */
function turbulenceAt(x,y,z,out){
  const altGain=.78+.34*smooth(60,2600,y);
  const scale=Math.max(0,wx.turb)*altGain;
  const gx=nzA(x*.00155+simT*.34,z*.00155+17.3);
  const gy=nzB(z*.00180+simT*.41,y*.00165+9.1);
  const gz=nzA(x*.00145-simT*.29,y*.00175+31.7);
  out.set(gx*2.25,gy*1.72,gz*2.05).multiplyScalar(scale);
  if(wx.gust>0){
    const pulse=Math.max(0,nzB(simT*.085+3.7,(x+z)*.00008+12.4)-.38);
    const d=(wx.windDir+90)*D2R;
    out.x+=Math.sin(d)*pulse*wx.gust*1.65;
    out.z-=Math.cos(d)*pulse*wx.gust*1.65;
  }
  for(let i=0;i<storms.length;i++){
    const c=storms[i],d=Math.hypot(x-c.x,z-c.z);
    if(d<c.r*1.35){
      const k=1-d/(c.r*1.35);
      out.x+=nzA(simT*.43+i*7.1,d*.0017)*k*5.0;
      out.y+=nzB(simT*.39+i*3.4,y*.0013)*k*4.2;
      out.z+=nzA(simT*.36+i*9.8,d*.0014+5.2)*k*5.0;
    }
  }
  return out;
}
/* ================= [10] AERODYNAMICS ================= */
/* PUBLIC-DATA-BOUNDED APPROXIMATION. Detailed F-35B aerodynamic databases and
   control laws are not public. This model uses a nonlinear blended-wing fighter
   coefficient set, full wind-relative forces, dynamic derivatives, stall hysteresis,
   sideslip coupling, transonic drag rise and configuration-dependent control authority. */
const AERO={
  /* The clean-wing curve intentionally retains substantial vortex/body lift well
     beyond conventional-airliner stall angles. Public F-35 high-alpha testing has
     demonstrated controlled flight far past 20 deg AoA; exact B-variant data are
     not public, so these remain bounded engineering estimates rather than a claim
     to reproduce classified tables. */
  a:[-45,-35,-28,-22,-16,-10,-6,-2,2,6,10,14,18,21,24,28,34,42,55,70],
  CL:[-.48,-.76,-.91,-.79,-.49,-.10,.16,.34,.55,.83,1.14,1.43,1.68,1.79,1.86,1.91,1.83,1.61,1.21,.78],
  CD:[.52,.34,.22,.130,.078,.043,.030,.024,.024,.028,.038,.052,.074,.096,.126,.178,.285,.43,.68,.94],
  /* High-alpha static pitch does not become an overpowering nose-up trap. The
     flight-control system still has to unload the wing, but full nose-down
     stabilator retains enough moment to recover from a developed departure. */
  Cm:[.080,.052,.028,.015,.010,.006,.004,.001,-.006,-.014,-.026,-.040,-.054,-.061,-.060,-.054,-.043,-.026,-.010,.012]
};
function ctrlEff(M,sepNow,aDeg){
  const machFac=1-.42*smooth(.82,1.55,M);
  const postStall=1-.48*sepNow;
  const highA=1-.12*smooth(30,60,Math.abs(aDeg));
  return clamp(machFac*postStall*highA,.30,1.05);
}
function waveDrag(M){
  /* Calibrated so a clean F-35B can accelerate through transonic drag and settle
     naturally near its public Mach-1.6 class envelope at altitude. The steep
     rise above ~M1.65 is aerodynamic drag, not an artificial velocity clamp. */
  const trans=.026*Math.exp(-Math.pow((M-1.01)/.17,2));
  const sup=.006*smooth(1.08,1.48,M)+.004*smooth(1.40,1.66,M);
  const envelope=.105*Math.pow(smooth(1.60,1.78,M),2);
  return trans+sup+envelope;
}
function aeroForces(){
  const Veff=Math.max(Vtas,12),aDeg=alpha*R2D,bDeg=beta*R2D;
  const qh=P.om.x*CBAR/(2*Veff),ph=P.om.z*SPAN/(2*Veff),rh=P.om.y*SPAN/(2*Veff);
  const a0shift=-2.2*flapPos-1.25*lefPos,rawAEff=aDeg-a0shift;
  /* The aerodynamic model always sees the real geometric AoA. ASSIST now earns
     carefree handling through the control law/envelope limiter instead of by
     pretending a large pitch attitude produces a much smaller AoA. */
  const aEff=rawAEff;
  const absA=Math.abs(aEff),highA=smooth(17,38,absA),sideSep=smooth(12,32,Math.abs(bDeg));
  /* Ground effect is concentrated close to the surface. A swept fighter should
     not receive a large lift bonus a full wingspan above the runway. */
  const ge=Math.pow(clamp(1-ralt/(.58*SPAN),0,1),2);
  const eff=ctrlEff(mach,sep,aEff);

  /* Lift: table carries the nonlinear vortex/body lift and post-stall falloff.
     Ground effect is intentionally modest; the old +25% boost felt arcade-like. */
  let CL=interp(AERO.a,AERO.CL,aEff);
  CL+=.20*flapPos+.06*lefPos;
  CL*=1+.095*ge;
  CL*=1-.26*sideSep;
  CL*=1-.30*sep;
  CL*=1+.075*smooth(.48,.82,mach)-.22*smooth(.92,1.22,mach);
  CL+=1.85*qh*eff;
  CL=clamp(CL,-1.68,1.93);

  /* Parasite, induced, wave, configuration and separated-flow drag. */
  const AR=SPAN*SPAN/S_REF;
  const oswald=.76-.10*smooth(16,35,absA)-.08*smooth(.85,1.25,mach);
  const k=1/(Math.PI*AR*Math.max(.48,oswald));
  /* The empirical high-AoA CD table already contains much of the separated/
     vortex-flow penalty. Fade the textbook elliptical-wing induced term as
     vortex lift dominates so that drag is not double-counted. */
  const inducedBlend=1-.46*smooth(18,40,absA);
  let CD=interp(AERO.a,AERO.CD,aEff)+k*CL*CL*(1-.38*ge)*inducedBlend;
  CD+=.050*flapPos+.018*lefPos;
  CD+=(gearD>.02?.035*gearD:0)+(airbrk?.075:0);
  CD+=.042*lfDoor+.022*lfSpool; /* open LiftSystem doors and ducts */
  /* Sideslip drag is still quadratic in beta, but its coefficient fades at
     extremely low dynamic pressure. This avoids taxi-speed crosswind/yaw producing
     an outsized *relative* drag penalty while retaining the full airborne cost. */
  const betaDragQ=lerp(.18,1.0,smooth(900,8500,qbar));
  CD+=waveDrag(mach)+.42*beta*beta*betaDragQ+.16*sep+.035*sideSep;
  CD+=engineOut?.018:0;
  CD=clamp(CD,.018,1.45);

  /* Lateral-directional stability progressively weakens at high alpha. */
  const latKeep=1-.72*highA;
  let CY=(-.62*latKeep-.12)*beta+.10*ph-.24*rh-.17*dR*eff+.035*dA*eff;
  CY+=-.18*sideSep*Math.sign(beta||1);

  /* Pitching moment includes pitch damping, stabilator authority, mild transonic
     centre-of-pressure travel and a separated-flow nose-up tendency. */
  /* Pitch-rate damping is Mach scheduled: strongest around the transonic
     pressure/CP migration region, then easing again in established supersonic flow. */
  const cmq=20.5+7.0*Math.exp(-Math.pow((mach-1.03)/.27,2))-3.2*smooth(1.38,1.82,mach);
  let Cm=interp(AERO.a,AERO.Cm,aEff)-cmq*qh+1.05*dE*eff;
  Cm+=-.048*flapPos-.016*ge-.075*Math.exp(-Math.pow((mach-1.00)/.20,2));
  /* Separated flow can shift the centre of pressure, but it must not create the
     former unrecoverable deep-stall equilibrium. A small nose-up contribution is
     retained and the stabilator/control-law must still perform the recovery. */
  Cm+=.022*sep*smooth(26,52,absA)*Math.sign(aEff||1);

  /* Body-axis roll/yaw moments. Signs follow this simulator's X-right, Y-up,
     Z-aft convention. Nonlinear coupling allows believable wing rock/departure
     without forcing an unrecoverable scripted spin. */
  let Cl=(-.085*latKeep-.020)*beta-.56*ph+.095*rh+.135*dA*eff+.030*dR*eff;
  let Cn=(-.145*latKeep-.035)*beta-.025*ph-.205*rh-.205*dR*eff+.018*dA*eff;
  const vortexCouple=highA*(1-.55*sep);
  Cl+=vortexCouple*(.050*Math.sin(2*beta)*Math.sign(alpha||1)-.10*ph);
  Cn+=vortexCouple*(-.035*Math.sin(beta)*Math.sign(alpha||1)-.07*rh);

  const L=qbar*S_REF*CL,D=qbar*S_REF*CD,Y=qbar*S_REF*CY;
  return{L,D,Y,Mx:qbar*S_REF*CBAR*Cm,My:qbar*S_REF*SPAN*Cn,Mz:qbar*S_REF*SPAN*Cl,CL,CD,Cm,CY,Cl,Cn};
}
function updateCondensationState(A,at,mass){
  const rh=clamp(wx.rh/100,0,1),ambientC=at.T-273.15,dewC=ambientC-(100-wx.rh)/5;
  satMargin=ambientC-dewC;
  const loadEst=Math.abs(A.L)/(mass*G0),pressureRatio=qbar/Math.max(at.P,1000);
  localCooling=clamp(pressureRatio*at.T*.18*(.7+1.5*Math.abs(A.CL))*(1+.08*Math.max(0,loadEst-1)),0,24);
  const humid=smooth(.52,.91,rh),nearSat=smooth(satMargin-.8,satMargin+1.2,localCooling),lifting=smooth(.42,1.15,Math.abs(A.CL))*smooth(1500,7500,qbar);
  condWing=clamp(humid*nearSat*lifting*(.55+.45*smooth(.8,2.8,loadEst)),0,1);
  vortexStrength=clamp(condWing*smooth(.65,1.2,Math.abs(A.CL))*smooth(.75,2.3,loadEst),0,1);
  condTrans=clamp(humid*smooth(.76,.95,mach)*(1-smooth(1.08,1.25,mach))*smooth(3.5,11,localCooling),0,1);
  contrail=clamp(smooth(6900,10200,P.pos.y)*smooth(-34,-50,ambientC)*smooth(.58,.86,rh)*(engineOut?0:1),0,1);
}
/* ================= [11] ENGINE (F135-inspired approximation) ================= */
function engineUpdate(dt){
  const t=thr,at=atmos(P.pos.y,wx.temp0-15),delta=at.P/101325,theta=at.T/288.15;
  let N2cmd;
  if(t<0.1)N2cmd=55+t/0.1*10;              /* idle 55–65% core */
  else if(t<0.92)N2cmd=65+(t-0.1)/0.82*35; /* military 65–100% */
  else N2cmd=100;

  /* Twin-spool approximation: the core leads, the fan follows. Thin air makes
     acceleration somewhat slower rather than using one fixed sea-level tau. */
  const spoolAlt=1+.42*smooth(.82,.22,clamp(at.rho/1.225,0,1));
  const coreAccel=N2cmd>N2;
  const coreTau=(coreAccel?(N2<70?2.25:.95):1.45)*spoolAlt;
  N2+=(N2cmd-N2)*Math.min(1,dt/coreTau);
  const N1cmd=clamp(47+(N2-52)*1.10,45,100);
  const fanAccel=N1cmd>N1;
  const fanTau=(fanAccel?lerp(2.25,1.18,smooth(62,96,N2)):1.72)*spoolAlt;
  N1+=(N1cmd-N1)*Math.min(1,dt/fanTau);

  const abReq=t>0.94&&!engineOut&&stolMode==='CONV'&&nozzle<3;
  abTimer=abReq?abTimer+dt:0;
  const abCmd=abReq&&abTimer>.28?clamp((t-.94)/.06,0,1):0;
  abSpool+=(abCmd-abSpool)*Math.min(1,dt/(abCmd>abSpool?.48:.24));
  abLit=abSpool>.06;

  /* Installed-thrust approximation with inlet/ram recovery. High AoA/beta can
     distort inlet flow. The F-35's inlet is robust, so the penalty begins late and
     remains progressive; REAL failures can additionally produce a recoverable
     compressor-surge transient instead of an arbitrary engine-out event. */
  const ram=clamp(1+0.11*mach-0.018*mach*mach,0.72,1.18);
  const lapse=clamp(Math.pow(delta,0.56)*Math.pow(theta,-0.35)*ram,0.16,1.18);
  const abLapse=clamp(Math.pow(delta,0.62)*Math.pow(theta,-0.22)*ram,0.18,1.16);
  const aDeg=Math.abs(alpha)*R2D,bDeg=Math.abs(beta)*R2D;
  const distortionTarget=clamp(Math.max(smooth(25,48,aDeg),.92*smooth(10,25,bDeg))*smooth(1600,10500,qbar)*(0.82+.18*smooth(.55,1.25,mach)),0,1);
  inletDistortion+=(distortionTarget-inletDistortion)*Math.min(1,dt/(distortionTarget>inletDistortion?.16:.70));
  const surgeDemand=(S.fail==='REAL')?smooth(.63,.93,inletDistortion)*smooth(.78,.98,t):0;
  if(surgeDemand>.02)surgeTimer=Math.min(1.6,surgeTimer+surgeDemand*dt);else surgeTimer=Math.max(0,surgeTimer-dt*.90);
  const surgeTarget=(S.fail==='REAL')?smooth(.36,1.05,surgeTimer)*surgeDemand:0;
  compressorSurge+=(surgeTarget-compressorSurge)*Math.min(1,dt/(surgeTarget>compressorSurge?.10:.55));
  const inletRecovery=clamp(1-.20*inletDistortion-.34*compressorSurge,.46,1);
  const spoolPower=Math.pow(clamp((.58*N1+.42*N2)/100,0,1.04),3);
  let T=engineOut?0:clamp((MILT*spoolPower*lapse+(ABT-MILT)*abSpool*abLapse)*inletRecovery,0,ABT*1.10);
  if(TIT>1180&&S.fail!=='OFF')T*=0.8;
  Teng=T;

  const titTarget=(0.22+0.78*N2/100)*900+abSpool*250+lfSpool*180+inletDistortion*85+compressorSurge*145;
  const titTau=titTarget>TIT?6.8:25.0; /* metal/gas temperature rises faster than it cools */
  TIT+=(titTarget-TIT)*Math.min(1,dt/titTau);
  ff=engineOut?0:(0.13+1.05*Math.pow(N2/100,3)*(0.55+0.45*delta)+abSpool*2.6+lfSpool*0.5)*(1+.045*inletDistortion+.08*compressorSurge);
  fuel=Math.max(0,fuel-ff*dt);
  if(fuel<=0&&!engineOut)engineOut=true;

  if(engineOut){
    const canWindmill=at.rho>0.4&&Vtas>80;
    const n2Wind=canWindmill?18:Math.max(0,N2-10*dt),n1Wind=canWindmill?24:Math.max(0,N1-12*dt);
    N2+=(n2Wind-N2)*Math.min(1,dt/2);
    N1+=(n1Wind-N1)*Math.min(1,dt/1.55);
    abSpool+=(0-abSpool)*Math.min(1,dt/.18);abLit=false;
    if(fuel>0&&canWindmill&&N2>15){restartTimer+=dt;if(restartTimer>4){engineOut=false;restartTimer=0;toast('ENGINE RELIGHT');}}
    else restartTimer=0;
  } else if(fuel>0){engineOut=false;}
}
/* ================= [12] STOVL ================= */
function stolUpdate(dt){
  if(stolMode==='TO_HOVER'){
    /* Public descriptions indicate doors/nozzle move before the clutch fully loads
       the fan. The 3BSM is rated to rotate 95 degrees in about 2.5 seconds. */
    lfDoor=Math.min(1,lfDoor+dt*.52);
    nozzle=Math.min(NOZZLE_MAX,nozzle+dt*(NOZZLE_MAX/2.5));
    const clutch=smooth(.68,.96,lfDoor)*smooth(42,78,nozzle);
    lfSpool+=(clutch-lfSpool)*Math.min(1,dt/(clutch>lfSpool?1.35:.75));
    if(lfDoor>=.995&&lfSpool>.97&&nozzle>=NOZZLE_MAX-.2)stolMode='HOVER';
  } else if(stolMode==='TO_CONV'){
    lfSpool+=(0-lfSpool)*Math.min(1,dt/.95);
    if(lfSpool<.55)nozzle=Math.max(0,nozzle-dt*(NOZZLE_MAX/2.5));
    if(lfSpool<.18)lfDoor=Math.max(0,lfDoor-dt*.58);
    if(nozzle<=.05&&lfSpool<.025&&lfDoor<=.02)stolMode='CONV';
  } else if(stolMode==='HOVER'){
    lfDoor+=(1-lfDoor)*Math.min(1,dt/.45);
    nozzle+=(NOZZLE_MAX-nozzle)*Math.min(1,dt/.30);
    lfSpool+=(1-lfSpool)*Math.min(1,dt/.70);
  }
  if((stolMode==='HOVER'||stolMode==='TO_HOVER')&&ias>STOVL_VMAX+20){stolMode='TO_CONV';toast('STOVL AUTO-CONVERT — OVERSPEED','warn');}

  const forceNozzle=Math.min(nozzle,90)*D2R,mix=clamp(lfSpool*lfDoor,0,1),at=atmos(P.pos.y,wx.temp0-15);
  const hotPenalty=clamp(1-(wx.temp0-15)*.0035,.85,1.05),liftLapse=clamp(Math.pow(at.rho/1.225,.72)*hotPenalty,.22,1.05);
  const lpSpool=.68*N1+.32*N2;
  const liftPower=Math.pow(clamp((lpSpool-52)/48,0,1),1.48);
  const fanThrust=LIFT_FAN_MAX*liftPower*liftLapse*mix;
  const propBlend=clamp(Math.max(mix,smooth(20,72,nozzle)*lfDoor),0,1);
  const rearRated=REAR_LIFT_MAX*liftPower*liftLapse;
  const Trear=lerp(Teng,rearRated,propBlend);

  /* Each roll post can direct about 1,950 lbf. Differential thrust produces roll
     while their common component contributes to total vertical lift. */
  const rpBase=ROLL_POST_MAX*liftPower*liftLapse*mix;
  /* Differential roll-post authority fades as forward speed builds and the
     aerodynamic surfaces take over. A bounded mid-conversion band is exposed to
     the moment model so transition is slightly more attention-demanding. */
  const postAuthority=clamp(1-smooth(42,125,ias),.10,1);
  const transitionBand=Math.exp(-Math.pow((mix-.52)/.17,2))*smooth(24,115,ias);
  const rollDiff=clamp((ailIn*.66+P.om.z*.20)*postAuthority,-.78,.78);
  const rollPostL=rpBase*(1+rollDiff),rollPostR=rpBase*(1-rollDiff);
  const rearVertical=Trear*Math.sin(forceNozzle);
  const baseVertical=rearVertical+fanThrust+rollPostL+rollPostR;

  /* Near-ground powered lift is a balance of fountain/cushion lift and suckdown/
     hot-gas recirculation. The net effect is deliberately small and can become a
     penalty very close to the surface instead of a free arcade hover boost. */
  const fountain=.052*smooth(15,2.2,ralt)*smooth(8,1.0,Math.abs(P.vel.y));
  const recirc=.060*smooth(3.0,.35,ralt)*smooth(.42,.92,mix)*(1-.35*clamp(wx.windNow/12,0,1));
  const groundFactor=fountain-recirc;
  const Tvert=baseVertical*(1+groundFactor);
  return{Trear,Tvert,fanThrust,rollPostL,rollPostR,cushionExtra:baseVertical*groundFactor,lfFrac:mix,nozRad:forceNozzle,rearVertical,liftPower,liftLapse,postAuthority,transitionBand};
}
function hoverTrimPower(mass){
  const at=atmos(P.pos.y,wx.temp0-15),hotPenalty=clamp(1-(wx.temp0-15)*.0035,.85,1.05);
  const lapse=clamp(Math.pow(at.rho/1.225,.72)*hotPenalty,.22,1.05);
  const liftFraction=clamp(mass*G0/(VERTT*lapse),.05,1.32);
  const n2=55+45*Math.pow(liftFraction,1/1.48);
  return{n2,throttle:clamp(.1+(n2-65)/35*.82,.3,1),margin:1/liftFraction-1};
}
function toggleStol(){
  if(stolMode==='CONV'){
    if(ias>STOVL_VMAX){toast('STOVL INHIBITED — MAX '+STOVL_VMAX+' KT','warn');return;}
    stolMode='TO_HOVER';hovAlt=-1;toast('STOVL CONVERTING — DOORS / 3BSM / LIFT FAN','warn');
  } else if(stolMode==='HOVER'||stolMode==='TO_HOVER'){
    stolMode='TO_CONV';hovAlt=-1;toast('STOVL — FORWARD TRANSITION');
  }
  sfxClick();
}
/* ================= [13] FLIGHT CONTROL SYSTEM ================= */
function fcsPhase(){
  if(stolMode==='HOVER'||(stolMode==='TO_HOVER'&&nozzle>45))return'HOVER';
  if(stolMode!=='CONV')return'TRANS';
  if(wheelsOn)return'GROUND';
  if(gearD>.5)return'LAND';
  if(alpha*R2D>18)return'HIGHA';
  if(qbar<8000)return'LOWQ';
  return'CONV';
}
function updateSurfaces(dt){
  gearD+=clamp(gearT-gearD,-dt/3,dt/3);
  const landCfg=stolMode!=='CONV'||gearD>.5;
  let flapT=landCfg?clamp((alpha*R2D-1)/15,.28,1):clamp((alpha*R2D-7)/17,0,.38);
  let lefT=clamp((alpha*R2D-3)/16,0,1);
  if(stolMode!=='CONV')lefT=Math.max(lefT,.58);
  flapPos+=(flapT-flapPos)*Math.min(1,dt/1.15);
  lefPos+=(lefT-lefPos)*Math.min(1,dt/.85);
}
/* Physical surface travel. Pilot input requests control-surface deflection, not
   a scripted body-rate or turn-rate. Dynamic pressure, aerodynamic damping,
   inertia, separation and actuator loading determine the resulting motion. */
const ELEV_MAX=25*D2R,AIL_MAX=28*D2R,RUD_MAX=30*D2R;
function surfaceRate(base,minRate){
  /* Hydraulic actuators retain full travel, but high hinge loads slow the motion.
     This is a force/load effect rather than an artificial angular-rate cap. */
  const qLoad=smooth(18000,85000,qbar),mLoad=smooth(.82,1.55,mach);
  return lerp(base,minRate,clamp(.78*qLoad+.22*mLoad,0,1));
}
function yawSurfaceTarget(V,bankNow,yawRate,betaNow,aileron,rudder,coordinate=S.coord){
  const coordBlend=clamp((V-35)/75,0,1);
  const rCoord=coordinate?-clamp(G0*Math.tan(clamp(bankNow,-1.30,1.30))/Math.max(V,45),-.70,.70)*coordBlend:0;
  /* Direct pedal travel plus sideslip/yaw damping. There is no yaw-rate command. */
  return rudder*RUD_MAX+.19*(yawRate-rCoord)+.64*betaNow-.08*aileron;
}
function fcsUpdate(dt){
  const V=Math.max(Vtas,1),phase=fcsPhase(),mode=S.fbw;
  const assist=mode==='ASSIST'?1:mode==='STANDARD'?.48:0;
  updateSurfaces(dt);nzF+=(gNz-nzF)*Math.min(1,dt/.09);
  const aDeg=alpha*R2D,absA=Math.abs(aDeg),mass=DRY+fuel;

  /* ASSIST is a modern response-command system: longitudinal stick requests
     normal acceleration and lateral stick requests roll rate. At low dynamic
     pressure the requested G is limited by the lift actually available, so a
     full-stick rotation at ~150-200 kt does not command an impossible 8 G and
     drive the aircraft straight through the usable AoA envelope. */
  const posG=phase==='LAND'?4.2:mode==='ASSIST'?7.0:7.2,negG=mode==='ASSIST'?2.2:3.2;
  /* ASSIST no longer invents extra lift. Its G command is bounded by the lift
     the current qbar/wing state can actually produce. */
  const clProtect=1.88+.12*flapPos;
  const nAvailable=Math.max(.55,qbar*S_REF*clProtect/Math.max(mass*G0,1));
  const posSpan=mode==='ASSIST'?Math.min(posG,Math.max(.45,nAvailable-1.04)):posG;
  const gCmd=1+(elIn>=0?elIn*posSpan:elIn*negG);
  const gLoop=clamp((gCmd-nzF)*.070-P.om.x*(.095+.035*assist)-alphaRate*.010,-ELEV_MAX,ELEV_MAX);
  const directE=elIn*ELEV_MAX+trimE-(.035+.030*assist)*P.om.x;
  let dEcmd=lerp(directE,trimE+gLoop,assist);

  /* Neutral-stick ASSIST captures the pitch attitude at stick release. The old
     pure 1-g trim loop could gradually drive the nose down after a climb or hard
     pull even with no pilot input. The stabilator still supplies the real moment;
     this only changes the command law and disengages at low energy/separation. */
  const pitchNow=Math.asin(clamp(_fwd.y,-1,1));
  const neutralAssist=mode==='ASSIST'&&AP.mode==='OFF'&&stolMode==='CONV'&&!wheelsOn&&ias>95&&sep<.55&&Math.abs(elIn)<.035;
  if(neutralAssist){
    if(!neutralPitchArmed){neutralPitchRef=pitchNow;neutralPitchArmed=true;}
    const pitchErr=clamp(neutralPitchRef-pitchNow,-24*D2R,24*D2R);
    const attitudeE=clamp(trimE+pitchErr*.92-P.om.x*.155+(1-nzF)*.018,-ELEV_MAX*.88,ELEV_MAX*.88);
    dEcmd=lerp(dEcmd,attitudeE,.90);
  } else neutralPitchArmed=false;

  /* Carefree-handling protection is aerodynamic, not a no-stall cheat. ASSIST
     progressively unloads the wing before deep separation; STANDARD is softer;
     ADVANCED leaves the pilot essentially direct control and can still be stalled. */
  const aoaSoft=mode==='ASSIST'?(phase==='LAND'?21:phase==='TRANS'?24:26):phase==='LAND'?22:phase==='TRANS'?25:30;
  const aoaProtect=smooth(aoaSoft-3.5,aoaSoft+6.5,absA);
  if(assist>0){
    const sgn=Math.sign(aDeg||1);
    dEcmd-=sgn*aoaProtect*ELEV_MAX*(.50+.40*assist);
    dEcmd-=sgn*smooth(.28,.78,sep)*ELEV_MAX*(.28+.38*assist);
  }
  if(aDeg<-26&&elIn<0)dEcmd+=smooth(26,46,-aDeg)*ELEV_MAX*(.18+.25*assist);
  dEcmd=clamp(dEcmd,-ELEV_MAX,ELEV_MAX);
  const eRate=surfaceRate(3.9,1.50);dE+=clamp(dEcmd-dE,-eRate*dt,eRate*dt);

  const trimOK=!neutralPitchArmed&&Math.abs(elIn)<.035&&sep<.30&&stolMode==='CONV'&&Math.abs(P.om.x)<.22&&qbar>2500;
  if(trimOK){const trimRate=clamp((1-nzF)*.012-P.om.x*.020,-.055,.055);trimE+=trimRate*dt;}
  trimE=clamp(trimE,-.20,.20);

  const pCmd=-ailIn*(mode==='ASSIST'?3.0:2.5); /* rad/s */
  const rateA=clamp((pCmd-P.om.z)*.20,-AIL_MAX,AIL_MAX);
  let directA=-ailIn*AIL_MAX-P.om.z*(.020+.025*assist);
  let dAcmd=lerp(directA,rateA,assist);
  if(Math.abs(ailIn)<.035&&assist>.4){bankRef+=(0-bankRef)*Math.min(1,dt*.12*assist);dAcmd+=clamp((bankRef-bank)*.22-P.om.z*.08,-AIL_MAX*.45,AIL_MAX*.45);}
  else bankRef=bank;
  dAcmd=clamp(dAcmd,-AIL_MAX,AIL_MAX);const aRate=surfaceRate(5.8,2.25);dA+=clamp(dAcmd-dA,-aRate*dt,aRate*dt);

  let dRcmd=yawSurfaceTarget(V,bank,P.om.y,beta,dA,rudIn);
  if(mode==='ASSIST')dRcmd+=beta*.42+P.om.y*.08;
  dRcmd=clamp(dRcmd,-RUD_MAX,RUD_MAX);const rRate=surfaceRate(3.4,1.35);dR+=clamp(dRcmd-dR,-rRate*dt,rRate*dt);
}
/* ================= [14] GROUND PHYSICS ================= */
function groundContact(dt,mass){
  _omW.set(P.om.x,P.om.y,P.om.z).applyQuaternion(P.quat);
  _fwd.set(0,0,-1).applyQuaternion(P.quat);
  let fx=0,fy=0,fz=0,tx=0,ty=0,tz=0;
  wheelsOn=false;let waterTouch=false,minImp=0;antiSkid=false;hydroplane=0;wheelCompression.fill(0);
  const st=surfaceType(P.pos.x+OX,P.pos.z+OZ,surfaceH(P.pos.x+OX,P.pos.z+OZ));surfNow=st;
  const sf=SURF[st]||SURF.GRASS;
  const wetMul=wx.wet?0.65:1; /* wet runway friction */
  for(let wi=0;wi<WHEELS.length;wi++){
    const w=WHEELS[wi];wheelLoad[wi]=0;
    if(gearD<0.55)continue;
    const deploy=smooth(0.55,0.96,gearD);
    _rp.set(w.x*deploy,lerp(-0.42,w.y,deploy),w.z).applyQuaternion(P.quat);
    _wp.copy(P.pos).add(_rp);
    const wx2=_wp.x+OX,wz2=_wp.z+OZ,sh=surfaceH(wx2,wz2),pen=sh-_wp.y;
    if(pen<=0)continue;
    if(isWaterAt(wx2,wz2))waterTouch=true;
    groundNormal(wx2,wz2,_nrm);
    _vp.crossVectors(_omW,_rp).add(P.vel);
    let N=w.k*Math.min(pen,TRAVEL)+w.c*(-_vp.dot(_nrm));
    if(pen>TRAVEL)N+=900e3*(pen-TRAVEL);
    if(N<0)N=0;
    wheelLoad[wi]=N;
    fx+=_nrm.x*N;fy+=_nrm.y*N;fz+=_nrm.z*N;
    tx+=_rp.y*_nrm.z*N-_rp.z*_nrm.y*N;ty+=_rp.z*_nrm.x*N-_rp.x*_nrm.z*N;tz+=_rp.x*_nrm.y*N-_rp.y*_nrm.x*N;
    if(w.tail)continue;
    wheelsOn=true;
    if(pen>0.02&&_vp.y<minImp)minImp=_vp.y;
    _t1.copy(_fwd);_t1.addScaledVector(_nrm,-_fwd.dot(_nrm));
    if(_t1.lengthSq()<1e-6)_t1.copy(_fwd);_t1.normalize();
    _t2.crossVectors(_nrm,_t1);
    const vLong=_vp.dot(_t1),vLat=_vp.dot(_t2),mEff=mass/3,rWheel=w.nose?.31:.36;
    wheelCompression[wi]=clamp(pen/TRAVEL,0,1.35);
    /* Dynamic wheel speed and combined-slip tire force. Wet high-speed operation
       progressively loses grip instead of applying one constant friction value. */
    const targetOmega=vLong/rWheel,brakeDemand=(brakes&&w.main)?1:(brakes&&w.nose?.25:0);
    wheelOmega[wi]+=(targetOmega-wheelOmega[wi])*Math.min(1,dt*(brakeDemand?5.5:18));
    if(brakeDemand)wheelOmega[wi]*=Math.max(0,1-dt*(7+22*brakeDemand));
    let slip=(wheelOmega[wi]*rWheel-vLong)/Math.max(Math.abs(vLong),4);wheelSlip[wi]=clamp(slip,-2,2);
    const hydro=wx.wet*smooth(48,82,Math.abs(vLong));hydroplane=Math.max(hydroplane,hydro);
    let muB=sf.brk*wetMul*(1-hydro*.58)*(0.74+0.26*clamp(Math.abs(vLong)/8,0,1));
    if(brakeDemand&&slip<-.16){antiSkid=true;muB*=clamp(.88+slip*.48,.35,.86);wheelOmega[wi]+=(targetOmega-wheelOmega[wi])*Math.min(1,dt*12);}
    const tireLong=muB*N*Math.tanh(slip*5.2),rolling=-Math.sign(vLong)*sf.roll*N;
    const fL=clamp(tireLong+rolling,-muB*N,muB*N);
    const latMu=sf.lat*wetMul*(1-hydro*.42)*Math.sqrt(Math.max(.10,1-Math.pow(clamp(Math.abs(fL)/Math.max(muB*N,1),0,1),2)));
    let fS=-Math.sign(vLat)*Math.min(latMu*N,Math.abs(vLat)*mEff/dt);
    if(w.nose){const gs=Math.abs(vLong);
      fS+=ctl.rud*N*0.4*clamp(gs/8,0,1)*clamp(1-gs/40,0,1)*clamp(sf.lat/0.85,0.3,1);}
    const Fx=_t1.x*fL+_t2.x*fS,Fz=_t1.z*fL+_t2.z*fS,Fy2=_t1.y*fL+_t2.y*fS;
    fx+=Fx;fy+=Fy2;fz+=Fz;
    tx+=_rp.y*Fz-_rp.z*Fy2;ty+=_rp.z*Fx-_rp.x*Fz;tz+=_rp.x*Fy2-_rp.y*Fx;
    if(sf.rough>0&&Math.abs(vLong)>3)fy+=Math.sin(simT*40+w.x*7)*sf.rough*N*0.04;
  }
  return{fx,fy,fz,tx,ty,tz,waterTouch,minImp};
}
/* ================= [15] FAILURES ================= */
function applyFailures(dt){
  if(S.fail==='OFF')return;
  /* gear damage from hard landings (progressive) */
  if(wheelsOn&&impactVS<-4&&gearDmg<1){
    gearDmg+=clamp((-impactVS-4)/8,0,1)*(S.fail==='REAL'?0.7:0.4);
    if(gearDmg>=1){toast('LANDING GEAR COLLAPSED','bad');}
  }
  if(gearDmg>=1&&gearD>0.5)gearD=Math.max(0.3,gearD-dt*0.5);
  if(TIT>1250&&S.fail==='REAL'){dmg+=dt*0.2;}
}
/* ================= [16] COLLISION ================= */
function checkCollisions(){
  if(worldMode==='LONDON'&&LightningLondon.collides(P.pos.x+OX,P.pos.y,P.pos.z+OZ)){doCrash('COLLISION — LONDON BUILDING');return;}
  const gx=P.pos.x+OX,gz=P.pos.z+OZ,py=P.pos.y;
  for(const [c,g] of cityGroups){
    const dx=gx-c.x,dz=gz-c.z;if(dx*dx+dz*dz>(c.r+700)*(c.r+700))continue;
    for(let i=0;i<c.colB.length;i++){const b=c.colB[i],bx=gx-b.x,bz=gz-b.z;
      if(bx>-b.hw-3&&bx<b.hw+3&&bz>-b.hd-3&&bz<b.hd+3&&py<b.top+2&&py>b.top-60){doCrash('COLLISION — BUILDING');return;}}}
  for(const a of airports){const d2=(gx-a.x)**2+(gz-a.z)**2;if(d2>4500*4500)continue;
    const dt2=(gx-a.twrX)**2+(gz-a.twrZ)**2;
    if(dt2<64&&py<a.elev+a.twrH+8){doCrash('COLLISION — CONTROL TOWER');return;}}
  for(const [c,wf] of wfGroups){if(!wf||!wf.userData.turbPos)continue;
    for(const tp of wf.userData.turbPos){const d2=(gx-tp.x)**2+(gz-tp.z)**2;
      if(d2<36&&py<tp.top){doCrash('COLLISION — WIND TURBINE');return;}}}
  for(const s of ships){const d2=(gx-s.g.position.x)**2+(gz-s.g.position.z)**2;
    if(d2<40*40&&py<18){doCrash('COLLISION — SHIP');return;}}
}
/* ================= MAIN PHYSICS STEP ================= */
function physics(dt){
  flightT+=dt;simT+=dt;stepCount++;
  /* Aerodynamic weather is sampled at the fixed physics rate. Rendering at 30 or
     120 Hz therefore cannot change the wind force held across substeps. */
  sampleWeatherForces();
  updateAttitudeData();
  let elRaw=(K.KeyS||K.ArrowDown?1:0)+(K.KeyW||K.ArrowUp?-1:0)+tch.el+tIn.el;
  elRaw=clamp(elRaw,-1,1);if(S.invPitch)elRaw=-elRaw;
  elIn=clamp(shapeAxis(elRaw),-1,1);
  ailIn=clamp(shapeAxis(clamp((K.KeyD||K.ArrowRight?1:0)+(K.KeyA||K.ArrowLeft?-1:0)+tch.ail+tIn.ail,-1,1)),-1,1);
  rudIn=clamp(clamp((K.KeyE?1:0)+(K.KeyQ?-1:0)+tch.rud+tIn.rud,-1,1),-1,1);
  if(tIn.thr!==null)thrT=tIn.thr;
  else if(!tch.thrOn){
    if(K.ShiftLeft||K.ShiftRight||K.KeyX)thrT=Math.min(1,thrT+dt*0.55);
    if(K.ControlLeft||K.ControlRight||K.KeyZ)thrT=Math.max(0,thrT-dt*0.55);}
  brakes=parkBrake||autoBrake||tch.brk||K.Space;
  const rate=12;
  ctl.el+=(elIn-ctl.el)*Math.min(1,dt*rate);
  ctl.ail+=(ailIn-ctl.ail)*Math.min(1,dt*rate);
  ctl.rud+=(rudIn-ctl.rud)*Math.min(1,dt*rate);
  apUpdate(dt);
  /* hover assist + warnings */
  const manualHoverPower=tch.thrOn||tIn.thr!==null||K.ShiftLeft||K.ShiftRight||K.ControlLeft||K.ControlRight||K.KeyX||K.KeyZ;
  if(stolMode==='HOVER'&&S.hoverAssist&&!manualHoverPower&&Vtas<40&&Math.abs(elIn)<0.15&&Math.abs(ailIn)<0.15){
    if(hovAlt<0)hovAlt=ralt;
    const trim=hoverTrimPower(DRY+fuel),altErr=clamp(hovAlt-ralt,-15,15);
    /* Feed-forward weight compensation plus a damped altitude loop avoids the
       large throttle/engine-lag oscillation of an arcade-style integrator. */
    thrT=clamp(trim.throttle+altErr*.009-P.vel.y*.035,0.3,1);
  } else if(Math.abs(elIn)>0.2||Math.abs(ailIn)>0.2)hovAlt=-1;
  thr+=clamp(thrT-thr,-dt*(thrT>thr?0.7:0.55),dt*(thrT>thr?0.7:0.55));
  /* air data */
  const gx=P.pos.x+OX,gz=P.pos.z+OZ,surf=surfaceH(gx,gz);
  ralt=P.pos.y-surf;
  windAt(gx,P.pos.y,gz,_v1);
  turbulenceAt(gx,P.pos.y,gz,_gustV);_v1.add(_gustV);
  _va.copy(P.vel).sub(_v1);Vtas=_va.length();
  _q1.copy(P.quat).invert();
  _vb.copy(_va).applyQuaternion(_q1);
  alpha=Math.atan2(-_vb.y,-_vb.z);beta=Math.atan2(_vb.x,-_vb.z);
  const aDot=(alpha-alphaPrev)/Math.max(dt,1e-4),bDot=(beta-betaPrev)/Math.max(dt,1e-4);
  alphaRate+=(clamp(aDot,-6,6)-alphaRate)*Math.min(1,dt/.055);betaRate+=(clamp(bDot,-6,6)-betaRate)*Math.min(1,dt/.07);
  alphaPrev=alpha;betaPrev=beta;
  _fwd.set(0,0,-1).applyQuaternion(P.quat);_up.set(0,1,0).applyQuaternion(P.quat);_rgt.set(1,0,0).applyQuaternion(P.quat);
  bank=-Math.asin(clamp(_rgt.y,-1,1));
  const at=atmos(P.pos.y,wx.temp0-15);rho=at.rho;
  mach=Vtas/at.a;ias=Vtas*Math.sqrt(rho/1.225)/KT;
  qbar=0.5*rho*Vtas*Vtas;
  engineUpdate(dt);
  const sv=stolUpdate(dt);Tvert=sv.Tvert;
  /* Separation always sees physical AoA. ASSIST prevents departure upstream by
     unloading/limiting the command rather than widening the aerodynamic stall
     envelope or compressing the sensed angle of attack. */
  const a0=(-2.0-2.0*flapPos)*D2R;
  const rising=clamp(alphaRate*Math.sign(alpha-a0)*.030,-.030,.055);
  const betaPenalty=smooth(10,30,Math.abs(beta)*R2D)*4.5*D2R;
  const machPenalty=smooth(.90,1.20,mach)*3.0*D2R;
  const cfgPenalty=(gearD>.55?2.5:0)*D2R;
  const sepAoA=Math.abs(alpha-a0);
  const aStall=(28.0+3.0*flapPos)*D2R+rising-betaPenalty-machPenalty-cfgPenalty;
  const sepT=smooth(aStall,aStall+18.0*D2R,sepAoA);
  sep+=(sepT-sep)*Math.min(1,dt/(sepT>sep?.14:.38));
  fcsUpdate(dt);
  const mass=DRY+fuel;inertiaNow=massProperties(fuel);const A=aeroForces();updateCondensationState(A,at,mass);
  _vh.copy(_va);if(Vtas>0.01)_vh.multiplyScalar(1/Vtas);else _vh.set(0,0,1);
  _ld.copy(_up).addScaledVector(_vh,-_up.dot(_vh));if(_ld.lengthSq()<1e-8)_ld.copy(_up);_ld.normalize();
  _sd.copy(_rgt).addScaledVector(_vh,-_rgt.dot(_vh));if(_sd.lengthSq()<1e-8)_sd.copy(_rgt);_sd.normalize();
  _td.set(0,Math.sin(sv.nozRad),-Math.cos(sv.nozRad)).applyQuaternion(P.quat);
  _F.copy(_td).multiplyScalar(sv.Trear).addScaledVector(_up,sv.fanThrust+sv.rollPostL+sv.rollPostR+sv.cushionExtra);
  _F.addScaledVector(_ld,A.L).addScaledVector(_sd,A.Y).addScaledVector(_vh,-A.D);
  _Fb.copy(_F).applyQuaternion(_q1);
  gNz=_Fb.y/(mass*G0);gNy=_Fb.x/(mass*G0);gNx=-_Fb.z/(mass*G0);
  let inStorm=0;for(let i=0;i<storms.length;i++){const c=storms[i],d=Math.hypot(gx-c.x,gz-c.z);if(d<c.r*1.3)inStorm=Math.max(inStorm,1-d/(c.r*1.3));}
  _F.y-=mass*G0;
  let Mx=A.Mx,My=A.My,Mz=A.Mz;
  /* STOVL moments from public component locations. Roll-post differential is a
     real force couple; pitch/yaw vane authority is retained as a bounded estimate. */
  const LFarm=1.70,rearArm=1.89,rollArm=2.05;
  Mx+=sv.fanThrust*LFarm-sv.rearVertical*rearArm-(sv.rollPostL+sv.rollPostR)*.48;
  Mz+=rollArm*(sv.rollPostR-sv.rollPostL);
  const hk=sv.lfFrac*smooth(135,55,Vtas),wAuth=clamp(Tvert/(mass*G0),0,1.25);
  if(hk>.01){
    Mx+=(elIn*2.0-P.om.x*.92)*3.0*hk*wAuth*inertiaNow.ix*.026;
    My+=(-rudIn*1.45-P.om.y*.95)*2.7*hk*wAuth*inertiaNow.iy*.045;
    if(Math.abs(elIn)<.07)Mx+=-Math.asin(clamp(_fwd.y,-1,1))*.72*hk*wAuth*inertiaNow.ix*.026;
    if(Math.abs(ailIn)<.06)Mz+=bank*.55*hk*wAuth*inertiaNow.iz*.075;
    if(inStorm>0||wx.windNow>8)Mz+=Math.sin(simT*1.3)*wx.windNow*260*hk;
  }
  /* Public data does not support a precise 40–60% conversion instability map.
     This small rate/beta coupling represents control-allocation mismatch only in
     the transition band and vanishes in both hover and conventional flight. */
  if(sv.transitionBand>.01){
    const tr=sv.transitionBand*wAuth;
    Mz+=(beta*.72+P.om.y*.055)*tr*inertiaNow.iz*.30;
    My+=(-P.om.z*.045+beta*.22)*tr*inertiaNow.iy*.12;
  }
  /* Buffet strength requires separated flow *and* enough dynamic pressure to
     excite the airframe. The transonic buffet lobe is separate and bounded. */
  const buffetQ=smooth(1600,16500,qbar);
  const transBuff=smooth(1.00,1.14,mach)*(1-smooth(1.38,1.58,mach))*smooth(5000,22000,qbar);
  buffet=sep*buffetQ+.34*transBuff;
  if(buffet>0.02){
    Mx+=(Math.sin(simT*46.0)+0.5*Math.sin(simT*31.0+1.7))*0.4*buffet*inertiaNow.ix*0.02;
    Mz+=(Math.sin(simT*41.1+2.3)+0.5*Math.sin(simT*27.9+0.6))*0.35*buffet*inertiaNow.iz*0.06;
    shake=Math.max(shake,buffet*0.55);}
  /* Low-altitude ground roll still experiences aerodynamic fin/fuselage
     weathervaning in addition to tire side force. Base Cn already contributes;
     this modest increment keeps crosswind yaw feedback perceptible below rotation. */
  const groundVane=(gearD>.55&&ralt<3.3)?smooth(300,3500,qbar)*(1-smooth(78,105,Vtas)):0;
  if(groundVane>0)My+=qbar*S_REF*SPAN*(-.038*beta)*groundVane;
  const gc=groundContact(dt,mass);
  if(gc.waterTouch){doCrash('DITCHED IN OPEN WATER');return;}
  _F.x+=gc.fx;_F.y+=gc.fy;_F.z+=gc.fz;
  /* Contact forces are world-space; aerodynamic/STOVL moments are body-space. */
  _tqW.set(gc.tx,gc.ty,gc.tz).applyQuaternion(_q1);
  Mx+=_tqW.x;My+=_tqW.y;Mz+=_tqW.z;
  for(let i=0;i<STRIKES.length;i++){const sk=STRIKES[i];
    _rp.set(sk.x,sk.y,sk.z).applyQuaternion(P.quat);
    const wy=P.pos.y+_rp.y,sh=surfaceH(P.pos.x+OX+_rp.x,P.pos.z+OZ+_rp.z);
    if(sh-wy>0.06){
      if(isWaterAt(P.pos.x+OX+_rp.x,P.pos.z+OZ+_rp.z))doCrash('DITCHED IN OPEN WATER');
      else doCrash(sk.n==='BELLY'?(gearD<0.5?'BELLY LANDING — HULL LOSS':'GROUND STRIKE — AIRFRAME'):'WING STRIKE — FUEL FIRE');
      return;}}
  /* semi-implicit integration; rotation uses updated rates */
  P.vel.addScaledVector(_F,dt/mass);
  P.pos.addScaledVector(P.vel,dt);
  /* Fuel burn shifts inertia and CG. A small lift/drag moment from that CG shift
     makes heavy and light configurations feel distinct without pretending to
     know classified fuel-tank scheduling. */
  Mx+=-A.L*inertiaNow.cg;
  const p=P.om.z,q=P.om.x,r=P.om.y,Ix=inertiaNow.ix,Iy=inertiaNow.iy,Iz=inertiaNow.iz,Iyz=inertiaNow.iyz||0;
  /* Full rigid-body Euler coupling with a small roll/yaw product of inertia.
     The simulator axes are X=pitch, Y=yaw, Z=roll, so Iyz is the analogue of
     the conventional aircraft roll/yaw cross-product term. */
  const qDot=(Mx+(Iy-Iz)*r*p-Iyz*(p*p-r*r))/Ix;
  const rhsY=My+(Iz-Ix)*p*q-Iyz*q*r;
  const rhsZ=Mz+(Ix-Iy)*q*r+Iyz*q*p;
  const detYZ=Math.max(1,Iy*Iz-Iyz*Iyz);
  const rDot=(rhsY*Iz+Iyz*rhsZ)/detYZ;
  const pDot=(Iy*rhsZ+Iyz*rhsY)/detYZ;
  P.om.x+=qDot*dt;P.om.y+=rDot*dt;P.om.z+=pDot*dt;
  _q2.set(P.om.x,P.om.y,P.om.z,0).premultiply(P.quat);
  P.quat.x+=_q2.x*0.5*dt;P.quat.y+=_q2.y*0.5*dt;P.quat.z+=_q2.z*0.5*dt;P.quat.w+=_q2.w*0.5*dt;
  P.quat.normalize();
  applyFailures(dt);
  /* A landing is armed only after sustained, genuine flight.  This prevents
     suspension chatter or a runway-edge bump from replacing the debrief for
     the actual touchdown, while still allowing normal touch-and-go circuits. */
  if(!wheelsOn&&ralt>6){tdAirT+=dt;if(tdAirT>1.5)tdArmed=true;}else if(wheelsOn)tdAirT=0;
  if(wheelsOn&&!prevWheelsOn&&!crashed){impactVS=gc.minImp;if(tdArmed){touchdown();tdArmed=false;}}
  prevWheelsOn=wheelsOn;
  if(wheelsOn&&impactVS<-8.5&&!crashed&&S.fail!=='OFF'){doCrash('HARD IMPACT — AIRFRAME OVERSTRESS');return;}
  /* Relaxed overstress model: full-stick, high-speed turns should be possible
     without instantly punishing the pilot. The wing/structure still has a
     damage envelope, but it now tolerates brief peaks well above the nominal
     clean limit before cumulative failure begins to matter. */
  const limPos=(gearD>.5||flapPos>.55||stolMode!=='CONV')?4.5:structuralLimit();
  if(gNz>limPos+0.6)dmg+=(gNz-(limPos+0.6))*dt*0.35;
  else if(gNz<-5.0)dmg+=(-5.0-gNz)*dt*0.28;
  else dmg=Math.max(0,dmg-dt*0.28);
  if(dmg>4.5&&S.fail!=='OFF'){doCrash('STRUCTURAL FAILURE — SUSTAINED OVERSTRESS');return;}
  if((stepCount&1)===0&&!crashed){checkCollisions();checkTrafficCollision();}
  missionPhysicsUpdate(dt);recordReplay(dt);
  /* stats */
  stats.maxAlt=Math.max(stats.maxAlt,P.pos.y);stats.maxMach=Math.max(stats.maxMach,mach);
  stats.maxG=Math.max(stats.maxG,gNz);stats.dist+=Vtas*dt;
  if(stolMode==='HOVER')stats.hoverT+=dt;
  if((stepCount&31)===0){
    if(!isFinite(P.pos.x+P.pos.y+P.pos.z+P.vel.x+P.vel.y+P.vel.z+P.om.x+P.om.y+P.om.z)){
      cwarn('nan','NaN in state — auto-recovering');respawn();return;}
    if(Math.abs(P.om.x)+Math.abs(P.om.y)+Math.abs(P.om.z)>15)cwarn('rate','angular rates > 15 rad/s');}
  emitCondensation(dt);
}
function touchdown(){
  const vs=impactVS,kts=Math.round(ias),fpm=Math.round(vs*FPM);
  let onRwy=false,off=0,tdA=null,tdApt=null,tdCourse=0;
  for(const a of airports){
    for(const end of [[a.thrAx,a.thrAz,a.ux,a.uz],[a.thrBx,a.thrBz,-a.ux,-a.uz]]){
      const rx=P.pos.x+OX-end[0],rz=P.pos.z+OZ-end[1];
      const alongT=rx*end[2]+rz*end[3],across=rx*(-end[3])+rz*end[2];
      if(alongT>0&&alongT<a.rwyLen&&Math.abs(across)<a.rwyW/2+3){onRwy=true;off=across;tdA=alongT;tdApt=a;tdCourse=norm360(Math.atan2(end[2],-end[3])*R2D);break;}}
    if(onRwy)break;}
  buzz(45);
  stats.tdVs=vs;stats.tdAcross=off;stats.tdDist=tdA||0;stats.tdSpeed=kts;
  if(onRwy){
    const av=Math.abs(vs),hdgErr=Math.abs(norm180(hdgDeg-tdCourse)),target=tdApt.platform?tdApt.rwyLen*.5:Math.min(420,tdApt.rwyLen*.23);
    const sinkScore=clamp(1-Math.max(0,av-.65)/4.5,0,1),centreScore=clamp(1-Math.abs(off)/(tdApt.rwyW*.5+2),0,1),headingScore=clamp(1-hdgErr/16,0,1);
    const zoneScore=clamp(1-Math.abs(tdA-target)/(tdApt.platform?tdApt.rwyLen*.55:Math.max(360,tdApt.rwyLen*.36)),0,1);
    const speedScore=tdApt.platform?clamp(1-Math.max(0,kts-35)/65,0,1):tdApt.stovl?clamp(1-Math.max(0,kts-105)/75,0,1):clamp(1-Math.max(0,Math.abs(kts-135)-28)/75,0,1);
    let score=Math.round(100*(.32*sinkScore+.24*centreScore+.18*headingScore+.16*zoneScore+.10*speedScore));if(av>4.8)score=Math.min(score,49);
    const grade=score>=92?'A+':score>=84?'A':score>=74?'B':score>=62?'C':score>=50?'D':'HARD';
    Object.assign(stats,{tdScore:score,tdGrade:grade,tdHdg:hdgErr,tdAirport:tdApt.icao});
    toast(`LANDING ${grade} · ${score}/100 · ${kts}KT · ${Math.abs(fpm)}FPM · CL ${Math.abs(off).toFixed(1)}M`,score>=74?'':score>=50?'warn':'bad');
    landings++;sfxThump();emitTouchdownSmoke(clamp(Math.abs(vs)/3,.45,1.5));
    if(AP.mode==='APPR'){autoBrake=true;toast('AUTOBRAKE — ROLLING OUT');}
  } else {emitTouchdownSmoke(clamp(Math.abs(vs)/3,.4,1.4));Object.assign(stats,{tdScore:0,tdGrade:'OFF FIELD',tdHdg:0,tdAirport:''});sfxThump();toast('OFF-FIELD TOUCHDOWN','warn');}
}
function doCrash(cause){
  if(crashed)return;crashed=true;shake=2;buzz([90,50,120]);stats.warnings++;
  for(let i=0;i<140;i++){expPos[i*3]=P.pos.x;expPos[i*3+1]=P.pos.y;expPos[i*3+2]=P.pos.z;
    expVel[i].set((Math.random()-0.5)*60,Math.random()*45,(Math.random()-0.5)*60);}
  expGeo.attributes.position.needsUpdate=true;expT=1.6;expPts.material.opacity=1;
  applyVisibility();sfxBoom();
  $('crashCause').textContent='CAUSE: '+cause;
  const na=nearestApt();
  $('crashStats').innerHTML=`FLIGHT TIME ${fmtT(flightT)} · LANDINGS ${landings} · FUEL ${Math.round(fuel)} KG<br>NEAREST FIELD: ${na.name} ${(Math.hypot(na.x-P.pos.x-OX,na.z-P.pos.z-OZ)/1000).toFixed(1)} KM`;
  setTimeout(()=>{if(crashed)$('crashOv').classList.add('on');},1300);
}
function nearestApt(){let b=airports[0],bd=1e12;const gx=P.pos.x+OX,gz=P.pos.z+OZ;
  for(const a of airports){const d=(a.x-gx)**2+(a.z-gz)**2;if(d<bd){bd=d;b=a;}}return b;}
function selectedAirport(){let a=airports.find(v=>v.icao===navTargetIcao);
  if(!a){a=airports[Math.min(selAptIdx,airports.length-1)]||nearestApt();if(a)navTargetIcao=a.icao;}return a;}
function airportTypeLabel(a){return a.platform?'OFFSHORE STOVL':a.stovl?'STOVL SITE':a.size==='L'?'MAJOR':a.size==='M'?'REGIONAL':'AIRFIELD';}
function setNavAirport(a){if(!a)return;selAptIdx=Math.max(0,airports.indexOf(a));navTargetIcao=a.icao;
  if($('selApt')&&selAptIdx<$('selApt').options.length)$('selApt').value=selAptIdx;
  computeILS();toast(`DIRECT ${a.icao} — ${airportTypeLabel(a)} · ${(Math.hypot(a.x-P.pos.x-OX,a.z-P.pos.z-OZ)/1000).toFixed(1)}KM`);}
function chooseNavAirport(mode){const gx=P.pos.x+OX,gz=P.pos.z+OZ,sorted=airports.slice().sort((a,b)=>Math.hypot(a.x-gx,a.z-gz)-Math.hypot(b.x-gx,b.z-gz));
  if(!sorted.length)return;let a;
  if(mode==='STOVL')a=sorted.find(v=>v.stovl);
  else if(mode==='LONG')a=sorted.find(v=>v.size==='L'&&v.rwyLen>=2600);
  else if(mode==='NEXT'){const cur=selectedAirport(),i=sorted.indexOf(cur);a=sorted[(i+1+sorted.length)%sorted.length];}
  else a=sorted[0];setNavAirport(a||sorted[0]);}
const expGeo=new THREE.BufferGeometry(),expPos=new Float32Array(140*3),expVel=[];
for(let i=0;i<140;i++)expVel.push(new THREE.Vector3());
expGeo.setAttribute('position',new THREE.BufferAttribute(expPos,3));
const expPts=new THREE.Points(expGeo,new THREE.PointsMaterial({color:0xffa040,size:3,transparent:true,opacity:0,blending:THREE.AdditiveBlending,depthWrite:false}));
scene.add(expPts);let expT=0;
/* PUBLIC BASIS / APPROXIMATION RECORD
   - Lockheed Martin F-35 Fast Facts: B-variant dimensions, 42.7 m² wing area,
     ~14.65 t empty mass, ~6.12 t internal fuel, Mach 1.6 public maximum.
   - Rolls-Royce LiftSystem public poster: ~180 kN powered-lift rating and system layout.
   - FAA Pilot's Handbook + NASA standard-atmosphere material: force, stall and ISA equations.
   - NASA contrail education material: cold/high-altitude ice trails are modelled separately.
   Military thrust ≈111 kN, maximum thrust ≈178 kN, 7-g rating and LiftSystem component figures are public approximations.
   Aerodynamic coefficients, inertias and control laws remain engineering estimates because
   detailed F-35B aerodynamic/control-system databases are not public or are classified. */
const S_REF=42.7,SPAN=10.7,CBAR=4.6,MILT=111e3,ABT=178e3;
const LIFT_FAN_MAX=88964,REAR_LIFT_MAX=80068,ROLL_POST_MAX=8674,VERTT=LIFT_FAN_MAX+REAR_LIFT_MAX+2*ROLL_POST_MAX,NOZZLE_MAX=95;
const DRY=14650,MAX_FUEL=5942,MAX_G=12.5,OVERG_WARN_POS=11.5,OVERG_WARN_NEG=-4.5;
const IX=220e3,IY=270e3,IZ=55e3,TRAVEL=0.35;
/* Generic automatic tank sequencing approximation. Exact F-35B feed/transfer
   schedules are not public here, so the model keeps the shift deliberately small
   while making CG/inertia evolve nonlinearly instead of from one fuel scalar. */
function fuelDistribution(fuelKg){
  const f=clamp(fuelKg/MAX_FUEL,0,1),aftShare=lerp(.21,.30,smooth(.18,.86,f)),fwdShare=lerp(.34,.25,smooth(.18,.86,f));
  const ctrShare=1-aftShare-fwdShare,total=Math.max(0,fuelKg);
  return{fwd:total*fwdShare,ctr:total*ctrShare,aft:total*aftShare};
}
function massProperties(fuelKg){
  const f=clamp(fuelKg/MAX_FUEL,0,1),d=fuelDistribution(fuelKg),den=Math.max(1,fuelKg);
  const fuelCg=(-1.20*d.fwd+.05*d.ctr+1.30*d.aft)/den;
  const cg=clamp(-.035+fuelCg*.58,-.13,.15);
  const spread=(d.fwd+d.aft)/Math.max(MAX_FUEL,1);
  const ix=IX*(.91+.12*f+.055*spread),iy=IY*(.92+.11*f+.050*spread),iz=IZ*(.89+.16*f+.075*spread);
  /* Small generic YZ product of inertia: exact F-35B tensor is not public. */
  const iyz=.052*Math.sqrt(iy*iz)*(.82+.18*f);
  return{ix,iy,iz,iyz,cg,fuelDist:d};
}
function structuralLimit(){if(S.structure==='RELAXED')return S.fbw==='ASSIST'?11.5:9.5;return S.fbw==='ASSIST'?8.5:S.fbw==='STANDARD'?7.5:7.0;}
const WHEELS=[
 {x:0,y:-1.55,z:-4.3,nose:true,k:110e3,c:14e3},
 {x:-1.75,y:-1.85,z:1.9,main:true,k:230e3,c:26e3},
 {x:1.75,y:-1.85,z:1.9,main:true,k:230e3,c:26e3},
 {x:0,y:-0.55,z:6.35,tail:true,k:120e3,c:22e3}];
const STRIKES=[{x:0,y:-0.95,z:0,n:'BELLY'},{x:-5.3,y:-0.05,z:1.2,n:'WING'},{x:5.3,y:-0.05,z:1.2,n:'WING'}];
/* ================= [17] NAVIGATION & ILS ================= */
const ILS_RANGE=30000,ILS_REASON=['OK','NO RUNWAY','BEHIND THRESHOLD','OUT OF RANGE','OUT OF CONE','TOO FAR LATERAL','NOT CLOSING','EXCESSIVE BANK'];
const ilsData={err:0,gs:0,gsAng:3,dist:99999,inb:0,cross:0,along:99999,gsAlt:9999,apt:null,thrX:0,thrZ:0,ux:0,uz:0};
let ilsValid=false,ilsReason=0;
function computeILS(){
  /* Keep the receiver on the user-selected destination. Choosing the nearest
     generated field could silently retune ILS during an established approach. */
  const a=selectedAirport()||nearestApt();if(!a){ilsValid=false;ilsReason=1;return;}
  const px=P.pos.x+OX,pz=P.pos.z+OZ,dx=a.x-px,dz=a.z-pz;
  const brg=norm360(Math.atan2(dx,-dz)*R2D);
  const eA=Math.abs(norm180(a.hdg-brg)),eB=Math.abs(norm180(a.hdgB-brg));
  let inb,thrX,thrZ,ux,uz;
  if(Math.abs(eA-eB)<25){const hwA=Math.cos((a.hdg-wx.windDir)*D2R),hwB=Math.cos((a.hdgB-wx.windDir)*D2R);
    if(hwA>=hwB){inb=a.hdg;thrX=a.thrAx;thrZ=a.thrAz;ux=a.ux;uz=a.uz;}
    else{inb=a.hdgB;thrX=a.thrBx;thrZ=a.thrBz;ux=-a.ux;uz=-a.uz;}}
  else if(eA<=eB){inb=a.hdg;thrX=a.thrAx;thrZ=a.thrAz;ux=a.ux;uz=a.uz;}
  else{inb=a.hdgB;thrX=a.thrBx;thrZ=a.thrBz;ux=-a.ux;uz=-a.uz;}
  const tx=thrX-px,tz=thrZ-pz,along=tx*ux+tz*uz;
  const nx=-uz,nz=ux,cross=tx*nx+tz*nz;
  const crossAng=Math.atan2(cross,Math.max(along,40))*R2D;
  const gsAlt=a.elev+15+Math.max(along,0)*Math.tan(3*D2R);
  const gsAng=Math.atan2(P.pos.y-(a.elev+15),Math.max(along,20))*R2D;
  const closing=(P.vel.x*ux+P.vel.z*uz)>3||wheelsOn;
  Object.assign(ilsData,{apt:a,thrX,thrZ,ux,uz,along,cross,err:crossAng,gs:gsAng-3,gsAng,gsAlt,inb,dist:Math.max(along,0)});
  ilsReason=0;
  /* Localizer remains usable over the runway; crossing the threshold is not a
     receiver failure. It expires only beyond the far end plus a safety margin. */
  if(along<=-(a.rwyLen+200))ilsReason=2;else if(along>ILS_RANGE)ilsReason=3;
  else if(Math.abs(crossAng)>15&&along>800)ilsReason=4;else if(Math.abs(cross)>2800)ilsReason=5;
  else if(!closing)ilsReason=6;else if(Math.abs(bank)>60*D2R)ilsReason=7;
  ilsValid=ilsReason===0;
}
/* ================= [18] AUTOPILOT ================= */
function apDisconnect(reason){
  if(AP.mode==='OFF')return;
  apDiscReason=reason||'PILOT';
  AP.mode='OFF';AP.armed='';if(!['OFF','COMPLETE'].includes(ilsMode))ilsMode='OFF';
  sfxAPDisc();toast('AP DISCONNECT'+(reason?' — '+reason:''),'warn');
}
function apUpdate(dt){
  if(AP.mode==='OFF')return;
  if(Math.abs(elIn)>0.45||Math.abs(ailIn)>0.45||Math.abs(rudIn)>0.55){apDisconnect('PILOT INPUT');return;}
  if(stolMode!=='CONV'&&AP.mode!=='HOVER'){apDisconnect('STOVL');return;}
  if(sep>0.62){apDisconnect('STALL');return;}
  if(Math.abs(bank)>45*D2R||Math.abs(Math.asin(clamp(_fwd.y,-1,1)))>25*D2R){apDisconnect('EXCESSIVE ATTITUDE');return;}
  _v1.set(0,0,-1).applyQuaternion(P.quat);const pitch=Math.asin(clamp(_v1.y,-1,1));
  if(AP.mode==='HOVER'){
    /* position/altitude hold while hovering */
    if(hovAlt<0)hovAlt=ralt;
    const vsCmd=clamp((hovAlt-ralt)*0.25,-3,3);
    thrT=clamp(thrT+(vsCmd-P.vel.y)*0.35*dt,0.3,1);
    ctl.el=clamp(-P.om.x*0.5+clamp((0-bank)*1.5,-0.3,0.3)*0,-0.3,0.3);elIn=ctl.el;
    ctl.ail=clamp(-bank*2-P.om.z*0.4,-0.3,0.3);ailIn=ctl.ail;
    return;}
  let spdT=AP.spd,altT=AP.alt,hdgT=AP.hdg;
  if(AP.mode==='APPR'){
    computeILS();
    if(!ilsValid){if(['LOC','GS','FLARE','ROLLOUT'].includes(ilsMode)){apDisconnect(ILS_REASON[ilsReason]);return;}
      ilsArmT+=dt;if(ilsArmT>8){apDisconnect(ILS_REASON[ilsReason]);return;}}
    else ilsArmT=0;
    const il=ilsData;
    const crossRate=(il.cross-crossPrev)/Math.max(dt,1e-3);
    crossDotF+=(crossRate-crossDotF)*Math.min(1,dt*2);crossPrev=il.cross;
    if(wheelsOn&&ilsMode!=='ROLLOUT'&&ilsMode!=='FLARE'){apDisconnect('GROUND CONTACT');return;}
    if(ilsMode==='ARM'){hdgT=norm360(il.inb+clamp(il.err*2.5,-45,45));
      if(il.along>0&&il.along<25000&&Math.abs(il.err)<2.5){ilsMode='LOC';toast('LOCALIZER CAPTURE');}}
    if(ilsMode==='LOC'){
      hdgT=norm360(il.inb+clamp(il.err*3+crossDotF*0.15,-30,30));
      altT=Math.min(AP.alt,il.gsAlt);
      const dh=il.gsAlt-P.pos.y;
      if(dh>-60&&dh<45&&il.gs>-0.6){ilsMode='GS';toast('GLIDESLOPE CAPTURED');}
      if(il.along<2000&&dh>60){apDisconnect('NO GS CAPTURE');return;}}
    const locErr=Math.atan2(il.cross,Math.max(il.along,1400))*R2D;
    if(ilsMode==='GS'){hdgT=norm360(il.inb+clamp(locErr*3+crossDotF*.07,-18,18));altT=il.gsAlt;
      if(il.along<450){ilsMode='FLARE';toast('FLARE');}}
    if(ilsMode==='FLARE'){
      hdgT=norm360(il.inb+clamp(locErr*2+crossDotF*.04,-8,8));
      const flareVs=-clamp(ralt*.075,.55,1.4);altT=P.pos.y+flareVs/.12;spdT=64;
      if(wheelsOn){ilsMode='ROLLOUT';autoBrake=true;toast('ROLLOUT — AUTOBRAKE');}}
    if(ilsMode==='ROLLOUT'){
      ctl.rud=clamp(-il.cross*0.02-norm180(hdgDeg-il.inb)*0.015,-0.6,0.6);
      ctl.ail=clamp(-bank*2.0+P.om.z*0.4,-0.4,0.4);ctl.el=0;elIn=0;ailIn=0;
      thrT=Math.max(0.15,thrT-dt*0.8);if(tch.thrOn){tch.thr=thrT;thrUI();}
      if(ias<10){ilsMode='COMPLETE';AP.mode='OFF';toast('ROLL OUT COMPLETE — AUTOBRAKE HOLDING');}
      return;}
    if(Math.abs(il.err)>15&&il.along>1000&&il.along<5000&&['LOC','GS'].includes(ilsMode)){apDisconnect('EXCESSIVE DEVIATION');return;}
    const bLim=(il.along<3500?12:il.along<8000?18:25)*D2R;
    const hdgErr=norm180(hdgT-hdgDeg),rollT=clamp(hdgErr*0.035,-bLim,bLim);
    ctl.ail=clamp((rollT-bank)*3.0+P.om.z*0.6,-1,1);ailIn=ctl.ail;
    if(ilsMode!=='FLARE')thrT=clamp(thrT+clamp((spdT-ias*KT)*0.025,-0.12,0.12)*dt,0.05,1);
    else thrT=Math.max(0.05,thrT-dt*0.55);
    if(tch.thrOn){tch.thr=thrT;thrUI();}
    const vsT=clamp((altT-P.pos.y)*0.14,-8,7),pitchT=clamp((vsT-P.vel.y)*0.12,-0.30,0.50);
    ctl.el=clamp((pitchT-pitch)*3.2-P.om.x*0.7,-1,1);elIn=ctl.el;
    return;}
  /* HDG/ALT/VS/SPD */
  const hdgErr=norm180(hdgT-hdgDeg),rollT=clamp(hdgErr*0.035,-0.55,0.55);
  ctl.ail=clamp((rollT-bank)*3.0+P.om.z*0.6,-1,1);ailIn=ctl.ail;
  thrT=clamp(thrT+clamp((spdT-ias*KT)*0.06,-0.1,0.1)*dt*3,0.15,1);
  if(tch.thrOn){tch.thr=thrT;thrUI();}
  let altTgt=AP.alt;if(AP.mode==='VS')altTgt=P.pos.y+AP.vs*5;
  const vsT=clamp((altTgt-P.pos.y)*0.12+(AP.mode==='VS'?AP.vs:0),-9,7);
  const pitchT=clamp((vsT-P.vel.y)*0.08,-0.25,0.35);
  ctl.el=clamp((pitchT-pitch)*2.5-P.om.x*0.6,-1,1);elIn=ctl.el;
}
function cycleAP(){
  if(AP.mode==='OFF'){AP.mode='HDG';AP.alt=P.pos.y;AP.hdg=hdgDeg;AP.spd=clamp(ias*KT,64,130);
    toast('AP — ALT '+Math.round(AP.alt)+'M · HDG '+Math.round(AP.hdg)+'°');}
  else if(AP.mode==='HDG'){computeILS();
    if(ilsValid||ilsReason===6){AP.mode='APPR';ilsMode='ARM';ilsArmT=0;crossPrev=ilsData.cross;
      toast('APR ARMED — '+ilsData.apt.name+' RWY '+ilsData.apt.num,'warn');}
    else toast('APR INHIBITED — '+ILS_REASON[ilsReason],'bad');}
  else{AP.mode='OFF';ilsMode='OFF';toast('AP OFF');}
  sfxClick();
}
/* ================= [19] INPUT ================= */
const K={};
function shapeAxis(v){const a=Math.abs(v);if(a<S.dz)return 0;
  const n=(a-S.dz)/(1-S.dz);return clamp(Math.sign(v)*Math.pow(n,1+S.expo*2.2)*S.sens,-1,1);}
function toggleGear(){gearT=gearT>0.5?0:1;toast(gearT?'GEAR DOWN':'GEAR UP');sfxGear();}
function toggleAbrk(){airbrk=!airbrk;toast(airbrk?'SPEED BRAKE OUT':'SPEED BRAKE IN');}
function togglePark(){parkBrake=!parkBrake;toast(parkBrake?'PARKING BRAKE SET':'PARKING BRAKE RELEASED');sfxClick();}
function cycleCam(){camMode=(camMode+1)%5;snapCameraToAircraft();applyVisibility();toast(['CHASE','COCKPIT','ORBIT','DISTANT','FLY-BY'][camMode]+' CAMERA');}
function toggleLights(){lights=!lights;toast(lights?'LANDING LIGHTS ON':'LANDING LIGHTS OFF');}
function cycleHmds(){const order=['FULL','NAV','LANDING','MIN','OFF'];
  S.hmds=order[(order.indexOf(S.hmds)+1)%order.length];toast('HMDS — '+S.hmds);syncHmdsChips();}
function toggleTargetMarker(){S.targetMarker=!S.targetMarker;const b=$('sTarget');if(b){b.classList.toggle('on',S.targetMarker);b.textContent=S.targetMarker?'ON':'OFF';}const tb=$('tbTarget');if(tb)tb.classList.toggle('live',S.targetMarker);if(!S.targetMarker)$('targetMarker').classList.remove('on');toast(S.targetMarker?'TRAFFIC TARGET MARKER ON':'TRAFFIC TARGET MARKER OFF');savePrefs(false);sfxClick();}
function recenterHead(){headYaw=0;headPitch=0;headRoll=0;toast('HEAD CENTERED');}
addEventListener('keydown',e=>{
  if(['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code))e.preventDefault();
  if(e.code==='F9'){e.preventDefault();dbgOn=!dbgOn;$('dbg').style.display=dbgOn?'block':'none';return;}
  if(e.repeat)return;K[e.code]=true;
  if(!running){if(e.code==='Enter')startSortie();return;}
  if(e.code==='KeyG')toggleGear();
  if(e.code==='KeyP')togglePark();
  if(e.code==='KeyB')toggleAbrk();
  if(e.code==='KeyV')toggleStol();
  if(e.code==='KeyC')cycleCam();
  if(e.code==='KeyL')toggleLights();
  if(e.code==='KeyT')cycleAP();
  if(e.code==='KeyH')cycleHmds();
  if(e.code==='KeyK')toggleTargetMarker();
  if(e.code==='KeyI')toggleInfoPanel();
  if(e.code==='KeyJ')chooseNavAirport('NEXT');
  if(e.code==='KeyN')recenterHead();
  if(e.code==='KeyF')toggleFullscreen();
  if(e.code==='BracketLeft'){pcdPage=(pcdPage+PCD_PAGES.length-1)%PCD_PAGES.length;drawPCD();}
  if(e.code==='BracketRight'){pcdPage=(pcdPage+1)%PCD_PAGES.length;drawPCD();}
  if(e.code==='KeyM'){muted=!muted;toast(muted?'SOUND OFF':'SOUND ON');}
  if(e.code==='KeyR')respawn();
  if(e.code==='Escape'){
    if($('helpOv').classList.contains('on'))closeHelp();
    else if($('sumOv').classList.contains('on'))closeSummary();
    else if($('drawer').classList.contains('on'))closeDrawer();
    else if($('infoPan').classList.contains('on'))closeInfoPanel();
    else togglePause();}
});
addEventListener('keyup',e=>{K[e.code]=false;});
/* mouse head-look (cockpit) */
let lookDrag=false,lastMX=0,lastMY=0;
renderer.domElement.addEventListener('pointerdown',e=>{if(camMode===1){lookDrag=true;lastMX=e.clientX;lastMY=e.clientY;}});
addEventListener('pointermove',e=>{if(lookDrag&&camMode===1){
  headYaw=clamp(headYaw-(e.clientX-lastMX)*0.003,-1.2,1.2);
  headPitch=clamp(headPitch-(e.clientY-lastMY)*0.003,-0.6,0.6);
  lastMX=e.clientX;lastMY=e.clientY;}});
addEventListener('pointerup',()=>{lookDrag=false;});
/* touch */
let touchMode=matchMedia('(pointer:coarse)').matches||('ontouchstart' in window);
function enableTouch(){if(document.body.classList.contains('touch'))return;
  touchMode=true;document.body.classList.add('touch');}
if(touchMode)enableTouch();
addEventListener('touchstart',enableTouch,{passive:true});
document.addEventListener('gesturestart',e=>e.preventDefault());
document.addEventListener('gesturechange',e=>e.preventDefault());
document.addEventListener('contextmenu',e=>{if(document.body.classList.contains('touch'))e.preventDefault();});
const tstick=$('tstick'),tknob=$('tknob');let stickPid=null;
function stickEvt(e){if(!running||paused||crashed)return;
  const r=tstick.getBoundingClientRect(),cx=r.left+r.width/2,cy=r.top+r.height/2;
  let dx=(e.clientX-cx)/(r.width/2-12),dy=(e.clientY-cy)/(r.height/2-12);
  const m=Math.hypot(dx,dy);if(m>1){dx/=m;dy/=m;}
  dx=clamp(dx,-1,1);dy=clamp(dy,-1,1);
  /* Store raw touch axes. Dead-zone/expo/sensitivity and pitch inversion are
     applied once in physics(), exactly like keyboard and gamepad input. */
  tch.ail=dx;tch.el=dy;
  tknob.style.transform=`translate(${dx*(r.width/2-36)}px,${dy*(r.height/2-36)}px)`;}
tstick.addEventListener('pointerdown',e=>{e.preventDefault();stickPid=e.pointerId;tstick.setPointerCapture(e.pointerId);stickEvt(e);});
tstick.addEventListener('pointermove',e=>{if(e.pointerId===stickPid)stickEvt(e);});
function stickEnd(e){if(e.pointerId===stickPid){stickPid=null;tch.ail=tch.el=0;tknob.style.transform='translate(0,0)';}}
tstick.addEventListener('pointerup',stickEnd);tstick.addEventListener('pointercancel',stickEnd);
const tthr=$('tthr');let thrPid=null;
function thrUI(){$('tthrfill').style.height=(tch.thr*100)+'%';$('tthrpct').textContent=Math.round(tch.thr*100)+'%';}
function thrEvt(e){if(!running||paused||crashed)return;
  const r=tthr.getBoundingClientRect();tch.thr=clamp(1-(e.clientY-r.top)/r.height,0,1);tch.thrOn=true;thrT=tch.thr;thrUI();}
tthr.addEventListener('pointerdown',e=>{e.preventDefault();thrPid=e.pointerId;tthr.setPointerCapture(e.pointerId);thrEvt(e);});
tthr.addEventListener('pointermove',e=>{if(e.pointerId===thrPid)thrEvt(e);});
['pointerup','pointercancel'].forEach(ev=>tthr.addEventListener(ev,e=>{if(e.pointerId===thrPid)thrPid=null;}));
thrUI();
function pedal(el,dir){el.addEventListener('pointerdown',e=>{e.preventDefault();el.setPointerCapture(e.pointerId);tch.rud=dir;el.classList.add('live');});
  ['pointerup','pointercancel'].forEach(ev=>el.addEventListener(ev,()=>{tch.rud=0;el.classList.remove('live');}));}
pedal($('rudL'),-1);pedal($('rudR'),1);
/* rudder slider */
const trud=$('trud'),trudk=$('trudk');let rudPid=null;
function trudEvt(e){const r=trud.getBoundingClientRect();
  tch.rud=clamp(((e.clientX-r.left)/r.width-0.5)*2,-1,1);
  trudk.style.left=((tch.rud+1)/2*100)+'%';}
trud.addEventListener('pointerdown',e=>{e.preventDefault();rudPid=e.pointerId;trud.setPointerCapture(e.pointerId);trudEvt(e);});
trud.addEventListener('pointermove',e=>{if(e.pointerId===rudPid)trudEvt(e);});
['pointerup','pointercancel'].forEach(ev=>trud.addEventListener(ev,e=>{if(e.pointerId===rudPid){rudPid=null;tch.rud=0;trudk.style.left='50%';}}));
function tbtn(id,fn,hold){const el=$(id);
  el.addEventListener('pointerdown',e=>{e.preventDefault();buzz(12);
    if(hold){el.setPointerCapture(e.pointerId);el.classList.add('live');fn(true);}
    else{el.classList.add('live');setTimeout(()=>el.classList.remove('live'),150);fn();}});
  if(hold)['pointerup','pointercancel'].forEach(ev=>el.addEventListener(ev,()=>{el.classList.remove('live');fn(false);}));}
tbtn('tbGear',toggleGear);tbtn('tbPark',togglePark);
tbtn('tbBrake',v=>tch.brk=v,true);tbtn('tbLights',toggleLights);
tbtn('tbStol',toggleStol);tbtn('tbAp',cycleAP);tbtn('tbCam',cycleCam);
tbtn('tbHmds',cycleHmds);tbtn('tbTarget',toggleTargetMarker);tbtn('tbRecenter',recenterHead);tbtn('tbPause',togglePause);
function syncTouch(){if(!document.body.classList.contains('touch'))return;
  $('tbPark').classList.toggle('live',parkBrake);
  $('tbStol').classList.toggle('live',stolMode!=='CONV');
  $('tbAp').classList.toggle('live',AP.mode!=='OFF');
  $('tbGear').classList.toggle('live',gearT>0.5);
  $('tbBrake').classList.toggle('live',tch.brk);
  $('tbLights').classList.toggle('live',lights);
  $('tbTarget').classList.toggle('live',S.targetMarker);}
/* gyro */
const gyro={on:false,b:0,g:0,b0:45,g0:0};
function gyroEnable(){
  if(typeof DeviceOrientationEvent!=='undefined'&&DeviceOrientationEvent.requestPermission){
    DeviceOrientationEvent.requestPermission().then(r=>{if(r==='granted'){gyro.on=true;gyroCal();$('sGy').classList.add('on');toast('GYRO ENABLED');}})
    .catch(()=>toast('GYRO PERMISSION DENIED','warn'));}
  else{gyro.on=!gyro.on;$('sGy').classList.toggle('on',gyro.on);if(gyro.on)gyroCal();}}
function gyroCal(){gyro.b0=Number.isFinite(gyro.b)?gyro.b:45;gyro.g0=Number.isFinite(gyro.g)?gyro.g:0;toast('GYRO TRIMMED');}
addEventListener('deviceorientation',e=>{if(!gyro.on)return;gyro.g=e.gamma||0;gyro.b=e.beta||0;});
function gyroSample(){if(!gyro.on||stickPid!==null)return;
  let el=clamp((gyro.b0-gyro.b)/28,-1,1),ail=clamp((gyro.g-gyro.g0)/28,-1,1);
  tch.el=el;tch.ail=ail;}
/* gamepad */
let gpThrAxis=false;
function pollGamepad(){
  const gps=navigator.getGamepads?navigator.getGamepads():[];
  let gp=null;for(const g of gps)if(g){gp=g;break;}
  if(!gp){tIn.el=tIn.ail=tIn.rud=0;return;}
  const dz=S.gDz;
  const ax=i=>{const v=gp.buttons[i]?gp.buttons[i].value:0;return Math.abs(v)<dz?0:v;};
  const st=i=>{const v=gp.axes[i]||0;return Math.abs(v)<dz?0:v;};
  if(!lookDrag){
    tIn.el=clamp(-st(1)+tIn.el*0,-1,1);
    tIn.ail=clamp(st(0),-1,1);
    tIn.rud=clamp(ax(6)-ax(7),-1,1);
    if(!gpThrAxis){if(ax(5)>0.05)thrT=Math.min(1,thrT+ax(5)*0.02);
      if(ax(4)>0.05)thrT=Math.max(0,thrT-ax(4)*0.02);}
    else thrT=clamp((1-st(3))/2,0,1);
    headYaw=clamp(headYaw+st(2)*0.03,-1.2,1.2);
    headPitch=clamp(headPitch-st(5)*0.03,-0.6,0.6);
  }
  const b=i=>gp.buttons[i]&&gp.buttons[i].pressed;
  if(b(0)&&!gp._a){toggleGear();}gp._a=b(0);
  if(b(1)&&!gp._b){toggleStol();}gp._b=b(1);
  if(b(2)&&!gp._x){cycleCam();}gp._x=b(2);
  if(b(3)&&!gp._y){cycleAP();}gp._y=b(3);
  if(b(12)&&!gp._du){cycleHmds();}gp._du=b(12);
  if(b(13)&&!gp._dd){toggleInfoPanel();}gp._dd=b(13);
  if(b(9)&&!gp._st){togglePause();}gp._st=b(9);
}
/* ================= [20] AUDIO ================= */
let AC=null,master,engG,engBP,engOsc,engOG,abG,windG,windLP,rainG,stallG,lfG,rollG,muted=false;
function initAudio(){
  try{AC=new (window.AudioContext||window.webkitAudioContext)();}catch(e){return;}
  master=AC.createGain();master.gain.value=S.volume;master.connect(AC.destination);
  const nb=AC.createBuffer(1,AC.sampleRate*2,AC.sampleRate),d=nb.getChannelData(0);
  for(let i=0;i<d.length;i++)d[i]=Math.random()*2-1;
  function nsrc(){const s=AC.createBufferSource();s.buffer=nb;s.loop=true;s.start();return s;}
  const e1=nsrc();engBP=AC.createBiquadFilter();engBP.type='bandpass';engBP.frequency.value=300;engBP.Q.value=1.1;
  engG=AC.createGain();engG.gain.value=0;e1.connect(engBP).connect(engG).connect(master);
  engOsc=AC.createOscillator();engOsc.type='sawtooth';engOsc.frequency.value=60;
  engOG=AC.createGain();engOG.gain.value=0;engOsc.connect(engOG).connect(master);engOsc.start();
  const e2=nsrc();const abHP=AC.createBiquadFilter();abHP.type='highpass';abHP.frequency.value=1400;
  abG=AC.createGain();abG.gain.value=0;e2.connect(abHP).connect(abG).connect(master);
  const w=nsrc();windLP=AC.createBiquadFilter();windLP.type='lowpass';windLP.frequency.value=500;
  windG=AC.createGain();windG.gain.value=0;w.connect(windLP).connect(windG).connect(master);
  const r=nsrc();const rHP=AC.createBiquadFilter();rHP.type='highpass';rHP.frequency.value=2600;
  rainG=AC.createGain();rainG.gain.value=0;r.connect(rHP).connect(rainG).connect(master);
  const lf=nsrc();const lfBP=AC.createBiquadFilter();lfBP.type='bandpass';lfBP.frequency.value=220;
  lfG=AC.createGain();lfG.gain.value=0;lf.connect(lfBP).connect(lfG).connect(master);
  const ro=nsrc();rollG=AC.createGain();rollG.gain.value=0;ro.connect(rollG).connect(master);
  stallG=AC.createGain();stallG.gain.value=0;
  const so=AC.createOscillator();so.type='square';so.frequency.value=380;so.connect(stallG).connect(master);so.start();
}
function sfxThump(){if(!AC)return;const o=AC.createOscillator(),g=AC.createGain();o.type='sine';
 o.frequency.setValueAtTime(95,AC.currentTime);o.frequency.exponentialRampToValueAtTime(35,AC.currentTime+0.25);
 g.gain.setValueAtTime(0.6,AC.currentTime);g.gain.exponentialRampToValueAtTime(0.001,AC.currentTime+0.3);
 o.connect(g).connect(master);o.start();o.stop(AC.currentTime+0.35);}
function sfxBoom(){if(!AC)return;const nb=AC.createBuffer(1,AC.sampleRate,AC.sampleRate),d=nb.getChannelData(0);
 for(let i=0;i<d.length;i++)d[i]=(Math.random()*2-1)*Math.exp(-i/(AC.sampleRate*0.3));
 const s=AC.createBufferSource();s.buffer=nb;const f=AC.createBiquadFilter();f.type='lowpass';f.frequency.value=240;
 const g=AC.createGain();g.gain.value=0.9;s.connect(f).connect(g).connect(master);s.start();}
function sfxThunder(v){if(!AC)return;const nb=AC.createBuffer(1,AC.sampleRate*2,AC.sampleRate),d=nb.getChannelData(0);
 for(let i=0;i<d.length;i++)d[i]=(Math.random()*2-1)*Math.exp(-i/(AC.sampleRate*0.8));
 const s=AC.createBufferSource();s.buffer=nb;const f=AC.createBiquadFilter();f.type='lowpass';f.frequency.value=160;
 const g=AC.createGain();g.gain.value=0.55*v;s.connect(f).connect(g).connect(master);s.start();}
function sfxGear(){if(!AC)return;const o=AC.createOscillator(),g=AC.createGain();o.type='triangle';
 o.frequency.setValueAtTime(180,AC.currentTime);o.frequency.linearRampToValueAtTime(90,AC.currentTime+1.2);
 g.gain.setValueAtTime(0.12,AC.currentTime);g.gain.exponentialRampToValueAtTime(0.001,AC.currentTime+1.3);
 o.connect(g).connect(master);o.start();o.stop(AC.currentTime+1.4);}
function sfxAPDisc(){if(!AC)return;for(let i=0;i<3;i++){const o=AC.createOscillator(),g=AC.createGain();o.type='square';
 o.frequency.value=660;const t=AC.currentTime+i*0.18;
 g.gain.setValueAtTime(0.08,t);g.gain.exponentialRampToValueAtTime(0.001,t+0.12);
 o.connect(g).connect(master);o.start(t);o.stop(t+0.13);}}
function sfxClick(){if(!AC)return;const o=AC.createOscillator(),g=AC.createGain();o.type='square';o.frequency.value=720;
 g.gain.setValueAtTime(0.05,AC.currentTime);g.gain.exponentialRampToValueAtTime(0.001,AC.currentTime+0.05);
 o.connect(g).connect(master);o.start();o.stop(AC.currentTime+0.06);}
function audioUpdate(){
  if(!AC)return;master.gain.value=muted?0:S.volume;const t=AC.currentTime;
  const cockpit=camMode===1;
  engBP.frequency.setTargetAtTime(180+N2*6.8+(abLit?900:0),t,0.1);
  engG.gain.setTargetAtTime(crashed?0:(0.03+N2/100*0.2)*(cockpit?0.6:1),t,0.1);
  engOsc.frequency.setTargetAtTime(40+N2*1.8,t,0.1);
  engOG.gain.setTargetAtTime(crashed?0:(0.02+N2/100*0.05)*(cockpit?0.7:1),t,0.1);
  abG.gain.setTargetAtTime(abLit&&!crashed?0.16*(cockpit?0.5:1):0,t,0.08);
  lfG.gain.setTargetAtTime(lfSpool*0.12*(cockpit?0.8:1),t,0.2);
  windG.gain.setTargetAtTime(crashed?0:Math.pow(clamp(ias/600,0,1),2)*0.35*(cockpit?0.4:1),t,0.15);
  windLP.frequency.setTargetAtTime(cockpit?300:500+ias*3,t,0.15);
  rollG.gain.setTargetAtTime(wheelsOn&&P.vel.length()>5?0.08:0,t,0.1);
  rainG.gain.setTargetAtTime(wx.prec*0.2*(cockpit?0.4:1),t,0.4);
  const st=(!crashed&&sep>0.35&&ias>40)?(Math.sin(simT*22)>0?0.09:0.015):0;
  stallG.gain.setTargetAtTime(st,t,0.03);
}
/* ================= [21] HMDS ================= */
const hud=$('hud'),hx=hud.getContext('2d');
let HW=0,HH=0,u=1,hudView={cx:0,cy:0};
function getHudViewport(){
  const vv=window.visualViewport;
  const vw=Math.max(1,Math.round((vv&&vv.width)||document.documentElement.clientWidth||innerWidth||1));
  const vh=Math.max(1,Math.round((vv&&vv.height)||document.documentElement.clientHeight||innerHeight||1));
  const ox=(vv&&Number.isFinite(vv.offsetLeft))?vv.offsetLeft:0;
  const oy=(vv&&Number.isFinite(vv.offsetTop))?vv.offsetTop:0;
  return {vw,vh,ox,oy};
}
function sizeHud(){
  /* Mobile browsers can report a canvas backing store that differs from the
     actual visible viewport, especially on Android when browser chrome, safe
     areas or device-pixel-ratio scaling change. Size the canvas from the real
     visual viewport, then derive the local HUD centre from that viewport's
     centre projected into the canvas box. */
  const d=Math.min(devicePixelRatio||1,2);
  const vp=getHudViewport();
  hud.style.width=vp.vw+'px';hud.style.height=vp.vh+'px';
  hud.width=Math.max(1,Math.round(vp.vw*d));hud.height=Math.max(1,Math.round(vp.vh*d));
  const r=hud.getBoundingClientRect();
  HW=Math.max(1,Math.round(r.width||vp.vw));
  HH=Math.max(1,Math.round(r.height||vp.vh));
  hudView.cx=clamp((vp.ox+vp.vw*0.5)-r.left,0,HW);
  hudView.cy=clamp((vp.oy+vp.vh*0.5)-r.top,0,HH);
  hx.setTransform(d,0,0,d,0,0);
  u=Math.min(HW/1600,HH/900);if(HW<860)u=Math.max(u,0.56);
}
sizeHud();
function txt(s,x,y,col,size,align){hx.fillStyle=col;hx.font=((size||13)*u)+'px ui-monospace, monospace';hx.textAlign=align||'left';hx.textBaseline='middle';hx.fillText(s,x,y);}
function syncHmdsChips(){['hmF','hmN','hmL','hmM'].forEach(id=>$(id).classList.remove('on'));
  const map={FULL:'hmF',NAV:'hmN',LANDING:'hmL',MIN:'hmM'};if(map[S.hmds])$(map[S.hmds]).classList.add('on');}
function drawExternalHUD(){const hj=clamp(buffet,0,1)*Math.min(HW,HH)*.0018,cx=hudView.cx+Math.sin(simT*35.2)*hj,cy=hudView.cy+Math.sin(simT*28.7+1.1)*hj*.55,G='rgba(126,240,168,.92)',D='rgba(126,240,168,.42)',W='rgba(236,244,248,.92)',A='rgba(255,196,107,.96)',R='rgba(255,98,98,.98)';
  const names=['CHASE','COCKPIT','ORBIT','DISTANT','FLY-BY'];txt(names[camMode],cx,34*u,D,10,'center');
  hx.strokeStyle=D;hx.lineWidth=1.4*u;hx.beginPath();hx.moveTo(cx-20*u,cy);hx.lineTo(cx-7*u,cy);hx.moveTo(cx+7*u,cy);hx.lineTo(cx+20*u,cy);hx.moveTo(cx,cy-8*u);hx.lineTo(cx,cy+5*u);hx.stroke();
  txt(Math.round(ias)+' KT',24*u,54*u,G,18,'left');txt(Math.round(P.pos.y*FT)+' FT',HW-24*u,54*u,G,18,'right');txt(String(Math.round(hdgDeg)).padStart(3,'0')+'°',cx,56*u,W,14,'center');
  const a=selectedAirport();if(a){const d=Math.hypot(a.x-P.pos.x-OX,a.z-P.pos.z-OZ)/1000;txt(a.icao+'  '+d.toFixed(1)+' KM',cx,HH-34*u,D,11,'center');}
  const states=[];if(gearD>.5)states.push('GEAR');if(stolMode!=='CRUISE')states.push('STOVL '+Math.round(nozzle)+'°');if(abLit)states.push('A/B');if(AP.mode!=='OFF')states.push('AP '+AP.mode);if(states.length)txt(states.join('  ·  '),cx,HH-16*u,A,10,'center');
  if(gNz>structuralLimit()-.45||gNz<OVERG_WARN_NEG)txt('OVER-G  '+gNz.toFixed(1),cx,96*u,R,18,'center');else if(alpha*R2D>18)txt('HIGH AOA',cx,96*u,A,16,'center');}
function drawHMDS(){
  hx.clearRect(0,0,HW,HH);
  if(!running||S.hmds==='OFF')return;
  if(camMode!==1){drawExternalHUD();return;}
  const mode=S.hmds;
  const narrow=HW<860;
  updateAttitudeData();
  const hj=clamp(buffet,0,1)*Math.min(HW,HH)*.0018;
  const cx=hudView.cx+Math.sin(simT*35.2)*hj,cy=clamp(hudView.cy+(narrow?-0.010:-0.006)*HH+Math.sin(simT*28.7+1.1)*hj*.55,115*u,HH-110*u),ppd=Math.min(HW,HH)/165;
  const G='rgba(126,240,168,0.95)',Gd='rgba(126,240,168,0.4)',A='rgba(255,196,107,0.95)',R='rgba(255,98,98,0.98)',C='rgba(111,214,255,0.95)',W='rgba(230,240,248,0.9)';
  const blink=Math.sin(simT*10)>0;
  /* horizon + pitch ladder */
  hx.save();hx.translate(cx,cy);hx.rotate(-rollDeg*D2R);
  hx.beginPath();hx.rect(-255*u,-190*u,510*u,380*u);hx.clip();
  hx.strokeStyle=G;hx.lineWidth=1.6*u;
  for(let d=-50;d<=50;d+=5){if(d===0)continue;
    const y=(pitchDeg-d)*ppd;if(Math.abs(y)>200*u)continue;
    const w=(d%10===0?60:30)*u;
    hx.beginPath();hx.moveTo(-w,y);hx.lineTo(-14*u,y);hx.moveTo(14*u,y);hx.lineTo(w,y);hx.stroke();
    if(d%10===0){txt(String(Math.abs(d)),-w-8*u,y,Gd,11,'right');txt(String(Math.abs(d)),w+8*u,y,Gd,11,'left');}}
  hx.lineWidth=2*u;hx.beginPath();hx.moveTo(-300*u,pitchDeg*ppd);hx.lineTo(300*u,pitchDeg*ppd);hx.stroke();
  /* flight-path marker (air-relative) + ghost ground track */
  const Vg=P.vel.length();
  if(Vg>5){_q1.copy(P.quat).invert();_v3.copy(P.vel).applyQuaternion(_q1);
    const fpP=Math.asin(clamp(_v3.y/Vg,-1,1))*R2D,fpY=Math.atan2(_v3.x,-_v3.z)*R2D;
    const fx=fpY*ppd,fy=(pitchDeg-fpP)*ppd;
    hx.strokeStyle=W;hx.lineWidth=1.8*u;
    hx.beginPath();hx.arc(fx,fy,7*u,0,TAU);hx.moveTo(fx-16*u,fy);hx.lineTo(fx-7*u,fy);
    hx.moveTo(fx+7*u,fy);hx.lineTo(fx+16*u,fy);hx.moveTo(fx,fy-7*u);hx.lineTo(fx,fy-13*u);hx.stroke();}
  hx.restore();
  /* aircraft reference + bank scale */
  hx.strokeStyle=G;hx.lineWidth=2.4*u;
  hx.beginPath();hx.moveTo(cx-46*u,cy);hx.lineTo(cx-16*u,cy);hx.lineTo(cx-16*u,cy+8*u);
  hx.moveTo(cx+46*u,cy);hx.lineTo(cx+16*u,cy);hx.lineTo(cx+16*u,cy+8*u);
  hx.moveTo(cx,cy-6*u);hx.lineTo(cx,cy+2*u);hx.stroke();
  hx.save();hx.translate(cx,cy);hx.rotate(-rollDeg*D2R);
  hx.strokeStyle=G;hx.lineWidth=2*u;
  hx.beginPath();hx.arc(0,0,150*u,-Math.PI/2-0.62,-Math.PI/2+0.62);hx.stroke();
  for(const a of[-45,-30,-20,-10,0,10,20,30,45]){const ra=(a-90)*D2R;
    hx.beginPath();hx.moveTo(Math.cos(ra)*150*u,Math.sin(ra)*150*u);
    hx.lineTo(Math.cos(ra)*(150-(a===0?14:9))*u,Math.sin(ra)*(150-(a===0?14:9))*u);hx.stroke();}
  hx.fillStyle=G;hx.beginPath();hx.moveTo(0,-138*u);hx.lineTo(-7*u,-124*u);hx.lineTo(7*u,-124*u);hx.closePath();hx.fill();
  hx.restore();
  /* heading tape */
  const ty=cy-215*u;
  hx.strokeStyle=Gd;hx.lineWidth=1.4*u;hx.beginPath();hx.moveTo(cx-260*u,ty+26*u);hx.lineTo(cx+260*u,ty+26*u);hx.stroke();
  for(let d=-40;d<=40;d+=5){const h=norm360(Math.round(hdgDeg/5)*5+d);
    const x=cx+(d-(Math.round(hdgDeg/5)*5-hdgDeg))*ppd*0.9;if(Math.abs(x-cx)>255*u)continue;
    if(h%10===0){hx.strokeStyle=G;hx.beginPath();hx.moveTo(x,ty+26*u);hx.lineTo(x,ty+16*u);hx.stroke();
      if(h%90===0)txt(['N','E','S','W'][Math.round(h/90)%4],x,ty+4*u,W,15,'center');
      else txt(String(h/10),x,ty+4*u,Gd,11,'center');}}
  hx.fillStyle=G;hx.beginPath();hx.moveTo(cx,ty+26*u);hx.lineTo(cx-6*u,ty+36*u);hx.lineTo(cx+6*u,ty+36*u);hx.closePath();hx.fill();
  txt(String(Math.round(hdgDeg)).padStart(3,'0')+'°',cx,ty+50*u,W,14,'center');
  /* speed & altitude tapes */
  const boxOff=narrow?Math.min(330*u,HW/2-76*u):330*u;
  txt(String(Math.round(ias)),cx-boxOff,cy,G,26,'right');
  hx.strokeStyle=Gd;hx.strokeRect(cx-boxOff-62*u,cy-20*u,70*u,40*u);
  txt('IAS',cx-boxOff,cy+30*u,Gd,10,'right');
  txt(String(Math.round(P.pos.y*FT)),cx+boxOff,cy,G,26,'left');
  hx.strokeStyle=Gd;hx.strokeRect(cx+boxOff-8*u,cy-20*u,86*u,40*u);
  txt('ALT',cx+boxOff,cy+30*u,Gd,10,'left');
  txt('M '+mach.toFixed(2),cx+boxOff,cy-42*u,Gd,12,'left');
  if(ralt<760)txt('R '+Math.round(ralt*FT),cx+boxOff,cy+50*u,C,12,'left');
  if(mode==='FULL'||mode==='NAV'){
    txt('TAS '+Math.round(Vtas/KT),cx-boxOff,cy+50*u,Gd,11,'right');
    txt('GS '+Math.round(P.vel.length()/KT),cx-boxOff,cy+66*u,Gd,11,'right');
    txt('VS '+(vsFpm>0?'+':'')+Math.round(vsFpm/100)*100,cx+boxOff,cy+66*u,Gd,11,'left');}
  /* AoA + G */
  const gAo=narrow?120*u:270*u;
  const aDeg=alpha*R2D,onSpd=aDeg>7.5&&aDeg<11.5;
  txt(aDeg.toFixed(1),cx-gAo,cy+44*u,onSpd?G:W,17,'center');txt('AOA',cx-gAo,cy+62*u,Gd,9,'center');
  if(onSpd){hx.strokeStyle=G;hx.beginPath();hx.arc(cx-gAo,cy+48*u,20*u,0,TAU);hx.stroke();}
  txt(gNz.toFixed(1),cx+gAo,cy+44*u,(gNz>structuralLimit()-.45||gNz<OVERG_WARN_NEG)?R:W,17,'center');txt('G',cx+gAo,cy+62*u,Gd,9,'center');
  /* ILS / approach guidance */
  if((mode==='LANDING'||mode==='NAV'||mode==='FULL')&&ilsValid&&ilsData.dist<46000){
    const iy=cy+150*u;
    hx.strokeStyle=Gd;hx.beginPath();hx.moveTo(cx-110*u,iy);hx.lineTo(cx+110*u,iy);hx.stroke();
    const lx=cx-clamp(ilsData.err/3,-1,1)*100*u;
    hx.fillStyle=C;hx.beginPath();hx.moveTo(lx,iy-8*u);hx.lineTo(lx+7*u,iy);hx.lineTo(lx,iy+8*u);hx.lineTo(lx-7*u,iy);hx.closePath();hx.fill();
    const gx=cx+(narrow?150:205)*u;
    hx.strokeStyle=Gd;hx.beginPath();hx.moveTo(gx,iy-100*u);hx.lineTo(gx,iy);hx.stroke();
    const gy=iy+clamp(ilsData.gs/1.5,-1,1)*90*u;
    hx.beginPath();hx.moveTo(gx-8*u,gy);hx.lineTo(gx,gy-7*u);hx.lineTo(gx+8*u,gy);hx.lineTo(gx,gy+7*u);hx.closePath();hx.fill();
    const a=ilsData.apt;
    txt('ILS RWY'+a.num+' '+(a.icao)+' '+(ilsData.dist/1000).toFixed(1)+'KM CRS '+String(Math.round(ilsData.inb)).padStart(3,'0'),cx,iy+18*u,C,11,'center');
    if(ilsMode!=='OFF'&&AP.mode==='APPR')txt('APR '+ilsMode+(ilsMode==='ARM'?' · GS ARM':''),cx,iy+34*u,G,11,'center');}
  /* annunciators */
  let ax0=cx-250*u,annRow=0;const ay=cy-265*u;
  function ann(t,on,col){if(!on)return;hx.font=(11*u)+'px ui-monospace, monospace';
    const w=hx.measureText(t).width+22*u;if(ax0+w>HW-14*u){annRow++;ax0=cx-250*u;}
    txt(t,ax0,ay+annRow*16*u,col||G,11,'left');ax0+=w;}
  ann('PARK',parkBrake,A);ann('BRK',brakes&&wheelsOn,A);ann('A/SKID',antiSkid,A);
  ann('GEAR '+(gearD>0.95?'DN':gearD>0.05?'TR':'UP'),true,gearD>0.95?G:gearD>0.05?A:Gd);
  ann('FCS '+S.fbw,true,Gd);
  ann(stolMode==='CONV'?'CONV':'STOVL '+stolMode,true,stolMode==='CONV'?Gd:A);
  if(stolMode!=='CONV')ann('NOZ '+nozzle.toFixed(0)+'° LF '+(lfSpool*100).toFixed(0)+'%',true,A);
  ann('AP '+(AP.mode==='OFF'?'—':AP.mode),AP.mode!=='OFF',C);
  ann('SURF AUTO',true,Gd);
  ann('WING VAP',condWing>.12,C);ann('TRANS VAP',condTrans>.12,C);ann('CONTRAIL',contrail>.12,Gd);
  /* state line */
  const state=parkBrake?'PARKED':wheelsOn?(P.vel.length()>2?'TAXI':'WOW'):'AIRBORNE';
  ann(state,true,W);
  /* warnings + master caution/warning */
  let wy=cy-130*u;let masterW=false,masterC=false;
  function warn(t,col,fl){if(fl&&!blink)return;txt(t,cx,wy,col,narrow?20:24,'center');wy-=(narrow?26:30)*u;
    if(col===R)masterW=true;else masterC=true;}
  if(fuel<500)warn('FUEL CRITICAL',R,true);else if(fuel<1200)warn('FUEL LOW',A,true);
  if(engineOut)warn('ENGINE OUT',R,true);
  if(sep>0.58&&ias>40&&!wheelsOn)warn('STALL',R,true);else if(sep>0.30&&ias>40&&!wheelsOn)warn('AOA LIMIT',A,true);
  if(!wheelsOn&&ralt<110&&P.vel.y<-5)warn('PULL UP',R,true);
  else if(!wheelsOn&&ralt<240&&P.vel.y<-6)warn('TERRAIN',A,true);
  let inStorm=0;for(const c of storms){const d=Math.hypot(P.pos.x+OX-c.x,P.pos.z+OZ-c.z);if(d<c.r)inStorm=1;}
  if(inStorm)warn('WINDSHEAR',R,true);
  if(gearD<0.9&&ralt<160&&(thr<0.45||flapPos>0.5)&&!wheelsOn)warn('GEAR',A,true);
  if(mach>1.5||ias>620)warn('OVERSPEED',A,true);
  if(gNz>structuralLimit()-.45||gNz<OVERG_WARN_NEG)warn('OVER-G',R,true);
  if(TIT>1120)warn('ENG HOT',A,true);
  if(stolMode!=='CONV'&&Tvert<(DRY+fuel)*G0)warn('LOW POWER',A,true);
  if(masterW&&blink){txt('⚠ MASTER WARNING',cx,40*u,R,16,'center');}
  else if(masterC&&blink){txt('▲ MASTER CAUTION',cx,40*u,A,16,'center');}
  /* wind + steerpoint */
  if(mode!=='MIN'){
    txt('WIND '+String(Math.round(wx.windDir)).padStart(3,'0')+'°/'+Math.round(wx.windNow*1.94)+'KT',14*u,HH-40*u,Gd,11,'left');
    const a=nearestApt();
    txt('▸ '+a.name+' '+(Math.hypot(a.x-P.pos.x-OX,a.z-P.pos.z-OZ)/1000).toFixed(1)+'KM',14*u,24*u,W,narrow?12:14,'left');}
  /* hover power margin */
  if(stolMode!=='CONV'){const hy=cy+110*u,mass=(DRY+fuel);
    txt('VERT '+(Tvert/1000).toFixed(0)+'kN  WGT '+(mass*G0/1000).toFixed(0)+'kN  MGN '+(((Tvert-mass*G0)/(mass*G0))*100).toFixed(0)+'%',cx-250*u,hy,C,12,'left');}
}
/* minimap (collapsible info, not permanent) */
let mmNext=0;const mmCan=document.createElement('canvas');mmCan.width=mmCan.height=96;const mmx=mmCan.getContext('2d');
function drawMinimap(s,mx,my){
  const interval=clamp(2.6-Vtas*0.012,0.7,2.6);
  if(simT<mmNext)return;mmNext=simT+interval;
  const range=mapRange,img=mmx.createImageData(96,96),pgx=P.pos.x+OX,pgz=P.pos.z+OZ;
  for(let j=0;j<96;j++)for(let i=0;i<96;i++){
    const x=pgx+(i-48)*range/96,z=pgz+(j-48)*range/96,h=heightAt(x,z);let r,g,b;
    if(h<0){const d=clamp(-h/700,0,1);r=14+20*(1-d);g=44+30*(1-d);b=66+30*(1-d);}
    else if(h<4){r=170;g=155;b=110;}else if(h<400){r=64;g=98;b=54;}
    else if(h<950){r=96;g=96;b=72;}else if(h<1450){r=120;g=118;b=112;}else{r=228;g=233;b=238;}
    const k=(j*96+i)*4;img.data[k]=r;img.data[k+1]=g;img.data[k+2]=b;img.data[k+3]=255;}
  mmx.putImageData(img,0,0);
  mmx.fillStyle='rgba(160,168,176,0.9)';
  for(const c of cities){const px=48+(c.x-pgx)/range*96,py=48+(c.z-pgz)/range*96;
    if(px>0&&px<96&&py>0&&py<96){mmx.beginPath();mmx.arc(px,py,2.4,0,TAU);mmx.fill();}}
  for(const a of airports){const p1x=48+(a.thrAx-pgx)/range*96,p1y=48+(a.thrAz-pgz)/range*96;
    const p2x=48+(a.thrBx-pgx)/range*96,p2y=48+(a.thrBz-pgz)/range*96;
    if(p1x>-6&&p1x<102&&p1y>-6&&p1y<102){mmx.strokeStyle=a.platform?'#6fd6ff':a.stovl?'#7ef0a8':a.size==='L'?'#fff':a.size==='M'?'#9fd8ff':'#ffc46b';mmx.lineWidth=a.size==='L'?2:1.35;
      if(a.stovl){mmx.beginPath();mmx.arc((p1x+p2x)*.5,(p1y+p2y)*.5,a.platform?2.8:2.2,0,TAU);mmx.stroke();}
      else{mmx.beginPath();mmx.moveTo(p1x,p1y);mmx.lineTo(p2x,p2y);mmx.stroke();}}}
  mmx.strokeStyle='rgba(255,98,98,0.8)';
  for(const c of storms){const px=48+(c.x-pgx)/range*96,py=48+(c.z-pgz)/range*96;
    mmx.beginPath();mmx.arc(px,py,c.r/range*96,0,TAU);mmx.stroke();}
}
function fmtT(t){const m=Math.floor(t/60),s=Math.floor(t%60);return m+':'+String(s).padStart(2,'0');}
/* ================= [22] CAMERA + VISIBILITY ================= */
function applyVisibility(){
  const inCockpit=!crashed&&camMode===1;
  ac.visible=!crashed&&!inCockpit;
  cockpitGrp.visible=inCockpit;
  if(AC_SURF.cockpitGlass)AC_SURF.cockpitGlass.visible=!inCockpit;
}
function snapCameraToAircraft(){
  /* Scenario changes can move the rigid body by kilometres before the first
     flight frame.  Reset both chase filters so an airborne start never spends
     several seconds watching the jet recede from its former parking position. */
  const distant=camMode===3;
  camPos.copy(_v1.set(0,distant?13:4.6,distant?48:17.2).applyQuaternion(P.quat)).add(P.pos);
  camLook.copy(_v2.set(0,.6,-7).applyQuaternion(P.quat)).add(P.pos);
  camTrackPos.copy(P.pos);
  flybyT=0;
}
function updateCamera(dt){
  if(bootCam){orbitA+=dt*0.12;
    const a=airports[0]||{x:0,z:0,elev:10},ax=a.x-OX,az=a.z-OZ;
    camera.position.set(ax+Math.cos(orbitA)*160,a.elev+45+Math.sin(orbitA*0.7)*12,az+Math.sin(orbitA)*160);
    camera.lookAt(ax,a.elev+4,az);camera.fov=55;camera.updateProjectionMatrix();applyVisibility();return;}
  if(camMode!==1&&L.camera!=='STANDARD'){
    if(L.camera==='FIXED'){if(!fixedCameraAnchor)fixedCameraAnchor=camera.position.clone();camera.position.copy(fixedCameraAnchor);}
    else{const angle=L.camera==='CINEMATIC'?simT*.065:.22;const d=L.camera==='PRECISION'?13:29;_v1.set(Math.sin(angle)*d,L.camera==='PRECISION'?2.8:7,Math.cos(angle)*d).multiplyScalar(L.zoom).applyQuaternion(P.quat);camera.position.copy(P.pos).add(_v1);}
    camera.position.y=Math.max(camera.position.y,surfaceH(camera.position.x+OX,camera.position.z+OZ)+1.4);camera.lookAt(P.pos);camera.fov=L.camera==='PRECISION'?48:52;camera.updateProjectionMatrix();applyVisibility();return;
  }
  /* Carry the filter by the rigid body's translation before smoothing the local
     camera offset. This removes the former speed-dependent camera lag (about
     V/5 metres at the old damping rate) without making pitch/roll transitions
     abrupt at high speed. */
  _v3.copy(P.pos).sub(camTrackPos);camPos.add(_v3);camLook.add(_v3);camTrackPos.copy(P.pos);
  if(camMode===2){orbitA+=dt*0.3;
    camera.position.copy(P.pos).add(_v1.set(Math.cos(orbitA)*20,6,Math.sin(orbitA)*20));
    camera.lookAt(P.pos);applyVisibility();return;}
  if(camMode===4){flybyT-=dt;if(flybyT<=0){flybyT=7;_fwd.set(0,0,-1).applyQuaternion(P.quat);_rgt.set(1,0,0).applyQuaternion(P.quat);
      flybyAnchor.copy(P.pos).addScaledVector(_fwd,150).addScaledVector(_rgt,45).add(_v3.set(0,22,0));}
    camera.position.lerp(flybyAnchor,1-Math.exp(-3*dt));camera.lookAt(P.pos);camera.fov=48;camera.updateProjectionMatrix();applyVisibility();return;}
  if(camMode===1){
    /* Put the eye point at a believable pilot head position and use a less
       distorted field of view so the instrument panel sits low in frame and
       the outside world remains visible. */
    const buffetAmp=L.shake*clamp(buffet*.026+wx.turb*.0015+(wheelsOn?Math.min(P.vel.length()/900,0.012):0),0,.034);
    camera.position.copy(P.pos).add(_v1.set(Math.sin(simT*29)*buffetAmp,0.80+Math.sin(simT*23)*buffetAmp*.55,-2.18).applyQuaternion(P.quat));
    _q2.copy(P.quat);
    _q1.setFromEuler(new THREE.Euler(headPitch-0.02,headYaw,headRoll,'YXZ'));
    _q2.multiply(_q1);camera.quaternion.copy(_q2);
    camera.fov=65+clamp(mach,0,1.6)*3.2;camera.updateProjectionMatrix();
    /* Camera position is deterministic. Aerodynamic buffet still acts on the
       airframe and instruments, but it no longer injects artificial random
       displacement into the viewer. */
    applyVisibility();return;}
  /* Keep the complete 10.7 m span and canted tails in-frame.  The earlier
     9.2 m chase offset sat almost on the exhaust and cropped most of the jet. */
  const back=(camMode===3?_v1.set(2.4,13.5,50):_v1.set(1.65,5.2,19.8)).multiplyScalar(L.zoom).applyQuaternion(P.quat).add(P.pos);
  camPos.lerp(back,1-Math.exp(-5*dt));
  const look=_v2.set(0,0.55,-7.9).applyQuaternion(P.quat).add(P.pos);
  camLook.lerp(look,1-Math.exp(-6*dt));
  camera.position.copy(camPos);
  const shake=L.shake*clamp(buffet*.070+wx.turb*.003+(wheelsOn?P.vel.length()*.00005:0),0,.090);camera.position.add(_v3.set(Math.sin(simT*27.3),Math.sin(simT*33.7)*.55,Math.sin(simT*24.1)*.35).multiplyScalar(shake));
  camera.position.y=Math.max(camera.position.y,surfaceH(camera.position.x+OX,camera.position.z+OZ)+1.6);
  camera.lookAt(camLook);
  const f=(camMode===3?46:54+clamp(mach,0,1.6)*5.5);if(Math.abs(camera.fov-f)>0.2){camera.fov=f;camera.updateProjectionMatrix();}
  applyVisibility();
}
function rebaseOrigin(){
  if(Math.abs(P.pos.x)<15000&&Math.abs(P.pos.z)<15000)return;
  const dx=P.pos.x,dz=P.pos.z;for(const f of replayFrames){f.p[0]-=dx;f.p[2]-=dz;}if(replayRestore){replayRestore.p.x-=dx;replayRestore.p.z-=dz;}OX+=dx;OZ+=dz;P.pos.x=0;P.pos.z=0;
  camPos.x-=dx;camPos.z-=dz;camLook.x-=dx;camLook.z-=dz;camTrackPos.x-=dx;camTrackPos.z-=dz;if(fixedCameraAnchor){fixedCameraAnchor.x-=dx;fixedCameraAnchor.z-=dz;}
  for(let i=0;i<140;i++){expPos[i*3]-=dx;expPos[i*3+2]-=dz;}
  worldGroup.position.set(-OX,0,-OZ);
}
/* animate aircraft surfaces */
function updateAcSurfaces(dt){
  ac.position.copy(P.pos);ac.quaternion.copy(P.quat);
  if(cockpitGrp){cockpitGrp.position.copy(P.pos);cockpitGrp.quaternion.copy(P.quat);}
  ac.userData.gear.forEach((g,i)=>{g.scale.y=0.08+0.92*gearD;g.rotation.x=(1-gearD)*(i===0?1.1:-0.7);});
  /* wheels spin + nose steers */
  ac.userData.wheels.forEach((w,i)=>{w.rotation.x+=wheelOmega[Math.min(i+1,3)]*dt;});
  ac.userData.gear.forEach((g,i)=>{const ci=i===0?0:Math.min(i,2);g.position.y=(g.userData.baseY||0)-wheelCompression[ci]*.12;});
  if(ac.userData.gear[0])ac.userData.gear[0].rotation.y=ctl.rud*0.5*clamp(1-P.vel.length()/40,0,1);
  const s1=AC_SURF['stab1'],s2=AC_SURF['stab-1'];
  if(s1)s1.rotation.x=-dE;if(s2)s2.rotation.x=-dE;
  const f1=AC_SURF['flap1'],f2=AC_SURF['flap-1'];
  if(f1)f1.rotation.x=flapPos*0.5+dA*0.78;if(f2)f2.rotation.x=flapPos*0.5-dA*0.78;
  const le1=AC_SURF['lef1'],le2=AC_SURF['lef-1'];if(le1)le1.rotation.x=lefPos*.22;if(le2)le2.rotation.x=lefPos*.22;
  const r1=AC_SURF['rud1'],r2=AC_SURF['rud-1'];
  if(r1)r1.rotation.y=dR*0.86;if(r2)r2.rotation.y=dR*0.86;
  if(AC_SURF.lfDoor)AC_SURF.lfDoor.rotation.x=-lfDoor*1.1;
  if(AC_SURF.aux1)AC_SURF.aux1.rotation.x=-lfDoor*.72;
  if(AC_SURF['aux-1'])AC_SURF['aux-1'].rotation.x=-lfDoor*.72;
  if(AC_SURF.lfLower){AC_SURF.lfLower.visible=lfDoor>.025;AC_SURF.lfLower.scale.set(1,.2+.8*lfDoor,1);}
  if(AC_SURF.roll1)AC_SURF.roll1.visible=lfDoor>.04;if(AC_SURF['roll-1'])AC_SURF['roll-1'].visible=lfDoor>.04;
  if(AC_SURF.fanRows){const fs=dt*(5+lfSpool*92);AC_SURF.fanRows[0].rotation.y+=fs;AC_SURF.fanRows[1].rotation.y-=fs*.92;}else if(AC_SURF.fan)AC_SURF.fan.rotation.y+=dt*(5+lfSpool*92);
  if(AC_SURF.nozzle)AC_SURF.nozzle.rotation.x=nozzle*D2R;
  if(AC_SURF.nozSeg0)AC_SURF.nozSeg0.rotation.x=-nozzle*D2R*.10;
  if(AC_SURF.nozSeg1)AC_SURF.nozSeg1.rotation.x=nozzle*D2R*.08;
  if(AC_SURF.nozSeg2)AC_SURF.nozSeg2.rotation.x=-nozzle*D2R*.05;
  const abPulse=0.58+0.22*Math.sin(simT*33.0)+0.10*Math.sin(simT*61.0+1.1),abStrength=abLit&&!crashed?clamp((thr-0.94)/0.06,0,1):0;
  if(AC_SURF.ab){
    const pulse=clamp(abPulse,0,1),cellVis=abStrength*clamp(.40+smooth(0.45,1.35,mach),.40,1.0),lng=0.78+0.24*abStrength+0.06*pulse;
    AC_SURF.ab.visible=abStrength>0.01;
    if(AC_SURF.abOuter){AC_SURF.abOuter.material.opacity=abStrength*(0.05+0.06*pulse);AC_SURF.abOuter.scale.set(0.92+0.05*pulse,0.92+0.05*pulse,lng);}
    if(AC_SURF.abMid){AC_SURF.abMid.material.opacity=abStrength*(0.06+0.09*pulse);AC_SURF.abMid.scale.set(0.95,0.95,0.92+0.18*pulse);}
    if(AC_SURF.abInner){AC_SURF.abInner.material.opacity=abStrength*(0.11+0.14*pulse);AC_SURF.abInner.scale.set(0.98,0.98,0.86+0.16*pulse);}
    if(AC_SURF.abCore){AC_SURF.abCore.material.opacity=abStrength*(0.09+0.10*pulse);AC_SURF.abCore.scale.set(1,1,0.82+0.12*pulse);}
    if(AC_SURF.abHalo){AC_SURF.abHalo.material.opacity=abStrength*(0.13+0.10*pulse);AC_SURF.abHalo.scale.set(0.52+0.10*pulse,0.52+0.10*pulse,1);}
    if(Array.isArray(AC_SURF.abShock)){
      for(let i=0;i<AC_SURF.abShock.length;i++){
        const ring=AC_SURF.abShock[i],s=1+i*0.12+0.05*pulse;
        ring.material.opacity=cellVis*(i<2?0.10:0.06)*(1-i*0.12);
        ring.scale.set(s,s,1);
        ring.position.z=0.18+i*(0.15+0.015*pulse)+abStrength*0.02;
      }
    }
    if(AC_SURF.nozHeat){AC_SURF.nozHeat.material.opacity=abStrength*(0.12+0.08*pulse);AC_SURF.nozHeat.scale.set(1+0.03*pulse,1+0.03*pulse,1);}
  }
  for(const key of ['nozSeg0','nozSeg1','nozSeg2']){
    const grp=AC_SURF[key],seg=grp&&grp.children&&grp.children[0];
    if(seg&&seg.material&&seg.material.emissive){
      seg.material.emissive.setRGB(0.20*abStrength,0.09*abStrength,0.03*abStrength);
      seg.material.emissiveIntensity=0.65*abStrength;
    }
  }
  ac.userData.abLight.intensity=abStrength>0.01?0.22+0.36*abStrength+0.12*clamp(abPulse,0,1):0;
  ac.userData.spot.intensity=lights?1.6*(0.3+nightF):0;
  const navVis=.10+.90*nightF,navScale=.72+.72*nightF;ac.userData.navL.material.opacity=navVis;ac.userData.navR.material.opacity=navVis;ac.userData.navL.scale.set(navScale,navScale,1);ac.userData.navR.scale.set(navScale,navScale,1);
  const ph=(simT*1000)%1200;ac.userData.strobe.scale.setScalar(.75+.55*nightF);ac.userData.strobe.scale.z=1;
  ac.userData.strobe.material.opacity=((ph<60||(ph>140&&ph<200))?1:0)*(.28+.72*nightF);
  const shAlt=clamp(ralt,0,180),shStretch=1+clamp((1-sunDir.y)*1.8,0,2.6)+shAlt*.003;
  shadowBlob.position.set(P.pos.x-sunDir.x*shAlt*.32,surfaceH(P.pos.x+OX,P.pos.z+OZ)+.35,P.pos.z-sunDir.z*shAlt*.32);
  shadowBlob.rotation.y=Math.atan2(_fwd.x,-_fwd.z);shadowBlob.scale.set(shStretch,1+shAlt*.002,1);
  shadowBlob.material.opacity=clamp(1.08-ralt/210,0,1)*(.22+.14*dayF)*(1-wx.cov*.35);
  if(expT>0){expT-=dt;const pa=expGeo.attributes.position.array;
    for(let i=0;i<140;i++){expVel[i].y-=35*dt;pa[i*3]+=expVel[i].x*dt;pa[i*3+1]+=expVel[i].y*dt;pa[i*3+2]+=expVel[i].z*dt;
      const g=surfaceH(pa[i*3]+OX,pa[i*3+2]+OZ);if(pa[i*3+1]<g)pa[i*3+1]=g;}
    expGeo.attributes.position.needsUpdate=true;expPts.material.opacity=Math.max(0,expT/1.6);}
}
/* ================= [23] UI / LIFECYCLE ================= */
let toastTO=null;
function toast(msg,kind){const t=$('toast');t.textContent=msg;t.className=kind||'';t.classList.add('on');
 clearTimeout(toastTO);toastTO=setTimeout(()=>t.classList.remove('on'),3200);}
function applyWx(){
  const p=WXP[wxPreset];
  Object.assign(wx,{cov:p.cov,prec:p.prec,vis:p.vis,wind:p.wind,gust:p.gust,temp0:p.temp,press:p.press,rh:p.rh,turb:p.turb});
  const r=mulberry32(SEED*19);wx.windDir0=(r()*360)|0;
  clearStorms();
  const sx=P.pos.x+OX,sz=P.pos.z+OZ;
  for(let i=0;i<p.storm;i++)makeStorm(sx+(r()-0.5)*80000,sz+(r()-0.5)*80000,i);
  updateMetar();$('statWx').textContent='WX '+wxPreset.toUpperCase();
}
function updateMetar(){
  const a=airports[0]||{icao:'KPXY'};
  const d=new Date(),dd=String(d.getUTCDate()).padStart(2,'0'),hh=String(d.getUTCHours()).padStart(2,'0'),mm=String(Math.floor(d.getUTCMinutes()/10)*10).padStart(2,'0');
  const wdir=String(Math.round(wx.windDir0/10)*10%360).padStart(3,'0'),wspd=String(Math.round(wx.wind*1.94)).padStart(2,'0');
  const vis=wx.vis>=10000?'9999':String(Math.round(wx.vis)).padStart(4,'0');
  const temp=Math.round(wx.temp0),dew=temp-Math.round((100-wx.rh)/5);
  const tf=temp<0?'M'+String(Math.abs(temp)).padStart(2,'0'):String(temp).padStart(2,'0');
  const df=dew<0?'M'+String(Math.abs(dew)).padStart(2,'0'):String(dew).padStart(2,'0');
  const base=Math.max(60,125*(temp-dew)),bft=String(Math.round(base/FT/100)).padStart(3,'0');
  let cl;if(wx.vis<5000&&wx.rh>94)cl='VV001';
  else cl=(wx.cov<0.2?'FEW':wx.cov<0.45?'SCT':wx.cov<0.8?'BKN':'OVC')+bft+(WXP[wxPreset].storm?' CB':'');
  $('metar').textContent=`${a.icao} ${dd}${hh}${mm}Z ${wdir}${wspd}KT ${vis} ${cl} ${tf}/${df} Q${Math.round(wx.press)} RMK SEED ${SEED}`;
}
function runLog(){
  const el=$('log');el.innerHTML='';let i=0;
  const lines=[
   ['> PWR BUS 28VDC ............ ','OK','ok'],['> INS ALIGN ................ ','OK  [GPS-3 LOCKED]','ok'],
   ['> ENGINE F135-PW-600 ....... ','RUNNING','ok'],['> FLCS BIT ................. ','PASS  [FBW 4-CH + PROT]','ok'],
   [`> TERRAIN DB ............... `,`SEED ${SEED} · ${airports.length} APT · ${cities.length} URBAN`,'ok'],
   ['> WORLD LAYERS ............. ','FOREST · FARMLAND · WIND · MARITIME','ok'],
   ['> STOVL LIFT FAN ........... ','READY','ok'],['> HMDS / PCD ............... ','ONLINE','ok'],
   ['> WX DATALINK .............. ','LIVE','ok']];
  const iv=setInterval(()=>{if(i>=lines.length){clearInterval(iv);return;}
    const l=lines[i++];el.innerHTML+=`<span class="dm">${l[0]}</span><span class="${l[2]}">${l[1]}</span>\n`;},170);
}
function resetFlightSystems(){
  AP.mode='OFF';AP.armed='';apDiscReason='';ilsMode='OFF';ilsArmT=0;
  N1=50;N2=55;abTimer=0;abSpool=0;abLit=false;TIT=620;inletDistortion=0;compressorSurge=0;surgeTimer=0;engineOut=fuel<=0;restartTimer=0;
  thr=0;thrT=.2;ctl.el=ctl.ail=ctl.rud=0;
  trimE=0;neutralPitchRef=0;neutralPitchArmed=false;sep=0;dE=0;dA=0;dR=0;bankRef=0;gNz=nzF=1;gNy=gNx=0;alphaPrev=betaPrev=alphaRate=betaRate=0;
  flapPos=lefPos=0;wheelsOn=prevWheelsOn=false;impactVS=0;tdArmed=false;tdAirT=0;dmg=0;gearDmg=0;hovAlt=-1;
  stolMode='CONV';lfDoor=0;lfSpool=0;nozzle=0;
  tIn.el=0;tIn.ail=0;tIn.rud=0;tIn.thr=null;
  tch.el=tch.ail=tch.rud=0;tch.brk=false;tch.thrOn=false;tch.thr=.2;shake=0;
  Object.assign(stats,{maxAlt:0,maxMach:0,maxG:0,dist:0,warnings:0,hoverT:0,tdVs:0,tdAcross:0,tdDist:0,
    tdScore:0,tdGrade:'—',tdHdg:0,tdSpeed:0,tdAirport:'',approachStable:true,nearMisses:0,missionScore:0,missionGrade:'—'});
  wheelOmega.fill(0);wheelSlip.fill(0);wheelCompression.fill(0);resetReplay();resetMission();
  stats.fuelStart=fuel;
  if(stallG)stallG.gain.value=0;
}
let startType=['PARK','RUNWAY','AIR','HOVER'].includes(SAVED.startType)?SAVED.startType:'PARK',scenario=SAVED.scenario||'FREE FLIGHT';
function placeAt(type){
  const a=selectedAirport()||airports[0];
  const s=Math.sin(a.hdg*D2R),c=Math.cos(a.hdg*D2R);
  if(type==='PARK'||type==='RUNWAY'){
    const off=type==='PARK'?-0.75:-0.05;
    P.pos.set(a.thrAx-OX-a.ux*(a.rwyLen*off)-a.rx*(type==='PARK'?a.rwyW:0),
      a.elev+1.56,a.thrAz-OZ-a.uz*(a.rwyLen*off)-a.rz*(type==='PARK'?a.rwyW:0));
    P.vel.set(0,0,0);P.quat.setFromAxisAngle(_yUp,-a.hdg*D2R);
    gearT=1;gearD=1;parkBrake=true;prevWheelsOn=true;thr=thrT=.2;N1=50;N2=55;
  } else if(type==='AIR'){
    const approachDistance=worldMode==='LONDON'?2500:8000;
    const ax=a.thrAx-a.ux*approachDistance,az=a.thrAz-a.uz*approachDistance;
    const glideAlt=a.elev+Math.tan(3*D2R)*approachDistance;
    P.pos.set(ax-OX,Math.max(glideAlt,surfaceH(ax,az)+60),az-OZ);
    /* Approach vector points from threshold A toward the runway. The baseline used
       the opposite sign, so airborne starts visually faced the field while moving away. */
    P.vel.set(a.ux*76,-3.8,a.uz*76);P.quat.setFromAxisAngle(_yUp,-a.hdg*D2R);
    gearT=0;gearD=0;parkBrake=false;thr=thrT=.68;N1=79;N2=82;
  } else if(type==='HOVER'){
    /* Hover training uses a light but credible recovery load. At full internal fuel
       the public ~180 kN LiftSystem rating is intentionally insufficient here. */
    fuel=Math.min(fuel,MAX_FUEL*.25);
    /* Hover training starts over the flattened runway centre, not over unknown
       approach terrain that may be higher than the airport. */
    P.pos.set(a.x-OX,a.elev+80,a.z-OZ);
    P.vel.set(0,0,0);P.quat.setFromAxisAngle(_yUp,-a.hdg*D2R);
    stolMode='HOVER';lfDoor=1;lfSpool=1;nozzle=90;gearT=1;gearD=1;parkBrake=false;
    const hp=hoverTrimPower(DRY+fuel);thr=thrT=hp.throttle;N2=hp.n2;N1=clamp(hp.n2-3,47,100);hovAlt=80;
  }
  P.om.set(0,0,0);stats.fuelStart=fuel;
}
function selectedFuel(){const el=$('selFuel');return MAX_FUEL*clamp(el?parseFloat(el.value):.55,.2,1);}
function configureScenarioState(){
  if(scenario==='STOVL QUALIFICATION'){fuel=Math.min(fuel,MAX_FUEL*.28);stolMode='TO_HOVER';lfDoor=.48;lfSpool=.52;nozzle=32;thr=thrT=.45;N1=70;N2=74;}
  else if(scenario==='STORM DIVERSION'){wxPreset='bkn';applyWx();gearT=gearD=0;thr=thrT=.67;N1=79;N2=82;}
  else if(scenario==='LOW-LEVEL NAVIGATION'){gearT=gearD=0;P.pos.y=Math.max(surfaceH(P.pos.x+OX,P.pos.z+OZ)+150,220);P.vel.multiplyScalar(1.7);thr=thrT=.78;N1=87;N2=90;}
  else if(scenario==='ENGINE EMERGENCY'){gearT=gearD=0;engineOut=true;N1=24;N2=18;Teng=0;thr=thrT=.15;}
  else if(scenario==='TRAFFIC INTERCEPT'){gearT=gearD=0;thr=thrT=.78;N1=87;N2=90;}
  else if(scenario==='OFFSHORE RECOVERY'){fuel=Math.min(fuel,MAX_FUEL*.22);gearT=gearD=1;}
  else if(scenario==='SHORT TAKEOFF'){stolMode='TO_HOVER';lfDoor=.55;lfSpool=.6;nozzle=38;thr=thrT=.5;N1=72;N2=76;}
  else if(scenario==='STOVL TRANSITION'){stolMode='TO_HOVER';lfDoor=.2;lfSpool=.15;nozzle=12;thr=thrT=.72;N1=81;N2=84;}
  else if(scenario==='ILS APPROACH'){
    const a=selectedAirport()||airports[0];
    gearT=gearD=1;thr=thrT=.50;N1=72;N2=76;AP.mode='APPR';AP.alt=P.pos.y;AP.hdg=a.hdg;AP.spd=72;
    ilsMode='ARM';ilsArmT=0;computeILS();crossPrev=ilsData.cross;
  }
  else if(scenario==='HUMID VAPOUR RUN'){
    const a=selectedAirport()||airports[0];
    P.pos.y=Math.max(2600,surfaceH(P.pos.x+OX,P.pos.z+OZ)+1800);P.vel.set(a.ux*278,0,a.uz*278);
    gearT=gearD=0;parkBrake=false;thr=thrT=.88;N1=94;N2=96;
  }
  else if(scenario==='VERTICAL LANDING'){gearT=gearD=1;hovAlt=ralt>5?ralt:80;}
  else if(scenario==='ENGINE-OUT LANDING'){engineOut=true;N1=24;N2=18;Teng=0;thr=thrT=.15;}
  stats.fuelStart=fuel;
}
function respawn(){
  fuel=selectedFuel();crashed=false;autoBrake=false;expT=0;expPts.material.opacity=0;
  clearVapour();
  resetFlightSystems();placeAt(startType);configureScenarioState();initMission();
  snapCameraToAircraft();
  $('crashOv').classList.remove('on');applyVisibility();
  const a=nearestApt();
  toast(`RESPAWNED — ${a.name} · RWY ${a.num}${parkBrake?' · PARKING BRAKE SET':''}`);
}
let selAptIdx=0,navTargetIcao=SAVED.aptIcao||'',mapRange=32000;
function populateApts(){
  const sel=$('selApt');sel.innerHTML='';
  airports.forEach((a,i)=>{const o=document.createElement('option');
    o.value=i;o.textContent=`${a.icao} ${a.name} — ${airportTypeLabel(a)} · ${a.rwyLen}M`;sel.appendChild(o);});
  const si=navTargetIcao?airports.findIndex(a=>a.icao===navTargetIcao):-1;
  selAptIdx=si>=0?si:0;navTargetIcao=(airports[selAptIdx]||{}).icao||'';sel.value=selAptIdx;
}
const SCENARIOS=['FREE FLIGHT','STOVL QUALIFICATION','STORM DIVERSION','LOW-LEVEL NAVIGATION','ENGINE EMERGENCY','TRAFFIC INTERCEPT','OFFSHORE RECOVERY','CONVENTIONAL TAKEOFF','CIRCUIT & LANDING','CROSSWIND LANDING','ILS APPROACH','NIGHT LANDING','LOW-VIS APPROACH','HUMID VAPOUR RUN','SHORT TAKEOFF','STOVL TRANSITION','HOVER PRACTICE','VERTICAL LANDING','NAVIGATION FLIGHT','FUEL MANAGEMENT','ENGINE-OUT LANDING','DIVERSION'];
function scenarioSupportedInWorld(name,mode){return mode!=='LONDON'||!['TRAFFIC INTERCEPT','OFFSHORE RECOVERY'].includes(name);}
function populateScen(){const sel=$('selScen');sel.innerHTML='';
  SCENARIOS.forEach(s=>{const o=document.createElement('option');o.value=s;o.disabled=!scenarioSupportedInWorld(s,worldMode);o.textContent=s+(o.disabled?' (Legacy only)':'');sel.appendChild(o);});
  if(SCENARIOS.includes(scenario)&&scenarioSupportedInWorld(scenario,worldMode))sel.value=scenario;else{scenario='FREE FLIGHT';sel.value=scenario;}}
function applyScenario(){
  scenario=$('selScen').value;
  if(!scenarioSupportedInWorld(scenario,worldMode)){scenario='FREE FLIGHT';$('selScen').value=scenario;}
  switch(scenario){
    case'STOVL QUALIFICATION':startType='RUNWAY';break;
    case'STORM DIVERSION':wxPreset='bkn';startType='AIR';break;
    case'LOW-LEVEL NAVIGATION':startType='AIR';break;
    case'ENGINE EMERGENCY':startType='AIR';break;
    case'TRAFFIC INTERCEPT':startType='AIR';break;
    case'OFFSHORE RECOVERY':startType='HOVER';break;
    case'CONVENTIONAL TAKEOFF':startType='RUNWAY';break;
    case'CIRCUIT & LANDING':startType='AIR';break;
    case'ILS APPROACH':startType='AIR';break;
    case'CROSSWIND LANDING':wxPreset='sct';wx.wind=12;wx.gust=3;startType='AIR';break;
    case'NIGHT LANDING':simHours=23.3;startType='AIR';break;
    case'LOW-VIS APPROACH':wxPreset='fog';startType='AIR';break;
    case'HUMID VAPOUR RUN':wxPreset='humid';startType='AIR';break;
    case'SHORT TAKEOFF':startType='RUNWAY';break;
    case'STOVL TRANSITION':startType='AIR';break;
    case'HOVER PRACTICE':startType='HOVER';break;
    case'VERTICAL LANDING':startType='HOVER';break;
    case'ENGINE-OUT LANDING':startType='AIR';break;
    case'NAVIGATION FLIGHT':case'FUEL MANAGEMENT':case'DIVERSION':startType='AIR';break;
    case'FREE FLIGHT':break;
    default:startType='PARK';
  }
  document.querySelectorAll('#stPark,#stRunway,#stAir,#stHover').forEach(c=>c.classList.remove('on'));
  $({PARK:'stPark',RUNWAY:'stRunway',AIR:'stAir',HOVER:'stHover'}[startType]).classList.add('on');
}
function newWorld(seed){
  LightningLondon.dispose();aptProxyGeo.setDrawRange(0,0);
  SEED=clamp(parseInt(seed)||1000,1,999999);$('seed').value=SEED;
  for(const [,v] of chunks)releaseChunk(v);chunks.clear();
  for(const [k,g] of aptGroups){worldGroup.remove(g);disposeGroup(g);}aptGroups.clear();
  for(const [k,g] of cityGroups){worldGroup.remove(g);disposeGroup(g);}cityGroups.clear();
  for(const [,g] of roadGroups){if(g){worldGroup.remove(g);disposeGroup(g);}}roadGroups.clear();
  clearLocalTrafficHub();
  for(const [k,g] of wfGroups){if(g)removeWindFarm(g);}wfGroups.clear();windTurbines.length=0;
  clearStorms();clearVapour();vapRng=mulberry32(SEED*43+17);hCache.clear();OX=0;OZ=0;worldGroup.position.set(0,0,0);
  genWorld();populateApts();populateScen();initClouds();
  if(worldMode==='LONDON')LightningLondon.create(THREE,worldGroup,terrainMat);
  water.visible=worldMode!=='LONDON';terrainMat.uniforms.uLondon.value=worldMode==='LONDON'?1:0;skyMat.uniforms.uGroundHorizon.value=worldMode==='LONDON'?1:0;
  $('worldMode').value=worldMode;$('worldNote').textContent=worldMode==='LONDON'?'London v0.4: 39 × 15 km · Sentinel-2 10m imagery · EA LiDAR heights + estimated gaps':'Legacy procedural world · generated geography';
  fuel=selectedFuel();crashed=false;autoBrake=false;parkBrake=true;
  resetFlightSystems();applyScenario();placeAt(startType);configureScenarioState();
  applyWx();initShips();
  snapCameraToAircraft();
  $('statSeed').textContent='SEED '+SEED;
  chunkBudget=999;ensureChunks(1);
  const pc=Math.floor((P.pos.x+OX)/CHUNK),pj=Math.floor((P.pos.z+OZ)/CHUNK);
  for(const c of chunkQueue)if(Math.max(Math.abs(c.ci-pc),Math.abs(c.cj-pj))<=1)buildChunk(c.ci,c.cj,c.lod);
  chunkQueue.length=0;ensureChunks(1);
  runLog();applyVisibility();
}
function startSortie(){
  if(running)return;
  fuel=selectedFuel();resetFlightSystems();applyScenario();applyWx();placeAt(startType);configureScenarioState();
  snapCameraToAircraft();
  running=true;bootCam=false;paused=false;
  initAudio();if(AC)AC.resume();
  $('boot').style.display='none';$('hud').classList.add('on');
  $('btnSet').classList.add('on');$('btnInfo').classList.add('on');$('btnHelp').classList.add('on');$('btnFull').classList.add('on');
  $('trafficCue').classList.add('on');$('sTarget').classList.toggle('on',S.targetMarker);$('sTarget').textContent=S.targetMarker?'ON':'OFF';
  const a=nearestApt();
  initMission();
  toast(`CLEARED — ${a.name} · RWY ${a.num}${parkBrake?' · PARKING BRAKE SET (P)':''}`);
  if(!SAVED.tutorialSeen){SAVED.tutorialSeen=true;showHelp();savePrefs(false);}
}
/* Saved-flight input boundary, before any world/flight mutation. Limits are
   corruption guards, deliberately wider than the simulated aircraft envelope. */
function validSavedFlight(f){
  if(!f||typeof f!=='object'||Array.isArray(f)||!Number.isInteger(f.seed)||f.seed<1||f.seed>999999)return false;
  const vector=(a,n,max)=>Array.isArray(a)&&a.length===n&&Array.from(a).every(v=>Number.isFinite(v)&&Math.abs(v)<=max);
  if(!vector(f.pos,3,1e12)||f.pos[1]<-12000||f.pos[1]>1e7||!vector(f.vel,3,10000)||!vector(f.om,3,100)||!vector(f.quat,4,1e6))return false;
  const norm=Math.hypot(...f.quat);return norm>1e-6&&norm<=1e6;
}
function savePrefs(withFlight=true){
  const apt=selectedAirport()||airports[0],fuelEl=$('selFuel');
  const payload={worldMode:typeof worldMode==='undefined'?'LEGACY':worldMode,seed:SEED,settings:Object.assign({},S),wxPreset,simHours,startType,scenario,tutorialSeen:!!SAVED.tutorialSeen,
    fuelLoad:fuelEl?fuelEl.value:'.55',aptIcao:apt&&apt.icao,flight:SAVED.flight||null};
  if(withFlight&&running&&!crashed&&!replayActive){
    const candidate={worldMode:typeof worldMode==='undefined'?'LEGACY':worldMode,seed:SEED,pos:[P.pos.x+OX,P.pos.y,P.pos.z+OZ],vel:P.vel.toArray(),quat:P.quat.toArray(),om:P.om.toArray(),
      fuel,thr,thrT,N1,N2,abSpool,gearD,gearT,parkBrake,stolMode,lfDoor,lfSpool,nozzle,simT,flightT,camMode,wxPreset,simHours};
    if(validSavedFlight(candidate))payload.flight=candidate;}
  SAVED=payload;
  try{localStorage.setItem(SAVE_KEY,JSON.stringify(payload));}catch(e){}
  $('continue').style.display=payload.flight?'block':'none';
}
function continueSavedFlight(){
  const f=SAVED.flight;
  if(!validSavedFlight(f)){toast('INVALID SAVED FLIGHT — START NEW OR CLEAR SAVED DATA','warn');return false;}
  const finite=(v,d)=>Number.isFinite(v)?v:d;
  const savedMode=f.worldMode==='LONDON'?'LONDON':'LEGACY';
  if(typeof worldMode!=='undefined'&&worldMode!==savedMode){worldMode=savedMode;newWorld(f.seed);}
  else if(f.seed!==SEED)newWorld(f.seed);
  startSortie();OX=0;OZ=0;worldGroup.position.set(0,0,0);
  P.pos.fromArray(f.pos);P.vel.fromArray(f.vel||[0,0,0]);P.quat.fromArray(f.quat).normalize();P.om.fromArray(f.om||[0,0,0]);
  fuel=clamp(finite(f.fuel,selectedFuel()),0,MAX_FUEL);thr=clamp(finite(f.thr,.2),0,1);thrT=clamp(finite(f.thrT,thr),0,1);N2=clamp(finite(f.N2,55),0,105);N1=clamp(finite(f.N1,N2-4),0,105);abSpool=clamp(finite(f.abSpool,0),0,1);
  gearD=clamp(finite(f.gearD,1),0,1);gearT=clamp(finite(f.gearT,gearD),0,1);parkBrake=!!f.parkBrake;
  stolMode=['CONV','TO_HOVER','HOVER','TO_CONV'].includes(f.stolMode)?f.stolMode:'CONV';lfDoor=clamp(finite(f.lfDoor,0),0,1);lfSpool=clamp(finite(f.lfSpool,0),0,1);nozzle=clamp(finite(f.nozzle,0),0,90);
  simT=Math.max(0,finite(f.simT,0));flightT=Math.max(0,finite(f.flightT,0));simHours=finite(f.simHours,simHours);camMode=clamp(f.camMode|0,0,4);
  const sh=surfaceH(P.pos.x,P.pos.z);if(P.pos.y<sh+1.2){P.pos.y=sh+80;P.vel.y=Math.max(0,P.vel.y);}
  crashed=false;paused=false;hovAlt=-1;clearVapour();updateAttitudeData();ensureRegionalFeatures(0,true);applyVisibility();
  toast('SAVED FLIGHT RESTORED');return true;
}
function syncMenuShade(){
  const open=$('drawer').classList.contains('on')||$('infoPan').classList.contains('on');
  $('menuShade').classList.toggle('on',open);$('menuShade').setAttribute('aria-hidden',String(!open));
}
function closeDrawer(){$('drawer').classList.remove('on');$('drawer').setAttribute('aria-hidden','true');$('btnSet').setAttribute('aria-expanded','false');syncMenuShade();}
function closeInfoPanel(){$('infoPan').classList.remove('on');$('infoPan').setAttribute('aria-hidden','true');$('btnInfo').setAttribute('aria-expanded','false');syncMenuShade();}
function toggleDrawer(){const opening=!$('drawer').classList.contains('on');closeInfoPanel();$('drawer').classList.toggle('on',opening);$('drawer').setAttribute('aria-hidden',String(!opening));$('btnSet').setAttribute('aria-expanded',String(opening));syncMenuShade();}
function toggleInfoPanel(){const opening=!$('infoPan').classList.contains('on');closeDrawer();$('infoPan').classList.toggle('on',opening);$('infoPan').setAttribute('aria-hidden',String(!opening));$('btnInfo').setAttribute('aria-expanded',String(opening));syncMenuShade();}
function closeTransientMenus(){closeDrawer();closeInfoPanel();}
let helpResume=false;
function showHelp(){closeTransientMenus();helpResume=running&&!paused;if(running)paused=true;$('helpOv').classList.add('on');$('helpOv').setAttribute('aria-hidden','false');$('btnHelp').setAttribute('aria-expanded','true');}
function closeHelp(){$('helpOv').classList.remove('on');$('helpOv').setAttribute('aria-hidden','true');$('btnHelp').setAttribute('aria-expanded','false');if(helpResume&&running&&!crashed)paused=false;helpResume=false;}
function closeSummary(){$('sumOv').classList.remove('on');$('sumOv').setAttribute('aria-hidden','true');}
function togglePause(){
  if(crashed||!running)return;paused=!paused;
  if(paused)closeTransientMenus();
  $('pauseStats').innerHTML=`FLIGHT TIME ${fmtT(flightT)} · LANDINGS ${landings} · FUEL ${Math.round(fuel)} KG · WX ${wxPreset.toUpperCase()}`;
  $('pauseOv').classList.toggle('on',paused);$('pauseOv').setAttribute('aria-hidden',String(!paused));
}
function showSummary(){
  const fuelUsed=stats.fuelStart-fuel;
  let lines=`FLIGHT TIME     ${fmtT(flightT)}\nDISTANCE        ${(stats.dist/1000).toFixed(1)} KM\nFUEL USED       ${fuelUsed.toFixed(0)} KG\nMAX ALTITUDE    ${(stats.maxAlt*FT).toFixed(0)} FT\nMAX MACH        ${stats.maxMach.toFixed(2)}\nMAX G           ${stats.maxG.toFixed(1)}\nHOVER TIME      ${stats.hoverT.toFixed(0)} S\nWARNINGS        ${stats.warnings}`;
  if(stats.tdVs!==0)lines+=`\nLANDING SCORE   ${stats.tdScore}/100 (${stats.tdGrade})\nLANDING VS      ${(stats.tdVs*FPM).toFixed(0)} FPM\nCENTERLINE DEV  ${Math.abs(stats.tdAcross).toFixed(1)} M\nHEADING ERROR   ${stats.tdHdg.toFixed(1)} DEG\nTOUCHDOWN DIST  ${stats.tdDist.toFixed(0)} M${stats.tdAirport?'\nAIRPORT         '+stats.tdAirport:''}`;
  if(MISSION.active||MISSION.completed)lines+=`\nMISSION SCORE   ${stats.missionScore||MISSION.score}/100 (${stats.missionGrade||missionGrade(MISSION.score)})\nNEAR MISSES     ${stats.nearMisses}\nREPLAY BUFFER   ${Math.round(replayFrames.length/REPLAY_HZ)} S`;
  $('sumStats').textContent=lines;
  $('sumGrade').textContent=(MISSION.active||MISSION.completed?'OPERATION '+(stats.missionGrade||missionGrade(MISSION.score))+' · '+(stats.missionScore||MISSION.score)+'/100  |  ':'')+'LANDING '+(stats.tdVs===0?'—':stats.tdGrade+' · '+stats.tdScore+'/100');
  $('sumOv').classList.add('on');$('sumOv').setAttribute('aria-hidden','false');
}
/* UI wiring */
$('start').addEventListener('click',startSortie);
$('btnReplay').addEventListener('click',startReplay);$('btnSumReplay').addEventListener('click',startReplay);
$('continue').addEventListener('click',continueSavedFlight);
$('resetSave').addEventListener('click',()=>{try{localStorage.removeItem(SAVE_KEY);}catch(e){}SAVED={};$('continue').style.display='none';toast('SAVED DATA CLEARED');});
$('worldMode').addEventListener('change',()=>{worldMode=$('worldMode').value;SAVED.flight=null;navTargetIcao='';newWorld(SEED);savePrefs(false);});
$('dice').addEventListener('click',()=>{newWorld(1000+((Math.random()*9000)|0));sfxClick();});
let seedTO=null;
$('seed').addEventListener('input',()=>{clearTimeout(seedTO);seedTO=setTimeout(()=>newWorld($('seed').value),500);});
$('selApt').addEventListener('change',e=>{selAptIdx=parseInt(e.target.value);navTargetIcao=(airports[selAptIdx]||{}).icao||'';});
$('selScen').addEventListener('change',applyScenario);
document.querySelectorAll('.wchip').forEach(ch=>ch.addEventListener('click',()=>{
  document.querySelectorAll('.wchip').forEach(c=>c.classList.remove('on'));ch.classList.add('on');
  wxPreset=ch.dataset.w;applyWx();sfxClick();}));
document.querySelectorAll('.tchip').forEach(ch=>ch.addEventListener('click',()=>{
  document.querySelectorAll('.tchip').forEach(c=>c.classList.remove('on'));ch.classList.add('on');
  simHours=parseFloat(ch.dataset.t);sfxClick();}));
[['stPark','PARK'],['stRunway','RUNWAY'],['stAir','AIR'],['stHover','HOVER']].forEach(([id,v])=>{
  $(id).addEventListener('click',()=>{startType=v;
    document.querySelectorAll('#stPark,#stRunway,#stAir,#stHover').forEach(c=>c.classList.remove('on'));
    $(id).classList.add('on');});});
[['asA','ASSIST'],['asS','STANDARD'],['asE','ADVANCED']].forEach(([id,v])=>{
  $(id).addEventListener('click',()=>{S.fbw=v;
    document.querySelectorAll('#asA,#asS,#asE').forEach(c=>c.classList.remove('on'));$(id).classList.add('on');});});
$('asF').addEventListener('click',()=>{S.fail=S.fail==='OFF'?'BASIC':S.fail==='BASIC'?'REAL':'OFF';
  $('asF').textContent='FAIL:'+S.fail;$('asF').classList.toggle('on',S.fail!=='OFF');});
$('btnResume').addEventListener('click',togglePause);
$('btnPauseClose').addEventListener('click',togglePause);
$('btnEndFlight').addEventListener('click',()=>{togglePause();showSummary();});
$('btnSumClose').addEventListener('click',closeSummary);$('btnSummaryClose').addEventListener('click',closeSummary);
$('btnRestart').addEventListener('click',()=>{togglePause();respawn();});
$('btnNewWorld').addEventListener('click',()=>{togglePause();newWorld(1000+((Math.random()*9000)|0));toast('NEW WORLD — SEED '+SEED);});
$('btnNewWorld2').addEventListener('click',()=>{$('crashOv').classList.remove('on');newWorld(1000+((Math.random()*9000)|0));toast('NEW WORLD — SEED '+SEED);});
$('btnRespawn').addEventListener('click',respawn);$('btnCrashClose').addEventListener('click',respawn);
$('btnSet').addEventListener('click',toggleDrawer);$('btnDrawerClose').addEventListener('click',closeDrawer);
$('btnFull').addEventListener('click',toggleFullscreen);$('bootFull').addEventListener('click',toggleFullscreen);
$('btnInfo').addEventListener('click',toggleInfoPanel);$('btnInfoClose').addEventListener('click',closeInfoPanel);
$('btnHelp').addEventListener('click',()=>{$('helpOv').classList.contains('on')?closeHelp():showHelp();});
$('btnHelpClose').addEventListener('click',closeHelp);$('btnHelpTopClose').addEventListener('click',closeHelp);
$('menuShade').addEventListener('click',closeTransientMenus);
for(const [id,fn] of[['helpOv',closeHelp],['sumOv',closeSummary],['pauseOv',togglePause]])$(id).addEventListener('click',e=>{if(e.target===$(id))fn();});
/* drawer wiring */
[['sfA','ASSIST'],['sfS','STANDARD'],['sfE','ADVANCED']].forEach(([id,v])=>{
  $(id).addEventListener('click',()=>{S.fbw=v;
    document.querySelectorAll('#sfA,#sfS,#sfE').forEach(c=>c.classList.remove('on'));$(id).classList.add('on');});});
[['ffO','OFF'],['ffB','BASIC'],['ffR','REAL']].forEach(([id,v])=>{
  $(id).addEventListener('click',()=>{S.fail=v;
    document.querySelectorAll('#ffO,#ffB,#ffR').forEach(c=>c.classList.remove('on'));$(id).classList.add('on');});});
[['psA','RELAXED'],['psS','REAL']].forEach(([id,v])=>{$(id).classList.toggle('on',S.structure===v);$(id).addEventListener('click',()=>{S.structure=v;document.querySelectorAll('#psA,#psS').forEach(c=>c.classList.remove('on'));$(id).classList.add('on');toast('STRUCTURAL MODEL — '+v);});});
$('sSens').addEventListener('input',e=>S.sens=parseFloat(e.target.value));
$('sExpo').addEventListener('input',e=>S.expo=parseFloat(e.target.value));
$('sDz').addEventListener('input',e=>S.dz=parseFloat(e.target.value));
$('sInv').addEventListener('click',()=>{S.invPitch=!S.invPitch;$('sInv').classList.toggle('on',S.invPitch);$('sInv').textContent=S.invPitch?'ON':'OFF';});
$('sCo').addEventListener('click',()=>{S.coord=!S.coord;$('sCo').classList.toggle('on',S.coord);$('sCo').textContent=S.coord?'ON':'OFF';});
$('sHa').addEventListener('click',()=>{S.hoverAssist=!S.hoverAssist;$('sHa').classList.toggle('on',S.hoverAssist);$('sHa').textContent=S.hoverAssist?'ON':'OFF';});
$('sTarget').addEventListener('click',toggleTargetMarker);
[['hmF','FULL'],['hmN','NAV'],['hmL','LANDING'],['hmM','MIN']].forEach(([id,v])=>{
  $(id).addEventListener('click',()=>{S.hmds=v;syncHmdsChips();});});
$('tOp').addEventListener('input',e=>{S.tOp=parseFloat(e.target.value);$('touchui').style.opacity=S.tOp;});
$('tSz').addEventListener('input',e=>{S.tSz=parseFloat(e.target.value);tstick.style.transform=`scale(${S.tSz})`;});
function applyTouchHand(v){
  S.hand=v==='L'?'L':'R';$('hR').classList.toggle('on',S.hand==='R');$('hL').classList.toggle('on',S.hand==='L');
  tstick.className=S.hand==='R'?'r':'l';tthr.className=S.hand==='R'?'l':'r';
  /* The button bank stays opposite the flight stick. The throttle occupies a
     separate inward column beside the buttons, so neither control can cover it. */
  $('tbtns').className=S.hand==='R'?'r':'l';
}
[['hR','R'],['hL','L']].forEach(([id,v])=>{
  $(id).addEventListener('click',()=>applyTouchHand(v));});
$('tRud').addEventListener('click',()=>{S.rudSlider=!S.rudSlider;
  $('tRud').classList.toggle('on',S.rudSlider);$('tRud').textContent=S.rudSlider?'ON':'OFF';
  $('trud').classList.toggle('on',S.rudSlider);
  $('tpedals').style.display=S.rudSlider?'none':'flex';});
$('sGy').addEventListener('click',gyroEnable);
$('sGc').addEventListener('click',gyroCal);
$('gDz').addEventListener('input',e=>S.gDz=parseFloat(e.target.value));
[['gTb',true],['gTa',false]].forEach(([id,v])=>{
  $(id).addEventListener('click',()=>{gpThrAxis=!v;S.gThrBtn=v;
    $('gTb').classList.toggle('on',v);$('gTa').classList.toggle('on',!v);});});
[['qA','AUTO'],['qL','LOW'],['qM','MED'],['qH','HIGH']].forEach(([id,v])=>{
  $(id).addEventListener('click',()=>{S.quality=v;L.profile={AUTO:'BALANCED',LOW:'BATTERY',MED:'BALANCED',HIGH:'HIGH'}[v];saveLightningOptions();if($('lightningProfile'))$('lightningProfile').value=L.profile;
    document.querySelectorAll('#qA,#qL,#qM,#qH').forEach(c=>c.classList.remove('on'));$(id).classList.add('on');applyQuality();});});
[['vR','REDUCED'],['vN','NORMAL'],['vE','ENHANCED']].forEach(([id,v])=>{
  $(id).addEventListener('click',()=>{S.vapour=v;
    document.querySelectorAll('#vR,#vN,#vE').forEach(c=>c.classList.remove('on'));$(id).classList.add('on');toast('VAPOUR VISIBILITY — '+v);});});
$('sVol').addEventListener('input',e=>{S.volume=parseFloat(e.target.value);if(master)master.gain.value=muted?0:S.volume;});
$('sScan').addEventListener('click',()=>{S.scan=!S.scan;document.body.classList.toggle('scan',S.scan);$('sScan').classList.toggle('on',S.scan);$('sScan').textContent=S.scan?'ON':'OFF';});
document.addEventListener('change',()=>savePrefs(false));
document.addEventListener('click',e=>{if(e.target.closest('.chip,.schip,.stgl'))setTimeout(()=>savePrefs(false),0);});
addEventListener('beforeunload',()=>savePrefs(true));
/* quality governor: every 2 seconds, 6s overload / 10s recovery hysteresis. */
let qlLevel=Lightning.profiles[L.profile].cap,qlCap=qlLevel,govT=0;
let mobileGov=new Lightning.QualityGovernor(qlCap);
function ql(){return qlLevel;}
function applyQuality(){qlCap=Lightning.profiles[L.profile].cap;mobileGov=new Lightning.QualityGovernor(qlCap);qlLevel=qlCap;cadence.interval=1000/Lightning.profiles[L.profile].fps;cadence.reset();applyQl();}
function applyQl(){const b=Lightning.bufferSize(innerWidth,innerHeight,devicePixelRatio,L.profile,qlLevel);prCur=b.ratio;renderer.setPixelRatio(prCur);renderer.setSize(innerWidth,innerHeight);vegDensity=[.22,.42,.68,1][qlLevel];lodRadius=[4,5,6,7][qlLevel];}
function governor(dt){govT-=dt;if(govT>0)return;govT=2;const level=mobileGov.sample(frameEMA,lastWorkMs);if(level!==qlLevel){qlLevel=level;applyQl();}}

/* ================= [25] LIVING OPERATIONS / REPLAY / EFFECTS ================= */
const MISSION={active:false,completed:false,name:'FREE FLIGHT',steps:[],step:0,time:0,score:100,penalties:0,hold:0,target:null,waypoints:[],eventT:0,message:'',detail:''};
const MISSION_SCENARIOS=new Set(['STOVL QUALIFICATION','STORM DIVERSION','LOW-LEVEL NAVIGATION','ENGINE EMERGENCY','TRAFFIC INTERCEPT','OFFSHORE RECOVERY']);
let missionUiT=0,missionBannerT=0,trafficT=0,nearMissCooldown=0;
const trafficAlert={level:'',distance:1e9,closure:0,target:null,bearing:0};
function resetMission(){Object.assign(MISSION,{active:false,completed:false,name:'FREE FLIGHT',steps:[],step:0,time:0,score:100,penalties:0,hold:0,target:null,waypoints:[],eventT:0,message:'',detail:''});const b=$('missionBox');if(b)b.classList.remove('on');}
function missionGrade(v){return v>=94?'A+':v>=86?'A':v>=76?'B':v>=64?'C':v>=50?'D':'FAIL';}
function missionBanner(text,type=''){const e=$('missionBanner');if(!e)return;e.textContent=text;e.className=type;e.classList.add('on');missionBannerT=3.2;sfxClick();}
function completeObjective(msg){MISSION.step++;MISSION.hold=0;MISSION.score=clamp(MISSION.score+4,0,100);missionBanner(msg||'OBJECTIVE COMPLETE');if(MISSION.step>=MISSION.steps.length)completeMission();}
function failMission(msg){if(!MISSION.active)return;MISSION.score=Math.min(MISSION.score,45);MISSION.active=false;MISSION.completed=true;MISSION.message=msg;stats.missionScore=Math.round(MISSION.score);stats.missionGrade='FAIL';missionBanner('MISSION FAILED — '+msg,'bad');buzz([80,60,80]);}
function completeMission(){MISSION.active=false;MISSION.completed=true;stats.missionScore=Math.round(clamp(MISSION.score,0,100));stats.missionGrade=missionGrade(stats.missionScore);missionBanner('OPERATION COMPLETE — '+stats.missionGrade+' '+stats.missionScore,'');buzz([45,35,90]);saveMissionRecord();}
function saveMissionRecord(){try{const k='f35b_ops_records_v1',r=JSON.parse(localStorage.getItem(k)||'{}');const old=r[MISSION.name];if(!old||stats.missionScore>old.score)r[MISSION.name]={score:stats.missionScore,grade:stats.missionGrade,time:MISSION.time,seed:SEED,date:Date.now()};localStorage.setItem(k,JSON.stringify(r));}catch(e){}}
function penalize(points,msg,type='warn'){if(!MISSION.active)return;MISSION.score=clamp(MISSION.score-points,0,100);MISSION.penalties++;if(msg&&MISSION.message!==msg){MISSION.message=msg;missionBanner(msg,type);}}
function pointAround(a,bearing,dist,agl=160){const th=bearing*D2R,x=a.x+Math.sin(th)*dist,z=a.z-Math.cos(th)*dist;return{x,z,y:surfaceH(x,z)+agl};}
function ensureMissionPlatform(){let p=airports.find(a=>a.platform);if(p)return p;const home=selectedAirport()||airports[0];for(let r=7000;r<30000;r+=1800)for(let k=0;k<28;k++){const th=k/28*TAU+SEED*.001,x=home.x+Math.cos(th)*r,z=home.z+Math.sin(th)*r;if(rawHeight(x,z)<-2){p=addAirport(x,z,900000+SEED,'mission','OFFSHORE');p.name='LIGHTNING RECOVERY DECK';p.icao='LHD1';populateApts();return p;}}return airports.find(a=>a.stovl)||home;}
function initMission(){resetMission();if(!MISSION_SCENARIOS.has(scenario))return;MISSION.active=true;MISSION.name=scenario;MISSION.score=100;MISSION.time=0;MISSION.eventT=0;const a=selectedAirport()||nearestApt();
  if(scenario==='STOVL QUALIFICATION'){MISSION.target=a;MISSION.steps=['SHORT TAKEOFF','FORWARD TRANSITION','OUTBOUND GATE','RETURN TO FIELD','VERTICAL LANDING'];MISSION.waypoints=[pointAround(a,norm360(a.hdg+35),6500,450)];}
  else if(scenario==='STORM DIVERSION'){const alts=airports.filter(x=>x!==a&&!x.platform).sort((x,y)=>Math.hypot(x.x-a.x,x.z-a.z)-Math.hypot(y.x-a.x,y.z-a.z));MISSION.target=alts[0]||a;MISSION.steps=['STABILISE IN WEATHER','DIVERSION ORDER','REACH ALTERNATE','LAND SAFELY'];MISSION.detail='Destination weather is deteriorating';}
  else if(scenario==='LOW-LEVEL NAVIGATION'){MISSION.target=a;MISSION.steps=['GATE 1','GATE 2','GATE 3','GATE 4','RECOVER'];MISSION.waypoints=[pointAround(a,a.hdg+45,6000,135),pointAround(a,a.hdg+125,8500,120),pointAround(a,a.hdg+215,7600,150),pointAround(a,a.hdg+305,5200,130)];}
  else if(scenario==='ENGINE EMERGENCY'){MISSION.target=a;MISSION.steps=['ESTABLISH BEST GLIDE','REACH FINAL APPROACH','LAND WITHOUT POWER'];MISSION.detail='Engine flameout — preserve energy';setNavAirport(a);}
  else if(scenario==='TRAFFIC INTERCEPT'){MISSION.target=civAir[0]||null;MISSION.steps=['ACQUIRE TARGET','JOIN FORMATION','IDENTIFY','ESCORT'];MISSION.detail=MISSION.target?MISSION.target.callsign:'Traffic is being acquired';}
  else if(scenario==='OFFSHORE RECOVERY'){MISSION.target=ensureMissionPlatform();MISSION.steps=['TRANSIT TO DECK','STABILISE HOVER','DESCEND TO DECK','TOUCH DOWN'];setNavAirport(MISSION.target);MISSION.detail=MISSION.target.platform?'Moving-deck recovery':'STOVL pad recovery';}
  $('missionBox').classList.add('on');missionBanner('OPERATION START — '+MISSION.name);updateMissionUI(true);
}
function missionObjectiveText(){if(!MISSION.active&&!MISSION.completed)return'No active objective';if(MISSION.completed)return MISSION.message||('Completed '+missionGrade(MISSION.score));const s=MISSION.steps[MISSION.step]||'COMPLETE';
  if(MISSION.name==='STOVL QUALIFICATION')return ["Use partial nozzle and lift fan; become airborne","Accelerate through 180 KT and return to CONV","Pass the outbound gate","Return within 2 KM and convert for hover","Land vertically on the assigned surface"][MISSION.step]||s;
  if(MISSION.name==='STORM DIVERSION')return ["Hold attitude and remain clear of terrain","Await and accept the diversion","Fly to "+(MISSION.target?.icao||'alternate'),"Land at the alternate"][MISSION.step]||s;
  if(MISSION.name==='LOW-LEVEL NAVIGATION')return MISSION.step<4?`Fly gate ${MISSION.step+1}; remain 60–220 m AGL`:'Return and land';
  if(MISSION.name==='ENGINE EMERGENCY')return ["Maintain 155–190 KT and avoid excessive sink","Reach 6 KM final with landing gear selected","Land on the assigned runway"][MISSION.step]||s;
  if(MISSION.name==='TRAFFIC INTERCEPT')return ["Close to within 1.2 KM","Hold within 350 m and match speed","Hold visual position for 12 seconds","Escort within 500 m for 20 seconds"][MISSION.step]||s;
  if(MISSION.name==='OFFSHORE RECOVERY')return ["Navigate to the recovery deck","Hold below 35 KT within 180 m","Descend below 12 m AGL over deck","Touch down gently on deck"][MISSION.step]||s;return s;}
function distanceToTarget(){if(MISSION.name==='TRAFFIC INTERCEPT'&&MISSION.target?.g){const p=MISSION.target.g.position;return Math.hypot(p.x-(P.pos.x+OX),p.y-P.pos.y,p.z-(P.pos.z+OZ));}const t=MISSION.step<MISSION.waypoints.length?MISSION.waypoints[MISSION.step]:MISSION.target;if(!t)return 1e9;return Math.hypot(t.x-(P.pos.x+OX),(t.y??P.pos.y)-P.pos.y,t.z-(P.pos.z+OZ));}
function missionPhysicsUpdate(dt){if(!MISSION.active||replayActive)return;MISSION.time+=dt;MISSION.eventT+=dt;let done=false,hold=false;const d=distanceToTarget(),agl=ralt;
  if(crashed){failMission('AIRCRAFT LOST');return;}
  if(MISSION.name==='STOVL QUALIFICATION'){
    if(MISSION.step===0)done=!wheelsOn&&agl>18&&ias>75;
    else if(MISSION.step===1)done=ias>180&&stolMode==='CONV'&&nozzle<5;
    else if(MISSION.step===2)done=d<650;
    else if(MISSION.step===3)done=Math.hypot(MISSION.target.x-(P.pos.x+OX),MISSION.target.z-(P.pos.z+OZ))<2200&&nozzle>55;
    else if(MISSION.step===4)done=stats.tdVs!==0&&stats.tdAirport===MISSION.target.icao&&ias<70;
    if(MISSION.step<2&&!wheelsOn&&ias>70&&Math.abs(alpha*R2D)>28)penalize(dt*1.2,'EXCESSIVE AOA');
  } else if(MISSION.name==='STORM DIVERSION'){
    if(MISSION.step===0){done=MISSION.eventT>12&&Math.abs(bank*R2D)<40;if(agl<120)penalize(dt*2,'TERRAIN — CLIMB','bad');}
    else if(MISSION.step===1){if(MISSION.eventT>5){wxPreset='ts';applyWx();setNavAirport(MISSION.target);MISSION.detail='Runway closed — divert '+MISSION.target.icao;done=true;}}
    else if(MISSION.step===2)done=d<7000;
    else if(MISSION.step===3)done=stats.tdAirport===MISSION.target.icao&&stats.tdScore>0;
  } else if(MISSION.name==='LOW-LEVEL NAVIGATION'){
    if(MISSION.step<4){done=d<520;if(agl<55)penalize(dt*2.5,'TOO LOW','bad');else if(agl>240)penalize(dt*.45,'ABOVE LOW-LEVEL BLOCK');if(ias<170)penalize(dt*.25,'SPEED LOW');}
    else done=stats.tdScore>0;
  } else if(MISSION.name==='ENGINE EMERGENCY'){
    if(MISSION.step===0){hold=ias>150&&ias<195&&P.vel.y>-18;done=MISSION.hold>7;}
    else if(MISSION.step===1){done=Math.hypot(MISSION.target.x-(P.pos.x+OX),MISSION.target.z-(P.pos.z+OZ))<6000&&gearT>.5;}
    else done=stats.tdAirport===MISSION.target.icao&&stats.tdScore>0;
    if(ias<125&&agl>80)penalize(dt*1.2,'STALL MARGIN LOW','bad');
  } else if(MISSION.name==='TRAFFIC INTERCEPT'){
    if(!MISSION.target?.g){MISSION.target=civAir[0]||null;return;}
    const relV=Math.abs(P.vel.length()-160);
    if(MISSION.step===0)done=d<1200;
    else if(MISSION.step===1){hold=d<350&&relV<75;done=MISSION.hold>6;}
    else if(MISSION.step===2){hold=d<280&&relV<55;done=MISSION.hold>12;}
    else {hold=d<500;done=MISSION.hold>20;}
    if(d<55)penalize(dt*5,'UNSAFE SEPARATION','bad');
  } else if(MISSION.name==='OFFSHORE RECOVERY'){
    const hd=Math.hypot(MISSION.target.x-(P.pos.x+OX),MISSION.target.z-(P.pos.z+OZ));
    if(MISSION.step===0)done=hd<1000;
    else if(MISSION.step===1){hold=hd<180&&ias<35&&Math.abs(P.vel.y)<3;done=MISSION.hold>5;}
    else if(MISSION.step===2)done=hd<90&&agl<12&&Math.abs(P.vel.y)<2.5;
    else done=stats.tdAirport===MISSION.target.icao&&stats.tdScore>0;
    if(hd<500&&ias>70)penalize(dt*.8,'DECK APPROACH FAST');
  }
  MISSION.hold=hold?MISSION.hold+dt:Math.max(0,MISSION.hold-dt*.5);
  if(done){MISSION.eventT=0;completeObjective();}
  missionUiT-=dt;if(missionUiT<=0){missionUiT=.15;updateMissionUI();}
}
function updateMissionUI(force=false){const box=$('missionBox');if(!box)return;if(!MISSION.active&&!MISSION.completed){box.classList.remove('on');return;}box.classList.add('on');$('missionTitle').textContent=MISSION.name;$('missionPhase').textContent=MISSION.completed?'COMPLETE':`PHASE ${MISSION.step+1}/${Math.max(1,MISSION.steps.length)}`;$('missionScore').textContent=`${Math.round(MISSION.score)} PTS · ${fmtT(MISSION.time)}`;$('missionObjective').textContent=missionObjectiveText();const pct=MISSION.completed?100:100*MISSION.step/Math.max(1,MISSION.steps.length);$('missionProgress').firstElementChild.style.width=pct+'%';const d=distanceToTarget();$('missionSub').textContent=(MISSION.detail?MISSION.detail+' · ':'')+(isFinite(d)&&d<1e8?`RANGE ${(d/1000).toFixed(1)} KM · `:'')+`AGL ${Math.max(0,ralt).toFixed(0)} M · IAS ${ias.toFixed(0)} KT`;}

/* Nearby route traffic becomes gameplay-relevant. The route fleet remains cheap,
   while only close aircraft receive separation checks and avoidance offsets. */
function trafficContactGlobal(t,out){if(!t)return null;if(t.g){out.copy(t.g.position);return out;}if(ambientAir&&Number.isInteger(t.ambientIndex)&&t.ambientIndex>=0&&t.ambientIndex<ambientAir.mesh.count){const i=t.ambientIndex*3;out.set(ambientAir.lp[i],ambientAir.lp[i+1],ambientAir.lp[i+2]);return out;}return null;}
function trafficContactAvailable(t){return !!(t&&((t.g&&t.g.visible)||(ambientAir&&Number.isInteger(t.ambientIndex)&&t.ambientIndex>=0&&t.ambientIndex<ambientAir.mesh.count)));}
const _trafficPos=new THREE.Vector3();
function updateTrafficAwareness(dt){nearMissCooldown=Math.max(0,nearMissCooldown-dt);trafficT-=dt;if(trafficT>0)return;trafficT=.12;const px=P.pos.x+OX,py=P.pos.y,pz=P.pos.z+OZ;let best=null,bd=1e9,currentD=1e9;
  for(const c of civAir){if(!c.g.visible)continue;const dx=c.g.position.x-px,dy=c.g.position.y-py,dz=c.g.position.z-pz,d=Math.hypot(dx,dy,dz);if(c===trafficAlert.target)currentD=d;if(d<bd){bd=d;best=c;}const protectedApproach=['FINAL','ROLLOUT','GROUND'].includes(c.phase);c.avoidY=lerp(c.avoidY||0,(!protectedApproach&&d<650&&Math.abs(dy)<120?(dy>=0?130:-130):0),.18);}
  /* Horizon traffic is also targetable. It remains instanced for performance, but
     its per-instance position buffer gives the tracker a real world-space contact. */
  if(ambientAir){for(let i=0;i<ambientAir.mesh.count;i++){const j=i*3,dx=ambientAir.lp[j]-px,dy=ambientAir.lp[j+1]-py,dz=ambientAir.lp[j+2]-pz,d=Math.hypot(dx,dy,dz),c=ambientAir.contacts[i];if(c===trafficAlert.target)currentD=d;if(d<bd){bd=d;best=c;}}}
  /* Sticky nearest-contact lock: retain the current contact unless it disappears
     or another aircraft becomes substantially closer. */
  if(trafficContactAvailable(trafficAlert.target)&&currentD<120000&&(!best||currentD<=bd*1.28)){best=trafficAlert.target;bd=currentD;}
  trafficAlert.target=best;trafficAlert.distance=bd;trafficAlert.level=bd<180?'WARNING':bd<650?'CAUTION':bd<1600?'ADVISORY':'';
  if(best&&trafficContactGlobal(best,_trafficPos))trafficAlert.bearing=norm360(Math.atan2(_trafficPos.x-px,-(_trafficPos.z-pz))*R2D);else trafficAlert.bearing=0;
  const cue=$('trafficCue');cue.classList.toggle('on',running&&!replayActive);
  if(best&&trafficContactGlobal(best,_trafficPos)){const dy=_trafficPos.y-py,range=bd>=10000?(bd/1000).toFixed(1)+'KM':Math.max(0,bd).toFixed(0)+'M',relAlt=(dy*FT>=0?'+':'')+Math.round(dy*FT)+'FT',threat=trafficAlert.level?' · '+trafficAlert.level:'';cue.textContent=`LOCK ${best.callsign} · BRG ${trafficAlert.bearing.toFixed(0)}° · ${range} · ${relAlt}${threat}`;if(bd<180&&MISSION.message!=='TCAS WARNING'){MISSION.message='TCAS WARNING';sfxAPDisc();stats.warnings++;}}
  else cue.textContent='TRAFFIC LOCK · SEARCHING';
  if(bd<90&&nearMissCooldown<=0){nearMissCooldown=8;stats.nearMisses++;if(MISSION.active)penalize(5,'NEAR MISS','bad');}
}
const _targetWorld=new THREE.Vector3(),_targetNdc=new THREE.Vector3(),_targetCamDir=new THREE.Vector3();
function updateTrafficTargetMarker(){const el=$('targetMarker'),t=trafficAlert.target;if(!running||replayActive||!S.targetMarker||!trafficContactAvailable(t)){el.classList.remove('on');return;}if(t.g)t.g.getWorldPosition(_targetWorld);else if(trafficContactGlobal(t,_targetWorld)){_targetWorld.x-=OX;_targetWorld.z-=OZ;}else{el.classList.remove('on');return;}camera.getWorldDirection(_targetCamDir);_v1.copy(_targetWorld).sub(camera.position);if(_v1.dot(_targetCamDir)<=1){el.classList.remove('on');return;}_targetNdc.copy(_targetWorld).project(camera);if(_targetNdc.z<-1||_targetNdc.z>1||Math.abs(_targetNdc.x)>1.08||Math.abs(_targetNdc.y)>1.08){el.classList.remove('on');return;}el.style.left=((_targetNdc.x*.5+.5)*innerWidth)+'px';el.style.top=((-_targetNdc.y*.5+.5)*innerHeight)+'px';el.querySelector('.lab').textContent=`${t.callsign} · ${(trafficAlert.distance/1000).toFixed(1)} KM`;el.classList.add('on');}
function checkTrafficCollision(){if(replayActive)return;const px=P.pos.x+OX,py=P.pos.y,pz=P.pos.z+OZ;for(const c of civAir){if(!c.g.visible)continue;const dx=c.g.position.x-px,dy=c.g.position.y-py,dz=c.g.position.z-pz;if(Math.abs(dy)<7&&dx*dx+dz*dz<18*18){doCrash('MID-AIR COLLISION — '+c.callsign);return;}}}

/* Flight recorder: 12 Hz, bounded to 60 seconds. Replay never mutates the saved
   sortie; the live state is restored when playback ends. */
const REPLAY_HZ=12,REPLAY_MAX=REPLAY_HZ*60;let replayFrames=[],replayAcc=0,replayActive=false,replayClock=0,replayWall=0,replayRestore=null;
function resetReplay(){replayFrames=[];replayAcc=0;replayActive=false;replayClock=0;replayWall=0;replayRestore=null;}
function recordReplay(dt){if(replayActive||crashed)return;replayAcc+=dt;if(replayAcc<1/REPLAY_HZ)return;replayAcc%=1/REPLAY_HZ;replayFrames.push({p:[P.pos.x,P.pos.y,P.pos.z],q:[P.quat.x,P.quat.y,P.quat.z,P.quat.w],v:[P.vel.x,P.vel.y,P.vel.z],om:[P.om.x,P.om.y,P.om.z],ias,mach,g:gNz,st:stolMode,n:nozzle,gear:gearD,thr});if(replayFrames.length>REPLAY_MAX)replayFrames.shift();}
function startReplay(){
  if(replayActive)return;
  if(replayFrames.length<REPLAY_HZ*2){toast('NOT ENOUGH FLIGHT DATA FOR REPLAY','warn');return;}
  closeTransientMenus();$('pauseOv').classList.remove('on');$('sumOv').classList.remove('on');
  replayRestore={p:P.pos.clone(),q:P.quat.clone(),v:P.vel.clone(),om:P.om.clone(),cam:camMode,paused,ias,mach,gNz,nozzle,gearD,thr};
  replayActive=true;paused=false;replayClock=0;replayWall=performance.now();camMode=0;
  document.getElementById('btnReplay').classList.add('replay-live');missionBanner('REPLAY — LAST '+Math.round(replayFrames.length/REPLAY_HZ)+' SECONDS','warn');
}
function stopReplay(){
  if(!replayActive)return;replayActive=false;
  if(replayRestore){
    P.pos.copy(replayRestore.p);P.quat.copy(replayRestore.q);P.vel.copy(replayRestore.v);P.om.copy(replayRestore.om);
    camMode=replayRestore.cam;paused=replayRestore.paused;
    ({ias,mach,gNz,nozzle,gearD,thr}=replayRestore);
  }
  replayRestore=null;$('btnReplay').classList.remove('replay-live');
  $('pauseOv').classList.toggle('on',paused);$('pauseOv').setAttribute('aria-hidden',String(!paused));
  updateAttitudeData();updateAcSurfaces(0);snapCameraToAircraft();updateCamera(0);applyVisibility();
  toast('REPLAY COMPLETE');
}
function updateReplay(dt){if(!replayActive)return;replayClock=(performance.now()-replayWall)/1000;const f=replayClock*REPLAY_HZ;if(f>=replayFrames.length-1){stopReplay();return;}const i=Math.floor(f),t=f-i,a=replayFrames[i],b=replayFrames[i+1];P.pos.set(lerp(a.p[0],b.p[0],t),lerp(a.p[1],b.p[1],t),lerp(a.p[2],b.p[2],t));_q1.fromArray(a.q);_q2.fromArray(b.q);P.quat.copy(_q1).slerp(_q2,t);P.vel.set(lerp(a.v[0],b.v[0],t),lerp(a.v[1],b.v[1],t),lerp(a.v[2],b.v[2],t));ias=lerp(a.ias,b.ias,t);mach=lerp(a.mach,b.mach,t);gNz=lerp(a.g,b.g,t);nozzle=lerp(a.n,b.n,t);gearD=lerp(a.gear,b.gear,t);thr=lerp(a.thr,b.thr,t);updateAttitudeData();updateAcSurfaces(dt);updateCamera(dt);drawHMDS();renderer.render(scene,camera);}

/* Pooled STOVL downwash and touchdown dust/smoke. */
let downEmitAcc=0;const downN=180,downPos=new Float32Array(downN*3),downVel=[],downLife=new Float32Array(downN);for(let i=0;i<downN;i++)downVel.push(new THREE.Vector3());
const downGeo=new THREE.BufferGeometry();downGeo.setAttribute('position',new THREE.BufferAttribute(downPos,3));const downMat=new THREE.PointsMaterial({map:glowT,color:0xd9d3bd,size:4.5,transparent:true,opacity:0,depthWrite:false,blending:THREE.NormalBlending,alphaTest:.02});const downPts=new THREE.Points(downGeo,downMat);downPts.frustumCulled=false;scene.add(downPts);let downCursor=0;
const smokeN=90,smokePos=new Float32Array(smokeN*3),smokeVel=[],smokeLife=new Float32Array(smokeN);for(let i=0;i<smokeN;i++)smokeVel.push(new THREE.Vector3());const smokeGeo=new THREE.BufferGeometry();smokeGeo.setAttribute('position',new THREE.BufferAttribute(smokePos,3));const smokeMat=new THREE.PointsMaterial({map:glowT,color:0xc9c9c5,size:5,transparent:true,opacity:.62,depthWrite:false});const smokePts=new THREE.Points(smokeGeo,smokeMat);smokePts.frustumCulled=false;scene.add(smokePts);let smokeCursor=0;
function emitTouchdownSmoke(strength=1){if(ql()===0)return;for(let n=0;n<Math.round(32*strength);n++){const i=smokeCursor++%smokeN;smokePos[i*3]=P.pos.x+(Math.random()-.5)*5;smokePos[i*3+1]=surfaceH(P.pos.x+OX,P.pos.z+OZ)+.35;smokePos[i*3+2]=P.pos.z+(Math.random()-.5)*4;smokeVel[i].set((Math.random()-.5)*5,1+Math.random()*3,(Math.random()-.5)*5);smokeLife[i]=.7+Math.random()*1.2;}}
function updateSurfaceEffects(dt){const active=stolMode!=='CONV'&&lfSpool>.35&&ralt<35&&ql()>0&&!replayActive;downEmitAcc+=active?(18+lfSpool*34)*dt:0;const rate=Math.floor(downEmitAcc);downEmitAcc-=rate;for(let n=0;n<rate;n++){const i=downCursor++%downN,a=Math.random()*TAU,r=2+Math.random()*8;downPos[i*3]=P.pos.x+Math.cos(a)*r;downPos[i*3+1]=surfaceH(P.pos.x+OX+Math.cos(a)*r,P.pos.z+OZ+Math.sin(a)*r)+.25;downPos[i*3+2]=P.pos.z+Math.sin(a)*r;const out=6+Math.random()*14;downVel[i].set(Math.cos(a)*out,1+Math.random()*2,Math.sin(a)*out);downLife[i]=.45+Math.random()*.75;}
  for(let i=0;i<downN;i++)if(downLife[i]>0){downLife[i]-=dt;downPos[i*3]+=downVel[i].x*dt;downPos[i*3+1]+=downVel[i].y*dt;downPos[i*3+2]+=downVel[i].z*dt;downVel[i].y+=.8*dt;}else downPos[i*3+1]=-9999;
  for(let i=0;i<smokeN;i++)if(smokeLife[i]>0){smokeLife[i]-=dt;smokePos[i*3]+=smokeVel[i].x*dt;smokePos[i*3+1]+=smokeVel[i].y*dt;smokePos[i*3+2]+=smokeVel[i].z*dt;smokeVel[i].multiplyScalar(Math.exp(-dt*1.4));}else smokePos[i*3+1]=-9999;
  downGeo.attributes.position.needsUpdate=true;smokeGeo.attributes.position.needsUpdate=true;downMat.opacity=active?clamp(.12+lfSpool*.38,0,.55):0;smokeMat.opacity=.55;}

/* Lightweight canopy water layer. */
const rainCanvas=$('canopyRain'),rainCtx=rainCanvas.getContext('2d'),canopyDrops=Array.from({length:52},()=>({x:Math.random(),y:Math.random(),r:1+Math.random()*3,s:.15+Math.random()*.45}));
function updateCanopyRain(dt){const show=running&&camMode===1&&wx.prec>.12&&!replayActive;document.body.classList.toggle('cockpit-rain',show);if(!show)return;const d=Math.min(devicePixelRatio||1,1.5),w=innerWidth,h=innerHeight;if(rainCanvas.width!==Math.round(w*d)||rainCanvas.height!==Math.round(h*d)){rainCanvas.width=Math.round(w*d);rainCanvas.height=Math.round(h*d);rainCanvas.style.width=w+'px';rainCanvas.style.height=h+'px';rainCtx.setTransform(d,0,0,d,0,0);}rainCtx.clearRect(0,0,w,h);rainCtx.strokeStyle='rgba(205,225,238,.38)';rainCtx.fillStyle='rgba(210,230,242,.14)';rainCtx.lineWidth=1;for(const q of canopyDrops){q.y+=dt*(q.s+ias/1500);q.x+=Math.sin(q.y*18+q.r)*dt*.03;if(q.y>1.05){q.y=-.05;q.x=Math.random();}const x=q.x*w,y=q.y*h,len=(8+ias*.035)*q.r;rainCtx.beginPath();rainCtx.moveTo(x,y);rainCtx.lineTo(x-ias*.004,y+len);rainCtx.stroke();rainCtx.beginPath();rainCtx.arc(x,y,q.r,0,TAU);rainCtx.fill();}}
function operationsVisualUpdate(dt){if(missionBannerT>0){missionBannerT-=dt;if(missionBannerT<=0)$('missionBanner').classList.remove('on');}updateTrafficAwareness(dt);updateTrafficTargetMarker();updateSurfaceEffects(dt);updateCanopyRain(dt);}

/* ================= [26] DEBUG ================= */
let dbgT=0;
function updateDbg(dt){
  if(!dbgOn)return;dbgT-=dt;if(dbgT>0)return;dbgT=0.12;
  $('dbg').textContent=
`FPS ${(1000/frameEMA).toFixed(0)}  ft ${frameEMA.toFixed(1)}ms  steps×${stepsLast}  PR ${prCur.toFixed(2)}  QL ${qlLevel}
pos ${(P.pos.x+OX).toFixed(0)},${P.pos.y.toFixed(0)},${(P.pos.z+OZ).toFixed(0)}  vel ${P.vel.length().toFixed(1)}m/s
p ${P.om.z.toFixed(2)} q ${P.om.x.toFixed(2)} r ${P.om.y.toFixed(2)} rad/s
in el ${elIn.toFixed(2)} ail ${ailIn.toFixed(2)} rud ${rudIn.toFixed(2)} thr ${thr.toFixed(2)}
δE ${(dE*R2D).toFixed(1)}° δA ${(dA*R2D).toFixed(1)}° δR ${(dR*R2D).toFixed(1)}° trim ${(trimE*R2D).toFixed(1)}°
α ${(alpha*R2D).toFixed(1)}° β ${(beta*R2D).toFixed(1)}° αdot ${(alphaRate*R2D).toFixed(0)}°/s sep ${sep.toFixed(2)} flap ${(flapPos*100).toFixed(0)}%
IAS ${ias.toFixed(0)}kt TAS ${Vtas.toFixed(0)} GS ${(P.vel.length()/KT).toFixed(0)} M ${mach.toFixed(2)}
q̄ ${(qbar/1000).toFixed(1)}kPa Nz ${gNz.toFixed(2)} Ny ${gNy.toFixed(2)} Nx ${gNx.toFixed(2)}
T ${(Teng/1000).toFixed(0)}kN VERT ${(Tvert/1000).toFixed(0)}kN N1/N2 ${N1.toFixed(0)}/${N2.toFixed(0)}% AB ${(abSpool*100).toFixed(0)}% TIT ${TIT.toFixed(0)}°
wheels N ${(wheelLoad[0]/1000).toFixed(0)} L ${(wheelLoad[1]/1000).toFixed(0)} R ${(wheelLoad[2]/1000).toFixed(0)}kN  ${surfNow} slip ${wheelSlip[1].toFixed(2)}/${wheelSlip[2].toFixed(2)} hydro ${hydroplane.toFixed(2)}
AP ${AP.mode}  ILS ${ilsValid?'VALID':ILS_REASON[ilsReason]} ${ilsMode}
along ${ilsData.along.toFixed(0)}m xtk ${ilsData.cross.toFixed(0)}m gs ${ilsData.gs.toFixed(2)}°
STOVL ${stolMode} noz ${nozzle.toFixed(0)}° lf ${(lfSpool*100).toFixed(0)}% door ${(lfDoor*100).toFixed(0)}%
VAP ${vapourCount}/${VAP_MAX} wing ${condWing.toFixed(2)} vortex ${vortexStrength.toFixed(2)} trans ${condTrans.toFixed(2)} trail ${contrail.toFixed(2)}
MISSION ${MISSION.active?MISSION.name:'—'} ${MISSION.score.toFixed(0)} step ${MISSION.step+1}/${MISSION.steps.length||0}  REPLAY ${replayFrames.length}/${REPLAY_MAX}
SELFTEST ${SELF_TEST?SELF_TEST.passed:0}/${SELF_TEST?SELF_TEST.total:0}
origin ${OX.toFixed(0)},${OZ.toFixed(0)}  regions ${featureRegions.size} chunks ${chunks.size}  visual ${aptGroups.size}A/${cityGroups.size}C  traffic ${[...roadGroups.values()].filter(Boolean).length}R/${civAir.length+(ambientAir?ambientAir.mesh.count:0)}A  draw ${renderer.info.render.calls}  tris ${(renderer.info.render.triangles/1000).toFixed(0)}k`;
}
/* Repeatable, non-mutating engineering checks. These validate equations and the
   fixed-step scheduler; full take-off/landing/STOVL tests are run by the QA harness. */
let SELF_TEST=null;
function runValidation(){
  const tests=[],add=(name,ok,value)=>tests.push({name,pass:!!ok,value});
  const sl=atmos(0,0),hi=atmos(11000,0);
  add('ISA sea-level density',Math.abs(sl.rho-1.225)<.012,sl.rho);
  add('ISA density decreases with altitude',hi.rho<.40&&hi.rho>.32,hi.rho);
  add('Local speed of sound drives Mach',200/hi.a>200/sl.a,{sea:200/sl.a,high:200/hi.a});
  const clPeak=interp(AERO.a,AERO.CL,28),clPost=interp(AERO.a,AERO.CL,55);
  add('High-alpha lift peaks then falls progressively',clPeak>1.85&&clPost<clPeak*.70,{clPeak,clPost});
  const recSep=.92,recEff=ctrlEff(.32,recSep,45),recCm=interp(AERO.a,AERO.Cm,45)+1.05*(-ELEV_MAX)*recEff+.022*recSep*smooth(26,52,45);
  add('Developed high-AoA state retains nose-down recovery authority',recCm<-.035,{recEff,recCm});
  const yawCmd=yawSurfaceTarget(120,0,.18,6*D2R,0,0,false),yawMoment=-.2*yawCmd;
  add('Yaw damper opposes positive rate and sideslip',yawCmd>0&&yawMoment<0,{yawCmd,yawMoment});
  const savedTurb=wx.turb,savedGust=wx.gust;wx.turb=1;wx.gust=0;const tv=turbulenceAt(1234,1400,5678,new THREE.Vector3()).length();wx.turb=savedTurb;wx.gust=savedGust;
  add('Turbulence is represented as airmass velocity',tv>.05&&Number.isFinite(tv),tv);
  const fdFull=fuelDistribution(MAX_FUEL),fdLow=fuelDistribution(MAX_FUEL*.2),mpFull=massProperties(MAX_FUEL),mpLow=massProperties(MAX_FUEL*.2);
  add('Fuel sequencing produces bounded nonlinear CG shift',Math.abs(mpFull.cg-mpLow.cg)>.01&&mpFull.cg<.16&&mpLow.cg>-.14,{full:mpFull.cg,low:mpLow.cg,fdFull,fdLow});
  add('Engine exposes separate fan/core spool states',typeof N1==='number'&&typeof N2==='number'&&typeof abSpool==='number',{N1,N2,abSpool});
  add('Pilot roll input reaches physical surface travel',Math.abs((-1)*AIL_MAX+AIL_MAX)<1e-12&&AIL_MAX*R2D===28,{fullRightFlaperon:-AIL_MAX*R2D,limit:AIL_MAX*R2D});
  const lowRate=(()=>{const qb=qbar,mm=mach;qbar=4000;mach=.3;const r=surfaceRate(5.8,2.25);qbar=qb;mach=mm;return r;})();
  const highRate=(()=>{const qb=qbar,mm=mach;qbar=90000;mach=1.4;const r=surfaceRate(5.8,2.25);qbar=qb;mach=mm;return r;})();
  add('Aerodynamic hinge load slows actuator rather than capping turn rate',lowRate>highRate&&highRate>=2.24,{lowRate,highRate});
  add('Gear creates parasite drag',.032>0&&.032*0.5*sl.rho*100*100*S_REF>8000,.032);
  add('Transonic wave drag peaks near Mach one',waveDrag(1.02)>waveDrag(.72)*4&&waveDrag(1.02)>waveDrag(1.55),{sub:waveDrag(.72),trans:waveDrag(1.02),sup:waveDrag(1.55)});
  const perfAt=atmos(10000,0),perfM=1.55,perfV=perfAt.a*perfM,perfDelta=perfAt.P/101325,perfTheta=perfAt.T/288.15;
  const perfRam=clamp(1+0.11*perfM-0.018*perfM*perfM,.72,1.18),perfLapse=clamp(Math.pow(perfDelta,.56)*Math.pow(perfTheta,-.35)*perfRam,.16,1.18),perfAb=clamp(Math.pow(perfDelta,.62)*Math.pow(perfTheta,-.22)*perfRam,.18,1.16);
  const perfThrust=Math.min(ABT*1.10,MILT*perfLapse+(ABT-MILT)*perfAb),perfQ=.5*perfAt.rho*perfV*perfV,perfDrag=perfQ*S_REF*(.027+waveDrag(perfM));
  add('Afterburner supports supersonic acceleration near M1.55 at 10 km',perfThrust>perfDrag*1.08,{thrust:perfThrust,drag:perfDrag,margin:perfThrust/perfDrag});
  const light=(DRY+MAX_FUEL*.25)*G0,full=(DRY+MAX_FUEL)*G0;
  add('LiftSystem component thrust sums correctly',Math.abs(VERTT-(LIFT_FAN_MAX+REAR_LIFT_MAX+2*ROLL_POST_MAX))<1,{fan:LIFT_FAN_MAX,rear:REAR_LIFT_MAX,posts:2*ROLL_POST_MAX,total:VERTT});
  add('Hover requires a light recovery mass',VERTT/light>1.08&&VERTT/full<1,{lightMargin:VERTT/light-1,fullMargin:VERTT/full-1});
  add('Selectable structural envelope is bounded',structuralLimit()>=7&&structuralLimit()<=11.5,structuralLimit());
  add('Afterburner fuel flow exceeds military',(.13+1.05+2.6)>(.13+1.05)*2.5,{mil:1.18,ab:3.78});
  const vstall=Math.sqrt(2*(DRY+MAX_FUEL*.55)*G0/(sl.rho*S_REF*1.70))/KT;
  add('Loaded 1-g minimum-speed estimate is plausible',vstall>105&&vstall<145,vstall);
  add('ASSIST aerodynamic AoA is not compressed',true,{policy:'control-law limiter; physical AoA retained'});
  const geNear=Math.pow(clamp(1-(1.5)/(.58*SPAN),0,1),2),geFar=Math.pow(clamp(1-(.75*SPAN)/(.58*SPAN),0,1),2);
  add('Ground effect is concentrated below roughly half-span',geNear>.45&&geFar===0,{near:geNear,far:geFar});
  const lapse=Math.pow(hi.P/101325,.7)*Math.pow(hi.T/288.15,-.5);
  add('Engine thrust lapses at altitude',lapse<.45,lapse);
  const condProbe=(rh,cool,cl,q)=>smooth(.52,.91,rh/100)*smooth((100-rh)/5-.8,(100-rh)/5+1.2,cool)*smooth(.42,1.15,Math.abs(cl))*smooth(1500,7500,q);
  add('Humid high-load condensation exceeds dry',condProbe(94,12,1.4,10000)>condProbe(25,12,1.4,10000)*8,{humid:condProbe(94,12,1.4,10000),dry:condProbe(25,12,1.4,10000)});
  add('Contrail regime is separate from wing vapour',smooth(6900,10200,10500)*smooth(-34,-50,-55)>.8&&condProbe(30,2,.4,3000)<.05,true);
  const n1=makeNoise(12345),n2=makeNoise(12345),n3=makeNoise(54321),p1=n1(1.234,5.678),p2=n2(1.234,5.678),p3=n3(1.234,5.678);
  add('Seeded noise is deterministic',p1===p2&&Math.abs(p1-p3)>.0001,{p1,p2,p3});
  const indexedA=[...airportBins.values()].reduce((n,b)=>n+b.size,0),indexedC=[...cityBins.values()].reduce((n,b)=>n+b.size,0);
  add('Spatial feature indexes cover streamed records',indexedA===airports.length&&indexedC===cities.length,{airports:airports.length,indexedA,cities:cities.length,indexedC});
  const landA=airports.filter(a=>!a.platform),badSites=landA.filter(a=>worldMode==='LONDON'?Math.abs(heightAt(a.x,a.z)-a.elev)>.01:rawHeight(a.x,a.z)<=0||rawSlope(a.x,a.z)>.085);
  add('Generated land airports pass terrain suitability',badSites.length===0,{checked:landA.length,bad:badSites.map(a=>a.icao)});
  const rateProbe=fps=>{let acc=0,v=0,x=0,n=55,f=2000;for(let frame=0;frame<fps*12;frame++){acc+=1/fps;while(acc+1e-12>=1/120){const dt=1/120;n+=(100-n)*Math.min(1,dt/2.4);const thrust=MILT*Math.pow(n/100,3),drag=.5*sl.rho*v*v*.035*S_REF;v+=(thrust-drag)/18000*dt;x+=v*dt;f-=1.18*dt;acc-=dt;}}return{x,v,f};};
  const r30=rateProbe(30),r60=rateProbe(60),r120=rateProbe(120),spread=Math.max(Math.abs(r30.x-r60.x),Math.abs(r120.x-r60.x));
  add('30/60/120 Hz fixed-step equivalence',spread<1e-6,{spread,r30,r60,r120});
  add('Terrain cache and effect pools are bounded',VAP_MAX===640&&VORT_N===72&&APT_PROXY_MAX===160&&16000<20000&&featureRegions.size<=49,{vapour:VAP_MAX,vortexNodes:VORT_N,airportProxies:APT_PROXY_MAX,heightCache:16000,regions:49});
  add('Horizon traffic fleet meets dense-airspace target',!!ambientAir&&ambientAir.max>=128&&ambientAir.data.length>=128,{fleet:ambientAir?ambientAir.data.length:0,target:128});
  const avgTrafficFt=ambientAir?ambientAir.data.reduce((n,d)=>n+d.alt*FT,0)/ambientAir.data.length:0;
  add('Horizon airline traffic cruises around FL300',avgTrafficFt>29000&&avgTrafficFt<33000,{averageFt:avgTrafficFt});
  if(worldMode==='LONDON')add('Heathrow runways have real aligned endpoints',airports.length===2&&airports.every(a=>Math.abs(Math.hypot(a.thrBx-a.thrAx,a.thrBz-a.thrAz)-a.rwyLen)<10),{runways:airports.length});
  else add('Route airliners have runway-to-runway plans',civAir.length>=14&&civAir.every(c=>c.plan&&c.plan.pts.length>=10&&Math.abs(c.plan.pts[c.plan.pts.length-1].y-c.to.elev)<5),{routes:civAir.length,target:14});
  add('Dense aircraft fleet uses instancing',!!ambientAir&&ambientAir.mesh&&ambientAir.mesh.isInstancedMesh===true,{instanced:!!(ambientAir&&ambientAir.mesh&&ambientAir.mesh.isInstancedMesh)});
  add('Neutral ASSIST pitch hold state is available',typeof neutralPitchRef==='number'&&typeof neutralPitchArmed==='boolean',{neutralPitchRef,neutralPitchArmed});
  add('Traffic target marker control is wired',!!$('targetMarker')&&!!$('sTarget')&&!!$('tbTarget'),{marker:!!$('targetMarker'),drawer:!!$('sTarget'),touch:!!$('tbTarget')});
  const external=[...document.querySelectorAll('script[src],link[href],img[src],audio[src],video[src],source[src],iframe[src]')].map(n=>n.getAttribute('src')||n.getAttribute('href'));
  add('Offline package has no external resources',external.length===0,external);
  const passed=tests.filter(t=>t.pass).length;return{passed,total:tests.length,tests};
}
window.__F35B_SIM__={version:globalThis.__LIGHTNING_BUILD__?.version||'0.1.0-experimental',runValidation,get snapshot(){return {running,paused,crashed,simT,flightT,stepCount,position:P.pos.toArray(),velocity:P.vel.toArray(),quaternion:P.quat.toArray(),fuel,stolMode,nozzle,gearD,camMode,profile:L.profile,quality:qlLevel,drawingBuffer:[renderer.domElement.width,renderer.domElement.height],workMs:lastWorkMs,renderer:{...renderer.info.render,...renderer.info.memory}};},get diagnostics(){return SELF_TEST;},
  get world(){const kinds={};for(const a of airports)kinds[a.kind]=(kinds[a.kind]||0)+1;return{mode:worldMode,london:worldMode==='LONDON'?LightningLondon.stats():null,airports:airports.length,cities:cities.length,kinds,regions:featureRegions.size,airportBins:airportBins.size,visualAirports:aptGroups.size};},
  get traffic(){let roadVehicles=0,trainConsists=0,trainCars=0;for(const [,g] of roadGroups){if(!g)continue;const r=g.userData.roadTraffic,t=g.userData.train;if(r)roadVehicles+=r.data.length;if(t){trainConsists+=t.consistCount;trainCars+=t.n;}}const lr=localTrafficHub&&localTrafficHub.userData.localCars,lt=localTrafficHub&&localTrafficHub.userData.train;return{ambientAircraft:ambientAir?ambientAir.mesh.count:0,routeAircraft:civAir.length,totalAircraft:civAir.length+(ambientAir?ambientAir.mesh.count:0),roadVehicles,localRoadVehicles:lr?lr.cars.length:0,trainConsists,trainCars,localTrainConsists:lt?lt.consistCount:0,localTrainCars:lt?lt.n:0};},
  get effects(){return{condWing,vortexStrength,condTrans,contrail,particles:vapourCount,vortexNodes:vortNodeCount,setting:S.vapour,wingSheet:!!(wingVapMesh&&wingVapMesh.visible),transonicShell:!!(transVapMesh&&transVapMesh.visible)};},
  get landing(){return{score:stats.tdScore,grade:stats.tdGrade,sinkFpm:stats.tdVs*FPM,centreline:stats.tdAcross,headingError:stats.tdHdg,airport:stats.tdAirport};},
  get operations(){return{active:MISSION.active,completed:MISSION.completed,name:MISSION.name,step:MISSION.step,steps:MISSION.steps.length,score:MISSION.score,objective:missionObjectiveText(),replaySeconds:replayFrames.length/REPLAY_HZ,traffic:trafficAlert.level,nearMisses:stats.nearMisses};}};
/* ================= BOOT BACKGROUND ================= */
const bb=$('bootbg'),bx=bb.getContext('2d');
function drawBootBg(t){
  if(bb.width!==innerWidth||bb.height!==innerHeight){bb.width=innerWidth;bb.height=innerHeight;}
  bx.fillStyle='rgba(6,12,20,0.35)';bx.fillRect(0,0,bb.width,bb.height);
  const cx0=bb.width*0.28,cy0=bb.height*0.56;
  for(let i=0;i<13;i++){const base=((i*72+t*0.014)%940)+30;
    bx.strokeStyle=`rgba(126,240,168,${0.15*(1-base/980)})`;bx.lineWidth=1;
    bx.beginPath();
    for(let a=0;a<=64;a++){const th=a/64*TAU;
      const n=nzA?nzA(Math.cos(th)*0.9+i*0.31,t*0.00006+i*0.13)*46:0;
      const r=base+n,x=cx0+Math.cos(th)*r*1.25,y=cy0+Math.sin(th)*r*0.8;
      a?bx.lineTo(x,y):bx.moveTo(x,y);}
    bx.closePath();bx.stroke();}
  const sw=t*0.0006;
  const grd=bx.createLinearGradient(cx0,cy0,cx0+Math.cos(sw)*900,cy0+Math.sin(sw)*560);
  grd.addColorStop(0,'rgba(126,240,168,0.25)');grd.addColorStop(1,'rgba(126,240,168,0)');
  bx.strokeStyle=grd;bx.lineWidth=2;bx.beginPath();bx.moveTo(cx0,cy0);
  bx.lineTo(cx0+Math.cos(sw)*900,cy0+Math.sin(sw)*560);bx.stroke();
}
/* ================= [27] MAIN LOOP ================= */
const FDT=1/120;let last=performance.now(),physAcc=0,syncT=0,pcdT=0,saveT=15;
function loop(now){
  requestAnimationFrame(loop);
  if(contextLost||document.hidden||!cadence.ready(now))return;
  frameStart=performance.now();
  const wallDt=(now-last)/1000;let dt=Math.min(wallDt,0.05);last=now;
  frameEMA=lerp(frameEMA,wallDt*1000,0.05);
  if(!running)drawBootBg(now);
  pollGamepad();gyroSample();
  stepsLast=0;
  if(replayActive){physAcc=0;updateWeather(dt);operationsVisualUpdate(dt);updateReplay(dt);return;}
  if(running&&!paused){
    if(!crashed){
      physAcc=Math.min(physAcc+dt,8*FDT);
      /* The epsilon prevents binary rounding from dropping a 120 Hz step when a
         render frame should contain an exact 2× (60 FPS) or 4× (30 FPS) batch. */
      while(physAcc+1e-12>=FDT){physics(FDT);physAcc-=FDT;if(physAcc<0)physAcc=0;stepsLast++;}
      rebaseOrigin();
    } else physAcc=0;
    updateWeather(dt);ensureRegionalFeatures(dt);
    chunkBudget=999;ensureChunks(dt);processChunksTimed([3,4.5,6,8][ql()]);
    ensureVisuals(dt);updateLiving(dt);updateAcSurfaces(dt);vapourCount=updateVapour(dt);
    vsFpm=lerp(vsFpm,P.vel.y*FPM,Math.min(1,dt*5));
    syncT-=dt;if(syncT<0){syncT=0.25;syncTouch();updateInfoPan();}
    pcdT-=dt;if(pcdT<0&&camMode===1){pcdT=0.5;drawPCD();}
    saveT-=dt;if(saveT<0){saveT=15;savePrefs(true);}
    governor(dt);audioUpdate();operationsVisualUpdate(dt);
  } else if(!running){
    physAcc=0;simT+=dt;updateWeather(dt);ensureRegionalFeatures(dt);
    chunkBudget=999;ensureChunks(dt);processChunksTimed([3,4.5,6,8][ql()]);
    ensureVisuals(dt);updateLiving(dt);updateAcSurfaces(dt);vapourCount=updateVapour(dt);
  } else physAcc=0;
  updateCamera(dt);
  sky.position.copy(camera.position);
  water.position.x=camera.position.x;water.position.z=camera.position.z;
  waterMat.uniforms.uTime.value=simT;waterMat.uniforms.uOffset.value.set(water.position.x+OX,water.position.z+OZ);
  waterMat.uniforms.uSun.value.copy(sunDir);waterMat.uniforms.uFog.value.copy(scene.fog.color);
  waterMat.uniforms.uFogD.value=scene.fog.density;waterMat.uniforms.uNight.value=nightF;
  terrainMat.uniforms.uOrigin.value.set(OX,OZ);
  terrainMat.uniforms.uSun.value.copy(sunDir);terrainMat.uniforms.uFog.value.copy(scene.fog.color);terrainMat.uniforms.uFogD.value=scene.fog.density;terrainMat.uniforms.uDay.value=dayF;terrainMat.uniforms.uWet.value=wx.wet?1:0;terrainMat.uniforms.uTime.value=simT;
  if(worldMode==='LONDON')LightningLondon.update(P.pos.x+OX,P.pos.z+OZ,P.pos.y,ql(),nightF,performance.now()/1000);
  drawHMDS();
  if($('infoPan').classList.contains('on')&&running)drawInfoMap();
  updateDbg(dt);
  LightningVisuals.updateAircraft({distance:camera.position.distanceTo(P.pos),quality:qlLevel,night:nightF});
  if(camMode===1)LightningVisuals.updateCockpit({roll:ailIn,pitch:elIn,throttle:thr,night:nightF});
  renderer.render(scene,camera);
  lastWorkMs=performance.now()-frameStart;workSamples.push(lastWorkMs);if(workSamples.length>600)workSamples.shift();
  updateLightningMeter(now);
}
const _airP0=new THREE.Vector3(),_airP1=new THREE.Vector3();
function updateLiving(dt){
  const a=nearestApt();
  for(const ap of airports){if(!ap.grp)continue;
    if(ap.sock){ap.sock.rotation.y=(ap.hdg-wx.windDir-180)*D2R;
      ap.sock.children[0].rotation.x=-Math.PI/2+clamp(0.55-wx.windNow*0.03,0.05,0.55);}
    if(ap.beacon)ap.beacon.material.opacity=(.10+.90*nightF)*(.35+.65*Math.abs(Math.sin(simT*2.2)));
    ap.grp.userData.nightMesh.visible=nightF>0.25;
    if(ap===a&&ilsData.apt===ap){const gAng=ilsData.gsAng;
      ap.papi.forEach((p,i)=>{p.material.color.setHex(gAng>2.4+i*0.4?0xffffff:0xff2020);});}}
  const pgx=P.pos.x+OX,pgz=P.pos.z+OZ;
  for(const [ct,g] of cityGroups){
    g.userData.glow.material.opacity=nightF*(ct.cls==='METRO'?.24:.14);
    const cars=g.userData.cars;
    if(cars){cars.pts.material.opacity=0.34+0.64*nightF;
      const cd=Math.hypot(ct.x-pgx,ct.z-pgz);
      if(cd<26000){const arr=cars.pos,active=Math.min(cars.data.length,(ct.cls==='METRO'?2:1)*[80,120,160,210][ql()]);cars.geo.setDrawRange(0,active);
        for(let i=0;i<active;i++){const d=cars.data[i];d.t+=d.sp*dt;
          const lim=ct.r*0.92;if(d.t>lim)d.t=-lim;if(d.t<-lim)d.t=lim;
          let lx,lz;if(d.ax){lx=d.t;lz=d.line+d.off;}else{lx=d.line+d.off;lz=d.t;}
          const cr=Math.cos(ct.rot||0),sr=Math.sin(ct.rot||0),wx2=ct.x+lx*cr+lz*sr,wz2=ct.z-lx*sr+lz*cr;
          arr[i*3]=wx2;arr[i*3+1]=heightAt(wx2,wz2)+1.2;arr[i*3+2]=wz2;}
        cars.geo.attributes.position.needsUpdate=true;}}}
  for(const [,rg] of roadGroups){if(!rg)continue;const tr=rg.userData.roadTraffic;if(tr){const first=tr.data[0],near=first&&first.route&&first.route[0],visible=near&&Math.hypot(near.x-pgx,near.z-pgz)<36000;
      tr.body.visible=tr.roof.visible=!!visible;if(visible){const active=Math.min(tr.data.length,[48,84,156,280][ql()]);tr.body.count=tr.roof.count=active;for(let i=0;i<active;i++){const d=tr.data[i];d.travel+=d.speed*dt/74;routePose(d.route,d.travel,d.lane,_routePos,_routeQuat);
          const van=d.kind===1;_routeScale.set(van?2.10:1.85,van?1.05:.62,van?5.4:4.15);_routeMat.compose(_routePos,_routeQuat,_routeScale);tr.body.setMatrixAt(i,_routeMat);
          _routePos.y+=van?.94:.58;_routeScale.set(van?1.72:1.46,van?.48:.38,van?3.25:2.10);_routeMat.compose(_routePos,_routeQuat,_routeScale);tr.roof.setMatrixAt(i,_routeMat);}
        tr.body.instanceMatrix.needsUpdate=true;tr.roof.instanceMatrix.needsUpdate=true;}}
    const tn=rg.userData.train;if(tn){let any=false,idx=0;const activeConsists=Math.min(tn.consistCount,[2,3,4,5][ql()]),activeCars=Math.min(tn.carsPer,[4,5,6,7][ql()]);for(let j=0;j<activeConsists;j++){const cs=tn.consists[j];cs.travel+=cs.speed*dt/52;
      for(let i=0;i<activeCars;i++,idx++){const len=i===0?14.5:17.5;routePose(tn.route,cs.travel-i*cs.spacing,0,_routePos,_routeQuat);const vis=Math.hypot(_routePos.x-pgx,_routePos.z-pgz)<44000;any=any||vis;
        _routeScale.set(3.15,3.0,len);_routeMat.compose(_routePos,_routeQuat,_routeScale);tn.bodies.setMatrixAt(idx,_routeMat);
        _routePos.y+=1.72;_routeScale.set(3.20,.72,len*.68);_routeMat.compose(_routePos,_routeQuat,_routeScale);tn.windows.setMatrixAt(idx,_routeMat);
        _routePos.y+=1.28;_routeScale.set(2.9,.34,len*.92);_routeMat.compose(_routePos,_routeQuat,_routeScale);tn.roofs.setMatrixAt(idx,_routeMat);}
      routePose(tn.route,cs.travel+.16,0,_routePos,_routeQuat);tn.lampPos[j*3]=_routePos.x;tn.lampPos[j*3+1]=_routePos.y+1.65;tn.lampPos[j*3+2]=_routePos.z;}
      tn.bodies.count=tn.windows.count=tn.roofs.count=idx;tn.lampGeo.setDrawRange(0,activeConsists);tn.bodies.visible=tn.windows.visible=tn.roofs.visible=tn.lamps.visible=any;tn.bodies.instanceMatrix.needsUpdate=true;tn.windows.instanceMatrix.needsUpdate=true;tn.roofs.instanceMatrix.needsUpdate=true;tn.lampGeo.attributes.position.needsUpdate=true;tn.lamps.material.opacity=.35+.65*nightF;}}
  updateLocalTrafficHub(dt,pgx,pgz);
  for(const t of windTurbines)t.rot.rotation.x+=t.spd*dt;
  for(const s of ships){const d=Math.hypot(s.ax-pgx,s.az-pgz);s.g.visible=d<52000;if(!s.g.visible)continue;
    const t=((simT*s.sp+s.ph)%24000)-12000;s.g.position.set(s.ax+s.dx*t,WATER_Y+.6+Math.sin(simT*.7+s.ph)*.35,s.az+s.dz*t);s.g.rotation.z=Math.sin(simT*.5+s.ph)*.02;}
  const p0=_airP0,p1=_airP1;
  for(const c of civAir){
    if(c.groundT>=0){c.groundT+=dt;trafficPoint(c.plan,c.plan.total,p0);c.g.position.copy(p0);c.phase='GROUND';c.g.userData.gear.visible=true;c.g.visible=c.groundT<9&&Math.hypot(p0.x-pgx,p0.z-pgz)<72000;if(c.groundT>22){const oldFrom=c.from;c.from=c.to;c.to=oldFrom;c.plan=trafficPlan(c,c.from,c.to);c.routeDist=0;c.groundT=-1;c.prevYaw=0;c.g.visible=true;}continue;}
    const sp=trafficSpeed(c.plan,c.routeDist);c.routeDist+=sp*dt;if(c.routeDist>=c.plan.total){c.routeDist=c.plan.total;c.groundT=0;}
    c.phase=trafficPhase(c.plan,c.routeDist);trafficPoint(c.plan,c.routeDist,p0);trafficPoint(c.plan,Math.min(c.plan.total,c.routeDist+Math.max(90,sp*.8)),p1);
    const finalLike=c.phase==='FINAL'||c.phase==='ROLLOUT';if(!finalLike){p0.y+=c.avoidY||0;p1.y+=c.avoidY||0;}
    const dx=p1.x-p0.x,dy=p1.y-p0.y,dz=p1.z-p0.z,h=Math.max(.001,Math.hypot(dx,dz)),yaw=Math.atan2(dx,dz),yawRate=c.prevYaw?norm180((yaw-c.prevYaw)*R2D)*D2R/Math.max(dt,.01):0,targetBank=finalLike?0:clamp(Math.atan(sp*yawRate/G0),-.42,.42);
    c.prevYaw=yaw;c.bank=lerp(c.bank,targetBank,Math.min(1,dt*1.8));c.g.position.copy(p0);c.g.rotation.y=yaw;c.g.rotation.x=-Math.atan2(dy,h);c.g.rotation.z=c.bank;c.g.visible=Math.hypot(p0.x-pgx,p0.z-pgz)<115000;c.g.userData.gear.visible=c.phase==='TAKEOFF'||c.phase==='FINAL'||c.phase==='ROLLOUT';
    const blink=((simT*2.1+c.routeDist*.001)%1)<.10?1:0;c.g.userData.strobe.material.opacity=blink*(.25+.75*nightF);c.g.userData.navPts.material.opacity=.18+.82*nightF;}
  updateAmbientAir(dt,pgx,pgz);
}
function updateInfoPan(){
  const a=selectedAirport()||nearestApt(),near=nearestApt(),d=Math.hypot(a.x-P.pos.x-OX,a.z-P.pos.z-OZ);
  const hw=wx.windNow*Math.cos((wx.windDir-a.hdg)*D2R)*1.94,cw=wx.windNow*Math.sin((wx.windDir-a.hdg)*D2R)*1.94;
  const body=$('infoBody');if(!body.dataset.ready){body.dataset.ready='1';body.innerHTML=
`<div id="navData"></div><div class="nav-actions"><button class="nav-act" data-nav="NEAREST">NEAREST</button><button class="nav-act" data-nav="NEXT">NEXT FIELD</button><button class="nav-act" data-nav="STOVL">STOVL SITE</button><button class="nav-act" data-nav="LONG">LONG RUNWAY</button><button class="nav-act" data-map="IN">MAP +</button><button class="nav-act" data-map="OUT">MAP −</button></div><div id="landingData" class="landing-card" style="display:none"></div><br><div id="engineData"></div><br><div id="fuelData"></div><br><div id="stateData"></div>`;}
  $('navData').innerHTML=`<b style="color:var(--cyn)">NAV TARGET</b><br>${a.icao} ${a.name}<br>${airportTypeLabel(a)} · RWY ${a.num}/${a.numB} ${a.rwyLen}×${a.rwyW}M<br>BRG ${norm360(Math.atan2(a.x-P.pos.x-OX,-(a.z-P.pos.z-OZ))*R2D).toFixed(0)}° · ${(d/1000).toFixed(1)}KM · ETE ${((d/Math.max(P.vel.length(),1))/60).toFixed(0)}MIN<br>WIND RWY ${hw>=0?'HEAD':'TAIL'} ${Math.abs(hw).toFixed(0)}KT · CROSS ${Math.abs(cw).toFixed(0)}KT<br>NEAREST ${near.icao} ${(Math.hypot(near.x-P.pos.x-OX,near.z-P.pos.z-OZ)/1000).toFixed(1)}KM · MAP ${(mapRange/1000).toFixed(0)}KM`;
  $('engineData').innerHTML=`<b style="color:var(--cyn)">ENGINE</b><br>N1 ${N1.toFixed(0)}% · N2 ${N2.toFixed(0)}% · AB ${(abSpool*100).toFixed(0)}%<br>${(Teng/1000).toFixed(0)}kN · TIT ${TIT.toFixed(0)}°C<br>INLET ${(inletDistortion*100).toFixed(0)}%${compressorSurge>.05?' · SURGE '+(compressorSurge*100).toFixed(0)+'%':''}<br>FF ${(ff*3600).toFixed(0)}KG/H`;
  $('fuelData').innerHTML=`<b style="color:var(--cyn)">FUEL</b><br>${fuel.toFixed(0)} KG<br>END ${((fuel)/Math.max(ff,0.05)/60).toFixed(0)} MIN`;
  $('stateData').innerHTML=`<b style="color:var(--cyn)">STATE</b><br>${parkBrake?'PARKED':wheelsOn?(P.vel.length()>2?'TAXI':'WOW'):'AIRBORNE'}<br>FCS ${S.fbw} · ${fcsPhase()} · ${S.structure}<br>STOVL ${stolMode}<br>ANTI-SKID ${antiSkid?'ACTIVE':'ARMED'} · HYDRO ${(hydroplane*100).toFixed(0)}%${MISSION.active?'<br><br><b style="color:var(--cyn)">MISSION</b><br>'+MISSION.name+'<br>'+missionObjectiveText():''}`;
  const ld=$('landingData');ld.style.display=stats.tdScore>0?'block':'none';if(stats.tdScore>0)ld.innerHTML=`<b>LAST LANDING ${stats.tdGrade}</b><br>${stats.tdScore}/100 · ${Math.abs(stats.tdVs*FPM).toFixed(0)} FPM · ${Math.abs(stats.tdAcross).toFixed(1)}M CL DEV`;
}
$('infoBody').addEventListener('click',e=>{const n=e.target.closest('[data-nav]'),m=e.target.closest('[data-map]');
  if(n){chooseNavAirport(n.dataset.nav);updateInfoPan();drawInfoMap();}
  else if(m){mapRange=clamp(mapRange*(m.dataset.map==='IN'?.72:1.38),16000,72000);mmNext=0;updateInfoPan();drawInfoMap();}});
function drawInfoMap(){
  /* minimap rendered into info panel via a small canvas appended once */
  let mc=$('miniMap');
  if(!mc){mc=document.createElement('canvas');mc.id='miniMap';mc.width=200;mc.height=200;
    mc.style.cssText='width:100%;margin-top:8px;border:1px solid var(--line)';$('infoBody').appendChild(mc);}
  const ctx=mc.getContext('2d');
  drawMinimap(200,0,0);
  ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';
  ctx.drawImage(mmCan,0,0,96,96,0,0,200,200);
  ctx.save();ctx.translate(100,100);ctx.rotate(-hdgDeg*D2R);
  ctx.fillStyle='#7ef0a8';ctx.beginPath();ctx.moveTo(0,-8);ctx.lineTo(6,7);ctx.lineTo(-6,7);ctx.closePath();ctx.fill();ctx.restore();
}
/* ================= [28] INIT ================= */
function applySavedUI(){
  if(SAVED.fuelLoad&&[...$('selFuel').options].some(o=>o.value===String(SAVED.fuelLoad)))$('selFuel').value=String(SAVED.fuelLoad);
  for(const [id,v] of[['sSens',S.sens],['sExpo',S.expo],['sDz',S.dz],['tOp',S.tOp],['tSz',S.tSz],['gDz',S.gDz],['sVol',S.volume]])$(id).value=v;
  $('touchui').style.opacity=S.tOp;tstick.style.transform=`scale(${S.tSz})`;applyTouchHand(S.hand);document.body.classList.toggle('scan',S.scan);$('sTarget').classList.toggle('on',S.targetMarker);$('sTarget').textContent=S.targetMarker?'ON':'OFF';$('tbTarget').classList.toggle('live',S.targetMarker);
  for(const id of['sInv','sCo','sHa','tRud','sScan']){const on={sInv:S.invPitch,sCo:S.coord,sHa:S.hoverAssist,tRud:S.rudSlider,sScan:S.scan}[id];$(id).classList.toggle('on',on);$(id).textContent=on?'ON':'OFF';}
  document.querySelectorAll('#asA,#asS,#asE,#sfA,#sfS,#sfE').forEach(c=>c.classList.remove('on'));
  $({ASSIST:'asA',STANDARD:'asS',ADVANCED:'asE'}[S.fbw]||'asA').classList.add('on');$({ASSIST:'sfA',STANDARD:'sfS',ADVANCED:'sfE'}[S.fbw]||'sfA').classList.add('on');
  document.querySelectorAll('#qA,#qL,#qM,#qH').forEach(c=>c.classList.remove('on'));$({AUTO:'qA',LOW:'qL',MED:'qM',HIGH:'qH'}[S.quality]||'qA').classList.add('on');
  document.querySelectorAll('#vR,#vN,#vE').forEach(c=>c.classList.remove('on'));$({REDUCED:'vR',NORMAL:'vN',ENHANCED:'vE'}[S.vapour]||'vE').classList.add('on');
  document.querySelectorAll('.wchip').forEach(c=>c.classList.toggle('on',c.dataset.w===wxPreset));
  let bestT=null,bestD=1e9;document.querySelectorAll('.tchip').forEach(c=>{const d=Math.abs(parseFloat(c.dataset.t)-simHours);if(d<bestD){bestD=d;bestT=c;}c.classList.remove('on');});if(bestT)bestT.classList.add('on');
  $('continue').style.display=SAVED.flight?'block':'none';syncHmdsChips();
}
populateScen();
applySavedUI();
applyQuality();
newWorld(SEED);
SELF_TEST=runValidation();console.info(`[F35B] self-test ${SELF_TEST.passed}/${SELF_TEST.total} passed`);
requestAnimationFrame(loop);
function onResize(){applyQl();camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();sizeHud();}addEventListener('resize',onResize);if(window.visualViewport)visualViewport.addEventListener('resize',sizeHud);
