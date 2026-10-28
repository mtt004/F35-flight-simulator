/* Original procedural London silhouettes. No downloaded models or textures. */
(function (root) {
  'use strict';
  const locations = Object.freeze({
    westminster: Object.freeze([23273.3, -3507.3]),
    eye: Object.freeze([23609.5, -3938.7]),
    shard: Object.freeze([25903.2, -4131.7]),
    towerbridge: Object.freeze([26670.6, -4263.1]),
    stpauls: Object.freeze([25057.4, -5144.6]),
    canary: Object.freeze([30551.7, -4299.9]),
    gherkin: Object.freeze([26304.3, -5255]),
    buckingham: Object.freeze([22067.2, -3687.9])
  });
  const C = { stone: 0xbba982, light: 0xd7cebc, dark: 0x635d50,
    roof: 0x454c53, gold: 0xbba565, glass: 0x799eae, blue: 0x547f9b,
    white: 0xd9ddda, waterglass: 0x527f91 };
  const models = {};
  function model(id, rotation, create) {
    const shapes = [];
    const add = (kind, spec, color) => shapes.push(Object.assign({kind, color}, spec));
    const s = {
      box: (x,y,z,w,h,d,color=C.stone,ry=0) => add('box',{x,y,z,w,h,d,ry},color),
      cyl: (x,y,z,rb,rt,h,color=C.stone,n=16) => add('cyl',{x,y,z,rb,rt,h,n},color),
      ball: (x,y,z,r,color=C.white) => add('ball',{x,y,z,r},color),
      beam: (a,b,r,color=C.white,n=6) => add('beam',{a,b,r,n},color),
      ring: (x,y,z,r,t,color=C.white) => add('ring',{x,y,z,r,t},color),
      profile: (x,y,z,p,sz,color,n=32,diamond=false) => add('profile',{x,y,z,p,sz,n,diamond},color)
    };
    create(s);
    models[id] = {rotation, shapes};
  }
  model('westminster', 0, s => {
    s.box(0,12,0,72,24,245);
    s.box(0,26,0,64,4,233,C.dark);
    for (const x of [-34,34]) {
      for (let z=-116;z<=116;z+=16) {
        s.box(x,28,z,5,8,7,C.light);
        s.cyl(x,32,z,3,0,7,C.gold,4);
      }
      for (let z=-104;z<=104;z+=16) s.box(x*1.065,15,z,1,12,5,C.dark);
    }
    for (const z of [-119,119]) s.box(0,29,z,71,7,6,C.stone);
    // Elizabeth Tower: square shaft, belfry, four clock faces and stepped spire.
    s.box(25,34,-112,18,68,18,C.stone);
    s.box(25,68,-112,22,6,22,C.light);
    s.box(25,76,-112,17,10,17,C.dark);
    s.box(25,82,-112,20,3,20,C.gold);
    s.cyl(25,83.5,-112,14,4,10,C.roof,4);
    s.cyl(25,93.5,-112,4,0,2.5,C.gold,4);
    for (const a of [0,Math.PI/2,Math.PI,Math.PI*1.5]) {
      const dx=Math.sin(a), dz=Math.cos(a);
      s.beam([25+dx*9.1,61,-112+dz*9.1],[25+dx*9.5,61,-112+dz*9.5],4,C.white,20);
      s.beam([25+dx*9.6,61,-112+dz*9.6],[25+dx*9.6,64,-112+dz*9.6],.32,C.dark);
      const tx=Math.cos(a)*2.5, tz=-Math.sin(a)*2.5;
      s.beam([25+dx*9.7,61,-112+dz*9.7],[25+dx*9.7+tx,60,-112+dz*9.7+tz],.3,C.dark);
    }
    // Victoria Tower and corner pinnacles.
    s.box(-22,39,109,24,78,25,C.stone);
    s.box(-22,81,109,28,6,29,C.light);
    for (const x of [-33,-11]) for (const z of [98,120]) s.cyl(x,84,z,3.5,0,9,C.gold,4);
    s.beam([-22,84,109],[-22,99,109],.35,C.dark);
  });
  model('eye', 0, s => {
    s.ring(0,72,0,60,1.7);
    s.ring(0,72,1.8,60,1.1,C.dark);
    s.beam([0,72,-3],[0,72,5],3,C.white,12);
    for (let i=0;i<32;i++) {
      const a=i*Math.PI/16, x=Math.sin(a)*60, y=72+Math.cos(a)*60;
      s.beam([0,72,0],[x,y,0],.22,C.white,4);
      s.ball(x,y,2.3,3,C.glass);
      s.box(x,y-2.3,2.3,3.8,.6,3.8,C.dark);
    }
    s.beam([-24,0,-21],[0,72,-2],2.5,C.white,8);
    s.beam([24,0,-21],[0,72,-2],2.5,C.white,8);
    s.beam([0,72,-2],[0,0,24],2.5,C.white,8);
    s.box(0,2,0,58,4,48,C.light);
  });
  model('shard', 0, s => {
    s.profile(0,0,0,[[34,0],[32,45],[25,130],[16,220],[6,290],[.5,309.6]],.72,C.glass,4,true);
    // Slim contrasting edges retain the angular silhouette at long range.
    const p=[[34,0],[32,45],[25,130],[16,220],[6,290],[.5,309.6]];
    for (let i=0;i<4;i++) for(let j=1;j<p.length;j++) {
      const a=i*Math.PI/2;
      s.beam([Math.sin(a)*p[j-1][0],p[j-1][1],Math.cos(a)*p[j-1][0]*.72],
        [Math.sin(a)*p[j][0],p[j][1],Math.cos(a)*p[j][0]*.72],.35,C.light,4);
    }
  });
  model('towerbridge', 0, s => {
    s.box(0,10,0,22,4,250,C.roof);
    for (const x of [-10.5,10.5]) s.box(x,12.5,0,.7,2,249,C.blue);
    for (const z of [-58,58]) {
      // Towers have arched openings under the elevated central deck.
      for (const x of [-9,9]) s.box(x,30,z,9,60,24,C.light);
      s.box(0,53,z,27,24,24,C.stone);
      s.box(0,65,z,30,3,27,C.light);
      for (const x of [-10,10]) for(const dz of [-8,8]) {
        s.box(x,66,z+dz,5,9,5,C.stone);
        s.cyl(x,70.5,z+dz,4,0,8,C.roof,4);
      }
      s.cyl(0,66.5,z,14,0,11,C.roof,4);
    }
    for(const x of [-8,8]) {
      s.box(x,44,0,4,4,116,C.light);
      for (const side of [-1,1]) {
        const pts=[];
        for(let i=0;i<=12;i++) {
          const t=i/12, z=side*(58+67*t), y=58-46*(2*t-t*t);
          pts.push([x,y,z]);
          if(i) s.beam(pts[i-1],pts[i],.7,C.blue,6);
          if(i>0&&i<12) s.beam([x,12,z],[x,y,z],.3,C.blue,4);
        }
      }
    }
  });
  model('stpauls', 0, s => {
    s.box(0,15,0,40,30,145,C.light);
    s.box(0,17,0,92,34,32,C.light);
    s.box(0,32,0,35,4,141,C.roof);
    s.cyl(0,32,0,24,24,17,C.light,32);
    s.cyl(0,49,0,23,23,9,C.dark,32);
    const dome=[];
    for(let i=0;i<=12;i++) { const a=i*Math.PI/24; dome.push([23*Math.cos(a),58+27*Math.sin(a)]); }
    s.profile(0,0,0,dome,1,C.roof,32);
    s.cyl(0,83,0,7,7,12,C.light,16);
    s.cyl(0,95,0,9,3,6,C.roof,16);
    s.cyl(0,101,0,3,0,5,C.gold,12);
    s.beam([0,105,0],[0,111,0],.5,C.gold);
    s.beam([-2,108,0],[2,108,0],.5,C.gold);
    for(const x of [-15,15]) {
      s.box(x,24,-62,13,48,14,C.light);
      s.cyl(x,48,-62,8,5,10,C.light,8);
      s.cyl(x,58,-62,5,0,9,C.roof,8);
    }
    s.box(0,21,-76,39,7,8,C.light);
    for(let x=-16;x<=16;x+=8) s.cyl(x,0,-77,1.2,1.2,18,C.light,8);
  });
  model('canary', 0, s => {
    s.box(0,105,0,46,210,46,C.glass);
    s.cyl(0,210,0,32.53,0,26,C.roof,4);
    for(const x of [-23.2,23.2]) for(const z of [-23.2,23.2]) s.box(x,105,z,1,210,1,C.light);
    for(let y=8;y<210;y+=12) {
      s.box(0,y,23.2,46,.55,.5,C.light);
      s.box(0,y,-23.2,46,.55,.5,C.light);
    }
    const towers=[[-75,15,42,150,40],[72,10,38,145,45],[-45,-78,45,110,42],
      [35,-87,40,132,38],[90,-65,35,100,38],[-90,82,40,85,34],
      [5,80,46,130,40],[68,83,38,105,34],[-120,-35,34,78,36]];
    towers.forEach((v,i) => {
      const [x,z,w,h,d]=v;
      s.box(x,h/2,z,w,h,d,i%2?C.waterglass:C.glass);
      s.box(x,h+1,z,w+1,2,d+1,C.light);
      for(let y=10;y<h;y+=18) s.box(x,y,z+d/2+.2,w,.5,.5,C.light);
    });
  });
  model('gherkin', 0, s => {
    const p=[[18,0],[22,15],[26,40],[28,65],[27,90],[23,120],[16,150],[8,170],[0,180]];
    s.profile(0,0,0,p,1,C.waterglass,40);
    // Two crossing families of diagonal ribs.
    for(const hand of [-1,1]) for(let k=0;k<12;k++) {
      let prev=null;
      for(let j=0;j<=24;j++) {
        const y=j*7.5, r=radiusAt(p,y)+.22, a=k*Math.PI/6+hand*y*.015;
        const q=[Math.sin(a)*r,y,Math.cos(a)*r];
        if(prev) s.beam(prev,q,.27,C.light,4);
        prev=q;
      }
    }
  });
  model('buckingham', -.35, s => {
    // Open central court: three separate wings, never a solid bounding box.
    s.box(0,13,-36,108,26,24,C.light);
    for(const x of [-45,45]) s.box(x,12,7,18,24,62,C.light);
    s.box(0,28,-36,110,4,26,C.stone);
    for(const x of [-45,45]) s.box(x,26,7,20,4,64,C.stone);
    s.box(0,16,-50,28,32,6,C.light);
    s.cyl(0,32,-36,9,0,5,C.dark,4);
    for(let x=-48;x<=48;x+=8) {
      s.box(x,18,-48.2,3,6,.5,C.dark);
      s.box(x,8,-48.2,3,5,.5,C.dark);
      s.box(x,31,-36,3,3,3,C.light);
    }
    for(const x of [-45,45]) for(let z=-16;z<=32;z+=8) s.box(x-Math.sign(x)*9.2,15,z,.5,6,3,C.dark);
  });
  function radiusAt(p,y) {
    if(y<p[0][1] || y>p[p.length-1][1]) return -1;
    for(let i=1;i<p.length;i++) if(y<=p[i][1]) {
      const a=p[i-1],b=p[i], t=(y-a[1])/(b[1]-a[1]); return a[0]+(b[0]-a[0])*t;
    }
    return p[p.length-1][0];
  }
  function baseHeight(id,fn) {
    const p=locations[id], y=typeof fn==='function'?fn(p[0],p[1]):0;
    return Math.max(4,Number.isFinite(y)?y:0);
  }
  function inside(q,s) {
    let x=q[0]-(s.x||0), y=q[1]-(s.y||0), z=q[2]-(s.z||0);
    switch(s.kind) {
      case 'box': {
        const c=Math.cos(s.ry),t=Math.sin(s.ry), xx=c*x-t*z,zz=t*x+c*z;
        return Math.abs(xx)<=s.w/2 && Math.abs(y)<=s.h/2 && Math.abs(zz)<=s.d/2;
      }
      case 'cyl': {
        if(y<0||y>s.h)return false;
        const r=s.rb+(s.rt-s.rb)*y/s.h;
        // Four-sided cones use the same diamond section as CylinderGeometry.
        return s.n===4 ? Math.abs(x)+Math.abs(z)<=r : x*x+z*z<=r*r;
      }
      case 'ball': return x*x+y*y+z*z<=s.r*s.r;
      case 'ring': return Math.pow(Math.hypot(x,y)-s.r,2)+z*z<=s.t*s.t;
      case 'profile': {
        const r=radiusAt(s.p,y); if(r<0)return false;
        return s.diamond ? Math.abs(x)+Math.abs(z/s.sz)<=r : x*x+(z/s.sz)*(z/s.sz)<=r*r;
      }
      case 'beam': {
        const a=s.a,b=s.b, dx=b[0]-a[0],dy=b[1]-a[1],dz=b[2]-a[2];
        const len=dx*dx+dy*dy+dz*dz;
        const t=((q[0]-a[0])*dx+(q[1]-a[1])*dy+(q[2]-a[2])*dz)/len;
        if(t<0||t>1)return false;
        return Math.pow(q[0]-a[0]-t*dx,2)+Math.pow(q[1]-a[1]-t*dy,2)+Math.pow(q[2]-a[2]-t*dz,2)<=s.r*s.r;
      }
      default:return false;
    }
  }
  function collides(x,y,z,heightFn) {
    if(!Number.isFinite(x)||!Number.isFinite(y)||!Number.isFinite(z)) return false;
    for(const id of Object.keys(models)) {
      const p=locations[id], dx=x-p[0],dz=z-p[1];
      if(Math.abs(dx)>200||Math.abs(dz)>200)continue;
      const m=models[id],c=Math.cos(m.rotation),s=Math.sin(m.rotation);
      const q=[c*dx-s*dz,y-baseHeight(id,heightFn),s*dx+c*dz];
      for(const shape of m.shapes) if(inside(q,shape))return true;
    }
    return false;
  }
  function build(T,heightFn) {
    const group=new T.Group(); group.name='LondonLandmarks';
    const material=new T.MeshLambertMaterial({vertexColors:true});
    for(const id of Object.keys(models)) {
      const m=models[id], positions=[],normals=[],colors=[], color=new T.Color();
      const origin=locations[id], base=baseHeight(id,heightFn);
      const global=new T.Matrix4().compose(new T.Vector3(origin[0],base,origin[1]),
        new T.Quaternion().setFromAxisAngle(new T.Vector3(0,1,0),m.rotation),new T.Vector3(1,1,1));
      for(const s of m.shapes) {
        let g;
        switch(s.kind) {
          case 'box':
            g=new T.BoxGeometry(s.w,s.h,s.d); g.rotateY(s.ry); g.translate(s.x,s.y,s.z); break;
          case 'cyl':
            g=new T.CylinderGeometry(s.rt,s.rb,s.h,s.n,1,false); g.translate(s.x,s.y+s.h/2,s.z); break;
          case 'ball':
            g=new T.SphereGeometry(s.r,10,6);g.translate(s.x,s.y,s.z);break;
          case 'ring':
            g=new T.TorusGeometry(s.r,s.t,8,96);g.translate(s.x,s.y,s.z);break;
          case 'profile': {
            g=new T.LatheGeometry(s.p.map(p=>new T.Vector2(p[0],p[1])),s.n);
            g.scale(1,1,s.sz);g.translate(s.x,s.y,s.z);
            // LatheGeometry has open ends; close them with independently authored caps.
            const first=s.p[0],last=s.p[s.p.length-1];
            // The end caps are appended below and do not alter the side normals.
            const caps=[];
            if(first[0]>0)caps.push([first,Math.PI/2]);
            if(last[0]>0)caps.push([last,-Math.PI/2]);
            for(const cap of caps) {
              const cg=new T.CircleGeometry(cap[0][0],s.n);
              cg.rotateX(cap[1]);cg.rotateY(Math.PI/2);cg.scale(1,1,s.sz);
              cg.translate(s.x,s.y+cap[0][1],s.z);append(cg,s.color);
            }
            break;
          }
          case 'beam': {
            const a=new T.Vector3(...s.a),b=new T.Vector3(...s.b),d=b.clone().sub(a);
            g=new T.CylinderGeometry(s.r,s.r,d.length(),s.n,1,false);
            g.applyMatrix4(new T.Matrix4().makeRotationFromQuaternion(
              new T.Quaternion().setFromUnitVectors(new T.Vector3(0,1,0),d.clone().normalize())));
            const mid=a.add(b).multiplyScalar(.5);g.translate(mid.x,mid.y,mid.z);break;
          }
        }
        append(g,s.color);
      }
      function append(g,tint) {
        g.applyMatrix4(global);
        const flat=g.index?g.toNonIndexed():g;
        const p=flat.getAttribute('position'),n=flat.getAttribute('normal');color.setHex(tint);
        for(let i=0;i<p.count;i++) {
          positions.push(p.getX(i),p.getY(i),p.getZ(i));
          normals.push(n.getX(i),n.getY(i),n.getZ(i));
          colors.push(color.r,color.g,color.b);
        }
        if(flat!==g)flat.dispose();g.dispose();
      }
      const geometry=new T.BufferGeometry();
      geometry.setAttribute('position',new T.Float32BufferAttribute(positions,3));
      geometry.setAttribute('normal',new T.Float32BufferAttribute(normals,3));
      geometry.setAttribute('color',new T.Float32BufferAttribute(colors,3));
      geometry.computeBoundingBox();geometry.computeBoundingSphere();
      const mesh=new T.Mesh(geometry,material);mesh.name='landmark:'+id;
      mesh.userData.landmark=id;mesh.castShadow=true;mesh.receiveShadow=true;group.add(mesh);
    }
    return group;
  }
  root.LightningLandmarks=Object.freeze({locations,build,collides});
})(typeof window!=='undefined'?window:globalThis);
