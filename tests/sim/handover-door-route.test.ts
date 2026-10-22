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

/**
 * PO 2026-10-22 (verbatim): "The person came out of the shop and disappear in the moment it handedover the package.
 * Previously the person was walking back and closing the door." A courier standing at the shopfront (closer than the
 * apron edge) kept the clerk's scripted walk in contact admission, i.e. hidden, from the hand-over until half way back.
 */
test.each([[.9, 0], [1.2, 0], [1.2, .5], [1.2, -.5], [1.6, 0], [2.2, 0]] as const)('@E19 depot clerk stays visible through the hand-over and walks back in (courier %s m out, %s m lateral)', async (out, lateral) => {
  const { world, mission } = await loadL1(1);
  try {
    const counter = mission.def.anchors['parcel-counter'], way = findDoorway(world, 'bld.courier-depot', counter)!, p = world.entities.get(1)!;
    Object.assign(p.transform, { x: way.door.x + way.out.x * out - way.out.z * lateral, z: way.door.z + way.out.z * out + way.out.x * lateral });
    world.physics.playerBody!.setTranslation(p.transform, true); world.update();
    world.setInput({ interact: true }); world.update(); world.clearInput();
    const l1 = mission.state.l1!, id = l1.clerkId!, stages: string[] = [];
    expect(l1.beat?.id).toBe('pickup');
    let firstSeen = -1, lastSeen = -1, gapAtGive = 0, hiddenOutside = 0;
    const along = (q: P) => (q.x - way.door.x) * way.out.x + (q.z - way.door.z) * way.out.z;
    for (let i = 0; i < 1200 && l1.clerkId; i++) {
      const e = world.entities.get(id)!, clip = e.civilian?.story?.clip ?? '';
      if (clip && stages.at(-1) !== clip) stages.push(clip);
      if (clip === 'npc-give' && !gapAtGive) gapAtGive = Math.hypot(e.transform.x - p.transform.x, e.transform.z - p.transform.z);
      if (!e.hidden) { if (firstSeen < 0) firstSeen = i; lastSeen = i; }
      // Outside the facade (past the door frame) the clerk is always drawn.
      else if (firstSeen >= 0 && along(e.transform) > .3) hiddenOutside++;
      world.update();
    }
    expect(stages).toEqual(['npc-carry', 'npc-give', 'npc-wave', 'npc-walk']);
    expect(hiddenOutside).toBe(0);
    expect(gapAtGive).toBeGreaterThanOrEqual(.95);
    expect(lastSeen).toBeGreaterThan(firstSeen);
    // Back inside: hidden again, the contact exemption is gone and the courier holds the parcel.
    const clerk = world.entities.get(id)!;
    expect(clerk.hidden).toBe(true); expect(clerk.contactExempt).toBeUndefined(); expect(l1.carrying).toBe(true);
    expect(along(clerk.transform)).toBeLessThan(0);
  } finally { world.dispose(); }
}, 120_000);

/**
 * PO 2026-10-22 (verbatim): "Also the animation for the package handover at the labor was much better previsously."
 * The annex door seal (dressing:annex-door-seal, 0.8 m deep in front of the door) kept the technician in contact
 * admission: hidden until 1.2 m outside the open door, popping in 0.2 m before the meeting point and out again right
 * after taking the box. On the authored door lane he is drawn walking out, signing and walking back in, without jumps.
 */
test.each([[66.36, -12.10], [66.4, -11.7]] as const)('@E19 lab technician walks visibly out of the annex door and back in (courier at %s, %s)', async (x, z) => {
  const { world, mission } = await loadL1(1);
  try {
    startPickup(world, mission, { x: 0, z: 1.9 });
    for (let i = 0; i < 1200 && mission.state.l1!.beat; i++) { world.setInput({ left: { down: true, held: false, up: false } }); world.update(); world.clearInput(); world.update(); }
    const p = world.entities.get(1)!;
    Object.assign(p.transform, { x, z }); world.physics.playerBody!.setTranslation(p.transform, true); world.update();
    world.setInput({ interact: true }); world.update(); world.clearInput();
    const l1 = mission.state.l1!, tech = world.entities.get(l1.techId)!, way = findDoorway(world, 'bld.clinic-annex', mission.def.anchors['lab-exit-front'])!;
    expect(l1.phase).toBe('handover');
    const along = (q: P) => (q.x - way.door.x) * way.out.x + (q.z - way.door.z) * way.out.z;
    const stages: string[] = []; let hiddenOutside = 0, jump = 0, visibleOut = 0, last: P | null = null;
    for (let i = 0; i < 1800 && !l1.delivered; i++) {
      const clip = tech.civilian?.story?.clip ?? '';
      if (clip && stages.at(-1) !== clip) stages.push(clip);
      if (along(tech.transform) > .05) { if (tech.hidden) hiddenOutside++; else visibleOut++; }
      if (last && !tech.hidden) jump = Math.max(jump, Math.hypot(tech.transform.x - last.x, tech.transform.z - last.z));
      last = tech.hidden ? null : { x: tech.transform.x, z: tech.transform.z };
      world.update();
    }
    expect(l1.delivered).toBe(true);
    expect(stages).toEqual(['npc-walk', 'npc-glance', 'npc-sign', 'npc-carry']);
    expect(hiddenOutside).toBe(0);
    // Walks the 1.4 m lane out and back at 1.6 m/s, plus the glance/sign pause: well over a second in view.
    expect(visibleOut).toBeGreaterThan(150);
    expect(jump).toBeLessThan(.1);
    expect(tech.doorLane).toBeUndefined();
  } finally { world.dispose(); }
}, 120_000);
