/** Read-only current delivery geometry heights; no historical Git revisions. */
import { readFileSync, writeFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { decodeCivilianBake } from '../../../src/assets/civilianBakeData.ts';
import { heroineStandingHeight, civilianHeight } from '../../../src/render/npc/figureHeight.ts';
import { provenance } from './probe.ts';
const manifest=JSON.parse(readFileSync('src/assets/manifest.json','utf8')),bakes=JSON.parse(readFileSync('src/assets/civilianBakes.json','utf8'));
const animals=/corgi|dog|cat|crow|lion|gorilla|flamingo|zebra|elephant/;
const rows=[],errors=[];
for(const def of manifest.filter(d=>['character','infected'].includes(d.category)&&d.crowdSkin&&!animals.test(d.id))) {
 for(const lod of ['lod0','lod1','lod2']){
  const key=`${def.id}:${lod}${def.id.startsWith('npc.')?'':':infected'}`,path=bakes[key];if(!path)continue;
  try{const file='public'+path,compressed=readFileSync(file),bytes=gunzipSync(compressed),bake=decodeCivilianBake(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength));
   const p=bake.geometry.getAttribute('position'),parts=bake.geometry.getAttribute('_parts'),marks=bake.geometry.getAttribute('_vein'),eyes=bake.geometry.getAttribute('_emissive');let low=Infinity,high=-Infinity;
   for(let i=0;i<p.count;i++)if(parts?parts.getW(i)<1024&&parts.getZ(i)<1.5:(marks?.getX(i)??0)<1024&&(eyes?.getX(i)??0)<1.5){low=Math.min(low,p.getY(i));high=Math.max(high,p.getY(i));}
   const target=def.id.startsWith('npc.')?civilianHeight(def.id):null;rows.push({id:def.id,lod,file,sha256:createHash('sha256').update(compressed).digest('hex'),vertices:p.count,ground:low,height:high-low,target,delta:target===null?null:high-low-target});bake.geometry.dispose();
  }catch(e){errors.push({key,error:String(e)});}
 }
}
const result={...provenance(),heroineStandingHeight,method:'Current delivery-manifest encoded body geometry, same body-part exclusion as existing q257 census. Exact LOD extents, no source assets edited.',rows,errors,limitations:['Does not qualify live runtime accessories, grips, seat contact or moving body proportions.','Authored infected sizes are recorded separately without assuming civilian fit. Children retain authored relative heights.']};
writeFileSync('docs/reports/sweep-g/G-26-heights.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({rows:rows.length,errors,civilianHeightOutliers:rows.filter(r=>r.target!==null&&Math.abs(r.delta)>.001)}));
