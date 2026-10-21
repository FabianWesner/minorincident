import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import { compositions } from '../../src/levels/compositions';
import { resolveCampaignMission } from '../../src/levels/missions';
import { SimWorld } from '../../src/sim/world/SimWorld';
import { preset } from '../../src/sim/progression/Campaign';
import { applyCampaign } from '../../src/sim/progression/apply';
import { LevelEightBot } from '../../src/debug/bot/LevelEightBot';
import type { EntitySnapshot } from '../../src/sim/world/types';

async function load(tier: 'high' | 'low' = 'high', carried?: EntitySnapshot[]) {
  const w = new SimWorld(); await w.init();
  const c = compositions.L8;
  w.loadComposition(c, c.districts.map(d => JSON.parse(readFileSync(`public/assets/layouts/${d.id}.layout.json`, 'utf8'))), 1, null, carried);
  w.infected!.director.setTier(tier); applyCampaign(w, preset('L8-default'));
  const m = w.loadMission(resolveCampaignMission('L8', w.districts!)); m.begin();
  return w;
}
const advance = (w: SimWorld, ticks: number) => { for (let i = 0; i < ticks; i++) w.update(); };
for (const tier of ['high', 'low'] as const) test(`T-E30-04 T-E30-05 T-E30-07 @E30-AC04 @E30-AC05 @E30-AC07 ${tier} active-time calm and simultaneous inside emergence`, async () => {
  const w = await load(tier);
  try {
    const zoo = w.missions!.l8!, s = zoo.state;
    expect(s.animals).toHaveLength(8); expect(s.roster).toHaveLength(12);
    expect(w.entities.get(s.busId)?.archetype).toBe('veh.evac-bus');
    expect(w.query({}).filter(e => e.civilian && !e.civilian.zooAnimal && !s.roster.includes(e.id))).toHaveLength(30);
    expect(s.outlets).toHaveLength(4);
    expect(w.missions!.state.marker).toBe('exit'); expect(w.missions!.state.steps.escape.status).toBe('active');
    advance(w, 3599);
    expect(w.missions!.state.marker).toBe('exit'); expect(w.missions!.state.steps.escape.status).toBe('active');
    expect(w.infected!.active).toHaveLength(0);
    advance(w, 1);
    expect(s.breachedAt).toBe(3600); expect(s.arrivals).toHaveLength(tier === 'low' ? 12 : 24);
    expect(new Set(s.arrivals.map(a => a.outlet)).size).toBe(4); expect(new Set(s.arrivals.map(a => a.tick)).size).toBe(1);
    expect(w.missions!.state.marker).toBe('exit');
    advance(w, 600);
    expect(s.alphas).toBe(4);
    // Within ten seconds the first release has crossed the doorway, not merely spawned behind it.
    expect(s.outlets.filter(outlet => outlet.ids.some(id => {
      const e = w.entities.get(id);
      return e?.infected && (!e.emerging || outlet.walking?.some(walk => walk.id === id && walk.leg >= 0));
    }))).toHaveLength(4);
    expect(w.infected!.active.every(e => !e.emerging || e.combat!.staggerUntil >= w.tick)).toBe(true);
    for (const step of w.missions!.def.steps) { const at = w.missions!.def.anchors[step.anchor]; expect(w.trapRescue!.reachable(at.x, at.z)).toBe(true); }
    expect(w.infected!.director.count).toBeLessThanOrEqual(tier === 'low' ? 100 : 200);
  } finally { w.dispose(); }
}, 120_000);

test('T-E30-08 T-E30-09 T-E30-11 @E30-AC08 @E30-AC09 @E30-AC11 seed 1 systemic zoo outbreak converts animals and humans', async () => {
  const w = await load();
  try {
    w.inspectionGhost = true; // Observe the unprotected zoo without the courier's death restoring the breach.
    const zoo = w.missions!.l8!, identities = zoo.state.animals.map(id => ({ id, species: w.entities.get(id)!.civilian!.zooAnimal }));
    const bites: { id: number; at: number; turns: boolean }[] = [];
    w.events.on('outbreak.bite', e => { if (e.type === 'outbreak.bite' && identities.some(a => a.id === e.targetId)) bites.push({ id: e.targetId, at: e.tick, turns: e.turns }); });
    advance(w, 180 * 60);
    const turned = identities.filter(a => w.entities.get(a.id)?.archetype === `infected.${a.species}`);
    expect(turned.length, JSON.stringify({ turned, bites, arrivals: zoo.state.arrivals.length, animals: identities.map(a => ({ id: a.id, archetype: w.entities.get(a.id)?.archetype, state: w.entities.get(a.id)?.civilian?.state })), stats: w.npcs!.civilians.outbreak!.stats })).toBeGreaterThanOrEqual(2);
    expect(w.query({}).some(e => e.infected && e.appearance && !zoo.state.arrivals.some(a => a.id === e.id))).toBe(true);
    expect(zoo.state.alphas).toBe(4); expect(w.infected!.director.count).toBeLessThanOrEqual(200);
  } finally { w.dispose(); }
}, 120_000);

