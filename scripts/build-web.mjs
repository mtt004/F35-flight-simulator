import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=f=>fs.readFile(path.join(root,f),'utf8');
let html=await read('src/index.template.html');
const css=await read('src/ui/base.css')+'\n'+await read('src/ui/lightning.css');
const paths=['src/vendor/three-r128.min.js','src/rendering/mobile-policy.js','src/aircraft/detail.js','src/cockpit/detail.js','src/terrain/scenery.js','src/simulator.js','src/ui/runtime.js'];
const js=await Promise.all(paths.map(read));
// Keep simulator and runtime integration in one parser task: no animation frame
// can run between scheduling the simulator loop and defining its UI hooks.
const scriptSources=[...js.slice(0,-2),js.slice(-2).join('\n')];
html=html.replace('<!-- LIGHTNING_STYLES -->',()=>'<style>\n'+css+'\n</style>').replace('<!-- LIGHTNING_SCRIPTS -->',()=>scriptSources.map(s=>'<script>\n'+s.replace(/<\/script/gi,'<\\/script')+'\n</script>').join('\n'));
if(/<(script|link)[^>]+(?:src|href)=/i.test(html))throw Error('Offline package cannot reference external scripts/styles');
await fs.mkdir(path.join(root,'dist'),{recursive:true});
await fs.writeFile(path.join(root,'dist/index.html'),html);await fs.writeFile(path.join(root,'dist/Lightning-F35B.html'),html);
const data=Buffer.from(html);const hash=createHash('sha256').update(data).digest('hex');
await fs.writeFile(path.join(root,'dist/build-manifest.json'),JSON.stringify({version:'0.1.0-experimental',sha256:hash,bytes:data.length,offline:true,renderer:'Three.js r128',sources:paths},null,2));
// Standard-library ZIP writer: stored method, no network or hidden build dependencies.
const crc32=b=>{let c=0xffffffff;for(const v of b){c^=v;for(let k=0;k<8;k++)c=(c>>>1)^((c&1)?0xedb88320:0);}return(c^0xffffffff)>>>0;};
const name=Buffer.from('Lightning-F35B.html'),crc=crc32(data),header=Buffer.alloc(30),central=Buffer.alloc(46),end=Buffer.alloc(22);
header.writeUInt32LE(0x04034b50);header.writeUInt16LE(20,4);header.writeUInt32LE(crc,14);header.writeUInt32LE(data.length,18);header.writeUInt32LE(data.length,22);header.writeUInt16LE(name.length,26);
central.writeUInt32LE(0x02014b50);central.writeUInt16LE(20,4);central.writeUInt16LE(20,6);central.writeUInt32LE(crc,16);central.writeUInt32LE(data.length,20);central.writeUInt32LE(data.length,24);central.writeUInt16LE(name.length,28);
end.writeUInt32LE(0x06054b50);end.writeUInt16LE(1,8);end.writeUInt16LE(1,10);end.writeUInt32LE(central.length+name.length,12);end.writeUInt32LE(header.length+name.length+data.length,16);
await fs.writeFile(path.join(root,'dist/Lightning-F35B-Web.zip'),Buffer.concat([header,name,data,central,name,end]));
console.log(`Built offline simulator: ${data.length} bytes, SHA256 ${hash}`);
