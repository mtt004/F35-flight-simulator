/* UI/lifecycle integration follows simulator classic globals; no native bridge. */
let meterTime=0;
function saveLightningOptions(){try{localStorage.setItem('lightning_options_v1',JSON.stringify(L));}catch(_){toast('SETTINGS STORAGE UNAVAILABLE','warn');}}
function applyLightningLayout(){S.tOp=L.opacity;$('tOp').value=L.opacity;$('touchui').style.opacity=L.opacity;const dy=-L.stickY;const dir=S.hand==='R'?1:-1;tstick.style.transform=`translate(${L.stickX*dir}vw,${dy}vh) scale(${S.tSz})`;}
function updateLightningMeter(now){if(now-meterTime<500)return;meterTime=now;const badge=$('sceneryBadge');if(badge){const stats=LightningLondon.stats();badge.textContent=`LIGHTNING ${__LIGHTNING_BUILD__.version} · ${worldMode==='LONDON'?'LONDON · '+(stats.imagery?.overviewReady?'SATELLITE':'LOADING IMAGERY'):'LEGACY'}`;}const e=$('lightningMeter');if(!e)return;e.style.display=L.diagnostics?'block':'none';if(!L.diagnostics)return;const sorted=workSamples.slice().sort((a,b)=>a-b),p95=sorted[Math.floor(sorted.length*.95)]||0;e.textContent=`${(1000/frameEMA).toFixed(1)} FPS · ${frameEMA.toFixed(1)} ms cadence\nJS + GPU submission ${lastWorkMs.toFixed(1)}ms · p95 ${p95.toFixed(1)}ms\n${renderer.domElement.width} × ${renderer.domElement.height} · Q${qlLevel}\n${renderer.info.render.calls} draws · ${Math.round(renderer.info.render.triangles/1000)}k tris\n${renderer.info.memory.geometries} geometry · ${renderer.info.memory.textures} textures`;}
(function setupLightningUI(){
 const host=document.createElement('section');host.id='lightningPanel';host.innerHTML='<h4>LIGHTNING GRAPHICS & CAMERA</h4>';const drawer=$('drawer');drawer.appendChild(host);
 const label=(name)=>{const n=document.createElement('label');n.textContent=name;host.appendChild(n);return n;};
 function select(name,key,items,fn){label(name);const e=document.createElement('select');e.id=key==='profile'?'lightningProfile':'lightning-'+key;for(const [v,t]of items){const o=document.createElement('option');o.value=v;o.textContent=t;e.appendChild(o);}e.value=L[key];e.addEventListener('change',()=>{L[key]=e.value;fn?.();saveLightningOptions();});host.appendChild(e);}
 function slider(name,key,min,max,step,fn){label(name);const e=document.createElement('input');e.type='range';e.min=min;e.max=max;e.step=step;e.value=L[key];e.setAttribute('aria-label',name);e.addEventListener('input',()=>{L[key]=Number(e.value);fn?.();saveLightningOptions();});host.appendChild(e);}
 select('Graphics profile','profile',[['BATTERY','Battery saver · 30 FPS'],['BALANCED','Balanced · 30 FPS'],['HIGH','High quality · 30 FPS'],['FAST','High FPS · up to 60']],applyQuality);
 select('Camera tracking (outside cockpit)','camera',[['STANDARD','Standard cameras'],['PRECISION','Precision landing'],['CINEMATIC','Cinematic tracking'],['FIXED','Fixed external position']],()=>{fixedCameraAnchor=null;snapCameraToAircraft();});
 slider('Camera distance','zoom',.65,1.6,.05);slider('Camera movement','shake',0,1,.05);
 select('Instrument layout','instrument',[['MILITARY','Military'],['MINIMAL','Minimal'],['LANDING','Landing']],()=>{S.hmds={MILITARY:'FULL',MINIMAL:'MIN',LANDING:'LANDING'}[L.instrument];syncHmdsChips();savePrefs(false);});
 select('Procedural world appearance','palette',[['AUTO','Varied biomes'],['HAMPSHIRE','Hampshire inspired'],['CAPPADOCIA','Cappadocia inspired'],['CUSTOM','Imported palette']],()=>LightningScenery.setPalette(THREE,terrainMat,L.palette,customPalette));
 label('Import appearance pack (.json)');const upload=document.createElement('input');upload.type='file';upload.accept='.json,application/json';upload.addEventListener('change',async()=>{const f=upload.files[0];if(!f)return;try{if(f.size>16384)throw Error('Pack exceeds 16 KiB');const p=Lightning.validatePack(JSON.parse(await f.text()));customPalette=p.palette;L.palette='CUSTOM';LightningScenery.setPalette(THREE,terrainMat,L.palette,customPalette);$('lightning-palette').value='CUSTOM';try{localStorage.setItem('lightning_palette_v1',JSON.stringify(p));}catch(_){}saveLightningOptions();toast(p.name+' LOADED');}catch(e){toast('INVALID APPEARANCE PACK','warn');}upload.value='';});host.appendChild(upload);
 slider('Touch opacity','opacity',.25,1,.05,applyLightningLayout);slider('Stick horizontal offset','stickX',-30,30,1,applyLightningLayout);slider('Stick vertical offset','stickY',0,20,1,applyLightningLayout);
 const d=document.createElement('button');d.className='obtn';d.textContent='Performance overlay';d.addEventListener('click',()=>{L.diagnostics=!L.diagnostics;saveLightningOptions();updateLightningMeter(performance.now()+500);});host.appendChild(d);
 const badge=document.createElement('div');badge.id='sceneryBadge';document.body.appendChild(badge);
 const meter=document.createElement('div');meter.id='lightningMeter';document.body.appendChild(meter);
 const error=document.createElement('div');error.id='lightningError';error.innerHTML='<p id="lightningErrorText"></p><button type="button">Reload simulator</button>';error.querySelector('button').addEventListener('click',()=>location.reload());document.body.appendChild(error);
 applyLightningLayout();
 $('tOp').addEventListener('input',()=>{L.opacity=S.tOp;saveLightningOptions();});
 ['hR','hL','tSz'].forEach(id=>$(id).addEventListener('click',applyLightningLayout));$('tSz').addEventListener('input',applyLightningLayout);
})();
function suspendLightning(){
 if(replayActive)stopReplay();
 if(running&&!paused&&!crashed)togglePause();
 for(const key of Object.keys(K))delete K[key];tch.el=tch.ail=tch.rud=0;tch.brk=false;tIn.el=tIn.ail=tIn.rud=0;brakes=false;stickPid=null;tknob.style.transform='translate(0,0)';
 savePrefs(true);physAcc=0;cadence.reset();last=performance.now();if(AC&&AC.state==='running')AC.suspend().catch(()=>{});
}
function resumeLightning(){physAcc=0;last=performance.now();cadence.reset();}
addEventListener('blur',suspendLightning);document.addEventListener('visibilitychange',()=>{if(document.hidden)suspendLightning();else resumeLightning();});
addEventListener('lightningpause',suspendLightning);addEventListener('lightningresume',resumeLightning);
document.addEventListener('pointerdown',()=>{if(AC&&AC.state==='suspended')AC.resume().catch(()=>{});},{capture:true});
renderCanvas.addEventListener('webglcontextlost',e=>{e.preventDefault();contextLost=true;suspendLightning();$('lightningErrorText').textContent='Graphics paused. Waiting for the renderer to recover. Your flight is saved.';$('lightningError').style.display='block';});
renderCanvas.addEventListener('webglcontextrestored',()=>{contextLost=false;LightningLondonLighting.environment(THREE,renderer,scene);resumeLightning();applyQl();$('lightningError').style.display='none';toast('GRAPHICS RESTORED — RESUME WHEN READY');});
