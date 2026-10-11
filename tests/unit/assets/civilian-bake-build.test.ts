import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { expect, test } from 'vitest';
import files from '../../../src/assets/civilianBakes.json';
import { loadCivilianSource, disposeCivilianSource } from '../../../src/assets/civilianSource';
import { encodeCivilianBake, decodeCivilianBake } from '../../../src/assets/civilianBakeData';
import { prepareCivilianGeometry, prepareCivilianRig } from '../../../src/render/npc/prepareCivilianGeometry';

for (const [key, path] of Object.entries(files)) test(`${key}: shipped bake exactly matches runtime preparation`, async () => {
  const [model, lod] = key.split(':') as [string, 'lod0' | 'lod1' | 'lod2'];
  const root = await loadCivilianSource(model, lod, async url => {
    const bytes = readFileSync(`public${url}`);
    return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
  });
  try {
    prepareCivilianRig(root, model);
    const prepared = await prepareCivilianGeometry(root, model, lod === 'lod2'); prepared.rig = root;
    const bytes = gunzipSync(readFileSync(`public${path}`));
    expect(bytes.equals(Buffer.from(encodeCivilianBake(prepared)))).toBe(true);
    const decoded = decodeCivilianBake(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
    expect(Buffer.from(encodeCivilianBake(decoded)).equals(bytes)).toBe(true);
    decoded.geometry.dispose(); prepared.geometry.dispose();
  } finally { disposeCivilianSource(root); }
}, 120_000);
