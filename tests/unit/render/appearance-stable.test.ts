import { expect, test, vi } from 'vitest';
import { BoxGeometry, BufferAttribute, BufferGeometry, Color, Group, InstancedBufferAttribute, InstancedMesh, Matrix4, Mesh, MeshLambertNodeMaterial, Vector3 } from 'three/webgpu';
import manifest from '../../../src/assets/manifest.json';
import { infectedDefinitions } from '../../../src/data/infected';
import { AssetRegistry } from '../../../src/assets/registry';
import { CrowdAccessories } from '../../../src/render/characters/CrowdAccessories';
import { resolveCrowdAppearance, writeCrowdAppearance } from '../../../src/render/characters/CrowdAppearance';
import { CrowdPosePalette } from '../../../src/render/characters/CrowdPosePalette';
import { StaticCorpses } from '../../../src/render/characters/StaticCorpses';
import type { EntitySnapshot } from '../../../src/sim/world/types';

const actor = (id: number, model: string, accessory?: string) => ({ id, archetype: 'infected.runner', infected: { model, state: 'idle' },
  appearance: { entityId: id, asset: model, tint: '#486e69', accessories: accessory ? [accessory] : [] }, health: { current: 100 } }) as unknown as EntitySnapshot;

// These are the same rigid pose/appearance submissions used by both human crowds and their hero batches.
test('every human crowd model keeps its complete identity through poses, tiers, LODs and restore @E07 @E08 @E32', () => {
  const models = manifest.filter(d => ['character', 'infected'].includes(d.category)).map(d => d.id);
  expect(models).toContain('npc.national-guard'); expect(models).toContain('inf.common-worker');
  const accessories = new CrowdAccessories();
  const legacy = actor(27, 'infected.runner'); delete legacy.appearance;
  expect(resolveCrowdAppearance(legacy).model).toBe('inf.common-worker');
  const scenarios = [...models.flatMap(model => ['infected.runner', 'infected.sprinter', 'npc.civilian'].map(archetype => ({ model, archetype }))),
    ...infectedDefinitions.map(def => ({ model: def.id, archetype: def.id }))];
  for (const { model, archetype } of scenarios) {
    const e = actor(27, model); e.archetype = archetype;
    if (archetype === 'npc.civilian') { delete e.infected; e.civilian = { model } as EntitySnapshot['civilian']; }
    const identity = resolveCrowdAppearance(e), expected = new InstancedBufferAttribute(new Float32Array(4), 4);
    writeCrowdAppearance(expected, 0, e.id, new Color(identity.tint), 1, identity.slot, identity.hidesHair);
    for (const tier of ['high', 'low']) for (const lod of ['lod0', 'lod1', 'lod2']) for (const state of ['walk', 'attack', 'knockdown', 'get-up', 'dead', 'corpse']) {
      const next = structuredClone(e); next.corpse = state === 'corpse'; next.health.current = state === 'dead' || next.corpse ? 0 : 100;
      if (next.infected) next.infected.state = (state === 'dead' || next.corpse ? 'dead' : state === 'attack' ? 'attack' : 'chase');
      const look = resolveCrowdAppearance(next), submitted = new InstancedBufferAttribute(new Float32Array(4), 4);
      expect(look, `${model}/${tier}/${lod}/${state}`).toEqual(identity);
      expect(accessories.drawnSlot(next, lod)).toBe(identity.accessory);
      writeCrowdAppearance(submitted, 0, next.id, new Color(look.tint), 17, accessories.slot(next), accessories.hidesHair(next, lod));
      expect(Array.from(submitted.array).slice(0, 3)).toEqual(Array.from(expected.array).slice(0, 3));
    }
  }
  accessories.dispose();
});

