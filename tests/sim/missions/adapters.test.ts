import { afterEach, expect, test } from 'vitest';
import { emptyInput } from '../../../src/input/InputFrame';
import { campaignMission } from '../../../src/levels/missions';
import type { MissionDef, Trigger } from '../../../src/sim/missions/types';
import { SimWorld } from '../../../src/sim/world/SimWorld';

let world: SimWorld;
afterEach(() => world?.dispose());
function definition(complete: Trigger): MissionDef {
  return { id: 'adapters', briefing: 'Adapter test', anchors: { goal: { x: 6, z: 0, radius: 2 }, spawn: { x: 0, z: -1.45, radius: 2 } }, actors: {}, groups: {}, gates: {}, items: [], states: [], counters: [], checkpoints: ['C'], cinematics: {},
    steps: [{ id: 'objective', type: 'custom', text: 'Complete objective', anchor: 'goal', start: { kind: 'start' }, complete, fail: [] }], finish: ['objective'], onStart: [], onComplete: [] };
}
async function load(def: MissionDef, scenario = 'combat-arena') {
  world = new SimWorld(); await world.init(); world.loadScenario(scenario); return world.loadMission(def);
}
function ticks(n: number) { for (let i = 0; i < n; i++) world.update(); }
function walk(x: number, z = 0, n = 60) { world.applyInput({ ...emptyInput(), move: { x, z } }, 'keyboard'); ticks(n); world.clearInput(); ticks(30); }

