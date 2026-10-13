import { mkdirSync, writeFileSync } from 'node:fs';
import { test } from 'vitest';
import { l4 } from '../../src/data/l4';
import { loadL4, runL4 } from '../../tools/sim-runner/l4Bots';

/** Measurement probe (not a gate): idle courier (god), single seed; timeline of soldiers, infected inside the ring, Alpha knockdowns and broken barricades. */
const inside = (p: { x: number; z: number }) => { const r = l4.map.ring; return p.x > r.x0 && p.x < r.x1 && p.z > r.z0 && p.z < r.z1; };
test.skipIf(!process.env.L4_PROBE)('L4 collapse probe (idle player, god)', async () => {
  const seed = Number(process.env.L4_SEED ?? 2);
  const l = await loadL4(seed, (process.env.L4_TIER as 'high' | 'low') ?? 'high'); const w = l.world, m = l.mission, s = m.state.l4!;
  const samples: unknown[] = [], events: { t: number; type: string; info?: unknown }[] = [];
  const t = (tick: number) => s.turnAt ? +((tick - s.turnAt) / 60).toFixed(1) : -1;
  let alphaKnock = 0;
  w.events.on('barricade.broken', e => events.push({ t: t(e.tick), type: e.type, info: (e as { slotId: string }).slotId }));
  w.events.on('infected.attack', e => { if (e.type === 'infected.attack' && w.entities.get(e.sourceId)?.archetype === 'infected.alpha' && w.entities.get(e.targetId)?.civilian?.ally) { alphaKnock++; events.push({ t: t(e.tick), type: 'alpha-knock', info: e.special }); } });
  for (const type of ['l4.firstTurn', 'l4.lineBreaks', 'l4.beat'] as const) w.events.on(type as 'l4.firstTurn', e => events.push({ t: t(e.tick), type: e.type, info: (e as unknown as { beat?: string; cause?: string }).beat ?? (e as unknown as { cause?: string }).cause }));
  const r = runL4(w, m, 'idle', { seed, god: true, maxSeconds: 480, stopWhen: mm => {
    const st = mm.state.l4!;
    if (st.turnAt && (w.tick - st.turnAt) % 300 === 0) {
      const live = s.soldierIds.map(id => w.entities.get(id)).filter(e => e && e.civilian && !e.infection && e.health.current > 0 && !e.hidden).length;
      const inf = w.infected!.active.filter(e => e.health.current > 0 && !e.hidden);
      const turnedSoldiers = s.soldierIds.filter(id => w.entities.get(id)?.infected).length;
      const dd = st.director;
      samples.push({ t: t(w.tick), phase: st.phase, soldiers: live, turnedSoldiers, infected: inf.length, inside: inf.filter(e => inside(e.transform)).length, director: w.infected!.director.count, alphaKnock, ...(dd ? { lines: dd.lines.map(l => `${l.id}:${l.soldierIds.length}/${l.size}${l.brokeAt ? '!' : ''}`).join(' '), jobs: dd.alphaJobs.map(j => { const a = w.entities.get(j.alphaId); return `${j.job}:${j.stage}@${a?.transform.x.toFixed(0)},${a?.transform.z.toFixed(0)}hp${a?.health.current.toFixed(0)}:${a?.infected?.state}`; }).join(' '), tank: st.tankPhase, kd: dd.knockdowns, bar: dd.barricades, turnedIn: dd.turnedInside, spawned: dd.spawned, settled: dd.settled } : {}) });
    }
    return st.lineBreakAt > 0 && w.tick - st.lineBreakAt > 20 * 60;
  } });
  const out = { seed, director: s.director ? { ...s.director, lines: s.director.lines.map(l => ({ id: l.id, brokeAtS: l.brokeAt ? +((l.brokeAt - s.turnAt) / 60).toFixed(1) : -1, cause: l.cause, pushes: l.pushes })) } : null, lineBreakS: s.lineBreakAt ? (s.lineBreakAt - s.turnAt) / 60 : -1, soldiersAtTurn: r.soldiersAtTurn, breakCause: r.breakCause, breakAfterS: r.breakAfterS, killsAtBreak: r.killsAtBreak, kills: r.kills_, maxConcurrent: r.maxConcurrent, maxCharacters: r.maxCharacters, events, samples };
  mkdirSync('test-results/epics/E22', { recursive: true }); writeFileSync(`test-results/epics/E22/collapse-probe-${process.env.L4_TAG ?? 'run'}.json`, JSON.stringify(out, null, 1) + '\n');
  console.log(JSON.stringify(out));
  w.dispose();
}, 1_800_000);
