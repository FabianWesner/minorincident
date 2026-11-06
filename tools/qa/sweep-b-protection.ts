/** Matched ordinary mortal complete/evade policies; no actor/input protection. */
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { LevelFiveBot } from '../../src/debug/bot/LevelFiveBot';
import { LevelSixBot } from '../../src/debug/bot/LevelSixBot';
import { preset } from '../../src/sim/progression/Campaign';
import { stateHash } from '../../src/sim/world/stateHash';
import { loadLevel } from '../sim-runner/levels';
import { followFrustum } from '../sim-runner/l3Bots';
import { provenance } from './accept/probe';
const identity = provenance(), rows = [];
for (const level of ['L5', 'L6'] as const) for (const tier of ['low', 'high'] as const) for (const policy of ['complete', 'evade-only'] as const) {
  const campaign = preset(`${level}-default`); campaign.settings.quality = tier;
  const events: unknown[] = [];
  const world = await loadLevel(level, 1, campaign, 0, { quality: tier, beforeBegin: w => {
    for (const type of ['outbreak.bite', 'player.died', 'checkpoint.restored', 'l5.found', 'l5.lost'] as const) w.events.on(type, e => events.push(structuredClone(e)));
  } });
  try {
    const bot = level === 'L5' ? new LevelFiveBot(world, policy) : new LevelSixBot(world, policy);
    for (let i = 0; i < 600 * 60 && !bot.finished; i++) {
      if (level === 'L6') followFrustum(world);
      world.applyInput(bot.sample(), 'keyboard'); world.update();
    }
    const m = world.missions!, finalHash = stateHash(world.getState());
    const canonical = JSON.parse(readFileSync(`docs/reports/fix51-verify/receipts/${level}-${tier}-complete.json`, 'utf8'));
    assert.equal(canonical.sourceHash, identity.sourceHash);
    if (policy === 'complete') assert.equal(finalHash, canonical.nativeStateHash, 'matched complete route must retain canonical final state');
    const result = m.state.result;
    const roster = level === 'L5' ? m.state.l5!.survivors : m.state.l6!.survivors;
    rows.push({ level, tier, policy, completed: !!result, time: m.state.stats.time, deaths: m.state.stats.deaths,
      result: result ? { rescued: result.rescued, survivorsIn: result.survivorsIn, survivorsLost: result.survivorsLost, survivors: result.survivors } : null,
      roster: structuredClone(roster), events, finalHash, canonicalHash: policy === 'complete' ? canonical.nativeStateHash : null });
    console.log(level, tier, policy, JSON.stringify({ completed: !!result, rescued: result?.rescued, in: result?.survivorsIn, lost: result?.survivorsLost, deaths: m.state.stats.deaths }));
  } finally { world.dispose(); }
  writeFileSync('docs/reports/sweep-b/protection.json', JSON.stringify({ ...identity,
    producerSha256: createHash('sha256').update(readFileSync('tools/qa/sweep-b-protection.ts')).digest('hex'),
    method: 'Matched production loadLevel, seed1 progressed campaign, same tier and ordinary mortal input. Complete final-state hashes must equal current canonical receipts. Evade-only is the actual moving no-attack policy, not the stationary protection policy. Full result/roster/bite/death ledgers retained; no human-like browser benchmark is claimed.', rows }, null, 2) + '\n');
}
