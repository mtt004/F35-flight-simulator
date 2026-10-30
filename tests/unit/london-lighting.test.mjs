import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

// Real r128 shader sources and scene objects, without pretending to compile GLSL.
function context(){
 const noop=()=>{},gradient={addColorStop:noop};
 const ctx=new Proxy({createLinearGradient:()=>gradient},{get:(o,k)=>o[k]||noop,set:(o,k,v)=>(o[k]=v,true)});
 const c=vm.createContext({console,document:{createElement:()=>({getContext:()=>ctx})}});c.window=c;
 for(const p of ['src/vendor/three-r128.min.js','src/terrain/architecture.js','src/rendering/london-lighting.js'])vm.runInContext(fs.readFileSync(p,'utf8'),c);
 return c;
}

test('architecture retains the r128 roughness declaration before physical lighting',()=>{
 const c=context(),T=c.THREE,m=c.LightningArchitecture.material(T);
 const s={uniforms:{},vertexShader:T.ShaderLib.standard.vertexShader,fragmentShader:T.ShaderLib.standard.fragmentShader};
 m.onBeforeCompile(s);
 assert.match(s.fragmentShader,/float roughnessFactor\s*=/);
 assert.ok(s.fragmentShader.indexOf('float roughnessFactor')<s.fragmentShader.indexOf('#include <lights_physical_fragment>'));
 assert.equal(m.map.flipY,false);assert.equal(m.roughnessMap.flipY,false);
 c.LightningArchitecture.update(m,1);
 assert.equal(s.uniforms.archNight.value,1);assert.ok(m.envMapIntensity<.2);
});

test('terrain includes r128 light helper definitions and shadow uniforms',()=>{
 const c=context(),T=c.THREE,m=new T.ShaderMaterial({
  vertexShader:'void main(){vec4 w=modelMatrix*vec4(position,1.);gl_Position=projectionMatrix*viewMatrix*w;}',
  fragmentShader:'void main(){float diff=1.;vec3 n=vec3(0.,1.,0.);float hemi=.36+.24*n.y;gl_FragColor=vec4(diff+hemi);}'
 });
 c.LightningLondonLighting.terrain(T,m);
 assert.equal(m.lights,true);assert.ok(m.uniforms.directionalShadowMap);
 assert.ok(m.fragmentShader.indexOf('#include <bsdfs>')<m.fragmentShader.indexOf('#include <lights_pars_begin>'));
 assert.match(m.fragmentShader,/getShadowMask\(\)/);assert.match(m.vertexShader,/#include <shadowmap_vertex>/);
});

test('sun direction stays correct between throttled updates at central London coordinates',()=>{
 const c=context(),T=c.THREE,r={shadowMap:{}},scene=new T.Scene(),sun=new T.DirectionalLight();
 const dir=new T.Vector3(.4,.8,.2).normalize(),pos=new T.Vector3(25000,200,-4000);
 c.LightningLondonLighting.update(T,r,scene,sun,dir,pos,10,1,1,0,true);
 sun.position.copy(dir).multiplyScalar(1000);r.shadowMap.needsUpdate=false;
 c.LightningLondonLighting.update(T,r,scene,sun,dir,pos,10,1,1,1/60,true);
 assert.ok(sun.position.clone().sub(sun.target.position).normalize().distanceTo(dir)<1e-8);
 assert.equal(r.shadowMap.needsUpdate,false,'unchanged shadow map stays throttled');
 assert.equal(sun.shadow.mapSize.x,1024);assert.equal(sun.shadow.camera.right,750);
});

test('disabling London shadows resets the directional-light target',()=>{
 const c=context(),T=c.THREE,r={shadowMap:{}},scene=new T.Scene(),sun=new T.DirectionalLight();
 const dir=new T.Vector3(.4,.8,.2).normalize(),pos=new T.Vector3(25000,200,-4000);
 c.LightningLondonLighting.update(T,r,scene,sun,dir,pos,10,1,1,0,true);
 c.LightningLondonLighting.update(T,r,scene,sun,dir,pos,10,0,1,1/60,true);
 assert.equal(r.shadowMap.enabled,false);assert.equal(sun.castShadow,false);
 assert.equal(sun.target.position.length(),0);
 assert.ok(sun.position.clone().sub(sun.target.position).normalize().distanceTo(dir)<1e-8);
});

test('shadow activation never invalidates unrelated or shared material versions',()=>{
 const c=context(),T=c.THREE,r={shadowMap:{}},scene=new T.Scene(),sun=new T.DirectionalLight();
 const basic=new T.MeshBasicMaterial(),lit=new T.MeshStandardMaterial();
 scene.add(new T.Mesh(new T.BoxGeometry(),basic),new T.Mesh(new T.BoxGeometry(),[lit,basic]));
 const before=[basic.version,lit.version],dir=new T.Vector3(.4,.8,.2).normalize(),pos=new T.Vector3(25000,200,-4000);
 for(const [quality,day,time] of [[1,1,0],[0,1,.1],[1,1,.2],[1,0,.3],[1,1,.4]]){
  c.LightningLondonLighting.update(T,r,scene,sun,dir,pos,10,quality,day,time,true);
  assert.deepEqual([basic.version,lit.version],before);
  assert.equal(r.shadowMap.enabled,quality>0&&day>.08);
 }
});
