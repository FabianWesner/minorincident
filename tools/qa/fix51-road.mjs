/** Qualify prescribed L9 real-input routes using drawn bodies and actual
 * courier/APC motion. Run after the six tools/playtest routes finish. */
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';

const root = process.env.QA_OUT ?? 'test-results/fix51-p1/l9';
const rows = [];
for (const tier of ['low', 'high']) for (const route of ['road', 'countryside', 'dry-shortcut']) {
  const folder = `${root}/${route}-${tier}`;
  const summary = JSON.parse(readFileSync(`${folder}/summary.json`, 'utf8'));
  const entries = readFileSync(`${folder}/log-campaign.jsonl`, 'utf8').trim().split('\n').map(line => JSON.parse(line));
  assert.ok(entries.some(e => e.assist === 'L9 authored map route' && e.route === route), `${route}/${tier}: prescribed route not established`);
  const samples = entries.map(row => row.observation).filter(row => row?.driving && row.player);
  let empty = 0, moving = 0, maxEmpty = 0, maxMoving = 0, visible = 0;
  for (let i = 1; i < samples.length; i++) {
    const a = samples[i - 1], b = samples[i], seconds = (b.tick - a.tick) / 60;
    if (seconds <= 0) continue;
    if (b.enemies.some(e => e.drawn && e.hp > 0)) { empty = moving = 0; visible++; }
    else {
      empty += seconds;
      const metres = Math.hypot(b.player.x - a.player.x, b.player.z - a.player.z);
      if (metres / seconds >= .5) moving += seconds;
      maxEmpty = Math.max(maxEmpty, empty); maxMoving = Math.max(maxMoving, moving);
    }
  }
  const row = { route, tier, finished: summary.runs.some(r => r.finished && r.skipped.length === 0), samples: samples.length,
    visibleSamples: visible, maxEmptySimSeconds: maxEmpty, maxEmptyMovingSeconds: maxMoving,
    issues: summary.issues, method: 'Actual drawn/on-camera living bodies at ~1 s observations. Empty intervals integrate fixed ticks and actual x/z displacement; moving >=0.5 m/s, matching the rejected batch51 road trace. Stops are also reported without exclusion.' };
  rows.push(row);
}
writeFileSync(`${root}/presence.json`, JSON.stringify(rows, null, 2) + '\n');
console.log(JSON.stringify(rows, null, 2));
for (const row of rows) {
  assert.ok(row.finished && row.samples > 10 && row.visibleSamples > 0, `${row.route}/${row.tier}: complete route/visibility coverage missing`);
  assert.ok(row.maxEmptyMovingSeconds <= 60, `${row.route}/${row.tier}: over 60 s of driving without an infected in frame`);
}
