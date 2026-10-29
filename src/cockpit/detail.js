/* Project Lightning: authored cockpit furnishing. Existing PCD/HMDS remains
 * authoritative; decorative switch labels do not pretend to be clickable. */
(function (root) {
  'use strict';
  const api = root.LightningVisuals = root.LightningVisuals || {};
  let detail = null, stick = null, throttle = null, labelMat = null;
  const bounded = (v,lo,hi,fallback) => Number.isFinite(v) ? Math.max(lo,Math.min(hi,v)) : fallback;

  api.buildCockpitDetail = function (THREE,cockpit) {
    if (detail) return detail;
    detail = new THREE.Group(); detail.name = 'Lightning cockpit furnishings';
    detail.userData.visualOnly = true;
    const graphite = new THREE.MeshStandardMaterial({color:0x171c20,roughness:.84,metalness:.08});
    const rubber = new THREE.MeshStandardMaterial({color:0x0d1114,roughness:.96,metalness:0});
    const textile = new THREE.MeshStandardMaterial({color:0x4a5147,roughness:.98,metalness:0});
    const strapMat = new THREE.MeshStandardMaterial({color:0x717363,roughness:.93,metalness:0});
    const metal = new THREE.MeshStandardMaterial({color:0x747d7d,roughness:.46,metalness:.58});
    const safety = new THREE.MeshStandardMaterial({color:0xb4a63c,roughness:.71,metalness:.1});
    const geometry = new THREE.BoxGeometry(1,1,1);
    const solidParts = new Map();
    function box(material,x,y,z,sx,sy,sz,rx=0,ry=0,rz=0) {
      let arr = solidParts.get(material); if(!arr){arr=[];solidParts.set(material,arr);}
      arr.push([x,y,z,sx,sy,sz,rx,ry,rz]);
    }
    // Four thin bezel rails surround, rather than cover, the existing screen.
    box(rubber,0,.751,-3.72,1.04,.022,.035,-.3);
    box(rubber,0,.260,-3.58,1.04,.025,.035,-.3);
    box(rubber,-.507,.506,-3.65,.032,.51,.035,-.3);
    box(rubber,.507,.506,-3.65,.032,.51,.035,-.3);
    // Stitched seat cushions, side bolsters and harness webbing below the eye.
    box(textile,0,.19,-2.20,.46,.12,.43,-.08);
    box(textile,0,.51,-2.025,.43,.52,.085,-.25);
    for(const side of[-1,1]) {
      box(rubber,side*.26,.20,-2.22,.08,.17,.46);
      box(strapMat,side*.13,.54,-2.085,.062,.56,.018,-.25,0,side*.10);
      box(strapMat,side*.15,.26,-2.34,.18,.021,.045,0,0,side*.24);
      box(metal,side*.15,.38,-2.13,.068,.055,.024,-.25);
      // Recessed fasteners on the two canopy sills, instanced per material.
      for(let j=0;j<9;j++) box(metal,side*.525,.605,-4.28+j*.23,.018,.008,.018);
    }
    box(metal,0,.276,-2.38,.075,.023,.060);
    // Raised switches, rotary knobs and guarded controls share the static
    // material batches. Their relief is visible from the pilot eye and in VR.
    for(const side of[-1,1])for(let row=0;row<6;row++) {
      const z=-3.72+row*.18,y=.345+(3.18+z)*.12;
      box(graphite,side*.67,y+.016,z,.21,.024,.115,-.12);
      box(metal,side*.615,y+.058,z,.018,.075,.018,-.12,0,side*.18);
      box(rubber,side*.715,y+.047,z,.047,.045,.047,-.12);
      if(row===1||row===4) {
        box(safety,side*.59,y+.060,z-.040,.016,.065,.016,-.12);
        box(safety,side*.66,y+.060,z-.040,.016,.065,.016,-.12);
        box(safety,side*.625,y+.092,z-.040,.086,.014,.016,-.12);
      }
    }
    // Rudder pedal pads and heel rails stay below the PCD sightline.
    for(const side of[-1,1]) {
      box(metal,side*.18,-.025,-3.67,.19,.055,.21,-.28);
      box(rubber,side*.18,.010,-3.68,.16,.028,.13,-.28);
      for(let j=0;j<3;j++)box(metal,side*.18,.026+j*.012,-3.72+j*.035,.15,.009,.011,-.28);
    }
    // Throttle gate rails and discrete detents are fixed to its existing base.
    for(const side of[-1,1])box(metal,-.65+side*.065,.375,-2.47,.014,.025,.34);
    for(let j=0;j<7;j++)box(metal,-.65,.378,-2.62+j*.05,.10,.015,.012);
    // Curved forward canopy bow above the pilot's sightline. No artificial HUD glass.
    const pts=[];
    for(let i=0;i<=16;i++){
      const a=Math.PI-i*Math.PI/16;
      pts.push(new THREE.Vector3(Math.cos(a)*.59,.60+Math.sin(a)*.54,-4.32));
    }
    const bow = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts),24,.024,5,false),graphite);
    bow.name = 'Curved canopy arch'; detail.add(bow);
    // Yellow ejection handle is a visual furnishing only.
    const handle = new THREE.Mesh(new THREE.TorusGeometry(.066,.014,5,16,Math.PI),safety);
    handle.position.set(0,.25,-2.49); handle.rotation.x=-.25; detail.add(handle);

    // One 512x256 authored console atlas is reused left and right.
    const canvas = document.createElement('canvas'); canvas.width=512; canvas.height=256;
    const ctx=canvas.getContext('2d');
    ctx.fillStyle='#131a1e';ctx.fillRect(0,0,512,256);
    ctx.strokeStyle='#455156';ctx.lineWidth=2;
    ctx.font='bold 18px monospace';ctx.textBaseline='middle';ctx.fillStyle='#aabbb5';
    const rows=[['FCS','NAV','LIGHT'],['GEAR','FUEL','CABIN'],['AUDIO','TRIM','STOVL']];
    for(let row=0;row<3;row++)for(let col=0;col<3;col++){
      const x=10+col*167,y=8+row*82;
      ctx.strokeRect(x,y,154,70);ctx.fillText(rows[row][col],x+10,y+20);
      ctx.fillStyle='#263236';ctx.fillRect(x+12,y+38,48,18);
      ctx.fillStyle='#89b0a1';ctx.fillRect(x+18,y+41,9,12);
      ctx.fillStyle='#aabbb5';ctx.fillRect(x+101,y+39,27,3);
    }
    const texture=new THREE.CanvasTexture(canvas);texture.encoding=THREE.sRGBEncoding;
    labelMat=new THREE.MeshStandardMaterial({map:texture,emissiveMap:texture,emissive:0x9fb9b2,emissiveIntensity:.15,roughness:.82,metalness:.02});
    for(const side of[-1,1]) {
      const panel=new THREE.Mesh(new THREE.PlaneGeometry(.36,1.32),labelMat);
      panel.position.set(side*.67,.335,-3.18);panel.rotation.x=-Math.PI/2-.12;
      panel.name='Authored console legends';detail.add(panel);
    }
    // Side-stick pivot and left throttle follow actual processed pilot inputs.
    stick=new THREE.Group();stick.position.set(.65,.37,-2.40);stick.name='Animated side-stick';
    const stem=new THREE.Mesh(new THREE.CylinderGeometry(.018,.027,.17,7),rubber);stem.position.y=.085;stick.add(stem);
    const grip=new THREE.Mesh(new THREE.BoxGeometry(.066,.11,.068),graphite);grip.position.set(0,.197,-.014);grip.rotation.x=-.18;stick.add(grip);
    const hat=new THREE.Mesh(new THREE.BoxGeometry(.021,.015,.019),safety);hat.position.set(-.018,.254,-.014);stick.add(hat);detail.add(stick);
    throttle=new THREE.Group();throttle.position.set(-.65,.36,-2.47);throttle.name='Animated throttle lever';
    const arm=new THREE.Mesh(new THREE.BoxGeometry(.025,.13,.032),metal);arm.position.y=.065;throttle.add(arm);
    const cap=new THREE.Mesh(new THREE.BoxGeometry(.12,.05,.085),rubber);cap.position.y=.145;throttle.add(cap);detail.add(throttle);
    box(rubber,.65,.348,-2.40,.13,.035,.16);
    box(rubber,-.65,.345,-2.47,.18,.028,.36);
    // Batch all static boxes by material; fasteners and harness do not each cost a draw.
    const m=new THREE.Matrix4(),p=new THREE.Vector3(),s=new THREE.Vector3(),q=new THREE.Quaternion(),e=new THREE.Euler();
    for(const [material,parts] of solidParts) {
      const mesh=new THREE.InstancedMesh(geometry,material,parts.length);
      parts.forEach((a,i)=>{p.set(a[0],a[1],a[2]);s.set(a[3],a[4],a[5]);q.setFromEuler(e.set(a[6],a[7],a[8]));m.compose(p,q,s);mesh.setMatrixAt(i,m);});
      mesh.instanceMatrix.needsUpdate=true;detail.add(mesh);
    }
    cockpit.add(detail);
    api.cockpitDetailInfo=Object.freeze({consoleAtlas:[512,256],animatedControls:2,visualOnly:true});
    return detail;
  };

  api.updateCockpit = function (state) {
    if(!detail || !detail.parent.visible) return;
    stick.rotation.z=-bounded(state.roll,-1,1,0)*.20;
    stick.rotation.x=bounded(state.pitch,-1,1,0)*.18;
    throttle.rotation.x=-.28+bounded(state.throttle,0,1,0)*.56;
    labelMat.emissiveIntensity=.12+bounded(state.night,0,1,0)*.62;
  };
})(window);
