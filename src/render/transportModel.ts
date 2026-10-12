import { Group, type Object3D } from 'three/webgpu';
import type { VehicleDef } from '../data/vehicles';
/** The existing APC remains usable until its authored unarmed variant arrives. */
export function prepareTransportModel(model: Object3D, def: VehicleDef): void {
  if (!def.transport) return;
  for (const name of ['turret', 'gun', 'muzzle']) model.getObjectByName(name)?.removeFromParent();
  for (const [i, position] of def.transport.seats.entries()) {
    if (model.getObjectByName(`passenger${i}`)) continue;
    const seat = new Group(); seat.name = `passenger${i}`;
    seat.position.set(position.x, position.y, position.z); model.add(seat);
  }
}
