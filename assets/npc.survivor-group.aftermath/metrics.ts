import {mkdirSync, readFileSync, statSync, writeFileSync} from 'node:fs';
import {getBounds} from '@gltf-transform/functions';
import {assetIO} from '../../tools/assets/io';
import {validateDocument} from '../../tools/assets/validate';
import type {AssetDef} from '../../src/assets/types';
const ids = ['int.metro-station','util.flashlight','npc.civilian-elderly.aftermath','npc.paramedic.aftermath','npc.civilian-woman-a.aftermath','npc.survivor-group.aftermath'];
const manifest = JSON.parse(readFileSync('src/assets/manifest.json','utf8')) as AssetDef[];
const io = await assetIO();
const reports = [];
for (const def of manifest.filter(a => ids.includes(a.id) || a.id.startsWith('npc.survivor-group.aftermath.'))) {
  for (const [lod,path] of [def.glb,def.lods!.lod1!,def.lods!.lod2!].entries()) {
    const document = await io.read(path), bytes = statSync(path).size;
    const report = validateDocument(document,def,bytes,lod);
    const figures = document.getRoot().listNodes().filter(n => /^survivor\d+_root$/.test(n.getName())).map(n => {
      const bounds = getBounds(n); return {name:n.getName(),height:bounds.max[1]-bounds.min[1]};
    });
    reports.push({...report,lod,path,bytes,figures});
  }
}
mkdirSync('test-results/l5-shelter-arrival-and-skins',{recursive:true});
writeFileSync('test-results/l5-shelter-arrival-and-skins/metrics.json',JSON.stringify(reports,null,2)+'\n');
console.log(JSON.stringify(reports.map(({id,lod,triangles,drawCalls,bytes,errors,figures})=>({id,lod,triangles,drawCalls,bytes,errors,figures})),null,2));
if(reports.some(r=>r.errors.length))process.exitCode=1;
