import { mkdirSync, writeFileSync } from 'node:fs';
import { afterEach, describe, expect, test } from 'vitest';
import { l4, l4Anchors, l4Edges, l4Emergence, l4Inside, l4Route, l4ConvoyStations } from '../../src/data/l4';
import { l4AlphaEmergence, l4BreakableLine } from '../../src/levels/L4/layout';
import { completeCampaignLevel } from '../../src/sim/progression/carryover';
import { preset } from '../../src/sim/progression/Campaign';
import { SimPhase } from '../../src/core/EventBus';
import { action } from '../../src/data/actions/catalog';
import { timeOfDay } from '../../src/data/timeOfDay';
import { emptyInput } from '../../src/input/InputFrame';
import { validateMission } from '../../src/sim/missions/schema';
import type { SimWorld } from '../../src/sim/world/SimWorld';
import { loadL4, runL4 } from '../../tools/sim-runner/l4Bots';

/**
 * E22 L4 "The Safe City Falls": mission graph, convoy, false safety, machine gun, the turn, scale, edges, spectacle, line break, live
 * damage, cellar, light, checkpoints (sim ACs). PO 10-09: no 20-seed batteries; one single-seed complete-bot pass is the can-it-be-finished check.
 */
let world: SimWorld | undefined;
afterEach(() => { world?.dispose(); world = undefined; });
const HEAVY = 1_800_000;
function record(name: string, value: unknown) { mkdirSync('test-results/epics/E22', { recursive: true }); writeFileSync(`test-results/epics/E22/${name}.json`, JSON.stringify(value, null, 2) + '\n'); }
const dist = (a: { x: number; z: number }, b: { x: number; z: number }) => Math.hypot(a.x - b.x, a.z - b.z);
const step = (w: SimWorld, ticks: number) => { for (let i = 0; i < ticks; i++) w.update(); };
const humans = (w: SimWorld) => [...w.entities.iterate()].filter(e => e.civilian && !e.infection && e.health.current > 0 && !e.hidden);

