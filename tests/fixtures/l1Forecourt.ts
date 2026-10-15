import { loadL1 } from '../../tools/sim-runner/l1Bots';
import type { SimWorld } from '../../src/sim/world/SimWorld';

function teleport(w: SimWorld, x: number, z: number) {
  const p = w.entities.get(1)!;
  Object.assign(p.transform, { x, z, y: .72 });
  w.physics.playerBody!.setTranslation(p.transform, true);
  w.player!.locomotion.reset(); w.spatial.set(1, x, z);
}
export async function forecourt() {
  const { world: w, mission } = await loadL1(1);
  w.combat!.damage.god = true;
  for (const id of ['pickup', 'deliver', 'escape', 'weapon']) mission.completeObjective(id);
  for (let i = 0; i < 360; i++) w.update();
  // PO #3: checkpoint bat, tick 15574, standing inside the fence, bike outside.
  teleport(w, 22.94, 35.60);
  // Clear ground on the sidewalk outside the fence opening (a spot inside a solid made the bike hop next to the courier through the fence).
  const bike = w.vehicles!.bicycle.entity!;
  Object.assign(bike.transform, { x: 27, z: 33.5, yaw: 0 });
  w.vehicles!.bicycle.postPhysics();
  return { w, mission, bike };
}

