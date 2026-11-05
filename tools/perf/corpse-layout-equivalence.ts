/** Compare every placement with a selected revision's full vehicle scan.
 * npx tsx tools/perf/corpse-layout-equivalence.ts <baseline-revision>
 */
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { CorpseLayout } from '../../src/render/characters/CorpseLayout';
import { staticCollision } from '../../src/assets/staticCollision';
import type { SimWorld } from '../../src/sim/world/SimWorld';
import type { EntitySnapshot } from '../../src/sim/world/types';

const revision = process.argv[2]; assert(revision, 'Supply the baseline revision');
const sourcePath = 'src/render/characters/CorpseLayout.ts';
const before = execFileSync('git', ['show', `${revision}:${sourcePath}`], { encoding: 'utf8' });
const temp = mkdtempSync(join(tmpdir(), 'fix51-corpse-'));
try {
  const modulePath = join(temp, 'baseline.mts');
  writeFileSync(modulePath, before.replace("'../../sim/spatial/SpatialHash'", JSON.stringify(pathToFileURL(resolve('src/sim/spatial/SpatialHash.ts')).href))
    .replace("'../../assets/staticCollision'", JSON.stringify(pathToFileURL(resolve('src/assets/staticCollision.ts')).href)));
  const Baseline = (await import(pathToFileURL(modulePath).href)).CorpseLayout as typeof CorpseLayout;
  const placements = Array.from({ length: 240 }, (_, i) => ({ assetId: i % 2 ? 'veh.sedan-red' : 'veh.school-bus', position: [i % 24 * 18, 0, Math.floor(i / 24) * 18],
    yaw: i * .37, scale: [i % 5 === 0 ? -1.3 : 1, 1, i % 7 === 0 ? .75 : 1.2] }));
  const player = { id: 1, transform: { x: -50, y: .7, z: -50 } } as EntitySnapshot;
  const scripted = { id: 2, kind: 'setpiece', archetype: 'veh.sedan-red', transform: { x: 9, y: .7, z: 4, yaw: .8 } } as EntitySnapshot;
  assert(placements.every(p => staticCollision[p.assetId]?.boxes.length)); assert(staticCollision[scripted.archetype]?.boxes.length);
  const entities = new Map<number, EntitySnapshot>([[1, player], [2, scripted]]);
  const car = { entity: { transform: { x: 13, y: .7, z: 8, yaw: -.3 } }, physics: { def: { length: 11, width: 3 } } };
  const state: { cureFront?: object } = {};
  const world = { entities: { revision: 0, get: (id: number) => entities.get(id), iterate: () => entities.values() },
    districts: { districts: [{ origin: [0, 0], decay: { placements } }], supportBelow: () => 0 },
    infected: { nav: { move: (p: { x: number; z: number }, dx: number, dz: number) => { p.x += dx; p.z += dz; },
      clear: (x: number, z: number) => Math.hypot(x - 6, z - 3) > 1.2 } },
    vehicles: { cars: new Map([[3, car]]) }, missions: { def: { id: 'L10' }, state } };
  const a = new Baseline(world as unknown as SimWorld), b = new CorpseLayout(world as unknown as SimWorld);
  let cases = 0;
  for (let phase = 0; phase < 4; phase++) {
    if (phase === 3) state.cureFront = {};
    scripted.transform.x += phase; scripted.hidden = phase === 2;
    car.entity.transform.z += phase; world.entities.revision++;
    player.transform.x = phase === 1 ? 18 : -50; player.transform.z = phase === 1 ? 0 : -50;
    for (let i = 0; i < 100; i++) {
      const p = placements[i < 40 ? 0 : i % placements.length], id = 10 + i;
      const body = { id, archetype: 'infected.runner', health: { current: 0, max: 100 }, combat: { radius: .3 },
        transform: { x: p.position[0] + (i % 5 - 2) * .9 + phase * .07, y: .7, z: p.position[2] + (i % 3 - 1) * 1.4, yaw: i * .31 },
        infected: { deadAt: 1 }, corpseThrown: i % 13 === 0 } as EntitySnapshot;
      entities.set(id, body);
      const prone = i % 4 === 0 ? 2.8 : undefined;
      assert.deepEqual(b.place(body, 1, prone), a.place(body, 1, prone), `phase ${phase}, body ${i}`); cases++;
    }
    assert.deepEqual(b.audit(), a.audit());
  }
  // A low airborne blast still follows physics, even at unchanged x/z over a
  // cached ground pose. Its eventual landing keeps the original exact layout.
  const flying = { id: 10000, archetype: 'infected.runner', health: { current: 0, max: 100 }, combat: { radius: .3 },
    transform: { x: -20, y: .8, z: -20, yaw: 0 }, infected: { deadAt: 1 }, corpseThrown: true,
    corpseBlast: { delay: 0, x: 0, y: -.1, z: 0 } } as EntitySnapshot;
  entities.set(flying.id, flying); world.entities.revision++;
  assert.deepEqual(b.place(flying), { ...flying.transform, y: flying.transform.y - .7 });
  delete flying.corpseBlast; flying.transform.y = .7;
  assert.deepEqual(b.place(flying), a.place(flying), 'landing retains the baseline ground pose');
  flying.corpseBlast = { delay: 0, x: 0, y: .1, z: 0 }; flying.transform.y = .8;
  assert.deepEqual(b.place(flying), { ...flying.transform, y: flying.transform.y - .7 }, 'vertical flight overrides the cached ground pose');
  const receipt = { revision, cases, airborneChecks: 3, densePileCases: 160, parkedVehicles: placements.length, scriptedAndDynamicVehicles: 2, phases: ['ordinary', 'courier exclusion', 'hidden/moving hulls', 'epilogue'],
    baselineSha256: createHash('sha256').update(before).digest('hex'), candidateSha256: createHash('sha256').update(readFileSync(sourcePath)).digest('hex'), result: 'PASS: identical poses and audits' };
  const out = process.env.CORPSE_EQUIVALENCE_OUT ?? 'test-results/fix51-perf/corpse-equivalence.json';
  mkdirSync(resolve(out, '..'), { recursive: true }); writeFileSync(out, JSON.stringify(receipt, null, 2) + '\n'); console.log(JSON.stringify(receipt));
} finally { rmSync(temp, { recursive: true, force: true }); }
