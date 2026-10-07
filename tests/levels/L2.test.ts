import { mkdirSync, writeFileSync } from 'node:fs';
import { afterEach, describe, expect, test } from 'vitest';
import { l2 } from '../../src/data/l2';
import { validateMission } from '../../src/sim/missions/schema';
import type { SimWorld } from '../../src/sim/world/SimWorld';
import type { L2Opening, L2Profile } from '../../src/debug/bot/LevelTwoBot';
import { loadL2, runL2, inCheckpointZone, type L2Report } from '../../tools/sim-runner/l2Bots';

/** E20 L2 "The Failed Rescue": mission graph, set piece, outbreak, allies, lesson, escape, cluster, checkpoint (sim ACs). */
let world: SimWorld | undefined;
afterEach(() => { world?.dispose(); world = undefined; });
const seeds = Array.from({ length: l2.bots.seeds }, (_, i) => i + 1);
const median = (values: number[]) => { const v = [...values].sort((a, b) => a - b); return v[Math.floor(v.length / 2)]; };
const HEAVY = 3_600_000;
function record(name: string, value: unknown) { mkdirSync('test-results/epics/E20', { recursive: true }); writeFileSync(`test-results/epics/E20/${name}.json`, JSON.stringify(value, null, 2) + '\n'); }
/** One 20-seed battery per profile/opening, shared by every criterion that reads it (computed once per file run). */
const batteries = new Map<string, Promise<L2Report[]>>();
function battery(profile: L2Profile, opts: { opening?: L2Opening; god?: boolean; maxSeconds?: number; stopAfterDoorsS?: number } = {}): Promise<L2Report[]> {
  const key = JSON.stringify({ profile, ...opts });
  if (!batteries.has(key)) batteries.set(key, (async () => {
    const runs: L2Report[] = [];
    for (const seed of seeds) {
      const l = await loadL2(seed);
      runs.push(runL2(l.world, l.mission, profile, { seed, opening: opts.opening, god: opts.god, maxSeconds: opts.maxSeconds ?? 600, stopWhen: opts.stopAfterDoorsS ? m => !!m.state.l2!.doorsOpenAt && m.world.tick - m.state.l2!.doorsOpenAt >= opts.stopAfterDoorsS! * 60 : undefined }));
      l.world.dispose();
    }
    record(`bots-${profile}${opts.opening ? `-${opts.opening}` : ''}${opts.god ? '-observer' : ''}`, runs);
    return runs;
  })());
  return batteries.get(key)!;
}
const complete = () => battery('complete');

