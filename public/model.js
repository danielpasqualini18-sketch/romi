import {scaleName} from './scales.js';
import {calendarDate} from './dates.js';
export const TYPES = ['breast','bottle','pump','nappy','weight','note','vomit'];
export function validate(e,timeZone='UTC') {
 if (!e || !TYPES.includes(e.type) || typeof e.id !== 'string' || !/^[\w-]{1,100}$/.test(e.id)) throw Error('Invalid record');
 if (typeof e.at !== 'string' || !/^\d{4}-\d\d-\d\dT/.test(e.at) || !Number.isFinite(Date.parse(e.at))) throw Error('Choose a valid date and time');
 if (e.type==='weight'&&e.date_only?calendarDate(e.at,timeZone)>calendarDate(Date.now(),timeZone):Date.parse(e.at)>Date.now()+300000) throw Error('Time is in the future');
 if(e.scale!=null&&(typeof e.scale!=='string'||e.scale.trim().length>80))throw Error('Scale name must be under 80 characters');
 const value = e.value == null || e.value === '' ? null : Number(e.value);
 if (value !== null && (!Number.isFinite(value) || value < 0 || value > (e.type==='weight'?30000:2000))) throw Error('Check the amount');
 if (e.type === 'weight' && !(value > 0)) throw Error('Enter weight in grams');
 if (!['','formula','ebm'].includes(e.milk || '')) throw Error('Invalid milk type');
 if (!['','small','medium','heavy'].includes(e.wet_size || '')) throw Error('Invalid wet nappy size');
 if (!['','small','big'].includes(e.poo_size || '')) throw Error('Invalid stool size');
 if (e.type==='vomit' && !['small','big'].includes(e.vomit_size)) throw Error('Choose small or large spit-up');
 if (typeof e.notes !== 'string' || e.notes.length > 2000) throw Error('Notes must be under 2,000 characters');
 if (!['','left','right','both','comfort'].includes(e.side || '')) throw Error('Invalid breast side');
 if (e.type==='nappy' && !e.wet && !e.poo) throw Error('Choose wet, dirty or both');
 const durations={};
 for(const key of ['duration_seconds','left_seconds','right_seconds']){const n=e[key]==null||e[key]===''?null:Number(e[key]);if(n!==null&&(!Number.isInteger(n)||n<0||n>86400))throw Error('Duration must be between 0 and 1,440 minutes.');durations[key]=e.type==='breast'?n:null;}
 if(durations.duration_seconds===null&&(durations.left_seconds!==null||durations.right_seconds!==null))throw Error('Enter the total duration.');
 if((durations.left_seconds||0)+(durations.right_seconds||0)>(durations.duration_seconds||0))throw Error('Left and right time cannot exceed the total.');
 return {...durations,scale:scaleName(e),id:e.id, at:new Date(e.at).toISOString(), type:e.type, value, side:e.side||'', wet:e.type==='nappy'&&e.wet?1:0, poo:e.type==='nappy'&&e.poo?1:0, notes:e.notes, date_only:e.type==='weight'&&e.date_only?1:0, vomit_size:e.type==='vomit'?e.vomit_size:'', milk:e.type==='bottle'?e.milk||'':'', wet_size:e.type==='nappy'&&e.wet?e.wet_size||'':'', poo_size:e.type==='nappy'&&e.poo?e.poo_size||'':'', revision:Number.isInteger(e.revision)&&e.revision>0?e.revision:0};
}
export function totals(events) {
 const t = {breastSeconds:0,timedBreast:0,breast:0,bottles:0,bottleMl:0,unknownBottles:0,pumps:0,pumpMl:0,unknownPumps:0,wet:0,poo:0,nappies:0,formulaMl:0,ebmMl:0,unspecifiedMl:0,wetSmall:0,wetMedium:0,wetHeavy:0,wetUnspecified:0,pooSmall:0,pooBig:0,pooUnspecified:0,vomit:0,vomitSmall:0,vomitBig:0};
 for (const e of events) {
  if (e.type==='vomit') {t.vomit++;t[e.vomit_size==='small'?'vomitSmall':'vomitBig']++;}
  if (e.type==='breast') {t.breast++;if(e.duration_seconds!=null){t.timedBreast++;t.breastSeconds+=Number(e.duration_seconds);}}
  if (e.type==='bottle') { t.bottles++; if(e.value==null)t.unknownBottles++;else {t.bottleMl+=Number(e.value);t[e.milk==='formula'?'formulaMl':e.milk==='ebm'?'ebmMl':'unspecifiedMl']+=Number(e.value);} }
  if (e.type==='pump') { t.pumps++;if(e.value==null)t.unknownPumps++;else t.pumpMl+=Number(e.value); }
  if (e.type==='nappy') {t.nappies++;t.wet+=Number(!!e.wet);t.poo+=Number(!!e.poo);if(e.wet)t[{small:'wetSmall',medium:'wetMedium',heavy:'wetHeavy'}[e.wet_size]||'wetUnspecified']++;if(e.poo)t[{small:'pooSmall',big:'pooBig'}[e.poo_size]||'pooUnspecified']++;}
 }
 return t;
}
export function stats(events, end=Date.now()) {
 const valid = events.filter(e=>!e.deleted && Date.parse(e.at)<=end).sort((a,b)=>a.at.localeCompare(b.at));
 const start=end-86400000, recent=valid.filter(e=>Date.parse(e.at)>start);
 const days=valid.length?Math.max((end-Date.parse(valid[0].at))/86400000,1):1;
 return {all:totals(valid),recent:totals(recent),days,first:valid[0]?.at,start,end};
}
export function daily(events,timeZone='UTC') {
 const days = new Map();
 for (const e of events.filter(e=>!e.deleted)) {
  const day = calendarDate(e.at,timeZone);
  if(!days.has(day))days.set(day,[]); days.get(day).push(e);
 }
 return [...days].sort(([a],[b])=>b.localeCompare(a)).map(([day,rows])=>({day,...totals(rows)}));
}