test('T-E30-17 @E30-AC17 sanctuary and breach restore preserve remaining time, tunnel walks and animal identities', async () => {
  const w = await load();
  try {
    const m = w.missions!, zoo = m.l8!;
    advance(w, 1800); m.checkpoint('sanctuary'); advance(w, 1000); m.restore('sanctuary');
    advance(w, 1799); expect(zoo.state.breachedAt).toBe(0); advance(w, 1);
    expect(zoo.state.breachedAt).toBe(w.tick); const before = structuredClone(zoo.state);
    advance(w, 900); m.restore('breach');
    expect(zoo.state.arrivals).toEqual(before.arrivals); expect(zoo.state.animals).toEqual(before.animals);
    expect(zoo.state.alphas).toBe(0); expect(w.infected!.active).toHaveLength(24);
    advance(w, 600); expect(zoo.state.alphas).toBe(4);
  } finally { w.dispose(); }
}, 120_000);

for (const count of [0, 12, 35]) test(`T-E30-01 T-E30-02 T-E30-13 T-E30-14 @E30-AC01 @E30-AC02 @E30-AC13 @E30-AC14 seed 1 complete with ${count} survivors and exact APC transfer`, async () => {
  const source = await load();
  const base = source.entities.get(source.missions!.l8!.state.roster[0])!;
  const carried = Array.from({ length: count }, (_, i) => { const e = structuredClone(base); e.id = 10_000 + i; e.health.current = 5 + i % 20; e.civilian!.knockedUntil = 10_000; e.combat!.staggerUntil = 10_000; e.civilian!.survivor!.key = `carried-${i}`; return e; });
  source.dispose();
  const w = await load('high', carried);
  try {
    const zoo = w.missions!.l8!, bot = new LevelEightBot(w), turns = new Set<number>();
    for (const id of zoo.state.roster) { const e = w.entities.get(id)!; expect(e.health.current).toBe(e.health.max); expect(e.civilian!.knockedUntil).toBe(0); expect(e.combat!.staggerUntil).toBe(0); }
    w.events.on('outbreak.infection', e => { if (e.type === 'outbreak.infection' && e.phase === 'infected' && zoo.state.animals.includes(e.entityId)) turns.add(e.entityId); });
    for (let i = 0; i < 300 * 60 && !bot.finished; i++) { w.applyInput(bot.sample(), 'keyboard'); w.update(); }
    expect(w.missions!.state.phase, JSON.stringify({ p: w.entities.get(1)!.transform, friends: zoo.roster().map(id => ({ id, at: w.entities.get(id)?.transform, passenger: w.entities.get(id)?.passengerOf, hp: w.entities.get(id)?.health.current })) })).toBe('progression'); expect(w.missions!.state.stats.deaths).toBe(0);
    expect(w.missions!.state.result!.rescued).toBeGreaterThanOrEqual(Math.ceil(count * .6));
    if (count === 12) {
      const audit = { seed: 1, time: w.tick / 60, breach: zoo.state.breachedAt / 60, outlets: new Set(zoo.state.arrivals.map(a => a.outlet)).size, animalTurns: [...turns], alphas: zoo.state.alphas, rescued: w.missions!.state.result!.rescued };
      console.log(JSON.stringify(audit)); expect(turns.size, JSON.stringify(audit)).toBeGreaterThanOrEqual(2);
    }
    const payload = w.vehicles!.transfer(zoo.state.carId);
    const destination = new SimWorld(); await destination.init();
    try {
      const c = compositions.L9;
      destination.loadComposition(c, c.districts.map(d => JSON.parse(readFileSync(`public/assets/layouts/${d.id}.layout.json`, 'utf8'))), 1);
      destination.vehicles!.restoreTransfer(payload, { x: destination.districts!.playerStart[0], z: destination.districts!.playerStart[1] });
      expect(destination.vehicles!.active).toBe(payload.vehicle.id);
      expect(destination.entities.get(payload.vehicle.id)!.health).toEqual(payload.vehicle.health);
      for (const e of payload.occupants) expect(destination.entities.get(e.id)!.health).toEqual(e.health);
      expect(destination.entities.get(1)!.weapons).toEqual(payload.occupants.find(e => e.id === 1)!.weapons);
    } finally { destination.dispose(); }
  } finally { w.dispose(); }
}, 120_000);

