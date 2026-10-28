import test from 'node:test';
import assert from 'node:assert/strict';
import {bindRefreshFeedback} from '../public/refresh-ui.js';
function controls(){
 const handlers={},attributes=new Map(),messages=[];
 const button={disabled:false,blurred:false,focused:false,addEventListener:(n,f)=>handlers[n]=f,setAttribute:(k,v)=>attributes.set(k,v),removeAttribute:k=>attributes.delete(k),blur(){this.blurred=true;},focus(){this.focused=true;}};
 const dialog={open:false,addEventListener:(n,f)=>handlers[n]=f,showModal(){this.open=true;},close(){this.open=false;}};
 return {button,dialog,handlers,attributes,messages,notify:m=>messages.push(m)};
}
test('manual refresh shows feedback immediately, blocks duplicates, then resets touch state',async()=>{
 const c=controls();let finish,calls=0;
 bindRefreshFeedback({...c,minimumMs:0,refresh:()=>{calls++;return new Promise(r=>finish=r);}});
 const pending=c.handlers.click({detail:1});assert.equal(c.dialog.open,true);assert.equal(c.button.disabled,true);assert.equal(c.attributes.get('aria-busy'),'true');
 await c.handlers.click({detail:1});assert.equal(calls,1);
 finish();await pending;assert.equal(c.dialog.open,false);assert.equal(c.button.disabled,false);assert.equal(c.button.blurred,true);assert.equal(c.attributes.has('aria-busy'),false);assert.deepEqual(c.messages,['Tracker refreshed.']);
});
test('failed refresh closes feedback, keeps keyboard focus and allows retry',async()=>{
 const c=controls();let fail=true;
 bindRefreshFeedback({...c,minimumMs:0,refresh:async()=>{if(fail)throw Error('Offline');}});
 await c.handlers.click({detail:0});assert.equal(c.dialog.open,false);assert.equal(c.button.disabled,false);assert.equal(c.button.focused,true);assert.equal(c.messages[0],'Offline');
 fail=false;await c.handlers.click({detail:0});assert.equal(c.messages[1],'Tracker refreshed.');
});
test('timed-out fetch is aborted and overlay cannot leave the page blocked',async()=>{
 const c=controls();let aborted=false;
 bindRefreshFeedback({...c,minimumMs:0,timeoutMs:5,refresh:signal=>new Promise((_,reject)=>signal.addEventListener('abort',()=>{aborted=true;reject(new Error('Aborted'));}))});
 await c.handlers.click({detail:1});assert.equal(aborted,true);assert.equal(c.dialog.open,false);assert.equal(c.button.disabled,false);assert.match(c.messages[0],/timed out/);
});
