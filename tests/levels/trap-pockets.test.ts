import { describe, expect, test } from 'vitest';
import { loadLevel } from '../../tools/sim-runner/levels';
import type { MissionId } from '../../src/levels/missions';
import type { SimWorld } from '../../src/sim/world/SimWorld';

/**
 * PO 10-12 (L3 bridge): actors walked through a slot in the deck and were stranded on the lower road. Directed reachability over the
 * baked nav grid: stepping up is limited (kerbs, lips), stepping down is free (a fall), so a drop is a one-way edge. From every cell
 * the player can reach from the start, at least one objective anchor must stay reachable (mission-scripted hops such as the L4 cellar are legitimate one-way moves, so the union of step anchors is used).
 */
const STEP_UP = .7;
export function trapPockets(world: SimWorld, goals: { x: number; z: number }[]): { stranded: number; sample: [number, number, number][] } {
  const d = world.districts!, nav = d.nav, w = nav.width, n = nav.cells.length;
  const h = new Float32Array(n);
  for (let i = 0; i < n; i++) if (nav.cells[i]) h[i] = d.groundHeight(nav.min[0] + (i % w + .5) * nav.cellSize, nav.min[1] + (Math.floor(i / w) + .5) * nav.cellSize);
  const neighbours = (i: number): number[] => {
    const x = i % w, out: number[] = [];
    for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
      if (!dx && !dz) continue; const nx = x + dx, j = i + dz * w + dx;
      if (nx < 0 || nx >= w || j < 0 || j >= n || !nav.cells[j]) continue;
      // Diagonal moves must not cut a blocked corner.
      if (dx && dz && (!nav.cells[i + dx] || !nav.cells[i + dz * w])) continue;
      out.push(j);
    }
    return out;
  };
  const forward = (a: number, b: number) => h[b] - h[a] <= STEP_UP;
  const player = world.entities.get(1)!.transform;
  const start = nav.index(player.x, player.z);
  const seen = new Uint8Array(n), queue = [start]; seen[start] = 1;
  for (let r = 0; r < queue.length; r++) for (const j of neighbours(queue[r])) if (!seen[j] && forward(queue[r], j)) { seen[j] = 1; queue.push(j); }
  const can = new Uint8Array(n), back: number[] = [];
  for (const g of goals) { const i = nav.index(g.x, g.z); if (i >= 0 && nav.cells[i] && !can[i]) { can[i] = 1; back.push(i); } }
  for (let r = 0; r < back.length; r++) for (const j of neighbours(back[r])) if (!can[j] && forward(j, back[r])) { can[j] = 1; back.push(j); }
  const bad = queue.filter(i => !can[i]);
  return { stranded: bad.length, sample: bad.filter((_, k) => k % Math.max(1, Math.floor(bad.length / 8)) === 0).slice(0, 8).map(i => [nav.min[0] + (i % w + .5) * nav.cellSize, nav.min[1] + (Math.floor(i / w) + .5) * nav.cellSize, h[i]]) };
}

describe('@trap-pockets directed reachability', () => {
  for (const level of ['L1', 'L2', 'L3', 'L4', 'L5', 'L6'] as MissionId[]) {
    test(`${level}: every cell the player can reach keeps an objective anchor reachable`, async () => {
      const world = await loadLevel(level, 1);
      try {
        const def = world.missions!.def, goals = def.steps.map(s => def.anchors[s.anchor]).filter(Boolean);
        const bad = trapPockets(world, goals);
        expect(bad.stranded, `${level} stranded cells, e.g. ${JSON.stringify(bad.sample)}`).toBe(0);
      } finally { world.dispose(); }
    }, 120000);
  }
});
