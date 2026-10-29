/* Original authored London architecture. No downloaded model or texture assets.
 * Dimensions / reference anchors (consulted 2026-10):
 * parliament.uk/about/living-heritage/building/palace/architecture/palacestructure/
 * stpauls.co.uk/explore-our-map (111m cross); City of London St Paul's Heights
 * Study 2015, table 1B (36m nave, 42m peristyle, 65.5m dome base).
 * towerbridgeevents.com/the-venue/high-level-walkways/ (42m, 61m span).
 * the-shard.com/about (309.6m); fosterandpartners.com 30 St Mary Axe (180m).
 * historicengland.org.uk/listing/the-list/list-entry/1357620 (Battersea NGR,
 * twin boiler/turbine hall plan, brown English-bond brick, concrete chimneys).
 * batterseapowerstation.co.uk/about/heritage-history/ (51m wash towers +
 * 50m western stacks); solinear.co.uk/case-study/battersea-power-station-
 * redevelopment/ (160x170m overall; 8.5m to 6.7m tapered chimney diameter).
 * Footprints/details are flight-scale interpretations,
 * not survey models. All geometry and material coordinates authored here.
 */
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
    buckingham: Object.freeze([22067.2, -3687.9]),
    battersea: Object.freeze([21884, -1513]) // TQ2888477513; X=E-507000,Z=176000-N
  });
  const C = { stone: 0xbba982, light: 0xd7cebc, dark: 0x635d50,
    roof: 0x454c53, gold: 0xbba565, glass: 0x799eae, blue: 0x547f9b,
    white: 0xd9ddda, waterglass: 0x527f91, brick: 0x8d6652, soot: 0x493e37,
    window: 0x354c56, lead: 0x717b7b };
  const models = {};
  function model(id, rotation, create) {
    const shapes = [];
    const add = (kind, spec, color) => shapes.push(Object.assign({kind, color}, spec));
    const s = {
      box: (x,y,z,w,h,d,color=C.stone,ry=0) => add('box',{x,y,z,w,h,d,ry},color),
      gable: (x,y,z,w,h,d,color=C.roof) => add('gable',{x,y,z,w,h,d},color),
      cyl: (x,y,z,rb,rt,h,color=C.stone,n=16,ry=0) => add('cyl',{x,y,z,rb,rt,h,n,ry},color),
      ball: (x,y,z,r,color=C.white) => add('ball',{x,y,z,r},color),
      beam: (a,b,r,color=C.white,n=6) => add('beam',{a,b,r,n},color),
      ring: (x,y,z,r,t,color=C.white) => add('ring',{x,y,z,r,t},color),
      profile: (x,y,z,p,sz,color,n=32,diamond=false) => add('profile',{x,y,z,p,sz,n,diamond},color)
    };
    create(s);
    models[id] = {rotation, shapes};
  }
  model('westminster', 0, s => {
    // River front, landward wings and transverse halls frame real open courts.
    s.box(26,13,0,22,26,278);
    s.box(-29,13,0,16,26,270);
    for(const z of [-125,-49,12,83,127]) s.box(0,13,z,70,26,16);
    s.box(0,17,0,38,34,26);
    s.gable(0,34,0,31,11,30,C.lead);
    for(const x of [-30,27]) {
      s.gable(x,27,0,18,7,267,C.lead);
      for(let z=-128;z<=128;z+=12.8) {
        s.box(x+11,16,z,1.5,16,1.6,C.light);
        s.box(x+11,29,z,2.8,5,3,C.stone);
        s.cyl(x+11,31.5,z,2,0,5,C.light,4);
        s.box(x+11.05,15,z+6.4,.6,11,4.5,C.window);
        s.box(x+11.1,15,z+6.4,.7,11,.4,C.stone);
        s.box(x+11.1,15,z+6.4,.7,.4,4.6,C.stone);
      }
      for(const y of [7,25.5]) s.box(x+11,y,0,2,1,276,C.light);
    }
    // Elizabeth Tower, 96.3m; clocks are inset in the square belfry stage.
    s.box(25,31,-132,15.5,62,15.5);
    for(const x of [18,32]) for(const z of [-139,-125]) s.box(x,36,z,1.8,72,1.8,C.light);
    s.box(25,64,-132,18,5,18,C.light);
    s.box(25,73,-132,15,13,15,C.dark);
    for(let k=-1;k<=1;k++) {
      s.box(25+k*3.8,73,-139.6,1,11,.6,C.gold);
      s.box(17.4,73,-132+k*3.8,.6,11,1,C.gold);
      s.box(32.6,73,-132+k*3.8,.6,11,1,C.gold);
      s.box(25+k*3.8,73,-124.4,1,11,.6,C.gold);
    }
    s.box(25,80,-132,19,3,19,C.gold);
    s.cyl(25,81.5,-132,13.5,4.2,10,C.roof,4);
    s.cyl(25,91.5,-132,4.2,2.1,3,C.gold,4);
    s.cyl(25,94.5,-132,2.1,0,1.8,C.gold,4);
    for(const a of [0,Math.PI/2,Math.PI,Math.PI*1.5]) {
      const dx=Math.sin(a),dz=Math.cos(a), tx=Math.cos(a),tz=-Math.sin(a);
      s.beam([25+dx*8.1,61,-132+dz*8.1],[25+dx*8.5,61,-132+dz*8.5],3.5,C.gold,24);
      s.beam([25+dx*8.5,61,-132+dz*8.5],[25+dx*8.6,61,-132+dz*8.6],3.15,C.white,24);
      s.beam([25+dx*8.7,61,-132+dz*8.7],[25+dx*8.7,63.5,-132+dz*8.7],.22,C.dark,4);
      s.beam([25+dx*8.7,61,-132+dz*8.7],[25+dx*8.7+tx*2,60,-132+dz*8.7+tz*2],.22,C.dark,4);
    }
    // Victoria Tower's square battlement and octagonal central ventilation spire.
    s.box(-22,41,126,25,82,27);
    s.box(-22,85,126,28,6,30,C.light);
    for(const x of [-33,-11]) for(const z of [114,138]) {
      s.box(x,89,z,4,8,4,C.stone);s.cyl(x,93,z,3,0,5.5,C.light,4);
    }
    s.beam([-22,88,126],[-22,101,126],.25,C.dark,4);
    s.cyl(0,34,0,9,9,22,C.stone,8);
    s.cyl(0,56,0,10,3,27,C.lead,8);
    s.cyl(0,83,0,3,0,8.4,C.gold,8);
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
    s.profile(0,0,0,[[34,0],[32,45],[25,130],[16,220],[6.8,280]],.72,C.glass,4,true);
    // Separate unequal glass blades leave the signature open, broken crown.
    for(const [x,z,h] of [[3.2,0,309.6],[-3.2,0,304],[0,2.4,300],[0,-2.4,306]])
      s.profile(x,0,z,[[3.5,278],[0,h]],.65,C.glass,4,true);
    // Slim contrasting edges retain the angular silhouette at long range.
    const p=[[34,0],[32,45],[25,130],[16,220],[6.8,280]];
    for (let i=0;i<4;i++) for(let j=1;j<p.length;j++) {
      const a=i*Math.PI/2;
      s.beam([Math.sin(a)*p[j-1][0],p[j-1][1],Math.cos(a)*p[j-1][0]*.72],
        [Math.sin(a)*p[j][0],p[j][1],Math.cos(a)*p[j][0]*.72],.35,C.light,4);
    }
  });
  model('towerbridge', -.09, s => {
    // 61m clear opening between ~21m wide tower piers; 244m deck.
    s.box(0,9,0,21,3,244,C.roof);
    s.box(0,10.6,0,1,.2,61,C.white);
    for(const x of [-10.4,10.4]) {
      s.box(x,11.3,0,.6,1.5,244,C.blue);
      for(let z=-119;z<121;z+=6) s.box(x,12,z,.3,2,.4,C.blue);
    }
    for(const z of [-41,41]) {
      s.box(0,3,z,32,6,28,C.dark);
      // Narrow stone legs preserve the roadway arch through each tower.
      for(const x of [-9,9]) s.box(x,24,z,8,42,21,C.light);
      s.box(0,40,z,26,13,21,C.stone);
      s.box(0,49,z,27,5,23,C.light);
      for(const x of [-10,10]) for(const dz of [-8,8]) {
        s.box(x,51,z+dz,5,12,5,C.light);
        s.cyl(x,57,z+dz,3.7,0,8,C.roof,4);
      }
      s.gable(0,51,z,19,8,16,C.roof);
      for(const side of [-1,1]) for(const x of [-8,0,8]) {
        s.box(x,42,z+side*10.6,2.6,7,.5,C.window);
        s.box(x,42,z+side*11, .5,7,.5,C.light);
      }
      // Gothic stone banding makes the towers read at approach distance.
      for(const y of [15,29,36,46]) s.box(0,y,z,27,1.1,23,C.light);
    }
    for(const x of [-7.8,7.8]) {
      s.box(x,43,0,3.3,3.7,82,C.light);
      s.box(x,43,0,3.5,.6,61,C.blue);
      for(let z=-29;z<30;z+=6) {
        s.beam([x-1.8,42,z],[x-1.8,45,z+6],.2,C.blue,4);
        s.beam([x+1.8,42,z],[x+1.8,45,z+6],.2,C.blue,4);
      }
      for(const side of [-1,1]) {
        let prev=null;
        for(let i=0;i<=14;i++) {
          const t=i/14,z=side*(51+71*t),y=52-40*(2*t-t*t),q=[x,y,z];
          if(prev)s.beam(prev,q,.8,C.blue,6);
          if(i>0&&i<14)s.beam([x,11,z],q,.22,C.blue,4);
          prev=q;
        }
      }
    }
  });
  model('stpauls', 1.35, s => {
    // Cruciform plan, west portico/twin towers and stepped lead nave roofs.
    s.box(0,14.6,0,35,29.2,155,C.light);
    s.box(0,14.6,0,75,29.2,31,C.light);
    s.box(0,31.5,0,39,4.6,153,C.light);
    s.gable(0,34,0,27,7,145,C.lead);
    for(const x of [-24,24]) s.gable(x,30.5,0,27,7,30,C.lead);
    for(const x of [-18.1,18.1]) for(let z=-65;z<72;z+=11) {
      s.box(x,16,z,.5,12,4,C.window);
      s.box(x,27,z,.7,3,3,C.dark);
      s.box(x,15,z+5,1.4,29,1.3,C.light);
    }
    // Peristyle: visible shadow gaps between 32 freestanding columns.
    s.cyl(0,34,0,22.8,22.8,8,C.light,32);
    s.cyl(0,42,0,18.8,18.8,13.5,C.dark,32);
    for(let i=0;i<32;i++) {
      const a=i*Math.PI/16,x=Math.sin(a)*21,z=Math.cos(a)*21;
      s.cyl(x,42,z,.75,.75,13.5,C.light,6);
    }
    s.cyl(0,55.5,0,23.3,23.3,2,C.light,40);
    s.cyl(0,57.5,0,20.5,20.5,8,C.light,40);
    for(let i=0;i<24;i++) {
      const a=i*Math.PI/12;
      s.box(Math.sin(a)*20.5,61.2,Math.cos(a)*20.5,1.5,5,1.5,C.dark);
    }
    const dome=[];
    for(let i=0;i<=10;i++) {const a=i*Math.PI/20;dome.push([21.3*Math.cos(a),65.5+19.3*Math.sin(a)]);}
    s.profile(0,0,0,dome,1,C.lead,48);
    for(let k=0;k<12;k++) {
      const a=k*Math.PI/6;let prev=null;
      for(const [r,y] of dome) {
        const q=[Math.sin(a)*(r+.13),y+.1,Math.cos(a)*(r+.13)];
        if(prev)s.beam(prev,q,.16,C.light,4);prev=q;
      }
    }
    s.cyl(0,84.8,0,6.2,6.2,2,C.light,24);
    s.cyl(0,86.8,0,4.2,4.2,10.5,C.dark,16);
    for(let i=0;i<8;i++) {const a=i*Math.PI/4;s.cyl(Math.sin(a)*5,86.8,Math.cos(a)*5,.65,.65,10.5,C.light,6);}
    s.cyl(0,97.3,0,6.3,3,5,C.lead,16);
    s.cyl(0,102.3,0,3,1.4,3,C.light,16);
    s.ball(0,106,0,1.5,C.gold);
    s.beam([0,106,0],[0,111,0],.25,C.gold,6);
    s.beam([-1.6,109,0],[1.6,109,0],.25,C.gold,6);
    for(const x of [-19,19]) {
      s.box(x,24,-68,13,48,15,C.light);
      s.cyl(x,48,-68,7,5,8,C.light,8);
      s.cyl(x,56,-68,5,3.5,5,C.dark,8);
      s.cyl(x,61,-68,3.5,0,6,C.lead,8);
    }
    // Two-tier portico and triangular classical pediment.
    s.box(0,2,-82,48,4,14,C.light);
    for(const x of [-18,-11,-4,4,11,18]) {
      s.cyl(x,4,-82,1.1,1,15,C.light,8);
      s.cyl(x,21,-82,.8,.8,9,C.light,8);
    }
    s.box(0,20,-81,43,2,9,C.light);
    s.box(0,31,-81,43,2,9,C.light);
    s.gable(0,32,-81,43,8,7,C.light);
    s.cyl(0,0,74,17,17,25,C.light,24);
  });
  model('canary', 0, s => {
    s.box(0,105,0,46,210,46,C.glass);
    s.cyl(0,210,0,32.53,0,26,C.lead,4,Math.PI/4);
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
      for(let j=0;j<=18;j++) {
        const y=j*10, r=radiusAt(p,y)+.22, a=k*Math.PI/6+hand*y*.015;
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
  model('battersea', .13, s => {
    // Two turbine halls flank taller twin boiler houses, not a single slab.
    for(const x of [-59,59]) {
      s.box(x,17,0,42,34,170,C.brick);
      s.gable(x,34,0,40,6,169,C.lead);
      s.box(x,33.5,0,43,1.5,171,C.soot);
      for(const side of [-1,1]) for(let z=-72;z<=72;z+=12) {
        s.box(x+side*21.1,19,z,.6,19,5,C.window);
        s.box(x+side*21.5,19,z,.7,.6,5.2,C.light);
        s.box(x+side*21.5,19,z,.7,19,.4,C.light);
        s.box(x+side*21.6,18,z+5.6,1.2,30,1.3,C.brick);
      }
    }
    for(const x of [-20,20]) {
      s.box(x,24.5,0,39,49,158,C.brick);
      s.box(x,50,0,39,2,160,C.soot);
      s.gable(x,51,0,37,5,155,C.lead);
      // Restored roof glazing reads as ribbons from the air.
      for(const dx of [-10,10]) s.box(x+dx,54,0,5,.7,135,C.glass);
    }
    for(const x of [-43,43]) for(const z of [-68,68]) {
      s.box(x,27,z,23,54,23,C.brick);
      for(const y of [39,47,51]) s.box(x,y,z,24,1.5,24,C.soot);
      s.box(x,54,z,21,2,21,C.light);
      // Western stacks total 101m, eastern pair approximately 103m.
      const top=x<0?101:103;
      s.cyl(x,55,z,4.25,3.35,top-55,C.white,24);
      s.cyl(x,top-.7,z,3.7,3.7,.7,C.light,24);
      s.cyl(x,top+.02,z,2.9,2.9,.04,C.soot,24);
      for(let k=0;k<12;k++) {
        const a=k*Math.PI/6;
        s.beam([x+Math.sin(a)*4.26,55,z+Math.cos(a)*4.26],
          [x+Math.sin(a)*3.36,top-.8,z+Math.cos(a)*3.36],.08,C.light,3);
      }
    }
    for(const z of [-79.2,79.2]) {
      for(let x=-30;x<=30;x+=10) {
        s.box(x,23,z,5,34,.7,C.window);
        s.box(x,23,z+Math.sign(z)*.5,.5,34,.4,C.light);
      }
      s.box(0,45,z,75,2,1.4,C.soot);
    }
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
      case 'gable': return Math.abs(z)<=s.d/2 && y>=0 && y<=s.h*(1-Math.abs(x)/(s.w/2));
      case 'box': {
        const c=Math.cos(s.ry),t=Math.sin(s.ry), xx=c*x-t*z,zz=t*x+c*z;
        return Math.abs(xx)<=s.w/2 && Math.abs(y)<=s.h/2 && Math.abs(zz)<=s.d/2;
      }
      case 'cyl': {
        if(y<0||y>s.h)return false;
        const r=s.rb+(s.rt-s.rb)*y/s.h;
        // Four-sided cones use the same diamond section as CylinderGeometry.
        const c=Math.cos(s.ry||0),t=Math.sin(s.ry||0);
        return s.n===4 ? Math.abs(c*x-t*z)+Math.abs(t*x+c*z)<=r : x*x+z*z<=r*r;
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
    const material=root.LightningArchitecture?.landmarkMaterial(T) || new T.MeshStandardMaterial({vertexColors:true,roughness:.76,metalness:.08});
    for(const id of Object.keys(models)) {
      const m=models[id], positions=[],normals=[],colors=[],uvs=[],architecture=[], color=new T.Color();
      const origin=locations[id], base=baseHeight(id,heightFn);
      const global=new T.Matrix4().compose(new T.Vector3(origin[0],base,origin[1]),
        new T.Quaternion().setFromAxisAngle(new T.Vector3(0,1,0),m.rotation),new T.Vector3(1,1,1));
      for(const s of m.shapes) {
        let g;
        switch(s.kind) {
          case 'gable': {
            const sh=new T.Shape();sh.moveTo(-s.w/2,0);sh.lineTo(s.w/2,0);sh.lineTo(0,s.h);sh.closePath();
            g=new T.ExtrudeGeometry(sh,{depth:s.d,bevelEnabled:false,steps:1});
            g.translate(s.x,s.y,s.z-s.d/2);break;
          }
          case 'box':
            g=new T.BoxGeometry(s.w,s.h,s.d); g.rotateY(s.ry); g.translate(s.x,s.y,s.z); break;
          case 'cyl':
            g=new T.CylinderGeometry(s.rt,s.rb,s.h,s.n,1,false);g.rotateY(s.ry||0); g.translate(s.x,s.y+s.h/2,s.z); break;
          case 'ball':
            g=new T.SphereGeometry(s.r,8,5);g.translate(s.x,s.y,s.z);break;
          case 'ring':
            g=new T.TorusGeometry(s.r,s.t,6,80);g.translate(s.x,s.y,s.z);break;
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
            g=new T.CylinderGeometry(s.r,s.r,d.length(),s.n,1,s.r<1);
            g.applyMatrix4(new T.Matrix4().makeRotationFromQuaternion(
              new T.Quaternion().setFromUnitVectors(new T.Vector3(0,1,0),d.clone().normalize())));
            const mid=a.add(b).multiplyScalar(.5);g.translate(mid.x,mid.y,mid.z);break;
          }
        }
        append(g,s.color,id==='gherkin'&&s.kind==='profile'?'spiral':null);
      }
      function append(g,tint,style) {
        // Physical metre UVs keep masonry and glass floor spacing consistent
        // on tiny pinnacles and full height towers in the shared material.
        const local=g.getAttribute('position'), ln=g.getAttribute('normal'),coords=[];
        for(let i=0;i<local.count;i++) {
          const ax=Math.abs(ln.getX(i)),ay=Math.abs(ln.getY(i)),az=Math.abs(ln.getZ(i));
          coords.push(ay>.65?local.getX(i)/12:(ax>az?local.getZ(i):local.getX(i))/12,
            ay>.65?local.getZ(i)/12:local.getY(i)/12);
        }
        g.setAttribute('uv',new T.Float32BufferAttribute(coords,2));
        if(style==='spiral') {
          const bands=[];
          for(let i=0;i<local.count;i++) {
            const a=Math.atan2(local.getX(i),local.getZ(i))-local.getY(i)*.015;
            const phase=((a/(Math.PI/3))%1+1)%1;
            bands.push(phase<.29?.57:phase<.38?.79:1.07);
          }
          g.setAttribute('facadeTint',new T.Float32BufferAttribute(bands,1));
        }
        g.applyMatrix4(global);
        const flat=g.index?g.toNonIndexed():g;
        const p=flat.getAttribute('position'),n=flat.getAttribute('normal'),uv=flat.getAttribute('uv'),band=flat.getAttribute('facadeTint');color.setHex(tint);
        const cls=[C.glass,C.waterglass,C.window].includes(tint)?3:
          tint===C.brick?5:[C.roof,C.lead,C.soot].includes(tint)?12:4;
        for(let i=0;i<p.count;i++) {
          positions.push(p.getX(i),p.getY(i),p.getZ(i));
          normals.push(n.getX(i),n.getY(i),n.getZ(i));
          const shade=band?band.getX(i):1;
          colors.push(color.r*shade,color.g*shade,color.b*shade);
          uvs.push(uv.getX(i),uv.getY(i));architecture.push(cls);
        }
        if(flat!==g)flat.dispose();g.dispose();
      }
      const geometry=new T.BufferGeometry();
      geometry.setAttribute('position',new T.Float32BufferAttribute(positions,3));
      geometry.setAttribute('normal',new T.Float32BufferAttribute(normals,3));
      geometry.setAttribute('color',new T.Float32BufferAttribute(colors,3));
      geometry.setAttribute('uv',new T.Float32BufferAttribute(uvs,2));
      geometry.setAttribute('architecture',new T.Float32BufferAttribute(architecture,1));
      geometry.computeBoundingBox();geometry.computeBoundingSphere();
      const mesh=new T.Mesh(geometry,material);mesh.name='landmark:'+id;
      mesh.userData.landmark=id;mesh.castShadow=true;mesh.receiveShadow=true;group.add(mesh);
    }
    return group;
  }
  // Suppress generic map extrusions inside authored landmark footprints. Real
  // source polygons remain in the downloadable pack; this is renderer curation.
  const clearances={westminster:[65,170],eye:[80,45],shard:[48,42],towerbridge:[35,150],stpauls:[100,65],canary:[45,45],gherkin:[35,35],buckingham:[70,100],battersea:[100,105]};
  function excludes(x,z){for(const [id,p]of Object.entries(locations)){const b=clearances[id];if(Math.abs(x-p[0])<b[0]&&Math.abs(z-p[1])<b[1])return true;}return false;}
  root.LightningLandmarks=Object.freeze({locations,build,collides,excludes});
})(typeof window!=='undefined'?window:globalThis);
