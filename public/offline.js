// Durable, idempotent queue for new manual entries. Edits and shared timers require a connection.
export class EntryQueue {
 constructor(storage,key='romi-pending'){this.storage=storage;this.key=key;this.running=null;this.items=JSON.parse(storage.getItem(key)||'[]');}
 persist(){this.storage.setItem(this.key,JSON.stringify(this.items));}
 add(record){if(!this.items.some(x=>x.record.id===record.id))this.items.push({record});try{this.persist();}catch(e){this.items=this.items.filter(x=>x.record.id!==record.id);throw e;}}
 cancel(record){let item=this.items.find(x=>x.record.id===record.id);if(!item){item={record,sent:true};this.items.push(item);}item.cancelled=true;this.persist();}
 merge(rows){const map=new Map(rows.map(e=>[e.id,e]));for(const x of this.items){if(x.cancelled)map.delete(x.record.id);else map.set(x.record.id,{...x.record,pending:true});}return [...map.values()];}
 flush(api){if(this.running)return this.running;this.running=this.drain(api).finally(()=>this.running=null);return this.running;}
 async drain(api){while(this.items.length){const item=this.items[0];if(!item.cancelled){await api('events','POST',item.record);item.sent=true;this.persist();}if(item.cancelled){const rows=(await api('events')).events;const row=rows.find(e=>e.id===item.record.id);if(row)await api('events/'+row.id,'DELETE',{revision:row.revision});}this.items.splice(this.items.indexOf(item),1);this.persist();}}
}
