/* Opt-in bounded CPU diagnostics. Render submission is not GPU execution time.
 * Stage marks measure all work since the preceding mark. No GL polling here. */
(function(root){'use strict';
 const quantiles=a=>{a=a.filter(Number.isFinite).sort((a,b)=>a-b);const q=p=>a.length?a[Math.min(a.length-1,Math.floor(a.length*p))]:null;return{p50:q(.5),p95:q(.95),p99:q(.99),max:a.length?a[a.length-1]:null};};
 let capacity=4096,rows=[],cursor=0,frames=0,previous=null,frame=null,markTime=0,started=0,lastSim=0,lastDebt=0,render={};
 const api=root.LightningDiagnostics={enabled:false,
  start(limit=4096){if(!Number.isSafeInteger(limit)||limit<1||limit>65536)throw Error('Diagnostic frame limit must be 1..65536');capacity=limit;rows=[];cursor=frames=0;previous=null;frame=null;started=0;lastSim=lastDebt=0;render={};api.enabled=true;},
  stop(){api.enabled=false;frame=null;},
  beginFrame(now,sim){if(!api.enabled)return;const clock=root.performance.now();if(!frames)started=sim;frame={interval:previous===null?null:now-previous,start:clock,sections:{}};previous=now;markTime=clock;},
  mark(name){if(!api.enabled||!frame)return;const now=root.performance.now();frame.sections[name]=(frame.sections[name]||0)+now-markTime;markTime=now;},
  endFrame(sim,debt,renderer){if(!api.enabled||!frame)return;frame.work=root.performance.now()-frame.start;rows[cursor]=frame;cursor=(cursor+1)%capacity;frames++;lastSim=sim;lastDebt=debt;const info=renderer.info||{};render={...info.render,...info.memory,programs:info.programs?.length??null};frame=null;},
  summary(){const values=rows.filter(Boolean),sections={};for(const row of values)for(const name of Object.keys(row.sections))if(!sections[name])sections[name]=[];for(const name of Object.keys(sections)){const q=quantiles(values.map(r=>r.sections[name]));sections[name]={p50Ms:q.p50,p95Ms:q.p95,p99Ms:q.p99,maxMs:q.max};}const intervals=values.map(r=>r.interval).filter(Number.isFinite),q=quantiles(intervals),worst=intervals.slice().sort((a,b)=>b-a).slice(0,Math.max(1,Math.ceil(intervals.length*.01)));return{enabled:api.enabled,frames,retainedFrames:values.length,capacity,scope:'Most recent bounded frame window; CPU stages include render submission, not GPU execution',frameMs:q,medianFps:q.p50>0?1000/q.p50:null,onePercentLowFps:worst.length?1000/(worst.reduce((a,b)=>a+b,0)/worst.length):null,workMs:quantiles(values.map(r=>r.work)),sections,simulation:{advancedSeconds:lastSim-started,debtSeconds:lastDebt},renderer:render};}
 };
})(typeof window==='undefined'?globalThis:window);
