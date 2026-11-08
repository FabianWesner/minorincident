import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { preset } from '../../src/sim/progression/Campaign';
import { runLevel } from '../sim-runner/levels';
import { ThreatObserver } from './threat/observer';
import { l6 } from '../../src/data/l6';
import { provenance } from './accept/probe';

const output = process.argv[2] ?? 'test-results/r12-l6/pressure-matrix.json';
const runs = [];
const tiers = (process.argv[3]?.split(',') ?? ['low', 'high']) as ('low' | 'high')[];
const seeds = (process.argv[4]?.split(',').map(Number) ?? [1, 2, 3]);
const pressureIntervalSeconds = Number(process.argv[5] ?? l6.pressure.intervalS);
for (const tier of tiers) for (const seed of seeds) {
  const campaign = preset('L6-default'); campaign.seed = seed; campaign.settings.quality = tier;
  let observer: ThreatObserver | undefined;
  let maxInfected = 0;
  let actualTier = '';
  const directions: { x: number; leaderX: number; direction: 'ahead' | 'behind' | 'near'; tick: number }[] = [];
  let waveCursor = 0;
  let final: Record<string, unknown> = {};
  const report = await runLevel('L6', 'complete', seed, 1200, 'auto', campaign, undefined, 0, {
    quality: tier,
    beforeBegin: world => {
      observer = new ThreatObserver(world, 'L6', { paths: false });
      actualTier = world.infected!.director.tier;
      const update = world.update.bind(world);
      world.update = () => {
        update();
        const state = world.missions?.state.l6;
        if (!state) return;
        maxInfected = Math.max(maxInfected, world.infected?.director.count ?? 0);
        const log = state.spawnLog.filter(row => row.wave === 3);
        for (const row of log.slice(waveCursor)) {
          const delta = row.x - state.leaderX;
          directions.push({ x: row.x, leaderX: state.leaderX,
            direction: delta > 10 ? 'ahead' : delta < -10 ? 'behind' : 'near', tick: row.tick });
        }
        waveCursor = log.length;
      };
    },
    beforeDispose: world => {
      const state = world.missions?.state.l6;
      const phases = observer?.finish().phases.filter(row => row.key === 'step/retreat' || row.key === 'step/exit') ?? [];
      const seconds = phases.reduce((sum, row) => sum + row.seconds, 0);
      const lost = state?.survivors.filter(row => row.status === 'dead' || row.status === 'turned').length ?? 0;
      const out = state?.survivors.filter(row => row.status === 'out').length ?? 0;
      const missionTime = world.missions?.state.stats.time ?? 0;
      const pressureTicks = directions.map(row => row.tick);
      const pressureSeconds = pressureTicks.length
        ? (Math.max(...pressureTicks) - Math.min(...pressureTicks)) / 60 + pressureIntervalSeconds : 0;
      final = {
        tier, actualTier, seed, completed: world.missions?.state.phase === 'result' || world.missions?.state.phase === 'progression', outcome: world.missions?.state.phase, simSeconds: missionTime,
        deaths: world.missions?.state.stats.deaths ?? 0, damageTaken: world.missions?.state.stats.damage ?? 0, survivorsOut: out,
        survivorLosses: lost, survivorRoster: state?.survivors.length ?? 0,
        escapedVisible: state?.survivors.filter(row => row.status === 'out' && !world.entities.get(row.id)?.hidden).length ?? 0,
        maxConcurrentInfected: maxInfected,
        pressureArrivals: directions.length,
        pressureArrivalsPerMinute: pressureSeconds ? directions.length * 60 / pressureSeconds : 0,
        directionCounts: { ahead: directions.filter(row => row.direction === 'ahead').length,
          behind: directions.filter(row => row.direction === 'behind').length,
          near: directions.filter(row => row.direction === 'near').length },
        playerAttacks: phases.reduce((sum, row) => sum + row.attacks, 0),
        playerAttacksPerMinute: seconds ? phases.reduce((sum, row) => sum + row.attacks, 0) * 60 / seconds : 0,
        followerAttacks: phases.reduce((sum, row) => sum + row.groupAttacks, 0),
        followerAttacksPerMinute: seconds ? phases.reduce((sum, row) => sum + row.groupAttacks, 0) * 60 / seconds : 0,
        retreatAttackSeconds: seconds, phaseThreat: phases,
      };
    },
  });
  runs.push(final);
  console.log(JSON.stringify({ tier, seed, completed: report.completed, simSeconds: report.time, deaths: report.deaths }));
}
await mkdir(dirname(output), { recursive: true });
await writeFile(output, JSON.stringify({ ...provenance(), tuning: 'L6 pressure cadence and exit signposting', runs }, null, 2) + '\n');
console.log(JSON.stringify({ output, runs: runs.length }));
