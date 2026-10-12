import type { SimWorld } from './SimWorld';
import type { EntitySnapshot } from './types';
import type { NavGrid } from './NavGrid';

/** Largest climb between two adjacent nav cells that still counts as walkable (kerbs, ramp lips); any drop is a one-way fall. */
export const stepUpM = .7;
/** Cells from which one of the goals can be reached on foot, with falls as one-way edges (backward flood from the goals). */
export function goalReach(nav: NavGrid, height: (x: number, z: number) => number, goals: { x: number; z: number }[]): Uint8Array {
  const w = nav.width, n = nav.cells.length, h = new Float32Array(n);
  for (let i = 0; i < n; i++) if (nav.cells[i]) h[i] = height(nav.min[0] + (i % w + .5) * nav.cellSize, nav.min[1] + (Math.floor(i / w) + .5) * nav.cellSize);
  const can = new Uint8Array(n), queue: number[] = [];
  for (const g of goals) { const i = nav.index(g.x, g.z); if (i >= 0 && nav.cells[i] && !can[i]) { can[i] = 1; queue.push(i); } }
  for (let r = 0; r < queue.length; r++) {
    const i = queue[r], x = i % w;
    for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
      if (!dx && !dz) continue;
      const nx = x + dx, j = i + dz * w + dx;
      if (nx < 0 || nx >= w || j < 0 || j >= n || !nav.cells[j] || can[j]) continue;
      if (dx && dz && (!nav.cells[i + dx] || !nav.cells[i + dz * w])) continue;
      if (h[i] - h[j] <= stepUpM) { can[j] = 1; queue.push(j); }
    }
  }
  return can;
}

/**
 * Safety net for trap pockets (PO 10-12: the L3 bridge slot dropped the whole group onto an enclosed lower road). When the player stands
 * on foot in a nav area from which no objective anchor can be reached for `waitTicks`, the screen fades (`fading`, read by the UI) and the
 * player, companion and escorts move to the nearest cell that can reach the objective. Deterministic; runs on the fixed tick.
 */
export class TrapRescue {
  static readonly waitTicks = 180;
  static readonly fadeTicks = 14;
  /** True while the UI should cover the screen; `rescues` counts completed relocations. */
  fading = false; rescues = 0;
  private readonly can: Uint8Array;
  private stuck = 0; private fade = 0;
  constructor(private readonly world: SimWorld, goals: { x: number; z: number }[]) {
    const d = world.districts;
    this.can = d && goals.length ? goalReach(d.nav, (x, z) => d.groundHeight(x, z), goals) : new Uint8Array(0);
  }
  update(): void {
    const world = this.world, d = world.districts, player = world.entities.get(1);
    if (!d || !player || !this.can.length || world.vehicles?.active != null || player.health.current <= 0) { this.stuck = 0; return; }
    if (this.fade > 0) { if (--this.fade === 0) { this.relocate(player); this.fading = false; this.rescues++; } return; }
    const i = d.nav.index(player.transform.x, player.transform.z);
    // Cells off the nav grid (mid-step on a ledge, inside a doorway) are not judged.
    if (i < 0 || !d.nav.cells[i] || this.can[i]) { this.stuck = 0; return; }
    if (++this.stuck >= TrapRescue.waitTicks) { this.stuck = 0; this.fade = TrapRescue.fadeTicks; this.fading = true; }
  }
  private relocate(player: EntitySnapshot): void {
    const world = this.world, nav = world.districts!.nav, w = nav.width, px = player.transform.x, pz = player.transform.z;
    let best = -1, bestD = Infinity;
    for (let i = 0; i < this.can.length; i++) {
      if (!this.can[i]) continue;
      const x = nav.min[0] + (i % w + .5) * nav.cellSize, z = nav.min[1] + (Math.floor(i / w) + .5) * nav.cellSize, dist = (x - px) ** 2 + (z - pz) ** 2;
      if (dist < bestD && nav.walkable([x, z]) && nav.walkable([x + .6, z]) && nav.walkable([x - .6, z]) && nav.walkable([x, z + .6]) && nav.walkable([x, z - .6])) { bestD = dist; best = i; }
    }
    if (best < 0) return;
    const x = nav.min[0] + (best % w + .5) * nav.cellSize, z = nav.min[1] + (Math.floor(best / w) + .5) * nav.cellSize;
    const squad = world.missions?.state.l3?.squadIds ?? [];
    const group: EntitySnapshot[] = [];
    for (const e of world.entities.iterate()) if (e.id !== 1 && !e.infected && !e.corpse && (e.companion || e.escort || squad.includes(e.id))) group.push(e);
    const place = (e: EntitySnapshot, ox: number, oz: number, id: number) => {
      const px2 = nav.walkable([x + ox, z + oz]) ? x + ox : x, pz2 = nav.walkable([x + ox, z + oz]) ? z + oz : z;
      const feet = world.districts!.groundHeight(px2, pz2);
      Object.assign(e.transform, { x: px2, z: pz2, y: feet + (id === 1 ? .72 : e.companion || e.civilian?.pet ? .3 : .7) });
      world.spatial.set(e.id, px2, pz2);
    };
    place(player, 0, 0, 1);
    world.previousPlayer = { ...player.transform };
    world.physics.playerBody!.setTranslation(player.transform, true);
    group.forEach((e, k) => { const a = k * 2.4; place(e, Math.cos(a) * 1.4, Math.sin(a) * 1.4, e.id); });
  }
}
