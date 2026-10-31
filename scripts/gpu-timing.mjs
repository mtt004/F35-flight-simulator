// WebGL2 asynchronous elapsed queries; no gl.finish() or synchronous polling.
// https://registry.khronos.org/webgl/extensions/EXT_disjoint_timer_query_webgl2/
// Self-contained so the benchmark can install it in the browser test context.
// Drain only BETWEEN measurements. This prevents one context's queued commands
// from overlapping the next paired run, without serialising normal frames.
export async function waitForGpuIdle(gl,timeoutMs=60000,pollMs=16){
 if(typeof gl.fenceSync!=='function')throw Error('WebGL2 fences required for isolated paired GPU measurements');
 const start=performance.now(),sync=gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE,0);
 if(!sync)throw Error('Could not create benchmark GPU boundary fence');
 try{
  gl.flush();let polls=0;
  while(true){
   const state=gl.clientWaitSync(sync,0,0);polls++;
   if(state===gl.ALREADY_SIGNALED||state===gl.CONDITION_SATISFIED)return{signalled:true,wallMs:performance.now()-start,polls};
   if(state===gl.WAIT_FAILED||gl.isContextLost())throw Error('Benchmark GPU boundary fence failed');
   if(performance.now()-start>=timeoutMs)throw Error('Benchmark GPU boundary fence timed out');
   await new Promise(resolve=>setTimeout(resolve,pollMs));
  }
 }finally{gl.deleteSync(sync);}
}
export function createGpuTimer(gl,limit=16){
 const ext=gl.getExtension('EXT_disjoint_timer_query_webgl2');
 let pending=[],active=null,samples=[],disjointDiscarded=0,skipped=0,disposed=false;
 function poll(){
  if(!ext||disposed)return;
  const disjoint=gl.getParameter(ext.GPU_DISJOINT_EXT),remaining=[];
  for(const q of pending){
   if(disjoint){disjointDiscarded++;gl.deleteQuery(q);}
   else if(gl.getQueryParameter(q,gl.QUERY_RESULT_AVAILABLE)){
    const ns=gl.getQueryParameter(q,gl.QUERY_RESULT);if(Number.isFinite(ns)&&ns>=0)samples.push(ns/1e6);
    gl.deleteQuery(q);
   }else remaining.push(q);
  }
  pending=remaining;
 }
 function end(){if(active){gl.endQuery(ext.TIME_ELAPSED_EXT);pending.push(active);active=null;}}
 function clear(){end();for(const q of pending)gl.deleteQuery(q);pending=[];}
 return{
  begin(){poll();if(!ext||disposed||active||pending.length>=limit){skipped++;return false;}active=gl.createQuery();if(!active){skipped++;return false;}gl.beginQuery(ext.TIME_ELAPSED_EXT,active);return true;},
  end,
  reset(){clear();samples=[];disjointDiscarded=skipped=0;},
  summary(){poll();const sorted=samples.slice().sort((a,b)=>a-b),q=p=>sorted.length?sorted[Math.min(sorted.length-1,Math.floor(sorted.length*p))]:null;return{supported:!!ext,samples:samples.slice(),pending:pending.length,disjointDiscarded,skipped,p50Ms:q(.5),p95Ms:q(.95),p99Ms:q(.99)};},
  dispose(){if(disposed)return;clear();disposed=true;}
 };
}
