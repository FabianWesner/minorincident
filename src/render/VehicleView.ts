// Adapted from Bruno Simon folio-2025 VisualVehicle.js (MIT, 41046b5): wheel pivots/suspension and lamps.
import { BoxGeometry, Group, Mesh, MeshBasicNodeMaterial, MeshLambertNodeMaterial, SphereGeometry, TorusGeometry, type Object3D } from 'three/webgpu';
import { AssetRegistry } from '../assets/registry';
import { atLeast } from '../assets/types';
import { vehiclePlaceholder } from '../assets/vehiclePlaceholder';
import { color, mix, positionGeometry, sin, uniform } from 'three/tsl';
import { PaletteMaterial } from './PaletteMaterial';
import type { VehicleFeedbackEvent } from './vfx/VehicleFeedback';
import type { SimWorld } from '../sim/world/SimWorld';
import type { Materials } from './Materials';
import { lerp } from '../core/maths';
interface Record { parent: Group; model: Object3D; wheels: { node: Object3D; y: number; steer: number; spin: number }[]; brake: MeshBasicNodeMaterial; sirens: MeshBasicNodeMaterial[]; smoke: Group; fire: Mesh; door: Mesh; paint: (import('three').Material & { bloodCoverage: { value: number } })[]; blood: number }
/** Registry models follow authoritative chassis/wheel snapshots; no render state feeds physics. */
export class VehicleView extends Group {
  private readonly registry = new AssetRegistry(() => {});
  private readonly records = new Map<number, Record>();
  private readonly props = new Map<number, Mesh>();
  private readonly debris: Mesh[] = [];
  private readonly propGeometry = new BoxGeometry(1, 1, 1);
  private readonly puffGeometry = new SphereGeometry(.3, 8, 6);
  private readonly smokeMaterial = new MeshBasicNodeMaterial({ color: '#696073', transparent: true, opacity: .6 });
  private readonly fireMaterial = new MeshBasicNodeMaterial({ color: '#ff7d22' });
  private bloodEnabled = true;
  private readonly feedbackEvents = new Map<number, VehicleFeedbackEvent>();
  private disposed = false;
  private readonly pending = new Map<number, Promise<void>>();
  constructor(private readonly world: SimWorld, private readonly materials: Materials) { super(); this.fireMaterial.color.multiplyScalar(3); }
  async load(): Promise<void> { for (const car of this.world.vehicles!.cars.values()) await this.addCar(car.entity.id); this.update(1); }
  private async addCar(id: number): Promise<void> {
    const car = this.world.vehicles!.cars.get(id)!, def = car.physics.def;
    const model = atLeast(this.registry.definition(def.asset).status, 'integrated') ? await this.registry.loadAsset(def.asset) : vehiclePlaceholder(def, this.materials.get(def.emergency ? 'picketWhite' : def.id === 'vehicle.school-bus' ? 'schoolBusYellow' : 'survivorRed'));
    if (this.disposed) return;
    const paint: Record['paint'] = [], copies = new Map<import('three').Material, Record['paint'][number]>();
    model.traverse(node => { if (!(node instanceof Mesh)) return; const convert = (material: import('three').Material) => {
      if (!(material instanceof PaletteMaterial) && !(material instanceof MeshLambertNodeMaterial)) return material;
      let copy = copies.get(material);
      if (!copy) {
        if (material instanceof PaletteMaterial) copy = this.materials.unique(material.token);
        else {
          const owned = Object.assign(material.clone(), { bloodCoverage: uniform(0) });
          const grain = sin(positionGeometry.x.mul(127.1).add(positionGeometry.y.mul(311.7)).add(positionGeometry.z.mul(74.7))).mul(43758.5453).fract();
          // Retain imported color, vertex colors and lighting while adding the surface mask.
          owned.colorNode = mix(uniform(owned.color), color('#b3121f'), grain.lessThan(owned.bloodCoverage).select(1, 0)); copy = owned;
        }
        copies.set(material, copy); paint.push(copy);
      }
      return copy;
    }; node.material = Array.isArray(node.material) ? node.material.map(convert) : convert(node.material); });
    const parent = new Group(); parent.add(model); this.add(parent); model.position.y = -(def.suspension + def.wheelRadius + .15);
    const wheels = ['wheelFL', 'wheelFR', 'wheelRL', 'wheelRR'].map(name => { const node = model.getObjectByName(name)!; node.rotation.order = 'YXZ'; return { node, y: node.position.y, steer: node.rotation.y, spin: node.rotation.z }; });
    const lamp = (name: string, color: string) => {
      const material = new MeshBasicNodeMaterial({ color });
      model.getObjectByName(name)?.traverse(child => { if (child instanceof Mesh) child.material = material; }); return material;
    };
    const brake = lamp('lightsBrake', '#ff2d2d'), sirens = def.emergency ? [lamp('sirenL', '#ff2d2d'), lamp('sirenR', '#2f6bff')] : [];
    const door = new Mesh(new TorusGeometry(.7, .025, 6, 32), this.materials.get('windowGlow', 1.5)); door.rotation.x = -Math.PI / 2; door.position.set(.2, .025, def.width / 2 + .55); model.add(door);
    const smoke = new Group(); parent.add(smoke);
    for (let i = 0; i < 5; i++) { const mesh = new Mesh(this.puffGeometry, this.smokeMaterial); mesh.position.set(def.length * .3, 1 + i * .32, (i % 2 ? 1 : -1) * .12); mesh.scale.setScalar(1 + i * .25); smoke.add(mesh); }
    const fire = new Mesh(this.puffGeometry, this.fireMaterial); fire.position.set(def.length * .3, .9, 0); fire.scale.set(1.8, 2.8, 1.3); parent.add(fire);
    this.records.set(id, { parent, model, wheels, brake, sirens, smoke, fire, door, paint, blood: 0 });
    const feedback = this.feedbackEvents.get(id); if (feedback) this.feedback(feedback, this.bloodEnabled);
  }
  update(alpha: number): void {
    for (const [id, car] of this.world.vehicles!.cars) {
      const record = this.records.get(id); if (!record) { if (!this.pending.has(id)) { this.pending.set(id, this.addCar(id).finally(() => { this.pending.delete(id); })); } continue; }
      const body = car.physics, p = body.transform, prev = body.previous, state = car.entity.vehicle!;
      record.parent.position.set(lerp(prev.x, p.x, alpha), lerp(prev.y, p.y, alpha), lerp(prev.z, p.z, alpha));
      record.parent.quaternion.copy(body.rotation);
      for (let i = 0; i < 4; i++) { const wheel = record.wheels[i], physics = body.wheels[i]; wheel.node.rotation.y = wheel.steer + physics.steer; wheel.node.rotation.z = wheel.spin + physics.rotation; wheel.node.position.y = wheel.y + body.def.suspension - physics.suspension; }
      record.brake.color.set('#ff2d2d').multiplyScalar(state.braking ? 4 : .15);
      for (let i = 0; i < record.sirens.length; i++) record.sirens[i].color.set(i === 0 ? '#ff2d2d' : '#2f6bff').multiplyScalar((Math.floor(this.world.tick / 30) % 2 === i) ? 4 : .1);
      record.door.position.y = .025 + body.def.suspension + body.def.wheelRadius + .15 - p.y;
      record.door.visible = this.world.vehicles!.active === null && car.entity.health.current > 0;
      record.smoke.visible = state.damage !== 'normal'; record.fire.visible = state.damage === 'burning' || state.damage === 'exploded';
      record.smoke.position.y = (this.world.tick % 60) / 120;
    }
    for (const item of this.world.vehicles!.obstacles.items) {
      let mesh = this.props.get(item.entity.id);
      if (!mesh) { mesh = new Mesh(this.propGeometry, this.materials.get(item.light ? 'orange' : 'asphalt')); mesh.scale.set(item.halfX * 2, 1, item.halfZ * 2); mesh.position.copy(item.entity.transform); mesh.castShadow = mesh.receiveShadow = true; this.props.set(item.entity.id, mesh); this.add(mesh); }
      mesh.visible = !item.broken;
    }
    for (let i = 0; i < this.world.vehicles!.obstacles.debris.length; i++) {
      const d = this.world.vehicles!.obstacles.debris[i]; let mesh = this.debris[i];
      if (!mesh) { mesh = new Mesh(this.propGeometry, this.materials.get('woodWarm')); mesh.scale.setScalar(.24); this.debris.push(mesh); this.add(mesh); }
      mesh.visible = d.expires > this.world.tick; if (mesh.visible) { mesh.position.copy(d.body.translation()); mesh.quaternion.copy(d.body.rotation()); }
    }
  }
  feedback(event: VehicleFeedbackEvent, enabled: boolean): void {
    this.feedbackEvents.set(event.id, { ...event, position: { ...event.position } }); this.bloodEnabled = enabled;
    const record = this.records.get(event.id); if (!record) return;
    record.blood = event.blood; for (const material of record.paint) material.bloodCoverage.value = enabled ? event.blood : 0;
  }
  setBloodEnabled(enabled: boolean): void { this.bloodEnabled = enabled; for (const record of this.records.values()) for (const material of record.paint) material.bloodCoverage.value = enabled ? record.blood : 0; }
  async ready(): Promise<void> { await Promise.all(this.pending.values()); }
  snapshot() { return [...this.records].map(([id, r]) => ({ id, bloodCoverage: this.bloodEnabled ? r.blood : 0, windshieldBloodCoverage: this.bloodEnabled ? r.blood : 0, wheels: r.wheels.map(w => ({ spin: w.node.rotation.z, steer: w.node.rotation.y })), brake: r.brake.color.r, sirens: r.sirens.map(s => s.color.toArray()), placeholder: !!r.model.userData.placeholder })); }
  dispose(): void {
    this.disposed = true;
    const geometries = new Set<import('three').BufferGeometry>(), materials = new Set<MeshBasicNodeMaterial>();
    for (const r of this.records.values()) { for (const material of r.paint) material.dispose(); geometries.add(r.door.geometry); materials.add(r.brake); for (const s of r.sirens) materials.add(s); if (r.model.userData.placeholder) r.model.traverse(node => { if (node instanceof Mesh) { geometries.add(node.geometry); const m = node.material; if (!Array.isArray(m) && m instanceof MeshBasicNodeMaterial) materials.add(m); } }); }
    for (const g of geometries) g.dispose(); for (const m of materials) m.dispose();
    this.registry.dispose(); this.propGeometry.dispose(); this.puffGeometry.dispose(); this.smokeMaterial.dispose(); this.fireMaterial.dispose(); this.records.clear(); this.props.clear(); this.debris.length = 0; this.clear();
  }
}
