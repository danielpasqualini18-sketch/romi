import test from 'node:test';
import assert from 'node:assert/strict';
import {weightWeek} from '../public/model.js';
const row=(day,value,extra={})=>({id:`${day}-${value}`,type:'weight',at:`2026-01-${String(day).padStart(2,'0')}T04:00:00Z`,value,scale:'A',...extra});
const end=Date.parse('2026-02-01T00:00:00Z');
test('daily means get equal weight and all daily points determine the slope',()=>{
 const rows=[row(1,3000),row(2,3080),row(2,3120,{scale:'B'}),row(3,3000),row(4,3100)];
 const w=weightWeek(rows,end,'Australia/Perth');assert.equal(w.gramsPerDay,20);assert.equal(w.daily[1].value,3100);assert.equal(w.recordedDays,4);assert.equal(w.readingCount,5);assert.equal(w.mixedScales,true);
 const more=weightWeek([...rows,row(2,3100),row(2,3100)],end,'Australia/Perth');assert.equal(more.gramsPerDay,w.gramsPerDay);
});
test('window contains exactly seven dates; gaps remain empty and use calendar distance',()=>{
 const w=weightWeek([row(1,2000),row(2,3000),row(5,3060),row(8,3120)],end,'Australia/Perth');assert.equal(w.recordedDays,3);assert.equal(w.coveredDays,6);assert.equal(w.gramsPerDay,20);assert.equal(w.daily[0].date,'2026-01-02');
 assert.equal(weightWeek([row(1,3000),row(8,3120)],end).gramsPerDay,null);
});
test('same-day readings alone are insufficient; latest remains an individual reading',()=>{
 const w=weightWeek([row(1,3000),row(1,3020)],end);assert.equal(w.gramsPerDay,null);assert.equal(w.recordedDays,1);assert.equal(w.latest.value,3020);assert.equal(w.daily[0].value,3010);
});
test('Perth midnight groups correctly and excludes deleted, future and other activities',()=>{
 const e=[row(1,3000,{at:'2026-01-01T15:59:00Z'}),row(1,3020,{at:'2026-01-01T16:01:00Z'}),row(3,9000,{deleted:1}),row(3,8000,{type:'bottle'}),row(3,7000)];
 const w=weightWeek(e,Date.parse('2026-01-02T00:00:00Z'),'Australia/Perth');assert.equal(w.recordedDays,2);assert.equal(w.gramsPerDay,20);
});
