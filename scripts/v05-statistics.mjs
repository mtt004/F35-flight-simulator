// Nearest-rank descriptive statistics. Raw observations remain in the report.
export function frameStatistics(intervals) {
 const values=intervals.filter(v=>Number.isFinite(v)&&v>0).sort((a,b)=>a-b);
 const quantile=p=>values.length?values[Math.min(values.length-1,Math.max(0,Math.ceil(values.length*p)-1))]:null;
 const worst=values.slice(-Math.max(1,Math.ceil(values.length*.01)));
 return {samples:values.length,medianFps:values.length?1000/quantile(.5):null,
  onePercentLowFps:values.length?1000/(worst.reduce((a,b)=>a+b,0)/worst.length):null,
  frameMs:{p50:quantile(.5),p95:quantile(.95),p99:quantile(.99),max:values.at(-1)??null},
  stuttersOver100ms:values.filter(v=>v>100).length};
}
export function pairedChanges(pairs) {
 const values=pairs.map(([before,after])=>before>0&&Number.isFinite(before+after)?100*(after/before-1):null).filter(v=>v!==null).sort((a,b)=>a-b);
 return {pairs:values.length,percentChanges:values,medianPercentChange:values.length?values[Math.floor(values.length/2)]:null,
  minPercentChange:values.at(0)??null,maxPercentChange:values.at(-1)??null,
  inference:'Paired descriptive range; three repeats cannot establish a narrow confidence interval or physical-device speedup.'};
}
