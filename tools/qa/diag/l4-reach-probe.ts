/** Orchestrator diagnostic (L4-07): classify infected within 30 m of the courier that have no body-clear path ≤ 2.5× direct during step/hold. */
import { loadL4, runL4 } from '../../sim-runner/l4Bots';
import { PathProbe } from '../threat/observer';
const tier = (process.argv[2] ?? 'high') as 'high' | 'low', stopTick = Number(process.argv[3] ?? 12049);
const { world: w, mission: m } = await loadL4(1, tier);
runL4(w, m, 'complete', { seed: 1, stopWhen: () => w.tick >= stopTick, maxSeconds: stopTick / 60 + 5 });
const p = w.entities.get(1)!.transform, probe = new PathProbe(), nav = w.infected!.navigation;
console.log('tick', w.tick, 'courier', p.x.toFixed(1), p.z.toFixed(1), 'step', Object.entries(m.state.steps).find(([, s]) => s.status === 'active')?.[0]);
for (const e of w.infected!.active) {
  if (e.health.current <= 0) continue;
  const d = Math.hypot(e.transform.x - p.x, e.transform.z - p.z); if (d > 30) continue;
  const at = e.transform, goal = nav.target(at, p), src = nav.grid(at);
  const bounded = probe.query(src, e, p, 2.5), len = probe.distance(src, e, p);
  if (bounded) continue;
  console.log(e.id, e.archetype, `(${at.x.toFixed(1)},${at.z.toFixed(1)})`, 'd', d.toFixed(1), 'pathLen', Number.isFinite(len) ? len.toFixed(1) : 'none', 'ratio', Number.isFinite(len) ? (len / d).toFixed(2) : '-',
    'pending', !!e.pendingAdmission, 'disconnected', goal === at, 'state', e.infected!.state, 'approach', e.infected!.breachApproach ?? '-', 'vault', !!e.infected!.vault, 'hidden', !!e.hidden, 'y', at.y.toFixed(2));
}
process.exit(0);
