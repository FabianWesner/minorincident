// After building --lod2 source variants into .cache/m1-art/{female,man,driver}-lod2.glb,
// run npx tsx assets/char.survivor-female/pack-lod2.ts. These are authored tiers.
import {optimizeAsset} from '../../tools/assets/optimize';
import {assetIO} from '../../tools/assets/io';
import {triangleCount} from '../../tools/assets/delivery';
import manifest from '../../src/assets/manifest.json';
import type {AssetDef} from '../../src/assets/types';
const io=await assetIO();
for(const [id,file] of [['char.survivor-female','female'],['npc.civilian-man-a','man'],['inf.delivery-driver','driver']]) {
 const def=manifest.find(d=>d.id===id) as AssetDef;
 const output=def.lods!.lod2!;
 await optimizeAsset(`.cache/m1-art/${file}-lod2.glb`,output,def,.02);
 const doc=await io.read(output);
 for(const scene of doc.getRoot().listScenes()) {const extras=scene.getExtras();delete extras.deliveryLodGenerated;scene.setExtras(extras);}
 await io.write(`assets/${id}/model.lod2.glb`,doc);
 console.log(id,triangleCount(doc));
}