describe('L2 The Failed Rescue', () => {
  test('T-E20-01 @E20 @E20-AC01 mission graph calm -> board -> doors -> bridge checkpoint is completable, no fail timer', async () => {
    const l = await loadL2(1); world = l.world; const m = l.mission;
    expect(validateMission(m.def)).toEqual([]);
    expect(m.def.steps.map(s => s.id)).toEqual(['calm', 'board', 'axe', 'ride', 'doors', 'bridge']);
    expect(m.def.steps.every(s => s.timer === undefined && s.fail.length === 0) && m.def.deadline === undefined).toBe(true);
    expect(m.def.finish).toEqual(['bridge']); expect(m.def.steps.find(s => s.id === 'axe')!.optional).toBe(true);
    // E12-AC07 walk: complete exactly the active objective; the radio state is what the controller sets after the doors.
    for (let guard = 0; guard < 12 && m.state.phase === 'playing'; guard++) {
      if (!m.def.steps.some(s => m.state.steps[s.id].status === 'active')) { m.setState('radio', true); l.world.update(); continue; }
      m.completeObjective(m.def.steps.find(s => m.state.steps[s.id].status === 'active' && s.id !== 'axe')?.id);
    }
    expect(m.state.completedObjectives).toEqual(expect.arrayContaining(['calm', 'board', 'ride', 'doors', 'bridge']));
    expect(['result', 'progression']).toContain(m.state.phase);
  });

  test('T-E20-02 @E20 @E20-AC02 complete bot finishes 20/20 seeds from L2-default, median time in band', async () => {
    const runs = await complete();
    expect(runs.filter(r => r.outcome === 'complete')).toHaveLength(seeds.length);
    expect(runs.every(r => r.axe)).toBe(true);
    const t = median(runs.map(r => r.simSeconds));
    expect(t).toBeGreaterThanOrEqual(l2.bots.completeMedianS[0]); expect(t).toBeLessThanOrEqual(l2.bots.completeMedianS[1]);
  }, HEAVY);

  test('T-E20-03 @E20 @E20-AC03 newbie >= 18/20, median in band, median deaths <= 1; no-axe >= 18/20', async () => {
    const newbie = await battery('newbie'), noAxe = await battery('no-axe');
    expect(newbie.filter(r => r.outcome === 'complete').length).toBeGreaterThanOrEqual(l2.bots.newbieMinSeeds);
    expect(median(newbie.map(r => r.deaths))).toBeLessThanOrEqual(l2.bots.newbieMaxMedianDeaths);
    const t = median(newbie.filter(r => r.outcome === 'complete').map(r => r.simSeconds));
    expect(t).toBeGreaterThanOrEqual(l2.bots.newbieMedianS[0]); expect(t).toBeLessThanOrEqual(l2.bots.newbieMedianS[1]);
    expect(noAxe.every(r => !r.axe)).toBe(true);
    expect(noAxe.filter(r => r.outcome === 'complete').length).toBeGreaterThanOrEqual(l2.bots.newbieMinSeeds);
  }, HEAVY);

  test('T-E20-04 @E20 @E20-AC04 calm: no infected, no combat until the 20-30 s alarm; crew at the truck within 8 s; axe rack live', async () => {
    for (const r of await complete()) {
      expect(r.calm!.infectedMax).toBe(0); expect(r.calm!.combatEvents).toBe(0);
      expect(r.calm!.alarmS).toBeGreaterThanOrEqual(l2.calm.alarmAtS[0]); expect(r.calm!.alarmS).toBeLessThanOrEqual(l2.calm.alarmAtS[1]);
      expect(r.calm!.crewAtTruckS).not.toBeNull(); expect(r.calm!.crewAtTruckS!).toBeLessThanOrEqual(l2.calm.crewToTruckMaxS);
      expect(r.calm!.axeActive).toBe(true);
    }
  }, HEAVY);

  test('T-E20-05 @E20 @E20-AC05 ride: passenger boarding, 15-25 s route with everyone seated, input inert, exits and control back on time', async () => {
    for (const r of await complete()) {
      expect(r.ride!.passenger).toBe(true); expect(r.ride!.seatedEveryTick).toBe(true);
      expect(r.ride!.seconds).toBeGreaterThanOrEqual(15); expect(r.ride!.seconds).toBeLessThanOrEqual(25);
      expect(r.ride!.crewExitS).toBeLessThanOrEqual(l2.ride.exitWithinS); expect(r.ride!.controlS).toBeLessThanOrEqual(l2.ride.controlWithinS);
    }
    // Player input moves nothing while seated: held movement and attack during the ride leave the courier on the truck.
    const l = await loadL2(3); world = l.world;
    runL2(l.world, l.mission, 'complete', { stopWhen: m => m.state.l2!.phase === 'ride' && m.world.tick - m.state.l2!.departAt > 120 });
    const truck = l.world.entities.get(l.mission.state.l2!.truckId)!;
    for (let i = 0; i < 120; i++) { l.world.setInput({ move: { x: 1, z: 1 }, left: { down: i % 10 === 0, held: true, up: false }, interact: i % 7 === 0 }); l.world.update(); }
    const p = l.world.entities.get(1)!;
    expect(l.mission.state.l2!.seated).toBe(true); expect(p.hidden).toBe(true);
    expect(Math.hypot(p.transform.x - truck.transform.x, p.transform.z - truck.transform.z)).toBeLessThan(.5);
    expect(l.world.events.events().filter(e => e.type === 'combat.attack').length).toBe(0);
  }, HEAVY);

  test('T-E20-06 @E20 @E20-AC06 set piece: event order, empty forecourt, release and ambush timing, three directions', async () => {
    const want = ['l2.truckArrived', 'l2.crewExit', 'l2.firefightersAtDoors', 'l2.doorsOpen'];
    const doors = Object.fromEntries(l2.rescue.ambushDoors.map(([d]) => [d, d]));
    for (const r of await complete()) {
      const d = r.doors!;
      expect(d.order.filter(t => want.includes(t))).toEqual(want);
      expect(d.nearBefore).toBe(0);
      expect(d.firstCivOutS!).toBeLessThanOrEqual(1);
      expect(d.firstAmbushVisibleS!).toBeLessThanOrEqual(.5);
      expect(d.emerged3s).toBeGreaterThanOrEqual(8); expect(d.doors3s.length).toBeGreaterThanOrEqual(3);
      expect(d.allOutS!).toBeLessThanOrEqual(12);
      expect(d.doors3s.every(id => doors[id])).toBe(true);
    }
  }, HEAVY);

  test('T-E20-07 @E20 @E20-AC07 snowball: idle courier (observer, no damage), rescue infected >= 20 at +60 s and >= 30 at +120 s, all by bites', async () => {
    const runs = await battery('idle', { god: true, stopAfterDoorsS: 125 });
    expect(median(runs.map(r => r.infectedAt[60].rescue))).toBeGreaterThanOrEqual(20);
    expect(median(runs.map(r => Math.min(r.infectedAt[120].rescue, l2.escape.caps.high)))).toBeGreaterThanOrEqual(30);
    expect(runs.every(r => r.infectedAt[0].rescue <= l2.rescue.ambush && r.doors!.nonBiteNearRescue === 0)).toBe(true);
  }, HEAVY);

  test('T-E20-08 @E20 @E20-AC08 firefighters fight, turn with identity continuity, >= 2 turned by +90 s when idle, no immunity', async () => {
    const runs = await complete(), idle = await battery('idle', { god: true, stopAfterDoorsS: 125 });
    expect(runs.filter(r => r.firefighterHits >= 1).length).toBeGreaterThanOrEqual(18);
    const turns = [...runs, ...idle].flatMap(r => r.crewTurns);
    expect(turns.length).toBeGreaterThan(0);
    for (const t of turns) { expect(t.sameAsset).toBe(true); expect(t.seconds).toBeGreaterThanOrEqual(2.5); expect(t.seconds).toBeLessThanOrEqual(3.5); }
    expect(idle.filter(r => r.firefightersTurnedBy90 >= 2).length).toBeGreaterThanOrEqual(15);
    // No damage immunity or scripted survival: ordinary civilian humans with an ally task, sampled through a run.
    const l = await loadL2(4); world = l.world;
    runL2(l.world, l.mission, 'idle', { god: true, stopWhen: m => {
      for (const id of m.state.l2!.crewIds) { const e = m.world.entities.get(id); if (e?.civilian?.ally) { expect(e.survivor).toBeUndefined(); expect(e.companion).toBeUndefined(); expect(e.civilian.l1?.graceUntil ?? 0).toBeLessThanOrEqual(m.world.tick + 60); } }
      return !!m.state.l2!.doorsOpenAt && m.world.tick - m.state.l2!.doorsOpenAt > 600;
    } });
  }, HEAVY);

  test('T-E20-09 @E20 @E20-AC09 lesson: the aggressive axe kills >= 10 yet the outbreak grows and the courier falls; the disengaging bot survives', async () => {
    const observer = await battery('aggressive', { god: true, stopAfterDoorsS: 95 }), fair = await battery('aggressive', { stopAfterDoorsS: 121 });
    expect(observer.every(r => r.axe)).toBe(true);
    expect(observer.filter(r => r.killsNearDoors >= 10 && r.infectedAt[90].all >= r.infectedAt[10].all).length).toBeGreaterThanOrEqual(16);
    expect(fair.filter(r => r.diedBy120).length).toBeGreaterThanOrEqual(16);
    expect(median((await complete()).map(r => r.deaths))).toBeLessThanOrEqual(1);
  }, HEAVY);

  test('T-E20-11 @E20 @E20-AC11 omniscience audit over 20 complete runs: sight-only alerts with clear LOS, emergence at doors out of view', async () => {
    for (const r of await complete()) {
      expect(r.audit.sightViolations).toBe(0); expect(r.audit.nonSightAlerts).toBe(0);
      expect(r.audit.emerged).toBeGreaterThan(0); expect(r.audit.emergeFar).toBe(0); expect(r.audit.emergeSeen).toBe(0);
    }
  }, HEAVY);

  test('T-E20-12 @E20 @E20-AC12 escape population at the radio: >= 25 spread infected, >= 3 groups of >= 4, <= 20 % on the courier', async () => {
    for (const r of await complete()) {
      expect(r.radio!.escapeArea).toBeGreaterThanOrEqual(25); expect(r.radio!.groupsOf4).toBeGreaterThanOrEqual(3);
      expect(r.radio!.chasingPlayer).toBeLessThanOrEqual(.2 * r.radio!.infected);
    }
  }, HEAVY);

  test('T-E20-13 @E20 @E20-AC13 cluster of 12-16 on the approach; complete passes killing <= 50 %; side path and car alarm each suffice', async () => {
    const side = await complete(), alarm = await battery('complete', { opening: 'alarm' });
    for (const r of side) { expect(r.cluster!.atApproach).toBeGreaterThanOrEqual(12); expect(r.cluster!.atApproach).toBeLessThanOrEqual(16); }
    expect(side.filter(r => r.clusterKilled <= r.clusterSize / 2).length).toBeGreaterThanOrEqual(18);
    expect(alarm.filter(r => r.outcome === 'complete').length).toBeGreaterThanOrEqual(18);
    expect(alarm.filter(r => r.clusterKilled <= r.clusterSize / 2).length).toBeGreaterThanOrEqual(18);
  }, HEAVY);

  test('T-E20-14 @E20 @E20-AC14 checkpoint: line composition, gate closes <= 1.5 s behind the courier, nothing crosses after, straight on to L3', async () => {
    const l = await loadL2(1); world = l.world;
    const s = l.mission.state.l2!;
    expect(s.officerIds.length).toBeGreaterThanOrEqual(4); expect(s.lineIds.length).toBeGreaterThanOrEqual(8);
    expect(s.lineIds.every(id => inCheckpointZone(l.world.entities.get(id)!.transform))).toBe(true);
    for (const r of await complete()) { expect(r.gate!.closeS).toBeLessThanOrEqual(l2.checkpoint.closeWithinS); expect(r.gate!.infectedInsideAfter).toBe(0); }
    runL2(l.world, l.mission, 'complete', { seed: 1 });
    expect(l.mission.state.phase).toBe('progression'); expect(l.mission.state.result).not.toBeNull();
  }, HEAVY);

  test('T-E20-17 @E20 @E20-AC17 checkpoints doors, escape and cluster restore entities, outbreak, crew, gates and weapons', async () => {
    const l = await loadL2(2); world = l.world; const m = l.mission, w = l.world;
    for (const id of ['doors', 'escape', 'cluster'] as const) {
      runL2(w, m, 'complete', { stopWhen: mm => mm.state.checkpoint === id });
      expect(m.state.checkpoint).toBe(id);
      const snap = { tick: w.tick, infected: w.infected!.active.filter(e => e.health.current > 0).map(e => e.id).sort(), crew: m.state.l2!.crewIds.map(c => { const e = w.entities.get(c)!; return `${c}:${e.kind}:${e.health.current > 0}`; }), weapons: w.entities.get(1)!.weapons!.LEFT.rack.map(r => r.id), doors: m.state.l2!.doorsOpenAt > 0, phase: m.state.l2!.phase, stats: w.npcs!.civilians.outbreak!.stats.turned };
      for (let i = 0; i < 90; i++) w.update();
      const p = w.entities.get(1)!; w.player!.damage(p.health.current, w.tick);
      for (let i = 0; i < 400 && m.state.checkpoint === id && w.entities.get(1)!.health.current <= 0; i++) w.update();
      expect(m.state.checkpoint).toBe(id);
      // Within tolerance: the restore lands mid-tick, so a turning civilian may rise or a grabbed one fall in that same tick.
      const now = new Set(w.infected!.active.filter(e => e.health.current > 0).map(e => e.id)), before = new Set(snap.infected);
      expect([...now].filter(i => !before.has(i)).length + [...before].filter(i => !now.has(i)).length, `${id} infected`).toBeLessThanOrEqual(2);
      const crew = m.state.l2!.crewIds.map(c => { const e = w.entities.get(c)!; return `${c}:${e.kind}:${e.health.current > 0}`; });
      expect(crew.filter((c, i) => c !== snap.crew[i]).length, `${id} crew`).toBeLessThanOrEqual(1);
      expect(w.entities.get(1)!.weapons!.LEFT.rack.map(r => r.id)).toEqual(snap.weapons);
      expect(m.state.l2!.doorsOpenAt > 0).toBe(snap.doors); expect(m.state.l2!.phase).toBe(snap.phase);
      expect(Math.abs(w.npcs!.civilians.outbreak!.stats.turned - snap.stats), `${id} turned`).toBeLessThanOrEqual(1);
    }
  }, HEAVY);
});
