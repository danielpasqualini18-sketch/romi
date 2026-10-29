import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {stats,totals,validate} from '../public/model.js';
import worker,{authorized} from '../src/worker.js';
const make=(type,at='2025-10-26T10:00:00Z',extra={})=>({id:crypto.randomUUID(),type,at,value:null,notes:'',...extra});
function environment(){const db=new DatabaseSync(':memory:');for(const name of ['0001_initial.sql','0002_weight_scales.sql'])db.exec(readFileSync(new URL('../migrations/'+name,import.meta.url),'utf8'));const wrap=(sql,args=[])=>({bind(...a){return wrap(sql,a);},async run(){const r=db.prepare(sql).run(...args);return {meta:{changes:Number(r.changes)}};},async all(){return {results:db.prepare(sql).all(...args)};}});return {LOCAL_DEV:'true',DB:{prepare:wrap,async batch(statements){db.exec('BEGIN');try{const r=[];for(const s of statements)r.push(await s.run());db.exec('COMMIT');return r;}catch(e){db.exec('ROLLBACK');throw e;}}},ASSETS:{fetch:async()=>new Response('asset')}};}
const req=(path,method='GET',body,origin='http://localhost')=>new Request('http://localhost'+path,{method,headers:body?{'Content-Type':'application/json',Origin:origin}:{},body:body?JSON.stringify(body):undefined});
test('combined nappy counts once as a change and once in both categories',()=>{const t=totals([make('nappy',undefined,{wet:1,poo:1,wet_size:'heavy',poo_size:'small'})]);assert.equal(t.nappies,1);assert.equal(t.wet,1);assert.equal(t.poo,1);assert.equal(t.wetHeavy,1);assert.equal(t.pooSmall,1);});
test('unknown bottle volume stays unknown and EBM/formula remain separate',()=>{const t=totals([make('bottle',undefined,{value:30,milk:'ebm'}),make('bottle',undefined,{value:40,milk:'formula'}),make('bottle')]);assert.equal(t.bottleMl,70);assert.equal(t.ebmMl,30);assert.equal(t.formulaMl,40);assert.equal(t.unknownBottles,1);});
test('rolling 24h excludes start boundary, includes end, ignores future',()=>{const end=Date.parse('2025-10-27T07:00:00+08:00');const s=stats([make('breast','2025-10-26T07:00:00+08:00'),make('breast','2025-10-26T07:00:01+08:00'),make('breast','2025-10-27T07:00:00+08:00'),make('breast','2025-10-28T07:00:00+08:00')],end);assert.equal(s.recent.breast,2);});

