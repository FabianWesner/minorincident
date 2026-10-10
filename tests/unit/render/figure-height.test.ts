import { readFileSync } from 'node:fs';
import { Box3, Matrix4, Vector3 } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { expect, test } from 'vitest';
import manifest from '../../../src/assets/manifest.json';
import { civilianRoles } from '../../../src/data/npcs';
import { infectedDefinitions } from '../../../src/data/infected';
import { restoreStanding, crowdModelOf } from '../../../src/render/npc/CivilianCrowd';
import { civilianHeight, fitCivilianHeight } from '../../../src/render/npc/figureHeight';
import { bakeInfected } from '../../../src/render/characters/bakeInfected';
import { disposeCharacter } from '../../../src/render/characters/rig';
import type { AssetDef } from '../../../src/assets/types';
import type { EntitySnapshot } from '../../../src/sim/world/types';

const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
const skins = (manifest as AssetDef[]).filter(d => /^(npc|inf)\./.test(d.id) && ['integrated', 'final'].includes(d.status) && d.glb);

// Upright size, independently of crouch/death/flight poses. Check the actual merged vertices transformed by the
// baked rigid-part matrices, rather than trusting manifest dimensions or the instance-matrix scale alone.
for (const quality of ['high', 'low']) for (const lod of ['lod0', 'lod1', 'lod2'] as const) {
  test(`every civilian, ally and infected skin has its age/species height in ${quality} ${lod}`, async () => {
    for (const skin of skins) {
      const file = readFileSync(lod === 'lod0' ? skin.glb : skin.lods?.[lod] ?? skin.glb);
      const model = (await loader.parseAsync(file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength), '')).scene;
      const npc = skin.id.startsWith('npc.');
      if (npc) { restoreStanding(model); fitCivilianHeight(model, skin.id); }
      const target = npc ? civilianHeight(skin.id) : skin.dimensions.y;
      // Animal rigs, crawling rest poses and authored corpses have their own silhouette contract.
      const specialized = !npc && (model.getObjectByName('body') || /crawler|corpse/.test(skin.id));
      let height: number;
      if (specialized) { const box = new Box3().setFromObject(model); height = box.max.y - box.min.y; }
      else {
        const baked = bakeInfected(model, skin.animatedNodes, false, ['npc-look-around']);
        const p = baked.geometry.getAttribute('position'), parts = baked.geometry.getAttribute('_part_index');
        const point = new Vector3(), matrix = new Matrix4(); let min = Infinity, max = -Infinity;
        for (let i = 0; i < p.count; i++) {
          point.fromBufferAttribute(p, i).applyMatrix4(matrix.fromArray(baked.clip.matrices, parts.getX(i) * 16));
          min = Math.min(min, point.y); max = Math.max(max, point.y);
        }
        height = max - min; baked.geometry.dispose();
      }
      expect(height / target, `${skin.id}: ${height} m / ${target} m`).toBeGreaterThanOrEqual(.92);
      expect(height / target, `${skin.id}: ${height} m / ${target} m`).toBeLessThanOrEqual(1.08);
      if (npc) {
        const child = /^(npc.civilian-kid|npc.brother)$/.test(skin.id);
        const archetypes = child ? ['npc.child'] : [...civilianRoles.map(d => `npc.${d.role}`), 'npc.ally', ...infectedDefinitions.map(d => d.id)];
        for (const archetype of archetypes) {
          const e = { archetype, civilian: { adult: !child, model: skin.id }, appearance: { asset: skin.id } } as unknown as EntitySnapshot;
          expect(crowdModelOf(e)).toBe(child ? 'npc.civilian-kid' : skin.id);
        }
      }
      disposeCharacter(model);
    }
  }, 120_000);
}
