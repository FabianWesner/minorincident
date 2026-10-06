import { BoxGeometry, Group, Mesh } from 'three/webgpu';
import type { Materials } from '../Materials';
import type { PaletteMaterial } from '../PaletteMaterial';
import type { GameEvent } from '../../sim/world/types';
export type VehicleFeedbackEvent = Extract<GameEvent, { type: 'vehicle.feedback' }>;
/** Code vehicle surface used until E09 supplies its model view. E09 can bind the same
 * PaletteMaterial.bloodCoverage hook; this adapter consumes feedback without driving a vehicle. */
export class VehicleFeedback extends Group {
  private readonly geometry = new BoxGeometry(1, 1, 1);
  private readonly vehicles = new Map<number, { group: Group; paint: PaletteMaterial; glass: PaletteMaterial; blood: number }>();
  constructor(private readonly materials: Materials) { super(); }
  update(event: VehicleFeedbackEvent, bloodEnabled: boolean): void {
    let vehicle = this.vehicles.get(event.id);
    if (!vehicle) {
      const group = new Group(), paint = this.materials.unique('policeBlue'), glass = this.materials.unique('uiDark');
      const body = new Mesh(this.geometry, paint); body.scale.set(3.5, 0.65, 1.5); body.position.y = 0.6; body.castShadow = true;
      const cabin = new Mesh(this.geometry, glass); cabin.scale.set(1.5, 0.65, 1.3); cabin.position.set(-0.15, 1.2, 0); cabin.castShadow = true;
      group.add(body, cabin);
      for (const x of [-1.1, 1.1]) for (const z of [-0.75, 0.75]) {
        const wheel = new Mesh(this.geometry, this.materials.get('uiDark')); wheel.scale.set(0.55, 0.55, 0.22); wheel.position.set(x, 0.35, z); group.add(wheel);
      }
      vehicle = { group, paint, glass, blood: 0 }; this.vehicles.set(event.id, vehicle); this.add(group);
    }
    vehicle.group.position.set(event.position.x, 0, event.position.z); vehicle.group.rotation.y = event.yaw;
    vehicle.blood = Math.min(1, Math.max(0, event.blood));
    vehicle.paint.bloodCoverage.value = vehicle.glass.bloodCoverage.value = bloodEnabled ? vehicle.blood : 0;
  }
  setBloodEnabled(enabled: boolean): void { for (const vehicle of this.vehicles.values()) vehicle.paint.bloodCoverage.value = vehicle.glass.bloodCoverage.value = enabled ? vehicle.blood : 0; }
  getState() { return [...this.vehicles].map(([id, vehicle]) => ({ id, bloodCoverage: vehicle.paint.bloodCoverage.value, windshieldBloodCoverage: vehicle.glass.bloodCoverage.value })); }
  dispose(): void { this.geometry.dispose(); for (const vehicle of this.vehicles.values()) { vehicle.paint.dispose(); vehicle.glass.dispose(); } this.vehicles.clear(); this.clear(); }
}