test('validates quantities and categorical fields',()=>{assert.throws(()=>validate(make('weight',undefined,{value:0})));assert.throws(()=>validate(make('bottle',undefined,{value:-1})));assert.throws(()=>validate(make('bottle',undefined,{milk:'cow'})));assert.throws(()=>validate(make('nappy',undefined,{wet:1,wet_size:'huge'})));assert.throws(()=>validate(make('nappy')));});
test('production fails closed without Access configuration, including assets',async()=>{const env=environment();env.LOCAL_DEV='false';assert.equal((await worker.fetch(req('/'),env)).status,401);assert.equal((await worker.fetch(req('/api/events'),env)).status,401);assert.equal((await worker.fetch(req('/api/timer'),env)).status,401);assert.equal(await authorized(new Request('https://tracker.example.com/'),{LOCAL_DEV:'true'}),false);});
test('full SQLite CRUD, idempotent retries, conflicts and deletion',async()=>{const env=environment(),record=make('bottle',undefined,{value:30,milk:'ebm'});assert.equal((await worker.fetch(req('/api/events','POST',record),env)).status,200);await worker.fetch(req('/api/events','POST',record),env);let rows=(await (await worker.fetch(req('/api/events'),env)).json()).events;assert.equal(rows.length,1);assert.equal(rows[0].milk,'ebm');const updated={...rows[0],value:45};assert.equal((await worker.fetch(req('/api/events/'+record.id,'PUT',updated),env)).status,200);assert.equal((await worker.fetch(req('/api/events/'+record.id,'PUT',updated),env)).status,409);assert.equal((await worker.fetch(req('/api/events/'+record.id,'DELETE',{revision:2}),env)).status,200);rows=(await (await worker.fetch(req('/api/events'),env)).json()).events;assert.equal(rows.length,0);});
test('wrong-origin writes rejected and invalid import has no partial writes',async()=>{const env=environment();assert.equal((await worker.fetch(req('/api/events','POST',make('breast'),'https://evil.example'),env)).status,403);assert.equal((await worker.fetch(req('/api/events','POST',[make('breast'),make('bottle',undefined,{value:-1})]),env)).status,400);const data=await (await worker.fetch(req('/api/events'),env)).json();assert.equal(data.events.length,0);});
test('Access validates signature, issuer, audience and expiry',async()=>{const keys=await crypto.subtle.generateKey({name:'RSASSA-PKCS1-v1_5',modulusLength:2048,publicExponent:new Uint8Array([1,0,1]),hash:'SHA-256'},true,['sign','verify']);const jwk=await crypto.subtle.exportKey('jwk',keys.publicKey);jwk.kid='test-key';const oldFetch=globalThis.fetch;globalThis.fetch=async()=>Response.json({keys:[jwk]});try{const env={ACCESS_TEAM_DOMAIN:'test-team.cloudflareaccess.com',ACCESS_AUD:'test-aud',ALLOWED_EMAILS:'parent-one@example.com,parent-two@example.com'},b64=x=>Buffer.from(JSON.stringify(x)).toString('base64url');const token=async(p)=>{const data=b64({alg:'RS256',kid:'test-key'})+'.'+b64(p);const sig=await crypto.subtle.sign('RSASSA-PKCS1-v1_5',keys.privateKey,new TextEncoder().encode(data));return data+'.'+Buffer.from(sig).toString('base64url');};const p={email:'parent-one@example.com',iss:'https://test-team.cloudflareaccess.com',aud:['test-aud'],exp:Date.now()/1000+3600};const check=async t=>authorized(new Request('https://example.com',{headers:{'Cf-Access-Jwt-Assertion':t}}),env);assert.equal(await check(await token(p)),true);assert.equal(await check(await token({...p,email:'parent-two@example.com'})),true);assert.equal(await check(await token({...p,email:'stranger@example.com'})),false);assert.equal(await check(await token({...p,email:undefined})),false);assert.equal(await check(await token({...p,aud:['wrong']})),false);assert.equal(await check(await token({...p,exp:0})),false);assert.equal(await check(await token({...p,iss:'https://evil.example'})),false);const real=await token(p);assert.equal(await check(real.slice(0,-10)+'AAAAAAAAAA'),false);}finally{globalThis.fetch=oldFetch;}});

test('vomit persists with size and supports edits and deletion',async()=>{
 const env=environment(),v=make('vomit',undefined,{vomit_size:'small'});
 assert.equal((await worker.fetch(req('/api/events','POST',v),env)).status,200);
 let rows=(await (await worker.fetch(req('/api/events'),env)).json()).events;
 assert.equal(rows[0].vomit_size,'small');assert.equal(totals(rows).vomitSmall,1);
 assert.equal((await worker.fetch(req('/api/events/'+v.id,'PUT',{...rows[0],vomit_size:'big'}),env)).status,200);
 rows=(await (await worker.fetch(req('/api/events'),env)).json()).events;
 assert.equal(totals(rows).vomitBig,1);assert.equal(totals(rows).vomitSmall,0);
 assert.equal((await worker.fetch(req('/api/events/'+v.id,'DELETE',{revision:2}),env)).status,200);
 assert.throws(()=>validate(make('vomit',undefined,{vomit_size:'medium'})));
 assert.throws(()=>validate(make('vomit')));
});

