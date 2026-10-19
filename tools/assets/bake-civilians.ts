import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { coreCivilianModels } from '../../src/data/npcs';
import { l6CastModels } from '../../src/data/l6';
import { loadCivilianSource, disposeCivilianSource } from '../../src/assets/civilianSource';
import { encodeCivilianBake } from '../../src/assets/civilianBakeData';
import { prepareCivilianGeometry, prepareCivilianRig } from '../../src/render/npc/prepareCivilianGeometry';

// Run after changing civilian source GLBs, palette, clips or preparation code.
// The production loader retains the runtime worker path for unavailable bakes.
const directory = 'public/assets/civilians';
mkdirSync(directory, { recursive: true });
// Refresh only distant bodies after a LOD2 preparation change.
const lod2Only = process.argv.includes('--lod2');
const files: Record<string, string> = lod2Only ? JSON.parse(readFileSync('src/assets/civilianBakes.json', 'utf8')) : {};
let total = 0, count = 0;
for (const model of [...new Set([...coreCivilianModels, ...l6CastModels])].sort()) {
  for (const lod of lod2Only ? ['lod2'] as const : ['lod0', 'lod1', 'lod2'] as const) {
    const root = await loadCivilianSource(model, lod, async url => {
      const data = readFileSync(`public${url}`);
      return data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength);
    });
    try {
      prepareCivilianRig(root, model);
      const prepared = await prepareCivilianGeometry(root, model, lod === 'lod2'); prepared.rig = root;
      const bytes = gzipSync(encodeCivilianBake(prepared), { level: 9 });
      const name = `${model}.${lod}.${createHash('sha256').update(bytes).digest('hex').slice(0, 16)}.bin.gz`;
      writeFileSync(`${directory}/${name}`, bytes); files[`${model}:${lod}`] = `/assets/civilians/${name}`;
      total += bytes.length; count++; prepared.geometry.dispose();
    } finally { disposeCivilianSource(root); }
  }
}
writeFileSync('src/assets/civilianBakes.json', JSON.stringify(files, null, 2) + '\n');
console.log(`${count} lossless civilian bakes: ${(total / 1048576).toFixed(2)} MiB gzip`);
