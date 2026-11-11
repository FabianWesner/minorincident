/** r36-lion: re-bake the four big-cat crowd deliveries, refresh civilianBakes.json and the manifest dimensions. */
import { readFileSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import type { AssetDef } from '../../src/assets/types';
import { assetIO } from './io';
import { skinCrowdBakes } from './skin-crowd-bakes';

const manifestPath = 'src/assets/manifest.json', manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as AssetDef[];
const bakesPath = 'src/assets/civilianBakes.json', bakes = JSON.parse(readFileSync(bakesPath, 'utf8')) as Record<string, string>;
const io = await assetIO();
for (const id of ['amb.lion', 'amb.lioness', 'inf.lion', 'inf.lioness']) {
  const def = manifest.find(a => a.id === id)!;
  for (const key of Object.keys(bakes)) if (key.startsWith(`${id}:`)) { const f = `public${bakes[key]}`; if (existsSync(f)) rmSync(f); }
  // dimensions = LOD0 bounding box of the bound skinned body (world metres, like the previous values)
  const d = await io.read(def.glb), position = d.getRoot().listNodes().find(n => n.getName() === 'skin_body')!.getMesh()!.listPrimitives()[0].getAttribute('POSITION')!;
  const lo = [1e9, 1e9, 1e9], hi = [-1e9, -1e9, -1e9], v = [0, 0, 0];
  for (let i = 0; i < position.getCount(); i++) { position.getElement(i, v); for (let k = 0; k < 3; k++) { lo[k] = Math.min(lo[k], v[k]); hi[k] = Math.max(hi[k], v[k]); } }
  const size = [0, 1, 2].map(i => hi[i] - lo[i]);
  def.dimensions = { ...def.dimensions, x: size[0], y: size[1], z: size[2] };
  Object.assign(bakes, await skinCrowdBakes(def));
  console.log(id, 'bounds', size.map(v => v.toFixed(3)).join(' x '));
}
writeFileSync(bakesPath, JSON.stringify(bakes, null, 2) + '\n');
writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
