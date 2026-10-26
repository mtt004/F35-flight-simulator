/* Authored procedural materials; regional presets are colour studies, not geodata. */
(function(root){
 'use strict';
 const api=root.LightningScenery={};let asphalt,markMat,glassMat,hangarMat,box;
 api.palettes={AUTO:null,HAMPSHIRE:['#6b7a4a','#a0a071','#485f42'],CAPPADOCIA:['#aa896b','#ceb28a','#96725c']};
 api.init=function(T,material){
  material.uniforms.uPalette={value:0};material.uniforms.uP0={value:new T.Color()};material.uniforms.uP1={value:new T.Color()};material.uniforms.uP2={value:new T.Color()};material.uniforms.uOrigin={value:new T.Vector2()};
  material.fragmentShader=material.fragmentShader.replace('uniform vec3 uSun,uFog;', 'uniform vec3 uSun,uFog,uP0,uP1,uP2;uniform vec2 uOrigin;uniform float uPalette;');
  material.fragmentShader=material.fragmentShader.replace('vec2 q=vW.xz+', 'vec2 globalXZ=vW.xz+uOrigin;vec2 q=globalXZ+');
  material.fragmentShader=material.fragmentShader.replace('float diff=max(dot(n,l),0.);',`float field=h21(floor((globalXZ+vec2(490.,170.))/420.));float meadow=smoothstep(.18,.76,field);vec3 regional=mix(uP0,uP1,meadow);regional=mix(regional,uP2,smoothstep(.18,.65,slope));col=mix(col,regional*(.9+macro*.16),uPalette*smoothstep(2.,20.,vW.y));
  float strata=.5+.5*sin(vW.y*.21+sin(globalXZ.x*.001)*2.);col*=1.-strata*.085*smoothstep(.30,.75,slope);
  float diff=max(dot(n,l),0.);`);
  const c=document.createElement('canvas');c.width=c.height=128;const x=c.getContext('2d');x.fillStyle='#47494a';x.fillRect(0,0,128,128);let seed=17;for(let i=0;i<2600;i++){seed=(Math.imul(seed,1664525)+1013904223)|0;const px=(seed>>>0)%128;seed=(Math.imul(seed,1664525)+1013904223)|0;const py=(seed>>>0)%128;x.fillStyle=i%2?'#515252':'#3d3f40';x.fillRect(px,py,1,1);}asphalt=new T.CanvasTexture(c);asphalt.wrapS=asphalt.wrapT=T.RepeatWrapping;asphalt.repeat.set(2,28);asphalt.userData.shared=true;
  glassMat=new T.MeshStandardMaterial({color:0x4b6878,metalness:.3,roughness:.38,emissive:0x6e8c98,emissiveIntensity:.12});glassMat.userData.shared=true;
  hangarMat=new T.MeshLambertMaterial({color:0x71797b});hangarMat.userData.shared=true;box=new T.BoxGeometry(1,1,1);box.userData.shared=true;
 };
 api.setPalette=function(T,material,mode,custom){const p=mode==='CUSTOM'?custom:api.palettes[mode];material.uniforms.uPalette.value=p?1:0;if(p)p.forEach((c,i)=>material.uniforms['uP'+i].value.set(c));};
 api.enhanceAirport=function(T,a,g){if(a.platform||!asphalt)return;const e=a.elev,W=a.rwyW,hl=a.rwyLen/2,apronW=a.size==='L'?220:a.size==='M'?160:110;
  const runway=g.children.find(o=>o.isMesh&&o.geometry?.parameters?.depth===a.rwyLen);if(runway){runway.material.map=asphalt;runway.material.color.setHex(0x999b9c);runway.material.needsUpdate=true;}
  // Two directional runway designators on one atlas and one mesh.
  const c=document.createElement('canvas');c.width=256;c.height=128;const x=c.getContext('2d');x.clearRect(0,0,256,128);x.fillStyle='#ecece2';x.font='bold 100px monospace';x.textAlign='center';x.textBaseline='middle';x.fillText(a.num,64,67);x.fillText(a.numB,192,67);const tex=new T.CanvasTexture(c);tex.encoding=T.sRGBEncoding;
  const verts=[],uv=[],idx=[];for(let side=0;side<2;side++){const z=(side?1:-1)*(hl-110),d=side?1:-1,b=verts.length/3;verts.push(-7,e+.59,z-d*10,7,e+.59,z-d*10,7,e+.59,z+d*10,-7,e+.59,z+d*10);const u=side*.5;uv.push(u,0,u+.5,0,u+.5,1,u,1);idx.push(b,b+2,b+1,b,b+3,b+2);}const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(verts,3));geo.setAttribute('uv',new T.Float32BufferAttribute(uv,2));geo.setIndex(idx);geo.computeVertexNormals();const mat=new T.MeshBasicMaterial({map:tex,transparent:true,depthWrite:false,side:T.DoubleSide,polygonOffset:true,polygonOffsetFactor:-3});mat.userData.ownedTextures=[tex];g.add(new T.Mesh(geo,mat));
  const windows=new T.InstancedMesh(box,glassMat,a.size==='L'?24:14),m=new T.Matrix4();for(let i=0;i<windows.count;i++){m.makeScale(3.8,4,.3);m.setPosition(W/2+apronW+40+(i-(windows.count-1)/2)*4.7,e+10,a.rwyLen*.15-22.2);windows.setMatrixAt(i,m);}windows.instanceMatrix.needsUpdate=true;g.add(windows);
  const doors=new T.InstancedMesh(box,hangarMat,a.nHangars);for(let i=0;i<a.nHangars;i++){m.makeScale(46,13,.25);m.setPosition(W/2+apronW*.5,e+6.7,a.rwyLen*.15+80+i*70-21.2);doors.setMatrixAt(i,m);}doors.instanceMatrix.needsUpdate=true;g.add(doors);
 };
})(window);
