// Mission runtime: one objective graph engine (schema, triggers, timers, checkpoints, retry) runs all ten levels.
// Level content itself is covered by the nightly campaign bot, not here.
import { afterEach, expect, test } from 'vitest';
import { emptyInput } from '../../src/input/InputFrame';
import { missionControls } from '../../src/sim/missions/controls';
import { validateMission } from '../../src/sim/missions/schema';
import { objectiveTypes, type MissionDef } from '../../src/sim/missions/types';
import { SimWorld } from '../../src/sim/world/SimWorld';
import type { EntitySnapshot } from '../../src/sim/world/types';
import { isMissionInteraction } from '../../src/render/InteractionView';
import { activeInteractions, isCurrentOpenL6Gate, isRingedInteraction } from '../../src/sim/missions/interaction';
import { LevelSixSubway } from '../../src/sim/missions/LevelSixSubway';
import { loadLevel, runnerLevels } from '../../tools/sim-runner/levels';
import { missionSandbox } from '../fixtures/scenarios/mission-sandbox';

let world: SimWorld | undefined;
afterEach(() => { world?.dispose(); world = undefined; });
async function load(def = missionSandbox()) {
  world?.dispose();
  world = new SimWorld(); await world.init(); world.loadScenario('combat-arena', 1); world.scenario = 'mission-sandbox'; world.loadMission(def);
  const api = missionControls(world); api.begin(); return api;
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

// P09: the ground ring (render), the `E` press (input) and the view read one mission interaction descriptor in every level.
test('interactions: ring, input and view predicates agree for every interact step of every level', async () => {
  for (const level of runnerLevels) {
    const levelWorld = await loadLevel(level, 1);
    try {
      const mission = levelWorld.missions!, player = levelWorld.entities.get(1)!;
      mission.state.phase = 'playing';
      let checked = 0;
      for (const step of mission.def.steps) {
        for (const other of mission.def.steps) mission.state.steps[other.id].status = other.id === step.id ? 'active' : 'pending';
        if (level === 'L10') mission.state.states['charge-active'] = false;
        const [interaction] = activeInteractions(mission).filter(i => i.step.id === step.id);
        if (!interaction) continue;
        const anchor = mission.def.anchors[interaction.trigger.anchor];
        Object.assign(player.transform, { x: anchor.x, z: anchor.z });
        expect(mission.interactStepInRange()?.id, `${level} ${step.id} input`).toBe(step.id);
        const entity = { archetype: 'prop', transform: { x: anchor.x, z: anchor.z } } as EntitySnapshot;
        expect(isRingedInteraction(mission, entity.transform), `${level} ${step.id} ring`).toBe(interaction.ring);
        expect(isMissionInteraction(levelWorld, entity), `${level} ${step.id} view`).toBe(interaction.ring);
        Object.assign(player.transform, { x: anchor.x + 500, z: anchor.z + 500 });
        expect(mission.interactStepInRange()?.id === step.id, `${level} ${step.id} far input`).toBe(false);
        expect(isRingedInteraction(mission, { x: anchor.x + 500, z: anchor.z + 500 })).toBe(false);
        checked++;
      }
      if (['L2', 'L3', 'L4', 'L5'].includes(level)) expect(checked, level).toBeGreaterThan(0);
    } finally { levelWorld.dispose(); }
  }
}, 240_000);

// N11: the L6 service gates have their own predicate (the group's waypoint, else the next open gate ahead of the leader).
test('interactions: only the open L6 gate the group is heading for offers its prompt', () => {
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
});

test('checkpoints: death restores objectives, HP, charges and escorts; a boss killed before or after C stays dead', async () => {
  const def = missionSandbox('kill'); def.steps.push({ ...def.steps[0], id: 'reach', type: 'reach', start: { kind: 'objectives', ids: ['kill'], mode: 'all' }, complete: { kind: 'volume', anchor: 'goal', edge: 'inside' } }); def.finish = ['reach'];
  const api = await load(def), actor = api.state()!.actors;
  kill(actor.boss); api.completeObjective('kill'); world!.entities.get(1)!.weapons!.RIGHT.rack[0].charges = 2;
  teleport(1, 1); api.checkpoint('C'); const saved = api.state()!;
  teleport(actor.escort, 20); world!.entities.get(1)!.weapons!.RIGHT.rack[0].charges = 0;
  world!.player!.damage(1000, world!.tick); step(120);
  expect(api.state()!.completedObjectives).toEqual(saved.completedObjectives); expect(world!.entities.get(1)!.health.current).toBe(100);
  expect(world!.entities.get(1)!.weapons!.RIGHT.rack[0].charges).toBe(2); expect(world!.entities.get(actor.escort)!.transform.x).toBe(-5);
  expect(world!.entities.get(actor.boss)!.health.current).toBe(0); expect(api.state()!.stats.deaths).toBe(1);

  const after = missionSandbox('kill'); after.steps.push({ ...after.steps[0], id: 'next', type: 'reach', start: { kind: 'objectives', ids: ['kill'], mode: 'all' }, complete: { kind: 'volume', anchor: 'goal', edge: 'inside' } }); after.finish = ['next'];
  const b = await load(after); b.checkpoint('C'); const boss = b.state()!.actors.boss; kill(boss); step();
  world!.player!.damage(1000, world!.tick); step(120);
  expect(world!.entities.get(boss)!.health.current).toBe(0); step(); expect(b.state()!.completedObjectives).toEqual(['kill']);
});
