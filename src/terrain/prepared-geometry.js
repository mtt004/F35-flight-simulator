/* Exact offline Float32 geometry. Compressed tiles remain encoded until needed;
 * one native gzip stream runs at a time and decoded buffers have one owner. */
(function(root){'use strict';
 const api=root.LightningPreparedGeometry={};
 const variant=lod=>lod===2?2:0,required={position:3,color:3,uv:2,architecture:1,normal:3};
 let T,pack,enabled=false,active=null,queue=[],decoded=0,failures=0,cancelled=0,peakDecodeBytes=0;
 const cancellation=()=>new Error('Cancelled prepared geometry request');
 function validTile(tile){
  if(!tile||!Number.isSafeInteger(tile.bytes)||tile.bytes<=0||tile.bytes>16*1024*1024||!Number.isSafeInteger(tile.vertices)||tile.vertices<=0||!Array.isArray(tile.attributes)||tile.attributes.length!==5)return false;
  let offset=0;const names=new Set();
  for(const a of tile.attributes){if(required[a.name]!==a.itemSize||names.has(a.name)||a.offset!==offset||a.length!==tile.vertices*a.itemSize)return false;names.add(a.name);offset+=a.length*4;}
  const vec=a=>Array.isArray(a)&&a.length===3&&a.every(Number.isFinite);
  return offset===tile.bytes&&vec(tile.box?.min)&&vec(tile.box?.max)&&vec(tile.sphere?.center)&&Number.isFinite(tile.sphere.radius)&&tile.sphere.radius>=0;
 }
 api.reset=function(){
  if(active&&!active.cancelled){active.cancelled=true;cancelled++;}
  const abandoned=queue;queue=[];for(const task of abandoned){task.cancelled=true;cancelled++;task.reject(cancellation());}
 };
 api.configure=function(three,source){
  api.reset();T=three;pack=source;
  enabled=!!(T&&source?.manifest?.schemaVersion===1&&source.manifest.generator==='three-r128-exact-v1'&&source.manifest.tiles&&source.assets&&typeof root.DecompressionStream==='function'&&typeof root.Blob==='function'&&typeof root.Response==='function'&&typeof root.atob==='function');
  return enabled;
 };
 api.has=function(key,lod){const tile=pack?.manifest?.tiles?.[key+':'+variant(lod)];return !!(enabled&&validTile(tile)&&typeof pack.assets[tile.file]==='string');};
 async function decode(task){
  const tile=task.tile,binary=root.atob(task.encoded),bytes=new Uint8Array(binary.length);
  for(let i=0;i<binary.length;i++)bytes[i]=binary.charCodeAt(i);
  const stream=new root.Blob([bytes]).stream().pipeThrough(new root.DecompressionStream('gzip'));
  const raw=await new root.Response(stream).arrayBuffer();
  if(task.cancelled)throw cancellation();
  if(raw.byteLength!==tile.bytes)throw new Error('Prepared geometry byte length differs from its manifest');
  peakDecodeBytes=Math.max(peakDecodeBytes,raw.byteLength);
  const g=new task.T.BufferGeometry();
  for(const a of tile.attributes)g.setAttribute(a.name,new task.T.BufferAttribute(new Float32Array(raw,a.offset,a.length),a.itemSize));
  g.boundingBox=new task.T.Box3(new task.T.Vector3(...tile.box.min),new task.T.Vector3(...tile.box.max));
  g.boundingSphere=new task.T.Sphere(new task.T.Vector3(...tile.sphere.center),tile.sphere.radius);
  return g;
 }
 function pump(){
  if(active||!queue.length)return;
  const task=active=queue.shift();
  // Clear the decoder slot before resolving: a completed geometry belongs only
  // to its requester. No decoded geometry or attribute cache is retained here.
  decode(task).then(g=>{active=null;if(task.cancelled){g.dispose();task.reject(cancellation());}else{decoded++;task.resolve(g);}pump();},error=>{active=null;if(!task.cancelled)failures++;task.reject(error);pump();});
 }
 api.request=function(key,lod){
  let task;
  const promise=new Promise((resolve,reject)=>{
   if(!api.has(key,lod)){reject(new Error('Prepared geometry unavailable'));return;}
   if(queue.length>=2){reject(new Error('Prepared geometry decode queue is full'));return;}
   const tile=pack.manifest.tiles[key+':'+variant(lod)];
   task={T,tile,encoded:pack.assets[tile.file],resolve,reject,cancelled:false};queue.push(task);pump();
  });
  return{promise,cancel(){if(!task||task.cancelled)return;task.cancelled=true;cancelled++;const i=queue.indexOf(task);if(i>=0){queue.splice(i,1);task.reject(cancellation());}}};
 };
 api.stats=()=>({supported:enabled,active:active?1:0,queued:queue.length,decoded,failures,cancelled,peakDecodeBytes,decodedCacheBytes:0});
})(typeof window==='undefined'?globalThis:window);
