import { expect, test, vi } from 'vitest';
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import manifest from '../../../src/assets/manifest.json';
import type { AssetDef } from '../../../src/assets/types';
import { buildAsset } from '../../../tools/assets/build';
import { validateAssets } from '../../../tools/assets/validate';
import { assetIO } from '../../../tools/assets/io';
import { triangleCount } from '../../../tools/assets/delivery';

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

test('@E17-AC01 wreck builds preserve authored distance meshes and validate all variant files', async () => {
  const original = manifest.find(a => a.id === 'veh.sedan-red')! as AssetDef;
  const directory = mkdtempSync('.cache/assets/wreck-unit-');
  const def: AssetDef = { ...original, glb: `${directory}/sedan.glb`, lods: { lod1: `${directory}/sedan.lod1.glb`, lod2: `${directory}/sedan.lod2.glb` } };
  const io = await assetIO();
  vi.mocked(spawnSync).mockImplementation(() => {
    writeFileSync(`.cache/assets/${def.id}.glb`, readFileSync(`assets/${def.id}/model.wrecked.glb`));
    return { status: 0 } as ReturnType<typeof spawnSync>;
  });
  try {
    await buildAsset(def, { decay: 'wrecked' });
    expect(vi.mocked(spawnSync).mock.calls.at(-1)![1]).toContain('--decay');
    for (const lod of [1, 2]) {
      const output = await io.read(`${directory}/sedan.wrecked.lod${lod}.glb`);
      const source = await io.read(`assets/${def.id}/model.wrecked.lod${lod}.glb`);
      expect(triangleCount(output)).toBe(triangleCount(source));
    }
    const reports = await validateAssets([original]);
    expect(reports.filter(r => r.id.startsWith('veh.sedan-red.wrecked:'))).toHaveLength(3);
    expect(reports.flatMap(r => r.errors)).toEqual([]);
    await expect(buildAsset(def, { decay: 'missing' })).rejects.toThrow('Unknown decay variant');
  } finally {
    vi.mocked(spawnSync).mockReset();
    rmSync(directory, { recursive: true, force: true });
  }
});

test('@E17-AC01 decay build rejects the stricter draw budget before publishing', async () => {
  const original = manifest.find(a => a.id === 'veh.sedan-red')! as AssetDef;
  const directory = mkdtempSync('.cache/assets/house-unit-');
  const def: AssetDef = { ...original, glb: `${directory}/house.glb`, decayBudget: { drawCalls: 0 } };
  vi.mocked(spawnSync).mockImplementation(() => {
    writeFileSync(`.cache/assets/${def.id}.glb`, readFileSync(`assets/${def.id}/model.wrecked.glb`));
    return { status: 0 } as ReturnType<typeof spawnSync>;
  });
  try {
    await expect(buildAsset(def, { decay: 'wrecked' })).rejects.toThrow('static drawCalls:');
    expect(existsSync(`${directory}/house.wrecked.glb`)).toBe(false);
  } finally {
    vi.mocked(spawnSync).mockReset();
    rmSync(directory, { recursive: true, force: true });
  }
});

test('@E17-AC02 commerce decay caps are enforced independently of the integrated base', async () => {
  const original = manifest.find(a => a.id === 'bld.mainstreet-brick')! as AssetDef;
  const reports = await validateAssets([{ ...original, decayBudget: { triangles: 1, materials: 0, drawCalls: 0, fileKB: 1 } }]);
  expect(reports.filter(r => /^bld\.mainstreet-brick:/.test(r.id)).flatMap(r => r.errors)).toEqual([]);
  for (const decay of ['w2', 'w3']) {
    const report = reports.find(r => r.id === `bld.mainstreet-brick.${decay}:lod0`)!;
    expect(report.errors.join(';')).toContain('triangles:');
    expect(report.errors.join(';')).toContain('static drawCalls:');
    expect(report.errors.join(';')).toContain('materials:');
  }
  expect(original.budget.triangles).toBe(100000);
});
