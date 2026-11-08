/** r12-group: human group-naturalness metrics for every follower level.
 * `node --import tsx/esm tools/qa/r12-group-probe.ts <L2|L3|L5|L6|L7|L8> <low|high> <seed> [tag]`
 * Samples every 15 ticks while a follower group exists and prints one JSON line:
 * - standR: mean resultant length of standing followers' yaws (1 = everyone faces the same way)
 * - moveYawR: mean resultant length of moving followers' facing directions
 * - moveR: mean resultant length of moving followers' velocity directions (1 = all walk parallel)
 * - nnCv: coefficient of variation of nearest-neighbour distances (lattice ≈ 0, loose cluster higher)
 * - nnMin: smallest nearest-neighbour foot distance seen (includes ground-height differences)
 * - startSpread: std (s) of follower start delays after the courier leaves a ≥1 s rest
 * - rails: share of moving followers whose lateral offset to the courier stays within ±5 cm over 2 s (rails)
 * Output also goes to test-results/r12-group/<tag>-<level>-<tier>-<seed>.json. */
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { runLevel } from '../sim-runner/levels';
import { loadL2, runL2 } from '../sim-runner/l2Bots';
import { provenance } from './accept/probe';
import type { SimWorld } from '../../src/sim/world/SimWorld';
import { preset } from '../../src/sim/progression/Campaign';
import type { RunnerLevel } from '../sim-runner/levels';
import type { EntitySnapshot } from '../../src/sim/world/types';

