// Mission runtime: one objective graph engine (schema, triggers, timers, checkpoints, retry) runs all ten levels.
// Level content itself is covered by the nightly campaign bot, not here.
import { afterEach, expect, test, vi } from 'vitest';
import { SimPhase } from '../../src/core/EventBus';
import { emptyInput } from '../../src/input/InputFrame';
import { respawnAtCheckpoint } from '../../src/sim/missions/Respawn';
import { missionControls } from '../../src/sim/missions/controls';
import { validateMission } from '../../src/sim/missions/schema';
import { objectiveTypes, type MissionDef } from '../../src/sim/missions/types';
import { SimWorld } from '../../src/sim/world/SimWorld';
import { isCurrentOpenL6Gate } from '../../src/sim/missions/interaction';
import { LevelSixBot } from '../../src/debug/bot/LevelSixBot';
import { LevelSixSubway } from '../../src/sim/missions/LevelSixSubway';
import { loadLevel as loadMissionLevel } from '../qa/invariants/world';
import { missionSandbox } from '../fixtures/scenarios/mission-sandbox';
import { l6, l6Entries, l6SpawnCandidates } from '../../src/data/l6';

let world: SimWorld | undefined;
afterEach(() => { world?.dispose(); world = undefined; });
async function load(def = missionSandbox()) {
  world?.dispose();
  world = new SimWorld(); await world.init(); world.loadScenario('combat-arena', 1); world.scenario = 'mission-sandbox'; world.loadMission(def);
  const api = missionControls(world); api.begin(); return api;
}

async function l6FollowersCatchUpOnRoute(): Promise<void> {
  const w = await loadMissionLevel('L6', 1);
  try {
    const mission = w.missions!, state = mission.state.l6!;
    mission.completeObjective('shelter'); mission.completeObjective('stop');
    for (const infected of [...w.infected!.active]) w.infected!.release(infected);
    const row = state.survivors.find(r => r.status === 'following')!;
    const follower = w.entities.get(row.id)!;
    for (const other of state.survivors) if (other.id !== row.id) other.status = 'dead';
    state.leaderX = 120; state.leaderZ = 15;
    w.solids.relocate(follower, { x: 100, y: follower.transform.y, z: 15 }, 'test.l6-catchup', 1.5);
    w.solids.relocate(w.entities.get(1)!, { x: 120, y: 1.3, z: 15 }, 'test.l6-courier', 1.5);
    const startGap = state.leaderX - follower.transform.x;
    for (let i = 0; i < 300; i++) w.update();
    expect(follower.transform.x - 100, 'a separated follower uses catch-up pace above the 2.2 m/s column speed').toBeGreaterThan(11);
    expect(state.leaderX - follower.transform.x, 'the follower closes the gap while the leader continues').toBeLessThan(startGap);
    expect(state.leaderX).toBeGreaterThan(120);
    const entry = state.entries!.find(item => item.door === 4)!;
    state.phase = 'exit'; state.leaderX = 254;
    Object.assign(entry, { warnedAt: 1, remaining: 0, closedAt: 1, brokenAt: 0, hits: 1, nextAt: w.tick });
    mission.l6!.update();
    expect(entry.brokenAt).toBe(w.tick);
    expect(entry.reopenRemaining, 'a passed hatch does not reserve a late cohort behind Northgate').toBe(0);
    expect(entry.remaining).toBe(0);
    row.straggler = true;
    expect(new LevelSixBot(w).sample().move?.x, 'distance without an infected threat does not send the courier back across the route').toBeGreaterThan(0);
    row.injured = true; row.straggler = false; state.leaderX = 6; state.leaderZ = 15;
    mission.completeObjective('retreat');
    w.solids.relocate(follower, { x: 22, y: follower.transform.y, z: 8 }, 'test.l6-injured-side-floor', 0, false);
    const injuredStart = { x: follower.transform.x, z: follower.transform.z };
    for (let i = 0; i < 300; i++) w.update();
    expect(Math.hypot(follower.transform.x - injuredStart.x, follower.transform.z - injuredStart.z), 'an injured follower leaves the side floor and joins retreat movement').toBeGreaterThan(1);
  } finally { w.dispose(); }
}

