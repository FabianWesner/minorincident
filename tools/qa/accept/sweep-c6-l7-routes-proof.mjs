import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync,writeFileSync} from 'node:fs';
import {gzipSync,gunzipSync} from 'node:zlib';
import {l7RouteReceipts} from './l7-route-receipts.ts';
import {provenance} from './probe.ts';
import {browserHash} from './browser.ts';
const root='docs/reports/sweep-c6/L7-06',sha=b=>createHash('sha256').update(b).digest('hex'),identity=provenance(),bh=browserHash();
const paths=['low-A-physical.json.gz','low-B-physical.json.gz','high-A-physical.json.gz','high-B-physical.json.gz','low-screen-physical.json.gz','review.json','bounds-low/bounds-sweep.json','bounds-provenance.json'].map(p=>`${root}/${p}`),original=new Map(paths.map(p=>[p,readFileSync(p)]));
const reset=()=>{for(const[p,b]of original)writeFileSync(p,b);};
const result=()=>l7RouteReceipts(identity.sourceHash,bh).flatMap(x=>x.receipt.checks);
assert(result().every(c=>c.status==='PASS'));
const cases=[];
function attempt(name,file,mutate){reset();const path=`${root}/${file}`,raw=original.get(path),data=JSON.parse((file.endsWith('.gz')?gunzipSync(raw):raw).toString());mutate(data);const encoded=file.endsWith('.gz')?gzipSync(JSON.stringify(data)):Buffer.from(JSON.stringify(data));writeFileSync(path,encoded);
 if(file!=='review.json'){const v=JSON.parse(readFileSync(`${root}/review.json`));for(const a of v.artifacts)if(a.file===path)a.sha256=sha(encoded);writeFileSync(`${root}/review.json`,JSON.stringify(v));}
 const checks=result();assert(checks.some(c=>c.status!=='PASS'),name);cases.push({name,rejected:true});}
try{
 for(const file of ['low-A-physical.json.gz','high-B-physical.json.gz']){
 attempt(`${file}/stale-source`,file,a=>a.sourceHash='bad');attempt(`${file}/stale-browser`,file,a=>a.browserHash='bad');attempt(`${file}/producer`,file,a=>a.toolSha256='bad');attempt(`${file}/native-driver`,file,a=>a.inputs[5].nativeDriver=true);attempt(`${file}/tick-gap`,file,a=>a.inputs.splice(20,1));attempt(`${file}/no-route`,file,a=>{for(const s of a.samples){s.player.x=273;s.player.z=15;}});attempt(`${file}/console-error`,file,a=>a.errors.push('error'));}
 attempt('screen-not-physical','low-screen-physical.json.gz',a=>a.inputs[3].nativeDriver=true);
 attempt('screen-no-commands','low-screen-physical.json.gz',a=>a.commands=a.commands.filter(c=>!c.screenshotOnly));
 attempt('screen-no-reason','low-screen-physical.json.gz',a=>a.commands.find(c=>c.screenshotOnly).reason='');
 attempt('screen-no-corridor','low-screen-physical.json.gz',a=>{for(const s of a.samples)s.player.x=273;});
 attempt('unseen-frame','review.json',v=>v.captures[0].seen='');attempt('no-personal-review','review.json',v=>v.allPersonallyReviewed=false);attempt('clarity-not-qualified','review.json',v=>v.clarity.pass=false);
 attempt('boundary-escape','bounds-low/bounds-sweep.json',v=>v.results[0].failures.push({maxOutside:2}));
 attempt('stale-bounds','bounds-provenance.json',v=>v.sourceHash='bad');
}finally{reset();assert(result().every(c=>c.status==='PASS'));}
writeFileSync(`${root}/coverage-proof.json`,JSON.stringify({...identity,toolSha256:sha(readFileSync(new URL(import.meta.url))),cases,allRejected:true,restored:true},null,2)+'\n');console.log(`${cases.length} semantic controls rejected, original bytes restored`);
