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
import { actorRadius, solidLargeCorpse } from '../../src/sim/world/SolidRegistry';
import { followerInCombat, updateSurvivor } from '../../src/sim/outbreak/Survivors';
import { formationBack, formationSlot } from '../../src/sim/missions/missionHelpers';
import { updateAlly } from '../../src/sim/outbreak/Allies';
import { idleEligible, idleLookYaw, looseSlotOffset, startDelayTicks, swayOffset } from '../../src/sim/outbreak/groupNature';

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

  // L9 HIGH: guards must rescue an evacuating civilian before shooting a
  // nearby Alpha; otherwise repeated grabs pin the last passenger at the APC.
  {
    const w = await loadRunnerLevel('L9', 1, preset('L9-default'), 0, { quality: 'high' }); worlds.push(w);
    const s = w.missions!.l9!.driving.state, guard = w.entities.get(s.soldiers[0])!, victim = s.roster[3];
    delete guard.passengerOf; guard.hidden = false;
    Object.assign(guard.transform, { x: -540, y: .7, z: 0 });
    const ally = guard.civilian!.ally!;
    Object.assign(ally, { engaged: true, targetId: 0, nextAttack: w.tick + 1000, post: { x: -540, z: 0 } });
    const alpha = w.infected!.spawn('infected.alpha', { x: -537, z: 0 });
    const biter = w.infected!.spawn('infected.runner', { x: -535, z: 0 });
    Object.assign(w.entities.get(biter)!.infected!.l1!, { mode: 'bite', biteTargetId: victim });
    s.evacuating.push(victim);
    const visibility = vi.spyOn(w.combat!.query, 'shotVisible').mockReturnValue(true);
    try {
      updateAlly(w, guard, () => true);
      expect(ally.targetId, `rescue ${victim} before Alpha ${alpha}`).toBe(biter);
    } finally { visibility.mockRestore(); }
  }

  const f = await world(), jogger = f.npcs!.civilians.spawn('jogger', { x: 10, z: 0 }), sourceId = f.infected!.spawn('infected.runner', { x: 2, z: 0 });
  f.events.emit({ type: 'infected.attack', tick: f.tick, sourceId, targetId: 1, amount: 10, special: 'lunge', attackId: 1 });
  step(f, 30); expect(f.entities.get(jogger)!.civilian!.state).toBe('flee'); const initial = f.entities.get(jogger)!.transform.x;
  step(f, 180); expect(f.entities.get(jogger)!.transform.x).toBeGreaterThan(initial + 10);

  for (const mode of ['kill', 'late'] as const) {
    const s = await world(), { e, attacker } = pair(s); s.npcs!.civilians.grab(e.id, attacker.id, true); step(s, mode === 'late' ? 90 : 30);
    attacker.health.current = 0; step(s, 1);
    expect(s.events.events().some(ev => ev.type === 'civilian.saved'), mode).toBe(mode !== 'late');
  }
  // Sight caching must retain interleaved survivor answers across a high-tier night crowd and invalidate on tick/power change.
  {
    const w = await loadRunnerLevel('L8', 1, undefined, 0, { quality: 'high' }); worlds.push(w);
    w.missions!.state.timeOfDay = 'night'; const power = w.lightPower!;
    for (const lamp of power.lamps.values()) for (const point of [{ x: lamp.x, z: lamp.z }, { x: lamp.x + lamp.range, z: lamp.z }, { x: lamp.x, z: lamp.z - lamp.range - .001 }]) {
      const lit = [...power.lamps.values()].some(l => Math.hypot(point.x - l.x, point.z - l.z) <= l.range && power.isOn(l.id));
      expect(power.sightMultiplier(point)).toBe(lit ? 1 : .6);
    }
    w.tick++;
    const humans = w.infected!.hearing.humans, at = w.entities.get(1)!.transform;
    for (const center of [at, { x: at.x + 20, z: at.z - 12 }]) for (const radius of [0, 8, 16, 40]) {
      const expected = humans.all().filter(h => (h.position.x - center.x) ** 2 + (h.position.z - center.z) ** 2 <= radius * radius).map(h => h.id).sort((a, b) => a - b);
      expect(humans.within(center, radius).map(h => h.id)).toEqual(expected);
    }
    const target = humans.all().find(h => h.id !== 1)!, person = w.entities.get(target.id)!, hp = person.health.current;
    person.health.current = 0;
    expect(humans.get(person.id)).toBeUndefined();
    expect(humans.within(target.position, 1).some(h => h.id === person.id)).toBe(false);
    person.health.current = hp;
    const lamp = [...power.lamps.values()].find(l => power.isOn(l.id))!;
    let reads = 0; const isOn = power.isOn.bind(power); power.isOn = (id: string) => { reads++; return isOn(id); };
    const a = { x: lamp.x, z: lamp.z }, b = { x: lamp.x + .1, z: lamp.z + .1 }, firstA = power.sightMultiplier(a), afterA = reads;
    const firstB = power.sightMultiplier(b), afterB = reads;
    expect(power.sightMultiplier(a)).toBe(firstA); expect(reads).toBe(afterB);
    expect(afterA).toBeGreaterThan(0); expect(afterB).toBeGreaterThan(afterA);
    expect(power.sightMultiplier(b)).toBe(firstB);
    expect(power.sightMultiplier({ x: 100000, z: 100000 })).toBe(.6); expect(reads).toBe(afterB);
    w.tick++; power.sightMultiplier(a); expect(reads).toBeGreaterThan(afterB);
    const afterNextTick = reads; power.revision++; power.sightMultiplier(a); expect(reads).toBeGreaterThan(afterNextTick);
    const listeners = w.events.listenerCount;
    w.loadMission(w.missions!.def);
    expect(w.events.listenerCount).toBe(listeners);
  }
  // L10 hidden catch-up must not use a route that crosses a railing to choose the other side of a barrier.
  {
    const w = await world(), dog = w.entities.get(w.npcs!.companion.spawn())!, player = w.entities.get(1)!;
    try {
      w.scenario = 'L10';
      Object.assign(player.transform, { x: 0, z: 0 });
      Object.assign(dog.transform, { x: 20, z: 0 }); w.spatial.set(dog.id, dog.transform.x, dog.transform.z);
      Object.assign(w.infected!.director.camera, { halfWidth: 2, halfDepth: 2 });
      const visible = vi.spyOn(w.infected!.nav, 'visible').mockReturnValue(false);
      vi.spyOn(w.infected!.nav, 'clear').mockReturnValue(true);
      const path = vi.spyOn(w.infected!.nav, 'path').mockReturnValue(true);
      vi.spyOn(w.infected!.director, 'offscreen').mockReturnValue(true);
      vi.spyOn(w.npcs!, 'move').mockReturnValue(false);
      const relocate = vi.spyOn(w.solids, 'relocate').mockReturnValue(true);
      for (let tick = 1; tick <= 370; tick++) { w.tick = tick; w.npcs!.companion.update(); }
      expect(relocate, 'an L10 rail cannot be bypassed by hidden catch-up').not.toHaveBeenCalled();
      expect(path, 'L10 catch-up requires a direct clear line instead of an around-the-wall route').not.toHaveBeenCalled();
      expect(dog.transform.x).toBe(20);
      visible.mockRestore();
    } finally { w.dispose(); }
  }
  // The follow stop band used to leave the dog just outside the hangar when
  // the courier paused immediately across its threshold. Keep this in the
  // existing NPC case so the native suite stays within its case budget.
  for (const quality of ['high', 'low'] as const) {
    const w = await loadLevel('L10', 1, quality); worlds.push(w);
    const player = w.entities.get(1)!, dog = [...w.entities.iterate()].find(e => e.companion)!;
    Object.assign(player.transform, { x: 2707, z: 53.2 });
    w.physics.playerBody!.setTranslation(player.transform, true); w.spatial.set(1, 2707, 53.2);
    Object.assign(dog.transform, { x: 2707, y: .3, z: 43 }); w.spatial.set(dog.id, 2707, 43);
    dog.companion!.path.length = 0; dog.companion!.goal = -1; dog.companion!.pathIndex = 0; dog.companion!.following = false;
    dog.companion!.velocity = { x: 0, z: 0 }; delete dog.locomotion; delete dog.motion;
    w.solids.forget(dog); w.solids.admit(dog, 'test.l10-hangar', 4);
    for (let tick = 0; tick < 4; tick++) w.update(); // Activate the streamed collision/nav chunk.
    Object.assign(player.transform, { x: 2707, z: 53.2 });
    Object.assign(dog.transform, { x: 2707, y: .3, z: 43 }); w.spatial.set(dog.id, 2707, 43);
    dog.companion!.path.length = 0; dog.companion!.goal = -1; dog.companion!.pathIndex = 0; dog.companion!.following = false;
    dog.companion!.velocity = { x: 0, z: 0 }; delete dog.locomotion; delete dog.motion;
    w.solids.forget(dog); w.solids.admit(dog, 'test.l10-hangar', 4);
    w.missions!.checkpoint('cure-research-entry', player.transform);
    for (let tick = 0; tick < 900 && dog.transform.z < 53.84; tick++) w.update();
    expect(dog.transform.z, `${quality}: corgi crosses into the hangar within 15 s of the checkpoint courier`).toBeGreaterThanOrEqual(53.84);
    expect(Math.hypot(dog.transform.x - player.transform.x, dog.transform.z - player.transform.z), `${quality}: corgi remains with the courier`).toBeLessThan(6);
    Object.assign(player.transform, { x: 2707, z: 43, yaw: -Math.PI / 2 });
    w.physics.playerBody!.setTranslation(player.transform, true); w.spatial.set(1, 2707, 43);
    Object.assign(dog.transform, { x: 2707, y: .3, z: 36 }); w.spatial.set(dog.id, 2707, 36);
    dog.companion!.path.length = 0; dog.companion!.goal = -1; dog.companion!.pathIndex = 0; dog.companion!.following = false;
    dog.companion!.velocity = { x: 0, z: 0 }; delete dog.locomotion; delete dog.motion;
    w.solids.forget(dog); w.solids.admit(dog, 'test.l10-normal-approach', 4);
    w.setInput({ move: { x: 0, z: 1 } });
    for (let tick = 0; tick < 300; tick++) w.update();
    w.clearInput();
    expect(player.transform.z, `${quality}: courier walks into the hangar`).toBeGreaterThan(53);
    expect(dog.transform.z, `${quality}: corgi follows a normal walking approach into the hangar`).toBeGreaterThan(53);
    expect(Math.hypot(dog.transform.x - player.transform.x, dog.transform.z - player.transform.z)).toBeLessThan(6);
    w.missions!.restore('cure-research-entry');
    const restoredDog = w.entities.get(dog.id)!;
    for (let tick = 0; tick < 900 && restoredDog.transform.z < 53.84; tick++) w.update();
    expect(restoredDog.transform.z, `${quality}: corgi is inside within 15 s after restoring the hangar checkpoint`).toBeGreaterThanOrEqual(53.84);
    expect(Math.hypot(restoredDog.transform.x - player.transform.x, restoredDog.transform.z - player.transform.z)).toBeLessThan(6);
    Object.assign(player.transform, { x: 2707, z: 59 });
    w.physics.playerBody!.setTranslation(player.transform, true); w.spatial.set(1, 2707, 59);
    for (const x of [2699, 2715]) {
      expect(w.solids.relocate(restoredDog, { x, y: .3, z: 43 }, 'test.l10-apron', 0, false)).toBe(true);
      const c = restoredDog.companion!;
      c.path.length = 0; c.goal = -1; c.pathIndex = 0; c.following = false; c.velocity = { x: 0, z: 0 };
      delete restoredDog.locomotion; delete restoredDog.motion;
      for (let tick = 0; tick < 900 && restoredDog.transform.z < 53.84; tick++) w.update();
      expect(restoredDog.transform.z, `${quality}: corgi clears the threshold from apron x=${x}`).toBeGreaterThanOrEqual(53.84);
    }
    // A research-road cohort can be carried just behind the courier when she
    // exits the hangar. It must reacquire her even after she has passed it.
    Object.assign(player.transform, { x: 2743.89, z: 20.87 });
    w.physics.playerBody!.setTranslation(player.transform, true); w.spatial.set(1, 2743.89, 20.87);
    w.chunks!.update();
    const ai = w.infected!;
    let spawnAt: { x: number; z: number } | undefined;
    for (let radius = 0; radius < 40 && !spawnAt; radius += 2) for (let dx = -radius; dx <= radius && !spawnAt; dx += 2) for (let dz = -radius; dz <= radius; dz += 2) {
      const x = 2715 + dx, z = 50 + dz;
      if (ai.nav.clear(x, z, .4)) { spawnAt = { x, z }; break; }
    }
    expect(spawnAt, `${quality}: clear nav ground beside the hangar`).toBeDefined();
    const group = [
      ['infected.sprinter', 2715.4, 50.6], ['infected.firefighter', 2717.1, 51.1], ['infected.armored', 2716.4, 49.6],
    ] as const;
    const ids = group.map(([archetype, x, z]) => {
      const id = ai.spawn(archetype, spawnAt!, { state: 'idle', cureRegion: 'research-campus' });
      const infected = w.entities.get(id)!; Object.assign(infected.transform, { x, z }); w.spatial.set(id, x, z);
      return id;
    });
    for (let tick = 0; tick < 20 * 60; tick++) w.update();
    const remaining = ids.map(id => {
      const infected = w.entities.get(id)!;
      return Math.hypot(infected.transform.x - player.transform.x, infected.transform.z - player.transform.z);
    });
    expect(Math.min(...remaining), `${quality}: hangar group closes from about 40 m; remaining=${remaining.map(d => d.toFixed(1)).join(',')}`).toBeLessThan(5);
  }
});

