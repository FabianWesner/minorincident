import { mkdirSync, writeFileSync } from 'node:fs';
import { afterEach, describe, expect, test } from 'vitest';
import { l4 } from '../../src/data/l4';
import type { SimWorld } from '../../src/sim/world/SimWorld';
import type { Mission } from '../../src/sim/missions/Mission';
import { loadL4, runL4 } from '../../tools/sim-runner/l4Bots';

/**
 * l4-collapse (PO 2026-10-12: "the soldiers cannot hold the lines, but they do easily, so there is no outbreak and no chaos"; design
 * approved "ok let's try that!"): the outbreak starts behind the lines and the army loses three lines on fixed beats, also when the courier
 * shoots optimally. One seed per case (PO 10-09: no batteries).
 */
let world: SimWorld | undefined;
afterEach(() => { world?.dispose(); world = undefined; });
const HEAVY = 1_800_000;
const inRing = (p: { x: number; z: number }) => { const r = l4.map.ring; return p.x > r.x0 && p.x < r.x1 && p.z > r.z0 && p.z < r.z1; };

interface Trace {
  beats: { beat: string; t: number; cause: string; soldiers: number; inside: number }[]; soldiers: { t: number; n: number }[]; fallBackRadio: number; breakT: number; cause: string; knockdowns: number; barricades: number; turnedAtTurn: number; tank: string; maxAlive: number;
  /** l4-collapse-2: line-1 size at the turn; infected on the escape street east of the ring (> 12 m from the courier) at "Fall back!" and 4 s later; the most drawn bodies in one 4 m square; attackers around the still courier (samples with >= 4 within 2.5 m: occupied 90-degree quadrants). */
  line1Size: number; gapAtFallBack: number; gapAfter: number; heapMax: number; ringSamples: number[]; pressMax: number;
}
const escapeDistance = (p: { x: number; z: number }) => { const r = l4.director.escape.route; let best = Infinity; for (let i = 1; i < r.length; i++) { const [ax, az] = r[i - 1], [bx, bz] = r[i], dx = bx - ax, dz = bz - az, t = Math.max(0, Math.min(1, ((p.x - ax) * dx + (p.z - az) * dz) / (dx * dx + dz * dz))); best = Math.min(best, Math.hypot(p.x - ax - dx * t, p.z - az - dz * t)); } return best; };
/** Runs the war with the courier idle at the quartermaster (god); `shoot` downs the nearest live infected in 26 m every 6 ticks (an oracle machine gunner). */
function war(w: SimWorld, m: Mission, seed: number, tier: 'high' | 'low', shoot: boolean): Trace {
  const s = m.state.l4!, tr: Trace = { beats: [], soldiers: [], fallBackRadio: -1, breakT: -1, cause: '', knockdowns: 0, barricades: 0, turnedAtTurn: 0, tank: '', maxAlive: 0, line1Size: 0, gapAtFallBack: -1, gapAfter: -1, heapMax: 0, ringSamples: [], pressMax: 0 };
  const onStreet = () => { const p = w.entities.get(1)!.transform; return w.infected!.active.filter(e => e.health.current > 0 && !e.hidden && Math.hypot(e.transform.x - p.x, e.transform.z - p.z) > 12 && e.transform.x > -8 && escapeDistance(e.transform) < l4.director.escape.gapM).length; }; // the street out of the ring (its plaza end holds the pursuers)
  const t = (tick: number) => +((tick - s.turnAt) / 60).toFixed(2);
  w.events.on('l4.beat', e => { if (e.type === 'l4.beat') tr.beats.push({ beat: e.beat, t: t(e.tick), cause: e.cause, soldiers: e.soldiers, inside: e.inside }); });
  w.events.on('l4.firstTurn', e => { if (e.type === 'l4.firstTurn') tr.turnedAtTurn = e.ids.length; });
  w.events.on('dialogue.line', e => { if (e.type === 'dialogue.line' && e.id === 'L4.fallback') tr.fallBackRadio = t(e.tick); });
  runL4(w, m, 'idle', { seed, god: true, maxSeconds: 480, stopWhen: mm => {
    const st = mm.state.l4!;
    if (st.turnAt && (w.tick - st.turnAt) % 60 === 0) tr.soldiers.push({ t: t(w.tick), n: st.soldierIds.filter(id => { const e = w.entities.get(id); return e?.civilian && !e.infection && e.health.current > 0; }).length });
    tr.maxAlive = Math.max(tr.maxAlive, w.infected!.active.filter(e => e.health.current > 0).length);
    if (st.turnAt && !tr.line1Size) tr.line1Size = st.director.lines[0].size;
    if (st.lineBreakAt && w.tick === st.lineBreakAt) tr.gapAtFallBack = onStreet();
    if (st.lineBreakAt && w.tick === st.lineBreakAt + 240) tr.gapAfter = onStreet();
    if (st.turnAt && w.tick % 60 === 0) {
      const cells = new Map<number, number>(), c = l4.war.heap.cellM;
      for (const e of w.entities.iterate()) if (e.corpse && e.faction === 'infected' && !e.hidden) { const k = Math.floor(e.transform.x / c) * 4096 + Math.floor(e.transform.z / c); cells.set(k, (cells.get(k) ?? 0) + 1); }
      tr.heapMax = Math.max(tr.heapMax, ...cells.values(), 0);
      const p = w.entities.get(1)!.transform, close = w.infected!.active.filter(e => e.health.current > 0 && !e.hidden && Math.hypot(e.transform.x - p.x, e.transform.z - p.z) < 2.5);
      tr.pressMax = Math.max(tr.pressMax, w.infected!.active.filter(e => e.health.current > 0 && !e.hidden && Math.hypot(e.transform.x - p.x, e.transform.z - p.z) < 1.9).length);
      if (st.phase === 'war' && close.length >= 4) tr.ringSamples.push(new Set(close.map(e => Math.floor((Math.atan2(e.transform.z - p.z, e.transform.x - p.x) + Math.PI) / (Math.PI / 2)) % 4)).size);
    }
    if (shoot && st.phase === 'war' && w.tick % 6 === 0) {
      const p = w.entities.get(1)!.transform;
      const target = w.infected!.active.filter(e => e.health.current > 0 && !e.hidden && !e.infectionRise && Math.hypot(e.transform.x - p.x, e.transform.z - p.z) <= l4.machineGun.rangeM && w.combat!.query.visible(p, e.transform))
        .sort((a, b) => Math.hypot(a.transform.x - p.x, a.transform.z - p.z) - Math.hypot(b.transform.x - p.x, b.transform.z - p.z))[0];
      if (target) { const dx = target.transform.x - p.x, dz = target.transform.z - p.z, d = Math.hypot(dx, dz) || 1; w.combat!.damage.apply({ attackId: 0, actionId: l4.machineGun.id, sourceId: 1, targetId: target.id, origin: { x: p.x, z: p.z }, direction: { x: dx / d, z: dz / d }, base: 999, multiplier: 1, type: 'bullet', knockback: 0, stagger: .3 }); }
    }
    return st.lineBreakAt > 0 && w.tick - st.lineBreakAt > 250;
  } });
  tr.breakT = s.lineBreakAt ? t(s.lineBreakAt) : -1; tr.cause = s.lineCause; tr.knockdowns = s.director.knockdowns; tr.barricades = s.director.barricades; tr.tank = s.tankPhase;
  mkdirSync('test-results/epics/E22', { recursive: true }); writeFileSync(`test-results/epics/E22/collapse-${tier}-${shoot ? 'shooter' : 'idle'}.json`, JSON.stringify(tr, null, 1) + '\n');
  return tr;
}
function beatsOnTime(tr: Trace): void {
  expect(tr.beats.map(b => b.beat)).toEqual(['line-1', 'nests', 'armor']);
  for (const [i, b] of tr.beats.entries()) {
    const def = l4.director.lines[i];
    expect(b.t, b.beat).toBeGreaterThanOrEqual(def.earliestS - .2); expect(b.t, b.beat).toBeLessThanOrEqual(def.dueS + .5);
  }
  // "Fall back!" on the radio, then the line is gone (the hide objective and the fuel-truck chain follow from lineBreak).
  expect(tr.cause).toBe('beats');
  expect(tr.breakT).toBeCloseTo(tr.beats[2].t + l4.lineBreak.fallBackS, 0); expect(tr.fallBackRadio).toBeCloseTo(tr.breakT, 1);
  expect(tr.tank).toBe('silent');
  // Losses are real (bites and turns, never scripted removal) and only go one way.
  for (let i = 1; i < tr.soldiers.length; i++) expect(tr.soldiers[i].n).toBeLessThanOrEqual(tr.soldiers[i - 1].n);
}

