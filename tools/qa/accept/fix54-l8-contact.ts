import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { preset } from '../../../src/sim/progression/Campaign';
import { stateHash } from '../../../src/sim/world/stateHash';
import { runLevel } from '../../sim-runner/levels';
import { observeAttackStarts } from '../threat/attackStarts';
import { atomicJson } from './report';
import { provenance } from './probe';

// Read-only contact diagnosis on the existing competent input policy.
const identity = provenance(), rows = [];
for (const tier of ['low', 'high'] as const) {
  const campaign = preset('L8-default'); campaign.settings.quality = tier;
  const arrivals = new Map<number, { id: number; outlet: number; alpha: boolean; born: number; released: number | null; downed: number | null; minPlayer: number; minGroup: number }>();
  const attacks: object[] = [], samples: object[] = [];
  let finalHash = '';
  const run = await runLevel('L8', 'complete', 1, undefined, 'auto', campaign, undefined, 0, {
    quality: tier,
    beforeBegin: w => {
      observeAttackStarts(w, (source, target, tick) => {
        const a = w.entities.get(source), b = w.entities.get(target);
        attacks.push({ seconds: tick / 60, source, target, archetype: a?.archetype, outlet: arrivals.get(source)?.outlet,
          sourceAt: a ? { ...a.transform } : null, targetAt: b ? { ...b.transform } : null });
      });
      const update = w.update.bind(w);
      w.update = () => {
        update();
        const zoo = w.missions!.l8!.state;
        if (!zoo.breachedAt) return;
        const player = w.entities.get(1)!;
        const group = w.missions!.l8!.roster().map(id => w.entities.get(id)!).filter(e => !e.hidden && e.health.current > 0);
        for (const admission of zoo.arrivals) {
          const e = w.entities.get(admission.id); if (!e) continue;
          let row = arrivals.get(e.id);
          if (!row) {
            row = { id: e.id, outlet: admission.outlet, alpha: admission.alpha, born: admission.tick / 60, released: null, downed: null, minPlayer: Infinity, minGroup: Infinity };
            arrivals.set(e.id, row);
          }
          if (!e.emerging && !e.hidden && !e.pendingAdmission && e.health.current > 0) {
            row.released ??= w.tick / 60;
            row.minPlayer = Math.min(row.minPlayer, Math.hypot(e.transform.x - player.transform.x, e.transform.z - player.transform.z));
            for (const human of group) row.minGroup = Math.min(row.minGroup, Math.hypot(e.transform.x - human.transform.x, e.transform.z - human.transform.z));
          }
          if (e.health.current <= 0) row.downed ??= w.tick / 60;
        }
        if (w.tick % 120 === 0) {
          const near = w.infected!.active.filter(e => e.health.current > 0 && !e.hidden && !e.pendingAdmission)
            .map(e => ({ id: e.id, outlet: arrivals.get(e.id)?.outlet, emerging: !!e.emerging, x: e.transform.x, z: e.transform.z,
              distance: Math.hypot(e.transform.x - player.transform.x, e.transform.z - player.transform.z),
              state: e.infected!.l1?.mode ?? e.infected!.state, target: e.infected!.l1?.targetId ?? e.infected!.targetId }))
            .sort((a,b) => a.distance - b.distance).slice(0, 8);
          samples.push({ seconds: w.tick / 60, player: { x: player.transform.x, z: player.transform.z }, near });
        }
      };
    },
    beforeDispose: w => { finalHash = stateHash(w.getState()); },
  });
  const control = JSON.parse(readFileSync(`docs/reports/fix51-verify/receipts/L8-${tier}-complete.json`, 'utf8'));
  assert.equal(identity.sourceHash, control.sourceHash);
  assert.equal(finalHash, control.nativeStateHash, 'contact observer preserves canonical policy state');
  rows.push({ tier, run, nativeStateHash: finalHash, controlIdentical: true, attacks, arrivals: [...arrivals.values()], samples });
  console.log(tier, { arrivals: arrivals.size, released: [...arrivals.values()].filter(r => r.released !== null).length,
    nearPlayer: [...arrivals.values()].filter(r => r.minPlayer < 5).length, attacks: attacks.length, controlIdentical: true });
}
atomicJson('docs/reports/fix54-c/l8-contact.json', { ...identity,
  toolSha256: createHash('sha256').update(readFileSync(new URL(import.meta.url))).digest('hex'),
  method: 'Read-only attack-start and entrance observation on canonical competent inputs; both final state hashes must match independent acceptance controls.', rows });
