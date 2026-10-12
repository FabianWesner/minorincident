import { l7Fires, l7Exit } from './layout';
import { equipL7Arsenal, spawnL7Rocket } from './rocket';
import type { SimWorld } from '../../sim/world/SimWorld';
/** Existing pooled E27 fire/smoke emitters, retained for the entire escape. */
export function installL7Dressing(world: SimWorld): void {
  equipL7Arsenal(world);
  spawnL7Rocket(world, { x: l7Exit.position[0], z: l7Exit.position[2] });
  for (const f of l7Fires) {
    const id = world.hazards!.spawn('fire', { x: f.at[0], z: f.at[1] }, { radius: f.r, duration: 7200 });
    world.entities.get(id)!.transform.y += world.districts!.groundHeight(f.at[0], f.at[1]);
  }
}
