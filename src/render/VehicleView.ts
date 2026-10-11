import { carDoorWeight, carTransitionTicks } from './characters/carTransition';
import { VehicleOccupant } from './characters/VehicleOccupant';
import { tyreSurface } from './TyreContact';
import { modelLod } from './lodPolicy';
import { paletteTokens } from '../data/palette';
// Adapted from Bruno Simon folio-2025 VisualVehicle.js (MIT, 41046b5): wheel pivots/suspension and lamps.
import { BoxGeometry, Group, Matrix4, Mesh, MeshBasicNodeMaterial, MeshLambertNodeMaterial, Quaternion, SphereGeometry, TorusGeometry, Vector3, type Object3D } from 'three/webgpu';
import { productionObstacleAssets } from './EntityAssets';
import { AssetRegistry } from '../assets/registry';
import { atLeast } from '../assets/types';
import { vehiclePlaceholder } from '../assets/vehiclePlaceholder';
import { color, mix, positionGeometry, sin, uniform } from 'three/tsl';
import { PaletteMaterial } from './PaletteMaterial';
import type { VehicleFeedbackEvent } from './vfx/VehicleFeedback';
import type { SimWorld } from '../sim/world/SimWorld';
import type { View } from './View';
import type { AssetQuality } from '../assets/types';
import type { Materials } from './Materials';
import { lerp } from '../core/maths';
import { anchorsFor } from './WorldLights';
import { footprint, type LightField } from './LightField';
const lampPosition = new Vector3(), lampDirection = new Vector3();
interface Record { doorHeldAt: number; decay?: string; lod: AssetQuality; parent: Group; model: Object3D; wheels: { node: Object3D; y: number; steer: number; spin: number; contacts: Vector3[]; contactPose: Matrix4; contactOffset: number; contactGround: VehicleView['ground'] }[]; brake: MeshBasicNodeMaterial; sirens: MeshBasicNodeMaterial[]; smoke: Group; fire: Mesh; door: Mesh; paint: (import('three').Material & { bloodCoverage: { value: number } })[]; blood: number; charred: boolean; feel: { tick: number; speed: number; accel: number; roll: number; pitch: number; restRoll: number; restPitch: number } }
/** Registry models follow authoritative chassis/wheel snapshots; no render state feeds physics. */
export class VehicleView extends Group {
  private readonly registry: AssetRegistry;
  private readonly records = new Map<number, Record>();
  private readonly occupants = new Map<number, VehicleOccupant>();
  private readonly occupantLoads = new Map<number, Promise<void>>();
  private readonly occupantSeats = new Map<number, Group>();
  private readonly props = new Map<number, Mesh>();
  private readonly debris: Mesh[] = [];
  private readonly propGeometry = new BoxGeometry(1, 1, 1);
  private readonly puffGeometry = new SphereGeometry(.3, 8, 6);
  private readonly smokeMaterial = new MeshBasicNodeMaterial({ color: '#696073', transparent: true, opacity: .6 });
  private readonly fireMaterial = new MeshBasicNodeMaterial({ color: '#ff7d22' });
  private bloodEnabled = true;
  private readonly feedbackEvents = new Map<number, VehicleFeedbackEvent>();
  private disposed = false;
  private readonly contact = new Vector3();
  private readonly chassisRotation = new Quaternion();
  private readonly pending = new Map<number, Promise<void>>();
  constructor(private readonly world: SimWorld, private readonly materials: Materials, private readonly view: View, private readonly low = false) { super(); this.registry = new AssetRegistry(() => {}, { materials: materials }); this.fireMaterial.color.multiplyScalar(3); }
  async load(): Promise<void> { for (const car of this.world.vehicles!.cars.values()) await this.addCar(car.entity.id); this.update(1); }
  private async addCar(id: number): Promise<void> {
    const car = this.world.vehicles!.cars.get(id)!, def = car.physics.def;
    const distance = Math.hypot(car.entity.transform.x - this.view.cameraTarget.x, car.entity.transform.z - this.view.cameraTarget.z);
    const lod = modelLod(distance, this.records.get(id)?.lod, this.low);
    const requested = car.entity.vehicle!.decay, variants = this.registry.definition(def.asset).decayVariants;
    const decay = requested && variants.includes(requested) ? requested : requested && variants.includes('wrecked') ? 'wrecked' : undefined;
    const model = atLeast(this.registry.definition(def.asset).status, 'integrated') ? await this.registry.loadAsset(def.asset, lod, decay) : vehiclePlaceholder(def, this.materials.get(def.emergency ? 'picketWhite' : def.id === 'vehicle.school-bus' ? 'schoolBusYellow' : 'survivorRed'));
    if (this.disposed) return;
    model.userData.assetId = def.asset;
    const paint: Record['paint'] = [], copies = new Map<import('three').Material, Record['paint'][number]>();
    model.traverse(node => { if (!(node instanceof Mesh)) return; const convert = (material: import('three').Material) => {
      if (material.name.startsWith('emi_') || material.userData.emissiveStrength > 0) return material;
      if (!(material instanceof PaletteMaterial) && !(material instanceof MeshLambertNodeMaterial)) return material;
      let copy = copies.get(material);
      if (!copy) {
        if (material instanceof PaletteMaterial) {
          const token = material.name.startsWith('pal_') ? material.token : paletteTokens[this.materials.nearest(material.color)];
          copy = this.materials.uniqueWorld(token, material.vertexColors);
          copy.transparent = material.transparent; copy.opacity = material.opacity; copy.depthWrite = material.depthWrite; copy.forceSinglePass = material.forceSinglePass; copy.side = material.side;
          (copy as PaletteMaterial).fade.value = material.fade.value;
        }
        else {
          const owned = Object.assign(material.clone(), { bloodCoverage: uniform(0), char: uniform(0) });
          const grain = sin(positionGeometry.x.mul(127.1).add(positionGeometry.y.mul(311.7)).add(positionGeometry.z.mul(74.7))).mul(43758.5453).fract();
          // Retain imported color, vertex colors and lighting while adding the surface mask.
          owned.colorNode = mix(mix(uniform(owned.color), color('#b3121f'), grain.lessThan(owned.bloodCoverage).select(1, 0)), color('#1d1a18'), owned.char); copy = owned;
        }
        copies.set(material, copy); paint.push(copy);
      }
      return copy;
    }; node.material = Array.isArray(node.material) ? node.material.map(convert) : convert(node.material); });
    const parent = new Group(); parent.add(model); this.add(parent); model.position.y = -(def.suspension + def.wheelRadius + .15);
    const wheels = ['wheelFL', 'wheelFR', 'wheelRL', 'wheelRR'].map(name => { const node = model.getObjectByName(name)!; node.rotation.order = 'YXZ'; return { node, y: node.position.y, steer: node.rotation.y, spin: node.rotation.z, contacts: tyreSurface(node), contactPose: new Matrix4(), contactOffset: 0, contactGround: null }; });
    const lamp = (name: string, color: string) => {
      const material = new MeshBasicNodeMaterial({ color });
      model.getObjectByName(name)?.traverse(child => { if (child instanceof Mesh) child.material = material; }); return material;
    };
    const brake = lamp('lightsBrake', '#ff2d2d'), sirens = def.emergency ? [lamp('sirenL', '#ff2d2d'), lamp('sirenR', '#2f6bff')] : [];
    const door = new Mesh(new TorusGeometry(.7, .025, 6, 32), this.materials.get('windowGlow', 1.5)); door.rotation.x = -Math.PI / 2; door.position.set(.2, .025, def.width / 2 + .55); door.position.x = def.doorX; model.add(door);
    const smoke = new Group(); parent.add(smoke);
    for (let i = 0; i < 5; i++) { const mesh = new Mesh(this.puffGeometry, this.smokeMaterial); mesh.position.set(def.length * .3, 1 + i * .32, (i % 2 ? 1 : -1) * .12); mesh.scale.setScalar(1 + i * .25); smoke.add(mesh); }
    const fire = new Mesh(this.puffGeometry, this.fireMaterial); fire.position.set(def.length * .3, .9, 0); fire.scale.set(1.8, 2.8, 1.3); parent.add(fire);
    const previous = this.records.get(id); if (previous) { previous.parent.removeFromParent(); this.releaseRecord(previous); }
    this.records.set(id, { doorHeldAt: -carTransitionTicks, decay, lod, parent, model, wheels, brake, sirens, smoke, fire, door, paint, blood: 0, charred: false, feel: { tick: this.world.tick, speed: car.entity.vehicle!.speed, accel: 0, roll: 0, pitch: 0, restRoll: model.rotation.x, restPitch: model.rotation.z } });
    const feedback = this.feedbackEvents.get(id); if (feedback) this.feedback(feedback, this.bloodEnabled);
  }
  update(alpha: number): void {
    for (const [id, car] of this.world.vehicles!.cars) {
      const record = this.records.get(id);
      const distance = Math.hypot(car.entity.transform.x - this.view.cameraTarget.x, car.entity.transform.z - this.view.cameraTarget.z);
      const lod = modelLod(distance, record?.lod, this.low);
      const variants = this.registry.definition(car.physics.def.asset).decayVariants, requested = car.entity.vehicle!.decay;
      const decay = requested && variants.includes(requested) ? requested : requested && variants.includes('wrecked') ? 'wrecked' : undefined;
      if (!record || record.lod !== lod || record.decay !== decay) { if (!this.pending.has(id)) { this.pending.set(id, this.addCar(id).finally(() => { this.pending.delete(id); })); } if (!record) continue; }
      const body = car.physics, p = body.transform, prev = body.previous, state = car.entity.vehicle!;
      if (body.body.isKinematic()) {
        const feel = record.feel, elapsed = (this.world.tick - feel.tick) / 60;
        if (elapsed > 0) { feel.accel = (state.speed - feel.speed) / elapsed; feel.speed = state.speed; feel.tick = this.world.tick; }
        // Small suspension response on the passenger ride; tyres still settle independently on drawn ground below.
        const roll = Math.max(-.02, Math.min(.02, state.speed ** 2 * Math.tan(state.steer) / body.def.wheelbase * .008));
        const pitch = Math.max(-.016, Math.min(.016, feel.accel * .004));
        const response = 1 - Math.exp(-6 / 60);
        feel.roll += (roll - feel.roll) * response; feel.pitch += (pitch - feel.pitch) * response;
        record.model.rotation.x = feel.restRoll + feel.roll; record.model.rotation.z = feel.restPitch + feel.pitch;
      }
      record.parent.position.set(lerp(prev.x, p.x, alpha), lerp(prev.y, p.y, alpha), lerp(prev.z, p.z, alpha));
      record.parent.quaternion.copy(body.previousRotation).slerp(this.chassisRotation.copy(body.rotation), alpha);
      for (let i = 0; i < 4; i++) {
        const wheel = record.wheels[i], physics = body.wheels[i], previous = body.previousWheels[i];
        wheel.node.rotation.y = wheel.steer + lerp(previous.steer, physics.steer, alpha);
        wheel.node.rotation.z = wheel.spin + lerp(previous.rotation, physics.rotation, alpha);
        wheel.node.position.y = wheel.y + body.def.suspension - lerp(previous.suspension, physics.suspension, alpha);
      }
      // Rapier drives on the flat y = 0 plane while the district draws its roads 5 cm above it (and kerbs, paint, paving
      // higher): rest the car on the drawn ground, each wheel on its own spot.
      if (this.ground) {
        record.parent.updateMatrixWorld(true);
        const heights = record.wheels.map(w => this.ground!(...this.wheelSpot(w.node)) ?? 0), mean = heights.reduce((a, b) => a + b, 0) / heights.length;
        record.parent.position.y += mean;
        for (let i = 0; i < 4; i++) record.wheels[i].node.position.y += heights[i] - mean;
        // Tyre faces can meet a paving edge between mesh vertices, especially with steering and body lean.
        record.parent.updateMatrixWorld(true);
        for (const wheel of record.wheels) {
          // Parked wheels meet the same immutable ground every frame. Reuse their correction until the pose changes;
          // the matrix tolerance is below a micron, so this also covers sleeping physics jitter without visible sink.
          if (wheel.contactGround === this.ground && wheel.contactPose.elements.every((v, i) => Math.abs(v - wheel.node.matrixWorld.elements[i]) < 1e-7)) {
            wheel.node.position.y += wheel.contactOffset; continue;
          }
          wheel.contactPose.copy(wheel.node.matrixWorld); wheel.contactGround = this.ground;
          const baseY = wheel.node.position.y;
          // Moving a wheel along a leaning chassis also moves its tread sideways. Recheck the contact after settling:
          // at the station's paving boundary that small shift can put a face over a different ground triangle.
          for (let pass = 0; pass < 3; pass++) {
            wheel.node.updateWorldMatrix(true, false);
            let gap = Infinity;
            for (const local of wheel.contacts) {
              this.contact.copy(local).applyMatrix4(wheel.node.matrixWorld);
              const ground = this.ground(this.contact.x, this.contact.z);
              if (ground !== null) gap = Math.min(gap, this.contact.y - ground);
            }
            if (!Number.isFinite(gap) || pass > 0 && gap >= 0) break;
            const vertical = wheel.node.parent!.matrixWorld.elements[5];
            if (vertical > .1) wheel.node.position.y -= (gap - .001) / vertical;
          }
          wheel.contactOffset = wheel.node.position.y - baseY;
        }
      }
      const transition = this.world.vehicles!.transition;
      const elapsed = transition?.carId === id ? this.world.tick + alpha - 1 - transition.tick : carTransitionTicks;
      const side = transition?.side ?? 1, player = this.world.entities.get(1)!;
      const dx = player.transform.x - p.x, dz = player.transform.z - p.z;
      const along = dx * Math.cos(p.yaw) - dz * Math.sin(p.yaw), out = side * (dx * Math.sin(p.yaw) + dz * Math.cos(p.yaw));
      // An exiting courier stands in the door sweep: keep it open until she steps clear.
      if (transition?.carId === id && transition.kind === 'exit' && elapsed >= 12 && !player.hidden && player.health.current > 0 && Math.abs(along - body.def.doorX) < .8 && out > body.def.width / 2 + .2 && out < body.def.width / 2 + 1.25) record.doorHeldAt = this.world.tick + alpha - 1;
      const sinceHeld = (this.world.tick + alpha - 1 - record.doorHeldAt) / 18;
      const open = Math.max(carDoorWeight(elapsed), 1 - Math.max(0, Math.min(1, sinceHeld)));
      for (const [name, sign] of [['doorL', 1], ['doorR', -1], ['door_near_0', 1], ['door_near_1', 1], ['door_far_0', -1], ['door_far_1', -1]] as const) {
        const leaf = record.model.getObjectByName(name); if (!leaf) continue;
        leaf.userData.closedYaw ??= leaf.rotation.y;
        leaf.rotation.y = leaf.userData.closedYaw + (side === sign ? sign * open * 1.15 : 0);
      }
      this.updateOccupants(id, record, alpha);
      record.brake.color.set('#ff2d2d').multiplyScalar(state.braking ? 4 : .15);
      for (let i = 0; i < record.sirens.length; i++) record.sirens[i].color.set(i === 0 ? '#ff2d2d' : '#2f6bff').multiplyScalar((Math.floor(this.world.tick / 30) % 2 === i) ? 4 : .1);
      record.door.position.y = .025 + body.def.suspension + body.def.wheelRadius + .15 - p.y;
      record.door.visible = this.world.vehicles!.active === null && car.entity.health.current > 0 && this.world.tick >= car.noEnterUntil;
      // E27 burned variant: an exploded car chars to soot once (shared paint copies, no new materials).
      if ((state.damage === 'exploded') !== record.charred) { record.charred = state.damage === 'exploded'; for (const m of record.paint) if ('char' in m) (m as unknown as { char: { value: number } }).char.value = record.charred ? .88 : 0; }
      record.smoke.visible = state.damage !== 'normal'; record.fire.visible = state.damage === 'burning' || state.damage === 'exploded';
      record.smoke.position.y = (this.world.tick % 60) / 120;
    }
    for (const item of this.world.vehicles!.obstacles.items) {
      if (productionObstacleAssets[item.entity.archetype]) continue;
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
  /** Hidden seated actors own occupants. Exits transfer their copy to a short door-opening transition. */
  private updateOccupants(id: number, record: Record, alpha: number): void {
    const car = this.world.vehicles!.cars.get(id)!, l2 = this.world.missions?.state.l2;
    const wanted: { actorId: number; seat: string; driver: boolean }[] = [];
    const transition = this.world.vehicles!.transition, elapsed = transition?.carId === id ? this.world.tick + alpha - 1 - transition.tick : carTransitionTicks;
    if (transition?.carId === id && transition.kind === 'exit' && elapsed < 12) wanted.push({ actorId: 1, seat: 'driverSeat', driver: true });
    if (car.entity.vehicle!.driver !== null) wanted.push({ actorId: car.entity.vehicle!.driver!, seat: 'driverSeat', driver: true });
    if (l2?.truckId === id) {
      if (l2.seated) wanted.push({ actorId: 1, seat: 'crewSeat0', driver: false });
      if (['alarm', 'ride', 'arrived'].includes(l2.phase)) for (const [i, actorId] of l2.crewIds.entries()) {
        if (this.world.entities.get(actorId)?.hidden) wanted.push({ actorId, seat: i === 0 ? 'driverSeat' : `crewSeat${i}`, driver: i === 0 });
      }
    }
    const ids = new Set(wanted.map(o => o.actorId));
    for (const occupant of this.occupants.values()) if ((occupant.parent === record.model || occupant.parent === record.parent) && !ids.has(occupant.actorId)) occupant.visible = false;
    for (const w of wanted) {
      const entity = this.world.entities.get(w.actorId); const boarding = transition?.carId === id && transition.kind === 'enter' && elapsed < 42;
      const leaving = transition?.carId === id && transition.kind === 'exit' && elapsed < 12;
      if (!entity || !entity.hidden && !leaving) continue;
      const asset = entity.survivor ? `char.courier-${entity.survivor.variant}` : entity.appearance?.asset ?? entity.civilian?.model ?? 'npc.firefighter-alive';
      const occupant = this.occupants.get(w.actorId);
      if (!occupant || occupant.asset !== asset) {
        if (!this.occupantLoads.has(w.actorId)) this.occupantLoads.set(w.actorId, VehicleOccupant.load(this.registry, w.actorId, asset, this.materials).then(copy => {
          if (this.disposed) { copy.dispose(); return; }
          this.occupants.get(w.actorId)?.dispose(); this.occupants.set(w.actorId, copy);
        }).finally(() => this.occupantLoads.delete(w.actorId)));
        if (occupant) occupant.visible = false; continue;
      }
      if (leaving && w.actorId === 1) {
        // Preserve the last seated pose while the door opens, with no seated actor left in the car.
        if (occupant.parent === record.model) record.parent.attach(occupant);
        occupant.visible = true; continue;
      }
      record.model.add(occupant); occupant.visible = !(w.actorId === 1 && boarding);
      let seat = record.model.getObjectByName(w.seat);
      if (!seat) {
        // Older fire-engine exports have only driverSeat. Keep the seven cab positions distinct until authored nodes load.
        const index = Number(w.seat.replace('crewSeat', ''));
        let fallback = this.occupantSeats.get(w.actorId);
        if (!fallback) { fallback = new Group(); this.occupantSeats.set(w.actorId, fallback); }
        fallback.position.set(index === 0 ? 3.2 : index <= 2 ? 2.25 : 1.4, 1.25, index === 0 ? .65 : index <= 2 ? (index === 1 ? -.65 : .65) : (index - 4) * .65);
        record.model.add(fallback); seat = fallback;
      }
      const wheel = w.driver ? record.model.getObjectByName('steeringWheel') : undefined;
      const target = w.driver ? new Vector3() : undefined;
      if (target) {
        if (wheel) record.model.worldToLocal(wheel.getWorldPosition(target));
        else { record.model.worldToLocal(seat.getWorldPosition(target)); const offsets: { [id: string]: [number, number] } = { 'vehicle.sedan': [.56,.29], 'vehicle.pickup': [.58,.39], 'vehicle.suv': [.34,.35], 'vehicle.police': [.45,.22], 'vehicle.ambulance': [.49,.33], 'vehicle.school-bus': [.5,.35], 'vehicle.fire-engine': [.5,.35] }; const [x,y] = offsets[car.physics.def.id]; target.x += x; target.y += y; }
      }
      const fit = car.physics.def.id === 'vehicle.police' ? .62 : car.physics.def.id === 'vehicle.fire-engine' ? .72 : car.physics.def.id === 'vehicle.pickup' && asset === 'char.courier-female' ? .95 : ['vehicle.sedan', 'vehicle.pickup', 'vehicle.suv'].includes(car.physics.def.id) ? .85 : 1;
      // The female rig has shorter arms; lean into the pickup's high steering column.
      occupant.pose(seat, target, fit, car.physics.def.id === 'vehicle.pickup' && asset === 'char.courier-female' ? -.65 : -.5);
    }
  }
  /** E25: the driven car's headlights/brake lights and emergency light bars, from the asset's authored anchors. */
  pushLights(field: LightField): void {
    for (const [id, car] of this.world.vehicles!.cars) {
      const record = this.records.get(id), driven = this.world.vehicles!.active === id;
      if (!record || car.entity.health.current <= 0 || !(driven || car.physics.def.emergency)) continue;
      record.model.updateWorldMatrix(true, false);
      for (const a of anchorsFor(car.physics.def.asset)) {
        const beacon = a.type === 'beacon' || !!a.strobe;
        if (!a.pool && !beacon || !driven && !beacon) continue;
        lampPosition.fromArray(a.position).applyMatrix4(record.model.matrixWorld); lampDirection.fromArray(a.direction).transformDirection(record.model.matrixWorld);
        const light = footprint({ ...a, position: lampPosition.toArray(), direction: lampDirection.toArray() }, this.world.districts?.groundHeight(lampPosition.x, lampPosition.z) ?? 0, id * 3.1);
        if (/brake/i.test(a.name) && !car.entity.vehicle!.braking) { light.r *= .3; light.g *= .3; light.b *= .3; }
        field.push(light);
      }
    }
  }
  feedback(event: VehicleFeedbackEvent, enabled: boolean): void {
    this.feedbackEvents.set(event.id, { ...event, position: { ...event.position } }); this.bloodEnabled = enabled;
    const record = this.records.get(event.id); if (!record) return;
    record.blood = event.blood; for (const material of record.paint) material.bloodCoverage.value = enabled ? event.blood : 0;
  }
  setBloodEnabled(enabled: boolean): void { this.bloodEnabled = enabled; for (const record of this.records.values()) for (const material of record.paint) material.bloodCoverage.value = enabled ? record.blood : 0; }
  async ready(): Promise<void> { await Promise.all([...this.pending.values(), ...this.occupantLoads.values()]); this.update(1); await Promise.all(this.occupantLoads.values()); this.update(1); }
  /** Drawn ground height (GameView: the district's baked roads and paving); null where it draws none. */
  ground: ((x: number, z: number) => number | null) | null = null;
  private readonly spot = new Vector3();
  private wheelSpot(node: Object3D): [number, number] { node.getWorldPosition(this.spot); return [this.spot.x, this.spot.z]; }
  /** Wheel nodes per vehicle entity (Scene Lab tyre-vs-ground probe). */
  wheelNodes(): Map<number, Object3D[]> { return new Map([...this.records].map(([id, r]) => [id, r.wheels.map(w => w.node)])); }
  snapshot() { return [...this.records].map(([id, r]) => ({ id, transitionCouriers: [...this.occupants.values()].filter(o => o.parent === r.parent && o.visible).map(o => ({ actorId: o.actorId, asset: o.asset, phase: 'exit', position: o.position.toArray() })), doors: ['doorL','doorR','door_near_0','door_near_1','door_far_0','door_far_1'].flatMap(name => { const node = r.model.getObjectByName(name); let meshes = 0; node?.traverse(child => { if (child instanceof Mesh) meshes++; }); return node ? [{ name, yaw: node.rotation.y, meshes }] : []; }), decay: r.decay ?? null, bloodCoverage: this.bloodEnabled ? r.blood : 0, windshieldBloodCoverage: this.bloodEnabled ? r.blood : 0, wheels: r.wheels.map(w => ({ spin: w.node.rotation.z, steer: w.node.rotation.y })), brake: r.brake.color.r, sirens: r.sirens.map(s => s.color.toArray()), placeholder: !!r.model.userData.placeholder, occupants: [...this.occupants.values()].filter(o => o.parent === r.model && o.visible).map(o => ({ actorId: o.actorId, asset: o.asset, seated: true, position: o.position.toArray(), handGapM: [...o.handGapM] })) })); }
  private releaseRecord(record: Record): void {
    for (const material of record.paint) material.dispose();
    record.door.geometry.dispose(); record.brake.dispose(); for (const material of record.sirens) material.dispose();
  }
  dispose(): void {
    this.disposed = true;
    const geometries = new Set<import('three').BufferGeometry>(), materials = new Set<MeshBasicNodeMaterial>();
    for (const r of this.records.values()) { for (const material of r.paint) material.dispose(); geometries.add(r.door.geometry); materials.add(r.brake); for (const s of r.sirens) materials.add(s); if (r.model.userData.placeholder) r.model.traverse(node => { if (node instanceof Mesh) { geometries.add(node.geometry); const m = node.material; if (!Array.isArray(m) && m instanceof MeshBasicNodeMaterial) materials.add(m); } }); }
    for (const g of geometries) g.dispose(); for (const m of materials) m.dispose();
    for (const occupant of this.occupants.values()) occupant.dispose(); this.occupants.clear(); this.occupantSeats.clear(); this.registry.dispose(); this.propGeometry.dispose(); this.puffGeometry.dispose(); this.smokeMaterial.dispose(); this.fireMaterial.dispose(); this.records.clear(); this.props.clear(); this.debris.length = 0; this.clear();
  }
}
