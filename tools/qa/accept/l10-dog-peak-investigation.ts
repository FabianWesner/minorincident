import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { probeLevel, provenance } from './probe';
import { AcceptanceObserver } from './observer';
import { atomicJson } from './report';
import { cure } from '../../../src/levels/L10/district';

const identity = provenance();
const snapshots: unknown[] = [];
let previousSignature = '';
let maxLocal = 0;
const observerPrototype = AcceptanceObserver.prototype as unknown as { observe: () => void };
const original = observerPrototype.observe;
observerPrototype.observe = function (this: unknown) {
  const world = (this as { world: import('../../../src/sim/world/SimWorld').SimWorld }).world;
  if (world.scenario === 'L10' && world.missions?.state.phase === 'playing') {
    const region = cure.regions.find(r => world.entities.get(1)!.transform.x >= r.envelope[0][0] && world.entities.get(1)!.transform.x <= r.envelope[1][0]);
    if (region?.id === 'research-campus') {
      const local = world.infected!.active.filter(e => e.health.current > 0 && !e.corpse && e.archetype.includes('dog') &&
        e.transform.x >= region.envelope[0][0] && e.transform.x <= region.envelope[1][0] && e.transform.z >= region.envelope[0][1] && e.transform.z <= region.envelope[1][1]);
      const signature = local.map(e => e.id).sort((a, b) => a - b).join(',');
      if (local.length >= 4 && (signature !== previousSignature || local.length > maxLocal)) {
        const spawned = world.l10Encounters?.state.spawned ?? {};
        snapshots.push({ tick: world.tick, player: { x: world.entities.get(1)!.transform.x, z: world.entities.get(1)!.transform.z }, localPeak: local.length,
          localIds: local.map(e => ({ id: e.id, hp: e.health.current, x: e.transform.x, z: e.transform.z, cureRegion: e.infected?.cureRegion ?? null,
            slot: Object.entries(spawned).find(([, id]) => id === e.id)?.[0] ?? null })) });
        previousSignature = signature; maxLocal = Math.max(maxLocal, local.length);
      }
    }
  }
  original.call(this);
};
const receipt = await probeLevel('L10', 'high', 'complete', identity);
observerPrototype.observe = original;
const result = { ...identity, toolSha256: createHash('sha256').update(readFileSync(new URL(import.meta.url))).digest('hex'),
  method: 'Read-only capture at AcceptanceObserver cadence while the production high-tier L10 complete policy crosses the research-campus region; records the exact local dog peak and all concurrently living dog identities/positions/region tags.',
  peakEvidence: snapshots,
  finalPeak: receipt.observation?.regions['research-campus']?.dogPeak ?? null, complete: receipt.run?.completed ?? false, nativeStateHash: receipt.nativeStateHash };
atomicJson('docs/reports/fix65-c/L10-03-dog-peak-investigation.json', result);
console.log({ finalPeak: result.finalPeak, snapshots: snapshots.length, complete: result.complete });
