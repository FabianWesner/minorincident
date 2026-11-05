import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { runLevel } from '../../sim-runner/levels';
import type { CampaignSave } from '../../../src/sim/progression/Campaign';
import { stateHash } from '../../../src/sim/world/stateHash';
import { provenance } from './probe';
import { atomicJson } from './report';

const identity = provenance(), rows = [];
const producer = JSON.parse(readFileSync('docs/reports/fix51-r10c/L7-carried-save-provenance.json', 'utf8'));
assert.equal(producer.sourceHash, identity.sourceHash);
for (const tier of ['low', 'high'] as const) {
  const bytes = readFileSync(`docs/reports/fix51-r10c/L7-${tier}-carried-save.json.gz`);
  assert.equal(createHash('sha256').update(bytes).digest('hex'), producer.rows.find((row: { tier: string }) => row.tier === tier).archiveSha256);
  const seed = JSON.parse(gunzipSync(bytes).toString()) as CampaignSave;
  const expected = seed.results!.L6!.escapedSurvivors!.map(actor => actor.id).sort((a, b) => a - b);
  let initial: { id: number; hp: number; max: number; x: number; z: number }[] = [], minimumClearance = Infinity, samples = 0, observedHash = '', controlHash = '';
  let storyWeapons: string[] = [];
  const previous = new Map<number, { x: number; z: number }>();
  const run = await runLevel('L7', 'complete', 1, 10, 'auto', structuredClone(seed), undefined, 0, {
    quality: tier,
    beforeBegin: world => {
      initial = world.l7Encounters!.state.roster.map(person => { const actor = world.entities.get(person.id)!; return { id: actor.id, hp: actor.health.current, max: actor.health.max, x: actor.transform.x, z: actor.transform.z }; });
      const update = world.update.bind(world);
      world.update = () => {
        update(); if (world.tick > 600) return;
        const player = world.entities.get(1)!;
        for (const person of world.l7Encounters!.state.roster) {
          const actor = world.entities.get(person.id)!;
          if (actor.health.current <= 0 || actor.infected || actor.infection) continue;
          const relative = { x: actor.transform.x - player.transform.x, z: actor.transform.z - player.transform.z }, from = previous.get(actor.id) ?? relative;
          const dx = relative.x - from.x, dz = relative.z - from.z, length2 = dx * dx + dz * dz;
          const along = length2 ? Math.max(0, Math.min(1, -(from.x * dx + from.z * dz) / length2)) : 0;
          const separation = Math.hypot(from.x + along * dx, from.z + along * dz);
          minimumClearance = Math.min(minimumClearance, separation - (player.combat?.radius ?? .3) - (actor.combat?.radius ?? .3));
          previous.set(actor.id, relative); samples++;
        }
      };
    },
    beforeDispose: world => {
      observedHash = stateHash(world.getState());
      const racks = world.entities.get(1)!.weapons!;
      const story = ['weapon.bat', 'weapon.fire-axe', 'weapon.handgun', 'weapon.shotgun', 'weapon.army-mg', 'weapon.rocket-launcher'];
      storyWeapons = [...new Set([...racks.LEFT.rack, ...racks.RIGHT.rack].map(slot => slot.id))].filter(id => story.includes(id));
    },
  });
  const control = await runLevel('L7', 'complete', 1, 10, 'auto', structuredClone(seed), undefined, 0, { quality: tier, beforeDispose: world => { controlHash = stateHash(world.getState()); } });
  assert(run.time >= 10 && control.time >= 10, 'observe the full required ten seconds'); assert.equal(observedHash, controlHash, 'arrival observation must preserve the native control');
  rows.push({ tier, run, controlRun: control, expectedIds: expected, initial, idsMatch: JSON.stringify(initial.map(actor => actor.id).sort((a, b) => a - b)) === JSON.stringify(expected),
    allFullHealth: initial.every(actor => actor.hp === actor.max), formationTicks: 600, samples, minimumClearance, storyWeapons, nativeStateHash: observedHash, controlHash, controlIdentical: true });
  console.log(tier, { roster: initial.length, minimumClearance, storyWeapons });
}
atomicJson('docs/reports/fix51-verify/receipts/L7-arrival.json', { ...identity,
  toolSha256: createHash('sha256').update(readFileSync(new URL(import.meta.url))).digest('hex'), producer: 'docs/reports/fix51-r10c/L7-carried-save-provenance.json',
  method: 'Actual mortal native L5/L6 completion saves enter L7. Check exact carried identities, full HP, all six story weapons after launcher collection, and every required first-ten-seconds tick. Both observed and independent control are scoped to ten seconds; later campaign completion is not claimed. Relative motion segments must clear the actual courier/follower capsule radii. Independent native controls end with identical state hashes.', rows });
