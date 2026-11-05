// fix55-l3 diagnostic: L3 newbie mortal fixture trace (L3-11 timeout).
// Usage: node --import tsx/esm tools/qa/fix55/l3-newbie.ts low|high [maxSeconds] [profile]
import { loadL3, runL3 } from '../../sim-runner/l3Bots';
import { l3 } from '../../../src/data/l3';
const tier = (process.argv[2] ?? 'high') as 'low' | 'high', maxSeconds = Number(process.argv[3] ?? 600);
const profile = (process.argv[4] ?? 'newbie') as 'newbie';
const { world, mission } = await loadL3(1, tier);
const s = () => mission.state.l3!;
const every = Number(process.env.DIAG_EVERY ?? 600);
const upd = world.update.bind(world);
let lastPhase = '';
world.update = () => {
  upd();
  const st = s(), p = world.entities.get(1)!;
  const traceFrom = Number(process.env.TRACE_FROM ?? 0) * 60, traceTo = Number(process.env.TRACE_TO ?? 0) * 60;
  if (world.tick >= traceFrom && world.tick <= traceTo && world.tick % 20 === 0) for (const e of world.entities.iterate()) if (e.companion) {
    const c = e.companion, near = [...world.entities.iterate()].filter(o => o.id !== e.id && Math.hypot(o.transform.x - e.transform.x, o.transform.z - e.transform.z) < 1.6).map(o => `${o.id}:${o.archetype}${o.health.current <= 0 ? '(dead)' : ''}@${o.transform.x.toFixed(1)},${o.transform.z.toFixed(1)}`);
    console.log(`  T[${(world.tick / 60).toFixed(2)}] corgi@${e.transform.x.toFixed(2)},${e.transform.z.toFixed(2)} st=${c.state} fol=${c.following} v=${(c.velocity?.x ?? 0).toFixed(2)},${(c.velocity?.z ?? 0).toFixed(2)} hold=${(c as { hold?: number }).hold} pi=${c.pathIndex}/${c.path.length} P@${p.transform.x.toFixed(1)},${p.transform.z.toFixed(1)} near=${near.join(' ')}`);
  }
  if (st.phase !== lastPhase || world.tick % every === 0) {
    lastPhase = st.phase;
    const live = world.infected!.active.filter(o => o.health.current > 0 && !o.hidden);
    const n8 = live.filter(o => Math.hypot(o.transform.x - p.transform.x, o.transform.z - p.transform.z) < 8).length;
    if (st.crossedAt && !st.barrierClosedAt) {
      const wall = l3.finale.barrierX;
      const group = [1, ...st.officerIds.filter(id => st.squad.some(m => m.id === id)), ...[...world.entities.iterate()].filter(e => !!e.companion).map(e => e.id)];
      const g = group.map(id => { const e = world.entities.get(id); return e ? `${id}${e.companion ? '(comp)' : ''}@${e.transform.x.toFixed(1)},${e.transform.z.toFixed(1)} hp${e.health.current.toFixed(0)}` : `${id}:gone`; });
      const blockers = [...world.entities.iterate()].filter(e => !e.infected && e.health.current > 0 && Math.abs(e.transform.x - wall) < 1.5 && Math.abs(e.transform.z) < 4).map(e => `${e.id}:${e.archetype}@${e.transform.x.toFixed(2)},${e.transform.z.toFixed(2)}`);
      console.log(`   finale: zoneX=${l3.map.zoneX} wall=${wall} finaleAt=${st.finaleAt} group=${g.join(' ')} blockers=${blockers.join(' ')}`);
    }
    if (process.env.COMP) for (const e of world.entities.iterate()) if (e.companion) console.log(`   COMP ${e.id} ${e.archetype} @${e.transform.x.toFixed(1)},${e.transform.z.toFixed(1)} ${JSON.stringify(e.companion).slice(0, 400)}`);
    console.log(`[${(world.tick / 60).toFixed(1)}] phase=${st.phase} mission=${mission.state.phase} P@${p.transform.x.toFixed(1)},${p.transform.z.toFixed(1)} hp${p.health.current.toFixed(0)} live=${live.length} n8=${n8} squad=${st.squad.length} attackAt=${st.attackAt} fallbackAt=${st.fallbackAt} steps=${Object.entries(mission.state.steps).map(([k, v]) => `${k}:${v.status[0]}`).join(',')}`);
  }
};
const r = runL3(world, mission, profile, { maxSeconds, god: false });
console.log(JSON.stringify({ outcome: r.outcome, sim: r.simSeconds, deaths: r.deaths, deathsAt: r.deathsAt, timeline: r.timeline, lowHp: r.lowHpShare, attack: r.attack }, null, 1));
