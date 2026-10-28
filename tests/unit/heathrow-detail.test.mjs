import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const c=vm.createContext({console});c.window=c;
vm.runInContext(fs.readFileSync('src/vendor/three-r128.min.js','utf8'),c);
vm.runInContext(fs.readFileSync('src/terrain/london.js','utf8'),c);
const a=c.LightningLondon,T=c.THREE;
a.load({terrain:{x:-10000,z:-10000,step:100000,nx:2,nz:2,values:[24,24,24,24]},surfaces:[],roads:[],buildings:[]});
test('Heathrow terminals have merged facade, roof and apron detail within a mobile geometry budget',()=>{
 const g=a.buildAirport(T),m=g.getObjectByName('Heathrow terminal architecture');
 assert.ok(m,'terminal architecture is missing');
 assert.ok(m.geometry.attributes.position.count/3>1000,'terminal skin has no architectural detail');
 assert.ok(m.geometry.attributes.position.count/3<15000,'terminal skin exceeds triangle budget');
 const colors=m.geometry.attributes.color.array;
 const materials=new Set();for(let i=0;i<colors.length;i+=3)materials.add(Array.from(colors.slice(i,i+3),v=>v.toFixed(2)).join(','));
 assert.ok(materials.size>=3,'glazing, structural metal and rooftop plant need distinct materials');
 assert.ok([...m.geometry.attributes.position.array].every(Number.isFinite));
 m.geometry.computeBoundingBox();assert.ok(m.geometry.boundingBox.min.y>=24);
 // The largest curved roof is the 22 m terminal with a 13 m crest.
 // Plant must fit its existing height + 14 m collision ceiling.
 assert.ok(m.geometry.boundingBox.max.y<=24+22+14);
 const apron=g.getObjectByName('Heathrow aprons and stand markings');assert.ok(apron);
 assert.ok(apron.geometry.attributes.position.count>200);
 assert.ok([...apron.geometry.attributes.position.array].every(Number.isFinite));
 let draws=0;g.traverse(o=>{if(o.isMesh||o.isPoints)draws++;});assert.ok(draws<=17,'airport detail must remain batched');
});
