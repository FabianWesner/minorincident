import type { ScenarioDefinition } from '../../../src/levels/loader';
import type { SimWorld } from '../../../src/sim/world/SimWorld';

const ring = (r: number, n: number, asset: string) => Array.from({ length: n }, (_, i) => ({ assetId: asset, x: Math.cos(i / n * Math.PI * 2) * r, z: Math.sin(i / n * Math.PI * 2) * r }));
/** E27 photo/measurement spots. The blast centre is the origin; the player watches from 10 m south. */
const lab: ScenarioDefinition = {
  name: 'blast-lab', survivor: true, combat: true, infected: true, ground: { width: 70, depth: 70 }, player: { x: 0, y: .705, z: 10 },
  // A cover wall west of the centre: line of sight shields what stands behind it.
  walls: [{ x: -6, y: 1, z: 0, halfX: .25, halfY: 1, halfZ: 2.5 }],
  physicsProps: [...ring(2.4, 6, 'prop.traffic-cone'), ...ring(3.6, 3, 'prop.shopping-cart'), { assetId: 'prop.bench', x: 0, z: -4.5, yaw: 0 }],
};
export const blastScenarios: Record<string, ScenarioDefinition> = {
  'blast-lab': lab,
  /** Worst case for E18 budgets: car explosion + fires + smoke column + 30 chasing infected. */
  'blast-stress': { ...lab, name: 'blast-stress', physicsProps: [...ring(3, 8, 'prop.traffic-cone'), ...ring(4.2, 4, 'prop.shopping-cart')] },
  'smoke-lab': { name: 'smoke-lab', survivor: true, combat: true, infected: true, ground: { width: 60, depth: 60 }, player: { x: 0, y: .705, z: 0 } },
};
export function installBlastScenario(world: SimWorld): void {
  if (world.scenario === 'blast-lab') world.vehicles!.spawn('vehicle.sedan', { x: 7, z: -3 }, .4);
  if (world.scenario === 'blast-stress') {
    world.vehicles!.spawn('vehicle.sedan', { x: 0, z: 0 }, .4);
    for (let i = 0; i < 30; i++) { const a = i / 30 * Math.PI * 2, r = 9 + (i % 3) * 1.6; world.infected!.spawn('infected.runner', { x: Math.cos(a) * r, z: Math.sin(a) * r - 2 }, { state: 'chase' }); }
  }
}
