/* Project Lightning: authored close-range markings and service-detail layer.
 * This is a visual approximation, not an authenticated production-aircraft skin.
 * No downloaded textures or model data. Three.js r128-compatible classic script. */
(function (root) {
  'use strict';
  const api = root.LightningVisuals = root.LightningVisuals || {};
  let detail = null, fanDetail = null, texture = null, modelDetail = null, nozzleDetail = null, originalBody = null;
  const finite = (v, fallback) => Number.isFinite(v) ? v : fallback;

  // Near LOD follows the legacy station envelope. It changes tessellation,
  // shading and visible furnishings, never collision geometry or rigid-body mass.
  function buildAdaptiveModel(THREE, aircraft, surfaces) {
    modelDetail = new THREE.Group(); modelDetail.name = 'Lightning adaptive surface model';
    modelDetail.userData.visualOnly = true;
    originalBody = aircraft.getObjectByName('F35B blended faceted fuselage') || null;
    const skin = new THREE.MeshStandardMaterial({color:0x626c70,roughness:.64,metalness:.16});
    const fairingMat = new THREE.MeshStandardMaterial({color:0x5b6569,roughness:.71,metalness:.13,side:THREE.DoubleSide});
    const dark = new THREE.MeshStandardMaterial({color:0x151b1e,roughness:.67,metalness:.36,side:THREE.DoubleSide});
    const alloy = new THREE.MeshStandardMaterial({color:0x586065,roughness:.42,metalness:.70,side:THREE.DoubleSide});
    const makeGeometry = (positions, indices) => {
      const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
      g.setIndex(indices);g.computeVertexNormals();g.computeBoundingBox();g.computeBoundingSphere();return g;
    };
    // [z, half-width, vertical-radius, centre-y], matching the preserved source.
    const stations=[[-8.24,.025,.025,-.10],[-7.78,.22,.16,-.08],[-7.15,.48,.31,-.05],[-6.35,.70,.46,-.01],[-5.45,.88,.60,.03],[-4.35,1.03,.72,.05],[-3.10,1.19,.82,.06],[-1.85,1.46,.94,.05],[-.35,1.62,.99,.03],[1.20,1.57,.95,.04],[2.65,1.40,.86,.05],[3.95,1.16,.76,.05],[5.10,.92,.67,.04],[6.05,.70,.59,.02],[6.82,.54,.50,0],[7.34,.34,.34,-.01]];
    // Interpolate station dimensions with smooth cubic Hermite curves while z
    // remains monotone. End samples stay exact; radii are bounded explicitly.
    const samples=[];
    const cubic=(a,b,c,d,t)=>.5*((2*b)+(-a+c)*t+(2*a-5*b+4*c-d)*t*t+(-a+3*b-3*c+d)*t*t*t);
    for(let j=0;j<stations.length-1;j++)for(let k=0;k<5;k++){
      const t=k/5,a=stations[Math.max(0,j-1)],b=stations[j],c=stations[j+1],d=stations[Math.min(stations.length-1,j+2)];
      samples.push([b[0]+(c[0]-b[0])*t,Math.max(.02,Math.min(1.64,cubic(a[1],b[1],c[1],d[1],t))),Math.max(.02,Math.min(1.01,cubic(a[2],b[2],c[2],d[2],t))),cubic(a[3],b[3],c[3],d[3],t)]);
    }
    samples.push(stations[stations.length-1]);
    const radial=48,p=[],idx=[];
    for(const station of samples)for(let k=0;k<radial;k++){
      const angle=k/radial*Math.PI*2,sin=Math.sin(angle),chine=1-.10*Math.pow(Math.abs(sin),.7);
      p.push(Math.cos(angle)*station[1]*chine,station[3]+sin*station[2]*(sin<0?.86:1),station[0]);
    }
    for(let j=0;j<samples.length-1;j++)for(let k=0;k<radial;k++){
      const a=j*radial+k,b=j*radial+(k+1)%radial,c=a+radial,d=b+radial;
      idx.push(a,b,c,b,d,c); // outward winding (the old loft was double-sided).
    }
    const nose=p.length/3;p.push(0,samples[0][3],samples[0][0]);
    const tail=p.length/3;p.push(0,samples.at(-1)[3],samples.at(-1)[0]);
    for(let k=0;k<radial;k++){const b=(k+1)%radial;idx.push(nose,b,k);const a=(samples.length-1)*radial;idx.push(tail,a+k,a+b);}
    const body=new THREE.Mesh(makeGeometry(p,idx),skin);body.name='Lightning adaptive fuselage';modelDetail.add(body);

    // Smooth wing/body junctions replace the visual step between the original
    // flat wing sheet and broad shoulders. The wing/flaperon pivots are untouched.
    const fp=[],fi=[],rows=[[-2.80,1.25,.59],[-2.25,1.75,.66],[-1.10,2.35,.72],[0,2.72,.69],[1.15,2.58,.64],[2.20,1.70,.53],[2.72,1.30,.40]];
    for(const side of[-1,1]){
      const base=fp.length/3;
      for(const r of rows)for(let k=0;k<=8;k++){const t=k/8;fp.push(side*(.73+(r[1]-.73)*t),.155+(r[2]-.155)*Math.pow(1-t,2),r[0]);}
      for(let j=0;j<rows.length-1;j++)for(let k=0;k<8;k++){
        const a=base+j*9+k,b=a+1,c=a+9,d=c+1;
        if(side>0)fi.push(a,c,b,b,c,d);else fi.push(a,b,c,b,d,c);
      }
    }
    const fairing=new THREE.Mesh(makeGeometry(fp,fi),fairingMat);fairing.name='Lightning blended wing-root fairings';modelDetail.add(fairing);

    // Recessed inlet interiors are front-visible cavities, rather than bright
    // planar patches. One combined mesh serves both sides of the aircraft.
    const ip=[],ii=[];
    for(const side of[-1,1]){
      const base=ip.length/3;
      const ring=[[1.13,.23],[1.42,.29],[1.65,.09],[1.62,-.33],[1.46,-.48],[1.10,-.40]];
      for(const point of ring)ip.push(side*point[0],point[1],-2.43);
      const centre=ip.length/3;ip.push(side*1.39,-.09,-2.18);
      for(let k=0;k<ring.length;k++){const n=(k+1)%ring.length;if(side>0)ii.push(base+k,centre,base+n);else ii.push(base+k,base+n,centre);}
    }
    const intakes=new THREE.Mesh(makeGeometry(ip,ii),dark);intakes.name='Lightning recessed inlet interiors';modelDetail.add(intakes);
    aircraft.add(modelDetail);

    if(surfaces && surfaces.nozzle){
      nozzleDetail=new THREE.Group();nozzleDetail.name='Lightning articulated exhaust detail';nozzleDetail.userData.visualOnly=true;
      const np=[],ni=[],rings=[[.36,.535],[.53,.595],[.97,.558],[1.39,.505]],n=48;
      for(let j=0;j<rings.length;j++)for(let k=0;k<n;k++){
        const angle=k/n*Math.PI*2,r=rings[j][1]+(k%2===0?.014:-.007);
        np.push(Math.cos(angle)*r,Math.sin(angle)*r,rings[j][0]);
      }
      for(let j=0;j<rings.length-1;j++)for(let k=0;k<n;k++){
        const a=j*n+k,b=j*n+(k+1)%n,c=a+n,d=b+n;ni.push(a,b,c,b,d,c);
      }
      const petals=new THREE.Mesh(makeGeometry(np,ni),alloy);petals.name='Lightning scalloped nozzle petals';nozzleDetail.add(petals);
      const tp=[],ti=[];
      // Dark inner tunnel plus individually swept turbine vanes are one batch.
      for(const [z,r] of[[.39,.40],[1.40,.452]])for(let k=0;k<n;k++){const a=k/n*Math.PI*2;tp.push(Math.cos(a)*r,Math.sin(a)*r,z);}
      for(let k=0;k<n;k++){const a=k,b=(k+1)%n,c=a+n,d=b+n;ti.push(a,c,b,b,c,d);}
      for(let k=0;k<24;k++){
        const a=k/24*Math.PI*2,b=a+.15,base=tp.length/3;
        tp.push(Math.cos(a)*.11,Math.sin(a)*.11,.425,Math.cos(b)*.365,Math.sin(b)*.365,.435,Math.cos(b+.055)*.37,Math.sin(b+.055)*.37,.435);ti.push(base,base+1,base+2);
      }
      const tunnel=new THREE.Mesh(makeGeometry(tp,ti),dark);tunnel.name='Lightning exhaust tunnel and turbine vanes';nozzleDetail.add(tunnel);
      // Opaque end face stops background scenery showing through the jet engine.
      const closure=new THREE.Mesh(new THREE.CircleGeometry(.431,48),new THREE.MeshBasicMaterial({color:0x080b0d,side:THREE.DoubleSide}));
      closure.name='Lightning opaque turbine cavity';closure.position.z=.405;closure.geometry.computeBoundingSphere();nozzleDetail.add(closure);
      surfaces.nozzle.add(nozzleDetail);
    }
  }

  api.buildAircraftDetail = function (THREE, aircraft, surfaces) {
    if (detail) return detail;
    detail = new THREE.Group();
    detail.name = 'Lightning close-range authored markings';
    detail.userData.visualOnly = true;

    // One low-observable atlas, with text kept small and restrained in flight.
    const canvas = document.createElement('canvas');
    canvas.width = 512; canvas.height = 256;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, 512, 256);
    ctx.fillStyle = 'rgba(172,180,180,.68)';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = 'bold 72px sans-serif'; ctx.fillText('01', 128, 65);
    ctx.font = 'bold 26px sans-serif'; ctx.fillText('LIGHTNING', 128, 120);
    ctx.font = 'bold 15px monospace'; ctx.fillText('PROJECT / EXPERIMENTAL', 128, 153);
    ctx.strokeStyle = 'rgba(159,168,166,.72)'; ctx.lineWidth = 5;
    ctx.beginPath(); ctx.moveTo(278, 83); ctx.lineTo(375, 27); ctx.lineTo(472, 83);
    ctx.lineTo(375, 139); ctx.closePath(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(307, 83); ctx.lineTo(443, 83); ctx.stroke();
    ctx.font = 'bold 23px sans-serif'; ctx.fillText('NO STEP', 375, 186);
    ctx.font = '16px monospace'; ctx.fillText('SERVICE ACCESS', 128, 213);
    texture = new THREE.CanvasTexture(canvas);
    texture.encoding = THREE.sRGBEncoding;
    texture.anisotropy = 1;
    const decalMat = new THREE.MeshBasicMaterial({
      map: texture, transparent: true, opacity: .58, depthWrite: false,
      polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1,
      side: THREE.DoubleSide, toneMapped: true
    });
    const pos = [], uv = [], indices = [];
    function quad(points, rect) {
      const n = pos.length / 3;
      for (const p of points) pos.push(p[0], p[1], p[2]);
      const [u0,v0,u1,v1] = rect;
      uv.push(u0,v0,u1,v0,u1,v1,u0,v1);
      indices.push(n,n+1,n+2,n,n+2,n+3);
    }
    // Upper-wing identification roundels are original geometric marks. They are
    // deliberately generic: no copied service crest, squadron or real tail number.
    for (const side of [-1,1]) {
      const x = side * 3.45;
      quad([[x-.48,.166,.08],[x+.48,.166,.08],[x+.48,.166,.73],[x-.48,.166,.73]], [.51,.45,.98,.98]);
      quad([[side*2.15,.17,.74],[side*3.0,.17,.74],[side*3.0,.17,1.05],[side*2.15,.17,1.05]], [.51,.12,.98,.36]);
    }
    // Dorsal identification lies on the broad spine; it does not cross lift doors.
    quad([[-.36,1.09,.60],[.36,1.09,.60],[.36,1.09,1.60],[-.36,1.09,1.60]], [0,.35,.5,1]);
    const decals = new THREE.BufferGeometry();
    decals.setAttribute('position', new THREE.Float32BufferAttribute(pos,3));
    decals.setAttribute('uv', new THREE.Float32BufferAttribute(uv,2));
    decals.setIndex(indices); decals.computeVertexNormals(); decals.computeBoundingSphere();
    const decalMesh = new THREE.Mesh(decals,decalMat);
    decalMesh.name = 'Authored low-contrast markings atlas'; detail.add(decalMesh);

    // Fine seams are a single line-segment draw, not dozens of mesh objects.
    const lines = [];
    function path(points) {
      for (let i=1;i<points.length;i++) lines.push(...points[i-1],...points[i]);
    }
    for (const side of [-1,1]) {
      // Upper wing access covers follow the flat wing, avoiding animated flaps.
      path([[side*2.35,.171,-1.20],[side*3.48,.171,-.35],[side*3.28,.171,.54],[side*2.10,.171,.46],[side*2.35,.171,-1.20]]);
      path([[side*3.69,.171,-.22],[side*4.62,.171,.36],[side*4.56,.171,1.17],[side*3.50,.171,1.28]]);
      // Small fairing access seams aft of the lift-fan door.
      path([[side*.38,1.10,.18],[side*.51,1.10,.35],[side*.48,1.10,1.04],[side*.30,1.10,1.22]]);
    }
    const lineGeo = new THREE.BufferGeometry();
    lineGeo.setAttribute('position',new THREE.Float32BufferAttribute(lines,3));
    lineGeo.computeBoundingSphere();
    const seams = new THREE.LineSegments(lineGeo,new THREE.LineBasicMaterial({color:0x9aa4a3,transparent:true,opacity:.22}));
    seams.name = 'Batched service seams'; detail.add(seams);
    aircraft.add(detail);

    // This plate is parented to the actual lift-fan door and therefore inherits
    // its animation, rather than remaining suspended when conversion opens it.
    if (surfaces && surfaces.lfDoor) {
      fanDetail = new THREE.Group(); fanDetail.name = 'Lift-door moving service plate';
      const geo = new THREE.PlaneGeometry(.62,.17);
      const plate = new THREE.Mesh(geo,decalMat);
      // Reuse the SERVICE ACCESS strip of the shared atlas.
      const a = geo.attributes.uv;
      for(let i=0;i<a.count;i++) a.setXY(i,a.getX(i)*.5,.08+a.getY(i)*.16);
      a.needsUpdate = true;
      plate.rotation.x = -Math.PI/2; plate.position.set(0,.037,1.50);
      fanDetail.add(plate); surfaces.lfDoor.add(fanDetail);
    }
    buildAdaptiveModel(THREE,aircraft,surfaces);
    let geometryVertices=0,geometryTriangles=0,draws=0;
    for(const group of[detail,fanDetail,modelDetail,nozzleDetail])if(group)group.traverse(o=>{
      if(!o.geometry)return;draws++;geometryVertices+=o.geometry.attributes.position.count;
      geometryTriangles+=o.geometry.index?o.geometry.index.count/3:0;
    });
    api.aircraftDetailInfo = Object.freeze({modelVersion:2,draws,geometryVertices,geometryTriangles,atlasWidth:512,atlasHeight:256,visualOnly:true});
    return detail;
  };

  api.updateAircraft = function (state) {
    if (!detail) return;
    const distance = finite(state.distance, Infinity), quality = finite(state.quality,0);
    // Hysteresis prevents visible detail flicker around the distance boundary.
    const limit = detail.visible ? 145 : 115;
    const visible = quality >= 1 && distance < limit;
    detail.visible = visible;
    if (fanDetail) fanDetail.visible = visible;
    if (modelDetail) modelDetail.visible = visible;
    if (nozzleDetail) nozzleDetail.visible = visible;
    if (originalBody) originalBody.visible = !visible;
  };
})(window);
