import {copyFile,access} from 'node:fs/promises';
try{await access('wrangler.jsonc');console.log('Keeping existing wrangler.jsonc.');}
catch{await copyFile('wrangler.example.jsonc','wrangler.jsonc');console.log('Created local wrangler.jsonc. Configure it before deploying.');}
