import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { expect, test, vi } from 'vitest';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { Matrix3, Matrix4, Vector3, type BufferGeometry, type InstancedMesh } from 'three/webgpu';
import manifest from '../../../src/assets/manifest.json';
import { AssetRegistry } from '../../../src/assets/registry';
import { infectedDefinitions } from '../../../src/data/infected';
import { CrowdView } from '../../../src/render/CrowdView';
import { registerCrowdModel } from '../../../src/render/crowdModels';
import { Vfx } from '../../../src/render/vfx/Vfx';
import { SimWorld } from '../../../src/sim/world/SimWorld';
import { megaAlpha } from '../../../src/data/megaAlpha';

async function model(path: string) {
  const bytes = readFileSync(path);
  return (await new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '')).scene;
}
function surfaceSignature(geometry: BufferGeometry): string {
  const hash = createHash('sha256');
  for (const attribute of ['position', 'normal', 'color', '_parts'].map(name => geometry.getAttribute(name)).concat(geometry.index ? [geometry.index] : [])) {
    const array = attribute.array; hash.update(new Uint8Array(array.buffer, array.byteOffset, array.byteLength));
  }
  return hash.digest('hex');
}

const kinds = ['infected.runner', 'infected.dog', 'infected.alpha', 'infected.firefighter'].map(archetype => ({ archetype, asset: infectedDefinitions.find(d => d.id === archetype)!.asset }));
kinds.push({ archetype: 'infected.alpha', asset: megaAlpha.asset });
for (const low of [true, false]) for (const { archetype, asset } of kinds) {
  test(`PO #98 @E07 @E32 real kills retain intact frozen ${asset} bodies (${low ? 'low' : 'high'})`, async () => {
    const w = new SimWorld(); await w.init(); w.loadScenario('horde-arena', 32);
    const base = infectedDefinitions.find(d => d.id === archetype)!, def = { ...base, ...(asset !== base.asset ? { id: asset, asset } : {}) }, crowd = new CrowdView(w, low);
    const load = vi.spyOn(AssetRegistry.prototype, 'loadAsset').mockImplementation(async (id, lod) => {
      const asset = manifest.find(a => a.id === id)!;
      return model(lod === 'lod0' ? asset.glb! : asset.lods![lod === 'lod2' ? 'lod2' : 'lod1']!);
    });
    const corpseLoad = vi.spyOn(AssetRegistry.prototype, 'loadCorpse').mockImplementation(async id => model(manifest.find(a => a.id === id)!.corpseGlb!));
    const fx = new Vfx(w, { flash: (id, strength) => crowd.flash(id, strength), detach: (id, limb) => crowd.detach(id, limb), blood() {}, clearGore: () => crowd.clearGore(), shake() {} });
    type Internals = { definitions: Map<string, typeof def>; modelAliases: Map<string, string>; corpseGeometry: Map<string, BufferGeometry>; batches: Map<string, { mesh: { geometry: BufferGeometry } }>; loadBatch(d: typeof def, lod: 'lod2'): Promise<void> };
    const internal = crowd as unknown as Internals, key = registerCrowdModel(internal.modelAliases, def);
    internal.definitions.set(key, def);
    try {
      await internal.loadBatch(def, 'lod2');
      const livingGeometry = internal.batches.get(`${key}:lod2`)!.mesh.geometry, livingBefore = surfaceSignature(livingGeometry);
      if (archetype === 'infected.firefighter') expect(internal.corpseGeometry.get(key)!.userData.corpseSource).toBe(manifest.find(a => a.id === def.asset)!.glb);
      const ids: number[] = [];
      const mega = asset === megaAlpha.asset;
      const causes = mega ? ['blast', 'cure'] : ['blast', ...(archetype === 'infected.firefighter' ? [] : ['fire']), 'melee', 'gun', 'cure'];
      for (const [index, cause] of causes.entries()) {
        // Spawn a living actor, deliver real Damage events and let the ordinary
        // death timer settle it. No corpse flag, HP or deadAt fixture writes.
        const id = w.infected!.spawn(archetype, { x: 2 + index, z: 2 }, { variant: def.asset }); ids.push(id);
        if (mega) {
          const e = w.entities.get(id)!; e.infected!.pursuit = true;
          e.health.current = e.health.max = megaAlpha.hp;
        }
        w.scenario = 'L10';
        const hit = { attackId: index + 1, sourceId: 1, targetId: id, origin: { x: 0, z: 0 }, direction: { x: 1, z: 0 }, base: 100_000, multiplier: 1, knockback: 0, stagger: 0 };
        if (cause === 'cure') w.combat!.damage.cure(w.entities.get(id)!);
        else if (mega) {
          // Exercise the actual boss floor and direct-rocket accounting, rather
          // than killing an ordinary Alpha that only wears the Mega model.
          w.combat!.damage.apply({ ...hit, actionId: 'weapon.shotgun', type: 'bullet' });
          expect(w.entities.get(id)!.health.current).toBe(megaAlpha.hp * megaAlpha.conventionalFloor);
          for (let rocket = 0; w.entities.get(id)!.health.current > 0 && rocket < 10; rocket++)
            w.combat!.damage.apply({ ...hit, attackId: 1000 + rocket, actionId: 'weapon.rocket-launcher', type: 'explosive', direct: true });
        } else if (cause === 'melee') {
          w.combat!.damage.apply({ ...hit, actionId: 'weapon.fire-axe', type: 'melee' });
          expect(w.entities.get(id)!.infected!.recoverAt).toBeGreaterThanOrEqual(0);
          // Ordinary melee remains a recoverable downing. A permanent hit
          // finishes it; firefighters require a blast rather than a burn.
          w.combat!.damage.apply({ ...hit, actionId: archetype === 'infected.firefighter' ? 'weapon.rocket-launcher' : 'burn', type: archetype === 'infected.firefighter' ? 'explosive' : 'status', permanent: true });
        } else if (cause === 'gun') {
          w.combat!.damage.apply({ ...hit, actionId: 'weapon.shotgun', type: 'bullet' });
          // Alphas/dogs retain the shotgun recovery rule; a blast finishes them.
          if (w.entities.get(id)!.infected!.recoverAt >= 0) w.combat!.damage.apply({ ...hit, actionId: 'weapon.rocket-launcher', type: 'explosive' });
        } else w.combat!.damage.apply({ ...hit, actionId: cause === 'fire' ? 'burn' : 'weapon.rocket-launcher', type: cause === 'fire' ? 'status' : 'explosive', permanent: true });
        w.scenario = 'horde-arena'; // Independent victims; L10 spawn caps need its real district.
      }
      expect(crowd.getGoreState().some(f => f.detached.length === 5), 'the guard must exercise explosive dismemberment').toBe(true);
      for (let tick = 0; tick < 125; tick++) w.update();
      crowd.update(); await crowd.ready();
      for (const id of ids) expect(w.entities.get(id)?.corpse).toBe(true);
      const pages: InstancedMesh[] = [];
      crowd.traverse(o => { if (o.name.startsWith('corpses:') && (o as InstancedMesh).count) pages.push(o as InstancedMesh); });
      expect(pages.reduce((n, p) => n + p.count, 0)).toBe(ids.length);
      for (const page of pages) {
        expect(page.name).toMatch(asset === megaAlpha.asset ? /:death-side:0(?:[:/]|$)/ : /:death-back:0(?:[:/]|$)/);
        // The corpse shader can reuse placement columns for normals only while
        // every production frozen placement is a rotation plus translation.
        for (let index = 0; index < page.count; index++) {
          const placed = new Matrix4(); page.getMatrixAt(index, placed);
          expect(new Matrix3().setFromMatrix4(placed).determinant()).toBeCloseTo(1, 5);
          for (const normal of [new Vector3(1, 0, 0), new Vector3(0, 1, 0), new Vector3(0, 0, 1)]) {
            const inverse = normal.clone().applyMatrix3(new Matrix3().getNormalMatrix(placed)).normalize();
            expect(normal.transformDirection(placed).distanceTo(inverse)).toBeLessThan(1e-6);
          }
        }
        const positions = page.geometry.getAttribute('position');
        // A full reclining body spans well beyond the torso-only blast remnant.
        let min = Infinity, max = -Infinity;
        for (let i = 0; i < positions.count; i++) { min = Math.min(min, positions.getX(i)); max = Math.max(max, positions.getX(i)); }
        expect(max - min).toBeGreaterThan(archetype === 'infected.dog' ? .6 : 1);
      }
      const original = ids.map(id => w.entities.get(id));
      w.tick += 60 * 60 * 60 * 2; w.update(); crowd.update();
      expect(ids.map(id => w.entities.get(id))).toEqual(original);
      expect(surfaceSignature(livingGeometry), 'freezing corpses must leave the living surface unchanged').toBe(livingBefore);
    } finally { fx.dispose(); crowd.dispose(); w.dispose(); load.mockRestore(); corpseLoad.mockRestore(); }
  });
}