async function l7DistanceAloneDoesNotPrompt(): Promise<void> {
  const w = await loadMissionLevel('L7', 1);
  try {
    const encounters = w.l7Encounters!, row = encounters.state.roster[0], follower = w.entities.get(row.id)!;
    w.solids.relocate(w.entities.get(1)!, { x: 20, y: 1.3, z: 15 }, 'test.l7-courier', 1.5);
    w.solids.relocate(follower, { x: -5, y: follower.transform.y, z: 15 }, 'test.l7-distant-follower', 1.5);
    expect(Math.hypot(follower.transform.x - w.entities.get(1)!.transform.x, follower.transform.z - w.entities.get(1)!.transform.z)).toBeGreaterThan(18);
    encounters.follower(follower);
    expect(encounters.state.alarm, 'separation alone is not a danger prompt').toBeUndefined();
  } finally { w.dispose(); }
}
const step = (ticks = 1) => { for (let i = 0; i < ticks; i++) world!.update(); };
const teleport = (id: number, x = 5, z = 0) => missionControls(world!).teleport(id, { x, z });
const kill = (id: number) => missionControls(world!).damageActor(Object.entries(world!.missions!.state.actors).find(([, entity]) => entity === id)![0], 10000);

test('schema: rejects unreachable, unknown, duplicate and trigger-less objectives and invalid durations', () => {
  const minimal = (): MissionDef => ({
    id: 'mission-sandbox', briefing: 'Test mission', anchors: { goal: { x: 5, z: 0, radius: 2 } }, actors: {}, groups: {}, gates: {}, items: [], states: [], counters: [], checkpoints: [], cinematics: {},
    steps: [{ id: 'reach', type: 'reach', text: 'Reach the goal', anchor: 'goal', start: { kind: 'start' }, complete: { kind: 'volume', anchor: 'goal', edge: 'inside' }, fail: [] }], finish: ['reach'], onStart: [], onComplete: [],
  });
  expect(validateMission(minimal())).toEqual([]);
  const cycle = minimal(); cycle.steps[0].start = { kind: 'objectives', ids: ['reach'], mode: 'all' }; expect(validateMission(cycle)).toContain('Unreachable objective: reach');
  const unknown = minimal(); unknown.steps[0].start = { kind: 'objectives', ids: ['missing'], mode: 'all' }; unknown.steps[0].anchor = 'missing'; unknown.onStart = [{ kind: 'radio', id: 'missing' }, { kind: 'spawn', group: 'missing' }];
  expect(validateMission(unknown)).toEqual(expect.arrayContaining(['Unknown objective: missing', 'Unknown anchor: missing', 'Unknown dialogue: missing', 'Unknown group: missing']));
  for (const key of ['start', 'complete', 'fail'] as const) { const broken = minimal(); delete (broken.steps[0] as unknown as Record<string, unknown>)[key]; expect(validateMission(broken).join()).toMatch(/Missing/); }
  const duplicate = minimal(); duplicate.steps.push(structuredClone(duplicate.steps[0])); expect(validateMission(duplicate).join()).toMatch(/Duplicate/);
  const timed = minimal(); timed.deadline = { seconds: NaN, retryGraceSeconds: -1 }; timed.steps[0].timer = NaN;
  expect(validateMission(timed)).toEqual(expect.arrayContaining(['Invalid objective timer', 'Invalid mission deadline', 'Invalid retry grace']));
});

