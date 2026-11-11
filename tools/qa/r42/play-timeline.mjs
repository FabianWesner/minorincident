// r42-l9pin: objective changes (counts kept, distances stripped) and APC stops > 10 s from an r28-vqa-fixture-play log.jsonl.
// Usage: node tools/qa/r42/play-timeline.mjs <log.jsonl>
import { readFileSync } from 'node:fs';
let last = '', stopAt = null, stopPos = null;
for (const line of readFileSync(process.argv[2], 'utf8').split('\n')) {
  let j; try { j = JSON.parse(line); } catch { continue; }
  if (j.tick === undefined) continue;
  const text = (j.objective ?? '').replace(/\s·\s\d+\sm$/u, "");
  if (j.objective !== undefined && text !== last) { console.log(j.tick, text); last = text; }
  if (j.driving) {
    const p = { x: j.driving.x, z: j.driving.z };
    if (!stopPos || Math.hypot(p.x - stopPos.x, p.z - stopPos.z) > 3) {
      if (stopPos && j.tick - stopAt > 600) console.log(`  APC stood ${((j.tick - stopAt) / 60).toFixed(0)} s at ${stopPos.x.toFixed(1)},${stopPos.z.toFixed(1)} (ticks ${stopAt}-${j.tick})`);
      stopPos = p; stopAt = j.tick;
    }
  }
}
