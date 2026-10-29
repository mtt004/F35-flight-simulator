export function assessEndurance(samples){
 const issues=new Set();let previous=-Infinity,losses=0;
 if(samples.length<2)issues.add('Insufficient state samples');
 for(const s of samples){
  if(s.world?.mode!=='LONDON')issues.add('Unexpected world');
  if(s.paused)issues.add('Physics paused');
  if(s.crashed)issues.add('Aircraft crashed');
  if(s.landmarks!==8)issues.add('Landmarks missing');
  for(const[name,size]of[['globalPosition',3],['velocity',3],['quaternion',4]])if(!Array.isArray(s[name])||s[name].length!==size||!s[name].every(Number.isFinite))issues.add('Nonfinite or malformed '+name);
  if(![s.flightT,s.simT,s.fuel].every(Number.isFinite))issues.add('Nonfinite flight state');
  const norm=Array.isArray(s.quaternion)?Math.hypot(...s.quaternion):NaN;
  if(!Number.isFinite(norm)||Math.abs(norm-1)>.001)issues.add('Invalid aircraft orientation');
  if(s.fuel<0)issues.add('Invalid fuel');
  if(s.flightT<=previous)issues.add('Physics failed to advance between observations');
  previous=s.flightT;losses=Math.max(losses,s.contextLosses||0);
 }
 if(samples.length>1&&samples.at(-1).flightT-samples[0].flightT<1)issues.add('Less than one second of simulated flight');
 if(samples.at(-1)?.contextLost)issues.add('Graphics context not restored');
 return{issues:[...issues],recoveredContextLosses:samples.at(-1)?.contextLost?0:losses};
}
