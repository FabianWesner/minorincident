// fix55-l3 experiment harness: the L3 `complete` mortal fixture (as qa:accept) with optional wave-timing patches.
// Usage: EXP=<name> node --import tsx/esm tools/qa/fix55/l3-exp.ts low|high [profile]
//   EXP=holdstation   wave>=1 station cohorts stay inside the station until the fallback, then stream out over 6 s
import { loadL3, runL3 } from '../../sim-runner/l3Bots';
const tier = (process.argv[2] ?? 'high') as 'low' | 'high', profile = (process.argv[3] ?? 'complete') as 'complete';
const exp = process.env.EXP ?? '';
const { world, mission } = await loadL3(1, tier);
const s = () => mission.state.l3!;
let patched = false;
const upd = world.update.bind(world);
world.update = () => {
  const st = s();
  if (!patched && st.phase === 'attack' && st.waves.length) {
    patched = true;
    if (exp.includes('holdstation')) for (const q of st.waves) if (q.dir === 'station' && q.wave >= 1 && !q.id) q.at = Number.MAX_SAFE_INTEGER;
  }
  upd();
  const tr = process.env.TRACE?.split(':').map(Number);
  if (tr && world.tick >= tr[1] * 60 && world.tick <= tr[2] * 60 && world.tick % 6 === 0) {
    const e = world.entities.get(tr[0]), p = world.entities.get(1)!;
    if (e) { const c = e.civilian!, a = c.ally!; console.log(`TR t=${(world.tick / 60).toFixed(2)} ${e.id}@${e.transform.x.toFixed(2)},${e.transform.z.toFixed(2)} dP=${Math.hypot(e.transform.x - p.transform.x, e.transform.z - p.transform.z).toFixed(2)} v=${e.locomotion ? Math.hypot(e.locomotion.vx, e.locomotion.vz).toFixed(2) : '-'} st=${c.state} tgt=${a.targetId} eng=${a.engaged} strike=${a.strikeAt} story=${c.story?.clip ?? '-'} still=${JSON.stringify(a.still ?? null)} reload=${(a.reloadUntil ?? 0) > world.tick} knock=${c.knockedUntil > world.tick} P@${p.transform.x.toFixed(1)},${p.transform.z.toFixed(1)}`); }
  }
  if (process.env.CALM && st.fallbackAt && world.tick % 30 === 0) {
    const p = world.entities.get(1)!, d = (a: { x: number; z: number }, b: { x: number; z: number }) => Math.hypot(a.x - b.x, a.z - b.z);
    const calm = !world.infected!.active.some(e => e.health.current > 0 && d(e.transform, p.transform) < 20) && !st.squad.some(q => { const t = world.entities.get(world.entities.get(q.id)?.civilian?.ally?.targetId ?? 0); return !!t && t.health.current > 0; });
    if (calm) {
      const v = p.survivor?.velocity, pace = Math.hypot(v?.x ?? 0, v?.z ?? 0);
      const parts = st.squad.map(q => { const e = world.entities.get(q.id)!; const m = e.locomotion ? Math.hypot(e.locomotion.vx, e.locomotion.vz) : 0; const dd = d(e.transform, p.transform);
        if (e.health.current > 0 && !e.infection && p.transform.x >= -126 && p.transform.x < 128) {
          if (dd >= 3 && dd <= 6) out.inBand++; else { out.out++; const since = (world.tick - (lastShot.get(q.id) ?? -1e9)) / 60; if (since <= 2) out.outPostFight++; else if (pace < 4 || m < 3) out.outTurnOrRestart++; else out.outOther++; }
        }
        return `${q.id}:${dd.toFixed(2)}${dd > 6 || dd < 3 ? '!' : ''}/v${m.toFixed(1)}`; });
      console.log(`CALM t=${(world.tick / 60).toFixed(1)} P@${p.transform.x.toFixed(1)},${p.transform.z.toFixed(1)} pace=${pace.toFixed(2)} yaw=${Math.atan2(-(v?.z ?? 0), v?.x ?? 0).toFixed(2)} ${parts.join(' ')}`);
    }
  }
};
world.events.on('l3.fallback', e => {
  if (e.type !== 'l3.fallback') return;
  const live = world.infected!.active.filter(o => o.health.current > 0 && !o.hidden), y = { x0: -160, x1: -126 };
  console.log(`FALLBACK t=${(e.tick / 60).toFixed(2)} cause=${e.cause} live=${live.length} inYard=${live.filter(o => o.transform.x > y.x0 && o.transform.x < y.x1 && Math.abs(o.transform.z) < 22).length}`);
  if (exp.includes('holdstation')) {
    let k = 0;
    for (const q of s().waves) if (q.at === Number.MAX_SAFE_INTEGER) q.at = e.tick + Math.round((k++ % 12) * 30);
  }
});
const lastShot = new Map<number, number>();
if (process.env.KILLS) world.events.on('combat.kill', e => {
  if (e.type !== 'combat.kill' || !s().fallbackAt || e.position.x >= -40 || e.position.x < -126) return;
  const src = world.entities.get(e.sourceId), p = world.entities.get(1)!.transform;
  console.log(`KILL t=${(e.tick / 60).toFixed(1)} by ${e.sourceId}${s().squad.some(q => q.id === e.sourceId) ? '(squad)' : ''} ${src?.archetype} at ${e.position.x.toFixed(1)},${e.position.z.toFixed(1)} P@${p.x.toFixed(1)},${p.z.toFixed(1)} squad=${s().squad.length}`);
});
world.events.on('ally.attack', e => { if (e.type === 'ally.attack') lastShot.set(e.sourceId, e.tick); });
const out = { inBand: 0, out: 0, outPostFight: 0, outTurnOrRestart: 0, outOther: 0 };
const r = runL3(world, mission, profile, { maxSeconds: 600, god: false });
const s1 = r.s1, total = s1 ? s1.officerKills + s1.playerKills : 0;
if (process.env.CALM) console.log('BAND', JSON.stringify(out));
console.log(JSON.stringify({ exp, tier, outcome: r.outcome, sim: +r.simSeconds.toFixed(1), deaths: r.deaths, deathsAt: r.deathsAt, s1, share: total ? +(s1!.officerKills / total).toFixed(3) : null, fallback: r.attack?.fallbackCause, fallbackAfterS: r.attack?.fallbackAfterS, squad: r.squad && { atFallback: r.squad.atFallback, segmentEnds: r.squad.segmentEnds, atCheckpoint: r.squad.atCheckpoint, losses: r.squad.losses, follow: r.squad.followRange.map(f => `${f.id}:${f.within3to6}/${f.samples} med${f.medianM.toFixed(2)} max${f.maxM.toFixed(2)}`) } }));
