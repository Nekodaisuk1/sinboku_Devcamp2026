import {readFile,writeFile,mkdir,copyFile,rm} from 'node:fs/promises';
import {resolve,dirname,extname,relative} from 'node:path';
import {fileURLToPath} from 'node:url';
import {buildKnowledge} from './knowledge.mjs';
const root=fileURLToPath(new URL('../',import.meta.url)),out=resolve(root,'dist');
await buildKnowledge();
await rm(out,{recursive:true,force:true});await mkdir(out,{recursive:true});
const copied=new Set();
async function include(name) {
  const source=resolve(root,name);
  if(!source.startsWith(root) || /(^|\/)(\.data|scripts|data)(\/|$)|\.test\.|server\.mjs|family-api/.test(name)) throw new Error(`Blocked build input: ${name}`);
  if(copied.has(name)) return;copied.add(name);
  const body=await readFile(source,'utf8');await mkdir(dirname(resolve(out,name)),{recursive:true});await copyFile(source,resolve(out,name));
  if(['.js','.mjs'].includes(extname(name))) for(const match of body.matchAll(/(?:import|export)\s+(?:[^;]*?\s+from\s+)?['"](\.\.?\/[^'"]+)['"]/g)) await include(relative(root,resolve(dirname(source),match[1])));
}
const html=await readFile(resolve(root,'index.html'),'utf8');
await include('index.html');
for(const match of html.matchAll(/(?:href|src)="([^"#]+\.(?:css|js|mjs))"/g)) await include(match[1]);
await writeFile(resolve(out,'404.html'),'<!doctype html><html lang="ja"><meta charset="utf-8"><title>ページが見つかりません</title><p>ページが見つかりません。</p><a href="/#now">地図へ戻る</a></html>');
await writeFile(resolve(out,'_headers'),`/*
  X-Content-Type-Options: nosniff
  Referrer-Policy: no-referrer
  X-Frame-Options: DENY
  Cache-Control: no-cache
  Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'
/*.mjs
  Content-Type: text/javascript; charset=utf-8
`);
console.log(`Built ${copied.size} public files in ${out}. Server code and private data excluded.`);