test('every objective type completes through the real sim exactly once', async () => {
  for (const type of objectiveTypes) {
    const api = await load(missionSandbox(type)), actors = api.state()!.actors;
    switch (type) {
      case 'reach': teleport(1); break;
      case 'interact': teleport(1); world!.setInput({ interact: true }); break;
      case 'kill': kill(actors.boss); break;
      case 'killAll': kill(actors.boss); step(); expect(api.state()!.completedObjectives).toEqual([]); kill(actors.runner); break;
      case 'survive': case 'defend': step(119); expect(api.state()!.completedObjectives).toEqual([]); break;
      case 'escort': teleport(actors.escort); break;
      case 'collect': api.collect('fuse'); step(); expect(api.state()!.completedObjectives).toEqual([]); api.collect('keys'); break;
      case 'drive':
        teleport(1, -4.8, 1.45); world!.applyInput({ ...emptyInput(), interact: true }, 'keyboard'); step();
        world!.applyInput({ ...emptyInput(), drive: { throttle: .6, steer: 0 } }, 'keyboard');
        for (let i = 0; i < 600 && api.state()!.phase === 'playing'; i++) step();
        break;
      case 'custom': api.count('breakers', 2); step(); expect(api.state()!.completedObjectives).toEqual([]); api.count('breakers'); break;
    }
    step(); expect(api.state()!.completedObjectives, type).toEqual([type]);
    expect(world!.events.events().filter(e => e.type === 'objective.completed'), type).toHaveLength(1);
  }
});

test('graph timing: parallel tasks join in any order; a timeout fires exactly at 120 s, retry restores the timer, completion cancels it', async () => {
  for (const order of [['a', 'b', 'c'], ['c', 'a', 'b'], ['b', 'c', 'a']]) {
    const def = missionSandbox('custom'), template = def.steps[0]; def.states.push('a', 'b', 'c');
    def.steps = ['a', 'b', 'c'].map(id => ({ ...template, id, complete: { kind: 'state', key: id, equals: true } }));
    def.steps.push({ ...template, id: 'join', start: { kind: 'objectives', ids: ['a', 'b', 'c'], mode: 'all' }, complete: { kind: 'timer', seconds: 1 } }); def.finish = ['join'];
    const api = await load(def);
    for (const [i, id] of order.entries()) { api.setState(id, true); step(); expect(api.state()!.steps.join.status).toBe(i === 2 ? 'active' : 'pending'); }
    step(60); expect(api.state()!.phase).toBe('result');
  }
  const def = missionSandbox(); def.steps[0].timer = 120; const api = await load(def);
  step(7199); expect(api.state()!.phase).toBe('playing'); step(); expect(world!.events.events()).toContainEqual({ type: 'mission.failed', tick: 7200, reason: 'timeout' });
  api.retry(); expect(api.state()!.steps.reach.started).toBe(7200); step(7199); expect(api.state()!.phase).toBe('playing');
  api.retry(); teleport(1); step(1); expect(api.state()!.phase).toBe('result'); step(7201); expect(api.state()!.phase).toBe('result');
});

