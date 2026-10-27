import {localDateTime,parseLocal} from './dates.js';
import {icon} from './icons.js';
import {timerAmounts,timerRecord} from './timer.js';
import {stats,totals,daily,validate,periodTotals,weightTrend,weightWeek} from './model.js';
const $=s=>document.querySelector(s), el=id=>document.getElementById(id), esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const labels={breast:'Breastfeed',bottle:'Bottle',pump:'Pumping',nappy:'Nappy',weight:'Weight',note:'Note',vomit:'Vomit'};
let config={babyName:'Baby',timeZone:'UTC'};
const date=t=>new Intl.DateTimeFormat('en-AU',{timeZone:config.timeZone,day:'numeric',month:'short',year:'numeric'}).format(new Date(t));
const time=t=>new Intl.DateTimeFormat('en-AU',{timeZone:config.timeZone,hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date(t));
const newId=()=>crypto.randomUUID?crypto.randomUUID():Array.from(crypto.getRandomValues(new Uint8Array(16)),b=>b.toString(16).padStart(2,'0')).join('');
const local=t=>localDateTime(t,config.timeZone);
let feedMode='timer';
let feedTimer={status:'idle',revision:1},timerOffset=0,timerReady=false,finishingTimer=null;
let draftId='',events=[],loaded=false,editing=null,type='breast',limit=60,filter='all',pendingImport=[],busy=false,toastTimer;
function toast(text){el('toast').textContent=text;el('toast').style.display='block';clearTimeout(toastTimer);toastTimer=setTimeout(()=>el('toast').style.display='none',5000);}
async function api(path,method='GET',data){const r=await fetch('/api/'+path,{method,credentials:'same-origin',headers:method==='GET'?{}:{'Content-Type':'application/json'},body:data===undefined?undefined:JSON.stringify(data)});if(!r.ok){let msg;try{msg=(await r.json()).error;}catch{msg=r.status===401?'Please sign in or configure private access.':'Could not reach the tracker.';}throw Error(msg||'Request failed');}return r.json();}
async function refresh(){try{const [d,t,c]=await Promise.all([api('events'),api('timer'),api('config')]);config=c;applyConfiguration();events=d.events;feedTimer=t.timer;timerOffset=t.serverNow-Date.now();timerReady=true;loaded=true;el('connection').textContent='Shared · synced at '+time(Date.now());render();}catch(e){timerReady=false;renderTimer();el('connection').textContent=loaded?'Connection lost · showing previous records':'Not connected';if(!loaded)el('entries').innerHTML='<div class="empty">'+esc(e.message)+'</div>';throw e;}}
function windowRows(days=1,end=Date.now()){return events.filter(e=>!e.deleted&&Date.parse(e.at)>end-days*86400000&&Date.parse(e.at)<=end);}
const known=(n,unknown)=>`${unknown?'≥ ':''}${n} ml${unknown?' + '+unknown+' unknown':''}`;
const signed=(n,digits=0)=>`${n>0?'+':''}${Number(n).toFixed(digits)}`;
function metric(label,value,detail,average,unit=''){
 return `<div class="recap-metric"><span class="metric-label">${label}</span><strong class="metric-number">${value}${unit?`<span class="unit">${unit}</span>`:''}</strong><span class="metric-detail">${detail}</span><span class="metric-average">${average||'&nbsp;'}</span></div>`;
}
function recap(days,end){
 const t=periodTotals(events,days,end),avg=(n,u='')=>days===7?`${(n/7).toFixed(1)}${u} / day`:'';
 const recapMetric=(label,value,detail,average,unit='')=>days===7?metric(label,(String(value).startsWith('≥')?'≥ ':'')+(Number(String(value).replace('≥','').trim())/7).toFixed(1),detail,`7-day total: ${value}${unit?' '+unit:''}`,unit?unit+'/day':'/day'):metric(label,value,detail,average,unit);
 const milkBreakdown=`${t.bottles} bottles · ${t.ebmMl} EBM / ${t.formulaMl} formula${t.unspecifiedMl?' / '+t.unspecifiedMl+' unknown type':''}`;
 const milkUnknown=t.unknownBottles?` · ${t.unknownBottles} amount unknown`:'';
 return `<article class="recap-column" aria-label="Last ${days===1?'24 hours':'7 days'}"><h3>${days===1?'24 hours':'7 days'}<small>${days===1?'Live totals':'Daily averages · vomit total'}</small></h3>`+
  recapMetric('Breastfeeds',t.breast,t.timedBreast?`${minutes(t.breastSeconds)} min logged · ${t.timedBreast}/${t.breast} timed · avg ${minutes(t.breastSeconds/t.timedBreast)} min/feed`:'Duration unrecorded',avg(t.breast))+
  recapMetric('Bottle milk',`${t.unknownBottles?'≥ ':''}${t.bottleMl}`,milkBreakdown+milkUnknown,avg(t.bottleMl,' ml known'),'ml')+
  recapMetric('Wet nappies',t.wet,`${t.wetSmall} small · ${t.wetMedium} medium · ${t.wetHeavy} heavy${t.wetUnspecified?' · '+t.wetUnspecified+' size unknown':''}`,avg(t.wet))+
  recapMetric('Poo nappies',t.poo,`${t.pooSmall} small · ${t.pooBig} big${t.pooUnspecified?' · '+t.pooUnspecified+' size unknown':''}`,avg(t.poo))+
  recapMetric('Pumped',`${t.unknownPumps?'≥ ':''}${t.pumpMl}`,`${t.pumps} sessions${t.unknownPumps?' · '+t.unknownPumps+' amount unknown':''}`,avg(t.pumpMl,' ml known'),'ml')+
  metric('Vomit',t.vomit,`${t.vomitSmall} small · ${t.vomitBig} big`,days===7?'Total over 7 days':'')+
  `<button class="summary-copy" data-summary="${days}">Copy nurse summary ↗</button></article>`;
}
function render(){
 const end=Date.now();
 el('today').textContent=new Intl.DateTimeFormat('en-AU',{timeZone:config.timeZone,weekday:'short',day:'numeric',month:'short'}).format(new Date(end));
 el('recaps').innerHTML=recap(1,end)+recap(7,end);
 const last=events.filter(e=>e.type==='breast'&&Date.parse(e.at)<=end).sort((a,b)=>b.at.localeCompare(a.at))[0];
 el('lastfeed').textContent=last?`Last breastfeed · ${date(last.at)}, ${time(last.at)}${last.side?' · '+last.side:''}`:'No breastfeeds recorded';
 timeline();renderWeights();renderTimer();
 const days=daily(events,config.timeZone);el('daily').innerHTML=table(['Date','Breasts','Bottles · ml','Wet','Poo','Pumped · ml','Vomit'],days.map(d=>[d.day,d.breast,known(d.bottleMl,d.unknownBottles),d.wet,d.poo,known(d.pumpMl,d.unknownPumps),d.vomit]));
}
function renderWeights(){
 const rows=weightTrend(events,Date.now(),config.timeZone),week=weightWeek(events,Date.now(),config.timeZone),last=week.latest;
 if(!last){
  el('weight-glance').innerHTML='<div class="weight-glance-card"><div><h2>Weight tracker</h2><p class="subtle">Start with a weigh-in.</p></div><button data-add="weight">＋ Add weight</button></div>';
  el('weight-summary').innerHTML='';el('weight-chart').innerHTML='';el('weights').innerHTML='<div class="empty">Two weigh-ins at different times are needed to calculate grams per day.</div>';return;
 }
 const rate=week.gramsPerDay==null?'—':signed(week.gramsPerDay,1)+' g/day';
 el('weight-glance').innerHTML=`<div class="weight-glance-card"><div><h2>Latest weight · ${date(last.at)}</h2><strong>${last.value.toLocaleString('en-AU')} g</strong><p class="subtle">${week.gramsPerDay==null?'7-day average: more readings needed':'7-day average: '+rate}</p></div><button data-view="growth">View growth ↗</button></div>`;
 el('weight-summary').innerHTML=`<div class="weight-stat"><small>Latest weight</small><strong>${last.value.toLocaleString('en-AU')} g</strong><small>${date(last.at)}${last.date_only?' · time unrecorded':' · '+time(last.at)}</small></div><div class="weight-stat"><small>7-day average gain</small><strong>${rate}</strong><small>${week.gain==null?'Two weigh-ins within the last week needed':`${signed(week.gain)} g across ${week.coveredDays.toFixed(1)} days of readings`}</small></div>`;
 el('weight-chart').innerHTML=weightChart(rows);
 el('weights').innerHTML=[...rows].reverse().map(r=>`<article class="weight-record"><div class="weight-record-top"><div><strong>${r.value.toLocaleString('en-AU')} g</strong><div class="subtle">${date(r.at)}${r.date_only?' · time unrecorded':' · '+time(r.at)}</div></div><button data-edit="${esc(r.id)}">Edit</button></div><p class="weight-change">${r.gain==null?'First recorded weigh-in':r.gramsPerDay==null?`${signed(r.gain)} g · same recorded date/time, rate unavailable`:`${signed(r.gain)} g since previous weigh-in`}</p>${r.notes?'<p class="subtle">'+esc(r.notes)+'</p>':''}</article>`).join('');
}
function weightChart(rows){
 if(rows.length<2)return '<div class="empty">The weight trend will appear after another weigh-in.</div>';
 const width=640,height=230,left=55,right=22,top=26,bottom=48;
 const minT=Date.parse(rows[0].at),maxT=Date.parse(rows.at(-1).at),values=rows.map(r=>Number(r.value));
 const minV=Math.min(...values)-20,maxV=Math.max(...values)+20;
 const x=t=>left+(Date.parse(t)-minT)/(maxT-minT||1)*(width-left-right),y=v=>height-bottom-(v-minV)/(maxV-minV)*(height-top-bottom);
 const path=rows.map((r,i)=>`${i?'L':'M'}${x(r.at).toFixed(2)},${y(r.value).toFixed(2)}`).join(' ');
 const ticks=[minV,(minV+maxV)/2,maxV].map(v=>`<line x1="${left}" x2="${width-right}" y1="${y(v)}" y2="${y(v)}" stroke="#f4eadc20"/><text x="${left-8}" y="${y(v)+4}" text-anchor="end">${Math.round(v)}</text>`).join('');
 return `<svg class="weight-chart" viewBox="0 0 ${width} ${height}" role="img" aria-label="Recorded weight in grams from ${date(rows[0].at)} to ${date(rows.at(-1).at)}. Exact measurements and daily gains are listed below."><text x="12" y="16">grams</text>${ticks}<path d="${path}" fill="none" stroke="#d7ae81" stroke-width="3"/>${rows.map(r=>`<circle cx="${x(r.at)}" cy="${y(r.value)}" r="5" fill="#d7ae81"><title>${esc(date(r.at))}: ${r.value} g</title></circle>`).join('')}<text x="${left}" y="${height-17}">${date(rows[0].at)}</text><text x="${width-right}" y="${height-17}" text-anchor="end">${date(rows.at(-1).at)}</text></svg>`;
}
function table(head,rows){return '<div class="table-scroll"><table><thead><tr>'+head.map(h=>'<th>'+esc(h)+'</th>').join('')+'</tr></thead><tbody>'+rows.map(row=>'<tr>'+row.map(v=>'<td>'+esc(v)+'</td>').join('')+'</tr>').join('')+'</tbody></table></div>';}
function title(e){if(e.type==='vomit')return 'Vomit · '+e.vomit_size;if(e.type==='bottle')return `Bottle · ${e.value==null?'unknown ml':e.value+' ml'} · ${e.milk==='ebm'?'EBM':e.milk==='formula'?'Formula':'milk type unrecorded'}`;if(e.type==='pump')return `Pumped · ${e.value==null?'unknown ml':e.value+' ml'}`;if(e.type==='weight')return 'Weight · '+e.value+' g';if(e.type==='breast')return 'Breastfeed'+(e.side?' · '+e.side:'')+(e.duration_seconds==null?'':` · ${minutes(e.duration_seconds)} min`)+(e.left_seconds!=null||e.right_seconds!=null?` (L ${minutes(e.left_seconds||0)} / R ${minutes(e.right_seconds||0)})`:'');if(e.type==='nappy')return [e.wet?'Wet'+(e.wet_size?' ('+e.wet_size+')':''):'',e.poo?'Poo'+(e.poo_size?' ('+e.poo_size+')':''):''].filter(Boolean).join(' + ');return 'Note';}
function timeline(){const rows=events.filter(e=>filter==='all'||filter===e.type).sort((a,b)=>b.at.localeCompare(a.at));let previous='';el('entries').innerHTML=rows.slice(0,limit).map(e=>{const day=date(e.at),heading=previous===day?'':`<div class="day-label">${day}</div>`;previous=day;return `${heading}<div class="entry"><time>${e.date_only?'—':time(e.at)}</time><span class="entry-icon">${icon(e.type)}</span><div><div class="entry-title">${esc(title(e))}</div>${e.notes?'<div class="entry-note">'+esc(e.notes)+'</div>':''}</div><button data-edit="${esc(e.id)}">Edit</button></div>`;}).join('')||'<div class="empty">The little things start here.<br>Tap an activity to add your first entry.</div>';el('more').hidden=rows.length<=limit;}
function syncChoices(){document.querySelectorAll('[data-choice]').forEach(input=>{input.checked=input.value===el(input.dataset.choice).value;});document.querySelectorAll('[data-amount]').forEach(b=>b.classList.toggle('selected',Number(b.dataset.amount)===Number(el('amount').value)&&el('amount').value!==''));}
function updateSizes(){el('wet-size-field').hidden=!el('wet').checked;el('poo-size-field').hidden=!el('poo').checked;}
function openEditor(t,e){
 if(!loaded){toast('Connect to your tracker before logging.');return;}
 finishingTimer=null;type=t;editing=e||null;draftId=e?.id||newId();el('entry-form').reset();
 el('editor-title').textContent=(e?'Edit ':'Log ')+labels[t].toLowerCase();el('at').type='datetime-local';el('at').value=local(e?.at||new Date().toISOString());
 el('amount-field').hidden=!['bottle','pump','weight'].includes(t);el('amount-label').textContent=t==='weight'?'Weight · grams':'Amount · ml';
 el('amount').value=e?.value??'';el('amount').max=t==='weight'?30000:2000;el('amount').required=t==='weight'||(t==='bottle'&&!e);
 el('date-only-field').hidden=t!=='weight';el('date-only').checked=!!e?.date_only;el('amount-presets').hidden=t==='weight';el('amount-help').textContent=t==='weight'?'Enter the scale reading in grams. Add scale / clothing details in a note.':t==='bottle'&&!e?'Enter the amount offered in ml.':'Leave blank if the quantity is unknown.';
 el('minus').setAttribute('aria-label',t==='weight'?'Decrease weight by 10 grams':'Decrease amount by 10 ml');el('plus').setAttribute('aria-label',t==='weight'?'Increase weight by 10 grams':'Increase amount by 10 ml');
 el('side-field').hidden=t!=='breast';el('milk-field').hidden=t!=='bottle';el('side').value=e?.side??'';el('milk').value=e?.milk??'ebm';
 el('duration-field').hidden=t!=='breast';el('feed-mode').hidden=t!=='breast'||!!e||feedTimer.status!=='idle';el('timer-review-note').hidden=true;
 el('feed-minutes').value=e?.duration_seconds==null?'':(e.duration_seconds/60).toFixed(3).replace(/\.?0+$/,'');
 for(const side of ['left','right'])el(side+'-minutes').value=e?.[side+'_seconds']==null?'':(e[side+'_seconds']/60).toFixed(3).replace(/\.?0+$/,'');
 el('feed-split').open=false;
 el('nappy-field').hidden=t!=='nappy';el('sizes-field').hidden=t!=='nappy';el('wet').checked=!!e?.wet;el('poo').checked=!!e?.poo;
 el('wet-size').value=e?.wet_size||'';el('poo-size').value=e?.poo_size||'';el('vomit-field').hidden=t!=='vomit';el('vomit-size').value=e?.vomit_size||'small';
 document.querySelectorAll('.unknown-choice').forEach(choice=>choice.hidden=!e);
 el('notes').value=e?.notes||'';el('notes-details').open=!!e?.notes||t==='note';el('form-error').textContent='';el('delete').hidden=!e;el('save').disabled=false;el('save').textContent='Save '+labels[t].toLowerCase();
 setFeedMode(t==='breast'&&!e&&feedTimer.status==='idle'?'timer':'manual');
 syncTimePrecision();syncChoices();updateSizes();el('editor').showModal();el('close').focus({preventScroll:true});el('editor').querySelector('.sheet-body').scrollTop=0;
}
function setView(name){document.querySelectorAll('.view').forEach(x=>x.hidden=x.id!==name);document.querySelectorAll('[data-view]').forEach(x=>{if(x.closest('nav'))x.classList.toggle('active',x.dataset.view===name);});}
el('wet').onchange=updateSizes;el('poo').onchange=updateSizes;
document.addEventListener('change',e=>{if(e.target.matches('[data-choice]')){el(e.target.dataset.choice).value=e.target.value;syncChoices();}});
document.addEventListener('click',e=>{
 const add=e.target.closest('[data-add]'),edit=e.target.closest('[data-edit]'),view=e.target.closest('[data-view]'),f=e.target.closest('[data-filter]'),preset=e.target.closest('[data-amount]'),summary=e.target.closest('[data-summary]'),startFeed=e.target.closest('[data-start-feed]'),timerAction=e.target.closest('[data-timer-action]'),duration=e.target.closest('[data-minutes]');
 const mode=e.target.closest('[data-feed-mode]');if(mode)setFeedMode(mode.dataset.feedMode);
 if(startFeed)timerCommand('start',startFeed.dataset.startFeed);
 if(timerAction)timerCommand(timerAction.dataset.timerAction,timerAction.dataset.side);
 if(duration){el('feed-minutes').value=duration.dataset.minutes;el('left-minutes').value='';el('right-minutes').value='';}
 if(add)openEditor(add.dataset.add);if(edit){const row=events.find(x=>x.id===edit.dataset.edit);if(row)openEditor(row.type,row);}
 if(view){setView(view.dataset.view);if(!view.closest('nav'))document.querySelector('nav').scrollIntoView({block:'start'});}
 if(f){filter=f.dataset.filter;limit=60;document.querySelectorAll('[data-filter]').forEach(b=>{b.classList.toggle('selected',b===f);b.setAttribute('aria-pressed',b===f?'true':'false');});timeline();}
 if(preset){el('amount').value=preset.dataset.amount;syncChoices();}
 if(summary)copySummary(Number(summary.dataset.summary));
});
function syncTimePrecision(){const input=el('at'),current=input.value,dateOnly=type==='weight'&&el('date-only').checked;input.type=dateOnly?'date':'datetime-local';input.value=dateOnly?current.slice(0,10):current.length===10?current+'T12:00':current;}
el('date-only').onchange=syncTimePrecision;
el('now').onclick=()=>el('at').value=el('at').type==='date'?local(new Date().toISOString()).slice(0,10):local(new Date().toISOString());
function stepAmount(delta){el('amount').value=Math.max(0,Math.min(Number(el('amount').max),Number(el('amount').value||0)+delta));syncChoices();}
el('minus').onclick=()=>stepAmount(-10);el('plus').onclick=()=>stepAmount(10);el('amount').oninput=syncChoices;
el('close').onclick=()=>el('editor').close();el('more').onclick=()=>{limit+=60;timeline();};el('refresh').onclick=()=>refresh().catch(e=>toast(e.message));
el('entry-form').onsubmit=async e=>{e.preventDefault();if(busy)return;try{if(!editing){if(type==='bottle'&&(!['ebm','formula'].includes(el('milk').value)||el('amount').value===''))throw Error('Choose the milk type and enter ml.');if(type==='nappy'&&el('wet').checked&&!el('wet-size').value)throw Error('Choose small, medium or heavy for the wet nappy.');if(type==='nappy'&&el('poo').checked&&!el('poo-size').value)throw Error('Choose small or big for the poo.');}if(type==='breast'&&!editing&&!['left','right','both'].includes(el('side').value))throw Error('Choose left, right or both.');const record=validate({id:draftId,at:parseLocal(el('at').value+(el('at').type==='date'?'T00:00':''),config.timeZone),type,value:el('amount').value===''?null:Number(el('amount').value),side:el('side').value,milk:el('milk').value,wet:el('wet').checked,poo:el('poo').checked,wet_size:el('wet-size').value,poo_size:el('poo-size').value,vomit_size:el('vomit-size').value,notes:el('notes').value,date_only:el('date-only').checked,duration_seconds:durationInput('feed-minutes'),left_seconds:durationInput('left-minutes'),right_seconds:durationInput('right-minutes'),revision:editing?.revision||0},config.timeZone);busy=true;el('save').disabled=true;if(finishingTimer)await api('timer','POST',{action:'finish',revision:finishingTimer.revision,record});else await api(editing?'events/'+editing.id:'events',editing?'PUT':'POST',record);el('editor').close();toast('Saved to your shared tracker.');try{await refresh();}catch{toast('Entry saved. Could not refresh the timeline yet.');}}catch(err){el('form-error').textContent=err.message;if(finishingTimer)refresh().catch(()=>{});}finally{busy=false;el('save').disabled=false;}};
el('delete').onclick=async()=>{if(!editing||busy||!confirm('Delete this entry?'))return;busy=true;try{await api('events/'+editing.id,'DELETE',{revision:editing.revision});el('editor').close();await refresh();toast('Entry deleted.');}catch(e){el('form-error').textContent=e.message;}finally{busy=false;}};
function download(name,body,mime){const a=document.createElement('a'),u=URL.createObjectURL(new Blob([body],{type:mime}));a.href=u;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(u),1000);}
el('export').onclick=()=>{if(!loaded)return toast('Connect first.');download('romi-backup-'+new Date().toISOString().slice(0,10)+'.json',JSON.stringify({version:1,timeZone:config.timeZone,exportedAt:new Date().toISOString(),events},null,2),'application/json');};
el('csv').onclick=()=>{if(!loaded)return toast('Connect first.');const keys=['id','at','type','value','milk','side','wet','wet_size','poo','poo_size','vomit_size','date_only','duration_seconds','left_seconds','right_seconds','notes'];const cell=x=>'"'+String(x??'').replace(/^[=+@-]/,'\t$&').replace(/"/g,'""')+'"';download('romi-records.csv',[keys,...events.map(e=>keys.map(k=>e[k]))].map(r=>r.map(cell).join(',')).join('\r\n'),'text/csv');};
function reviewImport(data){if(!loaded)return toast('Connect first.');const rows=data.events||data;if(!Array.isArray(rows)||!rows.length||rows.length>500)throw Error('Choose a backup with 1–500 entries.');pendingImport=rows.map(e=>validate(e,config.timeZone));const t=totals(pendingImport);el('import-details').innerHTML=`<p>${pendingImport.length} entries · ${t.breast} breastfeeds · ${t.wet} wet nappies · ${t.poo} poo nappies · ${known(t.bottleMl,t.unknownBottles)} in bottles · ${t.vomit} vomits.</p><p class="warning">${esc(data.assumptions||'Matching IDs are skipped. Existing entries are never overwritten by a restore. Review the source backup before proceeding.')}</p>`;el('import-dialog').showModal();}

el('restore').onchange=async e=>{try{const f=e.target.files[0];if(!f)return;if(f.size>2000000)throw Error('Backup is too large');reviewImport(JSON.parse(await f.text()));}catch(err){toast(err.message);}finally{e.target.value='';}};
el('cancel-import').onclick=()=>el('import-dialog').close();el('confirm-import').onclick=async()=>{if(busy)return;busy=true;el('confirm-import').disabled=true;try{await api('events','POST',pendingImport);el('import-dialog').close();await refresh();toast('Backup restored.');}catch(e){toast(e.message);}finally{busy=false;el('confirm-import').disabled=false;}};
async function copySummary(days=1){if(!loaded)return toast('Connect first.');const end=Date.now(),t=periodTotals(events,days,end);const weights=events.filter(e=>e.type==='weight'&&Date.parse(e.at)<=end).sort((a,b)=>b.at.localeCompare(a.at)).slice(0,3);const summary=`${config.babyName} — recorded activity\n${date(end-days*86400000)} ${time(end-days*86400000)} to ${date(end)} ${time(end)} (${config.timeZone})\n\nBreastfeeds: ${t.breast}\nActive feeding: ${minutes(t.breastSeconds)} minutes recorded (${t.timedBreast}/${t.breast} feeds timed); average ${t.timedBreast?minutes(t.breastSeconds/t.timedBreast):'unknown'} minutes per timed feed\nBottle top-ups: ${t.bottles}; ${known(t.bottleMl,t.unknownBottles)} offered\nEBM: ${t.ebmMl} ml; formula: ${t.formulaMl} ml; type unrecorded: ${t.unspecifiedMl} ml\nWet nappies: ${t.wet} (${t.wetSmall} small, ${t.wetMedium} medium, ${t.wetHeavy} heavy, ${t.wetUnspecified} size unrecorded)\nPoo nappies: ${t.poo} (${t.pooSmall} small, ${t.pooBig} big, ${t.pooUnspecified} size unrecorded)\nPumping: ${t.pumps} sessions; ${known(t.pumpMl,t.unknownPumps)}\nVomit: ${t.vomit} (${t.vomitSmall} small, ${t.vomitBig} big)\n\nLatest recorded weights:\n${weights.map(e=>`${date(e.at)}: ${e.value} g — ${e.notes}`).join('\n')||'None recorded'}\n${(()=>{const w=weightWeek(events,end,config.timeZone);return w.gramsPerDay!=null?'7-day average weight gain: '+signed(w.gramsPerDay,1)+' g/day, based on '+signed(w.gain)+' g over '+w.coveredDays.toFixed(1)+' days between readings in the trailing week. Different scales or clothing can affect this.':'7-day average weight gain: more weigh-ins in the trailing week needed.';})()}\n\nBottle volumes are offered, not retained. Counts reflect logged entries only.\n\nNotes in this period:\n${windowRows(days,end).filter(e=>e.notes).sort((a,b)=>a.at.localeCompare(b.at)).map(e=>`${date(e.at)} ${time(e.at)} ${title(e)}: ${e.notes}`).join('\n')||'None'}`;try{await navigator.clipboard.writeText(summary);toast('Nurse summary copied.');}catch{el('copy-text').value=summary;el('copy-dialog').showModal();}}
el('close-copy').onclick=()=>el('copy-dialog').close();
refresh().catch(()=>{});setInterval(()=>{if(!el('editor').open&&!el('import-dialog').open&&!busy&&document.visibilityState==='visible')refresh().catch(()=>{});},20000);document.addEventListener('visibilitychange',()=>{if(!document.hidden&&!busy)refresh().catch(()=>{});});

function minutes(seconds){return (Number(seconds)/60).toFixed(1).replace(/\.0$/,'');}
function durationInput(id){if(type==='breast'&&['left-minutes','right-minutes'].includes(id)&&el('left-minutes').value===''&&el('right-minutes').value===''&&el('feed-minutes').value!==''&&el('side').value===id.split('-')[0])return Math.round(Number(el('feed-minutes').value)*60);return type!=='breast'||el(id).value===''?null:Math.round(Number(el(id).value)*60);}
function clock(ms){const seconds=Math.floor(ms/1000);return `${Math.floor(seconds/60)}:${String(seconds%60).padStart(2,'0')}`;}
let timerRenderKey='';
function renderTimer(){
 const card=el('feed-timer');card.hidden=feedTimer.status==='idle';if(card.hidden){timerRenderKey='';return;}
 const a=timerAmounts(feedTimer,Date.now()+timerOffset),total=a.left+a.right+a.generic;
 const key=[feedTimer.id,feedTimer.revision,feedTimer.status,busy,timerReady].join(':');
 const breakdown=`Left ${clock(a.left)} · Right ${clock(a.right)}${a.generic?' · Generic '+clock(a.generic):''}`;
 if(key===timerRenderKey){card.querySelector('.timer-clock').textContent=clock(total);el('timer-breakdown').textContent=breakdown;el('long-feed-warning').hidden=total<2*3600000;return;}timerRenderKey=key;
 card.innerHTML=`<div class="timer-card"><div class="section-title"><h2>${feedTimer.status==='running'?(feedTimer.side==='generic'?'Feeding':'Feeding · '+feedTimer.side):'Feed paused'}</h2></div><strong class="timer-clock">${clock(total)}</strong><p class="subtle"><span id="timer-breakdown">${breakdown}</span></p><p id="long-feed-warning" class="warning" ${total<2*3600000?'hidden':''}>This feed has been running a while. Review its duration before saving.</p><div class="timer-buttons"><button data-timer-action="switch" data-side="${feedTimer.side==='left'?'right':'left'}">Switch to ${feedTimer.side==='left'?'right':'left'}</button><button data-timer-action="${feedTimer.status==='paused'?'resume':'pause'}">${feedTimer.status==='paused'?'Resume':'Pause'}</button><button class="primary timer-finish" data-timer-action="review">Finish</button></div><details class="timer-options"><summary>More options</summary><p class="subtle">Started ${date(feedTimer.at)} at ${time(feedTimer.at)} · pauses excluded</p><button class="timer-discard" data-timer-action="discard">Discard timer</button></details>${timerReady?'':'<p class="error">Reconnect before changing this shared timer.</p>'}</div>`;
 card.querySelectorAll('button').forEach(b=>b.disabled=busy||!timerReady);
}
async function timerCommand(action,side){
 if(busy||!timerReady)return toast('Connect to the shared tracker first.');
 if(action==='discard'&&!confirm('Discard this active timer without logging a feed?'))return;
 busy=true;renderTimer();
 try{
  const d=await api('timer','POST',{action:action==='review'?'pause':action,side,id:action==='start'?'timer-'+newId():undefined,revision:feedTimer.revision});
  feedTimer=d.timer;timerOffset=d.serverNow-Date.now();
  if(action==='start'&&el('editor').open)el('editor').close();
  if(action==='review'){
   const snapshot={...feedTimer};openEditor('breast',timerRecord(snapshot,Date.now()+timerOffset));editing=null;finishingTimer=snapshot;el('delete').hidden=true;el('timer-review-note').hidden=false;el('editor-title').textContent='Review breastfeed';el('save').textContent='Save feed';
  }
 }catch(e){toast(e.message);try{await refresh();}catch{}}
 finally{busy=false;renderTimer();}
}
setInterval(()=>{if(feedTimer.status!=='idle')renderTimer();},1000);
setInterval(()=>{if(!busy&&document.visibilityState==='visible')api('timer').then(d=>{feedTimer=d.timer;timerOffset=d.serverNow-Date.now();timerReady=true;renderTimer();}).catch(()=>{timerReady=false;renderTimer();});},5000);

// Reuse the same drawings in log buttons, filters and timeline entries.
document.querySelectorAll('[data-icon]').forEach(node=>node.innerHTML=icon(node.dataset.icon));
document.querySelectorAll('[data-filter]').forEach(button=>{if(button.dataset.filter!=='all')button.insertAdjacentHTML('afterbegin',icon(button.dataset.filter));});

function setFeedMode(mode){
 feedMode=mode;const timing=type==='breast'&&mode==='timer';
 el('timer-start-options').hidden=!timing;
 el('when-field').hidden=timing;el('side-field').hidden=type!=='breast'||timing;
 el('duration-field').hidden=type!=='breast'||timing;el('notes-details').hidden=timing;
 el('editor').querySelector('.sheet-footer').hidden=timing;
 document.querySelectorAll('[data-feed-mode]').forEach(b=>{b.classList.toggle('selected',b.dataset.feedMode===mode);b.setAttribute('aria-pressed',b.dataset.feedMode===mode?'true':'false');});
}

function applyConfiguration(){
 el('baby-greeting').textContent=`Hello, ${config.babyName}.`;
 el('time-zone-label').textContent=`When · ${config.timeZone}`;
 el('trends-zone').textContent=`Calendar days in ${config.timeZone}. First and last days may be incomplete.`;
 el('data-zone').textContent=`All timestamps use ${config.timeZone}, including while travelling. A connection is needed to save and sync. A record is only confirmed saved after the server accepts it.`;
}