test('live recaps share an endpoint and keep 24h/7d boundary counts exact',async()=>{
 const {periodTotals}=await import('../public/model.js');const end=Date.parse('2025-10-27T08:00:00+08:00');
 const rows=[make('breast','2025-10-20T08:00:00+08:00'),make('breast','2025-10-20T08:00:01+08:00'),make('breast','2025-10-26T08:00:00+08:00'),make('breast','2025-10-27T08:00:00+08:00'),make('breast','2025-10-28T08:00:00+08:00'),make('breast','2025-10-27T07:00:00+08:00',{deleted:1})];
 assert.equal(periodTotals(rows,1,end).breast,1);assert.equal(periodTotals(rows,7,end).breast,3);
});
test('weight daily gain uses elapsed days including fractional intervals',async()=>{
 const {weightTrend}=await import('../public/model.js');const rows=[make('weight','2025-10-21T00:00:00Z',{value:4100}),make('weight','2025-10-23T00:00:00Z',{value:4160}),make('weight','2025-10-24T12:00:00Z',{value:4190})];
 const trend=weightTrend(rows);assert.equal(trend[0].gramsPerDay,null);assert.equal(trend[1].gain,60);assert.equal(trend[1].elapsedDays,2);assert.equal(trend[1].gramsPerDay,30);assert.equal(trend[2].gramsPerDay,20);assert.equal(trend[2].elapsedDays,1.5);
});
test('weight trend handles losses, equal timestamps, deleted and future records',async()=>{
 const {weightTrend}=await import('../public/model.js');const first=make('weight','2025-10-21T00:00:00Z',{id:'a',value:4200}),second=make('weight','2025-10-22T00:00:00Z',{id:'b',value:4170}),same=make('weight','2025-10-22T00:00:00Z',{id:'c',value:4180});
 const trend=weightTrend([same,make('weight','2027-01-01T00:00:00Z',{value:5000}),first,second,make('weight','2025-10-23T00:00:00Z',{deleted:1,value:3900}),make('weight','invalid',{value:3900})],Date.parse('2025-10-27T00:00:00Z'));
 assert.equal(trend.length,3);assert.equal(trend[1].gramsPerDay,-30);assert.equal(trend[2].gramsPerDay,null);assert.equal(trend[2].gain,10);
});


test('date-only flags survive weight API updates',async()=>{
 const env=environment(),record=make('weight',undefined,{value:4210,date_only:1});
 await worker.fetch(req('/api/events','POST',record),env);
 let rows=(await(await worker.fetch(req('/api/events'),env)).json()).events;assert.equal(rows[0].date_only,1);
 assert.equal((await worker.fetch(req('/api/events/'+record.id,'PUT',{...rows[0],value:4220}),env)).status,200);
 rows=(await(await worker.fetch(req('/api/events'),env)).json()).events;assert.equal(rows[0].date_only,1);
});


test('7-day weight average needs two distinct observations inside the window',async()=>{
 const {weightWeek}=await import('../public/model.js');
 assert.equal(weightWeek([make('weight','2025-10-27T00:00:00Z',{value:4210})]).gramsPerDay,null);
 assert.equal(weightWeek([make('weight','2025-10-18T00:00:00Z',{value:4080}),make('weight','2025-10-27T00:00:00Z',{value:4210})]).gramsPerDay,null);
 const w=weightWeek([make('weight','2025-10-20T00:00:00Z',{value:4080}),make('weight','2025-10-27T00:00:00Z',{value:4210})]);assert.equal(w.coveredDays,7);assert.equal(w.gramsPerDay,130/7);
});

