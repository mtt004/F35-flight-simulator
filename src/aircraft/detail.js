/* Project Lightning: authored close-range markings and service-detail layer.
 * This is a visual approximation, not an authenticated production-aircraft skin.
 * No downloaded textures or model data. Three.js r128-compatible classic script. */
(function (root) {
  'use strict';
  const api = root.LightningVisuals = root.LightningVisuals || {};
  let detail = null, fanDetail = null, texture = null;
  const finite = (v, fallback) => Number.isFinite(v) ? v : fallback;

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
    api.aircraftDetailInfo = Object.freeze({draws:fanDetail?3:2,atlasWidth:512,atlasHeight:256,visualOnly:true});
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
  };
})(window);
