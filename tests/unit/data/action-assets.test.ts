import { expect, test } from 'vitest';
import { readFileSync } from 'node:fs';
import manifest from '../../../src/assets/manifest.json';
import { catalog } from '../../../src/data/actions/catalog';
import { actionPlaceholder } from '../../../src/assets/placeholders';
import { createSurvivorPlaceholder } from '../../../src/render/characters/placeholder';
import { resolveRig, disposeCharacter } from '../../../src/render/characters/rig';
import { Vector3 } from 'three';

test('T-E06-08 @E06 @E06-AC08 every action maps to real icon and socket-compatible view manifest entries', () => {
  expect(new Set(manifest.map((e) => e.id)).size).toBe(manifest.length);
  for (const def of Object.values(catalog)) {
    const view = manifest.find((e) => e.id === def.viewAssetId)!, icon = manifest.find((e) => e.id === def.iconId)!;
    expect(view, def.id).toBeDefined(); expect(icon, def.id).toBeDefined(); expect(readFileSync(icon.icon!, 'utf8')).toContain('<svg');
    if (view.sourceGlb) {
      const glb = readFileSync(view.sourceGlb!), json = JSON.parse(glb.subarray(20, 20 + glb.readUInt32LE(12)).toString());
      const names = json.nodes.map((node: { name: string }) => node.name);
      for (const socket of view.requiredNodes) expect(names, def.id).toContain(socket);
    } else { const model = actionPlaceholder(view.actionCategory!); for (const socket of view.requiredNodes) expect(model.getObjectByName(socket)).toBeDefined(); disposeCharacter(model); }
  }
});

test('T-E06-08b @E06 @E06-AC08 fallback character sockets remain within 5cm of each hand', () => {
  for (const variant of ['female', 'male'] as const) {
    const model = createSurvivorPlaceholder(variant), rig = resolveRig(model); model.updateMatrixWorld(true);
    for (const side of ['L', 'R'] as const) expect(rig[`weaponSocket${side}`].getWorldPosition(new Vector3()).distanceTo(rig[`hand${side}`].getWorldPosition(new Vector3()))).toBeLessThanOrEqual(0.05);
    disposeCharacter(model);
  }
});
