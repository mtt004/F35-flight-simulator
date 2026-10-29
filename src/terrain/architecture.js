/* Original London material atlas. Classes are architectural interpretations,
 * not claims of building-use surveys. Physical texture scale survives LOD. */
(function(root){'use strict';
 const api=root.LightningArchitecture={};
 const classes=['terrace','suburban','commercial','glass','historic','industrial','residential-tower','civic'];
 api.classes=Object.freeze(classes);
 api.classify=function(b){const xs=b.p.map(p=>p[0]),zs=b.p.map(p=>p[1]),w=Math.max(...xs)-Math.min(...xs),d=Math.max(...zs)-Math.min(...zs),area=w*d,h=b.h;
  if(h>65)return 3;if(h>34)return 6;if(h<18&&area>5000)return 5;if(h<15&&Math.min(w,d)<18&&Math.max(w,d)>20)return 0;if(h<15)return 1;if(area>2400)return 2;return 4;
 };
 function atlas(T){
  const c=document.createElement('canvas');c.width=c.height=1024;const g=c.getContext('2d');
  const rough=document.createElement('canvas');rough.width=rough.height=1024;const r=rough.getContext('2d');
  const brick=['#98705c','#a48066','#b9b5a6','#697d87','#b8b0a0','#8a8b80','#a59b89','#c7c0ad'];
  let seed=7441;const random=()=>((seed=Math.imul(seed,1664525)+1013904223|0)>>>0)/4294967296;
  for(let style=0;style<16;style++){
   const x=(style%4)*256,y=Math.floor(style/4)*256,roof=style>=8,k=style%8;
   g.save();g.beginPath();g.rect(x,y,256,256);g.clip();g.fillStyle=roof?(k===0||k===1?'#57595b':'#777c7b'):brick[k];g.fillRect(x,y,256,256);
   r.fillStyle=k===3&&!roof?'#4b4b4b':'#dadada';r.fillRect(x,y,256,256);
   if(roof){for(let row=0;row<24;row++){g.fillStyle=row%2?'#636867':'#858783';g.fillRect(x,y+row*11,256,1);for(let col=0;col<12;col++){g.fillStyle='rgba(20,25,28,.15)';g.fillRect(x+col*24+(row%2)*12,y+row*11,1,11);}}}
   else{
    const bh=k===0||k===1?5:k===5?16:24,bw=k===0||k===1?12:48;
    for(let row=0;row<256/bh;row++)for(let col=-1;col<256/bw;col++){const bx=x+col*bw+(row%2)*bw/2,by=y+row*bh;g.fillStyle='rgba(35,30,25,.19)';g.fillRect(bx,by,bw,1);g.fillRect(bx,by,1,bh);g.fillStyle='rgba(255,245,225,'+(random()*.09)+')';g.fillRect(bx+1,by+1,bw-2,bh-2);}
    const floor=64,step=k===3?32:k===5?85:64;
    for(let fy=8;fy<256;fy+=floor)for(let fx=10;fx<256;fx+=step){
     const ww=k===3?29:k===5?54:28,hh=k===3?58:k===5?22:39;
     g.fillStyle='rgba(30,27,24,.24)';g.fillRect(x+fx-3,y+fy-2,ww+6,hh+7);
     g.fillStyle=k===3?'#a8b4b7':'#c7c1ae';g.fillRect(x+fx-2,y+fy-2,ww+4,hh+4);
     const grad=g.createLinearGradient(0,y+fy,0,y+fy+hh);grad.addColorStop(0,k===3?'#8ba7b6':'#536d7b');grad.addColorStop(.5,k===3?'#7593a4':'#738b93');grad.addColorStop(1,k===3?'#a3b7ba':'#263a43');g.fillStyle=grad;g.fillRect(x+fx,y+fy,ww,hh);
     g.fillStyle=k===3?'#c1cbca':'#d4cfbc';g.fillRect(x+fx+ww*.48,y+fy,1,hh);if(k!==3)g.fillRect(x+fx,y+fy+hh*.42,ww,1);
     r.fillStyle=k===3?'#494949':'#777777';r.fillRect(x+fx,y+fy,ww,hh);
     if(k===0||k===4){g.fillStyle='#d1c5ae';g.fillRect(x+fx-3,y+fy+hh+1,ww+6,3);}
    }
   }
   for(let i=0;i<2200;i++){g.fillStyle=random()>.5?'rgba(250,246,230,.045)':'rgba(20,21,19,.045)';g.fillRect(x+random()*256,y+random()*256,2,2);}
   g.restore();
  }
  const map=new T.CanvasTexture(c),roughness=new T.CanvasTexture(rough);map.encoding=T.sRGBEncoding;
  // Atlas row indices follow canvas coordinates, with row zero at the top.
  for(const t of[map,roughness]){t.flipY=false;t.minFilter=T.LinearMipmapLinearFilter;t.magFilter=T.LinearFilter;t.anisotropy=4;}
  return{map,roughness};
 }
 api.material=function(T){
  const a=atlas(T),m=new T.MeshStandardMaterial({vertexColors:true,map:a.map,roughnessMap:a.roughness,roughness:.9,metalness:.06,side:T.DoubleSide});
  m.userData.ownedTextures=[a.map,a.roughness];m.userData.night=0;m.userData.sun=new T.Vector3(.5,.7,.5);
  m.onBeforeCompile=s=>{
   s.uniforms.archNight={value:m.userData.night};s.uniforms.archSun={value:m.userData.sun};m.userData.shader=s;
   s.vertexShader='attribute float architecture;varying float vArchitecture;varying vec3 vArchPos,vArchNormal;\n'+s.vertexShader;
   s.vertexShader=s.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvArchitecture=architecture;vArchPos=position;vArchNormal=normal;');
   s.fragmentShader='varying float vArchitecture;varying vec3 vArchPos,vArchNormal;uniform float archNight;uniform vec3 archSun;\n'+s.fragmentShader;
   s.fragmentShader=s.fragmentShader.replace('#include <map_fragment>',`float ac=floor(vArchitecture+.1);vec2 au=(vec2(mod(ac,4.),floor(ac/4.))*256.+vec2(3.)+fract(vUv)*250.)/1024.;
vec4 sampledDiffuseColor=mapTexelToLinear(texture2D(map,au));diffuseColor*=sampledDiffuseColor;`);
   s.fragmentShader=s.fragmentShader.replace('#include <roughnessmap_fragment>','float roughnessFactor=roughness*texture2D(roughnessMap,au).g;');
   s.fragmentShader=s.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
float roof=step(7.5,vArchitecture);float foot=mix(.68,1.,smoothstep(0.,.25,vUv.y));diffuseColor.rgb*=mix(foot,1.,roof);`);
   s.fragmentShader=s.fragmentShader.replace('#include <emissivemap_fragment>',`#include <emissivemap_fragment>
vec2 cell=fract(vUv*vec2(4.,4.));float pane=step(.20,cell.x)*step(cell.x,.63)*step(.16,cell.y)*step(cell.y,.71);float occupied=step(.56,fract(sin(dot(floor(vUv*4.)+floor(vArchPos.xz*.02),vec2(12.9898,78.233)))*43758.545));totalEmissiveRadiance+=vec3(.72,.42,.16)*pane*occupied*archNight*(1.-step(7.5,vArchitecture));`);
  };return m;
 };
 api.landmarkMaterial=api.material;
 api.update=function(m,night,sun){m.userData.night=night;m.envMapIntensity=.08+.92*(1-night);if(sun)m.userData.sun.copy(sun);if(m.userData.shader)m.userData.shader.uniforms.archNight.value=night;};
})(typeof window==='undefined'?globalThis:window);
