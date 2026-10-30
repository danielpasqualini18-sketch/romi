// Display-only approximation: 1 g difference is treated as approximately 1 ml.
// Raw before/after grams remain the source of truth; never add this to bottle totals.
export function weightedContext(entry){try{return JSON.parse(entry.weight_context||'{}');}catch{return {};}}
export function sessionTransfer(events,sessionId){
 const records=events.filter(e=>!e.deleted&&e.type==='weight'&&weightedContext(e).mode==='weighted-feed'&&weightedContext(e).session_id===sessionId).sort((a,b)=>b.at.localeCompare(a.at)||(b.updated_at||'').localeCompare(a.updated_at||''));
 const entry=records[0];if(!entry)return null;const after=weightedContext(entry).after,difference=Number(after)-Number(entry.value);
 return {entry,difference,estimatedMl:Number.isFinite(difference)&&difference>=0?difference:null};
}
