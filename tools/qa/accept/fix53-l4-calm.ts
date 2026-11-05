/** Add the measured L4-02 census to matching physical browser receipts. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { provenance } from './probe';
import type { FixtureReceipt } from './fixtures';
const identity=provenance(),input=process.argv[2] ?? 'docs/reports/fix53-b/L4-opening/matrix.json.gz';
const sha=createHash('sha256').update(readFileSync(input)).digest('hex');
const rows=JSON.parse(gunzipSync(readFileSync(input)).toString()) as {quality:'low'|'high';zoom:number;sourceHash:string;ledger:{level:string;l4Calm?:{tick:number;civilians:unknown[];infected:number}[]}[]}[];
for(const row of rows){
 assert.equal(row.sourceHash,identity.sourceHash);
 const samples=row.ledger.find(r=>r.level==='L4')!.l4Calm!.filter(s=>s.tick>=1829);assert(samples.length>0);
 const counts=samples.map(s=>s.civilians.length),min=Math.min(...counts),max=Math.max(...counts);
 const path=`docs/reports/fix51-verify/receipts/L4-${row.quality}-webgl2-z${row.zoom}-browser.json`;
 const receipt=JSON.parse(readFileSync(path,'utf8')) as FixtureReceipt;
 receipt.checks=receipt.checks.filter(c=>c.id!=='L4-02');
 receipt.checks.push({id:'L4-02',clause:'actual pre-pickup reception civilian census excluding soldiers',tier:row.quality,policy:'real-input-webgl2',status:min>=40?'PASS':'FAIL',
  value:{samples:samples.length,firstTick:samples[0].tick,lastTick:samples.at(-1)!.tick,minimum:min,maximum:max,routeZoom:row.zoom,input,sha256:sha},target:'at least40 civilians until pickup; routines/overlap still require separate qualification',receipt:path});
 writeFileSync(path,JSON.stringify(receipt,null,2)+'\n');
 console.log(row.quality,row.zoom,min,max);
}
