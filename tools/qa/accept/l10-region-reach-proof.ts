import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { runLevel } from '../../sim-runner/levels';
import { preset } from '../../../src/sim/progression/Campaign';
import { cure } from '../../../src/levels/L10/district';
import { stateHash } from '../../../src/sim/world/stateHash';
import { PathProbe } from '../threat/observer';
import { AcceptanceObserver } from './observer';
import { provenance, type NativeReceipt } from './probe';
import { atomicJson } from './report';

const identity = provenance(), results = [];
for (const tier of ['low', 'high'] as const) {
  const control = JSON.parse(readFileSync(`docs/reports/fix51-verify/receipts/L10-${tier}-complete.json`, 'utf8')) as NativeReceipt;
  assert.equal(control.sourceHash, identity.sourceHash); assert.equal(control.observerHash, identity.observerHash);
  const paths = new PathProbe(), samples: { region: string; tick: number; nearby: number; reachable: number; blocked: number[] }[] = [];
  let observer: AcceptanceObserver | undefined, observation: ReturnType<AcceptanceObserver['finish']> | undefined, finalHash = '';
  const campaign = preset('L10-default'); campaign.settings.quality = tier;
  const run = await runLevel('L10', 'complete', 1, undefined, 'auto', campaign, undefined, 0, {
    quality: tier,
    beforeBegin: w => {
      observer = new AcceptanceObserver(w);
      const update = w.update.bind(w);
      w.update = () => {
        update();
        if (w.tick % 30 || w.missions!.state.phase !== 'playing' || w.missions!.state.states['cure-released']) return;
        const player = w.entities.get(1)!, region = cure.regions.find(r => player.transform.x >= r.envelope[0][0] && player.transform.x <= r.envelope[1][0]);
        if (!region) return;
        const enemies = w.infected!.active.filter(e => e.health.current > 0 && !e.corpse && Math.hypot(e.transform.x - player.transform.x, e.transform.z - player.transform.z) <= 30);
        const blocked: number[] = [];
        for (const e of enemies) {
          const native = w.infected!.navigation, at = e.transform;
          const goal = e.infected!.pursuit ? player.transform : native.target(at, player.transform);
          const grid = e.infected!.pursuit && w.megaPursuit ? w.megaPursuit.grid : native.grid(at);
          const disconnected = goal === at && Math.hypot(at.x - player.transform.x, at.z - player.transform.z) > 2.5;
          if (e.pendingAdmission || disconnected || !paths.query(grid, e, player.transform, 2.5)) blocked.push(e.id);
        }
        samples.push({ region: region.id, tick: w.tick, nearby: enemies.length, reachable: enemies.length - blocked.length, blocked });
      };
    },
    beforeDispose: w => { observation = observer!.finish(); finalHash = stateHash(w.getState()); },
  });
  assert(run.completed); assert.equal(finalHash, control.nativeStateHash, 'regional observation must leave the native control identical');
  const regions = cure.regions.map((region, index) => {
    const measured = samples.filter(sample => sample.region === region.id && sample.nearby), window = observation!.regions[region.id];
    assert(window?.ticks && measured.length, `${tier}/${region.id}: missing geographic window or nonempty path sample`);
    const minimumPercent = Math.min(...measured.map(sample => sample.reachable / sample.nearby * 100));
    const attacksPerMinute = window.attacks / (window.ticks / 3600), targetAttacksPerMinute = index < 2 ? 2 : 4;
    return { region: region.id, ticks: window.ticks, playerWindups: window.attacks, attacksPerMinute, targetAttacksPerMinute,
      pathSamples: measured.length, minimumPercent, targetPercent: 90, status: minimumPercent >= 90 && window.attacks > 0 && attacksPerMinute >= targetAttacksPerMinute ? 'PASS' : 'FAIL' };
  });
  results.push({ tier, run, control: { expected: control.nativeStateHash, observed: finalHash, identical: true }, regions, samples });
}
atomicJson('docs/reports/fix51-r5c/l10-region-reach-proof.json', { ...identity,
  codeHash: createHash('sha256').update(readFileSync('tools/qa/accept/l10-region-reach-proof.ts')).digest('hex'),
  method: 'Read-only ordinary native competent routes, seed1, both tiers; geographic envelopes; actual player windups and full time in each region; every30 ticks all living infected within30m, including pending admissions as blocked; body-clear path≤2.5×direct. No actor/input/RNG changes. Final state equals independent canonical native control.',
  results, pass: results.every(result => result.regions.every(region => region.status === 'PASS')) });
console.log(results.map(result => `${result.tier}: ${result.regions.map(region => `${region.region}=${region.status}(${region.minimumPercent}%)`).join(', ')}`).join('\n'));
