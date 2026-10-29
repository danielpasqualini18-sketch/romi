// Only explicit scale labels are inferred; locations or clinical context alone are not scales.
export function scaleName(e){
 if(e.type!=='weight')return '';
 if(e.scale?.trim())return e.scale.trim();
 return /(?:^|[;\n])\s*scale\s*[:=]\s*([^;\n]+)/i.exec(e.notes||'')?.[1].trim().slice(0,80)||'';
}
export function scaleNames(events){
 const names=new Map();
 for(const e of events.filter(e=>!e.deleted&&e.type==='weight').sort((a,b)=>a.at.localeCompare(b.at))){const n=scaleName(e);if(n&&!names.has(n.toLocaleLowerCase()))names.set(n.toLocaleLowerCase(),n);}
 return [...names.values()].sort((a,b)=>a.localeCompare(b));
}
export function scaleColor(name){
 if(!name)return '#b4b0a8';
 let hash=0;for(const c of name.toLocaleLowerCase())hash=(hash*31+c.charCodeAt(0))>>>0;
 return `hsl(${hash%360} 58% 72%)`;
}
