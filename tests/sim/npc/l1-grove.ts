import { readFileSync } from 'node:fs';
import { SimPhase } from '../../../src/core/EventBus';
import { l1v2 } from '../../../src/data/l1v2';
import { compositions } from '../../../src/levels/compositions';
import type { DistrictLayout } from '../../../src/levels/districts/types';
import { installL1Outbreak, type L1OutbreakSetup } from '../../../src/sim/outbreak/install';
import type { Outbreak } from '../../../src/sim/outbreak/Outbreak';
import { SimWorld } from '../../../src/sim/world/SimWorld';
import type { EntitySnapshot } from '../../../src/sim/world/types';

const layout = JSON.parse(readFileSync('public/assets/layouts/D-GROVE.layout.json', 'utf8')) as DistrictLayout;
/** D-GROVE with the L1 v2 outbreak layer, player parked out of the way (god mode). */
export async function groveWorld(seed = 1, setup: L1OutbreakSetup = {}): Promise<{ w: SimWorld; outbreak: Outbreak }> {
  const w = new SimWorld(); await w.init(); w.loadComposition(compositions['D-GROVE'], [layout], seed);
  const outbreak = installL1Outbreak(w, setup); w.combat!.damage.god = true;
  return { w, outbreak };
}
export function step(w: SimWorld, ticks: number): void { for (let i = 0; i < ticks; i++) w.update(); }
export function anchor(name: string) { const a = layout.anchors[name].position; return { x: a[0], z: a[2] }; }

/**
 * Stand-in for lane C's infected brain (section 5.2/5.3) until it merges: 90 degree cone, 16 m, line of sight,
 * closest visible human, chase at the tier speed, otherwise drift. Drives infected in the `migration` state that the
 * E07 brain leaves alone. Never targets the player (idle-bot scenarios keep the player away).
 */
export function mockHunters(w: SimWorld, outbreak: Outbreak): void {
  const ai = w.infected!, cone = Math.cos(l1v2.infected.visionConeDeg / 2 * Math.PI / 180), wander = new Map<number, { x: number; z: number; until: number; search?: boolean }>();
  w.events.on('sim.tick', () => {
    for (const e of ai.active) {
      const b = e.infected!; if (e.health.current <= 0 || w.npcs!.civilians.holds(e.id)) continue;
      b.state = 'migration';
      let target: { x: number; z: number } | null = null, best = Infinity;
      for (const h of outbreak.humans.all()) {
        if (h.kind === 'player') continue;
        const dx = h.position.x - e.transform.x, dz = h.position.z - e.transform.z, d = Math.hypot(dx, dz);
        if (d > l1v2.infected.visionRangeM || d >= best) continue;
        if (d > 1 && (dx * Math.cos(e.transform.yaw) - dz * Math.sin(e.transform.yaw)) / d < cone) continue;
        if (!w.combat!.query.visible(e.transform, h.position)) continue;
        target = h.position; best = d;
      }
      if (target) { w.npcs!.move(e, target, b.speed || 5.1, b, .2); wander.set(e.id, { x: target.x, z: target.z, until: w.tick + 600, search: true }); continue; }
      let drift = wander.get(e.id);
      // Search (section 5.3, simplified): run to the last-known position, then drift around it.
      if (drift?.search && w.tick < drift.until && Math.hypot(drift.x - e.transform.x, drift.z - e.transform.z) >= .5) { w.npcs!.move(e, drift, (b.speed || 5.1) * .8, b, .3); continue; }
      if (!drift || w.tick >= drift.until || Math.hypot(drift.x - e.transform.x, drift.z - e.transform.z) < .5) {
        const angle = outbreak.rng.next() * Math.PI * 2, cell = ai.nav.nearestCell(e.transform.x + Math.cos(angle) * 12, e.transform.z + Math.sin(angle) * 12);
        drift = { x: ai.nav.x(cell), z: ai.nav.z(cell), until: w.tick + 300 }; wander.set(e.id, drift);
      }
      w.npcs!.move(e, drift, 1.2, b, .3);
    }
  }, SimPhase.ai);
}
/** The accident's five infected at the facility exits (lane E owns the real beat). */
export function releaseFive(w: SimWorld): EntitySnapshot[] {
  const ai = w.infected!, out: EntitySnapshot[] = [];
  for (const [i, name] of ['lab-exit-front', 'lab-exit-front', 'lab-exit-side', 'lab-exit-window', 'lab-exit-side'].entries()) {
    const p = anchor(name), cell = ai.nav.nearestCell(p.x + i * .8 - 1.6, p.z + 1.5);
    const id = ai.spawn('infected.runner', { x: ai.nav.x(cell), z: ai.nav.z(cell) }, { state: 'idle', yaw: [Math.PI / 2, Math.PI, 0, -Math.PI / 2, Math.PI / 4][i], perched: false });
    const e = w.entities.get(id)!; e.infected!.speed = l1v2.speedTiers.average.baseMs; out.push(e);
  }
  return out;
}
export function infectedCount(w: SimWorld): number { return w.infected!.active.filter(e => e.health.current > 0).length; }
