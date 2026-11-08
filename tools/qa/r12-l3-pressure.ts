/**
 * r12-l3 (PO 2026-11-08, "Police level is still too much to handle"): native L3 pressure probe.
 * The ordinary mortal `complete` bot plays the whole level (same runner as qa:threat L3-06). Per phase/segment it records
 * the simultaneous infected within 10 m of the courier (max, p90, mean), the police-look share among them, attack starts
 * (windups) on the courier per minute, courier damage and deaths, seconds spent per street, and the squad at the army line.
 *
 * Usage: node --import tsx/esm tools/qa/r12-l3-pressure.ts --tier low|high [--seeds 1,2,3] [--out file]
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { runLevel, type RunnerLevel } from '../sim-runner/levels';
import { preset } from '../../src/sim/progression/Campaign';
import { l3, l3Segment } from '../../src/data/l3';
import { observeAttackStarts } from './threat/attackStarts';

const arg = (name: string, fallback: string) => { const i = process.argv.indexOf(`--${name}`); return i > 0 ? process.argv[i + 1] : fallback; };
const tier = arg('tier', 'low') as 'low' | 'high', seeds = arg('seeds', '1,2,3').split(',').map(Number);
const out = arg('out', `test-results/r12-l3/pressure-${tier}.json`);
const KEYS = ['yard', 'S1', 'S2', 'S3', 'army'] as const;

const rows = [];
for (const seed of seeds) {
  const campaign = preset('L3-default'); campaign.seed = seed; campaign.settings.quality = tier;
  const seg = KEYS.map(() => ({ ticks: 0, near: [] as number[], police: 0, nearSum: 0, attacks: 0, damage: 0, deaths: 0 }));
  let army: number | null = null, squadStart: number | null = null, current = 0, peakLive = 0;
  const run = await runLevel('L3' as RunnerLevel, 'complete', seed, 1200, 'auto', campaign, undefined, 0, {
    quality: tier,
    beforeBegin: world => {
      observeAttackStarts(world, (_s, target) => { if (target === 1) seg[current].attacks++; });
      world.events.on('player.damaged', e => { if (e.type === 'player.damaged') seg[current].damage += e.amount; });
      world.events.on('player.died', () => { seg[current].deaths++; });
      const update = world.update.bind(world);
      world.update = (...a: Parameters<typeof world.update>) => {
        const before = world.tick; update(...a);
        if (world.tick === before || world.missions!.state.phase !== 'playing') return;
        const s = world.missions!.state.l3; if (!s) return;
        const p = world.entities.get(1)!.transform, sg = l3Segment(p.x);
        current = s.phase === 'attack' || sg < 0 ? 0 : sg >= 3 ? 4 : sg + 1;
        if (squadStart === null && s.squad.length > 0 && p.x > l3.map.corridor[0]) squadStart = s.squad.length;
        if (army === null && p.x >= l3.map.zoneX) army = s.squad.length;
        let n = 0, police = 0, live = 0;
        for (const e of world.infected!.active) {
          if (e.health.current <= 0 || e.hidden) continue; live++;
          if (Math.hypot(e.transform.x - p.x, e.transform.z - p.z) <= 10) { n++; if (e.appearance?.asset?.includes('police') || e.appearance?.asset?.includes('soldier') || e.appearance?.asset?.includes('guard')) police++; }
        }
        peakLive = Math.max(peakLive, live);
        const r = seg[current]; r.ticks++; r.near.push(n); r.nearSum += n; r.police += police;
      };
    },
  });
  const pct = (a: number[], q: number) => { if (!a.length) return 0; const b = [...a].sort((x, y) => x - y); return b[Math.min(b.length - 1, Math.floor(q * b.length))]; };
  const segments = Object.fromEntries(seg.map((r, i) => [KEYS[i], r.ticks ? {
    seconds: +(r.ticks / 60).toFixed(1), maxNear10: pct(r.near, 1), p90Near10: pct(r.near, .9), meanNear10: +(r.nearSum / r.ticks).toFixed(2),
    policeShare: r.nearSum ? +(r.police / r.nearSum).toFixed(2) : 0, attacksPerMin: +(r.attacks / r.ticks * 3600).toFixed(1), damage: Math.round(r.damage), deaths: r.deaths,
  } : null]));
  const row = { seed, tier, completed: run.completed, time: +run.time.toFixed(1), deaths: run.deaths, damageTaken: Math.round(run.damageTaken), squadStart, army, peakLive, segments };
  rows.push(row); console.log(JSON.stringify(row));
}
mkdirSync('test-results/r12-l3', { recursive: true }); writeFileSync(out, JSON.stringify(rows, null, 2) + '\n');
