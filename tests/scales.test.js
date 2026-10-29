import test from 'node:test';
import assert from 'node:assert/strict';
import {scaleName,scaleNames,scaleColor} from '../public/scales.js';
import {weightWeek} from '../public/model.js';
test('scale inference is explicit, names are reusable and colours stable',()=>{
 assert.equal(scaleName({type:'weight',notes:'Scale: Clinic A; unclothed'}),'Clinic A');
 assert.equal(scaleName({type:'weight',notes:'Hospital visit'}),'');
 assert.equal(scaleName({type:'weight',scale:' Home ',notes:'Scale: Other'}),'Home');
 assert.deepEqual(scaleNames([{type:'weight',at:'1',scale:'Home'},{type:'weight',at:'2',scale:'home'},{type:'weight',at:'3',scale:'Deleted',deleted:1}]),['Home']);
 assert.equal(scaleColor('Home'),scaleColor('home'));assert.notEqual(scaleColor('Home'),scaleColor(''));
});
test('same-scale seven-day comparison excludes other scales',()=>{
 const rows=[{id:'a',type:'weight',at:'2026-01-01T00:00:00Z',value:3500,scale:'A'},{id:'b',type:'weight',at:'2026-01-04T00:00:00Z',value:3900,scale:'B'},{id:'c',type:'weight',at:'2026-01-07T00:00:00Z',value:3620,scale:'A'}];
 const result=weightWeek(rows.filter(e=>scaleName(e)==='A'),Date.parse('2026-01-08T00:00:00Z'));assert.equal(result.gramsPerDay,20);
});
