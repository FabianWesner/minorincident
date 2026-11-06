/** Read-only receipt of complete-policy target choices at real group bites. */
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { LevelSixBot } from '../../src/debug/bot/LevelSixBot';
import { emptyInput } from '../../src/input/InputFrame';
import { preset } from '../../src/sim/progression/Campaign';
import { stateHash } from '../../src/sim/world/stateHash';
import { loadLevel } from '../sim-runner/levels';
import { followFrustum } from '../sim-runner/l3Bots';
import { provenance } from './accept/probe';
const identity = provenance(), rows = [];
for (const tier of ['low', 'high'] as const) {
  const save = preset('L6-default'); save.settings.quality = tier;
  const w = await loadLevel('L6', 1, save, 0, { quality: tier });
  try {
    const bot = new LevelSixBot(w, 'complete'), bites: unknown[] = []; let frame = emptyInput();
    w.events.on('outbreak.bite', event => {
      if (event.type !== 'outbreak.bite' || !w.missions!.state.l6!.survivors.some(r => r.id === event.targetId)) return;
      const source = w.entities.get(event.sourceId)!, player = w.entities.get(1)!, victim = w.entities.get(event.targetId)!;
      const range = Math.hypot(player.transform.x - source.transform.x, player.transform.z - source.transform.z);
      const aimError = frame.aimPoint ? Math.hypot(frame.aimPoint.x - source.transform.x, frame.aimPoint.z - source.transform.z) : null;
      bites.push({ ...event, player: { ...player.transform }, biter: { ...source.transform }, victim: { ...victim.transform },
        range, visible: w.infected!.nav.visible(player.transform, source.transform, 0),
        shotClear: w.combat!.query.shotVisible(player.transform, source.transform, source.id), aimError, input: structuredClone(frame) });
    });
    for (let tick = 0; tick < 600 * 60 && !bot.finished; tick++) {
      followFrustum(w); frame = bot.sample(); w.applyInput(frame, 'keyboard'); w.update();
    }
    const canonical = JSON.parse(readFileSync(`docs/reports/fix51-verify/receipts/L6-${tier}-complete.json`, 'utf8'));
    assert.equal(canonical.sourceHash, identity.sourceHash);
    const finalHash = stateHash(w.getState()); assert.equal(finalHash, canonical.nativeStateHash);
    rows.push({ tier, result: w.missions!.state.result, finalHash, canonicalHash: canonical.nativeStateHash, bites });
    console.log(tier, 'bites', bites.length, 'out', w.missions!.state.result?.rescued);
  } finally { w.dispose(); }
}
writeFileSync('test-results/fix67-b/l6-cover-trace.json', JSON.stringify({ ...identity, rows }, null, 2) + '\n');