// Rolling windows use elapsed hours, independent of calendar dates.
export function periodTotals(events, days, end = Date.now()) {
 const start = end - days * 86400000;
 return totals(events.filter(e => !e.deleted && Date.parse(e.at) > start && Date.parse(e.at) <= end));
}

// Rates are calculated between consecutive recorded weigh-ins using elapsed time.
export function weightTrend(events, end = Date.now(),timeZone='UTC') {
 const rows = events.filter(e => !e.deleted && e.type === 'weight' && Number(e.value) > 0 && Number.isFinite(Number(e.value)) && Number.isFinite(Date.parse(e.at)) && Date.parse(e.at) <= end)
  .sort((a,b) => Date.parse(a.at) - Date.parse(b.at) || a.id.localeCompare(b.id));
 return rows.map((row, index) => {
  const previous = rows[index - 1];
  const dayStamp=e=>Date.parse(calendarDate(e.at,timeZone));
  const calendarDays=!!(row.date_only||previous?.date_only);
  const elapsedDays = previous ? (calendarDays ? (dayStamp(row)-dayStamp(previous))/86400000 : (Date.parse(row.at)-Date.parse(previous.at))/86400000) : null;
  const gain = previous ? Number(row.value) - Number(previous.value) : null;
  return {...row, elapsedDays, calendarDays, gain, gramsPerDay: elapsedDays > 0 ? gain / elapsedDays : null};
 });
}

// Average observed daily change from the first to last weigh-in in the trailing week.
// The covered interval is returned so a partial week's data is never called seven days of readings.
export function weightWeek(events, end = Date.now(),timeZone='UTC') {
 const rows = weightTrend(events,end,timeZone), latest = rows.at(-1);
 if(!latest)return {latest:null,gramsPerDay:null,coveredDays:0,gain:null,first:null};
 const latestTime=Date.parse(latest.at);
 const calendarDays=!!latest.date_only||rows.some(e=>e.date_only&&Date.parse(e.at)>=latestTime-7*86400000);
 const stamp=e=>calendarDays?Date.parse(calendarDate(e.at,timeZone)):Date.parse(e.at);
 const cutoff=stamp(latest)-7*86400000;
 const first=rows.find(e=>stamp(e)>=cutoff&&stamp(e)<stamp(latest));
 if(!first)return {latest,gramsPerDay:null,coveredDays:0,gain:null,first:null};
 const coveredDays=(stamp(latest)-stamp(first))/86400000;
 const gain=Number(latest.value)-Number(first.value);
 return {latest,first,gain,coveredDays,gramsPerDay:gain/coveredDays,calendarDays};
}
