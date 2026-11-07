/** Inspect delivered hand morphs in native hand-local metres. */
import {readFileSync,writeFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {Matrix4,Vector3} from 'three';
import {decodeCivilianBake} from '../../src/assets/civilianBakeData.ts';
const files=JSON.parse(readFileSync('src/assets/civilianBakes.json','utf8')), rows=[];
for(const model of ['npc.civilian-man-a','npc.civilian-man-b','npc.civilian-woman-a','npc.civilian-woman-b']) for(const lod of ['lod1','lod2']) {
 const bytes=gunzipSync(readFileSync(`public${files[`${model}:${lod}`]}`)),b=decodeCivilianBake(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength));
 const p=b.geometry.getAttribute('position'),q=b.geometry.getAttribute('_gripPosition'),parts=b.geometry.getAttribute('_parts'),hand=b.clip.parts.indexOf('handR'), inverse=new Matrix4().fromArray(b.clip.binds,hand*16),a=new Vector3(),c=new Vector3();
 const affected=[];
 for(let i=0;i<p.count;i++) {a.fromBufferAttribute(p,i);c.fromBufferAttribute(q,i);const movement=a.distanceTo(c);if(movement>.00001)affected.push({index:i,part:b.clip.parts[parts.getX(i)],local:a.applyMatrix4(inverse).toArray(),movement});}
 affected.sort((a,b)=>b.movement-a.movement);rows.push({model,lod,affected:affected.length,maxMovement:affected[0],worst:affected.slice(0,4)});
 b.geometry.dispose();
}
writeFileSync('test-results/blk-v/grip-morph-audit.json',JSON.stringify(rows,null,2)+'\n');
console.log(JSON.stringify(rows.map(({model,lod,affected,maxMovement})=>({model,lod,affected,maxMovement})),null,2));