// N11: the L6 service gates have their own predicate (the group's waypoint, else the next open gate ahead of the leader).
test('interactions: only the open L6 gate the group is heading for offers its prompt', async () => {
  expect(l6.breach.firstCount).toBe(4);
  expect(l6.breach.secondCount).toBe(5);
  expect(l6.infected).toEqual({ high: 33, low: 33 });
  expect(l6.pressure.group).toBe(2);
  expect(l6Entries.every(entry => entry.count === 1)).toBe(true);
  expect(l6.pressure.group * 10 / l6.pressure.intervalS).toBeGreaterThanOrEqual(1);
  expect(l6.pressure.group * 10 / l6.pressure.intervalS).toBeLessThanOrEqual(2);
  expect(l6.hatch.safeS + l6.hatch.hits * l6.hatch.hitS).toBeLessThan(30);
  expect(l6SpawnCandidates(2, 3, [2])).toContain(5);
  expect(l6SpawnCandidates(0, 1, [])).toEqual([0]);
  expect(l6SpawnCandidates(1, 2, [])).toEqual([1]);
  expect(l6SpawnCandidates(8, 1, [])).toEqual([]);
  expect(l6SpawnCandidates(2, 2, [])).toEqual([]);
  expect(l6SpawnCandidates(8, 6, [])).toEqual([]);
  expect(l6SpawnCandidates(0, 3, [])).not.toContain(0);
  expect(l6SpawnCandidates(1, 3, [])).not.toContain(1);
  expect(l6SpawnCandidates(2, 3, [])).not.toContain(8);
  expect(l6SpawnCandidates(2, 3, [2, 3, 4, 5, 6, 7])).toEqual([]);
  expect(l6SpawnCandidates(2, 4, [2])).toEqual([]);
  const gates = [{ id: 1, x: 10, closedAt: 0 }, { id: 2, x: 30, closedAt: 0 }, { id: 3, x: 50, closedAt: 0 }];
  const state = (patch: Partial<NonNullable<Parameters<typeof isCurrentOpenL6Gate>[0]>> = {}) => ({ marker: 'l6-next', leaderX: 0, gates, ...patch });
  const current = (s: Parameters<typeof isCurrentOpenL6Gate>[0]) => gates.map(g => isCurrentOpenL6Gate(s, g.id));
  expect(current(undefined), 'no L6 state (other level / completed phase)').toEqual([false, false, false]);
  expect(current(state({ marker: undefined })), 'marker absent').toEqual([false, false, false]);
  expect(current(state({ marker: 'l6-done' })), 'another marker').toEqual([false, false, false]);
  expect(current(state({ waypoint: LevelSixSubway.gateWait(30) })), 'waypoint at gate 2').toEqual([false, true, false]);
  expect(current(state({ waypoint: LevelSixSubway.gateWait(30), gates: gates.map(g => g.id === 2 ? { ...g, closedAt: 99 } : g) })), 'waypoint gate closed').toEqual([false, false, false]);
  expect(current(state({ waypoint: { x: 500, z: 500 } })), 'waypoint at no gate').toEqual([false, false, false]);
  expect(current(state()), 'fallback: first open gate ahead').toEqual([true, false, false]);
  expect(current(state({ leaderX: 40 })), 'fallback: gates behind the leader are skipped').toEqual([false, false, true]);
  expect(current(state({ gates: gates.map(g => g.id === 1 ? { ...g, closedAt: 99 } : g) })), 'fallback: a closed gate is skipped').toEqual([false, true, false]);
  // Q-305 (PO 10-31 "after the wipers went through, nothing happened. The message disappeared. The tunnel is not blocked")
  // and the PO 10-31 marker rule ("Checkpoint should not move with me"), on the production L6 retreat.
  {
    const w = await loadMissionLevel('L6', 1);
    try {
      const m = w.missions!; m.completeObjective('shelter'); m.completeObjective('stop');
      const l6 = m.state.l6!, gate = l6.gates.find(g => g.x === 90)!, exit = m.def.anchors['exit-platform'];
      // Between gates the ring is the platform, whatever the walking leader does.
      for (let i = 0; i < 120; i++) { w.update(); if (m.state.marker === 'l6-next') expect([m.def.anchors['l6-next'].x, m.def.anchors['l6-next'].z]).toEqual([exit.x, exit.z]); }
      // During a full 90 s regroup window, the marker stays on the fixed
      // retreat destination even while the group moves and the objective says
      // "Stay with the group".
      const fixedDestination = { ...m.def.anchors['l6-next'] };
      const courier = w.entities.get(1)!;
      Object.assign(courier.transform, { x: 400, z: 200 });
      l6.strayed = true;
      expect(LevelSixSubway.text(m)).toMatch(/^Rejoin .+ · \d+ m$/);
      const follower = LevelSixSubway.regroupTarget(m)!;
      const alarm = l6.alarm;
      l6.alarm = { key: 'regroup-test', id: follower.id, x: -1, z: -1, kind: 'attack', text: 'Survivor under attack!', until: w.tick - 1 };
      expect(LevelSixSubway.regroupTarget(m)?.id, 'regroup keeps locating the live survivor after the attack banner expires').toBe(follower.id);
      follower.hidden = true;
      expect(LevelSixSubway.regroupTarget(m)?.id, 'escaped or hidden survivors cannot keep a rescue cue').not.toBe(follower.id);
      follower.hidden = false; l6.alarm = alarm;
      l6.strayed = false;
      Object.assign(courier.transform, { x: exit.x, z: exit.z });
      expect(LevelSixSubway.regroupTarget(m), 'the exit locates its blocking follower even with a nearby group member').toBeDefined();
      expect(LevelSixSubway.text(m)).toMatch(/^Rejoin .+ · \d+ m$/);
      Object.assign(courier.transform, { x: 400, z: 200 });
      for (let i = 0; i < 5400; i++) {
        w.update();
        expect(m.state.marker).toBe('l6-next');
        expect([m.def.anchors['l6-next'].x, m.def.anchors['l6-next'].z]).toEqual([fixedDestination.x, fixedDestination.z]);
      }
      // Everyone past gate 90, the scripted leader already walking on beyond it (the old guide left the gate here).
      for (const [i, r] of l6.survivors.entries()) { const e = w.entities.get(r.id)!; w.solids.relocate(e, { x: 99 + i * 1.1, y: 1.3, z: 15 }, 'test.l6-gate', 1.5); }
      l6.leaderX = 105; l6.leaderZ = 15;
      const player = w.entities.get(1)!;
      Object.assign(player.transform, { x: 91.2, y: 1.3, z: 16.15 }); w.physics.playerBody?.setTranslation({ ...player.transform }, true); w.spatial.set(1, 91.2, 16.15);
      for (let i = 0; i < 10; i++) w.update();
      expect(m.state.marker).toBe('l6-next');
      expect([m.def.anchors['l6-next'].x, m.def.anchors['l6-next'].z]).toEqual([exit.x, exit.z]);
      expect(m.l6!.gateStatus(gate.id)).toMatch(/close it/);
      // A click on the gate line: no E needed.
      w.applyInput({ ...emptyInput(), mouseAttack: true, aimPoint: { x: 90.2, z: 15 } }, 'mouse-keyboard');
      for (let i = 0; i < 90; i++) { w.update(); if (i === 0) w.applyInput(emptyInput(), 'mouse-keyboard'); }
      expect(gate.closedAt).toBeGreaterThan(0);
      expect([m.def.anchors['l6-next'].x, m.def.anchors['l6-next'].z]).toEqual([exit.x, exit.z]);
      // A fresh pursuer that never saw the courier must bash this player-closed
      // gate, break through, then attack her rather than remain harmless behind it.
      w.combat!.damage.god = true;
      const outbreak = w.npcs!.civilians.outbreak!, ai = w.infected!;
      for (const e of [...ai.active]) ai.release(e);
      const id = outbreak.spawnPedestrian({ x: 87.5, z: 15 }, { model: 'npc.civilian-man-a.aftermath' });
      outbreak.turnNow(w.entities.get(id)!);
      ai.press(id, 1, w.tick + 7200, 24); ai.rush(id, player.transform, w.tick + 7200, true);
      const actor = w.entities.get(id)!, brain = actor.infected!.l1!;
      const bystander = ai.l1!.humans.all().find(h => h.kind === 'civilian')!;
      expect(bystander).toBeDefined();
      const closest = vi.spyOn(ai.l1!, 'closest').mockReturnValue(bystander);
      const approach = structuredClone(brain), approachState = actor.infected!.state;
      try {
        brain.cueYaw = actor.transform.yaw; brain.cueUntil = w.tick;
        (ai as unknown as { herdTurn(...args: unknown[]): void }).herdTurn(actor, actor.infected!, brain);
        expect(brain.targetId, 'a herd turn retains normal human perception during a finite courier assignment (G-18)').toBe(bystander.id);
      } finally { closest.mockRestore(); Object.assign(brain, approach); actor.infected!.state = approachState; }
      const focusClock = brain.focusUntil!, approachClock = brain.search.until;
      l6.infectedIds.push(id); m.l6!.restore(600);
      expect(brain.focusUntil, 'checkpoint rewind rebases the remaining courier assignment').toBe(focusClock + 600);
      expect(brain.search.until, 'checkpoint rewind rebases the remaining approach').toBe(approachClock + 600);
      respawnAtCheckpoint(w, player.transform);
      expect(brain.focusId, 'an L6 retry must not redirect courier pressure into the evacuating crowd').toBe(1);
      expect(brain.ignoreUntil).toBeGreaterThan(w.tick);
      for (let i = 0; i < 240; i++) w.update();
      // A remembered sound approach also breaks through; it need not have seen her yet.
      ai.rush(id, player.transform, w.tick + 7200);
      const closed = w.entities.get(gate.id)!, hp = closed.health.current;
      for (let i = 0; i < 600; i++) w.update();
      expect(closed.health.current, 'a never-seen arrival damages the closed service gate').toBeLessThan(hp);
      let attacked = false;
      for (let i = 0; i < 7200 && !attacked; i++) {
        w.update(); const e = w.entities.get(id)!;
        attacked = !closed.barricade!.intact && e.infected!.l1?.targetId === 1 && !!e.combat?.attacking;
      }
      expect(attacked, 'the gate breaks and its pursuer reaches the courier').toBe(true);
    } finally { w.dispose(); }
  }
}, 180_000);

