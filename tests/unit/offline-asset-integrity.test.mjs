import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {gzipSync} from 'node:zlib';
import {spawnSync} from 'node:child_process';

async function fixture(){
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'lightning-offline-'));
 const files=['src/vendor/three-r128.min.js','src/rendering/mobile-policy.js','src/rendering/london-lighting.js','src/aircraft/detail.js','src/cockpit/detail.js','src/terrain/scenery.js','src/terrain/architecture.js','src/terrain/imagery.js','src/terrain/london.js','src/terrain/landmarks.js','src/simulator.js','src/ui/runtime.js','src/ui/base.css','src/ui/lightning.css'];
 for(const f of files){await fs.mkdir(path.dirname(path.join(root,f)),{recursive:true});await fs.writeFile(path.join(root,f),'');}
 await fs.mkdir(path.join(root,'scripts'),{recursive:true});
 for(const f of ['build-web.mjs','project-config.mjs'])await fs.copyFile('scripts/'+f,path.join(root,'scripts',f));
 for(const f of ['package.json','package-lock.json'])await fs.copyFile(f,path.join(root,f));
 await fs.writeFile(path.join(root,'src/index.template.html'),'<!-- LIGHTNING_STYLES --><!-- LIGHTNING_SCRIPTS -->');
 const pack=path.join(root,'scenery-packs/london');await fs.mkdir(pack,{recursive:true});
 const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jBScAAAAASUVORK5CYII=','base64');
 const assets={'data.json.gz':gzipSync('{}'),'ground.png':png,'water-mask.png':png,'NOTICE.txt':Buffer.from('Contains OS data'),'LICENSE-OGL-3.0.txt':Buffer.from('Open Government Licence v3.0')};
 const outputs={};for(const[name,data]of Object.entries(assets)){await fs.writeFile(path.join(pack,name),data);outputs[name]={bytes:data.length,sha256:createHash('sha256').update(data).digest('hex')};}
 await fs.writeFile(path.join(pack,'manifest.json'),JSON.stringify({outputs}));
 for(const dir of ['london-imagery','london-heights']){const dest=path.join(root,'scenery-packs',dir);await fs.mkdir(dest,{recursive:true});const values=dir==='london-imagery'?{'overview.jpg':png,'NOTICE.txt':Buffer.from('Copernicus')}:{'heights.json':Buffer.from('{}'),'NOTICE.txt':Buffer.from('Environment Agency')};const outputs={};for(const[n,b]of Object.entries(values)){await fs.writeFile(path.join(dest,n),b);outputs[n]={bytes:b.length,sha256:createHash('sha256').update(b).digest('hex')};}await fs.writeFile(path.join(dest,'manifest.json'),JSON.stringify({outputs,overview:{file:'overview.jpg'},tiles:[]}));}return{root,pack,run:()=>spawnSync(process.execPath,[path.join(root,'scripts/build-web.mjs')],{encoding:'utf8'})};
}
test('offline bundler refuses a truncated water mask before writing a distributable',async()=>{
 const f=await fixture();try{await fs.writeFile(path.join(f.pack,'water-mask.png'),'');const r=f.run();assert.notEqual(r.status,0,'corrupt mask was silently bundled');assert.match(r.stderr,/water-mask\.png.*integrity/);await assert.rejects(fs.stat(path.join(f.root,'dist/index.html')));}finally{await fs.rm(f.root,{recursive:true,force:true});}
});
test('verified offline assets produce byte-identical repeated browser builds',async()=>{
 const f=await fixture();try{assert.equal(f.run().status,0);const a=await fs.readFile(path.join(f.root,'dist/Lightning-F35B.html'));assert.equal(f.run().status,0);assert.deepEqual(await fs.readFile(path.join(f.root,'dist/Lightning-F35B.html')),a);}finally{await fs.rm(f.root,{recursive:true,force:true});}
});
