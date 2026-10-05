import { expect, test, vi } from 'vitest';
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import manifest from '../../../src/assets/manifest.json';
import type { AssetDef } from '../../../src/assets/types';
import { buildAsset } from '../../../tools/assets/build';
import { validateAssets } from '../../../tools/assets/validate';
import { assetIO } from '../../../tools/assets/io';

vi.mock('node:child_process', () => ({ spawnSync: vi.fn() }));

test('T-E17-01 @E17-AC01 staged exports are deterministic and exporter errors are fatal', async () => {
  const original = manifest.find((a) => a.id === 'veh.fire-engine')! as AssetDef;
  mkdirSync('.cache/assets',{recursive:true});
  const directory = mkdtempSync('.cache/assets/unit-');
  const def: AssetDef = { ...original, glb: `${directory}/veh.fire-engine.glb`, lods: { lod1: `${directory}/veh.fire-engine.lod1.glb`, lod2: `${directory}/veh.fire-engine.lod2.glb` } };
  // Exercise the real optimizer/staging pipeline from the committed export, without rebuilding art.
  const exported = readFileSync(original.glb);
  vi.mocked(spawnSync).mockImplementation(() => {
    writeFileSync(`.cache/assets/${def.id}.glb`, exported);
    return { status: 0 } as ReturnType<typeof spawnSync>;
  });
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
  expect(vi.mocked(spawnSync).mock.calls[0][1]).toContain('--bake-ao');
  vi.mocked(spawnSync).mockReturnValue({ status: 1 } as ReturnType<typeof spawnSync>);
  await expect(buildAsset(def)).rejects.toThrow('Blender failed');
  vi.mocked(spawnSync).mockReset();
  rmSync(directory,{recursive:true,force:true});
}, 30_000);
test('T-E17-04 @E17-AC04 fire-engine Blender proof matches legacy dimensions and all LODs validate', async () => {
  const original = manifest.find((a) => a.id === 'veh.fire-engine')! as AssetDef;
  const results = await validateAssets([{ ...original, status: 'modeled' }]);
  expect(results).toHaveLength(3);
  for (const result of results) {
    expect(result.errors, result.id).toEqual([]);
    for (const [axis, target] of [7.4,3.55,2.1].entries()) expect(Math.abs(result.dimensions[axis] - target)).toBeLessThanOrEqual(target * .05);
  }
});
