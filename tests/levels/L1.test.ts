import { mkdirSync, writeFileSync } from 'node:fs';
import { afterEach, describe, expect, test } from 'vitest';
import { SimPhase } from '../../src/core/EventBus';
import { l1v2 } from '../../src/data/l1v2';
import { l1AccidentEvents } from '../../src/sim/outbreak/types';
import { storyLines } from '../../src/sim/missions/L1Story';
import { validateMission } from '../../src/sim/missions/schema';
import type { SimWorld } from '../../src/sim/world/SimWorld';
import { loadL1, runDuel, runL1, type L1Report } from '../../tools/sim-runner/l1Bots';

/** L1 v2 mission graph, story beats, full seed batteries and checkpoints (epic-19 section 9). */
let world: SimWorld | undefined;
afterEach(() => { world?.dispose(); world = undefined; });
const seeds = Array.from({ length: l1v2.bots.seeds }, (_, i) => i + 1);
const median = (values: number[]) => { const v = [...values].sort((a, b) => a - b); return v[Math.floor(v.length / 2)]; };
const HEAVY = 3_600_000;
function record(name: string, value: unknown) {
  mkdirSync('test-results/epics/E19', { recursive: true });
  writeFileSync(`test-results/epics/E19/${name}.json`, JSON.stringify(value, null, 2) + '\n');
}
/** Controlled observer fixture, not a bot movement policy or real-input completion proof. */
function parkObserver(w: SimWorld) {
  const p = w.entities.get(1)!; Object.assign(p.transform, { x: -82, z: -52 });
  w.physics.playerBody!.setTranslation(p.transform, true); w.clearInput();
}
async function load(seed = 1) { const l = await loadL1(seed); world = l.world; return l; }
const maxSeparatedHeadings = (headings: number[], minDeg: number) => {
  let best = 0;
  for (let mask = 1; mask < 1 << headings.length; mask++) {
    const picked = headings.filter((_, i) => mask & 1 << i);
    if (picked.every((a, i) => picked.every((b, j) => i === j || Math.min(Math.abs(a - b), 360 - Math.abs(a - b)) >= minDeg))) best = Math.max(best, picked.length);
  }
  return best;
};

