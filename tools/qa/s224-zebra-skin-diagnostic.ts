import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { Matrix4, Vector3 } from 'three';
import { decodeCivilianBake } from '../../src/assets/civilianBakeData';
import { skinnedVertexMatrix } from '../../src/render/characters/skinnedCrowd';
import { infectedClips, framesPerClip } from '../../src/render/characters/crowdClipNames';
const map=JSON.parse(readFileSync('src/assets/civilianBakes.json','utf8')) as Record<string,string>;
const raw=gunzipSync(readFileSync(`public${map['inf.zebra:lod2:infected']}`));
const bake=decodeCivilianBake(raw.buffer.slice(raw.byteOffset,raw.byteOffset+raw.byteLength));
const g=bake.geometry,pos=g.getAttribute('position'),part=g.getAttribute('_part_index'),skin=g.getAttribute('_skin'),idx=g.getIndex()!;
const tmp=new Float32Array(16),mat=new Matrix4(),v=new Vector3();
for(const name of ['idle','infected-run','swing','zebra-rear-kick','zebra-stampede'] as const){
 let max=0, worst: unknown;
 for(let frame=0;frame<framesPerClip;frame++){
  const offset=(infectedClips.indexOf(name)*framesPerClip+frame)*bake.clip.parts.length*16,posed:Vector3[]=[];
  for(let i=0;i<pos.count;i++){skinnedVertexMatrix(bake.clip,offset,part,skin,i,tmp);mat.fromArray(tmp);posed.push(v.fromBufferAttribute(pos,i).applyMatrix4(mat).clone());}
  for(let t=0;t<idx.count;t+=3){const ids=[0,1,2].map(k=>idx.getX(t+k));for(const [a,b] of [[0,1],[1,2],[2,0]]){const x=ids[a],y=ids[b],dist=posed[x].distanceTo(posed[y]);if(dist>max){max=dist;worst={frame,ids:[x,y],bind:[v.fromBufferAttribute(pos,x).toArray(),v.fromBufferAttribute(pos,y).toArray()],posed:[posed[x].toArray(),posed[y].toArray()],parts:[bake.clip.parts[part.getX(x)],bake.clip.parts[part.getX(y)]],skin:[skin.getX(x),skin.getY(x),skin.getZ(x),skin.getW(x),skin.getX(y),skin.getY(y),skin.getZ(y),skin.getW(y)]};}}}
 }
 console.log(name,max.toFixed(3),JSON.stringify(worst));
}
