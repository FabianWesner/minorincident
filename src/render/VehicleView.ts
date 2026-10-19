import { ApcDamage } from './apcDamage';
import { carDoorWeight, carTransitionTicks } from './characters/carTransition';
import { VehicleOccupant } from './characters/VehicleOccupant';
import { tyreSurface, updateTyreMatrices } from './TyreContact';
import { modelLod } from './lodPolicy';
import { SubjectOcclusion } from './SubjectOcclusion';
import { paletteTokens } from '../data/palette';
// Adapted from Bruno Simon folio-2025 VisualVehicle.js (MIT, 41046b5): wheel pivots/suspension and lamps.
import { Box3, BoxGeometry, Color, Group, Matrix4, Mesh, MeshBasicNodeMaterial, MeshLambertNodeMaterial, Quaternion, SphereGeometry, TorusGeometry, Vector3, type Object3D } from 'three/webgpu';
import { productionObstacleAssets } from './EntityAssets';
import { AssetRegistry } from '../assets/registry';
import { atLeast } from '../assets/types';
import { disposeTransportCab, openTransportCab, prepareTransportModel } from './transportModel';
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
import { lightPalette } from '../data/lights';
const lampPosition = new Vector3(), lampDirection = new Vector3(), beamColor = new Color();
interface Record { bounds: Box3; apc?: ApcDamage; doorHeldAt: number; decay?: string; lod: AssetQuality; parent: Group; model: Object3D; wheels: { node: Object3D; y: number; steer: number; spin: number; contacts: Vector3[]; contactPose: Matrix4; contactOffset: number; contactGround: VehicleView['ground'] }[]; brake: MeshBasicNodeMaterial; sirens: MeshBasicNodeMaterial[]; smoke: Group; fire: Mesh; door: Mesh; paint: (import('three').Material & { bloodCoverage: { value: number } })[]; blood: number; charred: boolean; feel: { tick: number; speed: number; accel: number; roll: number; pitch: number; restRoll: number; restPitch: number } }
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
  private readonly crashModels = new Map<string, { model: Object3D; paint: Record['paint'] }>();
  private readonly pending = new Map<number, Promise<void>>();
  constructor(private readonly world: SimWorld, private readonly materials: Materials, private readonly view: View, private readonly low = false) { super(); this.registry = new AssetRegistry(() => {}, { materials: materials }); this.fireMaterial.color.multiplyScalar(3); }
  /** Compile transport passenger rigs during level loading, before boarding can hitch. */
  async prewarmOccupants(): Promise<(() => void) | undefined> {
    const car = [...this.world.vehicles!.cars.values()].find(c => c.physics.def.transport);
    const record = car && this.records.get(car.entity.id);
    if (!record) return;
    const assets = new Set<string>([`char.courier-${this.world.entities.get(1)!.survivor!.variant}`]);
    for (const entity of this.world.entities.iterate()) if (entity.civilian && !entity.civilian.pet && entity.health.current > 0) assets.add(entity.appearance?.asset ?? entity.civilian.model ?? 'npc.firefighter-alive');
    const copies = await Promise.all([...assets].map((asset, i) => VehicleOccupant.load(this.registry, -i - 1, asset, this.materials)));
    const seat = record.model.getObjectByName('driverSeat')!;
    for (const copy of copies) { record.model.add(copy); copy.pose(seat); }
    let cleaned = false;
    return () => { if (cleaned) return; cleaned = true; for (const copy of copies) copy.dispose(); };
  }
  /** The mandatory L9 wreck is loaded and compiled before driving, through the existing registry. */
  async prewarmCrash(): Promise<(() => void) | undefined> {
    const id = this.world.missions?.l9?.state.carId, car = id === undefined ? undefined : this.world.vehicles!.cars.get(id);
    if (!car) return;
    const root = new Group(); root.position.copy(car.entity.transform);
    const def = car.physics.def;
    for (const lod of this.low ? ['lod1', 'lod2'] as const : ['lod0', 'lod1', 'lod2'] as const) {
      const model = await this.registry.loadAsset(def.asset, lod, 'wrecked');
      prepareTransportModel(model, def); this.crashModels.set(lod, { model, paint: this.paintModel(model) }); model.position.y = -(def.suspension + def.wheelRadius + .15); root.add(model);
    }
    this.add(root);
    return () => root.removeFromParent();
  }
  async load(): Promise<void> { for (const car of this.world.vehicles!.cars.values()) await this.addCar(car.entity.id); this.update(1); }
  private paintModel(model: Object3D): Record['paint'] {
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
    return paint;
  }
  private async addCar(id: number): Promise<void> {
    const car = this.world.vehicles!.cars.get(id)!, def = car.physics.def;
    const distance = Math.hypot(car.entity.transform.x - this.view.cameraTarget.x, car.entity.transform.z - this.view.cameraTarget.z);
    const lod = modelLod(distance, this.records.get(id)?.lod, this.low);
    const decay = car.entity.vehicle!.decay;
    const asset = def.asset, shell = decay ?? (def.bodyVariant && this.registry.definition(asset).decayVariants.includes(def.bodyVariant) ? def.bodyVariant : undefined);
    const prepared = decay === 'wrecked' && id === this.world.missions?.l9?.state.carId ? this.crashModels.get(lod) : undefined;
    if (prepared) this.crashModels.delete(lod);
    const model = prepared?.model ?? (atLeast(this.registry.definition(asset).status, 'integrated') ? await this.registry.loadAsset(asset, lod, shell) : vehiclePlaceholder(def, this.materials.get(def.emergency ? 'picketWhite' : def.id === 'vehicle.school-bus' ? 'schoolBusYellow' : 'survivorRed')));
    if (this.disposed) return;
    model.userData.assetId = def.asset; prepareTransportModel(model, def);
    const paint = prepared?.paint ?? this.paintModel(model);
    if (!decay) openTransportCab(model, def);
    const parent = new Group(); parent.add(model); this.add(parent); model.position.y = -(def.suspension + def.wheelRadius + .15);
    const wheels = ['wheelFL', 'wheelFR', 'wheelRL', 'wheelRR', ...(def.transport ? ['wheelML', 'wheelMR'] : [])].filter(name => model.getObjectByName(name)).map(name => { const node = model.getObjectByName(name)!; node.rotation.order = 'YXZ'; return { node, y: node.position.y, steer: node.rotation.y, spin: node.rotation.z, contacts: tyreSurface(node), contactPose: new Matrix4(), contactOffset: 0, contactGround: null }; });
    const lamp = (name: string, color: string) => {
      const material = new MeshBasicNodeMaterial({ color });
      const anchor = model.getObjectByName(name);
      // Authored broken lenses retain their dark palette material after a damage swap.
      if (!decay && !anchor?.userData.damagedLightOff) anchor?.traverse(child => { if (child instanceof Mesh) child.material = material; }); return material;
    };
    const brake = lamp('lightsBrake', '#ff2d2d'), sirens = def.emergency ? [lamp('sirenL', '#ff2d2d'), lamp('sirenR', '#2f6bff')] : [];
    // Only the chassis is a reveal subject/occluder: the hidden entry ring extends beyond its body.
    const bounds = new Box3().setFromObject(model);
    const door = new Mesh(new TorusGeometry(.7, .025, 6, 32), this.materials.get('windowGlow', 1.5)); door.rotation.x = -Math.PI / 2; door.position.set(.2, .025, def.width / 2 + .55); door.position.x = def.doorX; model.add(door);
    const smoke = new Group(); parent.add(smoke);
    for (let i = 0; i < 5; i++) { const mesh = new Mesh(this.puffGeometry, this.smokeMaterial); mesh.position.set(def.length * .3, 1 + i * .32, (i % 2 ? 1 : -1) * .12); mesh.scale.setScalar(1 + i * .25); smoke.add(mesh); }
    const fire = new Mesh(this.puffGeometry, this.fireMaterial); fire.position.set(def.length * .3, .9, 0); fire.scale.set(1.8, 2.8, 1.3); parent.add(fire);
    const apc = car.entity.vehicle!.floor && def.asset === 'veh.military-apc' ? new ApcDamage(model) : undefined;
    const previous = this.records.get(id); if (previous) { previous.parent.removeFromParent(); this.releaseRecord(previous); }
    this.records.set(id, { bounds, apc, doorHeldAt: -carTransitionTicks, decay, lod, parent, model, wheels, brake, sirens, smoke, fire, door, paint, blood: 0, charred: false, feel: { tick: this.world.tick, speed: car.entity.vehicle!.speed, accel: 0, roll: 0, pitch: 0, restRoll: model.rotation.x, restPitch: model.rotation.z } });
    const feedback = this.feedbackEvents.get(id); if (feedback) this.feedback(feedback, this.bloodEnabled);
  }
  update(alpha: number): void {
    for (const [id, car] of this.world.vehicles!.cars) {
      const record = this.records.get(id);
      const distance = Math.hypot(car.entity.transform.x - this.view.cameraTarget.x, car.entity.transform.z - this.view.cameraTarget.z);
      const lod = modelLod(distance, record?.lod, this.low);
      const decay = car.entity.vehicle!.decay;
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
      for (let i = 0; i < record.wheels.length; i++) {
        const index = i < 4 ? i : i - 2;
        const wheel = record.wheels[i], physics = body.wheels[index], previous = body.previousWheels[index];
        wheel.node.rotation.y = wheel.steer + lerp(previous.steer, physics.steer, alpha);
        wheel.node.rotation.z = wheel.spin + lerp(previous.rotation, physics.rotation, alpha);
        wheel.node.position.y = wheel.y + body.def.suspension - lerp(previous.suspension, physics.suspension, alpha);
      }
      // Rapier drives on the flat y = 0 plane while the district draws its roads 5 cm above it (and kerbs, paint, paving
      // higher): rest the car on the drawn ground, each wheel on its own spot.
      if (this.ground) {
        updateTyreMatrices(record.wheels);
        const heights = record.wheels.map(w => this.ground!(...this.wheelSpot(w.node)) ?? 0), mean = heights.reduce((a, b) => a + b, 0) / heights.length;
        record.parent.position.y += mean;
        for (let i = 0; i < record.wheels.length; i++) record.wheels[i].node.position.y += heights[i] - mean;
        // Tyre faces can meet a paving edge between mesh vertices, especially with steering and body lean.
        updateTyreMatrices(record.wheels);
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
            if (pass > 0) wheel.node.updateWorldMatrix(false, false);
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
      const driverElapsed = transition?.carId === id ? this.world.tick + alpha - 1 - transition.tick : carTransitionTicks;
      const passenger = state.passengers?.find(p => p.phase !== 'seated');
      const elapsed = driverElapsed < carTransitionTicks ? driverElapsed : passenger ? this.world.tick + alpha - 1 - passenger.started : carTransitionTicks;
      const side = driverElapsed < carTransitionTicks ? transition!.side : passenger?.side ?? transition?.side ?? 1, player = this.world.entities.get(1)!;
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
      record.apc?.update(state.stage ?? 0, this.world.tick + alpha, state.braking);
      // Night readability (specs/06 §6): the survivor's rim moves to the hull she drives; she is hidden inside it.
      const rim = this.world.vehicles!.active === id ? 1 : 0;
      for (const material of record.paint) if (material instanceof PaletteMaterial) material.figureRim.value = rim;
      record.brake.color.set('#ff2d2d').multiplyScalar(record.decay || record.apc && !record.apc.lightsOn ? 0 : state.braking ? 4 : .15);
      for (let i = 0; i < record.sirens.length; i++) record.sirens[i].color.set(i === 0 ? '#ff2d2d' : '#2f6bff').multiplyScalar(record.decay ? 0 : (Math.floor(this.world.tick / 30) % 2 === i) ? 4 : .1);
      record.door.position.y = .025 + body.def.suspension + body.def.wheelRadius + .15 - p.y;
      record.door.visible = !state.floor && this.world.vehicles!.active === null && car.entity.health.current > 0 && this.world.tick >= car.noEnterUntil;
      // E27 burned variant: an exploded car chars to soot once (shared paint copies, no new materials).
      if ((state.damage === 'exploded') !== record.charred) { record.charred = state.damage === 'exploded'; for (const m of record.paint) if ('char' in m) (m as unknown as { char: { value: number } }).char.value = record.charred ? .88 : 0; }
      record.smoke.visible = !state.floor && state.damage !== 'normal'; record.fire.visible = state.damage === 'burning' || state.damage === 'exploded';
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
    for (const [i, passenger] of (car.entity.vehicle!.passengers ?? []).slice(0, car.physics.def.transport?.seats.length ?? 0).entries()) {
      if (this.world.entities.get(passenger.id)?.companion) continue; // Retained in the closed troop bay.
      if (passenger.phase !== 'exit' || this.world.tick - passenger.started < 12) wanted.push({ actorId: passenger.id, seat: `passenger${passenger.seat ?? i}`, driver: false });
    }
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
      if (!entity) continue;
      const passenger = car.entity.vehicle!.passengers?.find(p => p.id === w.actorId);
      const passengerLeaving = passenger?.phase === 'exit' && this.world.tick - passenger.started < 12;
      const asset = entity.survivor ? `char.courier-${entity.survivor.variant}` : entity.escort?.child ? 'npc.brother' : entity.appearance?.asset ?? entity.civilian?.model ?? 'npc.firefighter-alive';
      const occupant = this.occupants.get(w.actorId);
      if (!occupant || occupant.asset !== asset) {
        if (!this.occupantLoads.has(w.actorId)) this.occupantLoads.set(w.actorId, VehicleOccupant.load(this.registry, w.actorId, asset, this.materials).then(copy => {
          if (this.disposed) { copy.dispose(); return; }
          this.occupants.get(w.actorId)?.dispose(); this.occupants.set(w.actorId, copy);
        }).finally(() => this.occupantLoads.delete(w.actorId)));
        if (occupant) occupant.visible = false; continue;
      }
      if (!entity.hidden && !leaving && !passengerLeaving) { occupant.visible = false; continue; }
      if (leaving && w.actorId === 1) {
        // Preserve the last seated pose while the door opens, with no seated actor left in the car.
        if (occupant.parent === record.model) record.parent.attach(occupant);
        occupant.visible = true; continue;
      }
      if (occupant.parent !== record.model) record.model.add(occupant); occupant.visible = !(w.actorId === 1 && boarding);
      let seat = record.model.getObjectByName(w.seat);
      if (!seat) {
        // Older fire-engine exports have only driverSeat. Keep the seven cab positions distinct until authored nodes load.
        const index = Number(w.seat.replace('crewSeat', ''));
        let fallback = this.occupantSeats.get(w.actorId);
        if (!fallback) { fallback = new Group(); this.occupantSeats.set(w.actorId, fallback); }
        fallback.position.set(index === 0 ? 3.2 : index <= 2 ? 2.25 : 1.4, 1.25, index === 0 ? .65 : index <= 2 ? (index === 1 ? -.65 : .65) : (index - 4) * .65);
        if (fallback.parent !== record.model) record.model.add(fallback); seat = fallback;
      }
      const wheel = w.driver ? record.model.getObjectByName('steeringWheel') : undefined;
      const target = w.driver ? new Vector3() : undefined;
      if (target) {
        if (wheel) record.model.worldToLocal(wheel.getWorldPosition(target));
        else { record.model.worldToLocal(seat.getWorldPosition(target)); const offsets: { [id: string]: [number, number] } = { 'vehicle.sedan': [.56,.29], 'vehicle.pickup': [.58,.39], 'vehicle.suv': [.34,.35], 'vehicle.police': [.45,.22], 'vehicle.ambulance': [.49,.33], 'vehicle.school-bus': [.5,.35], 'vehicle.fire-engine': [.5,.35] }; const [x,y] = offsets[car.physics.def.id] ?? [.5, .35]; target.x += x; target.y += y; }
      }
      const fit = car.physics.def.transport && w.driver ? .85 : car.physics.def.id === 'vehicle.police' ? .62 : car.physics.def.id === 'vehicle.fire-engine' ? .72 : car.physics.def.id === 'vehicle.pickup' && asset === 'char.courier-female' ? .95 : ['vehicle.sedan', 'vehicle.pickup', 'vehicle.suv'].includes(car.physics.def.id) ? .85 : 1;
      // The female rig has shorter arms; lean into the pickup's high steering column.
      occupant.pose(seat, target, fit, car.physics.def.id === 'vehicle.pickup' && asset === 'char.courier-female' ? -.65 : -.5);
    }
  }
  /** E25: the driven car's headlights/brake lights and emergency light bars, from the asset's authored anchors.
   * `aura` is the preset's survivor aura: while she drives, it becomes a soft pool around the hull. */
  pushLights(field: LightField, aura = 0, beam?: (position: Vector3, direction: Vector3, length: number, angleDeg: number, color: Color) => void): void {
    for (const [id, car] of this.world.vehicles!.cars) {
      const record = this.records.get(id), driven = this.world.vehicles!.active === id;
      if (record && driven && aura > 0) {
        const p = car.entity.transform, ground = this.world.districts?.groundHeight(p.x, p.z) ?? 0;
        field.push(footprint({ type: 'point', color: 'light_led_white', intensity: aura * 1.5, range: car.physics.def.length / 2 + 2.5, flicker: 'none', position: [p.x, ground + 2.4, p.z], direction: [0, -1, 0] }, ground));
      }
      if (!record || !this.lit(id)) continue;
      record.model.updateWorldMatrix(true, false);
      for (const a of anchorsFor(car.physics.def.asset)) {
        const beacon = a.type === 'beacon' || !!a.strobe;
        if (!a.pool && !beacon || !driven && !beacon) continue;
        // Authored level beams (APC, tank) threw a 20 m saturated wedge (QA L9-Q1): dip them like the other low beams (~7 degrees),
        // warm white at 60% so the two pools do not burn out the dry ground.
        const level = a.type === 'spot' && a.direction[1] > -.04;
        lampPosition.fromArray(a.position).applyMatrix4(record.model.matrixWorld);
        lampDirection.set(a.direction[0], level ? -.12 : a.direction[1], a.direction[2]).normalize().transformDirection(record.model.matrixWorld);
        const light = footprint({ ...a, ...(level ? { color: 'light_led_white' as const } : {}), position: lampPosition.toArray(), direction: lampDirection.toArray() }, this.world.districts?.groundHeight(lampPosition.x, lampPosition.z) ?? 0, id * 3.1);
        if (level) { light.r *= .6; light.g *= .6; light.b *= .6; }
        if (/brake/i.test(a.name) && !car.entity.vehicle!.braking) { light.r *= .3; light.g *= .3; light.b *= .3; }
        field.push(light);
        // E31 addendum: the driven hull's low beams also draw a soft visible cone (and its dust motes) in the night air.
        if (level && driven && beam) beam(lampPosition, lampDirection, Math.min(14, a.range * .6), Math.min(36, a.angle ?? 36), beamColor.set(lightPalette.light_led_white).multiplyScalar(a.intensity * .9));
      }
    }
  }
  /** Whether this vehicle's lamps shine now (driven or emergency, intact, powered); Scene Lab gates on it. */
  lit(id: number): boolean {
    const car = this.world.vehicles!.cars.get(id), record = this.records.get(id);
    if (!car || !record) return false;
    return !(record.apc && !record.apc.lightsOn || record.decay || car.entity.health.current <= 0 || record.model.getObjectByName('lightsFront')?.userData.damagedLightOff) && (this.world.vehicles!.active === id || car.physics.def.emergency);
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
  private wheelSpot(node: Object3D): [number, number] { this.spot.setFromMatrixPosition(node.matrixWorld); return [this.spot.x, this.spot.z]; }
  /** Wheel nodes per vehicle entity (Scene Lab tyre-vs-ground probe). */
  private playerVehicle(): number | undefined {
    const rescue = this.world.missions?.state.l2;
    return this.world.vehicles?.active ?? (rescue?.seated ? rescue.truckId : undefined);
  }
  /** Same-frame Scene Lab visibility probe; retain the player vehicle in the unobstructed reference. */
  probeVisibility(courier: boolean, environment: boolean): void {
    for (const [id, record] of this.records) record.parent.visible = !(this.playerVehicle() === id ? courier : environment);
  }
  private readonly occlusion = new SubjectOcclusion();
  private silhouette: { id: number; mode: 'normal' | 'full' | 'hidden'; shadows: Map<Mesh, boolean> } | undefined;
  /** Same-frame vehicle coverage probe. Disable its shadows in every pass so only body pixels differ. */
  silhouetteProbe(id: number, mode: 'normal' | 'full' | 'hidden' | 'restore'): boolean {
    const record = this.records.get(id);
    if (!record) throw new Error(`Vehicle silhouette probe: missing record ${id}`);
    const blocking = record.paint.some(material => material.userData.seeThrough === true);
    if (mode === 'restore') {
      for (const [mesh, cast] of this.silhouette?.shadows ?? []) mesh.castShadow = cast;
      record.parent.visible = true; this.silhouette = undefined;
    } else {
      if (!this.silhouette) {
        const shadows = new Map<Mesh, boolean>();
        record.model.traverse(node => { if (node instanceof Mesh) { shadows.set(node, node.castShadow); node.castShadow = false; } });
        this.silhouette = { id, mode, shadows };
      }
      this.silhouette.mode = mode;
    }
    return blocking;
  }
  /** Select cars after the camera and the complete reveal subject have their current frame poses. */
  updateReveal(subject?: Box3): void {
    if (subject) this.occlusion.setSubject(this.view.camera.position, subject);
    const ridden = this.playerVehicle();
    for (const [id, record] of this.records) {
      record.parent.updateWorldMatrix(true, false);
      const enabled = !!subject && id !== ridden && this.occlusion.blockedBy(record.bounds, record.parent.matrixWorld);
      for (const material of record.paint) if (material instanceof PaletteMaterial) material.seeThrough(enabled && !(this.silhouette?.id === id && this.silhouette.mode === 'full'));
      if (this.silhouette?.id === id) record.parent.visible = this.silhouette.mode !== 'hidden';
    }
  }
  /** Complete drawn chassis, including wheels, for the player's bounded reveal. */
  playerBounds(out: Box3): boolean {
    const record = this.records.get(this.playerVehicle() ?? -1);
    if (!record) return false;
    record.parent.updateWorldMatrix(true, false);
    out.copy(record.bounds).applyMatrix4(record.parent.matrixWorld); return !out.isEmpty();
  }
  wheelNodes(): Map<number, Object3D[]> { return new Map([...this.records].map(([id, r]) => [id, r.wheels.map(w => w.node)])); }
  snapshot() { return [...this.records].map(([id, r]) => ({ id, apcDamage: r.apc?.snapshot() ?? null, transitionCouriers: [...this.occupants.values()].filter(o => o.parent === r.parent && o.visible).map(o => ({ actorId: o.actorId, asset: o.asset, phase: 'exit', position: o.position.toArray() })), doors: ['doorL','doorR','door_near_0','door_near_1','door_far_0','door_far_1'].flatMap(name => { const node = r.model.getObjectByName(name); let meshes = 0; node?.traverse(child => { if (child instanceof Mesh) meshes++; }); return node ? [{ name, yaw: node.rotation.y, meshes }] : []; }), decay: r.decay ?? null, bloodCoverage: this.bloodEnabled ? r.blood : 0, windshieldBloodCoverage: this.bloodEnabled ? r.blood : 0, wheels: r.wheels.map(w => ({ spin: w.node.rotation.z, steer: w.node.rotation.y })), brake: r.brake.color.r, sirens: r.sirens.map(s => s.color.toArray()), placeholder: !!r.model.userData.placeholder, occupants: [...this.occupants.values()].filter(o => o.parent === r.model && o.visible).map(o => ({ actorId: o.actorId, asset: o.asset, seated: true, position: o.position.toArray(), handGapM: [...o.handGapM] })) })); }
  private releaseRecord(record: Record): void {
    record.apc?.dispose(); disposeTransportCab(record.model);
    for (const material of record.paint) material.dispose();
    record.door.geometry.dispose(); record.brake.dispose(); for (const material of record.sirens) material.dispose();
  }
  dispose(): void {
    this.disposed = true;
    for (const { model, paint } of this.crashModels.values()) { model.removeFromParent(); for (const material of paint) material.dispose(); } this.crashModels.clear();
    const geometries = new Set<import('three').BufferGeometry>(), materials = new Set<MeshBasicNodeMaterial>();
    for (const r of this.records.values()) { r.apc?.dispose(); disposeTransportCab(r.model); for (const material of r.paint) material.dispose(); geometries.add(r.door.geometry); materials.add(r.brake); for (const s of r.sirens) materials.add(s); if (r.model.userData.placeholder) r.model.traverse(node => { if (node instanceof Mesh) { geometries.add(node.geometry); const m = node.material; if (!Array.isArray(m) && m instanceof MeshBasicNodeMaterial) materials.add(m); } }); }
    for (const g of geometries) g.dispose(); for (const m of materials) m.dispose();
    for (const occupant of this.occupants.values()) occupant.dispose(); this.occupants.clear(); this.occupantSeats.clear(); this.registry.dispose(); this.propGeometry.dispose(); this.puffGeometry.dispose(); this.smokeMaterial.dispose(); this.fireMaterial.dispose(); this.records.clear(); this.props.clear(); this.debris.length = 0; this.clear();
  }
}
