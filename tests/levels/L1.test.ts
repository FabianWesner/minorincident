import { mkdirSync, writeFileSync } from 'node:fs';
import { afterEach, describe, expect, test } from 'vitest';
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

  test('T-E19-02 @E19 @E19-AC02 complete bot finishes 20/20 seeds, median 4:00-6:00', async () => {
    const runs: L1Report[] = [];
    for (const seed of seeds) { const { world: w, mission } = await loadL1(seed); runs.push(runL1(w, mission, 'complete', { seed })); w.dispose(); }
    record('complete-bots', runs);
    expect(runs.filter(r => r.outcome === 'complete')).toHaveLength(seeds.length);
    const t = median(runs.map(r => r.simSeconds));
    expect(t).toBeLessThanOrEqual(l1v2.bots.completeMedianS[1]);
    expect(t).toBeGreaterThanOrEqual(l1v2.bots.completeMedianS[0]);
  }, HEAVY);

  test('T-E19-03 @E19 @E19-AC03 newbie bot finishes >= 18/20, median 4:30-7:00, deaths <= 1', async () => {
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
    expect(run.outcome).toBe('complete'); expect(attacks).toBe(0);
  }, HEAVY);

  test('T-E19-06 @E19 @E19-AC06 idle bot: systemic spread 5 -> >= 15 at +120 s, >= 25 at +240 s', async () => {
    const runs: L1Report[] = [];
    for (const seed of seeds) {
      const { world: w, mission } = await loadL1(seed); world = w; w.combat!.damage.god = true;
      const bitten = new Set<number>(), born = new Set<number>();
      w.events.on('outbreak.bite', e => { if (e.type === 'outbreak.bite' && e.turns) bitten.add(e.targetId); });
      w.events.on('outbreak.infection', e => { if (e.type === 'outbreak.infection' && e.phase === 'infected') born.add(e.entityId); });
      let exitTick = 0;
      runs.push(runL1(w, mission, 'idle', { seed, maxSeconds: 400,
        onExit: () => { exitTick = w.tick; }, stopWhen: () => exitTick > 0 && w.tick > exitTick + 240 * 60,
      }));
      for (const id of born) if (!mission.state.l1!.exitIds.includes(id)) expect(bitten.has(id), `seed ${seed}, infected ${id}`).toBe(true);
      expect(w.npcs!.civilians.outbreak!.stats.hordeSpawned).toBe(0);
      expect(mission.state.l1!.routeSpawns).toBe(0);
      w.dispose(); world = undefined;
    }
    record('forecourt-spread', runs);
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
      for (let i = 0; i < 400 && !w.events.events().some(e => e.type === 'checkpoint.restored'); i++) w.update();
      const p = w.entities.get(1)!;
      expect(w.events.events().some(e => e.type === 'checkpoint.restored'), `seed ${seed}`).toBe(true);
      expect(p.health.current).toBe(p.health.max);
      expect(p.survivor!.invulnerableUntil).toBeGreaterThan(w.tick + 60);
      const close = w.infected!.active.filter(e => e.health.current > 0 && Math.hypot(e.transform.x - p.transform.x, e.transform.z - p.transform.z) < 8);
      expect(close, `seed ${seed}`).toHaveLength(0);
      w.dispose(); world = undefined;
    }
  }, HEAVY);

  test('T-E19-09 @E19 @E19-AC25 beat 9 the director produces >= 6 infected near the garage exit and a stream ahead on the route', async () => {
    const { world: w, mission } = await load(2); w.combat!.damage.god = true;
    runL1(w, mission, 'complete', { seed: 2, stopWhen: m => m.state.steps.weapon.status === 'completed' });
    const g = mission.def.anchors['garage-door'], near = () => w.infected!.active.filter(e => e.health.current > 0 && Math.hypot(e.transform.x - g.x, e.transform.z - g.z) <= l1v2.director.hordeRadiusM).length;
    for (let i = 0; i < 60 * 40 && !mission.state.l1!.hordeDone; i++) w.update();
    expect(mission.state.l1!.hordeDone).toBe(true);
    // Emergence: the horde infected wait hidden at doors, then appear within 3 m of that door after the door-open event.
    const doorRuns = mission.state.l1!.runs.filter(r => r.door), doorEvents: string[] = [];
    expect(doorRuns.length).toBeGreaterThan(0);
    w.events.on('gate.changed', e => { if (e.type === 'gate.changed' && e.id.startsWith('door-')) doorEvents.push(e.id); });
    for (const r of doorRuns) expect(w.entities.get(r.id)!.hidden).toBe(true);
    for (let i = 0; i < 60 * 10 && mission.state.l1!.runs.some(r => r.emergeAt !== undefined); i++) w.update();
    expect(doorEvents.length).toBeGreaterThan(0);
    for (let i = 0; i < 60 * 30 && near() < l1v2.director.hordeMinInfectedNearGarage; i++) w.update();
    expect(near()).toBeGreaterThanOrEqual(l1v2.director.hordeMinInfectedNearGarage);
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

  test('T-E19-checkpoint @E19 checkpoints restore the outbreak, bicycle after death', async () => {
    const { world: w, mission } = await load(4);
    // Mocks of the optional F seams (bicycle, toys); the outbreak layer is the real lane D one.
    const mocks = { bicycle: { at: [5, 5], riding: false } };
    for (const [name, state] of Object.entries(mocks)) (w as unknown as Record<string, unknown>)[name] = { snapshot: () => state, restore: (s: unknown) => { Object.assign(state, structuredClone(s)); } };
    runL1(w, mission, 'complete', { seed: 4, stopWhen: m => m.state.checkpoint === 'accident' });
    expect(mission.state.checkpoint).toBe('accident');
    const alive = w.infected!.active.filter(e => e.health.current > 0).map(e => e.id).sort();
    expect(alive).toHaveLength(5);
    const techId = mission.state.l1!.techId;
    mocks.bicycle.at = [99, 99];
    const stats = w.npcs!.civilians.outbreak!.stats; stats.turned = 7;
    w.player!.damage(1000, w.tick);
    for (let i = 0; i < 400; i++) w.update();
    expect(mission.state.checkpoint).toBe('accident');
    expect(mocks.bicycle.at).toEqual([5, 5]); expect(w.npcs!.civilians.outbreak!.stats.turned).toBe(0);
    expect(w.infected!.active.filter(e => e.health.current > 0).map(e => e.id).sort()).toEqual(alive);
    expect(w.entities.get(techId)?.infected).toBeDefined();
    expect(['escape', 'weapon'].some(id => mission.state.steps[id].status === 'active')).toBe(true); expect(mission.state.steps.pickup.status).toBe('completed');
    // The bat checkpoint carries the bat through a death.
    runL1(w, mission, 'complete', { seed: 4, stopWhen: m => m.state.checkpoint === 'bat' });
    expect(mission.state.checkpoint).toBe('bat');
    w.player!.damage(1000, w.tick); for (let i = 0; i < 400; i++) w.update();
    expect(w.entities.get(1)!.weapons!.LEFT.rack[0].id).toBe('weapon.bat'); expect(mission.state.steps.firestation.status).toBe('active');
  }, HEAVY);

  test('T-E19-end @E19 fire station: shutter closes, caption, result fields (delivered, infected, turned, escaped)', async () => {
    const { world: w, mission } = await load(5);
    const run = runL1(w, mission, 'complete', { seed: 5 });
    expect(run.outcome).toBe('complete');
    expect(mission.state.gates['fire-shutter']).toBe(false);
    expect(mission.def.cinematics.twist.caption).toBe('Delivery complete. Outbreak: not contained.');
    expect(storyLines['firestation.caption']).toBe(mission.def.cinematics.twist.caption);
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
