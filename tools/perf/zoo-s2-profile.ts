/** Reproduce the unchanged Zoo S2 200-actor fixture, profiling measured ticks only. */
import { mkdirSync, writeFileSync } from 'node:fs';
import { Session } from 'node:inspector/promises';
import { SimWorld } from '../../src/sim/world/SimWorld';

const out = process.argv[2] ?? 'test-results/zoo-s2-profile';
mkdirSync(out, { recursive: true });
const session = new Session(); session.connect();
const post = session.post.bind(session);
await post('Profiler.enable');
await post('Profiler.setSamplingInterval', { interval: 100 });
const rounds = [];
for (let round = 0; round < 3; round++) {
  const w = new SimWorld(); await w.init(); w.loadScenario('perf-horde-200');
  const ai = w.infected!, ids: number[] = [];
  for (const [i, old] of ai.active.slice(0, 20).entries()) {
    const p = { x: old.transform.x, z: old.transform.z }; ai.release(old);
    ids.push(ai.spawn(i % 2 ? 'infected.gorilla' : 'infected.elephant', p, { state: 'chase' }));
  }
  const p = w.entities.get(1)!, times: number[] = [];
  let activations = 0;
  w.events.on('infected.special', ev => { if (ev.type === 'infected.special' && ev.stage === 'active') activations++; });
  for (let tick = 0; tick < 720; tick++) {
    if (tick === 120) await post('Profiler.start');
    const t = performance.now();
    if (tick % 90 === 0) for (const [i, id] of ids.entries()) {
      const e = w.entities.get(id)!;
      ai.startSpecial(id, i % 2 ? 'gorilla.grab-throw' : tick % 180 ? 'elephant.swipe' : 'elephant.charge', { id: 1, x: p.transform.x, z: p.transform.z }, { x: e.transform.x, z: e.transform.z, radius: 1, dx: 1, dz: 0 });
    }
    w.update(); if (tick >= 120) times.push(performance.now() - t);
    if (ai.director.count !== 200) throw new Error('Zoo S2 population changed');
  }
  const { profile } = await post('Profiler.stop');
  writeFileSync(`${out}/round-${round}.cpuprofile`, JSON.stringify(profile));
  times.sort((a, b) => a - b); rounds.push({ round, count: ai.director.count, activations, p95: times[569] });
  w.dispose();
}
session.disconnect();
writeFileSync(`${out}/rounds.json`, JSON.stringify(rounds, null, 2));
console.log(rounds);
