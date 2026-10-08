import { expect, test } from 'vitest';
import { buildingDoors } from '../../src/data/buildingDoors';
import { findDoorway, routeRadius } from '../../src/sim/missions/doorRoute';
import type { Mission } from '../../src/sim/missions/Mission';
import type { SimWorld } from '../../src/sim/world/SimWorld';
import { loadL1 } from '../../tools/sim-runner/l1Bots';

type P = { x: number; z: number };
/**
 * PO 2026-10-08 "Handover of package. The woman walks through the walls instead of door." / "door stays closed while the
 * person goes out and in": every L1 hand-over actor (depot clerk at the pickup, lab technician at the delivery) leaves
 * and re-enters through the building's door aperture and walks on walkable navigation in between.
 */
function check(world: SimWorld, assetId: string, track: P[]): void {
  const nav = world.infected!.nav, way = findDoorway(world, assetId, track[0])!, half = buildingDoors[assetId].width / 2;
  expect(way).not.toBeNull();
  // Signed distance in front of the door plane and lateral offset from the aperture centre.
  const along = (p: P) => (p.x - way.door.x) * way.out.x + (p.z - way.door.z) * way.out.z;
  const lateral = (p: P) => (p.x - way.centre.x) * -way.out.z + (p.z - way.centre.z) * way.out.x;
  const facadeOut = track.findIndex(p => along(p) > .05 && nav.clear(p.x, p.z, routeRadius));
  expect(facadeOut).toBeGreaterThan(0);
  // It passes the door anchor going out and coming back.
  const atDoor = track.map((p, i) => [i, Math.hypot(p.x - way.door.x, p.z - way.door.z)] as const).filter(([, d]) => d < .1).map(([i]) => i);
  expect(atDoor.length).toBeGreaterThan(0);
  const meet = track.reduce((best, p, i) => along(p) > along(track[best]) ? i : best, 0);
  expect(atDoor.some(i => i < meet)).toBe(true); expect(atDoor.some(i => i > meet)).toBe(true);
  for (const p of track) {
    if (nav.clear(p.x, p.z, routeRadius - .02)) continue;
    // Off the walk grid only inside the building or on the apron in front of the door, always inside the aperture lane.
    expect(Math.abs(lateral(p)), `off-nav point ${p.x.toFixed(2)},${p.z.toFixed(2)} outside the door lane`).toBeLessThan(half - routeRadius + .05);
    expect(along(p)).toBeLessThan(3);
  }
}

function startPickup(world: SimWorld, mission: Mission, offset: P): void {
  const counter = mission.def.anchors['parcel-counter'], p = world.entities.get(1)!;
  Object.assign(p.transform, { x: counter.x + offset.x, z: counter.z + offset.z }); world.physics.playerBody!.setTranslation(p.transform, true); world.update();
  world.setInput({ interact: true }); world.update(); world.clearInput();
}

test.each([[0, 1.9], [-1.3, 1.2], [1.4, 1.2], [.5, 1.8]] as const)('@E19 depot clerk walks out of the door and back in (courier at counter %+.1f, %+.1f)', async (dx, dz) => {
  const { world, mission } = await loadL1(1);
  try {
    startPickup(world, mission, { x: dx, z: dz });
    expect(mission.state.l1!.beat?.id).toBe('pickup');
    const id = mission.state.l1!.clerkId!, track: P[] = [];
    for (let i = 0; i < 1200 && mission.state.l1!.clerkId; i++) { const e = world.entities.get(id)!; if (!e.hidden) track.push({ x: e.transform.x, z: e.transform.z }); world.update(); }
    expect(mission.state.l1!.carrying).toBe(true);
    check(world, 'bld.courier-depot', track);
  } finally { world.dispose(); }
}, 120_000);

test('@E19 lab technician comes out of the annex door, signs and goes back in through it', async () => {
  const { world, mission } = await loadL1(1);
  try {
    startPickup(world, mission, { x: 0, z: 1.9 });
    for (let i = 0; i < 1200 && mission.state.l1!.beat; i++) { world.setInput({ left: { down: true, held: false, up: false } }); world.update(); world.clearInput(); world.update(); }
    expect(mission.state.steps.deliver?.status).toBe('active');
    const door = mission.def.anchors['lab-door'], p = world.entities.get(1)!;
    Object.assign(p.transform, { x: door.x + .4, z: door.z + .6 }); world.physics.playerBody!.setTranslation(p.transform, true); world.update();
    world.setInput({ interact: true }); world.update(); world.clearInput();
    expect(mission.state.l1!.phase).toBe('handover');
    const tech = world.entities.get(mission.state.l1!.techId)!, track: P[] = [];
    for (let i = 0; i < 1800 && !mission.state.l1!.delivered; i++) { track.push({ x: tech.transform.x, z: tech.transform.z }); world.update(); }
    expect(mission.state.l1!.delivered).toBe(true);
    check(world, 'bld.clinic-annex', track);
  } finally { world.dispose(); }
}, 120_000);
