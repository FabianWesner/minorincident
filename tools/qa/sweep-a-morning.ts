/** L1-02: ordinary, untouched morning; every fixed tick for sixty seconds. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { loadLevel } from '../sim-runner/levels';
import { provenance } from './accept/probe';

interface Sample {
  tick: number; id: number; x: number; z: number; yaw: number; hidden: boolean;
  activity?: string; anchor?: string; face?: { x: number; z: number }; yawError: number | null;
}
/** Facing nowhere: no meaningful authored target ahead. Actual travel of0.1m ends an idle interval. */
function measure(samples: Sample[]) {
  let prior: Sample | undefined, badTicks = 0, travel = 0, maximum = 0, endTick = 0;
  for (const s of samples) {
    if (prior && !s.hidden && (s.yawError === null || Math.cos(s.yawError) <= 0)) {
      travel += Math.hypot(s.x - prior.x, s.z - prior.z);
      if (travel > .1) { badTicks = 0; travel = 0; }
      else badTicks++;
      if (badTicks > maximum) { maximum = badTicks; endTick = s.tick; }
    } else { badTicks = 0; travel = 0; }
    prior = s;
  }
  return { maxUnfacedIdleTicks: maximum, endTick, pass: maximum <= 180 };
}
const fake = Array.from({ length: 182 }, (_, tick): Sample => ({ tick, id: 1, x: 0, z: 0, yaw: Math.PI, hidden: false, face: { x: 1, z: 0 }, yawError: Math.PI }));
const controls = [
  { name: 'stationary actor facing away for181ticks fails', pass: !measure(fake).pass },
  { name: 'stationary actor with no facing target for181ticks fails', pass: !measure(fake.map(s => ({ ...s, face: undefined, yawError: null }))).pass },
  { name: 'exact180tick bound passes', pass: measure(fake.slice(0, 181)).pass },
  { name: 'stationary actor actually facing target passes', pass: measure(fake.map(s => ({ ...s, yaw: 0, yawError: 0 }))).pass },
];
assert(controls.every(c => c.pass));
const runs = [];
for (const tier of ['low', 'high'] as const) {
  const world = await loadLevel('L1', 1, undefined, 0, { quality: tier });
  try {
    const humans = [...world.entities.iterate()].filter(e => e.civilian && !e.civilian.pet && !e.infected);
    const samples = new Map(humans.map(e => [e.id, [] as Sample[]]));
    let maxInfected = 0, combatEvents = 0;
    for (let tick = 0; tick <= 3600; tick++) {
      maxInfected = Math.max(maxInfected, [...world.entities.iterate()].filter(e => e.infected && e.health.current > 0).length);
      combatEvents += world.events.events(world.tick - 1).filter(e => e.type.startsWith('combat.')).length;
      for (const e of humans) {
        const c = e.civilian!, activity = c.schedule?.[c.scheduleStep ?? 0], p = e.transform;
        // The story technician is held by LevelOneOutbreak at this actual door-facing yaw, rather than by a walking schedule.
        const technician = e.id === world.missions!.state.l1!.techId;
        const face = technician ? world.missions!.def.anchors['lab-door'] : activity?.facing;
        const distance = face ? Math.hypot(face.x - p.x, face.z - p.z) : 0;
        const desired = face ? -Math.atan2(face.z - p.z, face.x - p.x) : 0;
        samples.get(e.id)!.push({ tick: world.tick, id: e.id, x: p.x, z: p.z, yaw: p.yaw, hidden: !!e.hidden,
          activity: technician ? 'story-wait' : activity?.activity, anchor: technician ? 'lab-door' : activity?.anchor,
          face: face ? { x: face.x, z: face.z } : undefined,
          yawError: distance > 1e-6 ? Math.abs(Math.atan2(Math.sin(desired - p.yaw), Math.cos(desired - p.yaw))) : null });
      }
      if (tick < 3600) world.update();
    }
    const actors = [...samples].map(([id, ledger]) => ({ id, ...measure(ledger), samples: ledger }));
    runs.push({ tier, humanCount: humans.length, maxInfected, combatEvents, phase: world.missions!.state.l1!.phase,
      pass: humans.length >= 50 && humans.length <= 60 && !maxInfected && !combatEvents && actors.every(a => a.pass), actors });
    console.log(tier, humans.length, Math.max(...actors.map(a => a.maxUnfacedIdleTicks)), runs.at(-1)!.pass);
  } finally { world.dispose(); }
}
const root = process.env.SWEEP_MORNING_OUT ?? 'docs/reports/sweep-a';
const ledger = `${root}/L1-02-current-ledger.json.gz`;
writeFileSync(ledger, gzipSync(JSON.stringify({ ...provenance(), runs })));
writeFileSync(`${root}/L1-02-current-review.json`, JSON.stringify({ ...provenance(),
  criterion: '50–60 civilians at start, none idle facing nowhere > 3 s; 0 infected; 0 `combat.*`.',
  method: 'Seed1, ordinary stationary opening, no relocation/protection/mission skips, both qualities, every tick0–3600. Actual yaw uses transform-to-target, matching Outbreak.face; the technician faces the authored lab door. Hidden interiors do not establish visible idle. Facing nowhere is observed as no authored meaningful target ahead (missing target, coincident target, or target behind the actual body heading). More than0.1m cumulative actual travel ends an idle interval. Full actual heading errors are retained; merely being slightly off exact mathematical yaw does not mean facing nowhere. Population targets correspond to partners, seats, flowers, doorways and shop displays, as authored in Population.ts and MorningRoutines.ts.',
  controls, toolSha256: createHash('sha256').update(readFileSync(import.meta.filename)).digest('hex'),
  ledger: { file: ledger, sha256: createHash('sha256').update(readFileSync(ledger)).digest('hex') },
  runs: runs.map(r => ({ ...r, actors: r.actors.map(({ samples, ...a }) => ({ ...a, sampleCount: samples.length })) })),
  status: runs.every(r => r.pass) ? 'PASS' : 'FAIL',
}, null, 2) + '\n');
