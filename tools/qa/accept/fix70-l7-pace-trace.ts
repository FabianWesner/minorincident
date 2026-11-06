/** Read-only movement requests and resolved poses for the current L7-09 straggler. */
import { mkdirSync, writeFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { runLevel } from '../../sim-runner/levels';
import { preset } from '../../../src/sim/progression/Campaign';
import { stateHash } from '../../../src/sim/world/stateHash';
import { provenance } from './probe';

const seed = Number(process.argv[2] ?? 1), id = Number(process.argv[3] ?? 71), identity = provenance();
const campaign = preset('L7-default'); campaign.seed = seed; campaign.settings.quality = 'high';
const samples: object[] = [], resolved: object[] = [];
let hash = '';
const run = await runLevel('L7', 'complete', seed, undefined, 'auto', campaign, undefined, 0, {
  quality: 'high', beforeBegin: world => {
    const update = world.update.bind(world);
    world.update = () => {
      update();
      if (world.tick % 30) return;
      const entity = world.entities.get(id), blocker = world.solids.blockingBody(id);
      const boxes: object[] = [];
      if (entity && world.tick >= 4700 && world.tick <= 5120) (world.solids as unknown as { solids: (at: object, radius: number, e: object, visit: (box: object, id: number | string) => void) => void }).solids(entity.transform, .7, entity, (box, id) => boxes.push({ id, ...box }));
      if (entity) resolved.push({ boxes, tick: world.tick, position: { ...entity.transform }, speed: entity.motion?.speed,
        blocker: blocker && { id: blocker.id, archetype: blocker.archetype, position: { ...blocker.transform }, corpse: !!blocker.corpse, hp: blocker.health.current } });
    };
    const move = world.npcs!.move.bind(world.npcs!);
    world.npcs!.move = (entity, target, speed, path, stop, budget, nav) => {
      const before = { ...entity.transform };
      const result = move(entity, target, speed, path, stop, budget, nav);
      if (entity.id === id && world.tick % 6 === 0) samples.push({ tick: world.tick, phase: world.missions!.state.steps.departure?.status,
        before, after: { ...entity.transform }, target: { ...target }, speed, stop, result,
        waypoint: { ...(world.npcs! as unknown as { waypoint: { x: number; z: number } }).waypoint },
        path: { goal: path.goal, index: path.pathIndex, length: path.path.length },
        player: { ...world.entities.get(1)!.transform }, motion: entity.motion && { ...entity.motion },
        departure: world.l7Departure!.state.phase, entering: entity.id in world.l7Departure!.state.entering });
      return result;
    };
  }, beforeDispose: world => { hash = stateHash(world.getState()); },
});
mkdirSync('test-results/fix70-s', { recursive: true });
writeFileSync(`test-results/fix70-s/trace-${seed}-${id}.json.gz`, gzipSync(JSON.stringify({ ...identity, seed, id, run, hash, samples, resolved })));
console.log(JSON.stringify({ seed, id, run, hash, samples: samples.length }));
