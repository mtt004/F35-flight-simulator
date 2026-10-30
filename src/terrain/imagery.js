/* Embedded offline photographic ground; only an overview and four detail tiles
 * reside on the GPU. Stale asynchronous decodes cannot restore evicted tiles. */
(function(root){'use strict';const api=root.LightningImagery={};
class Residency{
 constructor(entries,load,dispose,limit=4){this.entries=entries;this.byId=new Map(entries.map(e=>[e.id,e]));this.load=load;this.free=dispose;this.limit=limit;this.resident=new Map();this.pending=new Map();this.failed=new Set();this.wanted=new Set();this.closed=false;this.selected=[];this.selection=null;this.seen=new Set();this.counters={loads:0,reloads:0,evictions:0,staleDecodes:0,peakPending:0,selectionPasses:0};}
 update(x,z,limit=this.limit){
  if(this.closed)return;this.limit=Math.max(0,Math.min(4,limit));
  if(!this.selection||this.selection.x!==x||this.selection.z!==z||this.selection.limit!==this.limit){
   this.selection={x,z,limit:this.limit};this.counters.selectionPasses++;
   // Compute each distance once. Preserve the original distance/id ordering.
   this.selected=this.entries.map(e=>{const b=e.extent;return{e,d:Math.hypot(Math.max(b[0]-x,0,x-b[2]),Math.max(b[1]-z,0,z-b[3]))};}).sort((a,b)=>a.d-b.d||String(a.e.id).localeCompare(String(b.e.id))).slice(0,this.limit).map(v=>v.e);
   this.wanted=new Set(this.selected.map(e=>e.id));
  }
  for(const[k,t]of this.resident)if(!this.wanted.has(k)){this.free(t);this.resident.delete(k);this.counters.evictions++;}
  for(const e of this.selected){
   if(this.pending.size>=2)break;if(this.resident.has(e.id)||this.pending.has(e.id)||this.failed.has(e.id))continue;
   const ticket={e};this.pending.set(e.id,ticket);this.counters.loads++;if(this.seen.has(e.id))this.counters.reloads++;this.seen.add(e.id);this.counters.peakPending=Math.max(this.counters.peakPending,this.pending.size);
   Promise.resolve().then(()=>this.load(e)).then(t=>{if(this.closed||!this.wanted.has(e.id)){this.free(t);this.counters.staleDecodes++;return;}this.resident.set(e.id,t);},()=>this.failed.add(e.id)).finally(()=>{if(this.pending.get(e.id)===ticket)this.pending.delete(e.id);});
  }
 }
 stats(){return{resident:this.resident.size,pending:this.pending.size,failed:this.failed.size,maxResident:this.limit,estimatedRGBABytes:this.resident.size*512*512*4*4/3,...this.counters};}
 dispose(){this.closed=true;this.wanted.clear();for(const t of this.resident.values())this.free(t);this.resident.clear();}
}
api.Residency=Residency;let cache,material,placeholder,last=-Infinity;
api.init=function(T,m){material=m;const source=root.__LONDON_IMAGERY__;if(!source)return;
 const decode=e=>new Promise((resolve,reject)=>{const im=new Image();im.onload=()=>{if(!im.width||!im.height)return reject(Error('Empty imagery'));const t=new T.Texture(im);t.minFilter=T.LinearMipmapLinearFilter;t.magFilter=T.LinearFilter;t.generateMipmaps=true;t.anisotropy=4;t.needsUpdate=true;resolve(t);};im.onerror=()=>reject(Error('Offline imagery decode failed: '+e.id));im.src=source.assets[e.file];});
 placeholder=new T.DataTexture(new Uint8Array([100,100,100,255]),1,1);placeholder.needsUpdate=true;cache=new Residency(source.manifest.tiles,decode,t=>{t.dispose();if(t.image)t.image.src='';},4);
 for(let i=0;i<4;i++){m.uniforms['uPhoto'+i]={value:placeholder};m.uniforms['uPhotoBounds'+i]={value:new T.Vector4(0,0,1,1)};m.uniforms['uPhotoReady'+i]={value:0};}
 m.fragmentShader='uniform sampler2D uPhoto0,uPhoto1,uPhoto2,uPhoto3;uniform vec4 uPhotoBounds0,uPhotoBounds1,uPhotoBounds2,uPhotoBounds3;uniform float uPhotoReady0,uPhotoReady1,uPhotoReady2,uPhotoReady3;\n'+m.fragmentShader;
 let shader='';for(let i=0;i<4;i++)shader+=`{vec4 b=uPhotoBounds${i};vec2 uv=vec2((globalXZ.x-b.x)/(b.z-b.x),1.-(globalXZ.y-b.y)/(b.w-b.y));if(uPhotoReady${i}>.5&&uv.x>=0.&&uv.x<=1.&&uv.y>=0.&&uv.y<=1.){vec3 detail=texture2D(uPhoto${i},uv).rgb;float edge=smoothstep(0.,.008,min(min(uv.x,1.-uv.x),min(uv.y,1.-uv.y)));land=mix(land,detail,edge);}}`;
 m.fragmentShader=m.fragmentShader.replace('col=mix(col,land*',shader+'col=mix(col,land*');
 m.fragmentShader=m.fragmentShader.replace('col=mix(col,land*(.94+fine*.10)','land=mix(land/12.92,pow((land+.055)/1.055,vec3(2.4)),step(vec3(.04045),land));col=mix(col,land*(.97+fine*.06)');
 m.fragmentShader=m.fragmentShader.replace('col*=mix(1.,.76,uWet);','col*=mix(1.,.76,uWet)*mix(.055,1.,uDay);');
 m.fragmentShader=m.fragmentShader.replace('gl_FragColor=vec4(col,1.);','gl_FragColor=vec4(col,1.);\n#include <tonemapping_fragment>\n#include <encodings_fragment>');
};
api.update=function(x,z,alt,quality,time){if(!cache||!material)return;if(time-last>.2||time<last){cache.update(x,z,alt>2800?0:quality===0?2:4);last=time;}let i=0;for(const[id,t]of cache.resident){const e=cache.byId.get(id);material.uniforms['uPhoto'+i].value=t;material.uniforms['uPhotoBounds'+i].value.fromArray(e.extent);material.uniforms['uPhotoReady'+i].value=1;i++;}for(;i<4;i++){material.uniforms['uPhotoReady'+i].value=0;material.uniforms['uPhoto'+i].value=placeholder;}};
api.stats=()=>cache?{...cache.stats(),source:root.__LONDON_IMAGERY__.manifest.id,overviewReady:!!material?.uniforms.uLondonMap.value.image?.width}:{resident:0,pending:0,source:'vector-only'};
api.reset=()=>{if(cache){cache.update(-1e8,-1e8,0);api.update(0,0,10000,0,last+1);}last=-Infinity;};
})(typeof window==='undefined'?globalThis:window);