for (const kind of ['breaker', 'lever', 'radio'] as const) test(`@E12 @E22-AC04 ${kind}: stand progress, damage notch, no instant press, checkpoint restore`, async () => {
  const def = definition({ kind: 'interact', anchor: 'goal', seconds: 3, actor: 'device' });
  def.anchors.goal = { x: 0, z: 0, radius: 2 };
  def.actors.device = { kind: 'device', archetype: `device.${kind}`, faction: 'environment', anchor: 'goal', hp: 100, device: { holdTime: 3, radius: 2, instant: false, interruptOnDamage: true } };
  def.groups.device = ['device']; def.onStart = [{ kind: 'spawn', group: 'device' }];
  const mission = await load(def); mission.begin();
  world.applyInput({ ...emptyInput(), interact: true }, 'keyboard'); ticks(1); world.clearInput();
  expect(mission.state.completedObjectives).toEqual([]);
  ticks(98); const id = mission.state.actors.device; expect(world.entities.get(id)!.interactable!.progress).toBeCloseTo(.55);
  world.player!.damage(5, world.tick); expect(world.entities.get(id)!.interactable!.progress).toBe(.5);
  mission.checkpoint('C'); ticks(10); mission.restore('C'); expect(world.entities.get(id)!.interactable!.progress).toBe(.5);
  ticks(89); expect(mission.state.phase).toBe('playing'); ticks(1); expect(mission.state.phase).toBe('result');
});
test('@E12 devices stop progress while moving or outside their radius', async () => {
  const def = definition({ kind: 'interact', actor: 'device', anchor: 'goal', seconds: 3 }); def.anchors.goal.x = 0;
  def.actors.device = { kind: 'device', archetype: 'device.breaker', faction: 'environment', anchor: 'goal', hp: 100, device: { holdTime: 3, instant: false, radius: 2 } };
  def.groups.device = ['device']; def.onStart = [{ kind: 'spawn', group: 'device' }];
  const mission = await load(def); mission.begin(); ticks(60); const id = mission.state.actors.device;
  walk(1, 0, 90); expect(world.entities.get(id)!.interactable!.progress).toBe(0); ticks(200); expect(mission.state.phase).toBe('playing');
});
test('@E12 vehicle actor: enter, drive to the zone, exit; state signals alone cannot complete it', async () => {
  const def = definition({ kind: 'drive', actor: 'car', anchor: 'goal', exit: true }); def.anchors.goal.radius = 4;
  def.actors.car = { kind: 'vehicle', archetype: 'vehicle.sedan', faction: 'survivor', anchor: 'spawn', hp: 300 };
  def.groups.car = ['car']; def.states = ['driving:car']; def.onStart = [{ kind: 'spawn', group: 'car' }];
  const mission = await load(def); mission.begin(); const car = mission.state.actors.car;
  mission.setState('driving:car', true); ticks(1); expect(mission.state.phase).toBe('playing');
  world.applyInput({ ...emptyInput(), interact: true }, 'keyboard'); ticks(1); expect(world.vehicles!.active).toBe(car);
  world.applyInput({ ...emptyInput(), drive: { throttle: .6, steer: 0 } }, 'keyboard');
  for (let i = 0; i < 600 && !mission.state.steps.objective.driveArrived; i++) world.update();
  expect(mission.state.steps.objective.driveArrived).toBe(true); expect(world.entities.get(car)!.transform.x).toBeGreaterThan(2);
  expect(mission.state.phase).toBe('playing');
  world.applyInput({ ...emptyInput(), brake: true }, 'keyboard'); ticks(60);
  world.applyInput({ ...emptyInput(), interact: true, brake: true }, 'keyboard'); ticks(1);
  expect(world.vehicles!.active).toBe(null); expect(mission.state.phase).toBe('result');
  expect(world.events.events().filter(e => e.type === 'vehicle.entered' || e.type === 'vehicle.exited')).toHaveLength(2);
});
test('@E12 escort arrival requires the living follower inside the destination', async () => {
  const def = definition({ kind: 'escort', actor: 'follower', anchor: 'goal' }); def.anchors.goal.radius = 4;
  def.actors.follower = { kind: 'escort', archetype: 'escort.brother', faction: 'escort', anchor: 'spawn', hp: 100 };
  def.groups.follower = ['follower']; def.onStart = [{ kind: 'spawn', group: 'follower' }];
  def.steps[0].type = 'escort';
  const mission = await load(def, 'turning-probe'); mission.begin(); ticks(1); expect(mission.state.completedObjectives).toEqual([]);
  world.applyInput({ ...emptyInput(), move: { x: 1, z: 0 } }, 'keyboard');
  for (let i = 0; i < 180 && mission.state.phase === 'playing'; i++) world.update();
  expect(mission.state.phase).toBe('result'); expect(mission.state.stats.rescued).toBe(1);
  const follower = world.entities.get(mission.state.actors.follower)!; expect(follower.escort!.child).toBe(true); expect(Math.hypot(follower.transform.x - 6, follower.transform.z)).toBeLessThanOrEqual(4);
});
test('@E12 hold zone resets on departure and a defend target dying fails immediately', async () => {
  const def = definition({ kind: 'all', triggers: [{ kind: 'hold', anchor: 'goal', seconds: 2 }, { kind: 'state', key: 'power', equals: true }] }); def.states = ['power']; def.onStart = [{ kind: 'state', key: 'power', value: true }]; def.anchors.goal.x = 0;
  def.actors.target = { kind: 'defend', archetype: 'defend.bus', faction: 'survivor', anchor: 'goal', hp: 100 };
  def.groups.target = ['target']; def.onStart.push({ kind: 'spawn', group: 'target' }); def.steps[0].fail = [{ trigger: { kind: 'dead', actor: 'target' }, reason: 'target-destroyed' }];
  const mission = await load(def); mission.begin(); ticks(60); expect(mission.state.steps.objective.holds?.goal).toBe(60);
  walk(1, 0, 75); expect(mission.state.steps.objective.holds?.goal).toBe(0);
  mission.restore(); ticks(119); expect(mission.state.phase).toBe('playing'); ticks(1); expect(mission.state.phase).toBe('result');
  mission.restore(); world.combat!.damage.apply({ targetId: mission.state.actors.target, sourceId: 1, attackId: 0, actionId: 'weapon.bat', origin: world.entities.get(1)!.transform, direction: { x: 0, z: 0 }, base: 100, multiplier: 1, type: 'explosive', knockback: 0, stagger: 0 }); ticks(1);
  expect(mission.state.failure).toBe('target-destroyed');
});
test('@E12 destroy object via ordinary targeted attacks removes its blocker', async () => {
  const def = definition({ kind: 'destroy', actor: 'object' }); def.anchors.goal.x = 2;
  def.actors.object = { kind: 'prop', archetype: 'prop.barricade', faction: 'environment', anchor: 'goal', hp: 60 };
  def.groups.object = ['object']; def.onStart = [{ kind: 'spawn', group: 'object' }];
  const mission = await load(def); mission.begin(); const id = mission.state.actors.object;
  world.applyInput({ ...emptyInput(), attackTarget: { id, side: 'LEFT' }, left: { down: false, held: true, up: false } }, 'keyboard'); ticks(600);
  expect(mission.state.phase).toBe('result'); expect(world.entities.get(id)!.destructible!.broken).toBe(true); expect(world.interactables!.walls).toHaveLength(0);
});
test('@E12 pickup item enters mission and device inventories once and survives checkpoint retry', async () => {
  const def = definition({ kind: 'items', ids: ['fuse'] }); def.items = ['fuse'];
  def.actors.fuse = { kind: 'pickup', archetype: 'pickup.item', faction: 'environment', anchor: 'goal', hp: 1, item: 'fuse' };
  def.groups.fuse = ['fuse']; def.onStart = [{ kind: 'spawn', group: 'fuse' }];
  const mission = await load(def); mission.begin(); mission.checkpoint('C'); ticks(1); expect(mission.state.items).toEqual([]); walk(1, 0, 120);
  expect(mission.state.phase).toBe('result'); expect(mission.state.items).toEqual(['fuse']); expect(world.entities.get(1)!.inventory).toEqual(['fuse']);
  mission.restore('C'); expect(world.entities.get(1)!.inventory).toBeUndefined(); expect(mission.state.items).toEqual([]);
  expect(world.entities.get(mission.state.actors.fuse)!.pickup).toMatchObject({ collected: false }); walk(1, 0, 120);
  mission.checkpoint('C'); mission.restore('C'); expect(mission.state.items).toEqual(['fuse']); expect(world.entities.get(mission.state.actors.fuse)!.pickup).toMatchObject({ collected: true });
});
test('@E21 @E21-AC07 L3 uses a single 12-minute deadline; graph transitions do not reset it', async () => {
  const def = campaignMission('L3', () => ({ x: 10, z: 0, radius: 2 }));
  expect(def.deadline).toEqual({ seconds: 720, retryGraceSeconds: 60 }); expect(def.steps.every(s => s.timer === undefined)).toBe(true);
  const mission = await load(def); mission.begin(); ticks(120); expect(mission.state.deadlineTicks).toBe(43080);
  mission.completeObjective('forecourt'); mission.completeObjective('car'); expect(mission.state.deadlineTicks).toBe(43080);
  ticks(60); mission.checkpoint('checkpoint'); const remaining = mission.state.deadlineTicks!;
  ticks(remaining - 1); expect(mission.state.phase).toBe('playing'); ticks(1);
  expect(mission.state.phase).toBe('retry'); expect(world.events.events()).toContainEqual({ type: 'mission.failed', tick: 43200, reason: 'timeout' });
  ticks(120); expect(world.tick).toBe(43200); mission.restore(); expect(mission.state.deadlineTicks).toBe(remaining + 3600); expect(mission.state.completedObjectives).toEqual(['forecourt', 'car']);
  ticks(remaining + 3600); expect(mission.state.failure).toBe('timeout'); mission.restore(); expect(mission.state.deadlineTicks).toBe(remaining + 3600); // no accumulating grace
});
test('@E21 @E21-AC07 ordinary checkpoint restore gets no timeout grace; cinematics pause the global clock', async () => {
  const def = definition({ kind: 'hold', anchor: 'goal', seconds: 2 }); def.deadline = { seconds: 720, retryGraceSeconds: 60 };
  def.cinematics.pause = { seconds: 1, caption: 'Pause', position: [0, 2, 0], target: [0, 0, 0], actions: [] };
  const mission = await load(def); mission.begin(); ticks(60); mission.checkpoint('C'); ticks(60); mission.restore(); expect(mission.state.deadlineTicks).toBe(43140);
  mission.state.phase = 'cinematic'; mission.state.cinematic = { id: 'pause', elapsed: 0, resume: 'playing' }; ticks(60); expect(mission.state.deadlineTicks).toBe(43140); ticks(1); expect(mission.state.deadlineTicks).toBe(43139);
});