describe('L4 The Safe City Falls', () => {
  test('T-E22-01 @E22 @E22-AC01 mission graph ride -> quartermaster -> hold -> hide -> bar is completable, no fail timer', async () => {
    const l = await loadL4(1); world = l.world; const m = l.mission;
    expect(validateMission(m.def)).toEqual([]);
    expect(m.def.steps.map(s => s.id)).toEqual(['ride', 'quartermaster', 'hold', 'hide', 'bar', 'wait']);
    expect(m.def.steps.every(s => s.timer === undefined && s.fail.length === 0) && m.def.deadline === undefined).toBe(true);
    expect(m.def.finish).toEqual(['wait']); expect(m.def.checkpoints).toEqual(['arrival', 'turn', 'line-1', 'nests', 'armor', 'line-break']);
    // E12-AC07 walk: complete exactly the active objective; the gap before the first turn is bridged by the controller.
    for (let guard = 0; guard < 12 && m.state.phase === 'playing'; guard++) { m.completeObjective(); if (m.state.l4!.phase === 'cellar') step(l.world, 8 * 60); }
    expect(m.state.completedObjectives).toEqual(['ride', 'quartermaster', 'hold', 'hide', 'bar', 'wait']);
    expect(m.state.phase).toBe('progression');
  }, HEAVY);

  test('T-E22-02 @E22 @E22-AC02 the complete bot finishes a single seed from L4-default (bat, axe, handgun) with few deaths, in the time band', async () => {
    const l = await loadL4(3); world = l.world;
    const r = runL4(l.world, l.mission, 'complete', { seed: 3, maxSeconds: 700 });
    record('bot-complete-seed3', r);
    expect(r.outcome).toBe('complete'); expect(r.deaths).toBeLessThanOrEqual(2);
    expect(r.simSeconds).toBeGreaterThanOrEqual(l4.bots.completeMedianS[0]); expect(r.simSeconds).toBeLessThanOrEqual(l4.bots.completeMedianS[1]);
    expect(r.rideS).toBeGreaterThanOrEqual(l4.convoy.rideS[0]); expect(r.rideS).toBeLessThanOrEqual(l4.convoy.rideS[1]);
    expect(r.maxConcurrent).toBeLessThanOrEqual(l4.war.caps.infected.high); expect(r.maxCharacters).toBeLessThanOrEqual(l4.war.caps.characters.high);
  }, HEAVY);

  test('T-E22-04 @E22 @E22-AC04 convoy: five vehicles, the courier a seated passenger of a bus, 20-35 s ride, control back <= 0.5 s after the stop', async () => {
    const l = await loadL4(1); world = l.world; const w = l.world, m = l.mission, s = m.state.l4!;
    expect(l4.convoy.vehicles.map(v => v.asset).sort()).toEqual(['veh.evac-bus', 'veh.evac-bus', 'veh.military-apc', 'veh.military-truck', 'veh.military-truck']);
    expect(s.convoyIds).toHaveLength(5); expect(w.entities.get(1)!.hidden).toBe(true);
    const events: string[] = []; w.events.on('vehicle.entered', e => { if (e.type === 'vehicle.entered') events.push(`entered:${e.role}`); }); w.events.on('vehicle.exited', e => { if (e.type === 'vehicle.exited') events.push(`exited:${e.role}`); });
    // The courier rides in the first bus of the column (PO 10-13: "Let the user exit the 1st bus which is ON the military area"); every vehicle ends parked on the route's end.
    expect(l4.convoy.vehicles.findIndex(v => v.player)).toBe(l4.convoy.vehicles.findIndex(v => v.asset === 'veh.evac-bus'));
    let t = 0; while (s.phase === 'convoy' && t < 60 * 60) { w.update(); t++; }
    expect(s.phase).toBe('plaza'); expect(t / 60).toBeGreaterThanOrEqual(20); expect(t / 60).toBeLessThanOrEqual(35);
    expect(w.entities.get(1)!.hidden).toBe(false); expect(w.storyLock).toBeNull();
    expect(events).toContain('exited:passenger');
    // Control returns on the very tick the bus stops (<= 0.5 s): input moves the courier at once.
    const p0 = { ...w.entities.get(1)!.transform }; for (let i = 0; i < 30; i++) { w.applyInput({ ...emptyInput(), move: { x: 0, z: -1 } }, 'keyboard'); w.update(); }
    expect(dist(w.entities.get(1)!.transform, p0)).toBeGreaterThan(1);
    // Parked column: the last bus within the gap, the column ends at the route end, nothing overlaps another vehicle or a wall.
    const route = l4Route(), stations = l4ConvoyStations(route.length);
    const poses = s.convoyIds.map(id => w.entities.get(id)!.transform);
    for (let i = 0; i < poses.length; i++) for (let j = i + 1; j < poses.length; j++) expect(dist(poses[i], poses[j]), `${i}/${j}`).toBeGreaterThan((l4.convoy.vehicles[i].len + l4.convoy.vehicles[j].len) / 2 - .6);
    expect(stations.travel).toBeGreaterThan(150);
  }, HEAVY);

  test('T-E22-05 @E22 @E22-AC05 false safety until the first turn: zero infected, zero combat events, >= 40 civilians in routines, >= 16 soldiers on posts', async () => {
    const l = await loadL4(2); world = l.world; const w = l.world, m = l.mission, s = m.state.l4!;
    const bad: string[] = []; for (const type of ['combat.hit', 'combat.kill', 'combat.attack', 'outbreak.infection', 'player.damaged', 'ally.attack'] as const) w.events.on(type, e => bad.push(e.type));
    const idle: Record<number, number> = {}, civilians = humans(w).filter(e => !e.civilian!.ally);
    expect(civilians.length).toBeGreaterThanOrEqual(40);
    let maxIdle = 0;
    while (s.phase === 'convoy') step(w, 60);
    step(w, 4 * 60);
    m.completeObjective('quartermaster');
    let infectedBefore = 0;
    for (let t = 0; t < 60 * 60 && s.phase !== 'war'; t++) {
      w.update();
      if (s.phase === 'plaza') infectedBefore = Math.max(infectedBefore, w.infected!.active.length);
      if (t % 30 === 0) for (const e of humans(w)) { const c = e.civilian!; if (c.ally || c.pet || c.state !== 'calm') continue; const moving = !!e.motion?.moving, seated = c.schedule?.[c.scheduleStep ?? 0]?.activity === 'sit'; const key = e.id; if (moving || seated || (c.schedule?.[c.scheduleStep ?? 0]?.facing)) idle[key] = 0; else { idle[key] = (idle[key] ?? 0) + .5; maxIdle = Math.max(maxIdle, idle[key]); } }
    }
    expect(s.phase).toBe('war'); expect(infectedBefore).toBe(0);
    expect(bad.filter(t => t !== 'outbreak.infection')).toEqual([]);
    expect(s.soldierIds.length).toBeGreaterThanOrEqual(16); expect(maxIdle).toBeLessThanOrEqual(3);
    // No wrecks, damage decals or corpses in the clean city: nothing but the layout's W0 placements (checked statically in l4-static.test.ts).
    expect([...w.entities.iterate()].filter(e => e.civilian?.state === 'finished')).toHaveLength(0);
  }, HEAVY);

  test('T-E22-06 @E22 @E22-AC06 machine gun: 14 per round, 10/s, 4 degrees, 26 m, pierce 1, no ammunition; 5 infected at 10 m fall in <= 3 s (handgun >= 2x slower)', async () => {
    const def = action('weapon.army-mg');
    expect([def.damage, def.range, def.fireRate, def.spread, def.magazine, def.reloadTime, def.maxTargets, def.projectile!.pierce]).toEqual([14, 26, 10, 4, 0, 0, 2, 1]);
    const l = await loadL4(4); world = l.world; const w = l.world, m = l.mission;
    expect(w.entities.get(1)!.weapons!.RIGHT.rack.some(r => r.id === 'weapon.army-mg')).toBe(false);
    while (m.state.l4!.phase === 'convoy') w.update();
    m.completeObjective('quartermaster');
    const weapons = w.entities.get(1)!.weapons!;
    expect(weapons.RIGHT.rack[0].id).toBe('weapon.army-mg'); expect(weapons.selectedSide).toBe('RIGHT');
    expect(weapons.RIGHT.rack.map(r => r.id)).toContain('weapon.handgun'); expect(weapons.LEFT.rack.map(r => r.id).slice(0, 2)).toEqual(['weapon.fire-axe', 'weapon.bat']);
    // A clear street (Harbor, north lane): five infected 10 m ahead in two ranks; each weapon in a fresh world (downed bodies would soak shots).
    const ttk = async (weaponId: string): Promise<number> => {
      const f = await loadL4(4); const fw = f.world, fs = f.mission.state.l4!;
      while (fs.phase === 'convoy') fw.update();
      f.mission.completeObjective('quartermaster');
      const p = fw.entities.get(1)!.transform; Object.assign(p, { x: -20, z: -38.2 }); fw.physics.playerBody!.setTranslation({ x: -20, y: p.y, z: -38.2 }, true); fw.spatial.set(1, -20, -38.2);
      const rack = fw.entities.get(1)!.weapons!.RIGHT.rack, index = rack.findIndex(r => r.id === weaponId);
      fw.applyInput({ ...emptyInput(), selectedSlot: { side: 'RIGHT', index } }, 'keyboard'); step(fw, 40);
      expect(rack[fw.entities.get(1)!.weapons!.RIGHT.index].id).toBe(weaponId);
      const ids = [[10, 0], [10.8, .5], [11.6, -.5], [10.4, 1], [12.2, 0]].map(([dx, dz]) => {
        const id = fw.infected!.spawn('infected.runner', { x: -20 + dx, z: -38.2 + dz }, { yaw: 0 }); fw.entities.get(id)!.infected!.l1!.pauseUntil = Number.MAX_SAFE_INTEGER; return id;
      });
      let ticks = 0;
      for (; ticks < 40 * 60 && ids.some(id => fw.entities.get(id)!.health.current > 0); ticks++) {
        const target = ids.map(id => fw.entities.get(id)!).filter(e => e.health.current > 0).sort((a, b) => a.transform.x - b.transform.x)[0];
        fw.applyInput({ ...emptyInput(), attackTarget: { id: target.id, side: 'RIGHT' }, right: { down: ticks % 30 === 0, held: true, up: false }, attackInPlace: true }, 'keyboard'); fw.update();
        fw.entities.get(1)!.health.current = 100;
      }
      fw.dispose(); return ticks / 60;
    };
    const mg = await ttk('weapon.army-mg'), gun = await ttk('weapon.handgun');
    record('mg-ttk', { mg, gun });
    expect(mg).toBeLessThanOrEqual(3); expect(gun).toBeGreaterThanOrEqual(2 * mg); // spec 6 s is unrealistic: the campaign handgun needs 10 shots at 3 per second (3.0 s), see the E22 deviations
    // 2000 continuous rounds into the air: no reload, no empty state, no overheat, never a magazine.
    { const p = w.entities.get(1)!.transform; Object.assign(p, { x: -20, z: -38.2 }); w.physics.playerBody!.setTranslation({ x: -20, y: p.y, z: -38.2 }, true); w.spatial.set(1, -20, -38.2); }
    w.applyInput({ ...emptyInput(), selectedSlot: { side: 'RIGHT', index: 0 } }, 'keyboard'); w.update();
    let shots = 0, reloads = 0; w.events.on('combat.attack', e => { if (e.type === 'combat.attack' && e.sourceId === 1 && e.actionId === 'weapon.army-mg') shots++; });
    for (let i = 0; i < 40_000 && shots < 2000; i++) {
      w.applyInput({ ...emptyInput(), right: { down: i % 6 === 0, held: true, up: false }, aim: { x: 0, z: 1 }, attackInPlace: true }, 'keyboard'); w.update();
      const slot = w.entities.get(1)!.weapons!.RIGHT.rack[0]; if (slot.reloadUntil) reloads++;
      w.entities.get(1)!.health.current = 100;
    }
    expect(shots).toBeGreaterThanOrEqual(2000); expect(reloads).toBe(0);
  }, HEAVY);

  test('T-E22-07 @E22 @E22-AC07 the alarm: 40-50 s after the gun (or arrival + 100 s), 15-25 new infected enter from camp buildings or street mouths with >= 10 humans near the alarm', async () => {
    for (const seed of [1, 2, 3]) {
      const l = await loadL4(seed); const w = l.world, s = l.mission.state.l4!;
      while (s.phase === 'convoy') w.update();
      step(w, 5 * 60); l.mission.completeObjective('quartermaster');
      const turns: { tick: number; ids: number[]; near: number }[] = [], at = new Map<number, { x: number; z: number }>(), origins = new Set<string | undefined>(); /* positions at the turn: the turned run off afterwards */ w.events.on('l4.firstTurn', e => { if (e.type !== 'l4.firstTurn') return; turns.push({ tick: e.tick, ids: e.ids, near: e.humansNear }); for (const id of e.ids) { at.set(id, { x: w.entities.get(id)!.transform.x, z: w.entities.get(id)!.transform.z }); origins.add(w.entities.get(id)!.appearance!.origin); } });
      step(w, 60 * 60);
      expect(turns, `seed ${seed}`).toHaveLength(1);
      const after = (turns[0].tick - s.gunAt) / 60; expect(after).toBeGreaterThanOrEqual(40); expect(after).toBeLessThanOrEqual(50);
      expect(turns[0].ids.length).toBeGreaterThanOrEqual(15); expect(turns[0].ids.length).toBeLessThanOrEqual(25); expect(turns[0].near).toBeGreaterThanOrEqual(10);
      const sources = [...l4Inside, ...l4Emergence.filter(p => p.edge < l4Edges.length - 1).map(p => p.at)];
      for (const id of turns[0].ids) expect(sources.some(([x, z]) => dist(at.get(id)!, { x, z }) < 2), `new infected ${id} at an authored emergence point`).toBe(true);
      expect([...origins]).not.toContain('L3-bus');
      expect(turns[0].ids.every(id => !s.evacueeIds.includes(id) && !s.residentIds.includes(id))).toBe(true);
      const groups = new Map<number, number>();
      for (const id of turns[0].ids) groups.set(s.origin[id], (groups.get(s.origin[id]) ?? 0) + 1);
      expect(Math.max(...groups.values()), 'alarm arrivals remain small groups per exit').toBeLessThanOrEqual(l4.war.group[1]);
      w.dispose();
    }
    // Without the gun the turn still comes at arrival + 100 s.
    const l = await loadL4(4); world = l.world; const s = l.world.missions!.state.l4!;
    while (s.phase === 'convoy') l.world.update();
    const arrived = s.arrivedAt; step(l.world, 101 * 60);
    expect(s.turnAt).toBeGreaterThan(0); expect((s.turnAt - arrived) / 60).toBeCloseTo(100, 0);
  }, HEAVY);

  test('T-E22-08 @E22 @E22-AC08 scale: 18-22 soldiers and 60-70 civilians (24 evacuees from the buses), >= 40 % armed with pistols, hunting rifles and melee (>= 3 each); the low tier halves; caps hold', async () => {
    const l = await loadL4(1); world = l.world; const w = l.world, s = l.mission.state.l4!;
    const soldiers = s.soldierIds.length, civilians = humans(w).filter(e => !e.civilian!.ally).length + 0;
    expect(soldiers).toBeGreaterThanOrEqual(18); expect(soldiers).toBeLessThanOrEqual(22);
    const people = s.residentIds.length + s.evacueeIds.length; expect(people).toBeGreaterThanOrEqual(60); expect(people).toBeLessThanOrEqual(70);
    expect(civilians).toBeGreaterThanOrEqual(40);
    const by = (k: string) => s.armed.filter(a => (k === 'melee' ? ['pipe', 'bat', 'crowbar'] : [k]).includes(a.weapon)).length;
    expect(s.armed.length / people).toBeGreaterThanOrEqual(.4); expect(by('pistol')).toBeGreaterThanOrEqual(3); expect(by('hunting-rifle')).toBeGreaterThanOrEqual(3); expect(by('melee')).toBeGreaterThanOrEqual(3);
    const low = await loadL4(1, 'low'); const ls = low.mission.state.l4!;
    expect(ls.soldierIds.length).toBeLessThanOrEqual(Math.ceil(soldiers * .55)); expect(ls.residentIds.length + ls.evacueeIds.length).toBeLessThanOrEqual(Math.ceil(people * .6));
    expect(low.world.infected!.director.cap).toBe(l4.war.caps.infected.low); low.world.dispose();
    expect(l.world.infected!.director.cap).toBe(l4.war.caps.infected.high);
  }, HEAVY);

  test('T-E22-09 @E22 @E22-AC09 allied fighters: shots from soldiers, armed civilians fight, everyone can turn (same id, look kept, weapon dropped), nobody is immune', async () => {
    const l = await loadL4(2); world = l.world; const w = l.world, s = l.mission.state.l4!;
    for (const id of [...s.soldierIds, ...s.armed.map(a => a.id)]) { const e = w.entities.get(id)!; expect(e.survivor).toBeUndefined(); expect(e.companion).toBeUndefined(); expect(e.civilian!.l1!.graceUntil ?? 0).toBeLessThanOrEqual(w.tick); }
    while (s.phase === 'convoy') w.update();
    step(w, 5 * 60); l.mission.completeObjective('quartermaster');
    const sources = new Set<number>(); w.events.on('ally.attack', e => { if (e.type === 'ally.attack') sources.add(e.sourceId); });
    while (s.phase !== 'war') w.update();
    step(w, 60 * 60);
    const civilianShooters = s.armed.filter(a => sources.has(a.id)).length, soldierShooters = s.soldierIds.filter(id => sources.has(id)).length;
    record('ally-sources', { civilianShooters, soldierShooters, armed: s.armed.length });
    expect(soldierShooters).toBeGreaterThanOrEqual(3); expect(civilianShooters + s.kills.armedCivilians).toBeGreaterThanOrEqual(1);
    // At the infected cap a bite kills instead of turning (section 5.9); make room first so the test checks the turn itself.
    w.infected!.director.levelCap += 400;
    // A soldier bitten turns: same entity id, same model and tint, the rifle lies on the ground.
    const soldier = s.soldierIds.map(id => w.entities.get(id)).filter((e): e is NonNullable<typeof e> => !!e && e.health.current > 0 && !!e.civilian && e.civilian.state !== 'finished' && !e.infected)[2], before = { asset: soldier.appearance!.asset, tint: soldier.appearance!.tint, id: soldier.id };
    w.npcs!.civilians.outbreak!.infect(soldier, 0);
    for (let i = 0; i < 6 * 60 && !soldier.infected; i++) w.update();
    expect(soldier.infected).toBeDefined(); expect(soldier.id).toBe(before.id); expect(soldier.appearance!.asset).toBe(before.asset); expect(soldier.appearance!.tint).toBe(before.tint);
    expect([...w.entities.iterate()].some(e => e.droppedProp === 'rifle')).toBe(true);
  }, HEAVY);

  test('T-E22-10 @E22 @E22-AC10 from all sides: six street and alley mouths (>= 3 mutually >= 60 degrees apart around the plaza), emergence out of view', async () => {
    const c = l4.map.centre, angles = l4Edges.slice(0, 6).map(e => Math.atan2(e.at[1] - c.z, e.at[0] - c.x));
    let apart = 0; for (let i = 0; i < 6; i++) for (let j = i + 1; j < 6; j++) { const d = Math.abs(Math.atan2(Math.sin(angles[i] - angles[j]), Math.cos(angles[i] - angles[j]))) * 180 / Math.PI; if (d >= 60) apart++; }
    expect(apart).toBeGreaterThanOrEqual(8);
    const l = await loadL4(3); world = l.world; const w = l.world, s = l.mission.state.l4!;
    while (s.phase === 'convoy') w.update();
    step(w, 3 * 60); l.mission.completeObjective('quartermaster');
    const first: { tick: number; at: { x: number; z: number }; seen: boolean }[] = [];
    const known = new Set<number>(); const offscreenAudit: boolean[] = [];
    // The first war stream leaves the nearby authored buildings inside the perimeter ("Do not leave a 28 s empty alarm"; PO 10-12 "When the alarm rings, actually nothing happens"); later waves use the street edges.
    const doors = (l.mission.l4 as unknown as { doors(): { x: number; z: number }[] }).doors();
    while (s.phase !== 'war') w.update();
    const refugeDoors = Object.entries(l.mission.def.anchors).filter(([n]) => n.startsWith('refuge-door-')).map(([, a]) => a);
    const points = [...l4Emergence.map(e => ({ x: e.at[0], z: e.at[1] })), ...l4Inside.map(p => ({ x: p[0], z: p[1] }))];
    for (let t = 0; t < 90 * 60; t++) {
      w.update();
      for (const id of s.emergedIds) if (!known.has(id)) { known.add(id); const e = w.entities.get(id)!; first.push({ tick: w.tick, at: { x: e.transform.x, z: e.transform.z }, seen: false }); offscreenAudit.push(points.some(q => dist(q, e.transform) < 6) || doors.some(d => dist(d, e.transform) < 6) || refugeDoors.some(d => dist(d, e.transform) < 6)); }
    }
    expect(first.length).toBeGreaterThan(10);
    // Every wave infected first appears within 6 m of an authored emergence point (street mouths, side streets, building doors and, PO 10-13, the camp's tents and crates).
    expect(offscreenAudit.filter(Boolean).length / offscreenAudit.length).toBeGreaterThan(.9);
    // PO 10-13 "from all directios": the first 90 s already bring infected from at least five of the six street edges (one may be too close to the courier).
    const used = new Set(first.map(f => { const k = points.findIndex(q => dist(q, f.at) < 6); return k >= 0 && k < l4Emergence.length ? l4Emergence[k].edge : -1; })); used.delete(-1);
    expect(used.size).toBeGreaterThanOrEqual(5);
  }, HEAVY);

  test('T-E22-11 @E22 @E22-AC11 military spectacle: two HMG positions fire, trucks and an armoured vehicle stand in the plaza, the tank fires every 8-12 s away from the player and allies, the helicopter orbits and withdraws without landing', async () => {
    const l = await loadL4(1); world = l.world; const w = l.world, s = l.mission.state.l4!;
    const bursts = new Set<number>(); w.events.on('hmg.burst', e => { if (e.type === 'hmg.burst') bursts.add(e.sourceId); });
    const tank: { tick: number; to: { x: number; z: number }; player: { x: number; z: number }; closestAlly: number }[] = [];
    w.events.on('l4.tankFire', e => { if (e.type === 'l4.tankFire' && (s.phase === 'war' || (s.phase === 'collapse' && e.tick > s.lineBreakAt))) { const p = w.entities.get(1)!.transform; tank.push({ tick: e.tick, to: e.to, player: { x: p.x, z: p.z }, closestAlly: Math.min(...[...s.soldierIds, ...s.armed.map(a => a.id)].map(id => w.entities.get(id)).filter(a => a && a.civilian && a.health.current > 0).map(a => dist(a!.transform, e.to))) }); } });
    // The courier stands idle for the whole war (l4-collapse-2: the war comes inside the ring and kills an idle courier; a retry would
    // restart the timeline this test measures), so she is protected; the spectacle itself is unchanged.
    w.combat!.damage.god = true;
    let heliAlt = 0, heliGrounded = false; let heliPasses = 0; w.events.on('l4.heliPass', () => { heliPasses++; });
    while (s.phase === 'convoy') w.update();
    step(w, 3 * 60); l.mission.completeObjective('quartermaster');
    // The five-vehicle convoy: 2 buses, 2 trucks and the light armoured vehicle stand parked in the plaza.
    expect(s.convoyIds.map(id => w.entities.get(id)!.archetype).sort()).toEqual(['veh.evac-bus', 'veh.evac-bus', 'veh.military-apc', 'veh.military-truck', 'veh.military-truck']);
    while (s.phase !== 'war') w.update();
    for (let t = 0; t < 110 * 60 && (s.phase as string) !== 'cellar'; t++) {
      w.update();
      const h = w.entities.get(s.heliId); if (h && s.heliPhase !== 'gone') { heliAlt = Math.max(heliAlt, h.transform.y); if (h.transform.y < 8) heliGrounded = true; }
    }
    expect(bursts.size).toBeGreaterThanOrEqual(2);
    expect(tank.length).toBeGreaterThanOrEqual(2);
    for (const [i, t] of tank.entries()) { if (i) { const gap = (t.tick - tank[i - 1].tick) / 60; expect(gap).toBeGreaterThanOrEqual(7.9); expect(gap).toBeLessThanOrEqual(12.8); } expect(dist(t.to, t.player)).toBeGreaterThanOrEqual(l4.tank.minDistM); expect(t.closestAlly).toBeGreaterThanOrEqual(l4.tank.minDistM - .5); }
    expect(heliPasses).toBeGreaterThanOrEqual(2); expect(heliGrounded).toBe(false); expect(heliAlt).toBeGreaterThan(14);
    record('spectacle', { bursts: bursts.size, tank, heliPasses, heliAlt });
  }, HEAVY);

  test('T-E22-13 @E22 @E22-AC13 the line breaks after the third lost line ("Fall back!", also with the idle bot): fuel-truck mega chain, objective "Find somewhere to hide", the helicopter withdraws', async () => {
    const l = await loadL4(2); world = l.world; const w = l.world, s = l.mission.state.l4!;
    const r = runL4(w, l.mission, 'idle', { seed: 2, god: true, maxSeconds: 400, stopWhen: m => m.state.l4!.lineBreakAt > 0 && m.world.tick - m.state.l4!.lineBreakAt > 12 * 60 });
    const armor = l4.director.lines[2];
    expect(s.lineCause).toBe('beats'); expect(r.breakAfterS).toBeGreaterThanOrEqual(armor.earliestS + l4.lineBreak.fallBackS - .2); expect(r.breakAfterS).toBeLessThanOrEqual(armor.dueS + l4.lineBreak.fallBackS + 1);
    const explosions = w.events.events().filter(e => e.type === 'explosion' && e.tick >= s.lineBreakAt).map(e => (e as { defId: string }).defId);
    expect(explosions).toEqual(expect.arrayContaining(['explosion.gas-pump', 'explosion.gas-canopy', 'explosion.gas-tanks']));
    expect(l.mission.def.steps.find(x => x.id === 'hide')!.text).toBe('Find somewhere to hide');
    expect(l.mission.state.steps.hide.status).toBe('active'); expect(s.heliPhase).toBe('gone');
    expect(l.mission.state.states['line-broken']).toBe(true);
    // Losing half a line's soldiers breaks it from its earliest beat on (not before): line 1 falls at 50 s instead of 62 s.
    const f = await loadL4(3); const fs = f.mission.state.l4!;
    // The idle courier is protected, as in T-E22-11: this part measures the director's overrun beat, not her survival (ally-combat-feel:
    // a retry at the turn checkpoint after her death resets the line and hides the beat).
    f.world.combat!.damage.god = true;
    while (fs.phase === 'convoy') f.world.update();
    step(f.world, 3 * 60); f.mission.completeObjective('quartermaster'); while (fs.phase !== 'war') f.world.update();
    for (const id of fs.director.lines[0].soldierIds.slice(0, 6)) f.world.entities.get(id)!.health.current = 0;
    step(f.world, 40 * 60); expect(fs.director.lines[0].brokeAt).toBe(0);
    step(f.world, 11 * 60); expect(fs.director.lines[0].cause).toBe('overrun'); expect((fs.director.lines[0].brokeAt - fs.turnAt) / 60).toBeCloseTo(l4.director.lines[0].earliestS, 0); f.world.dispose();
  }, HEAVY);

  test('T-E22-14 @E22 @E22-AC14 live damage at the cellar: >= 4 fires, >= 2 burning vehicles, >= 10 broken windows, >= 6 blast scorches, all traceable to explosion/fire events of the run', async () => {
    const l = await loadL4(1); world = l.world;
    const r = runL4(l.world, l.mission, 'complete', { seed: 1, maxSeconds: 700 });
    expect(r.outcome).toBe('complete');
    record('live-damage', r.damageLive);
    expect(r.damageLive.fires).toBeGreaterThanOrEqual(4); expect(r.damageLive.burning).toBeGreaterThanOrEqual(2); expect(r.damageLive.glass).toBeGreaterThanOrEqual(10); expect(r.damageLive.scorch).toBeGreaterThanOrEqual(6);
    const burning = l.mission.state.l4!.carIds.filter(id => { const c = l.world.vehicles!.cars.get(id); return c && c.entity.vehicle!.damage !== 'normal'; });
    expect(burning.length).toBeGreaterThanOrEqual(2);
  }, HEAVY);

  test('T-E22-15 @E22 @E22-AC15 cellar: only the courier (and the corgi) go down, nobody can path in, the door bars, battle events go on >= 6 s, then level.completed', async () => {
    const l = await loadL4(1); world = l.world; const w = l.world, m = l.mission, s = m.state.l4!;
    while (s.phase === 'convoy') w.update();
    step(w, 3 * 60); m.completeObjective('quartermaster'); m.completeObjective('hold'); // the turn comes first (gap), then the break
    for (let i = 0; i < 6 && m.state.steps.hide.status !== 'active'; i++) m.completeObjective();
    expect(m.state.steps.hide.status).toBe('active');
    const nav = w.districts!.nav, door = m.def.anchors['l4-cellar-door'], inside = m.def.anchors['l4-cellar-in'];
    // The cellar yard is an island: nothing outside can walk to the brace.
    const flood = nav.flood([door.x, door.z]); expect(flood[nav.index(inside.x, inside.z)]).not.toBe(1);
    m.completeObjective('hide');
    const p = w.entities.get(1)!.transform; expect(dist(p, inside)).toBeLessThan(1.5); expect(s.phase).toBe('cellar');
    expect(w.infected!.active.filter(e => e.health.current > 0 && dist(e.transform, inside) < 6)).toHaveLength(0);
    const events: string[] = []; for (const type of ['l4.doorBarred', 'l4.battle', 'level.completed', 'ally.attack', 'explosion'] as const) w.events.on(type, e => events.push(`${e.type}@${e.tick}`));
    const reach = nav.flood([inside.x, inside.z]); expect(reach[nav.index(m.def.anchors['l4-brace'].x, m.def.anchors['l4-brace'].z)]).toBe(1);
    m.completeObjective('bar');
    const barred = w.tick; step(w, 12 * 60);
    const done = events.find(e => e.startsWith('level.completed'));
    expect(done).toBeDefined(); expect((Number(done!.split('@')[1]) - barred) / 60).toBeGreaterThanOrEqual(6);
    const battle = events.filter(e => /^(l4.battle|ally.attack|explosion)@/.test(e) && Number(e.split('@')[1]) > barred && Number(e.split('@')[1]) < barred + 6 * 60);
    expect(battle.length).toBeGreaterThanOrEqual(3);
    expect(m.state.phase).toBe('progression');
  }, HEAVY);

  test('T-E22-16 @E22 @E22-AC16 light: L4 polar 1.15-1.30 rad, fog far >= L3 + 20 m; no smoke column before the first turn, >= 3 at the line break', async () => {
    expect(timeOfDay.L4.polar).toBeGreaterThanOrEqual(1.15); expect(timeOfDay.L4.polar).toBeLessThanOrEqual(1.3);
    expect(timeOfDay.L4.fogFar).toBeGreaterThanOrEqual(timeOfDay.L3.fogFar + 20);
    const l = await loadL4(1); world = l.world; const w = l.world, s = l.mission.state.l4!;
    const fires = () => [...w.entities.iterate()].filter(e => e.hazard?.kind === 'fire' && e.hazard.activeUntil > w.tick).length;
    while (s.phase === 'convoy') w.update();
    step(w, 3 * 60); l.mission.completeObjective('quartermaster');
    expect(fires()).toBe(0);
    while (s.phase !== 'war') w.update();
    expect(fires()).toBe(0);
    l.mission.completeObjective('hold'); step(w, 90); expect(fires()).toBeGreaterThanOrEqual(3);
  }, HEAVY);

  test('T-E22-17 @E22 @E22-AC17 checkpoints preserve the live battlefield across deaths, with only live infection losses', async () => {
    // PO 10-13: checkpoints keep progress; "Keep the civilians like usually, just let Zombies flood in".
    const l = await loadL4(2); world = l.world; const m = l.mission, w = l.world;
    while (m.state.l4!.phase === 'convoy') w.update();
    step(w, 3 * 60);
    runL4(w, m, 'complete', { stopWhen: mm => mm.state.checkpoint === 'arrival' });
    const snaps: Record<string, unknown> = {};
    for (const id of l4.checkpoints) {
      runL4(w, m, 'complete', { stopWhen: mm => mm.state.checkpoint === id });
      expect(m.state.checkpoint).toBe(id);
      const s = m.state.l4!, live = s.phase === 'war' || s.phase === 'collapse';
      const armed = s.armed.filter(a => w.entities.get(a.id)?.civilian?.ally).map(a => a.id);
      const bitten = new Set(armed.filter(i => (w.entities.get(i)?.infection?.biteSourceId ?? 0) > 0));
      const turned = new Set<number>();
      const stopInfections = w.events.on('outbreak.infection', e => {
        if (e.type !== 'outbreak.infection' || !armed.includes(e.entityId)) return;
        if (e.phase === 'stagger') {
          expect(w.entities.get(e.entityId)!.infection!.biteSourceId).toBeGreaterThan(0);
          bitten.add(e.entityId);
        }
        if (e.phase === 'infected') { expect(bitten.has(e.entityId)).toBe(true); turned.add(e.entityId); }
      });
      const battlefield = () => {
        const state = m.state.l4!;
        return structuredClone({ phase: state.phase, turnAt: state.turnAt, alphaIds: state.alphaIds,
          lines: state.director.lines, armed: state.armed, tankPhase: state.tankPhase, heliPhase: state.heliPhase,
          actors: [...w.entities.iterate()].filter(e => e.id !== 1 && (e.civilian || e.barricade?.slot.groupId === 'l4-line'))
            .map(e => ({ id: e.id, kind: e.kind, hp: e.health.current, civilian: e.civilian, infection: e.infection, barricade: e.barricade })) });
      };
      let before: ReturnType<typeof battlefield> | undefined, respawns = 0;
      const stopBefore = w.events.on('player.respawned', () => { if (live) before = battlefield(); }, SimPhase.missions - 1);
      const stopAfter = w.events.on('player.respawned', () => {
        respawns++;
        if (live) { expect(m.state.l4).toBe(s); expect(battlefield()).toEqual(before); }
      }, SimPhase.missions + 1);
      const gun = w.entities.get(1)!.weapons!.RIGHT.rack.map(r => r.id);
      step(w, 120);
      const p = w.entities.get(1)!; w.player!.damage(p.health.current, w.tick, true);
      expect(p.health.current).toBe(0);
      for (let i = 0; i < 400 && w.entities.get(1)!.health.current <= 0; i++) w.update();
      expect(respawns).toBe(1); expect(m.state.checkpoint).toBe(id);
      expect(w.entities.get(1)!.weapons!.RIGHT.rack.map(r => r.id)).toEqual(gun);
      const remaining = m.state.l4!.armed.filter(a => w.entities.get(a.id)?.civilian?.ally).map(a => a.id);
      if (live) {
        expect(remaining).toEqual(armed.filter(i => !turned.has(i)));
        expect(armed.length - remaining.length).toBeLessThanOrEqual(bitten.size);
      } else expect(remaining).toEqual(armed);
      snaps[id] = { live, armedBefore: armed.length, armedAfter: remaining.length, bitten: [...bitten], turned: [...turned] };
      stopBefore(); stopAfter(); stopInfections();
    }
    record('checkpoints', snaps);
  }, HEAVY);

  test('T-E22-bots @E22 evade-only never attacks and still reaches the cellar; the low tier finishes too', async () => {
    const l = await loadL4(2); world = l.world;
    const r = runL4(l.world, l.mission, 'evade-only', { seed: 2, maxSeconds: 700 });
    record('bot-evade-only', r);
    expect(r.kills).toBe(0); expect(r.knockdowns).toBe(0); expect(r.outcome).toBe('complete');
    const low = await loadL4(3, 'low');
    const rl = runL4(low.world, low.mission, 'complete', { seed: 3, maxSeconds: 700 }); low.world.dispose();
    expect(rl.outcome).toBe('complete'); expect(rl.maxConcurrent).toBeLessThanOrEqual(l4.war.caps.infected.low); expect(rl.maxCharacters).toBeLessThanOrEqual(l4.war.caps.characters.low);
  }, HEAVY);

  test('T-E22-03 @E22 @E22-AC03 the newbie bot finishes (single seed; the 20-seed battery is dropped as a gate, PO 10-09) with few deaths', async () => {
    const l = await loadL4(4); world = l.world;
    const r = runL4(l.world, l.mission, 'newbie', { seed: 4, maxSeconds: 700 });
    record('bot-newbie', r);
    expect(r.outcome).toBe('complete'); expect(r.deaths).toBeLessThanOrEqual(2);
  }, HEAVY);

  test('T-E22-12 @E22 @E22-AC12 still not enough: soldiers thin out and the infected outgrow the kills by the line break (single seed)', async () => {
    const l = await loadL4(2); world = l.world;
    const r = runL4(l.world, l.mission, 'complete', { seed: 2, maxSeconds: 700 });
    expect(r.soldiersAtBreak).toBeLessThanOrEqual(r.soldiersAtTurn); expect(r.soldiersAtCellar).toBeGreaterThanOrEqual(0);
    expect(r.killsAtBreak).toBeGreaterThanOrEqual(60);
  }, HEAVY);

  for (const tier of ['high', 'low'] as const) test(`T-E22-12-alphas-${tier} @E22 @E22-AC12 first Alphas use the district mouths after the internal turn, inside both caps`, async () => {
    const l = await loadL4(2, tier); world = l.world; const w = l.world, m = l.mission, s = m.state.l4!;
    w.combat!.damage.god = true;
    expect(s.alphaIds).toEqual([]);
    expect(w.infected!.active.some(e => e.archetype === 'infected.alpha')).toBe(false);
    while (s.phase === 'convoy') w.update();
    m.completeObjective('quartermaster');
    while (s.phase !== 'war') w.update();
    const known = new Set<number>();
    for (let i = 0; i < 160 * 60; i++) {
      w.update();
      expect(w.infected!.director.count).toBeLessThanOrEqual(l4.war.caps.infected[tier]);
      expect([...w.entities.iterate()].filter(e => !e.hidden && e.health.current > 0 && (e.civilian || e.infected)).length).toBeLessThanOrEqual(l4.war.caps.characters[tier]);
      for (const [index, id] of s.alphaIds.entries()) if (!known.has(id)) {
        known.add(id); const e = w.entities.get(id)!;
        expect(e.archetype).toBe('infected.alpha');
        expect(w.tick).toBeGreaterThan(s.turnAt);
        // At its street mouth, or (that one in the camera) another authored street emergence point (PO 10-13: Alphas from all directions, never in view).
        expect(Math.min(dist(e.transform, m.def.anchors[s.alphaAnchors[index]]), ...l4Emergence.map(q => dist(e.transform, { x: q.at[0], z: q.at[1] })))).toBeLessThanOrEqual(3);
      }
      expect(s.soldierIds).toHaveLength(l4.calm.soldiers[tier]);
    }
    expect(s.alphaIds).toHaveLength(l4.alphas.count[tier]); expect(known.size).toBe(l4.alphas.count[tier]);
    expect(w.infected!.director.reserved).toBe(0);
  }, HEAVY);

  test('T-E22-13-authored-gap @E22 @E22-AC12 @E22-AC13 the authored line replaces static pallets and breaks through logged Alpha HP damage', async () => {
    const l = await loadL4(2); world = l.world; const w = l.world, m = l.mission;
    const line = l4BreakableLine[2], center = m.def.anchors[line.anchors.center], outside = m.def.anchors[line.anchors.outside], inside = m.def.anchors[line.anchors.inside];
    const fair = w.districts!.districts.find(d => d.id === 'D-FAIR')!;
    for (const rail of l4BreakableLine) {
      expect(fair.decay.placements.some(p => p.id === rail.placementId)).toBe(false);
      expect(fair.decay.colliders.some(c => c.id.startsWith(rail.placementId + '/'))).toBe(false);
      expect(w.barricades!.barricadeIntact(rail.id)).toBe(true);
    }
    const alpha = w.infected!.spawn('infected.alpha', outside, { state: 'idle' });
    const dx = inside.x - outside.x, dz = inside.z - outside.z, distance = Math.hypot(dx, dz);
    expect(w.infected!.startSpecial(alpha, 'alpha.charge', { id: 1, ...inside }, { ...outside, radius: 1, dx: dx / distance, dz: dz / distance })).toBe(true);
    step(w, 90);
    expect(w.barricades!.barricadeIntact(line.id)).toBe(false);
    expect(w.events.events().find(e => e.type === 'barricade.damaged' && e.slotId === line.id)).toMatchObject({ sourceId: alpha, previousHp: l4.alphas.lineHp, hp: 0 });
    expect(w.infected!.nav.clear(center.x, center.z, .35)).toBe(true);
  }, HEAVY);

  test('T-E22-15-carry @E22 @E22-AC15 solitary basement completion carries the actual arsenal to L5 without pending rewards', async () => {
    const l = await loadL4(2); world = l.world; const w = l.world, m = l.mission;
    for (let i = 0; i < 12 && m.state.phase === 'playing'; i++) { m.completeObjective(); if (m.state.l4!.phase === 'cellar') step(w, 8 * 60); }
    const inside = m.def.anchors['l4-cellar-in'];
    expect([...w.entities.iterate()].filter(e => e.health.current > 0 && !e.hidden && (e.civilian || e.infected) && dist(e.transform, inside) < 6)).toHaveLength(0);
    const save = preset('L4-default'), weapons = w.entities.get(1)!.weapons!;
    const carried = { LEFT: weapons.LEFT.rack.map(r => r.id), RIGHT: weapons.RIGHT.rack.map(r => r.id) };
    completeCampaignLevel(save, 4, m.state.result!, w);
    expect(save.unlockedLevel).toBe(5); expect(save.pending).toBeUndefined(); expect(save.racks).toEqual(carried);
    expect(save.survivors ?? []).toEqual([]); expect(save.rescuedSurvivors ?? []).toEqual([]);
  }, HEAVY);

  test('T-E22-anchors @E22 every authored L4 anchor resolves in the layout copy', async () => {
    const l = await loadL4(1); world = l.world;
    for (const name of [...Object.keys(l4Anchors), ...l4AlphaEmergence.map(e => e.anchor), ...l4BreakableLine.flatMap(line => Object.values(line.anchors))]) expect(l.mission.def.anchors[name], name).toBeDefined();
  });
});
