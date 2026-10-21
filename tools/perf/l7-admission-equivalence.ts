/** Exact admission-output comparison against a supplied original registry source.
 * Heavy sim diagnostics run through tools/remote/run.sh; no timing gates here.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { SimWorld } from '../../src/sim/world/SimWorld';

const source = process.env.L7_ADMISSION_BASELINE ?? 'test-results/l7-perf/SolidRegistry.before.ts';
const out = process.env.L7_ADMISSION_OUT ?? 'test-results/l7-perf/admission-equivalence.json';
const reference = resolve(dirname(out), 'SolidRegistry.reference.ts');
mkdirSync(dirname(out), { recursive: true });
writeFileSync(reference, readFileSync(source, 'utf8').replace(/from '([^']+)'/g, (match, specifier: string) => specifier.startsWith('.')
  ? `from '${pathToFileURL(resolve('src/sim/world', specifier) + '.ts').href}'` : match));
const { SolidRegistry: Original } = await import(pathToFileURL(reference).href);
const worlds = [new SimWorld(), new SimWorld()];
let spawnChecks = 0, findChecks = 0, snapshots = 0;
const equal = (a: unknown, b: unknown, label: string) => { if (JSON.stringify(a) !== JSON.stringify(b)) throw Error(`Admission output differs: ${label}`); };
try {
  for (const [index, world] of worlds.entries()) {
    if (!index) Object.assign(world, { solids: new Original(world) });
    await world.init(); world.loadScenario('horde-arena', 29);
  }
  const compare = (label: string) => {
    equal([...worlds[0].entities.iterate()], [...worlds[1].entities.iterate()], label);
    equal(worlds[0].solids.snapshot(), worlds[1].solids.snapshot(), `${label}: registry`); snapshots++;
  };
  for (let wave = 0; wave < 7; wave++) {
    const missing = Math.min(100 - worlds[0].infected!.director.count, worlds[0].infected!.pool.length);
    for (let i = 0; i < missing; i++) {
      const at = { x: 8 + i % 10 * .5, z: -2 + Math.floor(i / 10) * .25 };
      equal(worlds[0].infected!.spawn('infected.runner', at), worlds[1].infected!.spawn('infected.runner', at), `spawn id ${wave}/${i}`);
      spawnChecks++;
    }
    compare(`wave ${wave}: admitted`);
    for (let i = 0; i < 160; i++) {
      const at = { x: 6 + i % 20 * .33, y: i % 5 === 0 ? 3 : .7, z: -4 + Math.floor(i / 20) * .37 };
      const radius = i % 3 === 0 ? .6 : .35;
      equal(worlds[0].solids.find(at, radius), worlds[1].solids.find(at, radius), `find ${wave}/${i}`); findChecks++;
    }
    for (const world of worlds) {
      const target = world.infected!.active.find(e => e.health.current > 0);
      world.explosions!.blast('explosion.rocket', target?.transform ?? { x: 10, z: 0 });
      for (let tick = 0; tick < 75; tick++) world.update();
    }
    compare(`wave ${wave}: settled`);
  }
  const result = { exact: true, waves: 7, spawnChecks, findChecks, snapshots, corpses: worlds[1].entities.values().filter(e => e.corpse).length };
  writeFileSync(out, JSON.stringify(result, null, 2) + '\n'); console.log(result);
} finally { for (const world of worlds) world.dispose(); }
