// Diagnostic: run one follower-pace seed in this process (use with node --cpu-prof) to find simulation hot spots.
// Usage: node --cpu-prof --cpu-prof-dir=test-results/prof --import tsx/esm tools/qa/threat/profile-seed.ts L5 passive 2
import { runSeed } from './followerPaceSeeds';
import type { RunnerLevel } from '../../sim-runner/levels';

const [level, mode = 'passive', seed = '2'] = process.argv.slice(2);
const started = performance.now();
const row = await runSeed({ level: level as RunnerLevel, tier: 'low', passive: mode === 'passive', seed: Number(seed) });
console.log(JSON.stringify({ level, mode, seed, outcome: row.outcome, valid: row.valid, seconds: (performance.now() - started) / 1000 }));
