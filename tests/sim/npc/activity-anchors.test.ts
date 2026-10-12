import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';
import { compositions } from '../../../src/levels/compositions';
import { nearestOnBox, type FlowerBox } from '../../../src/sim/npc/gardening';
import { SimWorld } from '../../../src/sim/world/SimWorld';
import { groveWorld, step } from './l1-grove';

/** Every flower prop that exists in the loaded districts, in world metres (decoration flowers and flower-bed footprints). */
function flowerProps(w: SimWorld): FlowerBox[] {
  const out: FlowerBox[] = [];
  for (const { layout, origin: [ox, oz] } of w.districts!.districts) {
    for (const d of layout.decorations ?? []) if (d.kind === 'flower') out.push({ x0: d.position[0] + ox, z0: d.position[2] + oz, x1: d.position[0] + ox, z1: d.position[2] + oz });
    for (const p of layout.placements) if (p.assetId.startsWith('prop.flower-bed')) out.push({ x0: p.visualAabb.min[0] + ox, z0: p.visualAabb.min[2] + oz, x1: p.visualAabb.max[0] + ox, z1: p.visualAabb.max[2] + oz });
  }
  return out;
}
const degrees = (a: number, b: number) => Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b))) * 180 / Math.PI;

/**
 * PO 2026-10-12 "this person is not watering the plants": while a calm civilian performs an authored activity it faces its
 * facing point within 30 degrees, and a watering civilian stands within 0.6 m of a flower prop that exists and faces that prop.
 */
function audit(w: SimWorld, ticks: number): { performing: number; watering: Set<string> } {
  const flowers = flowerProps(w), watering = new Set<string>(); let performing = 0;
  for (let t = 0; t < ticks; t++) {
    step(w, 1);
    for (const e of w.entities.iterate()) {
      const c = e.civilian; if (!c?.schedule || c.state !== 'calm' || !c.activityUntil || e.hidden) continue;
      const a = c.schedule[c.scheduleStep ?? 0]; if (!a.facing || w.tick - (c.activityStarted ?? w.tick) < 90) continue;
      performing++;
      const where = `${e.id}/${c.routine} step ${c.scheduleStep} ${a.activity} ${a.anchor} at ${e.transform.x.toFixed(1)},${e.transform.z.toFixed(1)}`;
      const base = a.seat ?? e.transform, off = degrees(-Math.atan2(a.facing.z - base.z, a.facing.x - base.x), e.transform.yaw);
      expect(off, `${where} faces ${off.toFixed(0)} deg off its facing point`).toBeLessThanOrEqual(30);
      if (a.activity !== 'water') continue;
      // The facing point lies on a flower prop that exists, the actor stands within 0.6 m of that prop, and (checked above) faces it.
      const onProp = flowers.filter(f => { const p = nearestOnBox(f, a.facing!); return Math.hypot(p.x - a.facing!.x, p.z - a.facing!.z) < .05; });
      expect(onProp.length, `${where}: no flower prop at its facing point ${a.facing.x.toFixed(1)},${a.facing.z.toFixed(1)}`).toBeGreaterThan(0);
      const d = Math.min(...onProp.map(f => { const p = nearestOnBox(f, e.transform); return Math.hypot(p.x - e.transform.x, p.z - e.transform.z); }));
      expect(d, `${where} is ${d.toFixed(2)} m from its flower prop`).toBeLessThanOrEqual(.6);
      watering.add(`${e.id}:${c.scheduleStep}`);
    }
  }
  return { performing, watering };
}

describe('civilian activity anchors', () => {
  test('M1 morning (D-RES + D-MAIN): gardeners stand at real flowers facing them; every activity faces its target', async () => {
    const w = new SimWorld(); await w.init(); const c = compositions['L1-M1'];
    w.loadComposition(c, c.districts.map(d => JSON.parse(readFileSync(`public/assets/layouts/${d.id}.layout.json`, 'utf8'))), 1);
    w.npcs!.configureSlice();
    const gardeners = [...w.entities.iterate()].filter(e => e.civilian?.schedule?.some(s => s.activity === 'water'));
    expect(gardeners.length).toBeGreaterThanOrEqual(2);
    const r = audit(w, 2400);
    expect(r.performing).toBeGreaterThan(0); expect(r.watering.size).toBeGreaterThanOrEqual(gardeners.length);
    w.dispose();
  }, 120_000);

  test('L1 D-GROVE morning: gardeners stand at real flower beds facing them; every activity faces its target', async () => {
    const { w } = await groveWorld(1);
    const gardeners = [...w.entities.iterate()].filter(e => e.civilian?.schedule?.some(s => s.activity === 'water'));
    expect(gardeners.length).toBeGreaterThanOrEqual(1);
    const r = audit(w, 3000);
    expect(r.watering.size).toBeGreaterThanOrEqual(gardeners.length);
    w.dispose();
  }, 120_000);
});
