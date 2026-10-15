import { assetIO } from '../../../tools/assets/io';
import { getBounds } from '@gltf-transform/functions';
import { writeFileSync } from 'node:fs';
const io = await assetIO();
// Assets face +X: lateral width is Z, height Y, front-to-back depth X.
const rows = [];
for (const id of ['inf.alpha', 'inf.mega-alpha']) for (const lod of ['', '.lod1', '.lod2']) {
  const doc = await io.read(`public/assets/models/${id}${lod}.glb`);
  for (const node of doc.getRoot().listNodes()) if (node.getName().startsWith('stump_')) node.setMesh(null);
  const b = getBounds(doc.getRoot().listScenes()[0]), size = b.max.map((v, i) => v-b.min[i]);
  rows.push({id,lod:lod || 'lod0', width:size[2],height:size[1],depth:size[0]});
}
writeFileSync('docs/reports/alpha-look/dimensions.json',JSON.stringify(rows,null,2)+'\n');
console.log(rows);