test('timer tracks both sides, excludes pauses and survives long gaps without browser ticks',async()=>{
 const {transition,timerRecord}=await import('../public/timer.js');const start=Date.parse('2025-10-26T10:00:00Z');
 let t=transition({status:'idle'},'start','left',start,'timer-test');
 assert.equal(timerRecord(t,start).side,'left');assert.throws(()=>transition({status:'idle'},'start','generic',start,'timer-generic'));assert.throws(()=>transition(t,'switch','generic',start));
 t=transition(t,'switch','right',start+600000);t=transition(t,'pause',null,start+900000);
 t=transition(t,'resume',null,start+1200000);t=transition(t,'pause',null,start+1500000);
 const r=timerRecord(t,start+1800000);assert.equal(r.duration_seconds,1200);assert.equal(r.left_seconds,600);assert.equal(r.right_seconds,600);assert.equal(r.side,'both');
 assert.throws(()=>transition(t,'start','left',start));
});
test('manual durations stay optional and validate split totals, then persist through edits and backup import',async()=>{
 assert.equal(validate(make('breast')).duration_seconds,null);
 for(const extra of [{duration_seconds:-1},{duration_seconds:90000},{duration_seconds:60,left_seconds:61},{left_seconds:30}])assert.throws(()=>validate(make('breast',undefined,extra)));
 const env=environment(),r=make('breast',undefined,{duration_seconds:1200,left_seconds:700,right_seconds:500,side:'both'});
 assert.equal((await worker.fetch(req('/api/events','POST',r),env)).status,200);
 let rows=(await(await worker.fetch(req('/api/events'),env)).json()).events;
 assert.equal(rows[0].left_seconds,700);assert.equal(totals(rows).breastSeconds,1200);assert.equal(totals(rows).timedBreast,1);
 assert.equal((await worker.fetch(req('/api/events/'+r.id,'PUT',{...rows[0],duration_seconds:1500}),env)).status,200);
 rows=(await(await worker.fetch(req('/api/events'),env)).json()).events;assert.equal(rows[0].duration_seconds,1500);
 const backupEnv=environment();await worker.fetch(req('/api/events','POST',JSON.parse(JSON.stringify(rows))),backupEnv);
 assert.equal((await(await worker.fetch(req('/api/events'),backupEnv)).json()).events[0].right_seconds,500);
});
test('shared timer rejects stale simultaneous controls, atomically finishes and retries without duplicates',async()=>{
 const env=environment();const timer=async()=> (await(await worker.fetch(req('/api/timer'),env)).json()).timer;
 const post=body=>worker.fetch(req('/api/timer','POST',body),env);
 let t=await timer();assert.equal(t.status,'idle');
 assert.equal((await post({action:'start',side:'left',id:'timer-first',revision:t.revision})).status,200);
 assert.equal((await post({action:'start',side:'right',id:'timer-second',revision:t.revision})).status,409);
 t=await timer();assert.equal(t.side,'left');
 assert.equal((await post({action:'pause',revision:t.revision})).status,200);t=await timer();
 const body={action:'finish',revision:t.revision,record:make('breast',t.at,{id:t.id,duration_seconds:600,left_seconds:600,right_seconds:0,side:'left'})};
 assert.equal((await post({...body,revision:t.revision-1})).status,409);
 assert.equal((await post({...body,record:{...body.record,left_seconds:601}})).status,400);assert.equal((await timer()).status,'paused');
 assert.equal((await post(body)).status,200);assert.equal((await timer()).status,'idle');
 t=await timer();await post({action:'start',side:'right',id:'timer-next',revision:t.revision});
 assert.equal((await post(body)).status,200);assert.equal((await timer()).id,'timer-next');
 const rows=(await(await worker.fetch(req('/api/events'),env)).json()).events;assert.equal(rows.length,1);assert.equal(rows[0].duration_seconds,600);
 assert.equal((await worker.fetch(req('/api/timer','POST',{action:'discard',revision:(await timer()).revision},'https://evil.example'),env)).status,403);
});

