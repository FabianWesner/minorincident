import { drive, metrics, scenarios, wander } from './harness';
// npx tsx tools/crowdfoot/debug.ts <asset> <civilian|infected> <scenario> [scale]
const [asset, kind, name, scale] = process.argv.slice(2);
const plans = scenarios[kind as 'civilian'] as Record<string, (t: number) => { speed: number; yaw: number }>;
const seeded = /^seed(\d+)$/.exec(name), speeds = kind === 'infected' ? [0, 1, 5.1, 5.6] : Number(scale ?? 1) < 1 ? [0, 1.4, 4.8] : [0, 1.4, 1.4, 4.8];
const frames = await drive(asset, { kind: kind as 'civilian', tier: 'infected-lurch' }, seeded ? 12 : name.startsWith('wander') ? 10 : 4, seeded ? wander(speeds, Number(seeded[1]) * 13 + 1) : plans[name], true, Number(scale ?? 1));
console.log(metrics(frames)); console.log("floor", Math.min(...frames.filter(f => f.t > .5).flatMap(f => f.feet.flatMap(c => [c.heel.y, c.toe.y]))));
const floor = Math.min(...frames.filter(f => f.t > .5).flatMap(f => f.feet.flatMap(c => [c.heel.y, c.toe.y])));
let last: typeof frames[number] | undefined;
for (const f of frames) {
  if (f.t < .5) continue;
  const row = f.feet.map((c, i) => {
    const low = Math.min(c.heel.y, c.toe.y) - floor, d = last ? Math.hypot(c.heel.x - last.feet[i].heel.x, c.heel.z - last.feet[i].heel.z) * 100 : 0;
    return `${low < .012 ? 'G' : ' '} h${(low * 100).toFixed(1).padStart(5)} d${d.toFixed(1).padStart(5)} y${(c.yaw * 57.3).toFixed(0).padStart(4)}`;
  });
  console.log(f.t.toFixed(3), f.clip.padEnd(14), f.speed.toFixed(2), f.phase.toFixed(2), f.debug.padEnd(12), row.join(' | '));
  last = f;
}
// Contacts that slide more than 1.5 cm (start/end time, foot, slide).
for (let i = 0; i < 2; i++) {
  let start = -1, slide = 0, prev: typeof frames[number] | undefined, yaw0 = 0, drift = 0;
  for (const f of frames) {
    if (f.t < .5) continue;
    const c = f.feet[i], grounded = Math.min(c.heel.y, c.toe.y) < floor + .012;
    if (grounded) { if (start < 0) { start = f.t; yaw0 = c.yaw; drift = 0; } drift = Math.max(drift, Math.abs(Math.atan2(Math.sin(c.yaw - yaw0), Math.cos(c.yaw - yaw0))) * 57.3); if (prev) slide += Math.hypot(c.heel.x - prev.feet[i].heel.x, c.heel.z - prev.feet[i].heel.z); prev = f; }
    else { if (start >= 0 && drift > 4) console.log('YAW foot', i, start.toFixed(3), '-', f.t.toFixed(3), drift.toFixed(1), 'deg'); if (start >= 0 && slide > .015) console.log('SLIDE foot', i, start.toFixed(3), '-', f.t.toFixed(3), (slide * 100).toFixed(1), 'cm'); start = -1; slide = 0; prev = undefined; }
  }
}
