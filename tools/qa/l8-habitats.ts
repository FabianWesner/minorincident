/** Production calm-tour habitat audit, followed by an isolated real-contact primate entrance check. */
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { LevelEightBot } from '../../src/debug/bot/LevelEightBot';
import { emptyInput } from '../../src/input/InputFrame';
import { loadLevel } from '../../tests/qa/invariants/world';
import { provenance } from './accept/probe';

const out = process.env.L8_HABITAT_OUT ?? 'docs/reports/p1-l8apes'; mkdirSync(out, { recursive: true });
for (const quality of ['low', 'high'] as const) {
  const w = await loadLevel('L8', 1808, quality), zoo = w.missions!.l8!, bot = new LevelEightBot(w);
  const rows = zoo.state.animals.map(id => {
    const e = w.entities.get(id)!, species = e.civilian!.zooAnimal!, name = species === 'lioness' ? 'lion' : species;
    const polygon = w.districts!.districts[0].layout.zones?.[`enclosure-${name}`];
    assert(polygon?.length, `${species}: missing authored habitat`);
    return { id, species, bounds: { minX: Math.min(...polygon.map(p => p[0])), maxX: Math.max(...polygon.map(p => p[0])), minZ: Math.min(...polygon.map(p => p[1])), maxZ: Math.max(...polygon.map(p => p[1])) },
      distance: 0, maxStep: 0, minY: e.transform.y, maxY: e.transform.y, moving: 0, resting: 0, activities: new Set<string>(), previous: { ...e.transform } };
  });
  let mixedPrimateTicks = 0;
  const samples: unknown[] = [];
  try {
    for (let tick = 0; tick < 3600; tick++) {
      // Local noise is a controlled stimulus, not an early hostile/breach.
      // Scattering must still choose habitat waypoints rather than the courier.
      if (tick === 900) w.npcs!.civilians.outbreak!.hear({ x: -15, z: 26 });
      w.applyInput(bot.sample(), 'keyboard'); w.update();
      let moving = 0, resting = 0;
      for (const row of rows) {
        const e = w.entities.get(row.id)!, c = e.civilian, { x, y, z } = e.transform, b = row.bounds;
        if (tick < 3599) {
          assert(c && !e.infected && !e.infection && e.health.current > 0, `${quality}/${row.species}/${tick}: animal not healthy`);
          assert(!c.survivor && !c.ally?.follow && !e.escort && !e.companion, `${row.species}: animal received a follower role`);
          assert(x >= b.minX && x <= b.maxX && z >= b.minZ && z <= b.maxZ, `${quality}/${row.species}/${tick}: left habitat at ${x}, ${z}`);
        }
        const step = Math.hypot(x - row.previous.x, z - row.previous.z);
        row.distance += step; row.maxStep = Math.max(row.maxStep, step); row.minY = Math.min(row.minY, y); row.maxY = Math.max(row.maxY, y);
        row.previous = { ...e.transform }; row.activities.add(c?.animalActivity?.kind ?? 'idle/walk');
        if (step > .001) { row.moving++; if (row.species === 'monkey') moving++; }
        else { row.resting++; if (row.species === 'monkey') resting++; }
      }
      if (moving && resting) mixedPrimateTicks++;
      if ([600, 1800, 3211, 3599].includes(w.tick)) samples.push({ tick: w.tick, player: { ...w.entities.get(1)!.transform }, animals: rows.map(r => { const e = w.entities.get(r.id)!; return { id: r.id, species: r.species, at: { ...e.transform }, activity: e.civilian?.animalActivity?.kind ?? 'idle/walk' }; }) });
    }
    const monkeys = rows.filter(r => r.species === 'monkey');
    assert.equal(monkeys.length, 7); assert(mixedPrimateTicks > 300, 'healthy monkeys still move in synchrony');
    for (const row of monkeys) assert(row.distance > 2 && row.moving > 60 && row.resting > 60 && row.maxStep < .2, `monkey ${row.id}: missing continuous individual movement/rest`);
    assert(monkeys.some(r => r.activities.has('groom')), 'no healthy grooming');
    assert(monkeys.some(r => r.activities.has('climb') && r.maxY - r.minY > .5), 'no physical healthy climbing');
    assert(monkeys.some(r => r.activities.has('scatter')), 'no bounded response to local noise');
    assert(w.missions!.state.states.breached && zoo.state.breachedAt === 3600, 'the real 60-second breach changed');

    // A contact fixture tests the service opening from outside the yard. No
    // forced grab/infection or in-enclosure spawn substitutes for this walk.
    for (const arena of zoo.state.arenas) if (arena.id !== 'monkey') arena.phase = 3;
    zoo.state.nextWave = Number.MAX_SAFE_INTEGER; w.combat!.damage.god = true;
    const arena = zoo.state.arenas.find(a => a.id === 'monkey')!, target = w.entities.get(arena.ids[0])!;
    const carrierId = w.infected!.spawn('infected.runner', { x: -7.5, z: 25.95 }, { state: 'chase' });
    arena.carrier = carrierId; const carrier = w.entities.get(carrierId)!;
    carrier.infected!.arenaCarrier = target.id; w.infected!.pursueTarget(carrierId, target.id);
    const bites: number[] = [], turns: number[] = [], route: unknown[] = [];
    for (const e of w.entities.iterate()) if (e.civilian?.ally) delete e.civilian.ally;
    w.events.on('outbreak.bite', event => { if (event.type === 'outbreak.bite' && event.targetId === target.id) bites.push(event.tick); });
    w.events.on('civilian.turned', event => { if (event.type === 'civilian.turned' && event.id === target.id && event.infectedId === target.id) turns.push(event.tick); });
    for (let n = 0; n < 1800 && !target.infected; n++) {
      for (const e of [...w.infected!.active]) if (e.id !== carrierId && e.id !== target.id) w.infected!.release(e);
      w.applyInput(emptyInput(), 'keyboard'); w.update();
      if (n % 30 === 0) route.push({ tick: w.tick, carrier: { ...carrier.transform }, monkey: { ...target.transform }, state: target.civilian?.state });
    }
    assert(target.infected?.arenaBoss?.arena === 'monkey' && turns.length && bites.length, 'outside carrier could not enter, bite and turn the original monkey');
    assert(turns[0] - bites[0] >= 150 && turns[0] - bites[0] <= 210, 'same-ID primate conversion timing changed');
    assert.equal(w.solids.failures, 0);
    const report = { ...provenance(), quality, pass: true, calmTicks: 3600, mixedPrimateTicks, localNoiseControl: { tick: 901, x: -15, z: 26 },
      animals: rows.map(({ previous, activities, ...row }) => ({ ...row, finalPosition: previous, activities: [...activities] })), samples,
      serviceEntrance: { method: 'isolated runner starts outside east entrance and walks through production carrier/navigation/grab/infection code', targetId: target.id, carrierId, bites, turns, route } };
    writeFileSync(`${out}/native-${quality}.json`, JSON.stringify(report, null, 2) + '\n');
    console.log(JSON.stringify({ quality, pass: true, animals: rows.length, mixedPrimateTicks, bites, turns }));
  } finally { w.dispose(); }
}