test('LOD2 and frozen bodies keep hood/cap/hat geometry, colour and head transform without stacking authored headwear @E07 @E18 @E32', async () => {
  const load = vi.spyOn(AssetRegistry.prototype, 'loadAsset').mockImplementation(async () => {
    const group = new Group(); group.add(new Mesh(new BoxGeometry(.2, .1, .2), new MeshLambertNodeMaterial({ color: 'white' }))); return group;
  });
  const accessories = new CrowdAccessories(), corpses = new StaticCorpses(), material = new MeshLambertNodeMaterial();
  const source = new BufferGeometry();
  source.setAttribute('position', new BufferAttribute(new Float32Array(Array(3).fill([0, 0, 0, .1, 0, 0, 0, .1, 0]).flat()), 3));
  source.setAttribute('normal', new BufferAttribute(new Float32Array(Array(9).fill([0, 1, 0]).flat()), 3));
  source.setAttribute('color', new BufferAttribute(new Float32Array(36).fill(.5), 4));
  source.setAttribute('_parts', new BufferAttribute(new Float32Array([[0, -2, 0, 0], [0, 0, 0, 4], [0, 1, 0, 0]].flatMap(parts => Array(3).fill(parts).flat())), 4));
  source.getAttribute('_parts').setW(4, 0); source.getAttribute('_parts').setY(4, 1);
  const clip = { parts: ['head'], frames: 1, duration: 1, matrices: new Matrix4().makeTranslation(0, 1.6, 0).toArray() };
  const poses = new CrowdPosePalette(clip, 10);
  try {
    await accessories.init(); accessories.begin();
    // Match the backend's vec4 padding after the first live accessory draw.
    for (const node of accessories.children as InstancedMesh[]) for (const name of ['color', 'normal']) {
      const original = node.geometry.getAttribute(name), padded = new BufferAttribute(new Float32Array(original.count * 4), 4);
      for (let v = 0; v < original.count; v++) padded.setXYZW(v, original.getX(v), original.getY(v), original.getZ(v), 1);
      node.geometry.setAttribute(name, padded);
    }
    for (const [i, id] of ['acc.hat-flat-cap', 'acc.hat-baseball-cap', 'acc.hat-beanie', 'acc.hair-afro'].entries()) {
      // Use actual shipped names; a missing fixture must fail.
      expect(accessories.ids).toContain(id);
      const e = actor(i + 10, 'npc.civilian-man-b', id), look = resolveCrowdAppearance(e);
      accessories.place(e, 'lod2', poses, 0, [0, 1], new Matrix4());
      expect(accessories.drawnSlot(e, 'lod2')).toBe(id);
      const combined = accessories.corpseSource(e, source, look.model, 0);
      expect(accessories.corpseSource(e, source, look.model, 0)).toBe(combined);
      e.corpse = true;
      corpses.place(e, 'human', combined, material, clip, 0, new Matrix4(), new Color(look.tint), [0, 0, 0], String(e.id), [], look);
      const page = corpses.children[i] as InstancedMesh, parts = page.geometry.getAttribute('_parts');
      expect(Array.from({ length: parts.count }, (_, v) => parts.getY(v))).not.toContain(-2);
      expect(Array.from({ length: parts.count }, (_, v) => parts.getW(v))).not.toContain(4);
      expect(Array.from({ length: parts.count }, (_, v) => parts.getY(v))).toContain(id.startsWith('acc.hair-') ? -5 : -4);
      expect((page.geometry.index?.count ?? parts.count) % 3).toBe(0);
      expect(page.geometry.index?.count).toBe(39);
      const liveHead = accessories.children.find(node => node.name === `${id}:lod1`) as InstancedMesh;
      const headTransform = new Matrix4(); liveHead.getMatrixAt(0, headTransform);
      const local = new Vector3().fromBufferAttribute(liveHead.geometry.getAttribute('position'), liveHead.geometry.index?.getX(0) ?? 0).applyMatrix4(headTransform);
      const accessoryVertex = Array.from({ length: parts.count }, (_, v) => v).find(v => parts.getY(v) < -3)!;
      const frozen = new Vector3().fromBufferAttribute(page.geometry.getAttribute('position'), accessoryVertex);
      expect(frozen.distanceTo(local)).toBeLessThan(1e-6);
      const packed = page.geometry.getAttribute('_variant'), live = new InstancedBufferAttribute(new Float32Array(4), 4);
      writeCrowdAppearance(live, 0, e.id, new Color(look.tint), 1, look.slot, look.hidesHair);
      expect([packed.getX(0), packed.getY(0), packed.getZ(0)]).toEqual(Array.from(live.array).slice(0, 3));
      expect(corpses.snapshot().figures[i].appearance?.accessory).toBe(id);
    }
    accessories.finish();
    expect(accessories.snapshot().filter(b => b.instances).every(b => b.triangles <= 80)).toBe(true);
    expect(corpses.snapshot()).toMatchObject({ instances: 4, draws: 4 });
  } finally { poses.texture.dispose(); corpses.dispose(); source.dispose(); material.dispose(); accessories.dispose(); load.mockRestore(); }
});
