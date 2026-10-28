/** Inspect delivered Mega skin deformation in the actual frozen side-fall pose. */
import { readFileSync, writeFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { Matrix4, Vector3 } from 'three';
import { decodeCivilianBake } from '../../src/assets/civilianBakeData';
import { packCrowdParts } from '../../src/assets/crowdParts';
import { framesPerClip, infectedClips } from '../../src/render/characters/bakeInfected';
import { groundDeathFeet } from '../../src/render/characters/proneDeath';
import { skinnedVertexMatrix } from '../../src/render/characters/skinnedCrowd';
const registry = JSON.parse(readFileSync('src/assets/civilianBakes.json','utf8')) as Record<string,string>, rows=[];
for(const id of ['inf.mega-alpha','inf.mega-alpha-ashen','inf.mega-alpha-ember']) for(const lod of ['lod0','lod1','lod2']) for(const grounded of [false,true]) {
 const bytes=gunzipSync(readFileSync('public'+registry[`${id}:${lod}:infected`])),bake=decodeCivilianBake(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength));
 packCrowdParts(bake.geometry);if(grounded)groundDeathFeet(bake.clip,'death-side');
 const g=bake.geometry,p=g.getAttribute('position'),parts=g.getAttribute('_parts'),skin=g.getAttribute('_skin'),indices=g.index!,frame=(infectedClips.indexOf('death-side')*framesPerClip+framesPerClip-1)*bake.clip.parts.length*16;
 const rest=Array.from({length:p.count},(_,i)=>new Vector3().fromBufferAttribute(p,i)),posed=rest.map((v,i)=>v.clone().applyMatrix4(new Matrix4().fromArray(skinnedVertexMatrix(bake.clip,frame,parts,skin,i,new Float32Array(16))))),bad=[];
 for(let i=0;i<indices.count;i+=3){const tri=[0,1,2].map(k=>indices.getX(i+k));if(tri.some(v=>parts.getW(v)>=1024||parts.getZ(v)>1.5))continue;
  for(let j=0;j<3;j++){const a=tri[j],b=tri[(j+1)%3],before=rest[a].distanceTo(rest[b]),after=posed[a].distanceTo(posed[b]);if(before>.005&&after>Math.max(.3,before*3))bad.push({triangle:i/3,before,after,vertices:[a,b].map(v=>({rest:rest[v].toArray(),posed:posed[v].toArray(),owner:bake.clip.parts[parts.getX(v)],packed:Array.from({length:4},(_,k)=>skin.getComponent(v,k))}))});}
 }
 bad.sort((a,b)=>b.after-a.after);rows.push({id,lod,grounded,stretchedEdges:bad.length,worst:bad.slice(0,3)});console.log(JSON.stringify({id,lod,grounded,stretchedEdges:bad.length,worst:bad[0]}));
}
writeFileSync(process.env.L10_DEATH_OUT??'test-results/l10-all-new/death-deformation.json',JSON.stringify(rows,null,2)+'\n');
