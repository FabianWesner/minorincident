/** Real triangle / mesh / material counts of the authored source tiers: tsx tools/assets/count-tris.ts <regex> */
import { existsSync, readdirSync } from 'node:fs';
import { assetIO } from './io';

const filter = new RegExp(process.argv[2] ?? '.');
const io = await assetIO();
for (const dir of readdirSync('assets').filter(d => filter.test(d))) {
  const cells: string[] = [];
  for (const file of ['model.glb', 'model.lod1.glb', 'model.lod2.glb']) {
    const path = `assets/${dir}/${file}`;
    if (!existsSync(path)) { cells.push('-'); continue; }
    const doc = await io.read(path);
    let tris = 0;
    const mats = new Set<string>();
    for (const mesh of doc.getRoot().listMeshes()) {
      for (const prim of mesh.listPrimitives()) {
        tris += (prim.getIndices()?.getCount() ?? prim.getAttribute('POSITION')!.getCount()) / 3;
        const mat = prim.getMaterial();
        if (mat) mats.add(mat.getName());
      }
    }
    cells.push(`${tris}t/${doc.getRoot().listMeshes().length}draw/${mats.size}mat`);
  }
  console.log(dir.padEnd(34), cells.join('  '));
}