test('checkpoints: death restores objectives, HP, charges and escorts; a boss killed before or after C stays dead', async () => {
  const def = missionSandbox('kill'); def.steps.push({ ...def.steps[0], id: 'reach', type: 'reach', start: { kind: 'objectives', ids: ['kill'], mode: 'all' }, complete: { kind: 'volume', anchor: 'goal', edge: 'inside' } }); def.finish = ['reach'];
  const api = await load(def), actor = api.state()!.actors;
  kill(actor.boss); api.completeObjective('kill'); world!.entities.get(1)!.weapons!.RIGHT.rack[0].charges = 2;
  teleport(1, 1); world!.entities.get(1)!.weapons!.corgiReady = world!.tick + 500;
  api.checkpoint('C'); const saved = api.state()!;
  step(30); world!.missions!.restore('C');
  expect(world!.entities.get(1)!.weapons!.corgiReady! - world!.tick).toBe(500);
  teleport(actor.escort, 20); world!.entities.get(1)!.weapons!.RIGHT.rack[0].charges = 0;
  world!.player!.damage(1000, world!.tick); step(120);
  expect(api.state()!.completedObjectives).toEqual(saved.completedObjectives); expect(world!.entities.get(1)!.health.current).toBe(100);
  expect(world!.entities.get(1)!.weapons!.RIGHT.rack[0].charges).toBe(2); expect(world!.entities.get(actor.escort)!.transform.x).toBe(-5);
  expect(world!.entities.get(actor.boss)!.health.current).toBe(0); expect(api.state()!.stats.deaths).toBe(1);

  const after = missionSandbox('kill'); after.steps.push({ ...after.steps[0], id: 'next', type: 'reach', start: { kind: 'objectives', ids: ['kill'], mode: 'all' }, complete: { kind: 'volume', anchor: 'goal', edge: 'inside' } }); after.finish = ['next'];
  const b = await load(after); b.checkpoint('C'); const boss = b.state()!.actors.boss; kill(boss); step();
  world!.player!.damage(1000, world!.tick); step(120);
  expect(world!.entities.get(boss)!.health.current).toBe(0); step(); expect(b.state()!.completedObjectives).toEqual(['kill']);
  const w = await loadMissionLevel('L6', 1);
  try {
    const mission = w.missions!;
    mission.completeObjective('shelter'); mission.completeObjective('stop'); w.update();
    const state = mission.state.l6!;
    expect(state.phase).toBe('retreat');
    const memberId = state.survivors.find(r => r.status === 'following')!.id;
    // Recreate the transition-tick mismatch reported by QA in a retry snapshot.
    state.survivors.find(r => r.id === memberId)!.status = 'shelter';
    mission.checkpoint('abandon');
    mission.restore('abandon');
    expect(mission.state.l6!.survivors.find(r => r.id === memberId)!.status).toBe('following');
    const savedLeader = mission.state.l6!.leaderZ, savedPower = mission.state.l6!.mainPower;
    const savedMember = structuredClone(w.entities.get(memberId)!);
    for (let i = 0; i < 120; i++) w.update();
    w.entities.get(memberId)!.health.current = 1;
    w.solids.relocate(w.entities.get(memberId)!, { x: 40, y: 1.3, z: 15 }, 'test.l6-checkpoint', 1.5);
    mission.state.l6!.mainPower = !savedPower;
    mission.state.l6!.gates[0].closedAt = w.tick;
    let snapshotRestored = false;
    const stop = w.events.on('player.respawned', () => {
      const member = w.entities.get(memberId)!;
      expect(member.health).toEqual(savedMember.health);
      expect(member.transform.x).toBeCloseTo(savedMember.transform.x, 3);
      expect(member.transform.z).toBeCloseTo(savedMember.transform.z, 3);
      expect(mission.state.l6!.leaderZ, 'E24-AC16 restores the checkpoint leader').toBe(savedLeader);
      expect(mission.state.l6!.mainPower).toBe(savedPower);
      expect(mission.state.l6!.gates[0].closedAt).toBe(0);
      snapshotRestored = true;
    }, SimPhase.cleanup);
    const deaths = w.events.events().filter(e => e.type === 'player.respawned').length;
    w.player!.damage(1000, w.tick, true);
    for (let i = 0; i < 360; i++) w.update();
    stop();
    expect(snapshotRestored, 'death restores survivor health/position, leader, gates and power').toBe(true);
    expect(w.events.events().filter(e => e.type === 'player.respawned')).toHaveLength(deaths + 1);
    expect(mission.state.phase, 'the real death retry restores the checkpoint').toBe('playing');
    const restored = mission.state.l6!;
    expect(restored.leaderZ, 'the restored evacuation resumes walking').toBeGreaterThan(savedLeader);
    expect(restored.survivors.find(r => r.id === memberId)!.status).toBe('following');
    expect(w.entities.get(memberId)!.civilian!.survivor!.mode).toBe('follow');
    const leaderX = restored.leaderX;
    for (let i = 0; i < 600; i++) w.update();
    expect(restored.leaderZ, 'the retreat column leaves the shelter approach after checkpoint retry').toBeGreaterThan(10);
    expect(restored.leaderX, 'the retreat leader advances after checkpoint retry').toBeGreaterThan(leaderX);
    expect(restored.survivors.every(r => r.status !== 'shelter'), 'no survivor remains in the shelter-only state').toBe(true);
  } finally { w.dispose(); }
  await shelterRecoveryIsShared();
  await northgateSurvivorsStayVisible();
  await l6FollowersCatchUpOnRoute();
  await l7DistanceAloneDoesNotPrompt();
});

