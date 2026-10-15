import { applyCampaign } from '../../src/sim/progression/apply';
import { preset } from '../../src/sim/progression/Campaign';
import { afterEach, expect, test } from 'vitest';
import { SimWorld } from '../../src/sim/world/SimWorld';
import { WeatherSystem } from '../../src/sim/weather/WeatherSystem';
import { weatherKinds, weatherPresets, weatherTimelines } from '../../src/data/weather';
import { Perception } from '../../src/sim/ai/Perception';
import { arena, equip, fire, step } from './combat/helpers';
const worlds: SimWorld[] = [];
afterEach(() => { for (const w of worlds) w.dispose(); worlds.length = 0; });
async function load() { const w = await arena(); worlds.push(w); return w; }
function weatherTicks(w: SimWorld, n: number) { for (let i = 0; i < n; i++) { w.tick++; w.weather!.update(); } }
test.each(['L1', 'L3', 'L5'])('live weather %s @E28 seeded continuous authored blend', async level => {
  const a = await load(), b = await load();
  for (const w of [a, b]) { w.scenario = level; w.weather = new WeatherSystem(w, 28); }
  const [start, end] = weatherTimelines[level];
  expect(end.blend).toBeGreaterThanOrEqual(20); expect(end.blend).toBeLessThanOrEqual(60);
  const from = { ...weatherPresets[start.kind], ...start.preset }, to = { ...weatherPresets[end.kind], ...end.preset };
  for (let tick = 1; tick <= end.tick + end.blend! * 60; tick++) {
    const previous = a.weather!.snapshot(); weatherTicks(a, 1); weatherTicks(b, 1);
    for (const field of ['rain', 'fog', 'flakes', 'clouds'] as const) expect(Math.abs(a.weather![field] - previous[field])).toBeLessThan(.002);
    if (tick % 60 === 0) expect(a.weather!.snapshot()).toEqual(b.weather!.snapshot());
    if (tick === end.tick || tick === end.tick + end.blend! * 30 || tick === end.tick + end.blend! * 60) {
      const ratio = (tick - end.tick) / (end.blend! * 60);
      for (const field of ['rain', 'fog', 'flakes', 'clouds'] as const) expect(a.weather![field]).toBeCloseTo(from[field] + (to[field] - from[field]) * ratio, 8);
    }
  }
  expect(a.weather!.kind).toBe(end.kind);
});
test('live rain @E28 blend onset, wetness and clearing stay continuous', async () => {
  const w = await load(); w.weather!.setTimeline([{ tick: 0, kind: 'clear' }, { tick: 60, kind: 'rain', blend: 20 }, { tick: 3660, kind: 'clear', blend: 20 }]);
  weatherTicks(w, 60); expect(w.weather!.rain).toBe(0);
  weatherTicks(w, 600); expect(w.weather!.rain).toBeCloseTo(.5); expect(w.weather!.modifiers.vehicleGrip).toBeCloseTo(.925);
  weatherTicks(w, 600); expect(w.weather!.rain).toBe(1); expect(w.weather!.wetness).toBeGreaterThan(0);
  weatherTicks(w, 2400); const wet = w.weather!.wetness;
  weatherTicks(w, 1200); expect(w.weather!.rain).toBe(0); expect(w.weather!.wetness).toBeGreaterThanOrEqual(wet);
  const peak = w.weather!.wetness; weatherTicks(w, 5400); expect(w.weather!.wetness).toBeCloseTo(peak / 2, 8);
});
test('T-E28-01 @E28 @E28-AC01 seeded gust/lightning/wetness timeline and campaign keys', async () => {
  const a = await load(), b = await load();
  for (const w of [a, b]) w.weather!.setOverride('thunderstorm');
  for (let tick = 1; tick <= 3600; tick++) { weatherTicks(a, 1); weatherTicks(b, 1); if (tick % 60 === 0) expect(a.weather!.snapshot()).toEqual(b.weather!.snapshot()); }
  expect(a.events.events().filter(e => e.type === 'weather.lightning').length).toBeGreaterThan(2);
  expect(a.events.events()).toEqual(b.events.events());
  for (const level of ['L1', 'L2', 'L3', 'L4', 'L5', 'L6']) {
    a.scenario = level; a.tick = 0; a.weather = new WeatherSystem(a, 1);
    for (const key of weatherTimelines[level]) { a.tick = key.tick; a.weather.update(); expect(a.weather.kind).toBe(key.kind); }
  }
});
test('T-E28-02 @E28 @E28-AC02 rain changes real noise, Molotov duration and wheel friction', async () => {
  const w = await load(); w.weather!.setOverride('rain'); equip(w, ['weapon.pistol']); fire(w); step(w, 3);
  expect(w.events.events().some(e => e.type === 'noise' && e.radius === 20)).toBe(true);
  equip(w, ['weapon.molotov']); fire(w, 'LEFT', { x: 1, z: 0 }, { x: 6, z: 0 }); step(w, 40);
  const z = w.combat!.effects.zones.find(z => z.kind === 'fire')!;
  expect(z.expires - z.created).toBe(216);
  const id = w.vehicles!.spawn('vehicle.sedan', { x: 10, z: 10 }); step(w, 1);
  const car = w.vehicles!.cars.get(id)!;
  expect(car.physics.controller.wheelFrictionSlip(0)).toBeCloseTo(car.physics.def.handling.grip * .85);
  expect(w.getState().weather!.modifiers).toMatchObject({ noiseRadius: .8, fireDuration: .6, vehicleGrip: .85 });
});
test('T-E28-03 @E28 @E28-AC03 heavy rain saturates in 60 seconds and dries with 90s half-life', async () => {
  const w = await load(); w.weather!.setOverride('rain'); weatherTicks(w, 3600);
  expect(w.weather!.wetness).toBeGreaterThanOrEqual(.8); const wet = w.weather!.wetness;
  w.weather!.setOverride('clear'); weatherTicks(w, 5400); expect(w.weather!.wetness).toBeCloseTo(wet / 2, 8);
});
test('T-E28-04 @E28 @E28-AC04 lightning reveals only within 40m for 30 ticks and delays thunder by distance', async () => {
  const w = await load(); const p = w.entities.get(1)!.transform;
  const near = w.spawnDummy('infected.runner', { x: p.x + 39.9, z: p.z }), far = w.spawnDummy('infected.runner', { x: p.x + 40.1, z: p.z });
  w.weather!.strike({ x: p.x + 340, y: 0, z: p.z });
  expect(w.weather!.reveals.has(near)).toBe(true); expect(w.weather!.reveals.has(far)).toBe(false);
  weatherTicks(w, 29); expect(w.weather!.reveals.has(near)).toBe(true); weatherTicks(w, 1); expect(w.weather!.reveals.size).toBe(0);
  weatherTicks(w, 30); expect(w.events.events()).toContainEqual({ type: 'weather.thunder', tick: 60, strikeTick: 0, position: { x: p.x + 340, y: 0, z: p.z } });
});
test('T-E28-05 @E28 @E28-AC05 fog perception uses 60% of the ordinary sight range', async () => {
  const w = await load(), sight = new Perception(w), id = w.spawnDummy('infected.runner', { x: 0, z: 0 }, { yaw: 0 });
  const e = w.entities.get(id)!;
  expect(sight.sees(e, { x: sight.rangeM * .8, z: 0 })).toBe(true);
  w.weather!.setOverride('fog'); expect(sight.sees(e, { x: sight.rangeM * .8, z: 0 })).toBe(false);
  expect(sight.sees(e, { x: sight.rangeM * .59, z: 0 })).toBe(true);
});
test('T-E28-06 @E28 @E28-AC06 wind biases at least 60% of spread cells downwind over 20 trials', async () => {
  const w = await load(); w.weather!.setOverride('wind'); let downwind = 0;
  for (let i = 0; i < 20; i++) {
    const id = w.hazards!.spawn('fire', { x: i * 12, z: 0 }, { duration: 2, spread: 1 });
    const parent = w.entities.get(id)!; w.tick = parent.hazard!.spreadAt!;
    const ids = new Set(w.entities.values().map(e => e.id)); w.hazards!.update();
    const child = w.entities.values().find(e => !ids.has(e.id) && e.hazard?.kind === 'fire')!;
    expect(child).toBeDefined();
    if ((child.transform.x - parent.transform.x) * w.weather!.wind.x + (child.transform.z - parent.transform.z) * w.weather!.wind.z > 0) downwind++;
    w.tick += 600; w.hazards!.update();
  }
  expect(downwind / 20).toBeGreaterThanOrEqual(.6);
});
test('T-E28-07 @E28 @E28-AC07 moving player/infected record tracks and snow/ash apply grip', async () => {
  const w = await load(); const id = w.spawnDummy('infected.runner', { x: 5, z: 0 });
  for (const kind of ['snow', 'ash'] as const) {
    w.weather!.setOverride(kind);
    weatherTicks(w, 1); // Establish stationary anchors; weather onset must not stamp a step.
    for (let i = 0; i < 50; i++) { const delta = i % 20 < 10 ? .5 : -.5; w.entities.get(1)!.transform.x += delta; w.entities.get(id)!.transform.z += delta; weatherTicks(w, 1); }
    expect(w.weather!.tracks.filter(t => t.id === 1).length).toBeGreaterThanOrEqual(50);
    expect(w.weather!.tracks.filter(t => t.id === id).length).toBeGreaterThanOrEqual(50);
    expect(w.weather!.modifiers.vehicleGrip).toBe(kind === 'snow' ? .6 : .9);
  }
  expect(weatherKinds).toContain('snow');
});

