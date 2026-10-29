/* Offline OS London. X=easting-507000, Z=176000-northing, metres EPSG:27700/ODN.
 * Map outlines/elevations are real; heights, material categories and authored airport details are interpretations. */
(function(root){'use strict';const api=root.LightningLondon={},CELL=1200,CHUNK=2400;
api.fromGrid=(e,n)=>({x:e-507000,z:176000-n});api.toGrid=(x,z)=>({e:x+507000,n:176000-z});
api.sampleGrid=function(g,x,z){const u=(x-g.x)/g.step,v=(z-g.z)/g.step;if(!Number.isFinite(u+v)||u<0||v<0||u>g.nx-1||v>g.nz-1)return null;const i=Math.min(g.nx-2,Math.floor(u)),j=Math.min(g.nz-2,Math.floor(v)),a=u-i,b=v-j,k=j*g.nx+i,h=g.values;return a+b<=1?h[k]+(h[k+1]-h[k])*a+(h[k+g.nx]-h[k])*b:h[k+g.nx+1]+(h[k+g.nx]-h[k+g.nx+1])*(1-a)+(h[k+1]-h[k+g.nx+1])*(1-b);};
function inRing(p,x,z){let yes=false;for(let i=0,j=p.length-1;i<p.length;j=i++){const a=p[i],b=p[j];if((a[1]>z)!==(b[1]>z)&&x<(b[0]-a[0])*(z-a[1])/(b[1]-a[1])+a[0])yes=!yes;}return yes;}
api.contains=(f,x,z)=>inRing(f.p,x,z)&&!(f.holes||[]).some(p=>inRing(p,x,z));
const key=(x,z)=>Math.floor(x/CELL)+','+Math.floor(z/CELL);
function bounds(p){const xs=p.map(v=>v[0]),zs=p.map(v=>v[1]);return{x0:Math.min(...xs),x1:Math.max(...xs),z0:Math.min(...zs),z1:Math.max(...zs)};}
let renderedBuildings=0,measuredBuildings=0;
let data,buildings=new Map(),colliders=new Map(),waters=new Map(),grounds=new Map(),roadsByTile=new Map();
const add=(m,k,v)=>{if(!m.has(k))m.set(k,[]);m.get(k).push(v);};
api.load=function(d){api.dispose();data=d;renderedBuildings=measuredBuildings=0;for(const m of[buildings,colliders,waters,grounds,roadsByTile])m.clear();
 for(const f of d.surfaces){const b=f.bounds=bounds(f.p);add(grounds,key((b.x0+b.x1)/2,(b.z0+b.z1)/2),f);if(f.kind==='water')for(let i=Math.floor(b.x0/CELL);i<=Math.floor(b.x1/CELL);i++)for(let j=Math.floor(b.z0/CELL);j<=Math.floor(b.z1/CELL);j++)add(waters,i+','+j,f);}
 for(const r of d.roads){const q=bounds(r.p);add(roadsByTile,key((q.x0+q.x1)/2,(q.z0+q.z1)/2),r);}
 for(const b of d.buildings){const measured=root.__LONDON_HEIGHTS__?.[b.id];if(measured&&measured.source==='ea-lidar-dsm-dtm-1m-2022'&&Number.isFinite(measured.height)&&measured.height>0){b.h=measured.height;b.heightSource=measured.source;measuredBuildings++;}else b.heightSource='estimated';const q=b.bounds=bounds(b.p);if(root.LightningLandmarks?.excludes?.((q.x0+q.x1)/2,(q.z0+q.z1)/2))continue;delete b.baseY;if(root.LightningArchitecture)b.arch=root.LightningArchitecture.classify(b);renderedBuildings++;add(buildings,key((q.x0+q.x1)/2,(q.z0+q.z1)/2),b);for(let i=Math.floor(q.x0/CELL);i<=Math.floor(q.x1/CELL);i++)for(let j=Math.floor(q.z0/CELL);j<=Math.floor(q.z1/CELL);j++)add(colliders,i+','+j,b);}
};
api.waterAt=(x,z)=>(waters.get(key(x,z))||[]).find(f=>x>=f.bounds.x0&&x<=f.bounds.x1&&z>=f.bounds.z0&&z<=f.bounds.z1&&api.contains(f,x,z));api.isWater=(x,z)=>!!api.waterAt(x,z);
api.height=function(x,z){if(!data)return null;let h=api.sampleGrid(data.terrain,x,z);if(h===null)return null;const w=api.waterAt(x,z);if(w)return w.level-2;for(const a of api.runways){const dx=x-a.x,dz=z-a.z,u=dx*a.ux+dz*a.uz,v=dx*a.rx+dz*a.rz,d=Math.hypot(Math.max(0,Math.abs(u)-a.rwyLen/2-80),Math.max(0,Math.abs(v)-180));if(d<220){const k=1-d/220;h=h*(1-k)+a.elev*k;}}return h;};
api.surface=(x,z)=>{const w=api.waterAt(x,z);return w?w.level:api.height(x,z);};
api.runways=[{num:'09L',numB:'27R',a:[-1999.191,-473.935],b:[1903.906,-577.195],elev:24.1,len:3902},{num:'09R',numB:'27L',a:[-1787.281,935.739],b:[1877.15,839.019],elev:23.2,len:3658}].map((a,i)=>{const dx=a.b[0]-a.a[0],dz=a.b[1]-a.a[1],d=Math.hypot(dx,dz),ux=dx/d,uz=dz/d,hdg=Math.atan2(ux,-uz)*180/Math.PI;return{...a,x:(a.a[0]+a.b[0])/2,z:(a.a[1]+a.b[1])/2,ux,uz,rx:-uz,rz:ux,hdg,hdgB:(hdg+180)%360,rwyLen:a.len,rwyW:50,thrAx:a.a[0],thrAz:a.a[1],thrBx:a.b[0],thrBz:a.b[1],idx:i,regionKey:'london',icao:i?'EGLL-S':'EGLL',name:'HEATHROW '+a.num+'/'+a.numB,kind:'MAJOR',size:'L',platform:false,stovl:false,surface:'ASPHALT',twrX:668,twrZ:58,twrH:87,nHangars:0,papi:[],grp:null};});
function soup(T){const p=[],c=[],uv=[],arch=[];return{tri(a,b,d,color,tex=[[0,0],[0,0],[0,0]],style=0){p.push(...a,...b,...d);c.push(...color,...color,...color);uv.push(...tex.flat());arch.push(style,style,style);},geometry(){const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(p,3));g.setAttribute('color',new T.Float32BufferAttribute(c,3));g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.setAttribute('architecture',new T.Float32BufferAttribute(arch,1));g.computeVertexNormals();g.computeBoundingBox();g.computeBoundingSphere();return g;}};}
function triangulate(T,f){
 // r128 removes duplicate closing vertices in-place before generating indices.
 // Flatten the same open rings so hole offsets address the correct vertices.
 const rings=[f.p,...f.holes||[]].map(r=>{const a=r[0],b=r[r.length-1];return r.length>1&&a[0]===b[0]&&a[1]===b[1]?r.slice(0,-1):r;});
 return{p:rings.flat(),tri:T.ShapeUtils.triangulateShape(rings[0].map(p=>new T.Vector2(...p)),rings.slice(1).map(r=>r.map(p=>new T.Vector2(...p))))};
}
api.terrainGeometry=function(T,ci,cj,seg,height){const n=seg+1,cx=(ci+.5)*CHUNK,cz=(cj+.5)*CHUNK,p=[],c=[],ix=[];for(let j=0;j<n;j++)for(let i=0;i<n;i++){const x=-1200+i*CHUNK/seg,z=-1200+j*CHUNK/seg;p.push(x,height(x+cx,z+cz),z);c.push(.35,.39,.30);}for(let j=0;j<seg;j++)for(let i=0;i<seg;i++){const a=j*n+i;ix.push(a,a+n,a+1,a+1,a+n,a+n+1);}const edge=[];for(let i=0;i<n;i++)edge.push(i);for(let j=0;j<n;j++)edge.push(j*n+seg);for(let i=seg;i>=0;i--)edge.push(seg*n+i);for(let j=seg;j>=0;j--)edge.push(j*n);for(let i=0;i<edge.length;i++){const a=edge[i]*3,b=p.length/3;p.push(p[a],p[a+1],p[a+2],p[a],p[a+1]-30,p[a+2]);c.push(.35,.39,.30,.35,.39,.30);if(i%n!==seg)ix.push(b,b+1,b+2,b+2,b+1,b+3);}const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(p,3));g.setAttribute('color',new T.Float32BufferAttribute(c,3));g.setIndex(ix);g.computeVertexNormals();g.computeBoundingSphere();return g;};
function baseHeight(b,height){return b.baseY??(b.baseY=Math.max(...b.p.map(p=>height(...p)??10)));}
api.buildBuildings=function(T,list,lod,height){const o=soup(T);for(const b of list){
 let f=b;const q=b.bounds||bounds(b.p),style=b.arch??root.LightningArchitecture?.classify(b)??4;
 if(lod===2)f={p:[[q.x0,q.z0],[q.x1,q.z0],[q.x1,q.z1],[q.x0,q.z1]]};
 const base=baseHeight(b,height),top=base+b.h,seed=(Number(String(b.id).replace(/\D/g,'').slice(-4))||0)%17/17,col=[.91+seed*.09,.90+seed*.10,.88+seed*.12];
 const pitched=style<2&&lod<2&&!b.holes?.length&&b.arch!==undefined,rise=pitched?Math.min(3,b.h*.24):0;
 const ridgeX=(q.x1-q.x0)<(q.z1-q.z0),mid=ridgeX?(q.x0+q.x1)/2:(q.z0+q.z1)/2;
 const roofY=p=>pitched?top-rise*Math.min(1,Math.abs((ridgeX?p[0]:p[1])-mid)/Math.max(1,(ridgeX?q.x1-q.x0:q.z1-q.z0)/2)):top,t=triangulate(T,f);
 for(const a of t.tri){let polys=[a.map(i=>t.p[i])];if(pitched){const axis=ridgeX?0:1;polys=[];for(const sign of[-1,1]){const poly=a.map(i=>t.p[i]),out=[];for(let i=0;i<poly.length;i++){const p=poly[i],r=poly[(i+1)%poly.length],inside=(p[axis]-mid)*sign>=0,next=(r[axis]-mid)*sign>=0;if(inside)out.push(p);if(inside!==next){const k=(mid-p[axis])/(r[axis]-p[axis]);out.push([p[0]+k*(r[0]-p[0]),p[1]+k*(r[1]-p[1])]);}}if(out.length>=3)polys.push(out);}}
  for(const poly of polys)for(let i=1;i<poly.length-1;i++){const p=[poly[0],poly[i],poly[i+1]];o.tri(...p.map(v=>[v[0],roofY(v),v[1]]),col.map(v=>v*.83),p.map(v=>[v[0]/12,v[1]/12]),style+8);}}
 for(const r of[f.p,...f.holes||[]]){let dist=0;for(let i=0;i<r.length;i++){const a=r[i],d=r[(i+1)%r.length],len=Math.hypot(d[0]-a[0],d[1]-a[1]);if(!len)continue;const v0=[a[0],base,a[1]],v1=[d[0],base,d[1]],v2=[d[0],roofY(d),d[1]],v3=[a[0],roofY(a),a[1]],u0=dist/12,u1=(dist+len)/12;
 o.tri(v0,v2,v1,col,[[u0,0],[u1,(v2[1]-base)/12],[u1,0]],style);o.tri(v0,v3,v2,col,[[u0,0],[u0,(v3[1]-base)/12],[u1,(v2[1]-base)/12]],style);
 if(pitched){const axis=ridgeX?0:1;if((a[axis]-mid)*(d[axis]-mid)<0){const k=(mid-a[axis])/(d[axis]-a[axis]),m=[a[0]+k*(d[0]-a[0]),top,a[1]+k*(d[1]-a[1])];o.tri(v3,m,v2,col,[[u0,(v3[1]-base)/12],[u0+(u1-u0)*k,b.h/12],[u1,(v2[1]-base)/12]],style);}}dist+=len;}}
 }return o.geometry();};
