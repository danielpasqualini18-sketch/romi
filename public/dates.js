export function localDateTime(value,timeZone='UTC') {
 const p=Object.fromEntries(new Intl.DateTimeFormat('en-GB',{timeZone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(new Date(value)).map(x=>[x.type,x.value]));
 return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;
}
export const calendarDate=(value,timeZone='UTC')=>localDateTime(value,timeZone).slice(0,10);
// Resolve local wall time using offsets around that date, including DST transitions.
// Fall-back repetitions choose the earlier occurrence; spring-forward gaps are rejected.
export function parseLocal(value,timeZone='UTC') {
 if(!/^\d{4}-\d\d-\d\dT\d\d:\d\d$/.test(value))throw Error('Choose a valid date and time.');
 const wall=Date.parse(value+':00Z');if(!Number.isFinite(wall)||new Date(wall).toISOString().slice(0,16)!==value)throw Error('Choose a valid date and time.');
 const offsets=new Set([-36,0,36].map(h=>{const t=wall+h*3600000;return Date.parse(localDateTime(t,timeZone)+':00Z')-t;}));
 const matches=[...offsets].map(offset=>wall-offset).filter(t=>localDateTime(t,timeZone)===value).sort((a,b)=>a-b);
 if(!matches.length)throw Error('That local time does not exist because the clocks change. Choose another time.');
 return new Date(matches[0]).toISOString();
}
