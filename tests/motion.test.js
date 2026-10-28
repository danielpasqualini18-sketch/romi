import test from 'node:test';
import assert from 'node:assert/strict';
import {openDialog,closeDialog,scrollToSection} from '../public/motion.js';
function dialog(){
 const animations=[],attributes=new Set();return {open:false,animations,attributes,showModal(){this.open=true;},close(){this.open=false;},setAttribute:k=>attributes.add(k),removeAttribute:k=>attributes.delete(k),animate(){let resolve,reject;const finished=new Promise((a,b)=>{resolve=a;reject=b;});const animation={finished,finish:resolve,cancel:()=>reject(Error('cancelled'))};animations.push(animation);return animation;}};
}
test('dialog remains modal during exit and closes when the animation finishes',async()=>{
 const d=dialog();openDialog(d);assert.equal(d.open,true);const closing=closeDialog(d);assert.equal(d.open,true);assert.equal(d.attributes.has('data-closing'),true);d.animations.at(-1).finish();await closing;assert.equal(d.open,false);assert.equal(d.attributes.has('data-closing'),false);
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
