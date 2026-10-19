import { expect, test } from 'vitest';
import { Rng } from '../../src/core/Rng';
import type { CoverWall, HitQuery } from '../../src/sim/combat/HitQuery';
import { loadLevel } from '../../tools/sim-runner/levels';

/** The pre-w5d blast cover rule (every static and dynamic wall, tuple slabs), kept verbatim as the oracle. */
function original(entities: { get(id: number): { barricade?: unknown } | undefined }, query: HitQuery, at: { x: number; z: number }, to: { x: number; z: number }, targetId: number): boolean {
  const dx = to.x - at.x, dz = to.z - at.z, distance = Math.hypot(dx, dz);
  if (distance < 1e-6) return true;
  for (const walls of [query.walls, query.dynamicWalls]) for (const w of walls) {
    if (w.entityId === targetId || (w.entityId !== undefined && !entities.get(w.entityId)?.barricade) || w.y - w.halfY > .7 || w.y + w.halfY < .7 || (Math.abs(at.x - w.x) <= w.halfX && Math.abs(at.z - w.z) <= w.halfZ)) continue;
    let near = 0, far = distance;
    for (const [o, d, c, half] of [[at.x, dx / distance, w.x, w.halfX], [at.z, dz / distance, w.z, w.halfZ]]) {
      if (Math.abs(d) < 1e-12) { if (o < c - half || o > c + half) { far = -1; break; } continue; }
      const a = (c - half - o) / d, b = (c + half - o) / d; near = Math.max(near, Math.min(a, b)); far = Math.min(far, Math.max(a, b));
    }
    if (far >= near && near < distance - 1e-8) return false;
  }
  return true;
}

test('T-E29-19-rocket-cover @E29-AC19 @E27-AC02 blast cover from radius candidates equals the all-walls rule on the L7 map', async () => {
  const world = await loadLevel('L7', 29);
  try {
    type Probe = { candidates(q: HitQuery, at: { x: number; z: number }, r: number): CoverWall[]; visible(q: HitQuery, c: readonly CoverWall[], at: { x: number; z: number }, to: { x: number; z: number }, id: number): boolean };
    const explosions = world.explosions as unknown as Probe, query = world.combat!.query, rng = new Rng(7, 'cover-oracle');
    expect(query.walls.length).toBeGreaterThan(100);
    let blocked = 0, open = 0, trimmed = 0;
    for (let blast = 0; blast < 300; blast++) {
      // Blasts on and around walls (corners, faces, inside) plus random open points.
      const w = query.walls[Math.floor(rng.next() * query.walls.length)], r = [3, 5, 6, 8][blast % 4];
      const at = blast % 3 ? { x: w.x + (rng.next() * 2 - 1) * (w.halfX + 2), z: w.z + (rng.next() * 2 - 1) * (w.halfZ + 2) } : { x: w.x + w.halfX * (blast % 2 ? 1 : -1), z: w.z };
      const candidates = explosions.candidates(query, at, r); trimmed += query.walls.length - candidates.length;
      for (let k = 0; k < 40; k++) {
        const a = rng.next() * Math.PI * 2, d = k === 0 ? 0 : k === 1 ? r : rng.next() * r;
        const to = k < 4 ? { x: at.x + (k - 2) * r * .5, z: at.z } : { x: at.x + Math.cos(a) * d, z: at.z + Math.sin(a) * d };
        const expected = original(world.entities, query, at, to, 99999);
        expect(explosions.visible(query, candidates, at, to, 99999), `${blast}/${k}`).toBe(expected);
        if (expected) open++; else blocked++;
      }
    }
    expect(blocked).toBeGreaterThan(500); expect(open).toBeGreaterThan(500);
    expect(trimmed / 300).toBeGreaterThan(query.walls.length * .9);
  } finally { world.dispose(); }
}, 120_000);
