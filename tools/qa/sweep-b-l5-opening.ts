/** Read-only actual opening gunfire and caption clocks; matched unobserved controls. */
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { preset } from '../../src/sim/progression/Campaign';
import { LevelFiveBot } from '../../src/debug/bot/LevelFiveBot';
import { stateHash } from '../../src/sim/world/stateHash';
import { loadLevel } from '../sim-runner/levels';
import { provenance } from './accept/probe';
const rows = [];
for (const tier of ['low', 'high'] as const) {
  const hashes: string[] = [], events: unknown[] = [];
  for (const observed of [true, false]) {
    const campaign = preset('L5-default'); campaign.settings.quality = tier;
    const world = await loadLevel('L5', 1, campaign, 0, { quality: tier, beforeBegin: w => {
      if (observed) for (const type of ['ally.attack', 'l5.found', 'l5.emerged', 'l5.searching', 'dialogue.line'] as const) w.events.on(type, e => events.push(structuredClone(e)));
    } });
    try {
      const bot = new LevelFiveBot(world, 'complete');
      for (let i = 0; i < 60 * 80; i++) { world.applyInput(bot.sample(), 'keyboard'); world.update(); }
      hashes.push(stateHash(world.getState()));
    } finally { world.dispose(); }
  }
  assert.equal(hashes[0], hashes[1]); rows.push({ tier, hashes, events });
  console.log(tier, hashes, events.filter(e => (e as { type: string }).type === 'ally.attack').slice(0, 3));
}
writeFileSync('docs/reports/sweep-b/L5-opening.json', JSON.stringify({ ...provenance(), producerSha256: createHash('sha256').update(readFileSync('tools/qa/sweep-b-l5-opening.ts')).digest('hex'), method: 'Actual ordinary mortal competent input, seed1, first80s. Read-only event observer versus independent identical run without observer; exact state hashes required.', rows }, null, 2) + '\n');
