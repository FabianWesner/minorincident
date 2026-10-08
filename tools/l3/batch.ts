// L3 bot batch: npx tsx tools/l3/batch.ts <profile> <seeds> [street] [maxSeconds]   (FIRST=<seed> to start elsewhere)
import { mkdirSync, writeFileSync } from 'node:fs';
import { loadL3, runL3, type L3Report } from '../sim-runner/l3Bots';
import type { L3Profile, L3StreetChoice } from '../../src/debug/bot/LevelThreeBot';
const alias: Record<string, L3Profile> = { c: 'complete', n: 'newbie', e: 'evade-only', i: 'idle' };
const profile = (alias[process.argv[2] ?? 'c'] ?? process.argv[2]) as L3Profile, n = Number(process.argv[3] ?? 3), street = (process.argv[4] ?? 'auto') as L3StreetChoice, max = Number(process.argv[5] ?? 600);
const first = Number(process.env.FIRST ?? 1);
const med = (v: number[]) => v.length ? +[...v].sort((a, b) => a - b)[v.length >> 1].toFixed(1) : null;
const all: L3Report[] = [];
for (let seed = first; seed < first + n; seed++) {
  const l = await loadL3(seed), t = performance.now(), r = runL3(l.world, l.mission, profile, { seed, street, maxSeconds: max });
  l.world.dispose(); all.push(r);
  console.log(JSON.stringify({
    seed, out: r.outcome, t: +r.simSeconds.toFixed(0), deaths: r.deaths, dmg: Math.round(r.damage), kd: r.knockdowns, gunS: r.handgunS,
    att: r.attack && { dirs: r.attack.directions.length, turned: r.attack.turnedDuring, cause: r.attack.fallbackCause, after: +r.attack.fallbackAfterS.toFixed(0) },
    squad: r.squad && { f: r.squad.atFallback, ends: r.squad.segmentEnds, chk: r.squad.atCheckpoint, lost: r.squad.losses.map(x => `${x.cause[0]}${x.t.toFixed(0)}`).join(','), tc: r.squad.turnedInCorridor, near8: +r.squad.near8Share.toFixed(2), jump: +r.squad.maxJumpM.toFixed(2) },
    s1: r.s1, gunMed: med(r.killDistances.gun), meleeMed: med(r.killDistances.melee),
    reg: +r.regressionM.toFixed(1), streets: r.streets.join('/'), dens: r.density, kits: r.medkits, low: +r.lowHpShare.toFixed(2), audit: r.audit, deathsAt: r.deathsAt, wallMs: Math.round(performance.now() - t),
  }));
}
if (process.env.SAVE) { mkdirSync('test-results/l3', { recursive: true }); writeFileSync(`test-results/l3/bots-${profile}${street !== 'auto' ? `-${street}` : ''}.json`, JSON.stringify(all, null, 1)); }
