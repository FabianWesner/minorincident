// fix54-l3 diagnostic: why does the high-tier L3 squad die right after the fallback?
// Usage: node --import tsx/esm tools/qa/fix54/l3-diag.ts low|high [secondsAfterFallback]
import { loadL3, runL3 } from '../../sim-runner/l3Bots';
const tier = (process.argv[2] ?? 'high') as 'low' | 'high', after = Number(process.argv[3] ?? 12);
const { world, mission } = await loadL3(1, tier);
const s = () => mission.state.l3!;
const d = (a: { x: number; z: number }, b: { x: number; z: number }) => Math.hypot(a.x - b.x, a.z - b.z);
const t = () => (world.tick / 60).toFixed(2);
const squad0 = new Set(s().squadIds);
world.events.on('outbreak.bite', e => {
  if (e.type !== 'outbreak.bite') return;
  const v = world.entities.get(e.targetId); const src = world.entities.get(e.sourceId);
  if (!v?.civilian?.ally) return;
  const a = v.civilian.ally;
  const inSquad = s().squad.some(m => m.id === e.targetId);
  console.log(`[${t()}] BITE ${e.targetId}${inSquad ? '(squad)' : ''}${squad0.has(e.targetId) ? '(orig)' : ''} by ${e.sourceId} ${src?.archetype} at ${e.position.x.toFixed(1)},${e.position.z.toFixed(1)} phase=${s().phase} hp=${v.health.current} target=${a.targetId} follow=${!!a.follow} distP=${d(v.transform, world.entities.get(1)!.transform).toFixed(1)} near3=${world.infected!.active.filter(o => o.health.current > 0 && d(o.transform, v.transform) < 3).length}`);
});
const shots = new Map<number, { n: number; hit: number }>();
world.events.on('ally.attack', e => { if (e.type !== 'ally.attack' || !s().fallbackAt) return; const r = shots.get(e.sourceId) ?? { n: 0, hit: 0 }; r.n++; if (e.hit) r.hit++; shots.set(e.sourceId, r); });
world.events.on('l3.fallback', e => {
  if (e.type !== 'l3.fallback') return;
  const p = world.entities.get(1)!.transform;
  console.log(`[${t()}] FALLBACK cause=${e.cause} squad=${e.squad} player=${p.x.toFixed(1)},${p.z.toFixed(1)} alive infected=${world.infected!.active.filter(o => o.health.current > 0).length} inYard=${world.infected!.active.filter(o => o.health.current > 0 && o.transform.x > -160 && o.transform.x < -126 && Math.abs(o.transform.z) < 22).length}`);
});
// EXP=keepfocus:<s> — experiment only: infected that pressed the courier before the fallback keep that preference <s> seconds.
const exp = process.env.EXP ?? '';
let focused: number[] = [];
if (exp.startsWith('keepfocus')) world.events.on('l3.fallback', () => {
  const keep = Number(exp.split(':')[1] ?? 6) * 60;
  for (const id of focused) { const b = world.entities.get(id)?.infected?.l1; if (b) { b.focusId = 1; b.focusUntil = world.tick + keep; } }
  console.log(`EXP keepfocus ${focused.length} infected for ${keep / 60}s`);
});
const traceId = Number(process.env.TRACE_ID ?? 0);
if (traceId) (globalThis as { __allyTrace?: (e: { id: number; transform: { x: number; z: number } }, m: string) => void }).__allyTrace = (e, m) => {
  const f = s().fallbackAt;
  if (e.id === traceId && f && world.tick - f <= 240 && world.tick % 6 === 0) console.log(`  TRACE[${t()}] ${e.id}@${e.transform.x.toFixed(2)},${e.transform.z.toFixed(2)} ${m}`);
};
let lastSample = 0;
const every = Number(process.env.DIAG_EVERY ?? 30);
const upd = world.update.bind(world);
world.update = () => {
  const st0 = s();
  if (st0.phase === 'attack') focused = world.infected!.active.filter(o => o.health.current > 0 && o.infected?.l1?.focusId === 1 && world.tick < (o.infected.l1.focusUntil ?? 0)).map(o => o.id);
  upd();
  const st = s();
  if (st.phase === 'attack' || st.fallbackAt) {
    if (world.tick - lastSample >= every) {
      lastSample = world.tick;
      const p = world.entities.get(1)!.transform;
      const ids = st.fallbackAt ? st.squad.map(m => m.id) : st.squadIds;
      const live = world.infected!.active.filter(o => o.health.current > 0 && !o.hidden);
      const near = (q: { x: number; z: number }, r: number) => live.filter(o => d(o.transform, q) < r).length;
      const parts = ids.map(id => { const e = world.entities.get(id); if (!e) return `${id}:gone`; const a = e.civilian?.ally; return `${id}@${e.transform.x.toFixed(0)},${e.transform.z.toFixed(0)} hp${e.health.current.toFixed(0)}${e.infection ? 'INF' : ''} dP${d(e.transform, p).toFixed(1)} n3=${near(e.transform, 3)} n8=${near(e.transform, 8)} tgt${a?.targetId ?? '-'} eng${a?.engaged ? 1 : 0} st=${e.civilian?.state}`; });
      console.log(`[${t()}] ${st.phase} P@${p.x.toFixed(1)},${p.z.toFixed(1)} hp${world.entities.get(1)!.health.current.toFixed(0)} n3=${near(p, 3)} n8=${near(p, 8)} n20=${near(p, 20)} live=${live.length} | ${parts.join(' | ')}`);
    }
  }
};
// Defend-phase knockdowns by source, the killing distance to the courier and the courier windups (player-target attacks).
const defend = { player: 0, squad: 0, posts: 0, other: 0, nearCourier: [] as number[], windups: [] as string[] };
world.events.on('combat.kill', e => {
  if (e.type !== 'combat.kill' || s().phase !== 'attack' || world.entities.get(e.targetId)?.faction !== 'infected') return;
  const k = e.sourceId === 1 ? 'player' : s().squadIds.includes(e.sourceId) ? 'squad' : s().officerIds.includes(e.sourceId) ? 'posts' : 'other';
  defend[k]++; defend.nearCourier.push(+d(e.position, world.entities.get(1)!.transform).toFixed(1));
});
world.events.on('combat.attack', e => {
  if (e.type !== 'combat.attack' || s().phase !== 'attack' || e.sourceId === 1) return;
  const src = world.entities.get(e.sourceId); if (!src?.infected) return;
  defend.windups.push(`${t()}:${e.sourceId}`);
});
process.on('beforeExit', () => console.log('defend', JSON.stringify({ ...defend, nearCourier: defend.nearCourier.sort((a, b) => a - b) })));
// CALM=1: the follow-range samples (same calm rule as runL3) with the courier's speed and each member's speed.
if (process.env.CALM) {
  const prev = new Map<number, { x: number; z: number }>();
  const upd2 = world.update.bind(world);
  world.update = () => {
    const st = s(), p = world.entities.get(1)!;
    if (st.fallbackAt && world.tick % 30 === 0) {
      const calm = !world.infected!.active.some(o => o.health.current > 0 && d(o.transform, p.transform) < 20) && !st.squad.some(q => { const tg = world.entities.get(world.entities.get(q.id)?.civilian?.ally?.targetId ?? 0); return !!tg && tg.health.current > 0; });
      if (calm) {
        const v = p.survivor?.velocity, sp = v ? Math.hypot(v.x, v.z) : 0;
        const rows = st.squad.map(q => { const e = world.entities.get(q.id)!, last = prev.get(q.id); const ms = last ? d(last, e.transform) * 2 : 0; return `${q.id}:${d(e.transform, p.transform).toFixed(1)}m/${ms.toFixed(1)}`; });
        console.log(`CALM[${t()}] P@${p.transform.x.toFixed(0)},${p.transform.z.toFixed(0)} v=${sp.toFixed(2)} ${rows.join(' ')}`);
      }
      for (const q of st.squad) { const e = world.entities.get(q.id)!; prev.set(q.id, { x: e.transform.x, z: e.transform.z }); }
    }
    upd2();
  };
}
const report = runL3(world, mission, 'complete', { maxSeconds: 300, god: false, stopWhen: m => !!m.state.l3!.fallbackAt && world.tick - m.state.l3!.fallbackAt > after * 60 });
console.log('shots after fallback', JSON.stringify([...shots]));
console.log('s1', JSON.stringify(report.s1), 'squad losses', JSON.stringify(report.squad?.losses));
console.log('outcome', report.outcome, 'deaths', report.deaths, 'sim', report.simSeconds.toFixed(1), 'segmentEnds', JSON.stringify(report.squad?.segmentEnds), 'maxJump', report.squad?.maxJumpM.toFixed(3));
console.log('followRange', JSON.stringify(report.squad?.followRange.map(f => ({ id: f.id, n: f.samples, ok: f.within3to6, min: +f.minM.toFixed(2), med: +f.medianM.toFixed(2), max: +f.maxM.toFixed(2) }))));
world.dispose();