test('T-E30-13-losses @E30-AC13 finished civilians and released former survivors cannot block an all-lost escape', async () => {
  const w = await load();
  try {
    const zoo = w.missions!.l8!, ids = [...zoo.state.roster];
    w.entities.get(ids[0])!.civilian!.state = 'finished';
    const turned = w.entities.get(ids[1])!; w.npcs!.civilians.outbreak!.turnNow(turned); w.infected!.release(turned);
    for (const id of ids.slice(2)) w.entities.get(id)!.health.current = 0;
    expect(zoo.roster()).toEqual([]);
    const bot = new LevelEightBot(w);
    for (let i = 0; i < 180 * 60 && !bot.finished; i++) { w.applyInput(bot.sample(), 'keyboard'); w.update(); }
    expect(w.missions!.state.phase).toBe('progression'); expect(w.missions!.state.result!.rescued).toBe(0);
  } finally { w.dispose(); }
}, 120_000);

for (const tier of ['high', 'low'] as const) test(`T-E30-06-calm-${tier} @E30-AC06 exterior attackers cannot cross or hurt any occupant for all 60 seconds; routines face their task`, async () => {
  const w = await load(tier);
  try {
    const occupants = w.entities.values().filter(e => e.civilian || e.id === 1);
    const initial = new Map(occupants.map(e => [e.id, e.health.current]));
    const routines = occupants.filter(e => e.civilian && !e.civilian.survivor && !e.civilian.zooAnimal);
    expect(routines).toHaveLength(30);
    expect(routines.filter(e => e.civilian!.ally?.role === 'soldier')).toHaveLength(6);
    const animals = occupants.filter(e => e.civilian?.zooAnimal);
    expect(animals).toHaveLength(8);
    const outside = [[0, -88], [0, 88], [-118, 0], [118, 0]];
    const attackers = outside.map(([x, z]) => w.entities.get(w.infected!.spawn('infected.runner', { x, z }, { state: 'chase' }))!);
    const nowhere = new Map<number, number>(), longest = new Map<number, number>();
    for (let tick = 0; tick < 3600; tick++) {
      w.update();
      for (const e of occupants) {
        expect(e.health.current, `occupant ${e.id}, tick ${tick}`).toBe(initial.get(e.id));
        expect(e.infected, `occupant ${e.id}`).toBeUndefined();
        expect(e.infection, `occupant ${e.id}`).toBeUndefined();
      }
      for (const [i, e] of attackers.entries()) {
        const [x, z] = outside[i];
        expect(x ? Math.sign(x) * e.transform.x >= 115.6 : Math.sign(z) * e.transform.z >= 85.6, `wall ${i} tick ${tick}`).toBe(true);
      }
      for (const e of [...routines, ...animals]) {
        const c = e.civilian!, activity = c.schedule?.[c.scheduleStep ?? 0];
        const target = activity ? c.activityUntil ? activity.facing ?? activity.target : activity.target : c.waypoints[c.waypoint];
        const dx = target.x - e.transform.x, dz = target.z - e.transform.z, distance = Math.hypot(dx, dz);
        const facing = distance > .1 && (Math.cos(e.transform.yaw) * dx - Math.sin(e.transform.yaw) * dz) / distance > Math.cos(Math.PI / 4);
        const duration = facing ? 0 : (nowhere.get(e.id) ?? 0) + 1;
        nowhere.set(e.id, duration); longest.set(e.id, Math.max(longest.get(e.id) ?? 0, duration));
        expect(duration, `routine ${e.id} tick ${tick}: ${JSON.stringify({ at: e.transform, activity, until: c.activityUntil })}`).toBeLessThanOrEqual(180);
        expect(e.infected).toBeUndefined();
      }
    }
    expect(w.missions!.l8!.state.breachedAt).toBe(3600);
    mkdirSync('test-results/wave3-sim', { recursive: true });
    writeFileSync(`test-results/wave3-sim/calm-${tier}.json`, JSON.stringify({ ticks: 3600, occupants: initial.size, attackers: attackers.map(e => ({ id: e.id, at: e.transform, hp: e.health.current })), longestFacingAwayTicks: Object.fromEntries(longest) }, null, 2));
  } finally { w.dispose(); }
}, 120_000);
