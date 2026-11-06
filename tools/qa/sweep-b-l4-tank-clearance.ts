/** Recheck every tank impact against live registered allies at the actual shot tick. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { preset } from '../../src/sim/progression/Campaign';
import { stateHash } from '../../src/sim/world/stateHash';
import { runLevel } from '../sim-runner/levels';
import { provenance } from './accept/probe';
const identity = provenance(), rows = [];
for (const tier of ['low', 'high'] as const) {
  const campaign = preset('L4-default'); campaign.settings.quality = tier;
  const shots: unknown[] = []; let finalHash = '';
  const run = await runLevel('L4', 'complete', 1, undefined, 'auto', campaign, undefined, 0, { quality: tier, beforeBegin: world => {
    world.events.on('l4.tankFire', event => {
      if (event.type !== 'l4.tankFire') return;
      const s = world.missions!.state.l4!;
      const ids = [...new Set([1, ...s.soldierIds, ...s.armed.map(a => a.id)])];
      shots.push({ ...event, phase: s.phase, tankPhase: s.tankPhase, protected: ids.flatMap(id => {
        const e = world.entities.get(id); if (!e || e.health.current <= 0 || id !== 1 && !e.civilian) return [];
        return [{ id, at: { ...e.transform }, health: { ...e.health }, hidden: !!e.hidden, civilianState: e.civilian?.state, ally: e.civilian?.ally ? structuredClone(e.civilian.ally) : null,
          soldier: s.soldierIds.includes(id), armedEntry: s.armed.find(a => a.id === id), distance: Math.hypot(e.transform.x - event.to.x, e.transform.z - event.to.z) }];
      }) });
    }, 8);
  }, beforeDispose: world => { finalHash = stateHash(world.getState()); } });
  const canonical = JSON.parse(readFileSync(`docs/reports/fix51-verify/receipts/L4-${tier}-complete.json`, 'utf8'));
  assert.equal(canonical.sourceHash, identity.sourceHash); assert.equal(finalHash, canonical.nativeStateHash);
  rows.push({ tier, run, finalHash, canonicalHash: canonical.nativeStateHash, shots }); console.log(tier, finalHash, shots.length);
  writeFileSync('docs/reports/sweep-b/L4-tank-clearance.json.gz', gzipSync(JSON.stringify({ ...identity, producerSha256: createHash('sha256').update(readFileSync('tools/qa/sweep-b-l4-tank-clearance.ts')).digest('hex'),
    method: 'Read-only actual tank-fire event listener on ordinary mortal complete routes. Every impact, including the forced fuel-truck shell, checks current player and live soldier/armed registry identities, actual health, actual ally gun/weapon state and exact positions. Decorative unregistered civilians and corpses excluded. Both final world hashes must equal canonical controls. No protection, relocation or changes to RNG/input.', rows })));
}