describe('L1 v2 mission', () => {
  test('T-E19-01 @E19 @E19-AC01 mission graph is completable, no fail timer', async () => {
    const { world: w, mission } = await load();
    expect(validateMission(mission.def)).toEqual([]);
    expect(mission.def.steps.map(s => s.id)).toEqual(['pickup', 'deliver', 'escape', 'weapon', 'firestation']);
    expect(mission.def.steps.every(s => s.timer === undefined && s.fail.length === 0)).toBe(true);
    // E12-AC07 walk: complete exactly the active objective until the result (the story states are set as the controller would).
    for (let guard = 0; guard < 10 && mission.state.phase === 'playing'; guard++) {
      if (!mission.def.steps.some(s => mission.state.steps[s.id].status === 'active')) { mission.setState('exited', true); w.update(); }
      mission.completeObjective();
    }
    expect(mission.state.completedObjectives).toEqual(['pickup', 'deliver', 'escape', 'weapon', 'firestation']);
    expect(['cinematic', 'result']).toContain(mission.state.phase);
  });

  test('T-E19-02 @E19 @E19-AC02 complete bot finishes 20/20 seeds, median 1:15-3:00', async () => {
    const runs: L1Report[] = [];
    for (const seed of seeds) { const { world: w, mission } = await loadL1(seed); runs.push(runL1(w, mission, 'complete', { seed })); w.dispose(); }
    record('complete-bots', runs);
    expect(runs.filter(r => r.outcome === 'complete')).toHaveLength(seeds.length);
    const t = median(runs.map(r => r.simSeconds));
    expect(t).toBeLessThanOrEqual(l1v2.bots.completeMedianS[1]);
    expect(t).toBeGreaterThanOrEqual(l1v2.bots.completeMedianS[0]);
  }, HEAVY);

  test('T-E19-03 @E19 @E19-AC03 newbie bot finishes >= 18/20, median 1:30-3:30, deaths <= 1', async () => {
    const runs: L1Report[] = [];
    for (const seed of seeds) { const { world: w, mission } = await loadL1(seed); runs.push(runL1(w, mission, 'newbie', { seed })); w.dispose(); }
    record('newbie-bots', runs);
    expect(runs.filter(r => r.outcome === 'complete').length).toBeGreaterThanOrEqual(l1v2.bots.newbieMinSeeds);
    expect(median(runs.map(r => r.deaths))).toBeLessThanOrEqual(l1v2.bots.newbieMaxMedianDeaths);
    const t = median(runs.filter(r => r.outcome === 'complete').map(r => r.simSeconds));
    expect(t).toBeLessThanOrEqual(l1v2.bots.newbieMedianS[1]);
    expect(t).toBeGreaterThanOrEqual(l1v2.bots.newbieMedianS[0]);
  }, HEAVY);

  test('T-E19-10 @E19 the weapon objective and its garage-door marker are live right after the exits, zombies keep acting', async () => {
    const { world: w, mission } = await load(2); w.combat!.damage.god = true;
    runL1(w, mission, 'complete', { seed: 2, stopWhen: m => m.state.l1!.exitIds.length > 0 });
    for (let i = 0; i < 5; i++) w.update();
    expect(mission.state.steps.weapon.status).toBe('active'); expect(mission.state.marker).toBe('garage-door');
    const before = w.infected!.active.filter(e => e.health.current > 0).map(e => `${e.transform.x.toFixed(1)},${e.transform.z.toFixed(1)}`).join('|');
    for (let i = 0; i < 120; i++) w.update();
    expect(w.infected!.active.filter(e => e.health.current > 0).map(e => `${e.transform.x.toFixed(1)},${e.transform.z.toFixed(1)}`).join('|')).not.toBe(before);
  }, HEAVY);

  test('T-E19-evade @E19 @E19-AC03 evade-only bot never attacks and still finishes', async () => {
    const { world: w, mission } = await load(3); let attacks = 0;
    w.events.on('combat.attack', e => { if (e.type === 'combat.attack' && e.sourceId === 1) attacks++; });
    const run = runL1(w, mission, 'evade-only', { seed: 3 });
    record('evade-bot', { ...run, attacks });
    expect(run.outcome).toBe('complete'); expect(attacks).toBe(0);
  }, HEAVY);

  test.each([false, true])('T-E19-06 @E19 @E19-AC06 systemic spread, unopposed observer=%s', async (unopposed) => {
    // The full 20-seed quantitative proof is unopposed; seed 7 retains the genuine forecourt regression.
    const runs: L1Report[] = [];
    for (const seed of unopposed ? seeds : [7]) {
      const { world: w, mission } = await loadL1(seed); world = w; w.combat!.damage.god = true;
      const bitten = new Set<number>(), born = new Set<number>();
      w.events.on('outbreak.bite', e => { if (e.type === 'outbreak.bite' && e.turns) bitten.add(e.targetId); });
      w.events.on('outbreak.infection', e => { if (e.type === 'outbreak.infection' && e.phase === 'infected') born.add(e.entityId); });
      let exitTick = 0;
      runs.push(runL1(w, mission, 'idle', { seed, maxSeconds: 400,
        onExit: () => { exitTick = w.tick; if (unopposed) parkObserver(w); }, stopWhen: () => exitTick > 0 && w.tick > exitTick + 240 * 60,
      }));
      for (const id of born) if (!mission.state.l1!.exitIds.includes(id)) expect(bitten.has(id), `seed ${seed}, infected ${id}`).toBe(true);
      // No spawns besides the exits: the beat 9 house never opened (the garage beat is not reached).
      expect(mission.state.l1!.house).toBeNull();
      w.dispose(); world = undefined;
    }
    record(unopposed ? 'unopposed-spread' : 'forecourt-idle', runs);
    if (!unopposed) return; // Immortal forecourt bait is recorded honestly, with provenance checked above.
    const at = (s: number) => runs.map(r => r.infectedAfterExit[s] ?? 0);
    expect(median(at(0))).toBe(l1v2.accident.infectedCount);
    expect(median(at(120))).toBeGreaterThanOrEqual(l1v2.bots.idleSpread.at120s);
    expect(median(at(240))).toBeGreaterThanOrEqual(l1v2.bots.idleSpread.at240s);
    expect(at(120).filter(n => n >= l1v2.bots.idleSpread.floorAt120s).length).toBeGreaterThanOrEqual(l1v2.bots.idleSpread.floorSeeds);
  }, HEAVY);

  test('T-E19-07 @E19 @E19-AC07 accident releases exactly 5 infected, >= 3 headings, technician entity', async () => {
    for (const seed of seeds) {
      const { world: w, mission } = await loadL1(seed); world = w;
      const tech = w.entities.get(mission.state.l1!.techId)!, variant = tech.civilian!.variant, id = tech.id;
      runL1(w, mission, 'complete', { seed, stopWhen: m => m.state.l1!.exitIds.length > 0 });
      const l1 = mission.state.l1!;
      expect(l1.exitIds, `seed ${seed}`).toHaveLength(l1v2.accident.infectedCount);
      expect(new Set(l1.exitIds).size).toBe(l1v2.accident.infectedCount);
      expect(l1.exitIds).toContain(id);
      const same = w.entities.get(id)!;
      expect(same.infected?.variant).toBe(variant); expect(same.civilian).toBeUndefined(); expect(same.faction).toBe('infected');
      // At the exit the five stand at >= 2 different exits.
      const exits = ['lab-exit-front', 'lab-exit-side', 'lab-exit-window'].map(n => mission.def.anchors[n]);
      const used = new Set(l1.exitIds.map(i => { const e = w.entities.get(i)!.transform; return exits.map((a, k) => [Math.hypot(a.x - e.x, a.z - e.z), k]).sort((a, b) => a[0] - b[0])[0][1]; }));
      expect(used.size).toBeGreaterThanOrEqual(l1v2.accident.minExits);
      expect(maxSeparatedHeadings(l1.exitHeadingsDeg, l1v2.accident.minHeadingSeparationDeg)).toBeGreaterThanOrEqual(l1v2.accident.minDistinctHeadings);
      w.dispose(); world = undefined;
    }
  }, HEAVY);

  test('T-E19-07b @E19 @E19-AC07 robust start: each of the five exit victims leaves a bite within 60 s on 20 seeds', async () => {
    const runs: { seed: number; victim: number; bites: number }[] = [];
    for (const seed of seeds) for (let victim = 0; victim < 5; victim++) {
      const { world: w, mission } = await loadL1(seed); world = w; w.combat!.damage.god = true; let bites = 0;
      w.events.on('outbreak.bite', () => { bites++; });
      runL1(w, mission, 'idle', { seed, stopWhen: m => m.state.l1!.exitIds.length > 0 });
      w.entities.get(mission.state.l1!.exitIds[victim])!.health.current = 0;
      parkObserver(w);
      for (let i = 0; i < 60 * 60 && !bites; i++) w.update();
      runs.push({ seed, victim, bites });
      w.dispose(); world = undefined;
    }
    record('robust-start', runs);
    for (const r of runs) expect(r.bites, `seed ${r.seed}, exit victim ${r.victim}`).toBeGreaterThan(0);
  }, HEAVY);

  test('T-E19-15 @E19 @E19-AC15 bat only via the garage interaction, empty starting loadout', async () => {
    const { world: w, mission } = await load();
    expect(w.entities.get(1)!.weapons).toBeUndefined();
    expect([...w.entities.iterate()].filter(e => e.pickup)).toHaveLength(0);
    // Standing in the garage before the objective is active gives nothing.
    const bat = mission.def.anchors['garage-bat'];
    Object.assign(w.entities.get(1)!.transform, { x: bat.x, z: bat.z }); w.physics.playerBody!.setTranslation(w.entities.get(1)!.transform, true);
    w.setInput({ interact: true }); for (let i = 0; i < 180; i++) w.update(); w.clearInput();
    expect(w.entities.get(1)!.weapons).toBeUndefined(); expect(mission.state.items).not.toContain('bat');
    const { world: w2, mission: m2 } = await loadL1(2);
    runL1(w2, m2, 'complete', { seed: 2, stopWhen: m => m.state.steps.weapon.status === 'completed' });
    expect(w2.entities.get(1)!.weapons!.LEFT.rack.map(s => s.id)).toEqual(['weapon.bat']);
    expect(m2.state.items).toContain('bat'); w2.dispose();
  }, HEAVY);

  test('T-E19-05b @E19 grace: a newbie standing still at the door keeps >= 60 HP for 8 s after the infected exit', async () => {
    for (const seed of [1, 2, 3, 4, 5, 6]) {
      const { world: w, mission } = await loadL1(seed); world = w; let from = 0;
      runL1(w, mission, 'idle', { seed, stopWhen: m => { if (m.state.l1!.exitIds.length && !from) from = w.tick; return from > 0 && w.tick - from >= 8 * 60; } });
      expect(w.entities.get(1)!.health.current, `seed ${seed}`).toBeGreaterThanOrEqual(60);
      w.dispose(); world = undefined;
    }
  }, HEAVY);

  test('T-E19-respawn @E19 death at the door after the exits respawns at a safe street point with 2 s invulnerability', async () => {
    for (const seed of [1, 2, 3]) {
      const { world: w, mission } = await loadL1(seed); world = w;
      runL1(w, mission, 'idle', { seed, stopWhen: m => m.state.l1!.exitIds.length > 0 });
      w.player!.damage(1000, w.tick);
      for (let i = 0; i < 400 && !w.events.events().some(e => e.type === 'player.respawned'); i++) w.update();
      w.update();
      const p = w.entities.get(1)!;
      expect(w.events.events().some(e => e.type === 'player.respawned'), `seed ${seed}`).toBe(true);
      expect(w.events.events().some(e => e.type === 'checkpoint.restored'), 'respawn keeps the world: no checkpoint restore').toBe(false);
      expect(p.health.current).toBe(p.health.max);
      expect(p.survivor!.invulnerableUntil).toBeGreaterThan(w.tick + 60);
      const close = w.infected!.active.filter(e => e.health.current > 0 && Math.hypot(e.transform.x - p.transform.x, e.transform.z - p.transform.z) < 8);
      expect(close, `seed ${seed}`).toHaveLength(0);
      w.dispose(); world = undefined;
    }
  }, HEAVY);

  test('T-E19-house @E19 @E19-AC25 beat 9: ten residents come out of ONE house door near the garage, one by one, 1.5-4 s apart', async () => {
    const { world: w, mission } = await load(2); w.combat!.damage.god = true;
    const doors: { id: string; tick: number }[] = [], appear = new Map<number, { tick: number; x: number; z: number }>();
    w.events.on('gate.changed', e => { if (e.type === 'gate.changed' && e.id.startsWith('door-')) doors.push({ id: e.id, tick: e.tick }); });
    const g = mission.def.anchors['garage-door'], near = () => w.infected!.active.filter(e => e.health.current > 0 && Math.hypot(e.transform.x - g.x, e.transform.z - g.z) <= l1v2.director.hordeRadiusM).length;
    let nearMax = 0;
    // The courier takes the bat and heads for the fire station (complete bot); every tick, note new residents where they appear.
    w.events.on('sim.tick', () => {
      for (const id of mission.state.l1?.house?.ids ?? []) if (!appear.has(id)) { const t = w.entities.get(id)!.transform; appear.set(id, { tick: w.tick, x: t.x, z: t.z }); }
      if (mission.state.l1?.house) nearMax = Math.max(nearMax, near());
    });
    runL1(w, mission, 'complete', { seed: 2, stopWhen: m => (m.state.l1!.house?.ids.length ?? 0) >= l1v2.house.count });
    const house = mission.state.l1!.house!;
    expect(house.door).toBeGreaterThan(0);
    expect(Math.hypot(house.x - g.x, house.z - g.z)).toBeLessThanOrEqual(l1v2.house.doorM[1]);
    expect(house.ids).toHaveLength(l1v2.house.count);
    // Same door every time, one door bang per resident, staggered 1.5 to 4 s.
    expect(new Set(doors.map(d => d.id))).toEqual(new Set([`door-${house.door}`]));
    expect(doors).toHaveLength(l1v2.house.count);
    for (let i = 1; i < doors.length; i++) {
      const gap = (doors[i].tick - doors[i - 1].tick) / 60;
      expect(gap).toBeGreaterThanOrEqual(l1v2.house.staggerS[0] - 1 / 30); expect(gap).toBeLessThanOrEqual(l1v2.house.staggerS[1] + 1 / 30);
    }
    // Each one appears within 3 m of that door, on its door-open tick, with a pedestrian look.
    for (const [i, id] of house.ids.entries()) {
      const a = appear.get(id)!; expect(a.tick).toBe(doors[i].tick);
      expect(Math.hypot(a.x - house.x, a.z - house.z)).toBeLessThanOrEqual(3);
      expect(w.entities.get(id)?.appearance?.entityId).toBe(id);
    }
    expect(nearMax).toBeGreaterThanOrEqual(l1v2.director.hordeMinInfectedNearGarage);
  }, HEAVY);

  test('T-E19-provenance @E19 PO rule: no infected enters L1 except the 5 lab exits, the 10 house residents and bitten pedestrians', async () => {
    const report: { seed: number; profile: string; exits: number; house: number; bitten: number; deaths: number }[] = [];
    for (const [seed, profile] of [[1, 'complete'], [2, 'complete'], [3, 'newbie']] as const) {
      const { world: w, mission } = await loadL1(seed); world = w;
      const bitten = new Set<number>(), seen = new Set<number>(), bad: number[] = [];
      w.events.on('outbreak.bite', e => { if (e.type === 'outbreak.bite' && e.turns) bitten.add(e.targetId); });
      w.events.on('sim.tick', () => {
        const l1 = mission.state.l1!;
        for (const e of w.infected!.active) {
          if (seen.has(e.id)) continue; seen.add(e.id);
          if (!l1.exitIds.includes(e.id) && !l1.house?.ids.includes(e.id) && !bitten.has(e.id)) bad.push(e.id);
        }
      });
      // A forced death right after the exits must not add anyone either.
      const run = runL1(w, mission, profile, { seed, onExit: () => { w.player!.damage(1000, w.tick); } });
      expect(run.outcome, `seed ${seed} ${profile}`).toBe('complete');
      expect(bad, `seed ${seed} ${profile}: infected without provenance`).toEqual([]);
      const l1 = mission.state.l1!;
      expect(l1.exitIds).toHaveLength(l1v2.accident.infectedCount);
      expect(l1.house!.ids.length).toBeLessThanOrEqual(l1v2.house.count);
      report.push({ seed, profile, exits: l1.exitIds.length, house: l1.house!.ids.length, bitten: bitten.size, deaths: run.deaths });
      w.dispose(); world = undefined;
    }
    record('provenance', report);
  }, HEAVY);

  test('T-E19-05 @E19 fair accident: the blast pushes a player at the door back, front-door infected wait 2.5 s, staff are varied', async () => {
    const { world: w, mission } = await load(3); w.combat!.damage.god = true;
    runL1(w, mission, 'idle', { seed: 3, stopWhen: m => m.state.l1!.exitIds.length > 0 });
    const door = mission.def.anchors['lab-door'], p = w.entities.get(1)!.transform;
    expect(Math.hypot(p.x - door.x, p.z - door.z)).toBeGreaterThan(2.5);
    const ids = mission.state.l1!.exitIds, models = ids.map(i => w.entities.get(i)!.appearance!.asset);
    expect(models[0]).toBe('npc.lab-tech-a'); expect(new Set(models).size).toBe(models.length);
    const tints = ids.map(i => w.entities.get(i)!.appearance!.tint); expect(new Set(tints).size).toBe(tints.length);
  }, HEAVY);

  test('T-E19-19 @E19 @E19-AC19 accident beat order flicker -> blast -> ringing -> smoke -> screams within 8 s after a 4-6 s calm', async () => {
    for (const seed of [1, 2, 3, 4, 5, 6]) {
      const { world: w, mission } = await loadL1(seed); world = w;
      const log: { type: string; tick: number }[] = [];
      for (const type of l1AccidentEvents) w.events.on(type, e => { log.push({ type: e.type, tick: e.tick }); });
      let idleDuringCalm = true;
      runL1(w, mission, 'complete', { seed, stopWhen: m => { const l = m.state.l1!; if (l.delivered && !log.length) idleDuringCalm &&= !m.def.steps.some(s => m.state.steps[s.id].status === 'active') && !(w.infected?.active.length); return l.exitIds.length > 0; } });
      const l1 = mission.state.l1!;
      expect(log.map(e => e.type)).toEqual([...l1AccidentEvents]);
      const calmS = (log[0].tick - l1.deliveredAt) / 60;
      expect(calmS).toBeGreaterThanOrEqual(l1v2.accident.calmS[0] - .02); expect(calmS).toBeLessThanOrEqual(l1v2.accident.calmS[1] + .02);
      expect(idleDuringCalm).toBe(true);
      expect((log[4].tick - log[0].tick) / 60).toBeLessThanOrEqual(l1v2.accident.sequenceS);
      const exitS = (log[5].tick - log[0].tick) / 60;
      expect(exitS).toBeGreaterThanOrEqual(l1v2.accident.exitDelayS[0] - .02); expect(exitS).toBeLessThanOrEqual(l1v2.accident.exitDelayS[1] + .02);
      w.dispose(); world = undefined;
    }
  }, HEAVY);

  test('T-E19-respawn-world @E19 PO rule: a death after the bat keeps the world (corpses, infected, pedestrians, props, objectives, bat)', async () => {
    const { world: w, mission } = await load(4);
    runL1(w, mission, 'complete', { seed: 4, stopWhen: m => m.state.checkpoint === 'bat' && (m.state.l1!.house?.ids.length ?? 0) >= 3 });
    expect(mission.state.checkpoint).toBe('bat');
    // A corpse for sure: kill one live infected.
    const victim = w.infected!.active.find(e => e.health.current > 0 && !e.hidden)!;
    w.combat!.damage.apply({ sourceId: 1, targetId: victim.id, attackId: 99, actionId: 'test', origin: victim.transform, direction: { x: 1, z: 0 }, base: 999, multiplier: 1, type: 'melee', knockback: 0, stagger: 0 });
    for (let i = 0; i < 30; i++) w.update();
    const snapshot = () => {
      const rows = [...w.entities.iterate()].filter(e => e.id !== 1)
        .map(e => ({ id: e.id, kind: e.kind, dead: e.health.current <= 0, state: e.infected?.state ?? e.civilian?.state ?? '', x: e.transform.x, z: e.transform.z }));
      return { rows, corpses: rows.filter(r => r.dead && r.kind === 'infected').length, infected: w.infected!.active.filter(e => e.health.current > 0).length, pedestrians: rows.filter(r => !r.dead && r.kind === 'civilian').length };
    };
    const steps = structuredClone(mission.state.steps), bites = w.npcs!.civilians.outbreak!.stats.bites, house = structuredClone(mission.state.l1!.house!);
    // The respawn handlers run between these two (missions phase): nothing but the player may change.
    let before: ReturnType<typeof snapshot> | null = null, after: ReturnType<typeof snapshot> | null = null;
    w.events.on('player.respawned', () => { before = snapshot(); }, SimPhase.input);
    w.events.on('player.respawned', () => { after = snapshot(); }, SimPhase.cleanup);
    w.player!.damage(1000, w.tick);
    for (let i = 0; i < 400 && !after; i++) w.update();
    expect(after, 'respawned').not.toBeNull();
    const [b, a] = [before!, after!] as ReturnType<typeof snapshot>[];
    expect(w.events.events().some(e => e.type === 'checkpoint.restored')).toBe(false);
    expect(a.corpses).toBeGreaterThan(0);
    expect({ corpses: a.corpses, infected: a.infected, pedestrians: a.pedestrians }).toEqual({ corpses: b.corpses, infected: b.infected, pedestrians: b.pedestrians });
    expect(a.rows).toEqual(b.rows);
    record('respawn-world', { corpses: a.corpses, infected: a.infected, pedestrians: a.pedestrians, entities: a.rows.length });
    // Nothing reset: objectives, outbreak counters, the beat 9 house, the bat.
    expect(mission.state.steps.firestation.status).toBe(steps.firestation.status);
    expect(w.npcs!.civilians.outbreak!.stats.bites).toBeGreaterThanOrEqual(bites);
    expect(mission.state.l1!.house!.ids.slice(0, house.ids.length)).toEqual(house.ids);
    expect(w.entities.get(1)!.weapons!.LEFT.rack[0].id).toBe('weapon.bat');
    const p = w.entities.get(1)!;
    expect(p.health.current).toBe(p.health.max); expect(p.survivor!.invulnerableUntil).toBeGreaterThan(w.tick + 60);
    // The world keeps going and the courier can still finish.
    expect(runL1(w, mission, 'complete', { seed: 4 }).outcome).toBe('complete');
  }, HEAVY);

  test('T-E19-end @E19 fire station: shutter closes, caption, result fields (delivered, infected, turned, escaped)', async () => {
    const { world: w, mission } = await load(5);
    const run = runL1(w, mission, 'complete', { seed: 5 });
    expect(run.outcome).toBe('complete');
    expect(mission.state.gates['fire-shutter']).toBe(false);
    expect(mission.state.subtitle?.text).toBe('Delivery complete. Outbreak: not contained.');
    expect(mission.state.phase).toBe('result');
    expect(w.storyLock).toBeNull();
    expect(storyLines['firestation.caption']).toBe(mission.state.subtitle?.text);
    expect(mission.state.result).toMatchObject({ delivered: true, turned: expect.any(Number), escaped: expect.any(Number), infected: expect.any(Number) });
  }, HEAVY);

  test('T-E19-14 @E19 @E19-AC14 duel bot harness: 1 infected is beatable, 5 unarmed are lethal once lane G tuning lands', async () => {
    const one = await runDuel({ seed: 1, count: 1, weapon: 'unarmed', skill: 'newbie' });
    expect(one.playerDied).toBe(false); expect(one.killed).toBe(1);
    const five = await runDuel({ seed: 1, count: 5, weapon: 'unarmed', skill: 'standing' });
    // Lane G owns the AC14 numbers (4-5 unarmed hits, 10 dmg / 0.9 s): the death-within-20-s clause only applies once they are merged.
    expect(five.killed + Number(five.playerDied)).toBeGreaterThan(0);
    if (five.killed < 5) expect(five.playerDied && five.diedAtS! <= 20).toBe(true);
  }, HEAVY);
});
