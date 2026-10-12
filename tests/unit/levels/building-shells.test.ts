import { readFileSync, readdirSync } from 'node:fs';
import { describe, expect, test } from 'vitest';
import type { Node } from '@gltf-transform/core';
import { assetIO } from '../../../tools/assets/io';
import { compositions } from '../../../src/levels/compositions';
import { levelTwoLayouts } from '../../../src/levels/L2/layout';
import { levelThreeLayouts } from '../../../src/levels/L3/layout';
import { levelFourLayouts } from '../../../src/levels/L4/layout';
import { levelFiveLayouts } from '../../../src/levels/L5/layout';
import type { DistrictLayout } from '../../../src/levels/districts/types';

/**
 * PO 10-12: "building without walls" (the L3 flu-shot clinic showed roof, back wall and interior, but no street-facing walls).
 * bld.pharmacy / bld.supermarket / bld.gym are open cutaway interiors (int.*) with a lifted roof. Every placed interior asset
 * must either be an intentionally open cutaway (underground rooms the camera looks into) or ship a closed exterior shell: the
 * roofed kits carry it inside their cutaway `roof` group (tools/blender/sslib/roofed_shell.py), which reaches down to the floor,
 * so it stays on while the courier is outside and lifts together with the roof when she steps in.
 */
const manifest = new Map((JSON.parse(readFileSync('src/assets/manifest.json', 'utf8')) as { id: string; glb?: string; script?: string; dimensions: { x: number; z: number } }[]).map(a => [a.id, a]));
/** Underground rooms and the subway: shown as open diorama cutaways on purpose (no street front exists). */
const CUTAWAY = new Set(['int.basement-cellar', 'int.metro-station', 'int.metro-exit']);
const read = (id: string) => JSON.parse(readFileSync(`public/assets/layouts/${id}.layout.json`, 'utf8')) as DistrictLayout;
const levelLayouts = (level: string): DistrictLayout[] => {
  const base = compositions[level].districts.map(d => read(d.id));
  return level === 'L2' ? levelTwoLayouts(base) : level === 'L3' ? levelThreeLayouts(base) : level === 'L4' ? levelFourLayouts(base) : level === 'L5' ? levelFiveLayouts(base) : base;
};
const placed = (): Map<string, Set<string>> => {
  const out = new Map<string, Set<string>>();
  const add = (layout: DistrictLayout, label: string) => { for (const p of layout.placements) { if (!out.has(p.assetId)) out.set(p.assetId, new Set()); out.get(p.assetId)!.add(label); } };
  for (const file of readdirSync('public/assets/layouts').filter(f => f.endsWith('.layout.json'))) add(read(file.replace('.layout.json', '')), file.split('.')[0]);
  for (const level of ['L1', 'L2', 'L3', 'L4', 'L5']) for (const layout of levelLayouts(level)) add(layout, `${level}/${layout.district}`);
  return out;
};

/** Lowest point of the cutaway `roof` group's geometry (metres, delivered Y-up GLB). */
async function roofReach(path: string): Promise<{ lowest: number; walls: number }> {
  const doc = await (await assetIO()).read(path);
  const roof = doc.getRoot().listNodes().find(n => n.getName() === 'roof');
  if (!roof) throw new Error(`${path}: no roof node`);
  let lowest = Infinity, tall = 0;
  const visit = (node: Node): void => {
    for (const child of node.listChildren()) visit(child);
    const mesh = node.getMesh(); if (!mesh) return;
    const m = node.getWorldMatrix();
    for (const primitive of mesh.listPrimitives()) {
      const position = primitive.getAttribute('POSITION')!, min = position.getMin([]), max = position.getMax([]);
      const ys = [min[1], max[1]].flatMap(y => [min[0], max[0]].flatMap(x => [min[2], max[2]].map(z => m[1] * x + m[5] * y + m[9] * z + m[13])));
      lowest = Math.min(lowest, ...ys);
      if (Math.min(...ys) < 1 && Math.max(...ys) > 2) tall++;
    }
  };
  visit(roof);
  return { lowest, walls: tall };
}

describe('every interior asset in every level is closed from outside', () => {
  const used = placed();
  test('int.* placements are intentional cutaways', () => {
    const open = [...used.keys()].filter(id => id.startsWith('int.') && !CUTAWAY.has(id));
    expect(open, `placed without an exterior shell: ${open.join(', ')}`).toEqual([]);
  });
  // The kits that wrap an int.* interior (assets/<id>/build.py uses roofed_shell): their delivered GLB must carry the wall.
  const kits = [...manifest.values()].filter(a => a.script && /roofed_shell/.test(readFileSync(a.script, 'utf8')) && a.id.startsWith('bld.'));
  test('there are roofed kits and they are in use', () => { expect(kits.map(k => k.id).sort()).toEqual(['bld.gym', 'bld.pharmacy', 'bld.supermarket']); });
  for (const kit of kits) {
    test(`${kit.id} (placed in ${[...(used.get(kit.id) ?? [])].join(', ')}) ships exterior walls inside its cutaway roof group`, async () => {
      for (const path of [kit.glb!, kit.glb!.replace(/\.glb$/, '.lod1.glb'), kit.glb!.replace(/\.glb$/, '.lod2.glb')]) {
        const { lowest, walls } = await roofReach(path);
        expect(lowest, `${path}: the roof group must reach the floor (walls on the open sides)`).toBeLessThan(.5);
        expect(walls, `${path}: wall/pane meshes spanning floor to eaves`).toBeGreaterThanOrEqual(1);
      }
    });
  }
});
