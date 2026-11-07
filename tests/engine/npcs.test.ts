// NPC core: civilians (panic, grab, turning), escorts and the corgi use one NPC system in every level.
import { afterEach, expect, test, vi } from 'vitest';
import { Box3, BoxGeometry, Group, Mesh, MeshBasicMaterial, Vector3 } from 'three';
import { npcs } from '../../src/data/npcs';
import { loadLevel } from '../qa/invariants/world';
import { loadLevel as loadRunnerLevel } from '../../tools/sim-runner/levels';
import { emptyInput } from '../../src/input/InputFrame';
import { preset } from '../../src/sim/progression/Campaign';
import { missionControls } from '../../src/sim/missions/controls';
import { adultMaleStandingHeight, civilianHeight, fitCivilianHeight, heroineStandingHeight } from '../../src/render/npc/figureHeight';
import { SimWorld } from '../../src/sim/world/SimWorld';
import { followerInCombat, updateSurvivor } from '../../src/sim/outbreak/Survivors';

const worlds: SimWorld[] = [];
afterEach(() => { for (const w of worlds.splice(0)) w.dispose(); });
async function world(name = 'horde-arena', seed = 1) { const w = new SimWorld(); worlds.push(w); await w.init(); w.loadScenario(name, seed); w.combat!.damage.god = true; return w; }
const step = (w: SimWorld, n: number) => { for (let i = 0; i < n; i++) w.update(); };
function teleport(w: SimWorld, x: number, z: number) { const p = w.entities.get(1)!; p.transform.x = x; p.transform.z = z; w.physics.playerBody!.setTranslation(p.transform, true); w.physics.playerBody!.setLinvel({ x: 0, y: 0, z: 0 }, true); w.spatial.set(1, x, z); }
function pair(w: SimWorld) { const id = w.npcs!.civilians.spawn('cashier', { x: 5, z: 0 }), attacker = w.infected!.spawn('infected.runner', { x: 5, z: 0 }); return { e: w.entities.get(id)!, attacker: w.entities.get(attacker)! }; }

test('civilians: seeded grab → bite → down → glowing eyes → rising → infected cycle in place; panic flees; a kill during the grab saves', async () => {
  expect(civilianHeight('npc.civilian-woman-a')).toBeCloseTo(heroineStandingHeight, 3);
  expect(civilianHeight('npc.civilian-adult-f')).toBeCloseTo(heroineStandingHeight, 3);
  expect(civilianHeight('npc.lab-tech-b')).toBeCloseTo(heroineStandingHeight, 3);
  expect(civilianHeight('npc.depot-clerk')).toBeCloseTo(heroineStandingHeight, 3);
  expect(civilianHeight('npc.lab-tech-a')).toBeCloseTo(adultMaleStandingHeight, 3);
  expect(civilianHeight('npc.dale.aftermath')).toBeCloseTo(adultMaleStandingHeight, 3);
  expect(civilianHeight('npc.police-officer')).toBeCloseTo(heroineStandingHeight, 3);
  expect(civilianHeight('npc.mia.aftermath')).toBeCloseTo(heroineStandingHeight, 3);
  expect(civilianHeight('npc.sam.aftermath')).toBeCloseTo(heroineStandingHeight, 3);
  expect(civilianHeight('npc.civilian-elderly')).toBeCloseTo(heroineStandingHeight, 3);
  expect(civilianHeight('npc.civilian-kid') / heroineStandingHeight).toBeCloseTo(1.4744 / 1.8, 6);
  expect(civilianHeight('npc.brother') / heroineStandingHeight).toBeCloseTo(1.4265 / 1.8, 6);
  for (const child of ['npc.civilian-kid', 'npc.brother']) {
    expect(civilianHeight(child)).toBeLessThan(civilianHeight('npc.civilian-woman-a') * .83);
    const figure = new Group(), mesh = new Mesh(new BoxGeometry(.4, 1.47, .3), new MeshBasicMaterial());
    figure.add(mesh); fitCivilianHeight(figure, child);
    expect(new Box3().setFromObject(figure).getSize(new Vector3()).y).toBeCloseTo(civilianHeight(child), 5);
  }
  const calibrated = new Group(), rig = new Group(), body = new Mesh(new BoxGeometry(.4, 1.2, .3), new MeshBasicMaterial());
  rig.name = 'root'; rig.userData.preserveAuthoredBodyScale = true; body.name = 'skin_body'; calibrated.add(rig); rig.add(body);
  fitCivilianHeight(calibrated, 'npc.depot-clerk');
  expect(new Box3().setFromObject(body).getSize(new Vector3()).y).toBeCloseTo(civilianHeight('npc.depot-clerk'), 4);

  const timings = new Set<number>();
  for (const seed of [1, 2, 3, 4, 5]) {
    const w = await world('horde-arena', seed), { e, attacker } = pair(w);
    expect(w.npcs!.civilians.grab(e.id, attacker.id, true)).toBe(true);
    step(w, 89); expect(e.civilian!.state).toBe('grabbed'); step(w, 1); expect(e.civilian!.state).toBe('bitten');
    step(w, e.civilian!.until - w.tick); expect(e.civilian!.state).toBe('down');
    const down = e.civilian!.downTicks; timings.add(down);
    step(w, down - npcs.eyesTicks - 1); expect(e.civilian!.eyesGlow).toBe(false); step(w, 1); expect(e.civilian!.eyesGlow).toBe(true);
    step(w, npcs.eyesTicks); expect(e.civilian!.state).toBe('rising'); const p = { x: e.transform.x, z: e.transform.z };
    step(w, 72); expect(e.civilian!.state).toBe('infected');
    expect(w.events.events().find(ev => ev.type === 'civilian.turned')).toMatchObject({ variant: 'inf.cashier', position: p });
  }
  expect(timings.size).toBeGreaterThan(1);

  const f = await world(), jogger = f.npcs!.civilians.spawn('jogger', { x: 10, z: 0 }), sourceId = f.infected!.spawn('infected.runner', { x: 2, z: 0 });
  f.events.emit({ type: 'infected.attack', tick: f.tick, sourceId, targetId: 1, amount: 10, special: 'lunge', attackId: 1 });
  step(f, 30); expect(f.entities.get(jogger)!.civilian!.state).toBe('flee'); const initial = f.entities.get(jogger)!.transform.x;
  step(f, 180); expect(f.entities.get(jogger)!.transform.x).toBeGreaterThan(initial + 10);

  for (const mode of ['kill', 'late'] as const) {
    const s = await world(), { e, attacker } = pair(s); s.npcs!.civilians.grab(e.id, attacker.id, true); step(s, mode === 'late' ? 90 : 30);
    attacker.health.current = 0; step(s, 1);
    expect(s.events.events().some(ev => ev.type === 'civilian.saved'), mode).toBe(mode !== 'late');
  }
});

