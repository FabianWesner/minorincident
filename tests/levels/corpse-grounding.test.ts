import { expect, test } from 'vitest';
import { loadLevel } from '../../tools/sim-runner/levels';
import { loadL3 } from '../../tools/sim-runner/l3Bots';
import type { SimWorld } from '../../src/sim/world/SimWorld';

/**
 * PO 10-13 "Dead Zombies fliying" (L3, player on the highway ramp): bodies kept the height they died at (the shared grounding step skipped
 * infected above 2 m and every dead body), so a body that ended past the deck edge hung 5 m over the street. Guard: after the death
 * settles, every dead infected (simulated body and frozen corpse record) stands within 5 cm of the walkable support below it.
 */
const TOL = .05;
const spawnDead = (w: SimWorld, x: number, z: number, y: number) => {
  // Spawn on free ground beside the courier, then place the body (a knockback/flung end point need not be a free nav cell).
  const nav = w.infected!.nav, p = w.entities.get(1)!.transform;
  let at = { x: p.x, z: p.z };
  search: for (let r = 2; r < 12; r += 1) for (let k = 0; k < 12; k++) { const c = { x: p.x + Math.cos(k) * r, z: p.z + Math.sin(k) * r }; if (nav.clear(c.x, c.z, .6)) { at = c; break search; } }
  const id = w.infected!.spawn('infected.runner', at, { state: 'idle' }), e = w.entities.get(id)!;
  e.transform.x = x; e.transform.z = z; e.transform.y = y; e.health.current = 0; w.spatial.set(id, x, z); return id;
};
/** Distance of each body's feet from the exact support at its xz (no second layer in these columns, so the column maximum is the support). */
const supportOffsets = (w: SimWorld, ids: number[]) => ids.map(id => {
  const t = w.entities.get(id)!.transform, support = w.districts!.pavingHeight(t.x, t.z);
  return { id, x: +t.x.toFixed(2), z: +t.z.toFixed(2), feet: +(t.y - .7).toFixed(3), support, off: Math.abs(t.y - .7 - support) };
});
const run = (w: SimWorld, ticks: number) => { for (let i = 0; i < ticks; i++) w.update(); };

test('@l3-grounding L3 highway: dead infected settle onto the ramp, the deck, or the street past the deck edge', async () => {
  const { world: w } = await loadL3(1);
  try {
    const d = w.districts!;
    // Along the ramps (35 cm above the slope after a knockback), on the deck, at the deck edge, and knocked off it.
    const spots: [number, number, number][] = [];
    for (const x of [142, 146, 150, 154, 158, 162, 190, 194, 198, 202]) for (const z of [-6, -4.5, -3, -1.5, 0, 1.5, 3, 4.5, 6]) if (d.groundHeight(x, z) > 1) spots.push([x, z, d.groundHeight(x, z) + .7 + .35]);
    for (const [x, z] of [[170, 0], [174, 1.5], [176, -1.5], [172, 2.2]]) spots.push([x, z, 6.4]);
    // Knocked off the deck edge: the sim height is still the deck's, the xz is past the rail on the street (nothing walkable but the street under it).
    for (const [x, z] of [[172, 3.6], [175, -3.6], [170, 4.4]]) spots.push([x, z, 6.4]);
    const ids = spots.map(([x, z, y]) => spawnDead(w, x, z, y));
    run(w, 200);
    const bad = supportOffsets(w, ids).filter(r => r.off > TOL);
    expect(bad.slice(0, 8), `${bad.length}/${ids.length} dead infected float or sink`).toEqual([]);
    // ... and the off-deck ones really dropped to the street (they are not left on the deck height).
    for (const id of ids.slice(-3)) expect(w.entities.get(id)!.transform.y - .7, 'knocked off the deck edge').toBeLessThan(1);
    // Every dead body in the whole world, corpses included.
    const all = [...w.entities.iterate()].filter(e => e.infected && e.health.current <= 0).map(e => e.id);
    const worst = supportOffsets(w, all).filter(r => r.off > TOL);
    expect(worst.slice(0, 8), `${worst.length}/${all.length} dead bodies off their support`).toEqual([]);
  } finally { w.dispose(); }
}, 180000);

test('@l3-grounding L3 highway: a live infected standing on the ramp (above the 2 m separation cut-off) stays on the ramp surface', async () => {
  const { world: w } = await loadL3(1);
  try {
    const d = w.districts!, ids: number[] = [];
    for (const [x, z] of [[150, 3.6], [154, 1.5], [158, -1.5], [190, 1], [194, -1]]) if (w.infected!.nav.clear(x, z, .4) && d.groundHeight(x, z) > 2) ids.push(w.infected!.spawn('infected.runner', { x, z }, { state: 'idle' }));
    expect(ids.length).toBeGreaterThan(1);
    for (const id of ids) { const e = w.entities.get(id)!; e.transform.y = 7; }
    run(w, 30);
    const bad = supportOffsets(w, ids).filter(r => r.off > TOL);
    expect(bad, 'live infected on the ramp keep their stale height').toEqual([]);
  } finally { w.dispose(); }
}, 180000);

test('@l3-grounding L1 street: dead infected on pavement, sidewalk slabs and kerbs stand on the support (generic case)', async () => {
  const w = await loadLevel('L1', 1);
  try {
    const d = w.districts!, nav = w.infected!.nav, ids: number[] = [], p = w.entities.get(1)!.transform;
    for (let dx = -14; dx <= 14; dx += 2) for (let dz = -14; dz <= 14; dz += 2) if (nav.clear(p.x + dx, p.z + dz, .5) && ids.length < 60) ids.push(spawnDead(w, p.x + dx, p.z + dz, .7 + 3));
    expect(ids.length).toBeGreaterThan(10);
    run(w, 200);
    const bad = supportOffsets(w, ids).filter(r => r.off > TOL);
    expect(bad.slice(0, 8), `${bad.length}/${ids.length} dead infected off the support`).toEqual([]);
    void d;
  } finally { w.dispose(); }
}, 180000);