test('clean schema starts empty, keeps timer state, and can store a fictional record',async()=>{
 const env=environment();const res=await worker.fetch(req('/api/events'),env);assert.deepEqual((await res.json()).events,[]);
 assert.equal((await(await worker.fetch(req('/api/timer'),env)).json()).timer.status,'idle');
 await worker.fetch(req('/api/events','POST',make('note',undefined,{notes:'Fictional test record.'})),env);
 assert.equal((await(await worker.fetch(req('/api/events'),env)).json()).events.length,1);
});
test('configured name/timezone endpoint is private and validates IANA timezone',async()=>{
 const env={...environment(),BABY_NAME:'Sample Baby',TIME_ZONE:'Europe/London'};
 assert.deepEqual(await(await worker.fetch(req('/api/config'),env)).json(),{babyName:'Sample Baby',timeZone:'Europe/London'});
 env.LOCAL_DEV='false';assert.equal((await worker.fetch(req('/api/config'),env)).status,401);
});
test('wall-clock conversion round-trips zones and rejects DST gaps',async()=>{
 const {parseLocal,localDateTime}=await import('../public/dates.js');
 for(const zone of ['UTC','Asia/Tokyo','America/New_York','Europe/London']){
  const local='2025-07-10T14:30';assert.equal(localDateTime(parseLocal(local,zone),zone),local);
 }
 assert.equal(parseLocal('2025-07-10T14:30','America/New_York'),'2025-07-10T18:30:00.000Z');
 assert.throws(()=>parseLocal('2025-03-09T02:30','America/New_York'));
 assert.equal(parseLocal('2025-11-02T01:30','America/New_York'),'2025-11-02T05:30:00.000Z');
 assert.throws(()=>parseLocal('2025-02-30T12:00','UTC'));
});
test('calendar totals and date-only growth use the configured timezone',async()=>{
 const {daily,weightWeek}=await import('../public/model.js');
 const rows=[make('breast','2025-07-10T23:30:00Z')];assert.equal(daily(rows,'Asia/Tokyo')[0].day,'2025-07-11');assert.equal(daily(rows,'UTC')[0].day,'2025-07-10');
 const w=weightWeek([make('weight','2025-07-10T01:00:00Z',{value:4000,date_only:1}),make('weight','2025-07-16T01:00:00Z',{value:4120,date_only:1})],Date.parse('2025-07-17T00:00:00Z'),'America/New_York');
 assert.equal(w.coveredDays,6);assert.equal(w.gramsPerDay,20);
});

test('heavy wet nappies exclude light, medium and unrecorded wetness',()=>{
 const rows=['small','small','medium','medium','heavy',''].map(wet_size=>make('nappy',undefined,{wet:1,wet_size}));
 const t=totals(rows);assert.equal(t.wet,6);assert.equal(t.wetHeavy,1);assert.equal(t.wetSmall,2);assert.equal(t.wetMedium,2);assert.equal(t.wetUnspecified,1);
});

test('weight scales survive create, edit and backup restore; older records remain valid',async()=>{
 const env=environment(),r=make('weight',undefined,{value:4000,scale:'Home scale'});
 assert.equal((await worker.fetch(req('/api/events','POST',r),env)).status,200);
 let row=(await(await worker.fetch(req('/api/events'),env)).json()).events[0];assert.equal(row.scale,'Home scale');
 assert.equal((await worker.fetch(req('/api/events/'+r.id,'PUT',{...row,scale:'Clinic scale'}),env)).status,200);
 row=(await(await worker.fetch(req('/api/events'),env)).json()).events[0];assert.equal(row.scale,'Clinic scale');
 const other=environment();await worker.fetch(req('/api/events','POST',[row]),other);assert.equal((await(await worker.fetch(req('/api/events'),other)).json()).events[0].scale,'Clinic scale');
 assert.equal(validate({...r,scale:undefined}).scale,'');assert.throws(()=>validate({...r,scale:'x'.repeat(81)}));
});