async function northgateSurvivorsStayVisible(): Promise<void> {
  const w = await loadMissionLevel('L6', 1);
  try {
    const m = w.missions!;
    m.completeObjective('shelter'); m.completeObjective('stop'); m.completeObjective('retreat');
    for (const e of [...w.infected!.active]) w.infected!.release(e);
    const s = m.state.l6!;
    for (const [i, row] of s.survivors.entries()) {
      row.status = 'following';
      w.solids.relocate(w.entities.get(row.id)!, { x: 263.2 + Math.floor(i / 6) * .8, y: 4.62, z: 12 + (i % 6) * 1.2 }, 'test.northgate-exit', 0, false);
    }
    w.solids.relocate(w.entities.get(1)!, { x: 269, y: 4.62, z: 19 }, 'test.northgate-courier', 0, false);
    w.update();
    expect(s.survivors.every(row => row.status === 'out')).toBe(true);
    expect(m.state.subtitle?.text).toBe('The survivors are safe.');
    const before = s.survivors.map(row => w.entities.get(row.id)!.transform.x);
    for (let i = 0; i < 120; i++) w.update();
    expect(s.survivors.every(row => !w.entities.get(row.id)!.hidden), 'rescued actors remain visible through the end shot').toBe(true);
    expect(s.survivors.some((row, i) => w.entities.get(row.id)!.transform.x > before[i] + 1), 'evacuees walk clear of the exit instead of vanishing').toBe(true);
    expect(s.gateAt, 'the visible group still permits normal Northgate closure').toBeGreaterThan(0);
  } finally { w.dispose(); }
}

