import { readFileSync } from 'node:fs';
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

/** The accident's five infected at the facility exits (lane E owns the real beat). */
export function releaseFive(w: SimWorld): EntitySnapshot[] {
  const ai = w.infected!, out: EntitySnapshot[] = [];
  for (const [i, name] of ['lab-exit-front', 'lab-exit-front', 'lab-exit-side', 'lab-exit-window', 'lab-exit-side'].entries()) {
    const p = anchor(name), cell = ai.nav.nearestCell(p.x + i * .8 - 1.6, p.z + 1.5);
    const id = ai.spawn('infected.runner', { x: ai.nav.x(cell), z: ai.nav.z(cell) }, { state: 'idle', yaw: [Math.PI / 2, Math.PI, 0, -Math.PI / 2, Math.PI / 4][i], perched: false });
    out.push(w.entities.get(id)!);
  }
  return out;
}
export function infectedCount(w: SimWorld): number { return w.infected!.active.filter(e => e.health.current > 0).length; }
