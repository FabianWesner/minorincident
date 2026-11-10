/** r27-visp2: triangle count and part count of every delivered infected bake LOD (the frozen corpse of an animal reuses LOD2). */
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { decodeCivilianBake } from '../../src/assets/civilianBakeData.ts';
const deliveries = JSON.parse(readFileSync('src/assets/civilianBakes.json', 'utf8'));
const only = process.argv[2] ?? 'zebra|lion|lioness|gorilla|elephant|monkey|flamingo';
for (const [key, file] of Object.entries(deliveries)) {
  const m = key.match(/^inf\.([a-z-]+):(lod\d):infected$/);
  if (!m || !new RegExp(`^(${only})$`).test(m[1])) continue;
  const bytes = gunzipSync(readFileSync(`public${file}`));
  const baked = decodeCivilianBake(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
  const g = baked.geometry;
  console.log(key.padEnd(28), 'tris', String((g.index?.count ?? g.getAttribute('position').count) / 3).padStart(6), 'verts', g.getAttribute('position').count, 'parts', baked.clip.parts.length);
}