function surfaceGeometry(T,list,rr,height){const o=soup(T);for(const f of list){if(f.kind==='site')continue;const col=f.kind==='water'?[.18,.29,.30]:f.kind==='woodland'?[.17,.28,.14]:[.4,.36,.27],t=triangulate(T,f);for(const a of t.tri)o.tri(...a.map(i=>{const p=t.p[i];return[p[0],f.kind==='water'?f.level:(height(...p)??10)+.65,p[1]];}),col);}for(const f of rr)for(let i=1;i<f.p.length;i++){const a=f.p[i-1],b=f.p[i],dx=b[0]-a[0],dz=b[1]-a[1],len=Math.hypot(dx,dz);if(!len)continue;const w=Math.min(20,f.width||7)/2,nx=-dz/len*w,nz=dx/len*w,N=Math.ceil(len/70);for(let j=0;j<N;j++){const p=[a[0]+dx*j/N,a[1]+dz*j/N],q=[a[0]+dx*(j+1)/N,a[1]+dz*(j+1)/N],v0=[p[0]-nx,(height(...p)??10)+.9,p[1]-nz],v1=[p[0]+nx,(height(...p)??10)+.9,p[1]+nz],v2=[q[0]+nx,(height(...q)??10)+.9,q[1]+nz],v3=[q[0]-nx,(height(...q)??10)+.9,q[1]-nz];o.tri(v0,v2,v1,[.22,.23,.23]);o.tri(v0,v3,v2,[.22,.23,.23]);}}return o.geometry();}
let group,T0,mat,groundMat,riverMat,cache=new Map(),groundCache=new Map(),lastUpdate=-Infinity,lastWork=-Infinity,night=0;
let buildingQueue=[],groundQueue=[],buildingJob=null,groundJob=null;
const clock=()=>root.performance?.now?.()??Date.now();
function cancelJob(job){if(job)for(const g of job.parts)g.dispose();}
// Copy already-triangulated attributes, including normals; no geometry rebuild at tile completion.
function finishGeometry(parts){const g=new T0.BufferGeometry();if(!parts.length)return g;
 for(const name of Object.keys(parts[0].attributes)){const first=parts[0].getAttribute(name),array=new Float32Array(parts.reduce((n,p)=>n+p.getAttribute(name).array.length,0));let offset=0;for(const p of parts){const a=p.getAttribute(name).array;array.set(a,offset);offset+=a.length;}g.setAttribute(name,new T0.BufferAttribute(array,first.itemSize));}
 g.boundingBox=new T0.Box3();for(const p of parts)g.boundingBox.union(p.boundingBox);g.boundingSphere=g.boundingBox.getBoundingSphere(new T0.Sphere());for(const p of parts)p.dispose();return g;}
