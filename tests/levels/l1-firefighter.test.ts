import { afterEach, expect, test } from 'vitest';
import { loadL1 } from '../../tools/sim-runner/l1Bots';
import type { SimWorld } from '../../src/sim/world/SimWorld';

/**
 * PO 2026-10-08 (verbatim): "L1 there was a firefighter standing here; bring him back. I also liked that Zombies can attack him."
 * The "Get in!" firefighter stands at the open bay as soon as the fire-station objective starts (not only within the 14 m bark
 * range), infected target and bite him like any human, and a colleague takes over if he is lost, so the ending never dead-ends.
 */
let world: SimWorld | undefined;
afterEach(() => { world?.dispose(); world = undefined; });

test('T-E19-firefighter @E19 the firefighter waits at the bay from the start of the objective, infected attack him, a colleague takes over', async () => {
  const { world: w, mission } = await loadL1(1); world = w;
  for (let guard = 0; guard < 8 && mission.state.steps.firestation.status !== 'active'; guard++) { mission.setState('exited', true); w.update(); mission.completeObjective(); w.update(); }
  expect(mission.state.steps.firestation.status).toBe('active');
  for (let i = 0; i < 240 && mission.state.l1!.beat; i++) w.update();
  const door = mission.def.anchors['fire-bay-door'], player = w.entities.get(1)!;
  // Courier far away (> 14 m bark range): he is there anyway, alive, visible, at the bay mouth.
  expect(Math.hypot(player.transform.x - door.x, player.transform.z - door.z)).toBeGreaterThan(20);
  for (let i = 0; i < 30; i++) w.update();
  const first = w.entities.get(mission.state.l1!.firefighterId ?? 0)!;
  expect(first, 'firefighter spawned').toBeDefined();
  expect(first.hidden).not.toBe(true); expect(first.infected).toBeFalsy(); expect(first.civilian?.ally?.role).toBe('firefighter');
  expect(Math.hypot(first.transform.x - door.x, first.transform.z - door.z)).toBeLessThan(2);
  // An infected outside the bay, facing him: it targets him (closest visible human), and he fights back.
  const nav = w.infected!.nav, out = { x: first.transform.x + (door.x - mission.def.anchors['fire-bay-trigger'].x) * 4, z: first.transform.z + (door.z - mission.def.anchors['fire-bay-trigger'].z) * 4 };
  const cell = nav.nearestCell(out.x, out.z), at = { x: nav.x(cell), z: nav.z(cell) };
  const zid = w.infected!.spawn('infected.runner', at, { state: 'idle', yaw: -Math.atan2(first.transform.z - at.z, first.transform.x - at.x) });
  let targeted = false, attacked = false;
  const stop = w.events.on('ally.attack', e => { if (e.type === 'ally.attack' && e.sourceId === first.id) attacked = true; });
  for (let i = 0; i < 6 * 60; i++) { w.update(); if (w.entities.get(zid)?.infected?.l1?.targetId === first.id) targeted = true; }
  stop();
  expect(targeted, 'the infected targets the firefighter').toBe(true);
  expect(attacked, 'the firefighter swings at it').toBe(true);
  // Lost (bitten and turned, by that infected or forced here): a colleague takes over within a few seconds, alive at the bay.
  if (first.civilian && !first.infection && !first.infected) w.npcs!.civilians.outbreak!.turnNow(first);
  for (let i = 0; i < 5 * 60; i++) w.update();
  const next = w.entities.get(mission.state.l1!.firefighterId ?? 0)!;
  expect(next.id).not.toBe(first.id);
  expect(next.infected).toBeFalsy(); expect(next.health.current).toBeGreaterThan(0); expect(next.hidden).not.toBe(true);
  expect(Math.hypot(next.transform.x - door.x, next.transform.z - door.z)).toBeLessThan(8);
}, 120_000);
