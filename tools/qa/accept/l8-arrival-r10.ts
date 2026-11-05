import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { loadLevel } from '../../sim-runner/levels';
import { stateHash } from '../../../src/sim/world/stateHash';
import type { CampaignSave } from '../../../src/sim/progression/Campaign';
import { heldAction } from '../../../src/sim/progression/selection';
import { provenance } from './probe';
import { browserHash } from './browser';
import { atomicJson } from './report';

const identity = provenance(), rows = [];
const sha = (bytes: string | Buffer) => createHash('sha256').update(bytes).digest('hex');
for (const tier of ['low', 'high'] as const) {
  const base = `docs/reports/fix51-r10c/L7-L8-carried-${tier}`;
  const inputPath = `${base}-input.json`, input = JSON.parse(readFileSync(inputPath, 'utf8'));
  if (input.error || !input.result) { console.log(`${tier}: incomplete physical run; no arrival proof admitted`); continue; }
  assert.equal(input.sourceHash, identity.sourceHash); assert.equal(input.browserHash, browserHash());
  const completionBytes = readFileSync(`${base}/late-input-completion.json.gz`);
  const completion = JSON.parse(gunzipSync(completionBytes).toString());
  const campaign = completion.campaign as CampaignSave;
  // This is a read-only reconstruction of L8's production constructor from the
  // retained physical run's actual L7 result. The later L8 result is not read by
  // loadLevel for L8. Physical logs separately prove unchanged racks/selection.
  assert(Array.isArray(campaign.results?.L7?.escapedSurvivors), 'L7 must supply an explicit roster; zero survivors is valid E30-AC01 coverage');
  const world = await loadLevel('L8', 1, structuredClone(campaign), 0, { quality: tier });
  const before = stateHash(world.getState());
  const expected = campaign.results.L7.escapedSurvivors;
  const actors = expected.map(actor => world.entities.get(actor.id)!);
  assert(actors.every(Boolean));
  const humans = actors.map(actor => ({ id: actor.id, hp: actor.health.current, max: actor.health.max }));
  const companions = [...world.entities.iterate()].filter(actor => actor.companion).map(actor => ({ id: actor.id, hp: actor.health.current, max: actor.health.max }));
  const weapons = world.entities.get(1)!.weapons!;
  const racks = { LEFT: weapons.LEFT.rack.map(slot => slot.id), RIGHT: weapons.RIGHT.rack.map(slot => slot.id) };
  const selected = heldAction(weapons), after = stateHash(world.getState()); world.dispose();
  const control = await loadLevel('L8', 1, structuredClone(campaign), 0, { quality: tier });
  const controlHash = stateHash(control.getState()); control.dispose();
  assert.equal(before, after); assert.equal(after, controlHash);
  rows.push({ tier, inputPath, inputSha256: sha(readFileSync(inputPath)), completionArchive: `${base}/late-input-completion.json.gz`, completionArchiveSha256: sha(completionBytes),
    expectedIds: expected.map(actor => actor.id), humans, companions, racks, selected, readOnlyStateHash: after, controlHash });
  console.log(tier, { humans: humans.length, companions, selected });
}
atomicJson('docs/reports/fix51-r10c/L8-arrival-proof.json', { ...identity, browserHash: browserHash(), toolSha256: sha(readFileSync(new URL(import.meta.url))),
  method: 'Read-only production L8 construction from each physical run’s saved actual L7 result; compare humans/corgi HP, racks and selection. Archived physical ledger/logs independently qualify the live handover. No save/actor mutations; constructor control has identical state hash.', rows });