test('escort: shared combat pace, follows through a maze, a 2 s stand revives to 50 %, unattended 20 s down fails the mission', async () => {
  {
  const w = await world(), p = w.entities.get(1)!;
  for (const e of [...w.infected!.active]) w.infected!.release(e);
  w.scenario = 'L5'; p.survivor!.velocity = { x: 4.5, z: 0 };
  const follower = w.entities.get(w.npcs!.civilians.spawn('cashier', { x: -10, z: 10 }))!, c = follower.civilian!;
  Object.assign(follower.transform, { x: p.transform.x - 10, z: p.transform.z });
  c.survivor = { key: 'combat-boundary', mode: 'follow', leader: 1, slot: 0, cover: false, foundAt: 0, waitAt: 9999 };
  const enemy = w.entities.get(w.infected!.spawn('infected.runner', { x: 5, z: 0 }))!;
  const visible = vi.spyOn(w.infected!.nav, 'visible').mockReturnValue(true);
  const clear = vi.spyOn(w.infected!.nav, 'clear').mockReturnValue(true);
  const movement = vi.spyOn(w.npcs!, 'move').mockReturnValue(true);
  Object.assign(enemy.transform, { x: p.transform.x + 9, z: p.transform.z });
  expect(followerInCombat(w, follower)).toBe(true);
  updateSurvivor(w, follower);
  expect(movement.mock.lastCall![2]).toBe(3.8);
  enemy.transform.x = p.transform.x + 10;
  expect(followerInCombat(w, follower)).toBe(true);
  enemy.transform.x += .01;
  expect(followerInCombat(w, follower)).toBe(false);
  updateSurvivor(w, follower);
  expect(movement.mock.lastCall![2]).toBeCloseTo(4.5 * 1.05);
  enemy.transform.x = p.transform.x + 9; visible.mockReturnValue(false);
  expect(followerInCombat(w, follower)).toBe(false);
  visible.mockReturnValue(true); enemy.health.current = 0;
  expect(followerInCombat(w, follower)).toBe(false);
  movement.mockRestore(); clear.mockRestore(); visible.mockRestore();
  }
  {
    const w = await world(), p = w.entities.get(1)!;
    w.scenario = 'L5'; p.survivor!.velocity.x = 4.5;
    const follower = w.entities.get(w.npcs!.civilians.spawn('cashier', { x: -10, z: 10 }))!, c = follower.civilian!;
    c.survivor = { key: 'formation', mode: 'follow', leader: 1, slot: 0, cover: false, foundAt: 0, waitAt: 9999 };
    const clear = vi.spyOn(w.infected!.nav, 'clear').mockReturnValue(true), visible = vi.spyOn(w.infected!.nav, 'visible').mockReturnValue(true);
    const movement = vi.spyOn(w.npcs!, 'move').mockReturnValue(true);
    // Far behind: close along the courier's route at the amended 1.05x cap
    // before sliding sideways into the column (aim is half a second ahead).
    for (let slot = 0; slot < 5; slot++) {
      c.survivor.slot = slot; delete c.survivor.pace; updateSurvivor(w, follower);
      expect(movement).toHaveBeenLastCalledWith(follower, { x: follower.transform.x + 4.5 * 1.05 * .5, z: follower.transform.z }, 4.5 * 1.05, c, 0);
    }
    // In its slot: walk with the courier's velocity, no braking and no surge.
    for (let slot = 0; slot < 5; slot++) {
      c.survivor.slot = slot; delete c.survivor.pace;
      // Calm slots sit 2.7/3.4 m back; the rear row staggers into the front row's gaps.
      Object.assign(follower.transform, { x: p.transform.x - (slot < 3 ? 2.7 : 3.4), z: p.transform.z + (slot < 3 ? (slot % 3 - 1) * 1.2 : [-.6, .6][slot - 3]) });
      updateSurvivor(w, follower);
      const [, aim, pace] = movement.mock.lastCall!;
      expect(aim.x - follower.transform.x).toBeCloseTo(4.5 * .5); expect(aim.z - follower.transform.z).toBeCloseTo(0); expect(pace).toBeCloseTo(4.5);
    }
    movement.mockRestore(); clear.mockRestore(); visible.mockRestore();
  }
  const w = await world('maze'); teleport(w, -23, 0);
  const e = w.entities.get(w.npcs!.escorts.spawn({ x: -25, z: 0 }))!;
  for (const target of [{ x: -13, z: 4 }, { x: -7, z: 4 }, { x: -3, z: -3 }, { x: 3, z: -3 }, { x: 7, z: 4 }, { x: 13, z: 4 }, { x: 24, z: 0 }]) {
    for (let i = 0; i < 1500; i++) {
      const p = w.entities.get(1)!, dx = target.x - p.transform.x, dz = target.z - p.transform.z, d = Math.hypot(dx, dz);
      if (d < .4) break; w.setInput({ move: { x: dx / d * .55, z: dz / d * .55 } }); w.update();
      expect(w.infected!.nav.clear(e.transform.x, e.transform.z, .35)).toBe(true);
    }
  }
  w.clearInput(); step(w, 240);
  const p = w.entities.get(1)!;
  expect(Math.hypot(p.transform.x - 24, p.transform.z)).toBeLessThan(1);
  expect(Math.hypot(p.transform.x - e.transform.x, p.transform.z - e.transform.z)).toBeLessThan(4);

  for (const revive of [true, false]) {
    const r = await world('civ-street'), id = r.npcs!.escorts.spawn({ x: revive ? 1 : 10, z: 0 }), escort = r.entities.get(id)!;
    escort.health.current = 0; step(r, 1); expect(escort.escort!.state).toBe('downed');
    if (revive) { step(r, 119); expect(escort.health.current).toBe(50); }
    else { step(r, 1200); expect(r.events.events().find(ev => ev.type === 'mission.failed')).toMatchObject({ reason: 'escort-died' }); }
  }
});