const level = (process.argv[2] ?? 'L7') as RunnerLevel, tier = process.argv[3] === 'high' ? 'high' : 'low', seed = Number(process.argv[4] ?? 1), tag = process.argv[5] ?? 'probe';
const identity = { ...provenance(), toolHash: createHash('sha256').update(readFileSync(new URL(import.meta.url))).digest('hex') };
const campaign = preset(`${level}-default` as never); campaign.settings.quality = tier;
const resultant = (angles: number[]) => angles.length < 2 ? NaN : Math.hypot(angles.reduce((s, a) => s + Math.cos(a), 0), angles.reduce((s, a) => s + Math.sin(a), 0)) / angles.length;
const mean = (v: number[]) => v.length ? v.reduce((a, b) => a + b, 0) / v.length : NaN;
const std = (v: number[]) => { const m = mean(v); return Math.sqrt(mean(v.map(x => (x - m) ** 2))); };
const standR: number[] = [], moveR: number[] = [], moveYawR: number[] = [], nnCv: number[] = [], nnCvStanding: number[] = [];
let nnMin = Infinity, groupSamples = 0, groupMax = 0;
const starts: number[] = [];
let restTicks = 0, startTick = -1; const started = new Set<number>(), startDelays: number[] = [];
const lateral = new Map<number, number[]>(); let rails = 0, railSamples = 0;
const observe = (world: SimWorld) => {
  const update = world.update.bind(world);
  world.update = (...args: Parameters<typeof world.update>) => {
    const tick = world.tick; update(...args); if (world.tick === tick) return;
    const player = world.entities.get(1)!, v = player.survivor?.velocity ?? { x: 0, z: 0 }, ls = Math.hypot(v.x, v.z);
    const group: EntitySnapshot[] = [];
    for (const e of world.entities.iterate()) if ((e.civilian?.survivor?.mode === 'follow' || e.civilian?.ally?.follow?.targetId === player.id || e.escort?.state === 'follow' || level === 'L2' && world.missions!.state.l2!.crewIds.includes(e.id)) && !e.hidden && e.health.current > 0 && e.passengerOf === undefined && !e.corpse && !e.infected && !e.infection
      && Math.hypot(e.transform.x - player.transform.x, e.transform.z - player.transform.z) < 14) group.push(e);
    groupMax = Math.max(groupMax, group.length);
    // Start reaction: courier rested ≥ 1 s, then moves.
    if (ls < .2) { restTicks++; if (startTick >= 0 && world.tick - startTick > 120) startTick = -1; }
    else { if (restTicks >= 60 && group.length >= 3) { startTick = world.tick; started.clear(); starts.length = 0; } restTicks = 0; }
    if (startTick >= 0) for (const e of group) if (!started.has(e.id) && (e.motion?.speed ?? 0) > .5) { started.add(e.id); starts.push((world.tick - startTick) / 60); }
    if (startTick >= 0 && world.tick - startTick === 120 && starts.length >= 3) startDelays.push(std(starts));
    if (world.tick % 15) return;
    if (group.length < 3) { lateral.clear(); return; }
    groupSamples++;
    const standing = group.filter(e => ls < .2 && (e.motion?.speed ?? 0) < .1), moving = group.filter(e => ls > .8 && (e.motion?.speed ?? 0) > 1);
    if (standing.length >= 3) standR.push(resultant(standing.map(e => e.transform.yaw)));
    if (moving.length >= 3) {
      moveR.push(resultant(moving.map(e => Math.atan2(e.locomotion?.vz ?? 0, e.locomotion?.vx ?? 0))));
      moveYawR.push(resultant(moving.map(e => e.transform.yaw)));
      const hx = v.x / ls, hz = v.z / ls;
      for (const id of lateral.keys()) if (!moving.some(e => e.id === id)) lateral.delete(id);
      for (const e of moving) {
        const side = (e.transform.z - player.transform.z) * hx - (e.transform.x - player.transform.x) * hz;
        const row = lateral.get(e.id) ?? []; row.push(side); if (row.length > 9) row.shift(); lateral.set(e.id, row);
        if (row.length === 9) { railSamples++; if (Math.max(...row) - Math.min(...row) < .1) rails++; }
      }
    } else lateral.clear();
    const nn = group.map(a => Math.min(...group.filter(b => b !== a).map(b => Math.hypot(a.transform.x - b.transform.x, a.transform.z - b.transform.z, a.transform.y - b.transform.y))));
    nnMin = Math.min(nnMin, ...nn);
    nnCv.push(std(nn) / mean(nn));
    if (standing.length === group.length) nnCvStanding.push(std(nn) / mean(nn));
  };
};
let outcome: string, time: number, timeline: string[] = [];
if (level === 'L2') {
  const { world, mission } = await loadL2(seed, tier);
  observe(world);
  const report = runL2(world, mission, 'complete');
  outcome = report.outcome; time = report.simSeconds; world.dispose();
} else {
  const run = await runLevel(level, 'complete', seed, undefined, 'auto', campaign, undefined, 0, { quality: tier, beforeBegin: observe });
  outcome = run.outcome; time = run.time;
  if (process.env.TIMELINE) timeline = run.objectiveTimeline.map(o => `${o.id}@${o.t.toFixed(0)}`);
}
const out = { ...identity, generatedAt: new Date().toISOString(), level, tier, seed, tag, scope: level === 'L2' ? 'scripted firefighter crew' : 'human followers', outcome, time: +time.toFixed(1), groupSamples,
  groupMax, standR: +mean(standR).toFixed(3), standN: standR.length, moveR: +mean(moveR).toFixed(3), moveYawR: +mean(moveYawR).toFixed(3), moveN: moveR.length,
  nnCv: +mean(nnCv).toFixed(3), nnCvStanding: +mean(nnCvStanding).toFixed(3), nnMin: +nnMin.toFixed(3), startSpread: +mean(startDelays).toFixed(3), startN: startDelays.length,
  rails: +(rails / Math.max(1, railSamples)).toFixed(3), railSamples, timeline: timeline.length ? timeline.join(' ') : undefined };
mkdirSync('test-results/r12-group', { recursive: true });
writeFileSync(`test-results/r12-group/${tag}-${level}-${tier}-${seed}.json`, JSON.stringify(out));
console.log(JSON.stringify(out));
process.exit(0);
