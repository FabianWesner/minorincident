// Short exploratory L5 bot runs (tuning only, never a gate): npx tsx tools/l5/batch.ts <profile c|n|e|i> <seedFrom> <seedTo> [maxSeconds]
import { loadL5, runL5 } from '../sim-runner/l5Bots';
import type { L5Profile } from '../../src/debug/bot/LevelFiveBot';

const profile = ({ c: 'complete', n: 'newbie', e: 'evade-only', i: 'idle' }[process.argv[2] ?? 'c'] ?? process.argv[2]) as L5Profile;
const from = Number(process.argv[3] ?? 1), to = Number(process.argv[4] ?? 3), max = Number(process.argv[5] ?? 420);
for (let seed = from; seed <= to; seed++) {
  const { world, mission } = await loadL5(seed);
  const t0 = Date.now();
  const r = runL5(world, mission, profile, { seed, maxSeconds: max });
  console.log(`seed ${seed} ${profile} ${r.outcome} t=${r.simSeconds.toFixed(0)}s deaths=${r.deaths} rescued=${r.rescued} fates=${Object.entries(r.fates).map(([k, v]) => `${k}:${v}`).join(',')} found=${r.found.map(f => `${f.key}@${f.t.toFixed(0)}`).join(' ')} lost=${r.lost.map(l => `${l.key}@${l.t.toFixed(0)}`).join(' ')} maxInf=${r.maxConcurrent} follow=${r.followShare.toFixed(2)} jump=${r.maxFollowerJump.toFixed(2)} wall=${((Date.now() - t0) / 1000).toFixed(0)}s`);
  world.dispose();
}
