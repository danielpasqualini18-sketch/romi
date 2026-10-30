import {scaleName} from './scales.js';
// Seven local calendar dates ending on the latest weigh-in date, inclusive.
// Each recorded date gets one vote, regardless of its number of readings.
export function dailyWeightTrend(rows,timeZone){
 const latest=rows.at(-1),empty={latest:latest||null,first:null,gramsPerDay:null,coveredDays:0,gain:null,recordedDays:0,readingCount:0,mixedScales:false,unknownScales:false,daily:[]};
 if(!latest)return empty;
 const day=at=>new Intl.DateTimeFormat('en-CA',{timeZone,year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(at));
 const lastDay=day(latest.at),stamp=d=>Date.parse(d+'T00:00:00Z')/86400000,cutoff=stamp(lastDay)-6,groups=new Map();
 for(const row of rows){const date=day(row.at);if(stamp(date)<cutoff)continue;if(!groups.has(date))groups.set(date,[]);groups.get(date).push(row);}
 const daily=[...groups].sort(([a],[b])=>a.localeCompare(b)).map(([date,entries])=>({date,value:entries.reduce((sum,e)=>sum+Number(e.value),0)/entries.length,count:entries.length}));
 const included=[...groups.values()].flat(),scales=new Set(included.map(e=>scaleName(e).toLocaleLowerCase()).filter(Boolean));
 const first=daily[0],last=daily.at(-1),coveredDays=stamp(last.date)-stamp(first.date),n=daily.length;
 const result={...empty,first,coveredDays,gain:last.value-first.value,recordedDays:n,readingCount:included.length,mixedScales:scales.size>1,unknownScales:included.some(e=>!scaleName(e)),daily};
 if(n<2)return result;
 const points=daily.map(e=>({x:stamp(e.date)-stamp(first.date),y:e.value})),meanX=points.reduce((s,e)=>s+e.x,0)/n,meanY=points.reduce((s,e)=>s+e.y,0)/n;
 result.gramsPerDay=points.reduce((s,e)=>s+(e.x-meanX)*(e.y-meanY),0)/points.reduce((s,e)=>s+(e.x-meanX)**2,0);
 return result;
}
