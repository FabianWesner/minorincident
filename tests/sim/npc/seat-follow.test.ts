import { describe, expect, test } from 'vitest';
import { seatAnchor } from '../../../src/sim/npc/seats';
import type { PushProp } from '../../../src/sim/interact/PropSystem';
import type { SimWorld } from '../../../src/sim/world/SimWorld';
import type { EntitySnapshot } from '../../../src/sim/world/types';
import { groveWorld, step } from './l1-grove';

/**
 * PO 2026-10-12 "I moved away the bank but he still sits down": seats follow the live (physics-moved) bench. A bench moved more
 * than 0.3 m / 20 degrees (or tipped, or destroyed) stands the sitter up within a second; an upright bench is sat on again at its new
 * place with the hips on the new seat anchor; a tipped one is left alone.
 */
const sitting = (e: EntitySnapshot) => { const c = e.civilian!, a = c.schedule?.[c.scheduleStep ?? 0]; return !!a?.seat && a.activity === 'sit' && !!c.activityUntil; };
async function seatedOnBench(): Promise<{ w: SimWorld; e: EntitySnapshot; bench: PushProp }> {
  const { w } = await groveWorld(3);
  for (let t = 0; t < 40 * 60; t++) {
    step(w, 1);
    for (const e of w.entities.iterate()) {
      if (!e.civilian?.schedule || !sitting(e)) continue;
      const a = e.civilian.schedule[e.civilian.scheduleStep ?? 0];
      const bench = w.props!.items.find(i => i.id === a.seatProp);
      if (bench && bench.assetId === 'prop.bench' && w.tick - e.civilian.activityStarted! > 60) return { w, e, bench };
    }
  }
  throw new Error('no bench sitter within 40 s');
}
const yawOf = (q: number[]) => 2 * Math.atan2(q[1], q[3]);
/** Expected hip anchor on the bench in its live pose (upright benches only). */
function hip(w: SimWorld, bench: { assetId: string; id: string; pose: { p: number[]; q: number[] } }) {
  const placement = w.districts!.districts.flatMap(d => d.layout.placements.map(p => ({ d, p }))).find(({ d, p }) => `${d.id}/${p.id}` === bench.id)!.p;
  return seatAnchor(bench.assetId, bench.pose.p, yawOf(bench.pose.q), placement.scale)!;
}

describe('seats follow live props', () => {
  test('a bench pushed 1.2 m: the sitter stands up within 1 s, then sits on the moved bench with the hips within 5 cm of the new seat', async () => {
    const { w, e, bench } = await seatedOnBench();
    const home = [...bench.pose.p] as [number, number, number], q = [...bench.pose.q] as [number, number, number, number];
    w.props!.place(bench, { p: [home[0] + 1.2, home[1], home[2]], q });
    step(w, 60);
    const c = e.civilian!, a = c.schedule![c.scheduleStep ?? 0];
    expect(a.activity === 'sit' && !!a.seat && !!c.activityUntil && Math.hypot(a.seat.x - home[0], a.seat.z - home[2]) < .3, 'still sits at the old bench position').toBe(false);
    for (let t = 0; t < 30 * 60 && !sitting(e); t++) step(w, 1);
    const now = c.schedule![c.scheduleStep ?? 0];
    expect(sitting(e), 'sits again ' + JSON.stringify({ step: c.scheduleStep, until: c.activityUntil, state: c.state, at: [e.transform.x, e.transform.z], bench: bench.pose.p, sched: c.schedule!.map(x => [x.activity, x.seat && [x.seat.x, x.seat.z], x.target, x.ticks]) })).toBe(true);
    const anchor = hip(w, bench);
    expect(Math.hypot(now.seat!.x - anchor.x, now.seat!.z - anchor.z), 'hip-to-seat xz').toBeLessThanOrEqual(.05);
    expect(Math.abs(now.seatLift! - anchor.lift), 'hip-to-seat height').toBeLessThanOrEqual(.05);
    w.dispose();
  }, 180_000);

  test('a bench tipped over: the sitter stands up within 1 s and never holds a sitting pose without a seat afterwards', async () => {
    const { w, e, bench } = await seatedOnBench();
    const h = Math.SQRT1_2;
    w.props!.place(bench, { p: [bench.pose.p[0], bench.pose.p[1] + .3, bench.pose.p[2]], q: [h, 0, 0, h] });
    step(w, 60);
    const c = e.civilian!;
    expect(sitting(e), 'still sitting on a tipped bench').toBe(false);
    for (let t = 0; t < 20 * 60; t++) { step(w, 1); expect(sitting(e), `sitting again at ${t}`).toBe(false); }
    w.dispose();
    expect(c.schedule!.some(s => s.seat && s.seatProp === ''), 'no seat left on a step bound to the tipped bench').toBe(false);
  }, 180_000);

  test('a bench nudged 0.1 m carries the sitter along (hips stay on the seat)', async () => {
    const { w, e, bench } = await seatedOnBench();
    w.props!.place(bench, { p: [bench.pose.p[0] + .1, bench.pose.p[1], bench.pose.p[2]], q: [...bench.pose.q] });
    step(w, 5);
    expect(sitting(e)).toBe(true);
    const a = e.civilian!.schedule![e.civilian!.scheduleStep ?? 0], anchor = hip(w, bench);
    expect(Math.hypot(a.seat!.x - anchor.x, a.seat!.z - anchor.z)).toBeLessThanOrEqual(.05);
    w.dispose();
  }, 180_000);
});