function advanceJob(job,isGround){const list=job.list.slice(job.next,job.next+8);job.parts.push(isGround?surfaceGeometry(T0,[],list,api.height):api.buildBuildings(T0,list,job.lod,api.height));job.next+=list.length;
 if(job.next<job.list.length)return job;
 const m=new T0.Mesh(finishGeometry(job.parts),isGround?groundMat:mat);m.castShadow=!isGround;m.receiveShadow=true;const store=isGround?groundCache:cache,old=store.get(job.k);group.add(m);if(old){const previous=isGround?old:old.m;group.remove(previous);previous.geometry.dispose();}store.set(job.k,isGround?m:{m,lod:job.lod});return null;}
function startJob(v,isGround){return v?{k:v.k,lod:v.lod,list:isGround?(roadsByTile.get(v.k)||[]):v.b,next:0,parts:[]}:null;}

api.create=function(T,parent,terrainMat){api.dispose();T0=T;group=new T.Group();group.name='London OS offline scenery';parent.add(group);if(terrainMat){const g=new T.PlaneGeometry(140000,140000);g.setAttribute('color',new T.Float32BufferAttribute(Array(g.attributes.position.count).fill([.12,.16,.1]).flat(),3));g.rotateX(-Math.PI/2);const base=new T.Mesh(g,terrainMat);base.position.set(18000,-20,0);base.name='Synthetic low detail horizon outside map coverage';group.add(base);}
if(root.LightningArchitecture){mat=root.LightningArchitecture.material(T);}else{mat=new T.MeshLambertMaterial({vertexColors:true,side:T.DoubleSide});mat.onBeforeCompile=s=>{s.uniforms.londonNight={value:night};mat.userData.shader=s;s.vertexShader='varying vec3 lp,ln;\n'+s.vertexShader;s.vertexShader=s.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nlp=position;ln=normal;');s.fragmentShader='varying vec3 lp,ln;uniform float londonNight;\n'+s.fragmentShader;s.fragmentShader=s.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
float wall=1.-smoothstep(.15,.7,abs(ln.y));vec2 wp=vec2(abs(ln.x)>.6?lp.z:lp.x,lp.y)/vec2(3.,3.3);vec2 cell=abs(fract(wp)-.5),aa=fwidth(wp)*1.2;float win=(1.-smoothstep(.27-aa.x,.29+aa.x,cell.x))*(1.-smoothstep(.28-aa.y,.31+aa.y,cell.y))*wall;float lit=step(.68,fract(sin(dot(floor(wp),vec2(12.989,78.23)))*43758.54));diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.19,.28,.32),win*.72);`);s.fragmentShader=s.fragmentShader.replace('#include <emissivemap_fragment>','#include <emissivemap_fragment>\ntotalEmissiveRadiance+=vec3(.7,.43,.16)*win*lit*londonNight;');};}
 groundMat=new T.MeshLambertMaterial({vertexColors:true,side:T.DoubleSide,polygonOffset:true,polygonOffsetFactor:-1});riverMat=new T.MeshStandardMaterial({vertexColors:true,side:T.DoubleSide,roughness:.32,metalness:.12,envMapIntensity:.55});if(root.LightningLandmarks)group.add(root.LightningLandmarks.build(T,api.height));group.add(api.buildAirport(T));const water=new T.Mesh(surfaceGeometry(T,data.surfaces.filter(f=>f.kind==='water'),[],api.height),riverMat);water.receiveShadow=true;water.name='Complete offline water surfaces';group.add(water);return group;};
api.update=function(x,z,alt,quality,n,time){night=n;if(root.LightningArchitecture&&mat)root.LightningArchitecture.update(mat,n);else if(mat?.userData.shader)mat.userData.shader.uniforms.londonNight.value=n;if(riverMat)riverMat.envMapIntensity=.025+.5*(1-n);root.LightningImagery?.update(x,z,alt,quality,time);if(!group)return;group.getObjectByName('LondonLandmarks')?.traverse(o=>{if(o.material&&root.LightningArchitecture)root.LightningArchitecture.update(o.material,n);});
 // Both the visual setup and render loop may call update for the same frame.
 if(time>=lastWork&&time-lastWork<.015)return;lastWork=time;
 if(time-lastUpdate>=.2||time<lastUpdate){lastUpdate=time;
 const items=[...buildings].map(([k,b])=>{const p=k.split(',').map(Number);return{k,b,d:Math.hypot((p[0]+.5)*CELL-x,(p[1]+.5)*CELL-z,alt)};}).filter(v=>v.d<33000).sort((a,b)=>a.d-b.d).slice(0,quality>1?100:72),wanted=new Set(items.map(v=>v.k));
 buildingQueue=items.map(v=>({...v,lod:v.d<2200?0:v.d<6500?1:2})).filter(v=>{const old=cache.get(v.k);return !old||old.lod!==v.lod&&Math.abs(v.d-(v.lod===0?2200:6500))>300;});
 if(buildingJob&&!buildingQueue.some(v=>v.k===buildingJob.k&&v.lod===buildingJob.lod)){cancelJob(buildingJob);buildingJob=null;}
 for(const[k,v]of cache)if(!wanted.has(k)){group.remove(v.m);v.m.geometry.dispose();cache.delete(k);}
 // The map atlas already contains the complete real road network. Local meshes add
 // nearby land cover only; rebuilding all road ribbons duplicates that atlas work.
 const gi=[...roadsByTile.keys()].map(k=>{const p=k.split(',').map(Number);return{k,d:Math.hypot((p[0]+.5)*CELL-x,(p[1]+.5)*CELL-z)};}).filter(v=>v.d<2200&&alt<900).sort((a,b)=>a.d-b.d).slice(0,16),gw=new Set(gi.map(v=>v.k));
 groundQueue=gi.filter(v=>!groundCache.has(v.k));if(groundJob&&!gw.has(groundJob.k)){cancelJob(groundJob);groundJob=null;}
 for(const[k,m]of groundCache)if(!gw.has(k)){group.remove(m);m.geometry.dispose();groundCache.delete(k);}
 }
 // A soft budget: one unusually complex footprint can exceed it. Limit each
 // batch to eight features and keep incomplete geometries off the GPU.
 const start=clock();let steps=0;
 while(steps<12&&clock()-start<6){
  if(!buildingJob){while(buildingQueue.length){const v=buildingQueue.shift(),old=cache.get(v.k);if(!old||old.lod!==v.lod){buildingJob=startJob(v,false);break;}}}
  if(buildingJob){buildingJob=advanceJob(buildingJob,false);steps++;if(clock()-start>=6)break;}
  if(!groundJob){while(groundQueue.length){const v=groundQueue.shift();if(!groundCache.has(v.k)){groundJob=startJob(v,true);break;}}}
  if(groundJob){groundJob=advanceJob(groundJob,true);steps++;}
  if(!buildingJob&&!groundJob&&!buildingQueue.length&&!groundQueue.length)break;
 }
};
api.stats=()=>({imagery:root.LightningImagery?.stats(),measuredHeights:measuredBuildings,buildings:renderedBuildings,rawBuildings:data?.buildings.length||0,buildingTiles:cache.size,groundTiles:groundCache.size,pendingBuildings:buildingJob?buildingJob.list.length-buildingJob.next:0,lods:[...cache.values()].reduce((a,v)=>(a[v.lod]++,a),[0,0,0])});
const airportObstacles=[];
const terminals=[{x:-1380,z:200,w:430,d:650,h:22},{x:600,z:250,w:430,d:280,h:26},{x:-20,z:350,w:520,d:230,h:23},{x:1060,z:1530,w:480,d:100,h:20},{x:1910,z:-80,w:360,d:150,h:24}];
api.collides=function(x,y,z){if(root.LightningLandmarks?.collides?.(x,y,z,api.height))return true;for(const b of colliders.get(key(x,z))||[])if(x>=b.bounds.x0&&x<=b.bounds.x1&&z>=b.bounds.z0&&z<=b.bounds.z1&&api.contains(b,x,z)&&y<baseHeight(b,api.height)+b.h)return true;for(const b of airportObstacles)if(Math.abs(x-b.x)<b.w/2&&Math.abs(z-b.z)<b.d/2&&y>b.y&&y<b.y+b.h)return true;for(const b of terminals)if(Math.abs(x-b.x)<b.w/2&&Math.abs(z-b.z)<b.d/2&&y<(api.height(b.x,b.z)??24)+b.h+14)return true;return Math.hypot(x-668,z-58)<14&&y<102;};
api.dispose=function(){cancelJob(buildingJob);cancelJob(groundJob);buildingJob=groundJob=null;buildingQueue=[];groundQueue=[];if(group){const gg=new Set(),mm=new Set();group.traverse(o=>{if(o.geometry)gg.add(o.geometry);if(o.material)for(const m of[o.material].flat())mm.add(m);});for(const g of gg)g.dispose();for(const m of mm){if(m.userData.shared)continue;for(const t of new Set([m.map,m.roughnessMap,...(m.userData.ownedTextures||[])].filter(Boolean)))t.dispose();m.dispose();}group.parent?.remove(group);}group=null;root.LightningImagery?.reset();cache.clear();groundCache.clear();lastUpdate=lastWork=-Infinity;};
api.initTerrain=function(T,m){function texture(src,mip){const t=new T.Texture(),i=new Image();i.onload=()=>{t.image=i;t.needsUpdate=true;};i.src=src;t.minFilter=mip?T.LinearMipmapLinearFilter:T.LinearFilter;t.magFilter=T.LinearFilter;t.generateMipmaps=mip;t.anisotropy=mip?4:1;return t;}m.uniforms.uLondon={value:0};m.uniforms.uLondonMap={value:texture(globalThis.__LONDON_GROUND__,true)};m.uniforms.uLondonMask={value:texture(globalThis.__LONDON_MASK__,false)};m.fragmentShader='uniform float uLondon;uniform sampler2D uLondonMap,uLondonMask;\n'+m.fragmentShader;m.fragmentShader=m.fragmentShader.replace('float diff=max(dot(n,l),0.);','vec2 guv=vec2((globalXZ.x+5000.)/39000.,1.-(globalXZ.y+9000.)/15000.);float inside=step(0.,guv.x)*step(guv.x,1.)*step(0.,guv.y)*step(guv.y,1.);if(uLondon*inside>.5&&texture2D(uLondonMask,guv).r>.5)discard;vec3 land=texture2D(uLondonMap,clamp(guv,0.,1.)).rgb;col=mix(col,land*(.94+fine*.10),uLondon*inside);float diff=max(dot(n,l),0.);');root.LightningImagery?.init(T,m);};
// Original architectural interpretation, not surveyed terminal or stand geometry.
// Two merged meshes add surface relief without per-window draw calls or textures.
function airportArchitecture(T,g){airportObstacles.length=0;
 const skin=soup(T),ground=soup(T),glass=[.18,.30,.34],metal=[.53,.58,.59],dark=[.29,.34,.35];
 function quad(o,a,b,c,d,col){o.tri(a,b,c,col);o.tri(a,c,d,col);}
 function box(x,y,z,w,h,d,col){const p=[[x-w/2,y,z-d/2],[x+w/2,y,z-d/2],[x+w/2,y+h,z-d/2],[x-w/2,y+h,z-d/2],[x-w/2,y,z+d/2],[x+w/2,y,z+d/2],[x+w/2,y+h,z+d/2],[x-w/2,y+h,z+d/2]];for(const f of[[0,3,2,1],[4,5,6,7],[0,4,7,3],[1,2,6,5],[3,7,6,2],[0,1,5,4]])quad(skin,...f.map(i=>p[i]),col);}
 function pad(x,z,w,d,y,col){quad(ground,[x-w/2,y,z-d/2],[x-w/2,y,z+d/2],[x+w/2,y,z+d/2],[x+w/2,y,z-d/2],col);}
 for(const b of terminals){
  const y=api.height(b.x,b.z)??24,top=y+b.h;
  pad(b.x,b.z,b.w+150,b.d+140,y+.12,[.34,.35,.33]);
  // Concrete expansion joints and parking-stand lead-in/t-stop marks.
  for(let x=-b.w/2-60;x<=b.w/2+60;x+=40)pad(b.x+x,b.z,.3,b.d+138,y+.15,[.28,.30,.29]);
  for(let z=-b.d/2-65;z<=b.d/2+65;z+=40)pad(b.x,b.z+z,b.w+148,.3,y+.15,[.28,.30,.29]);
  for(const side of[-1,1])for(let x=-b.w/2+35;x<b.w/2-20;x+=65){const z=b.z+side*(b.d/2+37);pad(b.x+x,z,.8,48,y+.19,[.79,.64,.24]);pad(b.x+x,z-side*17,12,.8,y+.20,[.79,.64,.24]);pad(b.x+x+23,z,1,35,y+.18,[.67,.68,.63]);}
  // Recessed glazing with structural mullions, opaque spandrels and roof fascia.
  for(const side of[-1,1]){
   box(b.x,y+4,b.z+side*(b.d/2+.13),b.w-4,b.h*.62,.3,glass);
   box(b.x,top-2,b.z+side*(b.d/2+.35),b.w+1,1.8,.6,metal);
   for(let x=-b.w/2+4;x<b.w/2;x+=12)box(b.x+x,y+3,b.z+side*(b.d/2+.4),.65,b.h*.7,.8,metal);
   box(b.x+side*(b.w/2+.13),y+4,b.z,.3,b.h*.62,b.d-4,glass);
   box(b.x+side*(b.w/2+.35),top-2,b.z,.6,1.8,b.d+1,metal);
   for(let z=-b.d/2+4;z<b.d/2;z+=12)box(b.x+side*(b.w/2+.4),y+3,b.z+z,.8,b.h*.7,.65,metal);
  }
  // Curved roof ribs follow the existing roof envelope; skylight bands and
  // rooftop plant stay inside the existing conservative collision volume.
  const roof=z=>top+.04*Math.sqrt(Math.max(0,b.d*b.d/4-z*z));
  for(let x=-b.w/2+8;x<b.w/2;x+=28)for(let i=0;i<14;i++){const z0=-b.d/2+i*b.d/14,z1=z0+b.d/14;quad(skin,[b.x+x-.45,roof(z0)+.18,b.z+z0],[b.x+x+.45,roof(z0)+.18,b.z+z0],[b.x+x+.45,roof(z1)+.18,b.z+z1],[b.x+x-.45,roof(z1)+.18,b.z+z1],metal);}
  for(let x=-b.w/2+28;x<b.w/2-20;x+=72){box(b.x+x,roof(0)+.15,b.z,14,.8,20,dark);for(const z of[-b.d*.25,b.d*.25])box(b.x+x,roof(z)+.25,b.z+z,10,.45,22,glass);}
 }
 for(const b of terminals){const y=api.height(b.x,b.z)??24;for(const side of[-1,1])for(let x=-b.w/2+38;x<b.w/2-25;x+=140){const px=b.x+x,pz=b.z+side*(b.d/2+18);
 box(px,y+4.8,pz,4.2,3.8,36,metal);box(px,y+5.2,pz,4.5,1.7,31,glass);box(px,y,pz+side*11,1.2,5,1.2,dark);box(px,y+4.5,pz+side*20,7,4.2,7,dark);
 airportObstacles.push({x:px,z:pz,y:y+4.8,w:4.5,d:36,h:3.8},{x:px,z:pz+side*20,y:y+4.5,w:7,d:7,h:4.2},{x:px,z:pz+side*11,y,w:1.2,d:1.2,h:5});
 const tx=px+16,tz=pz+side*25;airportObstacles.push({x:tx,z:tz,y:y+.2,w:3.5,d:5,h:3});box(tx,y+.6,tz,2.8,1.8,5,[.78,.77,.65]);box(tx,y+1.5,tz+1.5,2.2,1.7,1.8,glass);for(const dx of[-1.5,1.5])for(const dz of[-1.7,1.7])box(tx+dx,y+.2,tz+dz,.5,1.1,1.1,[.09,.10,.10]);}}
 const material=new T.MeshLambertMaterial({vertexColors:true,side:T.DoubleSide});
 for(const [name,o]of[['Heathrow terminal architecture',skin],['Heathrow aprons and stand markings',ground]]){const m=new T.Mesh(o.geometry(),material);m.name=name;g.add(m);}
}
api.buildAirport=function(T){const g=new T.Group(),o=soup(T);for(const a of api.runways){const strip=(u,v,l,w,c,y=a.elev+.18)=>{const p=(u,v)=>[a.x+a.ux*u+a.rx*v,y,a.z+a.uz*u+a.rz*v],v0=p(u-l/2,v-w/2),v1=p(u+l/2,v-w/2),v2=p(u+l/2,v+w/2),v3=p(u-l/2,v+w/2);o.tri(v0,v2,v1,c);o.tri(v0,v3,v2,c);};strip(0,0,a.rwyLen,50,[.17,.18,.18]);strip(0,0,a.rwyLen+60,72,[.26,.27,.25],a.elev+.05);for(let u=-a.rwyLen/2+180;u<a.rwyLen/2-180;u+=60)strip(u,0,30,.9,[.88,.88,.82],a.elev+.23);for(const s of[-1,1]){for(let j=-4;j<=4;j++)if(j)strip(s*(a.rwyLen/2-60),j*2.8,30,1.8,[.88,.88,.82],a.elev+.23);for(const v of[-10,10])strip(s*(a.rwyLen/2-420),v,45,5,[.88,.88,.82],a.elev+.23);}const inward=a.idx?-1:1;strip(0,inward*180,a.rwyLen-100,24,[.29,.29,.27],a.elev+.08);for(let u=-1500;u<=1500;u+=500)strip(u,inward*90,22,180,[.29,.29,.27],a.elev+.12);}g.add(new T.Mesh(o.geometry(),new T.MeshLambertMaterial({vertexColors:true,side:T.DoubleSide})));for(const b of terminals){const y=api.height(b.x,b.z)??24,m=new T.Mesh(new T.BoxGeometry(b.w,b.h,b.d),new T.MeshLambertMaterial({color:0x687675}));m.position.set(b.x,y+b.h/2,b.z);g.add(m);const roofGeo=new T.CylinderGeometry(b.d/2,b.d/2,b.w,14,1,false,0,Math.PI);roofGeo.rotateZ(Math.PI/2);const r=new T.Mesh(roofGeo,new T.MeshLambertMaterial({color:0x7d888b}));r.scale.y=.04;r.position.set(b.x,y+b.h,b.z);g.add(r);}airportArchitecture(T,g);const tower=new T.Mesh(new T.CylinderGeometry(5,9,70,8),new T.MeshLambertMaterial({color:0x888d8a}));tower.position.set(668,59,58);g.add(tower);const cab=new T.Mesh(new T.CylinderGeometry(14,11,8,10),new T.MeshLambertMaterial({color:0x4f737b}));cab.position.set(668,98,58);g.add(cab);const p=[];for(const a of api.runways)for(let u=-a.rwyLen/2;u<=a.rwyLen/2;u+=60)for(const s of[-1,1])p.push(a.x+a.ux*u+a.rx*s*27,a.elev+.55,a.z+a.uz*u+a.rz*s*27);const pg=new T.BufferGeometry();pg.setAttribute('position',new T.Float32BufferAttribute(p,3));g.add(new T.Points(pg,new T.PointsMaterial({color:0xffe8b2,size:2.4})));return g;};
})(typeof window==='undefined'?globalThis:window);