test('corgi: warns of an offscreen threat within 18 m with a unit direction', async () => {
  const w = await world('civ-street'); w.infected!.director.camera.halfWidth = 5; w.infected!.director.camera.halfDepth = 5;
  const threat = w.infected!.spawn('infected.runner', { x: 17, z: 0 }, { state: 'chase' }); step(w, 1);
  expect(w.events.events().find(e => e.type === 'corgi.bark')).toMatchObject({ threatId: threat, direction: { x: 1, z: 0 } });
  // Q-300 (PO 10-31 "There's always a new weapon when Corgi picks it up ... Like unlimited weapons"): the L5 street
  // firearms belong to the survivors; the corgi leaves them where they lie instead of dropping each under the courier.
  {
    const w = await loadLevel('L5', 1);
    try {
      w.missions!.completeObjective('emerge');
      for (let i = 0; i < 30; i++) w.update();
      const street = [...w.entities.iterate()].filter(e => e.pickup && 'actionId' in e.pickup && e.pickup.survivorOnly);
      expect(street.length).toBe(8);
      const gun = street[0], corgi = [...w.entities.iterate()].find(e => e.companion)!;
      const player = w.entities.get(1)!, at = { x: gun.transform.x + 2.5, z: gun.transform.z };
      Object.assign(player.transform, at); w.physics.playerBody?.setTranslation({ ...player.transform }, true); w.spatial.set(1, at.x, at.z);
      Object.assign(corgi.transform, { x: at.x - .8, z: at.z + .6 }); w.spatial.set(corgi.id, corgi.transform.x, corgi.transform.z);
      const fetched: number[] = []; w.events.on('corgi.fetched', e => { if (e.type === 'corgi.fetched') fetched.push(e.pickupId); });
      const from = { ...gun.transform };
      for (let i = 0; i < 600; i++) w.update();
      expect(fetched).not.toContain(gun.id);
      expect(Math.hypot(gun.transform.x - from.x, gun.transform.z - from.z)).toBeLessThan(.05);
      expect([...w.entities.iterate()].filter(e => e.pickup && 'actionId' in e.pickup && e.pickup.survivorOnly).length).toBe(8);
    } finally { w.dispose(); }
  }
  // Trail escape also works in L1: failed routing stands still for 2 s, then follows the courier's recorded path.
  {
    const w = await loadRunnerLevel('L1', 1, undefined, 0, { quality: 'low' });
    try {
      const dog = [...w.entities.iterate()].find(e => e.companion)!;
      const player = w.entities.get(1)!, start = { x: player.transform.x, z: player.transform.z };
      player.hidden = false; player.health.current = player.health.max;
      for (let i = 0; i < 12; i++) {
        player.transform.x = start.x + i * .6;
        w.npcs!.companion.update();
      }
      dog.transform.x = start.x; dog.transform.z = start.z; w.spatial.set(dog.id, start.x, start.z);
      const trail = w.npcs!.companion.trailPoint(dog), steer = vi.spyOn(w.infected!.nav, 'steer').mockReturnValue(false);
      const move = vi.spyOn(w.npcs!, 'moveStep'), path = { path: [] as number[], goal: -1, pathIndex: 0 };
      const failedAt = w.tick + 1;
      for (let elapsed = 0; elapsed < 120; elapsed++) {
        w.tick = failedAt + elapsed;
        expect(w.npcs!.move(dog, { x: 1000, z: 1000 }, 3, path, .1)).toBe(false);
      }
      expect(move).not.toHaveBeenCalled(); expect(trail).not.toBeNull();
      w.tick = failedAt + 120;
      expect(w.npcs!.move(dog, { x: 1000, z: 1000 }, 3, path, .1)).toBe(true);
      expect(move).toHaveBeenCalledOnce(); expect(dog.transform.x).toBeGreaterThan(start.x);
      steer.mockRestore();
    } finally { w.dispose(); }
  }
  // G-27: the Oak sedan's rotated nav footprint must leave a route through the gate beside the wreck.
  {
    const w = await loadRunnerLevel('L3', 1, preset('L3-default'), 0, { quality: 'low' });
    try {
      const crowd = w.infected!.nav;
      expect(crowd.blocked[crowd.cell(-70.75, 24.25)], 'the wreck leaves a full-clearance cell on the authored gate-side aisle').toBe(0);
      expect(crowd.path(crowd.cell(-70.25, 24.25), crowd.nearestCell(-60, 28), [], Infinity), 'lamp leaves the full .5 m crowd a gate-side route').toBe(true);
      w.player!.damage = () => 0;
      const dog = [...w.entities.iterate()].find(e => e.companion)!, controls = missionControls(w);
      controls.teleport('player', { x: -82, z: 23.7 });
      const walk = (to: { x: number; z: number }, ticks: number) => {
        for (let t = 0; t < ticks; t++) {
          const p = w.entities.get(1)!.transform, f = emptyInput(), dx = to.x - p.x, dz = to.z - p.z, d = Math.hypot(dx, dz);
          if (d > .8) f.move = { x: dx / d, z: dz / d };
          w.applyInput(f, 'keyboard'); w.update();
        }
      };
      walk({ x: -69, z: 23.7 }, 200);
      controls.teleport(dog.id, { x: -72.5633, z: 23.4243 });
      const nav = w.infected!.nav, start = nav.nearestCell(dog.transform.x, dog.transform.z, .44);
      expect(nav.path(start, nav.nearestCell(-60, 23.7, .44), [], 1600)).toBe(true); // the rotated wreck no longer seals the gate
      walk({ x: -60, z: 23.7 }, 240); walk({ x: -55, z: 21 }, 120); walk({ x: -51, z: 9 }, 240);
      const p = w.entities.get(1)!.transform;
      expect(Math.hypot(dog.transform.x - p.x, dog.transform.z - p.z)).toBeLessThan(6);
    } finally { w.dispose(); }
  }
}, 120_000);
