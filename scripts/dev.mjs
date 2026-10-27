import {spawn} from 'node:child_process';
// npm/preview hosts can supply Vite-style flags; forward Wrangler's equivalents.
const supplied=process.argv.slice(2),args=[];
for(let i=0;i<supplied.length;i++){
 const a=supplied[i];
 if(a==='--')continue;
 if(a==='--host'||a==='--hostname'){if(supplied[i+1]&&!supplied[i+1].startsWith('--'))args.push('--ip',supplied[++i]);continue;}
 if(a.startsWith('--host=')||a.startsWith('--hostname=')){args.push('--ip',a.slice(a.indexOf('=')+1));continue;}
 if(a==='--strictPort'||a==='--strict-port')continue;
 args.push(a);
}
const child=spawn(process.execPath,['node_modules/wrangler/bin/wrangler.js','dev','--var','LOCAL_DEV:true','--infer-origin-from-routes','false',...args],{stdio:'inherit'});
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>child.kill(signal));
child.on('exit',code=>process.exit(code||0));
