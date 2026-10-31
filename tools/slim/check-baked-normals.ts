/** Compare every regenerated GPU delivery, including corpse/infected surfaces. */
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { decodeCivilianBake } from '../../src/assets/civilianBakeData';
const baseline = '53949e814', original = (p:string) => execFileSync('git', ['show', `${baseline}:${p}`], { maxBuffer: 64*1024*1024 });
const before = JSON.parse(original('src/assets/civilianBakes.json').toString()) as Record<string,string>;
const after = JSON.parse(readFileSync('src/assets/civilianBakes.json','utf8')) as Record<string,string>;
const build = JSON.parse(readFileSync('docs/reports/slim/rollout/build.json','utf8')) as {receipts:{id:string}[]};
const ids = new Set(build.receipts.map(r=>r.id)), rows=[];
const census = (gz:Uint8Array) => {
  const data=gunzipSync(gz), bake=decodeCivilianBake(data.buffer.slice(data.byteOffset,data.byteOffset+data.byteLength));
  const normal=bake.geometry.getAttribute('normal'), parts=bake.geometry.getAttribute('_parts'), vein=bake.geometry.getAttribute('_vein');
  let nonfinite=0,bodyZero=0,hiddenZero=0;
  for(let i=0;i<normal.count;i++) {
    const v=[normal.getX(i),normal.getY(i),normal.getZ(i)];
    if(!v.every(Number.isFinite)) nonfinite++;
    if(v.reduce((s,x)=>s+x*x,0)<1e-12) {if((parts?.getW(i)??vein?.getX(i)??0)<1024)bodyZero++;else hiddenZero++;}
  }
  bake.geometry.dispose(); return {nonfinite,bodyZero,hiddenZero};
};
for(const key of Object.keys(after).filter(k=>ids.has(k.split(':')[0]))) {
  const b=census(original(`public${before[key]}`)), a=census(readFileSync(`public${after[key]}`));
  assert.equal(a.nonfinite,0,`${key}: nonfinite normals`); assert.ok(a.bodyZero<=b.bodyZero,`${key}: new zero body normals`);
  rows.push({key,before:b,after:a});
}
writeFileSync('docs/reports/slim/rollout/baked-normal-audit.json',JSON.stringify({baseline,files:rows.length,pass:true,rows},null,2)+'\n');
console.log(`PASS: ${rows.length} GPU deliveries, no nonfinite normals or new zero body normals`);