async function shelterRecoveryIsShared(): Promise<void> {
  const w = await loadMissionLevel('L6', 1);
  try {
    const m = w.missions!, ai = w.infected!, s = m.state.l6!;
    w.combat!.damage.god = true;
    const old = w.entities.get(ai.spawn('infected.runner', { x: 40, z: 15 }))!;
    const hatch = w.entities.get(ai.spawn('infected.runner', { x: 44, z: 15 }))!;
    for (const [e, wave] of [[old, 1], [hatch, 4]] as const) s.spawnLog.push({ id: e.id, wave, door: wave === 1 ? 0 : 2, tick: w.tick, x: e.transform.x, z: e.transform.z, offscreen: true });
    let attackId = 10000;
    const hit = (e: typeof old) => w.combat!.damage.apply({ attackId: ++attackId, actionId: 'weapon.bat', sourceId: 1, targetId: e.id,
      origin: w.entities.get(1)!.transform, direction: { x: 1, z: 0 }, base: 1000, multiplier: 1, type: 'melee', knockback: 0, stagger: 0 });
    hit(old); hit(old); hit(hatch);
    expect(old.infected!.downs).toBe(2);
    expect(old.infected!.knockdowns).toBe(1);
    s.phase = 'retreat'; m.l6!.update();
    expect(old.infected!.recoverAt, 'floor hits cannot finish the first real knockdown').toBeGreaterThan(w.tick);
    const up = Math.max(old.infected!.recoverAt, hatch.infected!.recoverAt);
    while (w.tick <= up) w.update();
    expect(old.health.current).toBeGreaterThan(0); expect(hatch.health.current).toBeGreaterThan(0);
    s.phase = 'fails'; hit(old); hit(hatch); m.l6!.update();
    expect(old.infected!.knockdowns).toBe(2); expect(hatch.infected!.knockdowns).toBe(2);
    expect(old.infected!.recoverAt, 'a repeated nonlethal down still schedules recovery').toBeGreaterThan(w.tick);
    s.phase = 'retreat'; m.l6!.update();
    expect(old.infected!.recoverAt, 'retreat cannot turn an ordinary down into a permanent death').toBeGreaterThan(w.tick);
    expect(hatch.infected!.recoverAt, 'new hatch cohorts retain ordinary recovery').toBeGreaterThan(w.tick);
    for (let i = 0; i < 180; i++) w.update();
    expect(w.entities.get(old.id), 'the shelter member keeps its identity and recovery').toMatchObject({ id: old.id, health: { current: 0 } });
    expect(w.entities.get(old.id)!.corpse).toBeFalsy();
    const nextUp = Math.max(old.infected!.recoverAt, hatch.infected!.recoverAt);
    while (w.tick <= nextUp) w.update();
    expect(old.health.current).toBeGreaterThan(0); expect(hatch.health.current).toBeGreaterThan(0);
    expect(w.entities.get(hatch.id)!.corpse).toBeFalsy();
    // The completion driver counters a visible heavy attack through the real
    // selector, and keeps its shotgun through knockback instead of swapping
    // every time the target crosses a distance threshold.
    const p = w.entities.get(1)!.transform;
    const heavy = w.entities.get(ai.spawn('infected.armored', { x: p.x + 3, z: p.z }))!;
    const bot = new LevelSixBot(w), rack = w.entities.get(1)!.weapons!.RIGHT.rack;
    const mg = rack.findIndex(slot => slot.id === 'weapon.army-mg'), shotgun = rack.findIndex(slot => slot.id === 'weapon.shotgun');
    expect(shotgun).toBeGreaterThanOrEqual(0);
    heavy.infected!.state = 'chase'; expect(bot.sample().selectedSlot).toEqual({ side: 'RIGHT', index: mg });
    heavy.infected!.state = 'attack'; expect(bot.sample().selectedSlot).toEqual({ side: 'RIGHT', index: shotgun });
    heavy.infected!.state = 'chase'; expect(bot.sample().selectedSlot).toEqual({ side: 'RIGHT', index: shotgun });
    heavy.health.current = 0; expect(bot.sample().selectedSlot).toBeUndefined();
    heavy.health.current = heavy.health.max; heavy.infected!.state = 'attack';
    w.combat!.setLoadout(['weapon.fire-axe'], ['weapon.army-mg']);
    expect(bot.sample().selectedSlot, 'the policy cannot select or grant a missing weapon').toEqual({ side: 'RIGHT', index: 0 });
  } finally { w.dispose(); }
}
