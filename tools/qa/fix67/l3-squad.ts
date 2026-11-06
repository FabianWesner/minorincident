// fix67-a: L3-06 squad census for one seed/tier (mortal `complete`, as qa:accept).
// Usage: [TRACE=1] node --import tsx/esm tools/qa/fix67/l3-squad.ts <seed> low|high
import { loadL3, runL3 } from '../../sim-runner/l3Bots';
const seed = Number(process.argv[2] ?? 1), tier = (process.argv[3] ?? 'low') as 'low' | 'high';
const { world, mission } = await loadL3(seed, tier);
const d = (a: { x: number; z: number }, b: { x: number; z: number }) => Math.hypot(a.x - b.x, a.z - b.z);
if (process.env.TRACE) {
  const upd = world.update.bind(world);
  world.update = () => {
    upd();
    const st = mission.state.l3!, p = world.entities.get(1)!;
    if (!st.fallbackAt || world.tick % 30 || p.transform.x < -126 || p.transform.x >= 128) return;
    const calm = !world.infected!.active.some(e => e.health.current > 0 && d(e.transform, p.transform) < 20) && !st.squad.some(q => { const t = world.entities.get(world.entities.get(q.id)?.civilian?.ally?.targetId ?? 0); return !!t && t.health.current > 0; });
    if (!calm) return;
    const v = p.survivor?.velocity, pace = Math.hypot(v?.x ?? 0, v?.z ?? 0);
    const parts = st.squad.map(q => {
      const e = world.entities.get(q.id)!, a = e.civilian!.ally!, m = e.locomotion ? Math.hypot(e.locomotion.vx, e.locomotion.vz) : 0, dd = d(e.transform, p.transform);
      const near = Math.min(99, ...world.infected!.active.filter(o => o.health.current > 0 && !o.hidden).map(o => d(o.transform, e.transform)));
      return `${q.id}/s${a.follow?.slot}:${dd.toFixed(2)}${dd > 6 || dd < 3 ? '!' : ''} v${m.toFixed(1)} inf${near.toFixed(0)} t${a.targetId ? 1 : 0}${a.strikeAt ? 'S' : ''}${a.step ? 'st' : ''}${a.run ? 'R' : ''}`;
    });
    console.log(`CALM t=${(world.tick / 60).toFixed(1)} P@${p.transform.x.toFixed(1)},${p.transform.z.toFixed(1)} pace=${pace.toFixed(2)} ${parts.join(' ')}`);
  };
}
const r = runL3(world, mission, 'complete', { seed, maxSeconds: 600, god: false });
const sq = r.squad;
console.log(JSON.stringify({ seed, tier, outcome: r.outcome, deaths: r.deaths, sim: +r.simSeconds.toFixed(1), atFallback: sq?.atFallback, segmentEnds: sq?.segmentEnds, atCheckpoint: sq?.atCheckpoint,
  losses: sq?.losses.map(l => l.cause), follow: sq?.followRange.map(f => `${f.id}:${f.within3to6}/${f.samples} med${f.medianM.toFixed(2)} max${f.maxM.toFixed(2)}`) }));
world.dispose();
