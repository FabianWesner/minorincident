import { expect, test } from 'vitest';
import { mkdtempSync, mkdirSync, rmSync, existsSync } from 'node:fs';
import manifest from '../../../src/assets/manifest.json';
import type { AssetDef } from '../../../src/assets/types';
import { packAsset } from '../../../tools/assets/pack';
import { assetIO } from '../../../tools/assets/io';
import { triangleCount } from '../../../tools/assets/delivery';

test('@E17-AC01 packing a base delivers every declared decay and preserves native tiers', async () => {
  mkdirSync('.cache/assets', { recursive: true });
  const directory = mkdtempSync('.cache/assets/commerce-pack-');
  const original = manifest.find(a => a.id === 'bld.mainstreet-brick')! as AssetDef;
  const io = await assetIO();
  try {
    await packAsset({ ...original, glb: `${directory}/brick.glb`, lods: { lod1: `${directory}/brick.lod1.glb`, lod2: `${directory}/brick.lod2.glb` } });
    for (const decay of ['w2', 'w3']) for (const tier of [0, 1, 2]) {
      const suffix = tier ? `.lod${tier}` : '';
      const destination = `${directory}/brick.${decay}${suffix}.glb`;
      expect(existsSync(destination)).toBe(true);
      expect(triangleCount(await io.read(destination))).toBe(triangleCount(await io.read(`assets/${original.id}/model.${decay}${suffix}.glb`)));
    }
  } finally { rmSync(directory, { recursive: true, force: true }); }
}, 30_000);