test('@E12 driver death ejects and reaches checkpoint respawn through the normal cleanup phase', async () => {
  const def = definition({ kind: 'drive', actor: 'car', anchor: 'goal' });
  def.actors.car = { kind: 'vehicle', archetype: 'vehicle.sedan', faction: 'survivor', anchor: 'spawn', hp: 300 };
  def.groups.car = ['car']; def.onStart = [{ kind: 'spawn', group: 'car' }];
  const mission = await load(def); mission.begin(); mission.checkpoint('C');
  world.applyInput({ ...emptyInput(), interact: true }, 'keyboard'); ticks(1); world.clearInput(); expect(world.vehicles!.active).toBe(mission.state.actors.car);
  world.player!.damage(1000, world.tick); ticks(1); expect(world.vehicles!.active).toBe(null); expect(world.entities.get(1)!.hidden).toBe(false);
  ticks(120); expect(world.entities.get(1)!.health.current).toBe(100); expect(mission.state.stats.deaths).toBe(1); expect(mission.state.phase).toBe('playing');
});
test('@E26 mission barricade actors use real HP/blockers, emit filtered break events and restore at checkpoints', async () => {
  const def = definition({ kind: 'event', type: 'barricade.broken', actor: 'rail', count: 1 });
  def.actors.rail = { kind: 'barricade', archetype: 'barricade.bridge-blockade', faction: 'environment', anchor: 'goal', hp: 180 };
  def.groups.rail = ['rail']; def.onStart = [{ kind: 'spawn', group: 'rail' }];
  const mission = await load(def); mission.begin(); const id = mission.state.actors.rail;
  expect(world.barricades!.barricadeIntact('barricade.bridge-blockade')).toBe(true); expect(world.entities.get(id)!.kind).toBe('barricade');
  mission.checkpoint('C'); world.hazards!.hit(id, 180, 'bullet'); ticks(1);
  expect(mission.state.phase).toBe('result'); expect(world.barricades!.barricadeIntact('barricade.bridge-blockade')).toBe(false);
  mission.restore('C'); expect(world.barricades!.barricadeIntact('barricade.bridge-blockade')).toBe(true); expect(world.entities.get(id)!.health.current).toBe(180);
});
