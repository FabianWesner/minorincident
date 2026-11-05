/** z-fight offenders of the authored source tiers (assets/<id>/model*.glb): tsx tools/assets/zfight-source.ts <regex> */
import { existsSync, readdirSync } from 'node:fs';
import { assetIO } from './io';
import { coplanarOverlaps } from './zfight';

const filter = new RegExp(process.argv[2] ?? '.');
const io = await assetIO();
for (const dir of readdirSync('assets').filter(d => filter.test(d))) {
  for (const [tier, file] of ['model.glb', 'model.lod1.glb', 'model.lod2.glb'].entries()) {
    const path = `assets/${dir}/${file}`;
    if (!existsSync(path)) continue;
    const offenders = coplanarOverlaps(await io.read(path));
    if (!offenders.length) continue;
    console.log(`${dir}:lod${tier}: ${offenders.length}`);
    for (const o of offenders.slice(0, 6)) console.log(`   ${o.materials.join(' / ')} ${o.nodes.join(' + ')} ${(o.area * 1e4).toFixed(0)} cm2 at ${o.at.map(v => v.toFixed(2)).join(',')} n ${o.normal.map(v => v.toFixed(2)).join(',')}`);
  }
}
