import { Group, Mesh, BoxGeometry, MeshLambertNodeMaterial } from 'three/webgpu';
import { expect, test } from 'vitest';
import { ApcDamage } from '../../../src/render/apcDamage';
import { apcEngineStages } from '../../../src/audio/apcEngine';

// Stage selection and save restoration are tested through Vehicles in tests/sim/vehicles/apc-floor.test.ts.
test('T-E31-22-art @E31-AC22 cumulative overlays restore directly and lamps stay local to their APC', () => {
  const model = new Group(), front = new Group(); front.name = 'lightsFront'; model.add(front);
  const shared = new MeshLambertNodeMaterial({ color: '#ffffaa' }); shared.userData.emissiveStrength = 2;
  const lamp: Mesh = new Mesh(new BoxGeometry(), shared); front.add(lamp);
  const damage = new ApcDamage(model);
  expect(Array.isArray(lamp.material)).toBe(false); // Ungrouped GLTF lamp meshes must keep their single-material draw.
  expect((lamp.material as MeshLambertNodeMaterial).color.r).toBeGreaterThan(shared.color.r);
  for (const stage of [0,1,2,3,4,0,4]) {
    damage.update(stage, 30);
    expect(damage.snapshot()).toMatchObject({ stage, dents: stage >= 1, glass: stage >= 2, lightsOn: stage < 3, smoke: stage === 4 ? 'heavy' : stage === 3 ? 'light' : 'none' });
  }
  damage.update(3, 0); expect(damage.lightsOn).toBe(true);
  damage.update(4, 0); expect(damage.lightsOn).toBe(false);
  expect(shared.color.getHex()).toBe(0xffffaa);
  expect(damage.snapshot().overlayTriangles).toBe(48);
  expect(damage.glass.material).toBe(damage.dents.material);
  damage.dispose(); expect(damage.parent).toBeNull(); lamp.geometry.dispose(); shared.dispose();
});

test('T-E31-22-engine @E31-AC16 @E31-AC22 four E16 engine variants become slower, duller and rougher', () => {
  for (let stage = 1; stage <= 4; stage++) {
    expect(apcEngineStages[stage].rate).toBeLessThan(apcEngineStages[stage-1].rate);
    expect(apcEngineStages[stage].lowpass).toBeLessThan(apcEngineStages[stage-1].lowpass);
    expect(apcEngineStages[stage].roughness).toBeGreaterThan(apcEngineStages[stage-1].roughness);
  }
});

test('T-E31-22-budget @E31-AC22 @E31-AC19 every derived APC LOD includes cab and overlays within inventory budgets', async () => {
  const { readFileSync } = await import('node:fs');
  const { GLTFLoader } = await import('three/addons/loaders/GLTFLoader.js');
  const { MeshoptDecoder } = await import('meshoptimizer');
  const { openTransportCab, prepareTransportModel, disposeTransportCab } = await import('../../../src/render/transportModel');
  const { vehicleDef } = await import('../../../src/data/vehicles');
  const def = vehicleDef('vehicle.military-apc');
  for (const [suffix, cap] of [['',12000],['.lod1',5000],['.lod2',2000]] as const) {
    const bytes = readFileSync(`public/assets/models/veh.military-apc.unarmed${suffix}.glb`);
    const model = (await new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'')).scene;
    prepareTransportModel(model,def); openTransportCab(model,def);
    const damage = new ApcDamage(model); damage.update(4,30);
    let triangles = 0, draws = 0; const materials = new Set<import('three').Material>();
    model.traverse(node => { if (!(node instanceof Mesh)) return; const g = node.geometry; triangles += (g.index?.count ?? g.getAttribute('position').count) / 3; draws += Array.isArray(node.material) ? node.material.length : 1; for (const m of Array.isArray(node.material) ? node.material : [node.material]) materials.add(m); });
    expect(triangles, suffix).toBeLessThanOrEqual(cap); expect(draws,suffix).toBeLessThanOrEqual(12); expect(materials.size,suffix).toBeLessThanOrEqual(4);
    damage.dispose(); disposeTransportCab(model);
  }
});

test('T-E31-22-smoke @E31-AC22 @E31-AC19 moving floor APCs reuse the bounded E27 pool without fire', async () => {
  const { SimWorld } = await import('../../../src/sim/world/SimWorld');
  const { Blasts } = await import('../../../src/render/vfx/Blasts');
  const { FxPool } = await import('../../../src/render/vfx/FxPool');
  for (const quality of ['high','low'] as const) {
    const w = new SimWorld(); await w.init(); w.loadScenario('horde-arena');
    const particles = new FxPool(quality==='high'?2048:512,'particle'), blasts = new Blasts(w,{particles,shake(){}}); blasts.set({quality});
    try {
      const id=w.vehicles!.spawn('vehicle.military-apc',{x:0,z:0}); w.vehicles!.setFloorPolicy(id); w.vehicles!.damage(id,750);
      for (let i=1;i<=600;i++) blasts.advance(i/60,1/60);
      const light=blasts.snapshot(); expect(light.vehicleSmokeColumns).toBe(1); expect(light.puffs).toBeGreaterThan(0);
      w.vehicles!.damage(id,250); w.entities.get(id)!.transform.x=20;
      for (let i=601;i<=1200;i++) blasts.advance(i/60,1/60);
      const heavy=blasts.snapshot(); expect(heavy.puffs).toBeGreaterThan(light.puffs); expect(heavy.puffs).toBeLessThanOrEqual(quality==='high'?400:120);
      expect(heavy).toMatchObject({fireColumns:0,flames:0,glows:0,fireballs:0});
      blasts.reset(); expect(blasts.snapshot()).toMatchObject({vehicleSmokeColumns:0,puffs:0});
    } finally { blasts.dispose(); particles.dispose(); w.dispose(); }
  }
});
