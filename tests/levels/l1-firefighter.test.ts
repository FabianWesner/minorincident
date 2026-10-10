import { afterEach, expect, test } from 'vitest';
import { loadL1 } from '../../tools/sim-runner/l1Bots';
import { storyProtected } from '../../src/sim/npc/storyProtection';
import type { SimWorld } from '../../src/sim/world/SimWorld';

/**
 * PO 2026-10-08 (verbatim): "L1 there was a firefighter standing here; bring him back. I also liked that Zombies can attack him."
 * The "Get in!" firefighter stands at the open bay as soon as the fire-station objective starts (not only within the 14 m bark
 * range), infected still target him, and he remains standing until the player enters, even at the infected cap.
 */
let world: SimWorld | undefined;
afterEach(() => { world?.dispose(); world = undefined; });

test('T-E19-firefighter @E19 the firefighter waits at the bay from the start of the objective, infected attack him, he survives a late arrival', async () => {
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
  // A completed bite at the infected cap used to finish him without reducing HP.
  w.events.emit({ type: 'outbreak.bite', tick: w.tick, sourceId: 1, targetId: first.id, position: first.transform, turns: false });
  expect(first.civilian?.state, 'cap bite must not leave the objective actor a corpse').not.toBe('finished');
  // An infected outside the bay, facing him: it targets him (closest visible human), and he fights back.
  const nav = w.infected!.nav, out = { x: first.transform.x + .3, z: first.transform.z + 2 };
  const cell = nav.nearestCell(out.x, out.z), at = { x: nav.x(cell), z: nav.z(cell) };
  const zid = w.infected!.spawn('infected.runner', at, { state: 'idle', yaw: -Math.atan2(first.transform.z - at.z, first.transform.x - at.x) });
  let targeted = false, attacked = false;
  const stop = w.events.on('ally.attack', e => { if (e.type === 'ally.attack' && e.sourceId === first.id) attacked = true; });
  for (let i = 0; i < 6 * 60; i++) { w.update(); if (w.entities.get(zid)?.infected?.l1?.targetId === first.id) targeted = true; }
  stop();
  expect(targeted, 'the infected targets the firefighter').toBe(true);
  expect(attacked, 'the firefighter swings at it').toBe(true);
  // Keep heavy pressure on the bay while the courier idles far away for a minute.
  for (let i = 0; i < 10; i++) w.infected!.spawn('infected.runner', at, { state: 'idle' });
  for (let i = 0; i < 60 * 60; i++) w.update();
  const next = w.entities.get(mission.state.l1!.firefighterId ?? 0)!;
  expect(next.id).toBe(first.id);
  expect(Math.hypot(next.transform.x - door.x, next.transform.z - door.z), 'invitation stays by the bay').toBeLessThan(3);
  expect(next.infected).toBeFalsy(); expect(next.infection).toBeFalsy();
  expect(next.health.current).toBeGreaterThan(0); expect(next.hidden).not.toBe(true);
  expect(['down', 'rising', 'finished', 'grabbed']).not.toContain(next.civilian?.state);
  // Late arrival still gets the bark and can enter the level exit interaction.
  Object.assign(player.transform, { x: door.x - 3, z: door.z + 3 });
  w.physics.playerBody!.setTranslation(player.transform, true); w.spatial.set(1, player.transform.x, player.transform.z);
  for (let i = 0; i < 5; i++) w.update();
  expect(mission.state.l1!.say?.id).toBe(first.id);
  expect(mission.state.l1!.say?.text).toBe('Get in!');
  expect(mission.state.steps.firestation.status).toBe('active');
  const checkpoint = mission.def.checkpoints[0];
  mission.checkpoint(checkpoint);
  const entry = mission.def.anchors['fire-bay-trigger'];
  Object.assign(player.transform, { x: entry.x, z: entry.z });
  w.physics.playerBody!.setTranslation(player.transform, true); w.spatial.set(1, entry.x, entry.z);
  for (let i = 0; i < 120; i++) w.update();
  expect(mission.state.steps.firestation.status).toBe('completed');
  expect(storyProtected(w, first)).toBe(false);
  mission.restore(checkpoint);
  const restored = w.entities.get(first.id)!;
  expect(storyProtected(w, restored)).toBe(true);
  w.events.emit({ type: 'outbreak.bite', tick: w.tick, sourceId: zid, targetId: restored.id, position: restored.transform, turns: false });
  expect(restored.civilian?.state).not.toBe('finished');
}, 120_000);

test('T-E19-firefighter-corpse @E19 a finished invitation actor with positive HP is replaced (legacy checkpoint recovery)', async () => {
  const { world: w, mission } = await loadL1(1); world = w;
  for (let guard = 0; guard < 8 && mission.state.steps.firestation.status !== 'active'; guard++) { mission.setState('exited', true); w.update(); mission.completeObjective(); w.update(); }
  for (let i = 0; i < 240; i++) w.update();
  const first = w.entities.get(mission.state.l1!.firefighterId!)!;
  expect(first.civilian).toBeDefined(); expect(first.health.current).toBeGreaterThan(0);
  // Exact original corpse signature: positive HP, no infection, finished, stale combat target.
  first.civilian!.state = 'finished'; first.civilian!.ally!.targetId = 1;
  for (let i = 0; i < 180; i++) w.update();
  const next = w.entities.get(mission.state.l1!.firefighterId!)!;
  expect(next.civilian!.state).not.toBe('finished');
  expect(next.id).not.toBe(first.id); expect(next.health.current).toBeGreaterThan(0); expect(storyProtected(w, next)).toBe(true);
}, 120_000);