test('escort: shared combat pace, follows through a maze, a 2 s stand revives to 50 %, unattended 20 s down fails the mission', async () => {
  {
  // r12-group: the follower formation is a loose, persistent cluster (not the 1.2 m parade lattice) with body room between slots.
  const heading = { x: 1, z: 0 }, slots = Array.from({ length: 48 }, (_, i) => formationSlot({ x: 0, z: 0 }, heading, i));
  // L7 keeps its authored targets while the other levels retain loose slots.
  for (let slot = 0; slot < 48; slot++) expect(formationSlot({ x: 0, z: 0 }, heading, slot, false))
    .toEqual({ x: -formationBack(slot), z: (slot % 3 - 1) * 1.2 });
  expect(slots).toEqual(Array.from({ length: 48 }, (_, i) => formationSlot({ x: 0, z: 0 }, heading, i)));
  for (let i = 0; i < slots.length; i++) for (let j = i + 1; j < slots.length; j++) expect(Math.hypot(slots[i].x - slots[j].x, slots[i].z - slots[j].z)).toBeGreaterThan(.89);
  expect(slots.filter((s, i) => Math.hypot(s.x + formationBack(i), s.z - (i % 3 - 1) * 1.2) > .12).length).toBeGreaterThan(16);
  expect(Math.max(...slots.slice(0, 3).map(s => s.x))).toBeLessThan(-2.2);
  const w = await world(), p = w.entities.get(1)!;
  for (const e of [...w.infected!.active]) w.infected!.release(e);
  w.scenario = 'L6';
  const follower = w.entities.get(w.npcs!.civilians.spawn('cashier', { x: p.transform.x - 3, z: p.transform.z }))!, c = follower.civilian!;
  c.survivor = { key: 'group-react', mode: 'follow', leader: 1, slot: 0, cover: false, foundAt: 0, waitAt: 9999, restAt: w.tick - 60 };
  // A rested follower sets off a personal beat after it is asked, then walks.
  const delay = startDelayTicks(follower, 'L6'), start = { ...follower.transform }, goal = { x: start.x - 4, z: start.z };
  expect(delay).toBeGreaterThan(4);
  for (let i = 0; i < delay; i++) {
    // Restoring onto a later world clock preserves the reaction time still owed.
    if (i === 2) { w.tick += 600; w.npcs!.restore(600); }
    w.npcs!.move(follower, goal, 3, c, 0); w.tick++;
    expect(Math.hypot(follower.transform.x - start.x, follower.transform.z - start.z)).toBe(0);
  }
  w.npcs!.move(follower, goal, 3, c, 0); w.tick++;
  expect(follower.transform.x).toBeLessThan(start.x);
  for (let i = 0; i < 20; i++) { w.npcs!.move(follower, goal, 3, c, 0); w.tick++; }
  expect(follower.transform.x).toBeLessThan(start.x - .05);
  w.scenario = 'L7'; c.survivor!.restAt = w.tick - 60; delete c.survivor!.stirAt;
  const beforeL7 = follower.transform.x;
  w.npcs!.move(follower, { x: beforeL7 - 4, z: follower.transform.z }, 3, c, 0);
  expect(follower.transform.x).toBeLessThan(beforeL7); // no personal start delay in the gated level
  w.scenario = 'L6';
  // Standing, it looks toward a nearby infected before anything else.
  const enemy = w.entities.get(w.infected!.spawn('infected.runner', { x: follower.transform.x, z: follower.transform.z + 6 }))!;
  expect(idleEligible(follower)).toBe(true);
  expect(idleLookYaw(w, follower)).toBeCloseTo(-Math.atan2(enemy.transform.z - follower.transform.z, enemy.transform.x - follower.transform.x));
  // A nearby infected behind a wall must not synchronize the group's gaze through it.
  const visible = vi.spyOn(w.infected!.nav, 'visible').mockReturnValue(false);
  expect(idleLookYaw(w, follower)).not.toBeCloseTo(-Math.atan2(enemy.transform.z - follower.transform.z, enemy.transform.x - follower.transform.x));
  visible.mockRestore();
  }
  {
    const w = await world(); w.scenario = 'L8';
    const group = [-3, 3].map((z, slot) => {
      const e = w.entities.get(w.npcs!.civilians.spawn('cashier', { x: -10, z }))!;
      e.civilian!.survivor = { key: `urgent-${slot}`, mode: 'follow', leader: 1, slot, cover: false, foundAt: 0, waitAt: 9999, injured: !!slot };
      return e;
    });
    // Distinct temperaments/injury must track the same urgent evacuation intent equally.
    const urgent: number[] = [];
    for (let i = 0; i < 20; i++) {
      w.tick++;
      for (const e of group) { e.civilian!.survivor!.briskAt = w.tick; w.npcs!.moveStep(e, .05, 0); }
      expect(group[0].locomotion!.vx).toBeCloseTo(group[1].locomotion!.vx, 10);
      urgent.push(group[0].locomotion!.vx);
    }
    for (const e of group) { delete e.locomotion; delete e.civilian!.survivor!.briskAt; }
    for (let i = 0; i < 12; i++) { w.tick++; for (const e of group) w.npcs!.moveStep(e, .05, 0); }
    expect(group[0].locomotion!.vx).toBeCloseTo(group[1].locomotion!.vx, 10);
    expect(group[0].locomotion!.vx).toBeCloseTo(urgent[11], 10);
    // The subway convoy keeps its authored shared response rather than a second personality modifier.
    w.scenario = 'L6'; for (const e of group) delete e.locomotion;
    for (let i = 0; i < 12; i++) { w.tick++; for (const e of group) w.npcs!.moveStep(e, .05, 0); }
    expect(group[0].locomotion!.vx).toBeCloseTo(group[1].locomotion!.vx, 10);
    expect(group[0].locomotion!.vx).toBeLessThan(urgent[11]);
    // A calm L5 velocity is already solved from its wandering slot: do not sway its short aim twice.
    w.scenario = 'L5'; group[0].civilian!.survivor!.briskAt = w.tick;
    Object.assign(w.entities.get(1)!.survivor!.velocity, { x: 3, z: 0 });
    const move = vi.spyOn(w.npcs!, 'moveStep').mockImplementation(() => {}), at = group[0].transform;
    w.npcs!.move(group[0], { x: at.x + 2, z: at.z }, 3, group[0].civilian!, 0);
    expect(move).toHaveBeenCalled(); expect(move.mock.calls[0][2]).toBeCloseTo(0, 10);
    move.mockRestore();
  }
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
      // Calm slots sit 2.7/3.4 m back; the rear row staggers into the front row's gaps (plus the current personal slot offset and wander phase).
      Object.assign(follower.transform, { x: p.transform.x - (slot < 3 ? 2.7 : 3.4), z: p.transform.z + (slot < 3 ? (slot % 3 - 1) * 1.2 : [-.6, .6][slot - 3]) + looseSlotOffset(slot).side * .4 + swayOffset(follower.id, w.tick, .12) });
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
  // A real Alpha corpse blocks the calm stride despite an unobstructed route grid.
  {
    const w = await world();
    for (const enemy of [...w.infected!.active]) w.infected!.release(enemy);
    w.scenario = 'L5'; teleport(w, 4, 0);
    const body = w.entities.get(w.infected!.spawn('infected.alpha', { x: 1.6, z: 0 }, { state: 'idle' }))!;
    body.health.current = 0; Object.assign(body.infected!, { state: 'dead', deadAt: w.tick - 120, recoverAt: -1 }); w.infected!.settle(body);
    const follower = w.entities.get(w.npcs!.civilians.spawn('cashier', { x: 0, z: 0 }))!;
    follower.civilian!.survivor = { key: 'corpse-route', mode: 'follow', leader: 1, slot: 1, cover: false, foundAt: 0, waitAt: 9999 };
    vi.spyOn(w.npcs!.civilians, 'update').mockImplementation(() => { updateSurvivor(w, follower); });
    expect(solidLargeCorpse(body)).toBe(true);
    expect(w.infected!.nav.visible(follower.transform, { x: 4, z: 0 }, actorRadius(follower))).toBe(true);
    w.setInput({ move: { x: 1, z: 0 } });
    let detoured = false;
    for (let i = 0; i < 240; i++) {
      w.update(); detoured ||= Math.abs(follower.transform.z) > .8;
      expect(Math.hypot(follower.transform.x - body.transform.x, follower.transform.z - body.transform.z)).toBeGreaterThanOrEqual(actorRadius(follower) + actorRadius(body) - .021);
    }
    expect(detoured).toBe(true);
    expect(follower.transform.x).toBeGreaterThan(body.transform.x + 3);
    expect(w.solids.offenders).toEqual([]);
  }
  // The reported crossing: opposing routes through the same corgi/follower contact.
  // Keep real navigation, response and final contact commits; only prescribe the route goals.
  {
    const w = await world();
    for (const enemy of [...w.infected!.active]) w.infected!.release(enemy);
    w.scenario = 'L5'; teleport(w, 28, 41);
    const dog = w.entities.get(w.npcs!.companion.spawn())!;
    expect(w.solids.relocate(dog, { x: 20, y: .3, z: 41.2 }, 'test.crossing-dog', 0, false)).toBe(true);
    dog.transform.yaw = Math.PI / 2;
    w.solids.setBarrier('test-crossing-post', { x: 20, z: 39.25, y: .7, halfX: .3, halfZ: .1, halfY: 1 });
    const group = [0, -.8, .8].map((side, slot) => {
      const e = w.entities.get(w.npcs!.civilians.spawn('cashier', { x: 20 + side, z: slot ? 39 : 40 }))!;
      e.civilian!.survivor = { key: `crossing-${slot}`, mode: 'follow', leader: 1, slot, cover: false, foundAt: 0, waitAt: 9999 };
      return e;
    });
    vi.spyOn(w.npcs!.civilians, 'update').mockImplementation(() => {
      for (const [slot, e] of group.entries()) w.npcs!.move(e, { x: 20 + [0, -.8, .8][slot], z: 46 }, 3.8, e.civilian!, .1);
    });
    const companionUpdate = w.npcs!.companion.update.bind(w.npcs!.companion);
    vi.spyOn(w.npcs!.companion, 'update').mockImplementation(() => {
      if ((dog.companion!.contactRejected ?? 0) >= 30 || dog.companion!.contactYield) companionUpdate();
      else w.npcs!.move(dog, { x: 20, z: 36 }, 4.5, dog.companion!, 2);
    });
    let rejected = 0, yielded = false;
    for (let i = 0; i < 360; i++) {
      w.update(); rejected = Math.max(rejected, dog.companion!.contactRejected ?? 0); yielded ||= !!dog.companion!.contactYield;
      expect(w.solids.offenders).toEqual([]);
    }
    for (const e of group) expect(e.transform.z, `follower ${e.id} clears the crossing`).toBeGreaterThan(43);
    expect(dog.transform.z).toBeLessThan(39);
    expect(rejected).toBeGreaterThanOrEqual(30);
    expect(yielded).toBe(true);
  }
});

