// Gentle, interruptible interaction motion. No animation on polling or timer ticks.
const active=new WeakMap();
export const reducedMotion=()=>globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches??false;
const easing='cubic-bezier(.2,.8,.2,1)';
function stop(node){const old=active.get(node);if(old){active.delete(node);old.animation?.cancel();}}
function play(node,frames,options={}){
 if(!node?.animate||reducedMotion())return null;
 return node.animate(frames,{duration:420,easing,...options});
}
export function reveal(node,{stagger=false}={}){
 if(!node||reducedMotion())return;
 stop(node);
 const animation=play(node,[{opacity:0,transform:'translateY(8px)'},{opacity:1,transform:'translateY(0)'}]);
 if(animation){const state={animation};active.set(node,state);animation.finished.catch(()=>{}).finally(()=>{if(active.get(node)===state)active.delete(node);});}
 if(stagger)Array.from(node.querySelectorAll('.entry,.weight-record,.weight-stat')).slice(0,10).forEach((row,i)=>play(row,[{opacity:0,transform:'translateY(6px)'},{opacity:1,transform:'translateY(0)'}],{duration:460,delay:i*32,fill:'backwards'}));
}
export function openDialog(dialog){
 // Discard an old expanding-section animation before displaying a new record.
 for(const details of dialog.querySelectorAll?.('details')||[]){const old=active.get(details);if(old?.expanding!==undefined){stop(details);details.style.overflow=old.overflow;}}
 stop(dialog);dialog.removeAttribute('data-closing');
 dialog.setAttribute('tabindex','-1');
 if(!dialog.open)dialog.showModal();
 dialog.focus?.({preventScroll:true});
 const rect=dialog.getBoundingClientRect?.();
 const travel=rect&&globalThis.innerHeight?Math.max(120,globalThis.innerHeight-rect.top+24):180;
 const animation=play(dialog,[
  {opacity:0,transform:`translateY(${travel}px)`,offset:0},
  {opacity:1,transform:`translateY(${travel*.5}px)`,offset:.5},
  {opacity:1,transform:'translateY(0)',offset:1}
 ],{duration:612,easing:'linear'});
 if(animation){const state={animation};active.set(dialog,state);animation.finished.catch(()=>{}).finally(()=>{if(active.get(dialog)===state)active.delete(dialog);});}
}
export async function closeDialog(dialog){
 if(!dialog.open)return;
 const pending=active.get(dialog);if(pending?.closing)return pending.promise;
 stop(dialog);
 dialog.setAttribute('data-closing','');
 const rect=dialog.getBoundingClientRect?.();
 const travel=rect&&globalThis.innerHeight?Math.max(120,globalThis.innerHeight-rect.top+24):180;
 const animation=play(dialog,[{opacity:1,transform:'translateY(0)'},{opacity:0,transform:`translateY(${travel}px)`}],{duration:424,easing:'linear',fill:'forwards'});
 const state={animation,closing:true};active.set(dialog,state);
 state.promise=(async()=>{
  try{if(animation)await animation.finished;}catch{/* Interrupted by a new open. */}
  if(active.get(dialog)!==state)return;
  // Close while visually hidden, then remove the finished animation.
  if(dialog.open)dialog.close();
  animation?.cancel();dialog.removeAttribute('data-closing');active.delete(dialog);
 })();
 return state.promise;
}
let scrolling;
export function scrollToSection(node){
 if(!node)return;
 scrolling?.();
 if(reducedMotion()||!node.getBoundingClientRect||!globalThis.requestAnimationFrame){node.scrollIntoView({behavior:reducedMotion()?'instant':'smooth',block:'start'});return;}
 const container=node.closest('.sheet-body'),start=container?container.scrollTop:window.scrollY;
 const offset=container?node.getBoundingClientRect().top-container.getBoundingClientRect().top-18:node.getBoundingClientRect().top-10;
 const maximum=container?container.scrollHeight-container.clientHeight:document.documentElement.scrollHeight-window.innerHeight;
 const end=Math.max(0,Math.min(maximum,start+offset));
 if(Math.abs(end-start)<2)return;
 let frame,started;
 const controller=new AbortController();
 const cancel=()=>{cancelAnimationFrame(frame);controller.abort();if(scrolling===cancel)scrolling=null;};
 scrolling=cancel;
 // Touch, wheel or keyboard input always takes control back immediately.
 for(const type of ['wheel','touchstart','pointerdown','keydown'])window.addEventListener(type,cancel,{passive:true,signal:controller.signal});
 const step=now=>{
  started??=now;const t=Math.min(1,(now-started)/850),ease=t<.5?4*t*t*t:1-Math.pow(-2*t+2,3)/2;
  const top=start+(end-start)*ease;
  if(container)container.scrollTo({top,behavior:'instant'});else window.scrollTo({top,behavior:'instant'});
  if(t<1)frame=requestAnimationFrame(step);else cancel();
 };
 frame=requestAnimationFrame(step);
}
export function installMotion(root=document){
 root.querySelectorAll('dialog:not(#refresh-feedback)').forEach(dialog=>dialog.addEventListener('cancel',event=>{event.preventDefault();closeDialog(dialog);}));
 root.addEventListener('click',event=>{
  const summary=event.target.closest('summary');if(!summary)return;
  const details=summary.parentElement;if(details.tagName!=='DETAILS')return;
  if(reducedMotion()||!details.animate)return;
  event.preventDefault();
  const start=details.getBoundingClientRect().height;
  const previous=active.get(details),opening=previous?.expanding===undefined?!details.open:!previous.expanding;
  stop(details);details.open=true;
  const end=opening?details.scrollHeight:summary.getBoundingClientRect().height;
  const overflow=previous?.overflow??details.style.overflow;details.style.overflow='hidden';
  const animation=play(details,[{height:start+'px'},{height:end+'px'}],{duration:420});
  const state={animation,expanding:opening,overflow};active.set(details,state);
  animation?.finished.catch(()=>{}).finally(()=>{
   if(active.get(details)!==state)return;
   details.open=opening;details.style.overflow=overflow;active.delete(details);
  });
 });
}
