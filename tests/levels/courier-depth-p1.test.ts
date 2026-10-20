import { readFileSync } from 'node:fs';
import { Mesh, Raycaster, Vector3, type Object3D } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { expect, test } from 'vitest';
import manifest from '../../src/assets/manifest.json';
import type { AssetDef } from '../../src/assets/types';
import { compositions } from '../../src/levels/compositions';
import { resolveCampaignMission } from '../../src/levels/missions';
import { courierForegroundWanted } from '../../src/render/courierForeground';
import { applyCampaign } from '../../src/sim/progression/apply';
import { preset } from '../../src/sim/progression/Campaign';
import { SimWorld } from '../../src/sim/world/SimWorld';
import { loadLevel } from '../../tools/sim-runner/levels';

/**
 * PO #9 "L2 start: overlapp" and #26 (L1 shutter: the courier "stands inside the closed shutter ~0.55 m above the sidewalk,
 * glued to the door, with infected and the firefighter below her"). Visual QA 13c: "the courier is drawn on top of firefighter 2"
 * and "at the game camera he is drawn on the zombie side of the leaf". Cause: a building blocker switched the courier into the
 * near-camera depth slice, so she drew over every nearer person and the closed leaf. These guards keep the placements honest
 * (bodies apart at the L2 start, inside the leaf on the visible floor in L1) and the slice off for buildings.
 */
const HEAVY = 300_000;

test('T-P1-FG the near-camera courier slice is only for the Mega boss and the L7 crowd, never for building blockers', () => {
  expect(courierForegroundWanted(false, Infinity)).toBe(false);
  expect(courierForegroundWanted(false, 20)).toBe(false);
  expect(courierForegroundWanted(false, 10)).toBe(true);
  expect(courierForegroundWanted(true, Infinity)).toBe(true);
});

test('T-P1-9 @l2start at the idle L2 start no firefighter or other NPC touches the idle courier', async () => {
  const world = new SimWorld(); await world.init();
  try {
    const c = compositions.L2;
    world.loadComposition(c, c.districts.map(d => JSON.parse(readFileSync(`public/assets/layouts/${d.id}.layout.json`, 'utf8'))), 1, null);
    applyCampaign(world, preset('L2-default'));
    const mission = world.loadMission(resolveCampaignMission('L2', world.districts!)); mission.begin();
    const p = world.entities.get(1)!;
    expect(mission.state.l2!.crewIds.length).toBe(6);
    let nearest = Infinity, nearestCrew = Infinity;
    // The whole calm phase the PO watched (ticks 66-1464), with the courier idle on her start.
    for (let tick = 0; tick < 1500; tick++) {
      world.update();
      for (const e of world.entities.iterate()) {
        if (e.id === 1 || e.hidden || e.health.current <= 0 || !(e.civilian || e.companion || e.infected)) continue;
        const d = Math.hypot(e.transform.x - p.transform.x, e.transform.z - p.transform.z);
        nearest = Math.min(nearest, d);
        if (mission.state.l2!.crewIds.includes(e.id)) nearestCrew = Math.min(nearestCrew, d);
      }
    }
    // Bodies stay apart; crew 2 stands 1.4 m in front of her toward the camera, so the picture must keep him in front
    // (the courier-foreground gate in tests/scenes/catalog/fix-p1-l2-start-courier-crew.json).
    expect(nearest, 'closest NPC body to the idle courier (m)').toBeGreaterThanOrEqual(1);
    expect(nearestCrew, 'closest firefighter to the idle courier (m)').toBeGreaterThanOrEqual(1.2);
  } finally { world.dispose(); }
}, HEAVY);

const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
async function stationLods(): Promise<Object3D[]> {
  const def = (manifest as AssetDef[]).find(a => a.id === 'bld.fire-station')!;
  const layout = JSON.parse(readFileSync('public/assets/layouts/D-GROVE.layout.json', 'utf8')) as { placements: { assetId: string; position: number[]; yaw: number; scale: number[] }[] };
  const placement = layout.placements.find(q => q.assetId === 'bld.fire-station')!;
  const files = [def.glb!, def.lods?.lod1, def.lods?.lod2].filter((f): f is string => !!f);
  return Promise.all(files.map(async file => {
    const bytes = readFileSync(file);
    const scene = (await loader.parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '')).scene;
    scene.position.set(placement.position[0], placement.position[1], placement.position[2]);
    scene.rotation.y = placement.yaw; scene.scale.set(placement.scale[0], placement.scale[1], placement.scale[2]);
    scene.updateMatrixWorld(true);
    return scene;
  }));
}
/** Top of the drawn bay floor straight below a point (first surface a downward ray from knee height meets). */
function drawnFloor(model: Object3D, x: number, z: number, from: number): number | null {
  const ray = new Raycaster(new Vector3(x, from, z), new Vector3(0, -1, 0));
  const meshes: Mesh[] = []; model.traverse(o => { if (o instanceof Mesh) meshes.push(o); });
  const hit = ray.intersectObjects(meshes, false)[0];
  return hit ? hit.point.y : null;
}

test('T-P1-26 L1 shutter: the courier ends inside the closed leaf, standing on the drawn bay floor of every station LOD', async () => {
  const lods = await stationLods();
  // The PO/visual-QA spot and the objective trigger centre.
  for (const at of [{ x: -76.16, z: 41.17 }, null]) {
    const w = await loadLevel('L1', 1);
    try {
      const m = w.missions!, door = m.def.anchors['fire-bay-door'], inside = m.def.anchors['fire-bay-trigger'], p = w.entities.get(1)!;
      const target = at ?? inside;
      expect(w.solids.relocate(p, { ...target, y: p.transform.y }, 'test.bay', 1, false)).toBe(true);
      m.setGate('fire-shutter', false);
      expect(m.state.gates['fire-shutter']).toBe(false);
      for (let i = 0; i < 60; i++) w.update();
      const dx = inside.x - door.x, dz = inside.z - door.z, length = Math.hypot(dx, dz);
      // GameView.updateEnding: a 0.12 m leaf centred on the door anchor, facing the door -> trigger axis.
      const depth = ((p.transform.x - door.x) * dx + (p.transform.z - door.z) * dz) / length;
      expect(depth, 'courier centre behind the leaf plane, on the bay side (m)').toBeGreaterThanOrEqual(.06 + .3);
      const feet = p.transform.y - .7;
      expect(Math.abs(feet - w.districts!.supportBelow(p.transform.x, p.transform.z, feet)), 'feet vs the sim bay floor (m)').toBeLessThanOrEqual(.03);
      for (const lod of lods) {
        const floor = drawnFloor(lod, p.transform.x, p.transform.z, feet + .5);
        expect(floor, 'a drawn floor below the courier').not.toBeNull();
        expect(Math.abs(feet - floor!), 'feet vs drawn bay floor (m)').toBeLessThanOrEqual(.03);
      }
    } finally { w.dispose(); }
  }
}, HEAVY);