test('corgi: warns of an offscreen threat within 18 m with a unit direction', async () => {
  // PO 11-26: full-height tunnel side walls keep respawns and movement inside
  // the drawn trackway while preserving the authored maintenance openings.
  {
    const w = await loadRunnerLevel('L6', 1, preset('L6-default'), 0, { quality: 'low' });
    try {
      const p = w.entities.get(1)!, dog = [...w.entities.iterate()].find(e => e.companion)!;
      Object.assign(p.transform, { x: 110.18, z: 15.62, y: 1.27 });
      const nav = w.infected!.nav;
      expect(nav.visible(p.transform, { x: 110.18, z: 10.2 }, .35)).toBe(false);
      expect(nav.visible(p.transform, { x: 110.18, z: 19.8 }, .35)).toBe(false);
      expect(nav.clear(110.18, 15.62, .35)).toBe(true);
      w.npcs!.companion.respawnNear();
      expect(Math.abs(dog.transform.z - 15)).toBeLessThan(4);
      expect(nav.visible(p.transform, dog.transform, .3)).toBe(true);
      const playerNav = nav.forPlayer(.35), start = playerNav.nearestCell(p.transform.x, p.transform.z, .35), path: number[] = [];
      for (const x of [54, 78, 126, 162, 198, 228]) {
        const wallZ = [54,126,198].includes(x) ? 11.2 : 18.8;
        const door = playerNav.nearestCell(x, wallZ + (wallZ < 15 ? .8 : -.8), .35);
        expect(door, `service opening at ${x} has a nearby walkable door cell`).toBeGreaterThanOrEqual(0);
        expect(playerNav.path(start, door, path, 16000), `tunnel reaches service opening at ${x}`).toBe(true);
      }
    } finally { w.dispose(); }
  }
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
  // Six seconds of failed progress recover off-screen, followed by real visible running.
  {
    const w = await world(), dog = w.entities.get(w.npcs!.companion.spawn())!, p = w.entities.get(1)!;
    for (const enemy of [...w.infected!.active]) w.infected!.release(enemy);
    w.npcs!.companion.forceSafe = true;
    Object.assign(w.infected!.director.camera, { halfWidth: 6, halfDepth: 6 });
    for (const gap of [45, 20, 5]) {
      Object.assign(w.infected!.director.camera, { halfWidth: gap > 6 ? 6 : 2, halfDepth: gap > 6 ? 6 : 2 });
      Object.assign(dog.transform, { x: p.transform.x + gap, z: p.transform.z }); w.spatial.set(dog.id, dog.transform.x, dog.transform.z);
      const move = vi.spyOn(w.npcs!, 'move').mockReturnValue(false), start = w.tick;
      for (let tick = 1; tick <= 360; tick++) {
        // Slow catch-up still has a six-second limit outside the 35 m leash.
        if (gap === 45) dog.transform.x = p.transform.x + gap - tick / 120;
        // Side-to-side escape attempts must not count as closing the gap.
        if (gap === 20) dog.transform.z = p.transform.z + (tick % 2 ? .6 : -.6);
        w.tick = start + tick; w.npcs!.companion.update();
      }
      expect(dog.transform.x).toBe(p.transform.x + gap - (gap === 45 ? 3 : 0));
      expect(w.infected!.director.offscreen(dog.transform, dog.transform.y - .3)).toBe(true);
      w.update();
      expect(dog.hidden).not.toBe(true);
      expect(dog.transform.x).toBeLessThan(p.transform.x);
      expect(w.infected!.director.offscreen(dog.transform, dog.transform.y - .3)).toBe(true);
      expect(dog.companion!.rejoining).toBe(true);
      move.mockRestore();
      let ranIntoView = false;
      for (let tick = 0; tick < 240; tick++) {
        const before = { ...dog.transform }; w.update();
        expect(Math.hypot(dog.transform.x - before.x, dog.transform.z - before.z)).toBeLessThan(.2);
        expect(dog.hidden).not.toBe(true);
        if (!w.infected!.director.offscreen(dog.transform, dog.transform.y - .3) && Math.hypot(dog.companion!.velocity!.x, dog.companion!.velocity!.z) > 1) ranIntoView = true;
      }
      expect(ranIntoView).toBe(true);
      expect(Math.hypot(dog.transform.x - p.transform.x, dog.transform.z - p.transform.z)).toBeLessThan(3);
      expect(dog.companion!.rejoining).toBeUndefined();
    }
    // A visible dog cannot vanish, and scripted transport keeps ownership of its pose.
    const move = vi.spyOn(w.npcs!, 'move').mockReturnValue(false);
    Object.assign(dog.transform, { x: p.transform.x + 40, z: p.transform.z });
    Object.assign(w.infected!.director.camera, { halfWidth: 50, halfDepth: 50 });
    for (let i = 0; i < 400; i++) { w.tick++; w.npcs!.companion.update(); }
    expect(dog.transform.x).toBe(p.transform.x + 40);
    dog.passengerOf = 999;
    Object.assign(w.infected!.director.camera, { halfWidth: 6, halfDepth: 6 });
    for (let i = 0; i < 400; i++) { w.tick++; w.npcs!.companion.update(); }
    expect(dog.transform.x).toBe(p.transform.x + 40);
    delete dog.passengerOf; move.mockRestore();
    w.events.emit({ type: 'cinematic.completed', id: 'test-transition', tick: w.tick });
    expect(Math.hypot(dog.transform.x - p.transform.x, dog.transform.z - p.transform.z)).toBeLessThanOrEqual(4);
    expect(dog.hidden).not.toBe(true);
    expect(dog.companion!.path).toEqual([]);
    dog.hidden = true;
    dog.pendingAdmission = { ...dog.transform, writer: 'test.hidden-admission', hidden: true };
    w.npcs!.companion.respawnNear();
    expect(dog.pendingAdmission).toBeUndefined();
    expect(dog.hidden).toBe(false);
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
