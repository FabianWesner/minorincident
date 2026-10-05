import { expect, test } from 'vitest';
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import manifest from '../../../src/assets/manifest.json';
import type { AssetDef } from '../../../src/assets/types';
import { buildAsset } from '../../../tools/assets/build';
import { validateAssets } from '../../../tools/assets/validate';
import { assetIO } from '../../../tools/assets/io';

test('T-E17-01 @E17-AC01 real Blender builds are deterministic and script errors are fatal', async () => {
  const def = manifest.find((a) => a.id === 'veh.fire-engine')! as AssetDef;
  const first = await buildAsset(def), second = await buildAsset(def);
  expect(first).toBe(second);
  expect(existsSync(def.glb)).toBe(true);
  expect(JSON.parse(readFileSync(def.glb.replace('.glb', '.meta.json'), 'utf8')).hash).toBe(first);
  const doc = await (await assetIO()).read(def.glb);
  expect(doc.getRoot().listMeshes().every(mesh => mesh.listPrimitives().every(p => p.getAttribute('COLOR_0')))).toBe(true);
  const node = (name: string) => doc.getRoot().listNodes().find(n => n.getName() === name)!;
  expect(node('driverSeat').getWorldTranslation()[0]).toBeGreaterThan(2);
  expect(node('sirenL').getWorldTranslation()[1]).toBeGreaterThan(2.5);
  expect(node('sirenL').getWorldTranslation()[2]).not.toBe(node('sirenR').getWorldTranslation()[2]);
  const failed = spawnSync('python3', ['tools/blender/run.py', 'tests/fixtures/asset-error.py'], { encoding: 'utf8' });
  expect(failed.status).not.toBe(0); expect(failed.stdout + failed.stderr).toContain('deliberate E17 script failure');
}, 120_000);
test('T-E17-04 @E17-AC04 fire-engine Blender proof matches legacy dimensions and all LODs validate', async () => {
  const original = manifest.find((a) => a.id === 'veh.fire-engine')! as AssetDef;
  const results = await validateAssets([{ ...original, status: 'modeled' }]);
  expect(results).toHaveLength(3);
  for (const result of results) {
    expect(result.errors, result.id).toEqual([]);
    for (const [axis, target] of [7.4,3.55,2.1].entries()) expect(Math.abs(result.dimensions[axis] - target)).toBeLessThanOrEqual(target * .05);
  }
});
