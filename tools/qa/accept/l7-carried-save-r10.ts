import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { runLevel } from '../../sim-runner/levels';
import { preset } from '../../../src/sim/progression/Campaign';
import { completeCampaignLevel } from '../../../src/sim/progression/carryover';
import { validateSave } from '../../../src/sim/progression/Save';
import { provenance } from './probe';
import { atomicJson } from './report';

const identity = provenance(), rows = [];
for (const tier of ['low', 'high'] as const) {
  const save = preset('L5-default'); save.settings.quality = tier;
  const runs = [];
  for (const level of ['L5', 'L6'] as const) {
    const run = await runLevel(level, 'complete', 1, undefined, 'auto', save,
      (world, result) => completeCampaignLevel(save, level === 'L5' ? 5 : 6, result, world), 0, { quality: tier });
    assert(run.completed, `${tier}/${level} must complete through ordinary mortal input`); runs.push(run);
  }
  assert(validateSave(save)); assert(save.results?.L6?.escapedSurvivors?.length);
  const path = `docs/reports/fix51-r10c/L7-${tier}-carried-save.json.gz`;
  const raw = JSON.stringify(save), bytes = gzipSync(raw); writeFileSync(path, bytes);
  rows.push({ tier, runs, path, saveSha256: createHash('sha256').update(raw).digest('hex'), archiveSha256: createHash('sha256').update(bytes).digest('hex'),
    roster: save.results!.L6!.escapedSurvivors!.map(actor => ({ id: actor.id, hp: actor.health.current, max: actor.health.max })), racks: save.racks, selectedAction: save.selectedAction });
  console.log(tier, { roster: save.results!.L6!.escapedSurvivors!.length, racks: save.racks });
}
atomicJson('docs/reports/fix51-r10c/L7-carried-save-provenance.json', { ...identity,
  toolSha256: createHash('sha256').update(readFileSync(new URL(import.meta.url))).digest('hex'),
  method: 'Start at the authored L5-default boundary, complete mortal L5 and L6 with ordinary native policies, and call production completeCampaignLevel on each actual result. No invented roster or actor relocation. These are native-generated progressed saves, not a physical L1–L6 campaign claim.', rows });