test('T-E28-08 @E28 @E28-AC08 every override preserves all registered mission graph walks', async () => {
  const { readFileSync } = await import('node:fs');
  const { compositions } = await import('../../src/levels/compositions');
  const { missionIds, resolveCampaignMission } = await import('../../src/levels/missions');
  const rows = [];
  for (const id of missionIds) {
    const w = new SimWorld(); await w.init(); const c = compositions[id], layouts=c.districts.map(d=>JSON.parse(readFileSync(`public/assets/layouts/${d.id}.layout.json`, 'utf8')));
    w.loadComposition(c,layouts,28);
    if (id === 'L10') applyCampaign(w, preset('L10-default'));
    const m = w.loadMission(resolveCampaignMission(id, w.districts!)); m.begin();
    for (const kind of weatherKinds) {
    // Compare the same authored cast from its production start snapshot. Loading another
    // mission on the previous cast stacked parked hulls and duplicated zoo/APC residents.
    if (kind !== weatherKinds[0]) m.restore('start', true);
    w.weather!.setOverride(kind);
    let guard = 0, runOutTicks = 0;
    while (m.state.phase === 'playing' && guard < 100) {
      // Shared run-out advances sim time after the final objective, rather than completing another objective.
      if (m.state.runOutUntil !== undefined) {
        expect(++runOutTicks, `${id}/${kind} run-out must finish`).toBeLessThan(1200);
        w.update(); continue;
      }
      guard++; m.completeObjective();
    }
    expect(guard).toBeLessThan(100); expect(['cinematic', 'result', 'progression']).toContain(m.state.phase);
    expect(w.solids.failures, JSON.stringify(w.solids.offenders)).toBe(0);
    rows.push({ id, kind, steps: [...m.state.completedObjectives], phase: m.state.phase });
    }
    w.dispose();
  }
  for (const id of missionIds) { const level = rows.filter(r => r.id === id); for (const r of level) expect(r.steps).toEqual(level[0].steps); }
}, 120_000);

