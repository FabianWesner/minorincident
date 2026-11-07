import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { loadLevel } from '../../sim-runner/levels';
import { preset } from '../../../src/sim/progression/Campaign';
import { emptyInput } from '../../../src/input/InputFrame';
import { requireClearPoint } from '../../../src/sim/missions/missionHelpers';
import { provenance } from './probe';

const rows = [];
for (const tier of ['low', 'high'] as const) {
  const campaign = preset('L9-default'); campaign.settings.quality = tier;
  const world = await loadLevel('L9', 1, campaign, 0, { quality: tier });
  try {
    const car = world.vehicles!.cars.get(world.missions!.l9!.state.carId)!;
    const p = car.entity.transform, ids = [], events: object[] = [];
    for (const [x, z] of [[4.2, 0], [-4.2, 0], [0, 2.1], [0, -2.1]]) {
      const at = requireClearPoint(world, { x: p.x + x, z: p.z + z }, 0.35, 3, 'L9 stopped hull contact fixture');
      ids.push(world.infected!.spawn('infected.runner', at, { state: 'chase' }));
    }
    const initial = ids.map(id => structuredClone(world.entities.get(id)!));
    world.events.on('vehicle.attack-windup', event => events.push({ ...event }));
    world.events.on('vehicle.durability-hit', event => events.push({ ...event }));
    const samples = [];
    for (let i = 0; i < 600; i++) {
      world.applyInput({ ...emptyInput(), brake: true, drive: { throttle: 0, steer: 0 } }, 'keyboard');
      world.update();
      samples.push({ tick: world.tick, speed: car.physics.speed, hp: car.entity.health.current,
        contacts: structuredClone(car.entity.vehicle!.apcContacts),
        actors: ids.map(id => { const e = world.entities.get(id)!; return { id, hp: e.health.current, position: { ...e.transform }, state: e.infected!.state }; }) });
    }
    rows.push({ tier, ids, initial, samples, events });
    console.log(tier, events);
  } finally { world.dispose(); }
}
const output = 'docs/reports/final-c/L9-04';
mkdirSync(output, { recursive: true });
writeFileSync(`${output}/stopped-contact.json.gz`, gzipSync(JSON.stringify({ ...provenance(),
  toolSha256: createHash('sha256').update(readFileSync(new URL(import.meta.url))).digest('hex'),
  method: 'Explicit native capability fixture: four ordinary runners spawned on body-clear points around the ordinary occupied L9 APC;600 normal braked keyboard ticks. All HP, AI, factions, timers and damage unchanged, no actor movement writes, no courier protection. Every actual contact/attack transaction and windup retained. Separate from physical route qualification.', rows })));
