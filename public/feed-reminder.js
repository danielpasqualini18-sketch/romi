// Relative days follow the tracker's timezone, including around midnight and DST.
export function feedWhen(at,timeZone,now=Date.now()){
 const parts=value=>Object.fromEntries(new Intl.DateTimeFormat('en-AU',{timeZone,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date(value)).filter(p=>p.type!=='literal').map(p=>[p.type,p.value]));
 const today=parts(now),feed=parts(at),key=p=>`${p.year}-${p.month}-${p.day}`;
 const yesterday=new Date(Date.UTC(Number(today.year),Number(today.month)-1,Number(today.day)-1)).toISOString().slice(0,10);
 const day=key(feed)===key(today)?'Today':key(feed)===yesterday?'Yesterday':new Intl.DateTimeFormat('en-AU',{timeZone,day:'numeric',month:'short',...(feed.year!==today.year?{year:'numeric'}:{})}).format(new Date(at));
 const time=new Intl.DateTimeFormat('en-AU',{timeZone,hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date(at));
 return `${day} at ${time}`;
}
