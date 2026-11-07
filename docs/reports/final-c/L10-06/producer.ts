import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { runLevel } from '../../sim-runner/levels';
import { preset, type CampaignSave } from '../../../src/sim/progression/Campaign';
import { validateSave } from '../../../src/sim/progression/Save';
import { stateHash } from '../../../src/sim/world/stateHash';
import { provenance, type NativeReceipt } from './probe';
import { atomicJson } from './report';

const identity = provenance(), rows = [];
for (const tier of ['low', 'high'] as const) {
  const control = JSON.parse(readFileSync(`docs/reports/fix51-verify/receipts/L10-${tier}-complete.json`, 'utf8')) as NativeReceipt;
  assert.equal(control.sourceHash, identity.sourceHash); assert.equal(control.observerHash, identity.observerHash);
  const campaign = preset('L10-default'); campaign.settings.quality = tier;
  const snapshots: { save: CampaignSave; tick: number; dogId: number; dogDistance: number; corgiId: number; corgiDistance: number }[] = [];
  let finalHash = '';
  const run = await runLevel('L10', 'complete', 1, undefined, 'auto', campaign, undefined, 0, {
    quality: tier,
    beforeBegin: world => {
      const update = world.update.bind(world);
      world.update = () => {
        update();
        if (snapshots.length) return;
        const player = world.entities.get(1)!, corgi = world.entities.values().find(actor => actor.archetype === 'char.corgi');
        if (!corgi) return;
        const distance = (actor: typeof player) => Math.hypot(actor.transform.x - player.transform.x, actor.transform.z - player.transform.z);
        const dog = world.entities.values().find(actor => actor.archetype === 'infected.dog' && actor.health.current > 0 && !actor.infected?.hidden && distance(actor) <= 15);
        if (!dog || distance(corgi) > 8) return;
        assert(world.progression!.campaign);
        const save = structuredClone(world.progression!.campaign); save.cureResume = world.missions!.saveResume();
        assert(validateSave(save));
        snapshots.push({ save, tick: world.tick, dogId: dog.id, dogDistance: distance(dog), corgiId: corgi.id, corgiDistance: distance(corgi) });
      };
    },
    beforeDispose: world => { finalHash = stateHash(world.getState()); },
  });
  assert(run.completed); assert.equal(finalHash, control.nativeStateHash);
  assert.equal(snapshots.length, 1, 'Need one naturally reached living-dog/corgi encounter');
  const { save, ...encounter } = snapshots[0], raw = JSON.stringify(save), bytes = gzipSync(raw), path = `docs/reports/final-c/L10-06/L10-${tier}-dog-save.json.gz`;
  writeFileSync(path, bytes);
  rows.push({ tier, ...encounter, path, saveSha256: createHash('sha256').update(raw).digest('hex'), archiveSha256: createHash('sha256').update(bytes).digest('hex'), nativeStateHash: finalHash, controlIdentical: true });
  console.log(tier, encounter);
}
atomicJson('docs/reports/final-c/L10-06/L10-dog-save-provenance.json', { ...identity, toolSha256: createHash('sha256').update(readFileSync(new URL(import.meta.url))).digest('hex'), method: 'Read-only snapshot of a naturally reached living infected dog within15m and healthy corgi within8m on the ordinary native route. Exact production Resume, no actor writes. Independent canonical final state remains identical. Native-generated progressed save for subsequent physical input visual review, not a physical full campaign claim.', rows });
