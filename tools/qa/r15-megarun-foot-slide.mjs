import { readFileSync, writeFileSync } from 'node:fs';

const path = process.argv[2];
if (!path) throw new Error('Usage: node tools/qa/r15-megarun-foot-slide.mjs <scene metrics.json>');
const report = JSON.parse(readFileSync(path, 'utf8'));
const actor = report.metrics?.actors?.mega;
if (!actor?.track) throw new Error('Scene metrics must include trace=true and an actor named mega');

const ratios = [];
for (let i = 1; i < actor.track.length; i++) {
  const before = actor.track[i - 1], after = actor.track[i];
  if (before.frame < 30) continue; // Exclude spawn/admission; measure sustained travel.
  if (after.frame !== before.frame + 1) continue;
  const groundSpeed = Math.max(before.speed ?? 0, after.speed ?? 0);
  if (groundSpeed < 1) continue;
  for (let foot = 0; foot < Math.min(before.feet.length, after.feet.length); foot++) {
    const a = before.feet[foot], b = after.feet[foot];
    const floorA = before.floor ?? 0, floorB = after.floor ?? 0;
    // Use the production Scene Lab contact rule, and the same point on both frames.
    // Heel-to-toe roll moves the shoe centre while its actual support stays planted.
    const point = a.toe[1] <= floorA + .012 && b.toe[1] <= floorB + .012 ? 'toe'
      : a.heel[1] <= floorA + .012 && b.heel[1] <= floorB + .012 ? 'heel' : undefined;
    if (!point) continue;
    const [ax, , az] = a[point], [bx, , bz] = b[point];
    const footSpeed = Math.hypot(bx - ax, bz - az) * 60;
    ratios.push(footSpeed / groundSpeed);
  }
}
if (ratios.length < 20) throw new Error(`Only ${ratios.length} foot-contact samples; need at least 20`);
ratios.sort((a, b) => a - b);
const p95 = ratios[Math.floor((ratios.length - 1) * 0.95)];
const result = { metric: 'rendered sole speed / Mega ground speed during sole contact', contactSamples: ratios.length, p50: +ratios[Math.floor((ratios.length - 1) * 0.5)].toFixed(4), p95: +p95.toFixed(4), limit: 0.1, pass: p95 < 0.1 };
const out = path.replace(/metrics\.json$/, 'foot-slide.json');
writeFileSync(out, `${JSON.stringify(result, null, 2)}\n`);
console.log(JSON.stringify({ ...result, out }, null, 2));
if (!result.pass) process.exitCode = 1;
