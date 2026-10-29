import {validate} from '../public/model.js';
import {transition} from '../public/timer.js';
let keyCache;
const json=(body,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'no-store'}});
const decode=s=>Uint8Array.from(atob(s.replace(/-/g,'+').replace(/_/g,'/')),c=>c.charCodeAt(0));
export async function authorized(request,env) {
 const host=new URL(request.url).hostname;
 if(env.LOCAL_DEV==='true' && ['localhost','127.0.0.1','[::1]','terminal.local'].includes(host))return true;
 if(!env.ALLOWED_EMAILS?.trim() || !env.ACCESS_AUD || !/^[a-zA-Z0-9-]+\.cloudflareaccess\.com$/.test(env.ACCESS_TEAM_DOMAIN||''))return false;
 try {
  const token=request.headers.get('Cf-Access-Jwt-Assertion');
  if(!token || token.length>20000)return false;
  const [h,p,s,...extra]=token.split('.');if(extra.length || !s)return false;
  const head=JSON.parse(new TextDecoder().decode(decode(h))), payload=JSON.parse(new TextDecoder().decode(decode(p)));
  const issuer='https://'+env.ACCESS_TEAM_DOMAIN,now=Date.now()/1000;
  const allowed=env.ALLOWED_EMAILS.split(',').map(email=>email.trim().toLowerCase());
  if(typeof payload.email!=='string'||!allowed.includes(payload.email.toLowerCase()))return false;
  if(head.alg!=='RS256'||payload.iss!==issuer||typeof payload.exp!=='number'||payload.exp<=now || (payload.nbf && payload.nbf>now) || !(Array.isArray(payload.aud)?payload.aud:[payload.aud]).includes(env.ACCESS_AUD))return false;
  if(!keyCache || keyCache.issuer!==issuer || keyCache.until<Date.now() || !keyCache.keys.some(k=>k.kid===head.kid)){
   const res=await fetch(issuer+'/cdn-cgi/access/certs');if(!res.ok)return false;
   keyCache={issuer,until:Date.now()+300000,keys:(await res.json()).keys};
  }
  const jwk=keyCache.keys.find(k=>k.kid===head.kid);if(!jwk)return false;
  const key=await crypto.subtle.importKey('jwk',jwk,{name:'RSASSA-PKCS1-v1_5',hash:'SHA-256'},false,['verify']);
  return await crypto.subtle.verify('RSASSA-PKCS1-v1_5',key,decode(s),new TextEncoder().encode(h+'.'+p));
 } catch {return false;}
}
export function configuration(env){
 const timeZone=env.TIME_ZONE||'UTC';new Intl.DateTimeFormat('en',{timeZone}).format();
 return {babyName:env.BABY_NAME?.trim()||'Baby',timeZone};
}
function statement(db,e) {
 return db.prepare(`INSERT INTO events(id,at,type,value,side,wet,poo,notes,milk,wet_size,poo_size,vomit_size,date_only,duration_seconds,left_seconds,right_seconds,scale) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO NOTHING`).bind(e.id,e.at,e.type,e.value,e.side,e.wet,e.poo,e.notes,e.milk,e.wet_size,e.poo_size,e.vomit_size,e.date_only,e.duration_seconds,e.left_seconds,e.right_seconds,e.scale);
}
export async function handle(request,env) {
 if(!await authorized(request,env))return new Response('Private family tracker. Configure Cloudflare Access and sign in to continue.',{status:401});
 const url=new URL(request.url),config=configuration(env);
 if(url.pathname==='/api/config'&&request.method==='GET')return json(config);
 if(!url.pathname.startsWith('/api/'))return env.ASSETS.fetch(request);
 if(!['GET','POST','PUT','DELETE'].includes(request.method))return json({error:'Method not allowed'},405);
 if(request.method!=='GET') {
  if(request.headers.get('Origin')!==url.origin)return json({error:'Origin rejected'},403);
  if(!request.headers.get('Content-Type')?.startsWith('application/json'))return json({error:'JSON required'},415);
 }
 try {
  if(url.pathname==='/api/timer') {
   const read=async()=>{const r=(await env.DB.prepare('SELECT * FROM feed_timer WHERE singleton=1').all()).results[0];return {...JSON.parse(r.state),revision:r.revision};};
   if(request.method==='GET')return json({timer:await read(),serverNow:Date.now()});
   if(request.method!=='POST')return json({error:'Method not allowed'},405);
   const data=await request.json(),current=await read();
   // A lost response can be retried without saving another feed or clearing a newer timer.
   if(data.action==='finish'&&data.record?.id){
    const existing=(await env.DB.prepare('SELECT id FROM events WHERE id=?').bind(data.record.id).all()).results[0];
    if(existing)return json({ok:true,timer:current,serverNow:Date.now()});
   }
   if(!Number.isInteger(data.revision)||data.revision!==current.revision)return json({error:'The timer changed on another phone. Refreshed; please try again.'},409);
   if(data.action==='finish'){
    if(current.status!=='paused'||data.record?.id!==current.id)return json({error:'Pause the active feed before saving.'},409);
    const e=validate({...data.record,id:current.id,type:'breast'},config.timeZone);
    if(e.duration_seconds===null)throw Error('Review the feed duration before saving.');
    const columns='id,at,type,value,side,wet,poo,notes,milk,wet_size,poo_size,vomit_size,date_only,duration_seconds,left_seconds,right_seconds,scale';
    const values=[e.id,e.at,e.type,e.value,e.side,e.wet,e.poo,e.notes,e.milk,e.wet_size,e.poo_size,e.vomit_size,e.date_only,e.duration_seconds,e.left_seconds,e.right_seconds,e.scale];
    const result=await env.DB.batch([
     env.DB.prepare(`INSERT INTO events(${columns}) SELECT ${values.map(()=>'?').join(',')} FROM feed_timer WHERE singleton=1 AND revision=? ON CONFLICT(id) DO NOTHING`).bind(...values,current.revision),
     env.DB.prepare(`UPDATE feed_timer SET state='{"status":"idle"}',revision=revision+1 WHERE singleton=1 AND revision=? AND EXISTS(SELECT 1 FROM events WHERE id=?)`).bind(current.revision,e.id)
    ]);
    if(!result[1].meta.changes)return json({error:'The timer changed on another phone. Review it again.'},409);
   }else{
    const id=data.action==='start'?data.id:current.id;
    if(data.action==='start'&&(typeof id!=='string'||!/^timer-[\w-]{1,90}$/.test(id)))throw Error('Invalid timer ID');
    const next=transition(current,data.action,data.side,Date.now(),id);
    if(data.action==='start'&&(await env.DB.prepare('SELECT id FROM events WHERE id=?').bind(id).all()).results.length)throw Error('This feed was already saved. Refresh before starting another.');
    const result=await env.DB.prepare('UPDATE feed_timer SET state=?,revision=revision+1 WHERE singleton=1 AND revision=?').bind(JSON.stringify(next),current.revision).run();
    if(!result.meta.changes)return json({error:'The timer changed on another phone. Refreshed; please try again.'},409);
   }
   return json({ok:true,timer:await read(),serverNow:Date.now()});
  }
  if(url.pathname==='/api/events' && request.method==='GET') {
   const result=await env.DB.prepare('SELECT * FROM events WHERE deleted=0 ORDER BY at DESC').all();return json({events:result.results});
  }
  if(url.pathname==='/api/events' && request.method==='POST') {
   const raw=await request.text();if(raw.length>2000000)return json({error:'Import too large'},413);
   const data=JSON.parse(raw),rows=(Array.isArray(data)?data:[data]);
   if(!rows.length||rows.length>500)return json({error:'Import 1–500 entries at a time'},400);
   const entries=rows.map(e=>validate(e,config.timeZone));
   // D1 batch is atomic: validation and insertion do not leave a partial import.
   await env.DB.batch(entries.map(e=>statement(env.DB,e)));return json({ok:true});
  }
  const id=decodeURIComponent(url.pathname.split('/')[3]||'');
  if(url.pathname===`/api/events/${id}` && ['PUT','DELETE'].includes(request.method)) {
   const data=await request.json();if(!Number.isInteger(data.revision)||data.revision<1)return json({error:'Missing revision'},400);
   let result;
   if(request.method==='DELETE')result=await env.DB.prepare("UPDATE events SET deleted=1,revision=revision+1,updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id=? AND revision=? AND deleted=0").bind(id,data.revision).run();
   else {const e=validate({...data,id},config.timeZone);result=await env.DB.prepare("UPDATE events SET at=?,type=?,value=?,side=?,wet=?,poo=?,notes=?,milk=?,wet_size=?,poo_size=?,vomit_size=?,date_only=?,duration_seconds=?,left_seconds=?,right_seconds=?,scale=?,revision=revision+1,updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id=? AND revision=? AND deleted=0").bind(e.at,e.type,e.value,e.side,e.wet,e.poo,e.notes,e.milk,e.wet_size,e.poo_size,e.vomit_size,e.date_only,e.duration_seconds,e.left_seconds,e.right_seconds,e.scale,id,data.revision).run();}
   return result.meta.changes?json({ok:true}):json({error:'This entry changed on another device. Refresh and try again.'},409);
  }
  return json({error:'Not found'},404);
 } catch(e) {return json({error:e.message?.includes('D1')?'Database unavailable. Your entry has not been saved.':e.message||'Request failed'},400);}
}
export default {async fetch(request,env) {
 try {
  const res=await handle(request,env), headers=new Headers(res.headers);
  headers.set('Cache-Control','no-store');headers.set('X-Content-Type-Options','nosniff');headers.set('Referrer-Policy','no-referrer');
  headers.set('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'");
  return new Response(res.body,{status:res.status,headers});
 }catch{return json({error:'Service unavailable. Please retry.'},503);}
}};
