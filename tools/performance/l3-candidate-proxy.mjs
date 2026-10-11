// Candidate bundles over HTTP/2; unchanged public assets stream from the deployed QA origin.
// This is a candidate simulation, not a deployment. A pinned cert keeps HTTP caching enabled.
import { createSecureServer } from 'node:http2';
import { request } from 'node:https';
import { readFileSync, existsSync } from 'node:fs';
import { brotliCompressSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { parseHeaders } from './cdn-server.ts';
const [port='3368',cert='/tmp/l3-load-cert.pem',key='/tmp/l3-load-key.pem',root='dist']=process.argv.slice(2);
const rules=parseHeaders(readFileSync('public/_headers','utf8')), bodies=new Map();
createSecureServer({cert:readFileSync(cert),key:readFileSync(key),allowHTTP1:true},(req,res)=>{
 const url=new URL(req.url,'https://qa.minor-incident.pages.dev');
 const overrides=Object.fromEntries(rules.filter(r=>r.pattern.test(url.pathname)).flatMap(r=>r.headers));
 const bakes=JSON.parse(readFileSync('src/assets/staticBakes.json','utf8'));
 const changedBake=[bakes['bld.police-station:lod1:'],bakes['bld.police-station:lod2:']].includes(url.pathname);
 const local=changedBake?'public'+url.pathname:url.pathname==='/'? root+'/index.html':url.pathname.startsWith('/build/')?root+url.pathname:null;
 if(local&&existsSync(local)){
  let body=bodies.get(local);if(!body){body=brotliCompressSync(readFileSync(local));bodies.set(local,body)}
  const headers={'content-type':local.endsWith('.js')?'application/javascript':local.endsWith('.css')?'text/css':local.endsWith('.wasm')?'application/wasm':local.endsWith('.gz')?'application/gzip':'text/html','content-encoding':'br','content-length':String(body.length),'cache-control':'public, max-age=0, must-revalidate',etag:'"'+createHash('sha256').update(body).digest('hex')+'"',...overrides};
  if(req.headers['if-none-match']===headers.etag){res.writeHead(304,headers);res.end();return}res.writeHead(200,headers);res.end(body);return;
 }
 const headers={...req.headers,host:'qa.minor-incident.pages.dev'};for(const k of Object.keys(headers))if(k.startsWith(':')||['connection','proxy-connection'].includes(k))delete headers[k];
 const upstream=request(url,{headers},response=>{const h={...response.headers,...overrides};for(const k of ['connection','transfer-encoding','keep-alive'])delete h[k];res.writeHead(response.statusCode,h);response.pipe(res)});
 upstream.on('error',e=>{res.writeHead(502);res.end(e.message)});upstream.end();
}).listen(Number(port),'127.0.0.1',()=>console.log(`candidate proxy https://127.0.0.1:${port}, public assets from deployed QA`));
