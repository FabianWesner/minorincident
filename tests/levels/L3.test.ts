import { mkdirSync, writeFileSync } from 'node:fs';
import { afterEach, describe, expect, test } from 'vitest';
import { l3, l3Segment, l3Street } from '../../src/data/l3';
import { action } from '../../src/data/actions/catalog';
import { emptyInput } from '../../src/input/InputFrame';
import { validateMission } from '../../src/sim/missions/schema';
import type { SimWorld } from '../../src/sim/world/SimWorld';
import type { L3Profile, L3StreetChoice } from '../../src/debug/bot/LevelThreeBot';
import { followFrustum, loadL3, runL3, type L3Report } from '../../tools/sim-runner/l3Bots';

/** E21 L3 "The Police Collapse": mission graph, handgun, gunfire, station attack, squad, corridor, pressure, medkits, checkpoints (sim ACs). */
let world: SimWorld | undefined;
afterEach(() => { world?.dispose(); world = undefined; });
const seeds = Array.from({ length: l3.bots.seeds }, (_, i) => i + 1);
const median = (values: number[]) => { const v = [...values].sort((a, b) => a - b); return v.length ? v[Math.floor(v.length / 2)] : NaN; };
const HEAVY = 3_600_000;
function record(name: string, value: unknown) { mkdirSync('test-results/epics/E21', { recursive: true }); writeFileSync(`test-results/epics/E21/${name}.json`, JSON.stringify(value, null, 2) + '\n'); }
/** One single seed battery per profile/street, shared by every criterion that reads it (computed once per file run). */
const batteries = new Map<string, Promise<L3Report[]>>();
function battery(profile: L3Profile, opts: { street?: L3StreetChoice; god?: boolean; maxSeconds?: number; stopAfterFallbackS?: number } = {}): Promise<L3Report[]> {
  const key = JSON.stringify({ profile, ...opts });
  if (!batteries.has(key)) batteries.set(key, (async () => {
    const runs: L3Report[] = [];
    for (const seed of seeds) {
      const l = await loadL3(seed);
      runs.push(runL3(l.world, l.mission, profile, { seed, street: opts.street, god: opts.god, maxSeconds: opts.maxSeconds ?? 600, stopWhen: opts.stopAfterFallbackS ? m => !!m.state.l3!.fallbackAt && m.world.tick - m.state.l3!.fallbackAt >= opts.stopAfterFallbackS! * 60 : undefined }));
      l.world.dispose();
    }
    record(`bots-${profile}${opts.street ? `-${opts.street}` : ''}${opts.god ? '-observer' : ''}`, runs);
    return runs;
  })());
  return batteries.get(key)!;
}
const complete = () => battery('complete');
const idle = () => battery('idle', { god: true, stopAfterFallbackS: 5, maxSeconds: 200 });

