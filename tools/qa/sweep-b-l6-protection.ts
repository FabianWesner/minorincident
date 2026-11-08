/** Current-source mortal L6 complete/evade-only comparison for L6-11. */
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { LevelSixBot } from '../../src/debug/bot/LevelSixBot';
import { preset } from '../../src/sim/progression/Campaign';
import { stateHash } from '../../src/sim/world/stateHash';
import { loadLevel } from '../sim-runner/levels';
import { followFrustum } from '../sim-runner/l3Bots';
import { provenance } from './accept/probe';

const identity = provenance(), rows = [];
for (const tier of ['low', 'high'] as const) for (const policy of ['complete', 'evade-only'] as const) {
  const campaign = preset('L6-default'); campaign.settings.quality = tier;
  const events: unknown[] = [];
  const world = await loadLevel('L6', 1, campaign, 0, { quality: tier, beforeBegin: w => {
    for (const type of ['outbreak.bite', 'player.died'] as const) w.events.on(type, e => events.push(structuredClone(e)));
  } });
  try {
    const bot = new LevelSixBot(world, policy);
    for (let i = 0; i < 600 * 60 && !bot.finished; i++) {
      followFrustum(world); world.applyInput(bot.sample(), 'keyboard'); world.update();
    }
    const m = world.missions!, finalHash = stateHash(world.getState());
    const canonical = JSON.parse(readFileSync(`docs/reports/fix51-verify/receipts/L6-${tier}-complete.json`, 'utf8'));
    assert.equal(canonical.sourceHash, identity.sourceHash);
    if (policy === 'complete') assert.equal(finalHash, canonical.nativeStateHash, 'complete result must match current canonical L6 receipt');
    const result = m.state.result, roster = m.state.l6!.survivors;
    if (result) {
      assert.notEqual(result.survivorsLost, undefined, 'L6-11 result must account for losses');
      assert.equal(result.survivorsIn, result.rescued + result.survivorsLost!, 'L6-11 roster must balance');
    }
    rows.push({ tier, policy, completed: !!result, time: m.state.stats.time, deaths: m.state.stats.deaths,
      result: result ? { rescued: result.rescued, survivorsIn: result.survivorsIn, survivorsLost: result.survivorsLost, survivors: result.survivors } : null,
      roster: structuredClone(roster), events, finalHash, canonicalHash: policy === 'complete' ? canonical.nativeStateHash : null });
    console.log(tier, policy, JSON.stringify({ completed: !!result, rescued: result?.rescued, in: result?.survivorsIn, lost: result?.survivorsLost, deaths: m.state.stats.deaths }));
  } finally { world.dispose(); }
}
writeFileSync(process.env.L6_VISUAL_NATIVE_OUT ?? 'docs/reports/sweep-b/L6-11-protection.json', JSON.stringify({ ...identity,
  producerSha256: createHash('sha256').update(readFileSync('tools/qa/sweep-b-l6-protection.ts')).digest('hex'),
  method: 'Current-source production loadLevel, seed1 progressed L6 campaign, matched low/high quality and ordinary mortal input. Complete final-state hashes must equal current canonical receipts; evade-only is the actual moving no-attack policy. Full result, survivor roster, bite and death ledgers are retained. No protected-courier benchmark is inferred.', rows }, null, 2) + '\n');
