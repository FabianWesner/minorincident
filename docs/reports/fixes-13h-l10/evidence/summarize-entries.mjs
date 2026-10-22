/** Compare matching production builds after both recorded entry batches finish. */
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
const root = process.argv[2] ?? 'test-results/fixes-13h-l10';
const summary = [];
for (const backend of ['webgl2', 'webgpu']) for (const entry of ['debug', 'continue']) {
  const [before, after] = ['production-entry-before', 'accepted-entry-guard'].map(dir => JSON.parse(readFileSync(`${root}/${dir}/${entry}-${backend}.json`)));
  assert.equal(after.backend, backend === 'webgl2' ? 'webgl' : 'webgpu');
  assert.deepEqual(after.state.transform, before.state.transform, 'same recorded route endpoint');
  assert.ok(after.max <= 200, 'no playable frame over 200 ms');
  assert.deepEqual(after.hitches, []);
  const loading = result => Object.values(result.load).reduce((sum, value) => sum + value, 0);
  const loadingDeltaMs = loading(after) - loading(before);
  assert.ok(loadingDeltaMs <= 1000, 'loading growth must stay within the authorized second');
  const play = after.frames.filter(f => f.scenario === 'L10' && f.at >= after.cardClosed);
  assert.ok(play.length > 100 && play.at(-1).tick >= 5131);
  assert.ok(play.every(f => f.sun !== f.spot));
  assert.equal(new Set(play.map(f => f.sun)).size, 2);
  assert.ok(play.filter(f => f.tick > 2800).every(f => f.warmup === 0));
  summary.push({ backend, entry, beforeMaxMs: before.max, afterMaxMs: after.max, beforeLoadingMs: loading(before), afterLoadingMs: loading(after), loadingDeltaMs, frames: after.playableFrames, endTick: play.at(-1).tick, endPosition: after.state.transform });
}
writeFileSync(`${root}/accepted-entry-summary.json`, JSON.stringify(summary, null, 2));
console.log(JSON.stringify(summary, null, 2));
