// r31-aggro native probe: does an infected the courier shoots turn to and engage her instead of a nearby survivor?
// node --import tsx/esm tools/qa/aggro-probe.ts [--levels L1,L4,L7] [--trials 20] [--roles runner,firefighter] [--damage 1]
import { parseArgs } from 'node:util';
import { loadLevel, type RunnerLevel } from '../sim-runner/levels';
import type { SimWorld } from '../../src/sim/world/SimWorld';

const { values } = parseArgs({ options: { levels: { type: 'string', default: 'L1,L4,L7' }, trials: { type: 'string', default: '20' }, roles: { type: 'string', default: 'runner,firefighter' }, damage: { type: 'string', default: '1' }, verbose: { type: 'boolean' } } });
const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));
const step = (w: SimWorld, n: number) => { for (let i = 0; i < n; i++) w.update(); };

interface Trial { level: string; role: string; ok: boolean; faceTick: number; targetTick: number; note: string }

async function trial(level: RunnerLevel, role: string, i: number): Promise<Trial> {
  const w = await loadLevel(level, 1 + i);
  try {
    w.combat!.damage.god = true;
    step(w, 120);
    for (let k = 0; k < 20000 && w.entities.get(1)!.hidden; k++) w.update(); // L4 convoy ride
    step(w, 60);
    const p = w.entities.get(1)!, px = p.transform.x, pz = p.transform.z;
    // Quiet the area: remove other living infected within 40 m so only the probe subject reacts.
    for (const e of [...w.entities.iterate()]) if (e.infected && e.health.current > 0 && Math.hypot(e.transform.x - px, e.transform.z - pz) < 40) w.infected!.release(e);
    const range = 3 + (i % 4);
    const base = (i * 2.399) % (Math.PI * 2);
    let subject: number | undefined, civ: number | undefined, sx = 0, sz = 0;
    for (let k = 0; k < 24 && subject === undefined; k++) {
      const a = base + k * 0.7, x = px + Math.cos(a) * range, z = pz + Math.sin(a) * range;
      const cx = x + Math.cos(a + Math.PI / 2) * 1.6, cz = z + Math.sin(a + Math.PI / 2) * 1.6;
      try {
        const id = w.infected!.spawn(`infected.${role}`, { x, z }, { variant: role === 'runner' ? 'inf.common-worker' : undefined, state: 'chase' });
        civ = w.npcs!.civilians.spawn('cashier', { x: cx, z: cz }, { waypoints: [{ x: cx, z: cz }] });
        subject = id; sx = x; sz = z;
      } catch { /* try next angle */ }
    }
    if (subject === undefined) return { level, role, ok: false, faceTick: -1, targetTick: -1, note: 'no spawn' };
    const e = w.entities.get(subject)!;
    const x0 = e.transform.x, z0 = e.transform.z;
    step(w, 90);
    if (role !== 'runner' && Math.hypot(e.transform.x - x0, e.transform.z - z0) < .3) return { level, role, ok: true, faceTick: 0, targetTick: 0, note: 'skipped: spawn is boxed in' };
    const engagedCiv = e.infected!.l1?.targetId ?? e.infected!.heardTargetId;
    (w.infected as unknown as { hearing: { shot(id?: number): void } }).hearing.shot(); // the shot itself is audible
    w.combat!.damage.apply({ attackId: 1000 + i, actionId: 'weapon.pistol', sourceId: 1, targetId: subject, origin: { x: px, z: pz }, direction: { x: sx - px, z: sz - pz }, base: Number(values.damage), multiplier: 1, type: 'bullet', knockback: 0, stagger: 0 } as never);
    const t0 = w.tick; let faceTick = -1, targetTick = -1;
    for (let t = 0; t < 90; t++) {
      step(w, 1);
      const q = w.entities.get(subject); if (!q || q.health.current <= 0) break;
      const dx = p.transform.x - q.transform.x, dz = p.transform.z - q.transform.z;
      const ang = Math.abs(wrap(-Math.atan2(dz, dx) - q.transform.yaw));
      if (process.env.TRACE && t % 10 === 0) console.log(t, q.infected!.state, q.infected!.l1?.mode, 'tgt', q.infected!.l1?.targetId, 'bite', q.infected!.l1?.biteTargetId, 'focus', q.infected!.l1?.focusId, (ang * 57.3).toFixed(0), Math.hypot(dx, dz).toFixed(1), '', q.infected!.provoked ? 'prov' : '');
      if (faceTick < 0 && ang < Math.PI / 4) faceTick = w.tick - t0;
      const pr = q.infected!.pressureTarget, tid = q.infected!.l1 ? q.infected!.l1.targetId : (pr && w.tick < pr.until ? pr.id : q.infected!.heardTargetId || 1);
      const mode = q.infected!.l1?.mode;
      if (targetTick < 0 && tid === 1 && (mode === 'chase' || mode === 'bite' || !q.infected!.l1)) targetTick = w.tick - t0;
    }
    const ok = faceTick >= 0 && faceTick <= 30 && targetTick >= 0 && targetTick <= 60;
    return { level, role, ok, faceTick, targetTick, note: `civTarget=${engagedCiv === civ} range=${range}` };
  } finally { w.dispose(); }
}

for (const level of values.levels!.split(',') as RunnerLevel[]) for (const role of values.roles!.split(',')) {
  const r: Trial[] = [];
  for (let i = 0; i < Number(values.trials); i++) { const t = await trial(level, role, i); r.push(t); if (values.verbose) console.log(JSON.stringify(t)); }
  const skipped = r.filter(t => t.note.startsWith('skipped')).length, ok = r.filter(t => t.ok && !t.note.startsWith('skipped')).length;
  console.log(`${level} ${role}: ${ok}/${r.length - skipped} (${(ok / Math.max(1, r.length - skipped) * 100).toFixed(0)}%), skipped ${skipped}, civ-engaged first ${r.filter(t => t.note.includes('civTarget=true')).length}`);
}
process.exit(0);
