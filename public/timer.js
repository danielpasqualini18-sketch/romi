// Wall-clock timestamps survive backgrounding; paused time is never accumulated.
export function timerAmounts(timer, now=Date.now()) {
 const a={left:timer.left_ms||0,right:timer.right_ms||0,generic:timer.generic_ms||0};
 if(timer.status==='running')a[timer.side]+=Math.max(0,now-Date.parse(timer.since));
 return a;
}
export function transition(timer, action, side, now=Date.now(), id) {
 const at=new Date(now).toISOString();
 if(action==='start'){
  if(timer.status!=='idle')throw Error('A feed is already in progress.');
  if(!['left','right'].includes(side))throw Error('Choose left or right.');
  return {id,at,status:'running',side,since:at,left_ms:0,right_ms:0,generic_ms:0};
 }
 if(timer.status==='idle')throw Error('No active feed. Refresh and try again.');
 if(action==='discard')return {status:'idle'};
 const a=timerAmounts(timer,now),next={...timer,left_ms:a.left,right_ms:a.right,generic_ms:a.generic,since:at};
 if(action==='pause')return {...next,status:'paused'};
 if(action==='switch'){
  if(!['left','right'].includes(side))throw Error('Choose left or right.');
  return {...next,status:'running',side};
 }
 if(action==='resume')return {...next,status:'running'};
 throw Error('Unknown timer action.');
}
export function timerRecord(timer, now=Date.now()) {
 const a=timerAmounts(timer,now),left=Math.floor(a.left/1000),right=Math.floor(a.right/1000),generic=Math.floor(a.generic/1000);
 return {id:timer.id,type:'breast',at:timer.at,notes:'',value:null,side:left&&right?'both':left?'left':right?'right':['left','right'].includes(timer.side)?timer.side:'',duration_seconds:left+right+generic,left_seconds:left,right_seconds:right};
}