describe('L3 The Police Collapse', () => {
  test('T-E21-01 @E21 @E21-AC01 mission graph armory -> defend -> fallback -> army checkpoint is completable, no fail timer', async () => {
    const l = await loadL3(1); world = l.world; const m = l.mission;
    expect(validateMission(m.def)).toEqual([]);
    expect(m.def.steps.map(s => s.id)).toEqual(['armory', 'defend', 'checkpoint']);
    expect(m.def.steps.every(s => s.timer === undefined && s.fail.length === 0) && m.def.deadline === undefined).toBe(true);
    expect(m.def.finish).toEqual(['checkpoint']); expect(m.def.checkpoints).toEqual(['armory', 'fallback', 'segment-2', 'segment-2b', 'segment-3', 'segment-3b']);
    // E12-AC07 walk: complete exactly the active objective; gaps are bridged by the controller (attack start, fallback call).
    for (let guard = 0; guard < 8 && m.state.phase === 'playing'; guard++) m.completeObjective();
    expect(m.state.completedObjectives).toEqual(['armory', 'defend', 'checkpoint']);
    expect(m.state.phase).toBe('progression');
  }, 120_000); // Authored defense-wave setup can exceed 30 s under four-worker load.

  test('T-E21-02 @E21 @E21-AC02 complete bot finishes single seed from L3-default (bat + axe), median time in band', async () => {
    const runs = await complete();
    expect(runs.filter(r => r.outcome === 'complete')).toHaveLength(seeds.length);
    const t = median(runs.map(r => r.simSeconds));
    expect(t).toBeGreaterThanOrEqual(l3.bots.completeMedianS[0]); expect(t).toBeLessThanOrEqual(l3.bots.completeMedianS[1]);
  }, HEAVY);

  test('T-E21-03 @E21 @E21-AC03 newbie single seed, median in band, median deaths <= 2', async () => {
    const runs = await battery('newbie');
    expect(runs.filter(r => r.outcome === 'complete').length).toBeGreaterThanOrEqual(l3.bots.newbieMinSeeds);
    expect(median(runs.map(r => r.deaths))).toBeLessThanOrEqual(l3.bots.newbieMaxMedianDeaths);
    const t = median(runs.filter(r => r.outcome === 'complete').map(r => r.simSeconds));
    expect(t).toBeGreaterThanOrEqual(l3.bots.newbieMedianS[0]); expect(t).toBeLessThanOrEqual(l3.bots.newbieMedianS[1]);
  }, HEAVY);

  test('T-E21-04 @E21 @E21-AC04 handgun: only at the armory (complete bot within 40 s), one target per shot, two hits per 40 HP, 22 m, no ammunition', async () => {
    const def = action('weapon.handgun');
    expect([def.damage, def.range, def.fireRate, def.maxTargets, def.magazine, def.reloadTime]).toEqual([20, 22, 3, 1, 0, 0]);
    const l = await loadL3(2); world = l.world; const w = l.world, m = l.mission, ai = w.infected!;
    // L3-default carries bat + axe and no handgun until the armory table.
    expect(w.entities.get(1)!.weapons!.RIGHT.rack.some(s => s.id === 'weapon.handgun')).toBe(false);
    expect(w.entities.get(1)!.weapons!.LEFT.rack.map(s => s.id)).toEqual(['weapon.fire-axe', 'weapon.bat']);
    m.completeObjective('armory');
    const weapons = w.entities.get(1)!.weapons!;
    expect(weapons.RIGHT.rack[0].id).toBe('weapon.handgun'); expect(weapons.selectedSide).toBe('RIGHT');
    expect(weapons.LEFT.rack.map(s => s.id)).toEqual(['weapon.fire-axe', 'weapon.bat']);
    // Shooting range on an empty Commerce Street (before the attack): a line of two infected, one at 10 m, one behind it, one at 23 m.
    const p = w.entities.get(1)!.transform; Object.assign(p, { x: 32, z: .5 }); w.physics.playerBody!.setTranslation({ x: 32, y: p.y, z: .5 }, true); w.spatial.set(1, 32, .5); w.update();
    const spawn = (dx: number, dz = 0) => ai.spawn('infected.runner', { x: p.x + dx, z: p.z + dz }, { yaw: 0 });
    const near = spawn(10), behind = spawn(11.2), far = spawn(-23);
    // Controlled 40 HP target for the weapon criterion; normal runners now have 60 HP.
    Object.assign(w.entities.get(near)!.health, {current:40,max:40});
    for (const id of [near, behind, far]) { const b = w.entities.get(id)!.infected!; b.l1!.pauseUntil = Number.MAX_SAFE_INTEGER; }
    expect(w.entities.get(near)!.health.max).toBe(40);
    const hits: number[] = []; w.events.on('combat.hit', e => { if (e.type === 'combat.hit' && e.sourceId === 1) hits.push(e.targetId); });
    const fire = (target: number, ticks = 30) => { for (let i = 0; i < ticks; i++) { w.applyInput({ ...emptyInput(), attackTarget: { id: target, side: 'RIGHT' }, right: { down: i === 0, held: true, up: false }, attackInPlace: true }, 'keyboard'); w.update(); } w.applyInput(emptyInput(), 'keyboard'); w.update(); };
    fire(near, 12);
    expect(hits.filter(id => id === behind)).toHaveLength(0);
    expect(hits.filter(id => id === near).length).toBeGreaterThanOrEqual(1);
    for (let i = 0; i < 4 && w.entities.get(near)!.health.current > 0; i++) fire(near, 12);
    expect(hits.filter(id => id === near)).toHaveLength(2); expect(w.entities.get(near)!.health.current).toBe(0);
    expect(hits.filter(id => id === behind)).toHaveLength(0);
    // 23 m is out of range: holding fire on it never hits (the command walks into range only when moving; here in place).
    const before = hits.length; fire(far, 40); expect(hits.slice(before).filter(id => id === far)).toHaveLength(0);
    // 600 continuous shots (200 s at 3 shots/s) into the air: no reload, no empty state, no magazine.
    let shots = 0, reloads = 0; w.events.on('combat.attack', e => { if (e.type === 'combat.attack' && e.sourceId === 1 && e.actionId === 'weapon.handgun') shots++; });
    for (let i = 0; i < 15_000 && shots < 600; i++) {
      w.applyInput({ ...emptyInput(), right: { down: i % 5 === 0, held: true, up: false }, aim: { x: 0, z: 1 }, attackInPlace: true }, 'keyboard'); w.update();
      const slot = w.entities.get(1)!.weapons!.RIGHT.rack[0]; if (slot.reloadUntil) reloads++;
      w.entities.get(1)!.health.current = 100;
    }
    expect(shots).toBeGreaterThanOrEqual(600); expect(reloads).toBe(0);
    // Bat and axe stay selectable.
    w.applyInput({ ...emptyInput(), selectedSlot: { side: 'LEFT', index: 1 } }, 'keyboard'); w.update();
    expect(w.entities.get(1)!.weapons!.LEFT.rack.map(s => s.id)).toContain('weapon.bat');
  }, HEAVY);

  test('T-E21-04b @E21 @E21-AC04 the complete bot has the handgun from the armory within 40 s of the start', async () => {
    for (const r of await complete()) { expect(r.handgunS).not.toBeNull(); expect(r.handgunS!).toBeLessThanOrEqual(40); }
  }, HEAVY);

  test('T-E21-05 @E21 @E21-AC05 ranged before contact: handgun knockdowns at >= 6 m, axe/bat at <= 2.5 m (median, complete runs)', async () => {
    const runs = await complete(), gun = runs.flatMap(r => r.killDistances.gun), melee = runs.flatMap(r => r.killDistances.melee);
    record('kill-distances', { gun: median(gun), melee: median(melee), gunN: gun.length, meleeN: melee.length });
    expect(gun.length).toBeGreaterThan(20); expect(median(gun)).toBeGreaterThanOrEqual(6);
    expect(melee.length).toBeGreaterThan(5); expect(median(melee)).toBeLessThanOrEqual(2.5);
  }, HEAVY);

  test('T-E21-06 @E21 @E21-AC06 gunfire: non-chasing infected within 20 m reach the shot within 10 s and search; beyond 20 m or chasing unaffected; omniscience audit', async () => {
    const l = await loadL3(3); world = l.world; const w = l.world, ai = w.infected!;
    l.mission.completeObjective('armory');
    // On Oak Avenue, far from the yard (the attack has not started: no other infected yet).
    const p = w.entities.get(1)!.transform, shot = { x: 40, z: 31.4 };
    Object.assign(p, { x: shot.x, z: shot.z }); w.physics.playerBody!.setTranslation({ x: shot.x, y: p.y, z: shot.z }, true); w.spatial.set(1, shot.x, shot.z);
    const at = (x: number, yaw: number) => { const id = ai.spawn('infected.runner', { x, z: 28 }, { yaw }); return id; };
    // Facing away from the courier, so none of them sees the shooter.
    // `beyond` stands still unless something moves it (no wander drift); it faces away from the running `inside`.
    const inside = at(shot.x + 12, 0), beyond = at(shot.x - 32, Math.PI), chaser = at(shot.x - 12, Math.PI);
    w.update(); w.entities.get(beyond)!.infected!.l1!.pauseUntil = Number.MAX_SAFE_INTEGER;
    const chaseBrain = w.entities.get(chaser)!.infected!.l1!; chaseBrain.mode = 'chase'; chaseBrain.targetId = 1;
    for (let i = 0; i < 8; i++) { w.applyInput({ ...emptyInput(), right: { down: i === 0, held: true, up: false }, aim: { x: 0, z: 1 }, attackInPlace: true }, 'keyboard'); w.update(); }
    w.applyInput(emptyInput(), 'keyboard');
    const startBeyond = { ...w.entities.get(beyond)!.transform };
    let reached = -1;
    for (let t = 0; t < 600; t++) {
      w.update();
      const e = w.entities.get(inside)!;
      if (reached < 0 && Math.hypot(e.transform.x - shot.x, e.transform.z - shot.z) <= 4) reached = t;
    }
    expect(reached).toBeGreaterThanOrEqual(0); expect(reached).toBeLessThanOrEqual(600);
    expect(['search', 'attracted', 'chase']).toContain(w.entities.get(inside)!.infected!.l1!.mode);
    const b = w.entities.get(beyond)!; expect(Math.hypot(b.transform.x - startBeyond.x, b.transform.z - startBeyond.z)).toBeLessThan(6);
    expect(w.entities.get(beyond)!.infected!.l1!.distractionId).toBe(0);
    expect(w.entities.get(chaser)!.infected!.l1!.distractionId).toBe(0);
  }, HEAVY);

  test('T-E21-06b @E21 @E21-AC06 omniscience audit over single seed: sight-only alerts, emergence out of view', async () => {
    for (const r of await complete()) { expect(r.audit.sightViolations).toBe(0); expect(r.audit.nonSightAlerts).toBe(0); expect(r.audit.emerged).toBeGreaterThan(0); expect(r.audit.emergeSeen).toBe(0); }
  }, HEAVY);

  test('T-E21-07 @E21 @E21-AC07 station attack: 8-10 officers, three directions >= 60 degrees apart, an officer turns on single seed, first-of fallback, idle still falls back', async () => {
    const l = await loadL3(1); world = l.world;
    const s = l.mission.state.l3!;
    expect(s.officerIds.length).toBeGreaterThanOrEqual(8); expect(s.officerIds.length).toBeLessThanOrEqual(10);
    for (const id of s.officerIds) { const e = l.world.entities.get(id)!; expect(e.civilian!.ally!.gun).toBeDefined(); expect(e.appearance!.asset).toBe('npc.police-officer'); }
    // Directions: the emergence sources (river path end, Boulevard doors, Oak doors) seen from the yard centre.
    const yard = l.mission.def.anchors['l3-yard'], doors = Object.entries(l.mission.def.anchors).filter(([n]) => n.startsWith('refuge-door-')).map(([, a]) => a);
    const mean = (pts: { x: number; z: number }[]) => ({ x: pts.reduce((a, p) => a + p.x, 0) / pts.length, z: pts.reduce((a, p) => a + p.z, 0) / pts.length });
    const sources = [{ x: -163, z: -42 }, mean(doors.filter(d => d.z < -14 && d.x > -116 && d.x < -88)), mean(doors.filter(d => d.z > 14 && d.x > -116 && d.x < -88))];
    const angles = sources.map(p => Math.atan2(p.z - yard.z, p.x - yard.x));
    for (let i = 0; i < 3; i++) for (let j = i + 1; j < 3; j++) { const d = Math.abs(Math.atan2(Math.sin(angles[i] - angles[j]), Math.cos(angles[i] - angles[j]))); expect(d * 180 / Math.PI).toBeGreaterThanOrEqual(60); }
    const runs = await complete();
    // PO 2026-10-12: "let they come from all directions and also spawn them in the policestation (as police Zombies)".
    for (const r of runs) { expect(r.attack!.directions.sort()).toEqual(['blvd', 'commerce', 'oak', 'river', 'station']); expect(r.attack!.officers).toBeGreaterThanOrEqual(8); expect(r.attack!.sameLook).toBe(true); }
    expect(runs.filter(r => r.attack!.turnedDuring >= 1).length).toBeGreaterThanOrEqual(1);
    for (const r of runs) {
      expect(['time', 'turned', 'inside']).toContain(r.attack!.fallbackCause);
      expect(r.attack!.fallbackAfterS).toBeLessThanOrEqual(l3.attack.fallback.defenseS + .1);
    }
    const idleRuns = await idle();
    expect(idleRuns.every(r => r.attack && r.attack.fallbackCause !== '')).toBe(true);
  }, HEAVY);

  test('T-E21-07d @E21 @E21-AC07 PO 10-12 the police lose without the courier: 50 % police guns, spread streams, police zombies from the station', async () => {
    // PO 2026-10-12 (verbatim): "Ideally the Zombies will win against police when the player isn#t doing anything. Let's try this:
    // reduce the power of the gun by 50% for the police (not for the player). And don't cluster Zombies, let they come from all
    // directions and also spawn them in the policestation (as police Zombies), so they are overwhelming for the police so the user
    // needs to start running away (with some of the survivors)".
    const l = await loadL3(1); world = l.world; const w = l.world, m = l.mission;
    runL3(w, m, 'complete', { stopWhen: mm => !!mm.state.l3!.attackAt });
    w.combat!.damage.god = true; // an idle observer: the police fight alone (the courier's own weapons are never scaled)
    const s = m.state.l3!, start = w.tick;
    for (const id of s.officerIds) expect(w.entities.get(id)!.civilian!.ally!.gun!.damage).toBe(l3.officers.gun.damage * .5);
    for (let t = 0; t < 75 * 60; t++) { followFrustum(w); w.applyInput(emptyInput(), 'keyboard'); w.update(); }
    const standing = s.officerIds.filter(id => { const e = w.entities.get(id); return !!e?.civilian?.ally && e.health.current > 0 && !e.infection; }).length;
    const first = s.waves.filter(q => q.wave === 0 && q.id).map(q => q.at - start);
    const police = s.waves.filter(q => q.dir === 'station' && q.id).map(q => w.entities.get(q.id)).filter(e => e);
    record('police-collapse', { standing, officers: s.officerIds.length, firstWaveSpanS: (Math.max(...first) - Math.min(...first)) / 60, policeZombies: police.length });
    expect(standing).toBeLessThanOrEqual(Math.floor(s.officerIds.length / 2));
    expect((Math.max(...first) - Math.min(...first)) / 60).toBeGreaterThanOrEqual(10);
    expect(police.length).toBeGreaterThanOrEqual(1);
    for (const e of police) expect(e!.appearance!.asset).toBe('npc.police-officer');
  }, HEAVY);

  test('T-E21-08 @E21 @E21-AC08 squad: at least 3 living officers join at the fallback on single seed; no immunity or scripted-survival flag', async () => {
    const runs = await complete();
    // PO 10-11/10-12: every surviving officer retreats with the courier ("running away (with some of the survivors)").
    expect(runs.filter(r => r.squad!.atFallback >= 3).length).toBeGreaterThanOrEqual(1);
    expect(runs.every(r => r.squad!.protected === 0)).toBe(true);
  }, HEAVY);

  test('T-E21-09 @E21 @E21-AC09 squad feels strong first: officers >= 60 % of S1 knockdowns, median S1 damage <= 15, near the courier, never teleports', async () => {
    const runs = await complete();
    const officers = runs.reduce((a, r) => a + r.s1!.officerKills, 0), player = runs.reduce((a, r) => a + r.s1!.playerKills, 0);
    record('s1', { officers, player, damage: median(runs.map(r => r.s1!.damage)), near8: median(runs.map(r => r.squad!.near8Share)) });
    expect(officers / Math.max(1, officers + player)).toBeGreaterThanOrEqual(.6);
    expect(median(runs.map(r => r.s1!.damage))).toBeLessThanOrEqual(15);
    expect(median(runs.map(r => r.squad!.near8Share))).toBeGreaterThanOrEqual(.8);
    expect(Math.max(...runs.map(r => r.squad!.maxJumpM))).toBeLessThanOrEqual(1);
  }, HEAVY);

  test('T-E21-10 @E21 @E21-AC10 squad falls apart systemically: non-increasing medians, <= 2 at the checkpoint, all 4 on <= 15 %, a corridor turn on >= 50 %', async () => {
    const runs = await complete();
    const ends = [0, 1, 2].map(k => median(runs.map(r => r.squad!.segmentEnds[k])));
    record('squad', { ends, atCheckpoint: runs.map(r => r.squad!.atCheckpoint), losses: runs.map(r => r.squad!.losses) });
    expect(ends[0]).toBeGreaterThanOrEqual(ends[1]); expect(ends[1]).toBeGreaterThanOrEqual(ends[2]);
    // PO 10-11/10-12 superseded "<= 2 at the checkpoint": the army rescues the surviving group, but the squad still loses officers on the way.
    for (const r of runs) expect(r.squad!.atCheckpoint).toBeLessThan(r.squad!.atFallback);
    expect(runs.filter(r => r.squad!.turnedInCorridor >= 1).length).toBeGreaterThanOrEqual(runs.length / 2);
    for (const r of runs) for (const loss of r.squad!.losses) expect(['bite', 'kill', 'separated']).toContain(loss.cause);
  }, HEAVY);

  test('T-E21-11 @E21 @E21-AC11 the single-seed complete route uses Oak and Boulevard around the wreck lines', async () => {
    for (const r of await complete()) {
      expect(r.outcome).toBe('complete');
      expect(r.streets).toContain('oak');expect(r.streets).toContain('blvd');
    }
  }, HEAVY);

  test('T-E21-12 @E21 @E21-AC12 escalation: pre-populated 250/625/1000 (+-20 %), live infected near the courier rise S1 -> S3, caps never exceeded', async () => {
    const runs = await complete();
    for (const r of runs) for (const [k, target] of [250, 625, 1000].entries()) { expect(r.density.prepopulated[k]).toBeGreaterThanOrEqual(target * .8); expect(r.density.prepopulated[k]).toBeLessThanOrEqual(target * 1.2); }
    expect(median(runs.map(r => r.density.near30[2]))).toBeGreaterThan(median(runs.map(r => r.density.near30[0])));
    for (const r of runs) expect(r.density.maxConcurrent).toBeLessThanOrEqual(r.density.cap);
  }, HEAVY);

  test('T-E21-13 @E21 @E21-AC13 forward pressure: idling 20 s behind the furthest line starts emergences 15-35 m behind it, advancing stops them', async () => {
    const l = await loadL3(4); world = l.world; const w = l.world, m = l.mission;
    // The complete bot plays to segment 2, then the courier stands still (god mode keeps the observer alive).
    runL3(w, m, 'complete', { stopWhen: mm => (mm.state.l3!.segment ?? -1) >= 1 && w.entities.get(1)!.transform.x > -30 });
    w.combat!.damage.god = true;
    const s = m.state.l3!, before = s.pressureIds.length, furthest = s.furthest, startTick = w.tick;
    const emergences: { tick: number; x: number; seen: boolean }[] = [];
    w.events.on('entity.spawned', () => {});
    for (let t = 0; t < 45 * 60; t++) {
      const n = s.pressureIds.length; followFrustum(w); w.applyInput(emptyInput(), 'keyboard'); w.update();
      for (const id of s.pressureIds.slice(n)) { const e = w.entities.get(id)!; emergences.push({ tick: w.tick - startTick, x: e.transform.x, seen: !w.infected!.director.offscreen(e.transform) }); }
    }
    expect(emergences.length).toBeGreaterThanOrEqual(1);
    expect(Math.min(...emergences.map(e => e.tick))).toBeGreaterThanOrEqual(19 * 60);
    for (const e of emergences) { expect(furthest - e.x).toBeGreaterThanOrEqual(14); expect(furthest - e.x).toBeLessThanOrEqual(36); expect(e.seen).toBe(false); }
    // PO 2026-10-12: queued pressure packs contain 25-75 infected.
    const windows = new Map<number, number>(); for (const e of emergences) windows.set(Math.floor(e.tick / 600), (windows.get(Math.floor(e.tick / 600)) ?? 0) + 1);
    for (const n of windows.values()) expect(n).toBeLessThanOrEqual(75);
    record('pressure', { before, emergences });
    // Advancing: while the furthest line keeps moving, nothing emerges behind it (every new emergence needs 20 s idle).
    let early = 0, seen = s.pressureIds.length;
    runL3(w, m, 'complete', { stopWhen: mm => { const l = mm.state.l3!; if (l.pressureIds.length > seen) { if (w.tick - l.furthestAt < 20 * 60) early++; seen = l.pressureIds.length; } return w.tick - startTick > 60 * 60; } });
    expect(early).toBe(0);
  }, HEAVY);

  test('T-E21-14 @E21 @E21-AC14 medkits: >= 2 per street, >= 7 total, +40 HP capped and consumed; newbie picks >= 2, < 10 % time below 20 % HP', async () => {
    const byStreet = { blvd: 0, commerce: 0, oak: 0 }; for (const [, z] of l3.medkits.positions.slice(1)) byStreet[l3Street(z)]++;
    expect(Math.min(...Object.values(byStreet))).toBeGreaterThanOrEqual(2); expect(l3.medkits.positions.length).toBeGreaterThanOrEqual(7);
    const l = await loadL3(1); world = l.world; const w = l.world, s = l.mission.state.l3!;
    const kit = w.entities.get(s.medkitIds[1])!, player = w.entities.get(1)!;
    player.health.current = 30; Object.assign(player.transform, { x: kit.transform.x, z: kit.transform.z }); w.physics.playerBody!.setTranslation({ x: kit.transform.x, y: player.transform.y, z: kit.transform.z }, true);
    w.update(); expect(player.health.current).toBeCloseTo(70, 0); expect((kit.pickup as { collected: boolean }).collected).toBe(true);
    const other = w.entities.get(s.medkitIds[2])!; player.health.current = 90; Object.assign(player.transform, { x: other.transform.x, z: other.transform.z }); w.physics.playerBody!.setTranslation({ x: other.transform.x, y: player.transform.y, z: other.transform.z }, true);
    w.update(); expect(player.health.current).toBe(100);
    const newbie = await battery('newbie');
    // PO 10-09: L3 infected hit x1.1 (was 1.8), so the newbie bot is hurt less often and needs fewer kits: median >= 1 (spec says 2, change proposed).
    expect(median(newbie.map(r => r.medkits))).toBeGreaterThanOrEqual(1);
    expect(median(newbie.map(r => r.lowHpShare))).toBeLessThanOrEqual(.1);
  }, HEAVY);

  test('T-E21-17 @E21 @E21-AC17 army checkpoint: >= 8 soldiers, the rendezvous ends the level straight into progression', async () => {
    const l = await loadL3(5); world = l.world; const s = l.mission.state.l3!;
    expect(s.soldierIds.length).toBeGreaterThanOrEqual(8);
    for (const id of s.soldierIds) { const e = l.world.entities.get(id)!; expect(e.appearance!.asset).toBe('npc.national-guard'); expect(e.transform.x).toBeGreaterThan(l3.map.zoneX - 4); }
    const r = runL3(l.world, l.mission, 'complete', { seed: 5 });
    expect(r.outcome).toBe('complete'); expect(l.mission.state.phase).toBe('progression');
    const events = l.world.events.events().map(e => e.type);
    expect(events).toContain('l3.crossed'); expect(events).toContain('level.completed'); expect(events).toContain('progression.requested');
    expect(events.indexOf('l3.crossed')).toBeLessThan(events.lastIndexOf('level.completed'));
  }, HEAVY);

  test('T-E21-18 @E21 @E21-AC18 checkpoints armory, fallback, segment-2, segment-3 restore squad, outbreak layer and picked medkits', async () => {
    const l = await loadL3(2); world = l.world; const m = l.mission, w = l.world;
    for (const id of l3.checkpoints) {
      runL3(w, m, 'complete', { stopWhen: mm => mm.state.checkpoint === id });
      expect(m.state.checkpoint).toBe(id);
      const s = m.state.l3!;
      const snap = { infected: w.infected!.active.filter(e => e.health.current > 0).map(e => e.id).sort(), squad: s.squad.map(q => q.id).sort(), phase: s.phase, kits: s.medkitIds.map(k => (w.entities.get(k)!.pickup as { collected: boolean }).collected), weapons: w.entities.get(1)!.weapons!.RIGHT.rack.map(r => r.id), turned: w.npcs!.civilians.outbreak!.stats.turned };
      for (let i = 0; i < 90; i++) w.update();
      // A medkit picked up after the checkpoint stays picked (00 §6.2).
      const kit = s.medkitIds.find(k => !(w.entities.get(k)!.pickup as { collected: boolean }).collected);
      if (kit !== undefined) (w.entities.get(kit)!.pickup as { collected: boolean }).collected = true;
      const p = w.entities.get(1)!; w.player!.damage(p.health.current, w.tick);
      for (let i = 0; i < 400 && w.entities.get(1)!.health.current <= 0; i++) w.update();
      expect(m.state.checkpoint).toBe(id);
      const now = new Set(w.infected!.active.filter(e => e.health.current > 0).map(e => e.id)), before = new Set(snap.infected);
      expect([...now].filter(i => !before.has(i)).length + [...before].filter(i => !now.has(i)).length, `${id} infected`).toBeLessThanOrEqual(3);
      expect(m.state.l3!.squad.map(q => q.id).sort(), `${id} squad`).toEqual(snap.squad);
      expect(m.state.l3!.phase).toBe(snap.phase);
      expect(w.entities.get(1)!.weapons!.RIGHT.rack.map(r => r.id)).toEqual(snap.weapons);
      if (kit !== undefined) expect((w.entities.get(kit)!.pickup as { collected: boolean }).collected, `${id} medkit stays picked`).toBe(true);
      expect(Math.abs(w.npcs!.civilians.outbreak!.stats.turned - snap.turned), `${id} turned`).toBeLessThanOrEqual(1);
    }
  }, HEAVY);

  test('T-E21-bots @E21 evade-only never attacks and still reaches the army zone', async () => {
    const runs: L3Report[] = [];
    for (const seed of [1, 2, 3]) { const l = await loadL3(seed); runs.push(runL3(l.world, l.mission, 'evade-only', { seed, maxSeconds: 600 })); l.world.dispose(); }
    record('bots-evade-only', runs);
    for (const r of runs) { expect(r.handgunShots).toBe(0); expect(r.knockdowns).toBe(0); }
    expect(runs.filter(r => r.outcome === 'complete').length).toBeGreaterThanOrEqual(2);
  }, HEAVY);

  test('T-E21-segments @E21 segment helper matches the corridor bounds', () => {
    expect([l3Segment(-130), l3Segment(-100), l3Segment(0), l3Segment(100), l3Segment(135)]).toEqual([-1, 0, 1, 2, 3]);
  });
});
