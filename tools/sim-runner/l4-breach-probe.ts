import { loadL4, runL4 } from './l4Bots';

/** PO 10-23 wall breach debug probe: traces the Alphas against the military wall (position, job, special, HP) and wall damage. */
const seed = Number(process.argv[2] ?? 3), tier = (process.argv[3] ?? 'low') as 'high' | 'low';
const { world: w, mission: m } = await loadL4(seed, tier);
const damage: string[] = [];
w.events.on('barricade.damaged', e => { if (e.type === 'barricade.damaged' && e.groupId === 'l4-wall') damage.push(`${((e.tick - m.state.l4!.turnAt) / 60).toFixed(1)} ${e.slotId} by ${w.entities.get(e.sourceId)?.archetype} ${e.amount} -> ${e.hp}`); });
w.events.on('barricade.broken', e => { if (e.type === 'barricade.broken') damage.push(`${((e.tick - m.state.l4!.turnAt) / 60).toFixed(1)} BROKEN ${e.slotId}`); });
runL4(w, m, 'idle', { seed, god: true, maxSeconds: 400, stopWhen: mm => {
  const s = mm.state.l4!;
  if (s.turnAt && (w.tick - s.turnAt) % 120 === 0 && w.tick - s.turnAt > Number(process.env.PROBE_FROM ?? 0) * 60) {
    for (const job of s.director.alphaJobs) {
      const e = w.entities.get(job.alphaId), b = e?.infected;
      console.log(((w.tick - s.turnAt) / 60).toFixed(0), job.job, job.breach, job.stage, e ? `${e.transform.x.toFixed(1)},${e.transform.z.toFixed(1)} hp ${e.health.current.toFixed(0)} st ${b?.state} sp ${b?.specialAttack?.move ?? '-'}:${b?.specialAttack?.stage ?? ''} scr ${b?.scripted ? `${b.scripted.x.toFixed(1)},${b.scripted.z.toFixed(1)}` : '-'}` : 'gone');
    }
  }
  return !!s.turnAt && w.tick - s.turnAt > Number(process.env.PROBE_S ?? 150) * 60;
} });
if (!process.env.PROBE_FROM) console.log(damage.slice(0, 60).join('\n'));
w.dispose();
