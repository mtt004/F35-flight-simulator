/* A bounded local sun-shadow map and common colour pipeline for r128. */
(function(root){'use strict';const api=root.LightningLondonLighting={};let next=0,enabled=false;
 api.environment=function(T,renderer,scene){
  scene.userData.londonEnvironment?.dispose();const images=[];
  for(let face=0;face<6;face++){const c=document.createElement('canvas');c.width=c.height=32;const g=c.getContext('2d'),v=g.createLinearGradient(0,0,0,32);v.addColorStop(0,face===3?'#5f655a':'#7aaccb');v.addColorStop(.55,'#c2d1d2');v.addColorStop(1,'#646c61');g.fillStyle=v;g.fillRect(0,0,32,32);images.push(c);}
  const cube=new T.CubeTexture(images);cube.encoding=T.sRGBEncoding;cube.needsUpdate=true;const pmrem=new T.PMREMGenerator(renderer),target=pmrem.fromCubemap(cube);scene.environment=target.texture;pmrem.dispose();cube.dispose();scene.userData.londonEnvironment=target;
 };
 api.terrain=function(T,m){
  Object.assign(m.uniforms,T.UniformsUtils.clone(T.UniformsLib.lights));m.lights=true;
  m.vertexShader='#include <common>\n#include <shadowmap_pars_vertex>\n'+m.vertexShader;
  m.vertexShader=m.vertexShader.replace('gl_Position=projectionMatrix*viewMatrix*w;',`vec3 transformedNormal=normalMatrix*normal;vec4 worldPosition=w;
#include <shadowmap_vertex>
gl_Position=projectionMatrix*viewMatrix*w;`);
  m.fragmentShader='#include <common>\n#include <packing>\n#include <bsdfs>\n#include <lights_pars_begin>\n#include <shadowmap_pars_fragment>\n#include <shadowmask_pars_fragment>\n'+m.fragmentShader;
  m.fragmentShader=m.fragmentShader.replace('float hemi=.36+.24*n.y;', 'diff*=getShadowMask();float hemi=.33+.23*n.y;');
 };
 api.update=function(T,renderer,scene,sun,dir,pos,ground,quality,day,time,isLondon){
  const active=isLondon&&quality>0&&day>.08&&pos.y-ground<1800;
  // r128 observes the changed shadow-light count through lightsStateVersion and
  // selects its cached program variant. Invalidating every scene material here
  // needlessly revalidates unrelated materials, including shared ones repeatedly.
  if(enabled!==active){enabled=active;renderer.shadowMap.enabled=active;sun.castShadow=active;}
  renderer.shadowMap.type=T.PCFSoftShadowMap;renderer.shadowMap.autoUpdate=false;
  if(!active){sun.target.position.set(0,0,0);sun.target.updateMatrixWorld();sun.position.copy(dir).multiplyScalar(1000);return;}
  if(time>=next||time<next-2){next=time+.25;const span=quality>1?1100:750,step=span*2/1024;
   const x=Math.round(pos.x/step)*step,z=Math.round(pos.z/step)*step;
   sun.target.position.set(x,ground,z);sun.target.updateMatrixWorld();
   const c=sun.shadow.camera;c.left=c.bottom=-span;c.right=c.top=span;c.near=1;c.far=5000;c.updateProjectionMatrix();sun.shadow.mapSize.set(1024,1024);sun.shadow.bias=-.0003;sun.shadow.normalBias=1.2;renderer.shadowMap.needsUpdate=true;
  }
  sun.position.copy(sun.target.position).addScaledVector(dir,2200);
  scene.getObjectByName('LondonLandmarks')?.traverse(o=>{if(o.material&&root.LightningArchitecture)root.LightningArchitecture.update(o.material,1-day,dir);});
 };
 api.stats=()=>({shadows:enabled,mapSize:enabled?1024:0,updateHz:enabled?4:0});
})(typeof window==='undefined'?globalThis:window);
