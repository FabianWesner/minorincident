/** Write reviewable measurements from the delivered GLBs. */
import { statSync, writeFileSync } from 'node:fs';
import { getBounds } from '@gltf-transform/functions';
import manifest from '../../src/assets/manifest.json';
import { assetIO } from '../../tools/assets/io';
import { triangleCount } from '../../tools/assets/delivery';
import { validateDocument } from '../../tools/assets/validate';
const def = manifest.find(entry => entry.id === 'veh.courier-bike')!, io = await assetIO();
const tiers = [];
for (const [level, suffix] of ['', '.lod1', '.lod2'].entries()) {
  const source = `assets/${def.id}/model${suffix}.glb`, packed = `public/assets/models/${def.id}${suffix}.glb`;
  const doc = await io.read(packed), original = await io.read(source);
  const checks = validateDocument(doc, def, statSync(packed).size, level, original);
  if (checks.errors.length) throw new Error(JSON.stringify(checks));
  tiers.push({ level, source_bytes: statSync(source).size, packed_bytes: statSync(packed).size,
    triangles: triangleCount(doc), bounds: getBounds(doc.getRoot().listScenes()[0]),
    authored: doc.getRoot().listScenes()[0].getExtras().deliveryLodGenerated !== true,
    nodes: Object.fromEntries(doc.getRoot().listNodes().filter(node => def.requiredNodes.includes(node.getName())).map(node => [node.getName(), node.getWorldTranslation().map(n => Math.round(n * 100000) / 100000)])),
    validation: checks });
}
const ratio1 = tiers[1].triangles / tiers[0].triangles, ratio2 = tiers[2].triangles / tiers[0].triangles;
const report = { id: def.id, tier: def.tier,
  triangles: Object.fromEntries(tiers.map(tier => [`lod${tier.level}`, tier.triangles])),
  file_bytes: Object.fromEntries(tiers.map(tier => [`lod${tier.level}`, tier.packed_bytes])),
  source_file_bytes: Object.fromEntries(tiers.map(tier => [`lod${tier.level}`, tier.source_bytes])),
  draw_calls: tiers[0].validation.drawCalls,
  nodes_ok: tiers.every(tier => def.requiredNodes.every(name => name in tier.nodes)),
  within_budget: ratio1 <= .155 && ratio2 <= .045 && tiers[1].packed_bytes <= tiers[0].packed_bytes * .25 && tiers.every(tier => !tier.validation.errors.length),
  lod_ratios: { lod1: ratio1, lod2: ratio2 },
  axis: '+X forward, +Y up, +Z right (glTF)', wheel_count: 2, tiers,
  contact_sheet: 'assets/veh.courier-bike/contact-sheet.png', renderer: 'Cycles CPU', webgpu_ok: false };
writeFileSync(`assets/${def.id}/report.json`, JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(tiers.map(({ level, source_bytes, packed_bytes, triangles, authored }) => ({ level, source_bytes, packed_bytes, triangles, authored }))));
