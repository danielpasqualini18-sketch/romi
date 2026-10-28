import test from 'node:test';
import assert from 'node:assert/strict';
import {openDialog,closeDialog,scrollToSection} from '../public/motion.js';
function dialog(){
 const animations=[],attributes=new Set();return {open:false,animations,attributes,focus(){this.focused=true;},showModal(){this.open=true;},close(){this.open=false;},setAttribute:k=>attributes.add(k),removeAttribute:k=>attributes.delete(k),animate(frames,options){let resolve,reject;const finished=new Promise((a,b)=>{resolve=a;reject=b;});const animation={frames,options,finished,finish:resolve,cancel:()=>reject(Error('cancelled'))};animations.push(animation);return animation;}};
}
test('dialog remains modal during exit and closes when the animation finishes',async()=>{
 const d=dialog();openDialog(d);assert.equal(d.open,true);assert.equal(d.focused,true);assert.equal(d.attributes.has('tabindex'),true);const closing=closeDialog(d);assert.equal(d.open,true);assert.equal(d.attributes.has('data-closing'),true);d.animations.at(-1).finish();await closing;assert.equal(d.open,false);assert.equal(d.attributes.has('data-closing'),false);
});
test('reopening during exit cancels the old close without closing the new dialog',async()=>{
 const d=dialog();openDialog(d);const closing=closeDialog(d);openDialog(d);await closing;assert.equal(d.open,true);assert.equal(d.attributes.has('data-closing'),false);d.animations.at(-1).finish();
});
test('reduced motion closes immediately and navigation uses instant scrolling',async()=>{
 const previous=globalThis.matchMedia;globalThis.matchMedia=()=>({matches:true});try{
  const d=dialog();openDialog(d);assert.equal(d.animations.length,0);await closeDialog(d);assert.equal(d.open,false);
  let options;scrollToSection({scrollIntoView:o=>options=o});assert.equal(options.behavior,'instant');
 }finally{globalThis.matchMedia=previous;}
});
test('gentle scrolling reaches its target and yields immediately to user input',()=>{
 const keys=['window','document','requestAnimationFrame','cancelAnimationFrame'],prior=Object.fromEntries(keys.map(k=>[k,globalThis[k]]));
 const frames=new Map();let id=0;const page=new EventTarget();page.scrollY=0;page.innerHeight=800;page.scrollTo=({top})=>page.scrollY=top;
 try{
  globalThis.window=page;globalThis.document={documentElement:{scrollHeight:3000}};
  globalThis.requestAnimationFrame=f=>{frames.set(++id,f);return id;};globalThis.cancelAnimationFrame=i=>frames.delete(i);
  const tick=time=>{const batch=[...frames];frames.clear();for(const [,f] of batch)f(time);};
  const target={closest:()=>null,getBoundingClientRect:()=>({top:1000})};
  scrollToSection(target);tick(0);tick(425);assert.ok(page.scrollY>0&&page.scrollY<990);tick(850);assert.equal(page.scrollY,990);assert.equal(frames.size,0);
  page.scrollY=0;scrollToSection(target);tick(1000);page.dispatchEvent(new Event('wheel'));assert.equal(frames.size,0);assert.equal(page.scrollY,0);
 }finally{for(const k of keys){if(prior[k]===undefined)delete globalThis[k];else globalThis[k]=prior[k];}}
});

test('panels of different heights travel at the same fixed speed in both directions',async()=>{
 const previous=globalThis.innerHeight;globalThis.innerHeight=1000;
 try{
  const durations=[];
  for(const top of [650,150]){
   const d=dialog();d.getBoundingClientRect=()=>({top});openDialog(d);
   const opening=d.animations.at(-1),distance=1024-top;durations.push(opening.options.duration);
   assert.equal(opening.options.easing,'linear');assert.ok(Math.abs(distance/opening.options.duration-2.4)<.000001);
   const closing=closeDialog(d),exit=d.animations.at(-1);assert.equal(exit.options.duration,opening.options.duration);exit.finish();await closing;
  }
  assert.ok(durations[1]>durations[0]);
 }finally{if(previous===undefined)delete globalThis.innerHeight;else globalThis.innerHeight=previous;}
});
