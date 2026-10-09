import { test, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { getBounds } from '@gltf-transform/functions';
import type { AssetDef } from '../../../src/assets/types';
import { assetIO } from '../../../tools/assets/io';
import { validateAssets } from '../../../tools/assets/validate';

const definitions = JSON.parse(readFileSync('src/assets/manifest.json', 'utf8')) as AssetDef[];
const ids = ['npc.civilian-man-a.aftermath', 'npc.civilian-man-b.aftermath', 'npc.civilian-woman-b.aftermath', 'npc.marcus.aftermath', 'npc.shelter-survivor.bandaged', 'npc.shelter-survivor.lying', 'npc.shelter-survivor.sitting'];
const adults = definitions.filter(a => ids.includes(a.id));

test('living adult shipped tiers obey the base draw ceiling and batch attachments', async () => {
  const reports = await validateAssets(adults);
  expect(reports).toHaveLength(21);
  expect(reports.flatMap(r => r.errors)).toEqual([]);
  // A permissive manifest draw budget must not bypass the independently read base.
  const def = adults.find(a => a.id === 'npc.civilian-woman-b.aftermath')!;
  const invalid = await validateAssets([{ ...def, animatedDrawBase: 'npc.civilian-woman-a', budget: { ...def.budget, drawCalls: 10000 } }]);
  expect(invalid.some(r => r.errors.some(e => e.startsWith('animated-owner draws:')))).toBe(true);
}, 60000);

test('injured rest poses can restore their shipped standing joint frames at every tier', async () => {
  const io = await assetIO();
  for (const def of adults.filter(a => /\.(sitting|lying|bandaged)$/.test(a.id))) {
    const base = await io.read(definitions.find(a => a.id === def.animatedDrawBase)!.glb);
    for (const path of [def.glb, def.lods!.lod1!, def.lods!.lod2!]) {
      const doc = await io.read(path);
      const root = doc.getRoot().listNodes().find(n => n.getName() === 'root')!;
      const reset = JSON.parse(root.getExtras().ss_standingPose as string) as Record<string, { translation: [number,number,number]; rotation: [number,number,number,number]; scale: [number,number,number] }>;
      for (const [name, pose] of Object.entries(reset)) {
        const node = doc.getRoot().listNodes().find(n => n.getName() === name)!;
        node.setTranslation(pose.translation).setRotation(pose.rotation).setScale(pose.scale);
      }
      const cushion = doc.getRoot().listNodes().find(n => n.getName() === 'restCushion');
      if (cushion) { expect(cushion.listChildren().some(n => n.getMesh())).toBe(true); cushion.dispose(); }
      for (const name of def.animatedNodes.filter(n => n !== 'restCushion')) {
        const restored = doc.getRoot().listNodes().find(n => n.getName() === name)!;
        const original = base.getRoot().listNodes().find(n => n.getName() === name)!;
        restored.getWorldTranslation().forEach((v,i) => expect(v, `${def.id} ${name}`).toBeCloseTo(original.getWorldTranslation()[i], 4));
      }
      const bounds = getBounds(doc.getRoot().listScenes()[0]);
      expect(bounds.max[1]-bounds.min[1]).toBeGreaterThan(1.7);
      expect(bounds.max[1]-bounds.min[1]).toBeLessThan(1.9);
      expect(doc.getRoot().listNodes().find(n => n.getName() === 'weaponSocketR')!.getMesh()).toBeNull();
    }
  }
}, 60000);