test('T-E28-06b @E28 @E28-AC06 strong gusts move light Rapier props', async () => {
  const { PropSystem } = await import('../../src/sim/interact/PropSystem');
  const { SimPhase } = await import('../../src/core/EventBus');
  const run = async (wind: boolean) => {
    const w = await load(); w.props = new PropSystem(w);
    w.props.spawn({ id: 'cone', assetId: 'prop.traffic-cone', position: [0, 0, 0], yaw: 0, scale: [1, 1, 1], minTier: 0, maxTier: 5, allowRoad: true, lightGroup: '', visualAabb: { min: [-.2, 0, -.2], max: [.2, .6, .2] } }); w.props.settle();
    w.events.on('sim.tick', () => w.props!.prePhysics(), SimPhase.ai); w.events.on('sim.tick', () => w.props!.postPhysics(), SimPhase.physics);
    w.weather!.setOverride(wind ? 'wind' : 'clear');
    const prop = w.props.items[0], start = prop.body.translation();
    for (let i = 0; i < 180; i++) { if (wind) w.weather!.gust = 1; w.update(); }
    const end = prop.body.translation(); return Math.hypot(end.x - start.x, end.z - start.z);
  };
  const clear = await run(false), wind = await run(true); expect(wind).toBeGreaterThan(clear + .1);
});

test('footprints @E28 @E28-AC07 alternate at stride distance and reject airborne/teleported steps', async () => {
  const w = await load(), weather = w.weather!, player = w.entities.get(1)!;
  weather.setOverride('snow'); player.transform.y = .705;
  weatherTicks(w, 1);
  for (let i = 0; i < 12; i++) { player.transform.x += .1; weatherTicks(w, 1); }
  const tracks = weather.tracks.filter(t => t.id === 1);
  expect(tracks).toHaveLength(2); expect(tracks.map(t => t.side)).toEqual([1, -1]);
  expect(tracks[0].length).toBe(.28); expect(tracks[0].yaw).toBeCloseTo(0);
  expect(tracks[0].z * tracks[1].z).toBeLessThan(0);
  player.transform.x += 10; weatherTicks(w, 1);
  player.transform.y = 6.7;
  for (let i = 0; i < 10; i++) { player.transform.x += .1; weatherTicks(w, 1); }
  expect(weather.tracks.filter(t => t.id === 1)).toHaveLength(2);
});

test('footprints @E28 @E28-AC07 stay on bridge support and do not offset through its barrier', async () => {
  const w = await load(), player = w.entities.get(1)!, weather = w.weather!;
  // A narrow bridge deck with its barrier starting 5 cm from the walker centre.
  w.districts = { groundHeight: (_x: number, z: number) => z > .05 ? 7 : 6 } as NonNullable<SimWorld['districts']>;
  weather.setOverride('snow'); player.transform.y = 6.705; weatherTicks(w, 1);
  for (let i = 0; i < 16; i++) { player.transform.x += .1; weatherTicks(w, 1); }
  expect(weather.tracks.filter(t => t.id === 1)).toHaveLength(0);
  player.transform.z = -1; weatherTicks(w, 1);
  for (let i = 0; i < 6; i++) { player.transform.x += .1; weatherTicks(w, 1); }
  expect(weather.tracks.some(t => t.id === 1 && t.y === 6)).toBe(true);
  // Restore the real ownership before disposal.
  w.districts = null;
});