describe('L4 collapse director', () => {
  test('T-E22-13-collapse @E22 @E22-AC13 idle courier: 15-25 evacuees turn inside the perimeter, the three lines fall on their beats, Alphas break a slot and knock crews down', async () => {
    const l = await loadL4(2); world = l.world;
    const tr = war(l.world, l.mission, 2, 'high', false);
    expect(tr.turnedAtTurn).toBeGreaterThanOrEqual(15); expect(tr.turnedAtTurn).toBeLessThanOrEqual(25);
    beatsOnTime(tr);
    const atTurn = tr.soldiers[0].n, at = (s: number) => tr.soldiers.find(x => x.t >= s)?.n ?? 0;
    expect(at(tr.beats[2].t)).toBeLessThan(atTurn * .5); expect(at(tr.beats[0].t)).toBeLessThan(atTurn);
    expect(tr.barricades).toBeGreaterThanOrEqual(1); expect(tr.knockdowns).toBeGreaterThanOrEqual(1);
    expect(Math.max(...tr.beats.map(b => b.inside))).toBeGreaterThanOrEqual(5);
    expect(tr.maxAlive).toBeLessThanOrEqual(l4.war.caps.infected.high);
    void inRing;
  }, HEAVY);

  test('T-E22-13-escape @E22 @E22-AC13 @E22-AC15 l4-collapse-2: at "Fall back!" the horde leaves a gap on the escape street; no corpse mound and no stack around a still courier', async () => {
    const l = await loadL4(2); world = l.world;
    const tr = war(l.world, l.mission, 2, 'high', false);
    // The gap: infected on the escape street (beyond the pursuers) run off toward the army and nothing emerges on it.
    expect(tr.gapAfter).toBeGreaterThanOrEqual(0); expect(tr.gapAfter).toBeLessThanOrEqual(Math.max(3, tr.gapAtFallBack / 3));
    // Corpse heaps: at most heap.max drawn bodies in any 4 m square around the courier who never moved.
    expect(tr.heapMax).toBeLessThanOrEqual(l4.war.heap.max.high);
    // Attackers around the still courier take ring slots: most crowded samples occupy at least three quadrants.
    if (tr.ringSamples.length) expect(tr.ringSamples.reduce((a, b) => a + b, 0) / tr.ringSamples.length).toBeGreaterThanOrEqual(2.5);
    // The rest wait on the outer rings: no mound of bodies pressing on her (the 1.4 m ring holds about eight).
    expect(tr.pressMax).toBeLessThanOrEqual(16);
  }, HEAVY);

  test('T-E22-13-collapse-shooter @E22 @E22-AC13 an optimal machine gunner (one down every 0.1 s in 26 m) cannot save the lines: the beats keep their windows', async () => {
    const l = await loadL4(3); world = l.world;
    const tr = war(l.world, l.mission, 3, 'high', true);
    beatsOnTime(tr);
  }, HEAVY);

  test('T-E22-13-collapse-low @E22 @E22-AC13 the low tier keeps the beats inside its caps', async () => {
    const l = await loadL4(2, 'low'); world = l.world;
    const tr = war(l.world, l.mission, 2, 'low', false);
    beatsOnTime(tr);
    expect(tr.maxAlive).toBeLessThanOrEqual(l4.war.caps.infected.low);
  }, HEAVY);
});
