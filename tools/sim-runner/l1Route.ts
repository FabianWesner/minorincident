/**
 * L1 route report (PO 2026-10-08 "does the player ever meet the outbreak?"): runs the L1 bots and samples, every sim second,
 * the courier position, the active objective and every living visible infected. Writes one JSON per run plus a summary with
 * times, deaths and final-leg encounters (distinct infected that came within 6 m of the courier while "Go into the fire
 * station" was active).
 *
 *   sh tools/sim-lock.sh npx tsx tools/sim-runner/l1Route.ts --profiles complete,newbie,evade-only --seeds 1-5 --out test-results/l1-route
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { parseArgs } from 'node:util';
import { loadL1, runL1, type L1Profile } from './l1Bots';

const { values } = parseArgs({ options: { profiles: { type: 'string', default: 'complete,newbie,evade-only' }, seeds: { type: 'string', default: '1-5' }, out: { type: 'string', default: 'test-results/l1-route' } } });
const [s0, s1 = s0] = values.seeds!.split('-').map(Number);
const ENCOUNTER_M = 6;
mkdirSync(values.out!, { recursive: true });
const summary: Record<string, unknown>[] = [];
for (const profile of values.profiles!.split(',') as L1Profile[]) for (let seed = s0; seed <= s1; seed++) {
  const { world, mission } = await loadL1(seed);
  const samples: { t: number; step: string; p: [number, number]; inf: [number, number][] }[] = [];
  const met = new Set<number>(); let maxNear = 0, legStart = -1, legEnd = -1;
  try {
    const report = runL1(world, mission, profile, {
      seed, onTick: (w, m) => {
        const step = m.def.steps.find(s => m.state.steps[s.id].status === 'active')?.id ?? '-';
        const p = w.entities.get(1)!.transform, live = (w.infected?.active ?? []).filter(e => e.health.current > 0 && !e.hidden && !e.infected?.hidden);
        if (step === 'firestation') {
          if (legStart < 0) legStart = w.tick / 60;
          legEnd = w.tick / 60;
          let near = 0;
          for (const e of live) if (Math.hypot(e.transform.x - p.x, e.transform.z - p.z) <= ENCOUNTER_M) { met.add(e.id); near++; }
          maxNear = Math.max(maxNear, near);
        }
        if (w.tick % 60) return;
        samples.push({ t: w.tick / 60, step, p: [+p.x.toFixed(1), +p.z.toFixed(1)], inf: live.map(e => [+e.transform.x.toFixed(1), +e.transform.z.toFixed(1)]) });
      },
    });
    const row = { profile, seed, outcome: report.outcome, simSeconds: +report.simSeconds.toFixed(1), deaths: report.deaths, kills: report.kills, maxInfected: report.maxInfected,
      finalLegS: legStart < 0 ? null : +(legEnd - legStart).toFixed(1), finalLegEncounters: met.size, finalLegMaxWithin6m: maxNear, house: mission.state.l1?.house?.door ?? null, timeline: report.timeline };
    summary.push(row);
    writeFileSync(`${values.out}/${profile}-${seed}.json`, JSON.stringify({ ...row, samples }) + '\n');
    console.log(JSON.stringify(row));
  } finally { world.dispose(); }
}
writeFileSync(`${values.out}/summary.json`, JSON.stringify(summary, null, 2) + '\n');
