import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { assetIO } from '../assets/io';
import { triangleCount } from '../assets/delivery';
import { compositions } from '../../src/levels/compositions';
import { levelTwoLayouts } from '../../src/levels/L2/layout';
import { levelThreeLayouts } from '../../src/levels/L3/layout';
import { levelFourLayouts } from '../../src/levels/L4/layout';
import { levelFiveLayouts } from '../../src/levels/L5/layout';
import type { AssetDef } from '../../src/assets/types';
import { variantPath } from '../../src/assets/types';
import type { DistrictLayout } from '../../src/levels/districts/types';
const dir='docs/scenes/l3-roofs'; mkdirSync(dir,{recursive:true});
const manifest=JSON.parse(readFileSync('src/assets/manifest.json','utf8')) as AssetDef[];
const io=await assetIO();
const assets=[];
for(const def of manifest.filter(d=>/^(bld\.|house\.|int\.)/.test(d.id))) {
 const lods=[];
 for(const decay of ['',...def.decayVariants]) for(const [lod,basePath] of Object.entries({lod0:def.glb,...def.lods})) {
  const path=basePath && variantPath(basePath,decay||undefined);
  if(!path) continue;
  const doc=await io.read(path);
  const roofs=doc.getRoot().listNodes().filter(n=>/roof|ceiling/i.test(n.getName()));
  lods.push({lod,decay,path,triangles:triangleCount(doc),roofs:roofs.map(n=>({name:n.getName(),geometry:[n,...n.listChildren()].some(child=>child.getMesh())}))});
 }
 assets.push({id:def.id,lods});
}
const placements=[];
for(const level of ['L1','L2','L3','L4','L5','L6']){
 let layouts=compositions[level].districts.map(d=>JSON.parse(readFileSync(`public/assets/layouts/${d.id}.layout.json`,'utf8')) as DistrictLayout);
 if(level==='L2')layouts=levelTwoLayouts(layouts);if(level==='L3')layouts=levelThreeLayouts(layouts);if(level==='L4')layouts=levelFourLayouts(layouts);if(level==='L5')layouts=levelFiveLayouts(layouts);
 for(const layout of layouts)for(const p of layout.placements.filter(p=>/^(bld\.|house\.|int\.)/.test(p.assetId)&&p.minTier<=compositions[level].tier&&p.maxTier>=compositions[level].tier))placements.push({level,district:layout.district,id:p.id,asset:p.assetId,position:p.position,yaw:p.yaw,scale:p.scale,decay:p.decay});
}
writeFileSync(`${dir}/sweep.json`,JSON.stringify({assets,placements},null,2));
console.log(`${assets.length} catalog entries, ${assets.reduce((n,a)=>n+a.lods.length,0)} LODs; ${placements.length} active building/module placements across L1-L6`);
for(const id of ['bld.pharmacy','bld.supermarket','bld.gym','int.basement-cellar'])console.log(id,placements.filter(p=>p.asset===id).map(p=>`${p.level}:${p.id}@${p.position}`).join(' '));
