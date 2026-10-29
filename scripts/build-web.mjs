import fs from 'node:fs/promises';
import {gunzipSync} from 'node:zlib';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {loadProjectConfig} from './project-config.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=f=>fs.readFile(path.join(root,f),'utf8');
const project=loadProjectConfig(root);
// Verify and retain the exact bytes that will be embedded. Never silently ship
// an interrupted/truncated texture or a pack that differs from its manifest.
const packPath=path.join(root,'scenery-packs/london');
const packManifest=JSON.parse(await fs.readFile(path.join(packPath,'manifest.json'),'utf8'));
const assets=new Map();
for(const name of ['data.json.gz','ground.png','water-mask.png','NOTICE.txt','LICENSE-OGL-3.0.txt']){
 const bytes=await fs.readFile(path.join(packPath,name)),entry=packManifest.outputs?.[name];
 if(!entry||!Number.isSafeInteger(entry.bytes)||entry.bytes<=0||bytes.length!==entry.bytes||createHash('sha256').update(bytes).digest('hex')!==entry.sha256)throw Error(`${name}: scenery integrity check failed; rebuild the licensed pack`);
 assets.set(name,bytes);
}
async function verifiedPack(folder){
 const dir=path.join(root,'scenery-packs',folder),manifest=JSON.parse(await fs.readFile(path.join(dir,'manifest.json'),'utf8')),bytes=new Map();
 for(const[name,pin]of Object.entries(manifest.outputs||{})){
  if(path.basename(name)!==name)throw Error('Unsafe asset path');
  const b=await fs.readFile(path.join(dir,name));
  if(b.length!==pin.bytes||createHash('sha256').update(b).digest('hex')!==pin.sha256)throw Error(`${folder}/${name}: scenery integrity check failed`);bytes.set(name,b);
 }return{manifest,bytes};
}
const imagery=await verifiedPack('london-imagery'),heights=await verifiedPack('london-heights');
const photoAssets=Object.fromEntries([...imagery.bytes].filter(([n])=>/\.jpg$/.test(n)).map(([n,b])=>[n,'data:image/jpeg;base64,'+b.toString('base64')]));
const heightBytes=heights.bytes.get('heights.json.gz');const measured=JSON.parse((heightBytes?gunzipSync(heightBytes):heights.bytes.get('heights.json')).toString('utf8'));
if(heights.manifest.inputSha256&&heights.manifest.inputSha256!==packManifest.outputs['data.json.gz'].sha256)throw Error('LiDAR heights use different source footprints');
const template=await read('src/index.template.html');let html=template;
const cssPaths=['src/ui/base.css','src/ui/lightning.css'],cssSources=await Promise.all(cssPaths.map(read));const css=cssSources.join('\n');
const paths=['src/vendor/three-r128.min.js','src/rendering/mobile-policy.js','src/rendering/london-lighting.js','src/aircraft/detail.js','src/cockpit/detail.js','src/terrain/scenery.js','src/terrain/architecture.js','src/terrain/imagery.js','src/terrain/london.js','src/terrain/landmarks.js','src/simulator.js','src/ui/runtime.js'];
const js=await Promise.all(paths.map(read));
// Keep simulator and runtime integration in one parser task: no animation frame
// can run between scheduling the simulator loop and defining its UI hooks.
const buildMetadata=`Object.defineProperty(globalThis, '__LIGHTNING_BUILD__', {value:Object.freeze(${JSON.stringify(project)})});\n`;
const scenery=gunzipSync(assets.get('data.json.gz')).toString('utf8');
const extras='globalThis.__LONDON_IMAGERY__='+JSON.stringify({manifest:imagery.manifest,assets:photoAssets})+';globalThis.__LONDON_HEIGHTS__='+JSON.stringify(measured)+';globalThis.__LIGHTNING_SCENERY__='+JSON.stringify({imagery:imagery.manifest.id,heights:heights.manifest})+';';
const geo=extras+'globalThis.__LONDON_DATA__='+scenery+';globalThis.__LONDON_GROUND__='+JSON.stringify('data:image/jpeg;base64,'+imagery.bytes.get(imagery.manifest.overview.file).toString('base64'))+';globalThis.__LONDON_MASK__='+JSON.stringify('data:image/png;base64,'+assets.get('water-mask.png').toString('base64'))+';';
const scriptSources=[buildMetadata+js[0],geo,...js.slice(1,-2),js.slice(-2).join('\n')];
const ogl=assets.get('LICENSE-OGL-3.0.txt').toString('utf8')+'\n'+imagery.bytes.get('NOTICE.txt').toString('utf8')+'\n'+heights.bytes.get('NOTICE.txt').toString('utf8');html=html.replace('Not for real navigation.</details>',()=> 'Not for real navigation.<pre style="white-space:pre-wrap">'+ogl.replace(/&/g,'&amp;').replace(/</g,'&lt;')+'</pre></details>');
html=html.replace('<!-- LIGHTNING_STYLES -->',()=>'<style>\n'+css+'\n</style>').replace('<!-- LIGHTNING_SCRIPTS -->',()=>scriptSources.map(s=>'<script>\n'+s.replace(/<\/script/gi,'<\\/script')+'\n</script>').join('\n'));
if(/<(script|link)[^>]+(?:src|href)=/i.test(html))throw Error('Offline package cannot reference external scripts/styles');
await fs.mkdir(path.join(root,'dist'),{recursive:true});
await fs.writeFile(path.join(root,'dist/index.html'),html);await fs.writeFile(path.join(root,'dist/Lightning-F35B.html'),html);
const data=Buffer.from(html);const hash=createHash('sha256').update(data).digest('hex');
await fs.writeFile(path.join(root,'dist/build-manifest.json'),JSON.stringify({version:project.version,versionCode:project.versionCode,sha256:hash,bytes:data.length,offline:true,renderer:'Three.js r128',sources:paths,sourceHashes:Object.fromEntries([...paths.map((p,i)=>[p,js[i]]),...cssPaths.map((p,i)=>[p,cssSources[i]]),['src/index.template.html',template]].map(([p,bytes])=>[p,createHash('sha256').update(bytes).digest('hex')])),scenery:{imagery:imagery.manifest,heights:heights.manifest}},null,2));
// Standard-library ZIP writer: stored method, no network or hidden build dependencies.
const crc32=b=>{let c=0xffffffff;for(const v of b){c^=v;for(let k=0;k<8;k++)c=(c>>>1)^((c&1)?0xedb88320:0);}return(c^0xffffffff)>>>0;};
const name=Buffer.from('Lightning-F35B.html'),crc=crc32(data),header=Buffer.alloc(30),central=Buffer.alloc(46),end=Buffer.alloc(22);
header.writeUInt32LE(0x04034b50);header.writeUInt16LE(20,4);header.writeUInt32LE(crc,14);header.writeUInt32LE(data.length,18);header.writeUInt32LE(data.length,22);header.writeUInt16LE(name.length,26);
central.writeUInt32LE(0x02014b50);central.writeUInt16LE(20,4);central.writeUInt16LE(20,6);central.writeUInt32LE(crc,16);central.writeUInt32LE(data.length,20);central.writeUInt32LE(data.length,24);central.writeUInt16LE(name.length,28);
end.writeUInt32LE(0x06054b50);end.writeUInt16LE(1,8);end.writeUInt16LE(1,10);end.writeUInt32LE(central.length+name.length,12);end.writeUInt32LE(header.length+name.length+data.length,16);
await fs.writeFile(path.join(root,'dist/Lightning-F35B-Web.zip'),Buffer.concat([header,name,data,central,name,end]));
console.log(`Built offline simulator: ${data.length} bytes, SHA256 ${hash}`);
