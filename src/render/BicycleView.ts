import { Box3, BoxGeometry, Camera, Group, Matrix4, Mesh, MeshBasicNodeMaterial, OctahedronGeometry, Quaternion, TorusGeometry, Vector3, type BufferAttribute, type Object3D } from 'three/webgpu';
import '../render/interaction.css';
import { AssetRegistry } from '../assets/registry';
import type { SimWorld } from '../sim/world/SimWorld';
import type { Materials } from './Materials';
import { RiderContacts } from './characters/RiderContacts';
import { bicycleGeometry } from '../data/bicycleGeometry';
import { bicycleHandling } from '../data/vehicles';
import { l1v2 } from '../data/l1v2';

/** The delivered cargo bike is courier-sized (2.8 m); the game courier is chibi (1.4 m), so the bike is drawn at toy scale: saddle at the hips, cargo box below the rider's chest. */
const ASSET = 'veh.courier-bike', WHEEL_R = { F: .335, R: .405 }, SCALE = bicycleGeometry.scale;
const AXLE = new Vector3(0, 0, 1);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
/** Code placeholder with the animated-node contract (wheelF/R, handlebar, crank, pedals) until the production GLB is registered. */
function bicyclePlaceholder(): Group {
  const root = new Group(); root.name = 'root'; root.userData.placeholder = true;
  const mat = (color: string) => new MeshBasicNodeMaterial({ color });
  const orange = mat('#e8892b'), teal = mat('#27a6a0'), dark = mat('#22202a'), silver = mat('#b9c0c8');
  const part = (parent: Object3D, name: string, geometry: BoxGeometry | TorusGeometry, material: MeshBasicNodeMaterial, x: number, y: number, z: number) => {
    const m = new Mesh(geometry, material); m.name = name; m.position.set(x, y, z); parent.add(m); return m;
  };
  const group = (parent: Object3D, name: string, x: number, y: number, z: number) => { const g = new Group(); g.name = name; g.position.set(x, y, z); parent.add(g); return g; };
  part(root, 'frame', new BoxGeometry(1.5, .1, .1), orange, .05, .55, 0);
  part(root, 'basket', new BoxGeometry(.7, .4, .55), teal, .45, .6, 0);
  part(root, 'seat', new BoxGeometry(.3, .08, .18), dark, -.58, 1.12, 0);
  const handlebar = group(root, 'handlebar', 0, 1.17, 0); part(handlebar, 'bar', new BoxGeometry(.08, .06, .6), dark, 0, 0, 0);
  const wheel = (name: string, x: number, r: number) => {
    const w = group(root, name, x, r, 0); part(w, 'tire', new TorusGeometry(r - .03, .035, 8, 24), dark, 0, 0, 0);
    for (const a of [0, Math.PI / 2]) { const s = part(w, 'spoke', new BoxGeometry(2 * r - .08, .02, .02), silver, 0, 0, 0); s.rotation.z = a; }
    return w;
  };
  wheel('wheelF', 1.03, WHEEL_R.F); wheel('wheelR', -.94, WHEEL_R.R);
  const crank = group(root, 'crank', -.1, .3, 0); part(crank, 'arm', new BoxGeometry(.04, .34, .04), silver, 0, 0, 0);
  part(crank, 'pedalL', new BoxGeometry(.14, .03, .08), dark, 0, .17, .12); part(crank, 'pedalR', new BoxGeometry(.14, .03, .08), dark, 0, -.17, -.12);
  return root;
}
/** Tyre cross-section of a wheel at runtime scale: [radial, |axial|] points that can be lowest at some lean (16 axial bins). */
type Profile = [number, number][];
function tyreProfile(wheel: Object3D | undefined, scale: number): Profile {
  if (!wheel) return [];
  wheel.updateWorldMatrix(true, true);
  const inverse = new Matrix4().copy(wheel.matrixWorld).invert(), m = new Matrix4(), p = new Vector3(), bins = new Map<number, [number, number]>();
  wheel.traverse(n => {
    if (!(n instanceof Mesh)) return;
    m.multiplyMatrices(inverse, n.matrixWorld);
    const position = n.geometry.getAttribute('position') as BufferAttribute;
    for (let i = 0; i < position.count; i++) {
      p.fromBufferAttribute(position, i).applyMatrix4(m);
      const radial = Math.hypot(p.x, p.y) * scale, axial = Math.abs(p.z) * scale, bin = Math.round(axial * 400);
      const old = bins.get(bin); if (!old || radial > old[0]) bins.set(bin, [radial, axial]);
    }
  });
  return [...bins.values()];
}
/** Hub height above the lowest tyre point when the wheel plane is rolled by `lean`: the outer shoulder of a wide tyre dips below the tread. */
const hubAbove = (profile: Profile, fallback: number, lean: number) => {
  const c = Math.cos(lean), s = Math.abs(Math.sin(lean)); let best = fallback * c;
  for (const [radial, axial] of profile) best = Math.max(best, radial * c + axial * s);
  return best;
};
/** Half width of the tyre itself (outer 15 % of the radius; hub and axle stubs are wider but never touch the road). */
const tyreHalfWidth = (profile: Profile) => { const outer = Math.max(0, ...profile.map(([radial]) => radial)) * .85; return Math.max(0, ...profile.filter(([radial]) => radial > outer).map(([, axial]) => axial)); };
/** Tread ring of a wheel in its local (model) units: the profile's outer points at 9 axial stations, every 3 degrees over the lower half. */
function tyreRing(profile: Profile, scale: number): Vector3[] {
  const half = tyreHalfWidth(profile), tread = profile.filter(([radial]) => radial > Math.max(0, ...profile.map(([r]) => r)) * .85), out: Vector3[] = [];
  if (!tread.length) return out;
  for (const station of [-1, -.75, -.5, -.25, 0, .25, .5, .75, 1]) {
    const [radial, axial] = tread.reduce((best, p) => Math.abs(p[1] - Math.abs(station) * half) < Math.abs(best[1] - Math.abs(station) * half) ? p : best);
    for (let k = -30; k <= 30; k++) { const a = k * Math.PI / 60; out.push(new Vector3(Math.sin(a) * radial / scale, -Math.cos(a) * radial / scale, Math.sign(station) * axial / scale)); }
  }
  return out;
}
interface Rig { rings: [Vector3[], Vector3[]]; profiles: [Profile, Profile]; halfWidths: [number, number]; root: Group; model: Object3D; wheelF?: Object3D; wheelR?: Object3D; handlebar?: Object3D; crank?: Object3D; pedals: Object3D[]; lean: Group; seat?: Object3D; kickstand?: Object3D; kick: number; parcel: Group; top: Vector3; glint: Mesh; placed: number; offset: number; wheelAngle: number; last: { x: number; z: number } | null; leanAngle: number }
/**
 * Courier bicycle (spec 5.10). Follows the authoritative bicycle entity; wheels roll with the travelled distance, the crank
 * turns with the pedal phase, the handlebar and front wheel steer, and the frame leans into turns like a toy. Uses the
 * registered `veh.courier-bike` model when it is integrated, a contract-complete code placeholder before that.
 */
export class BicycleView extends Group {
  private readonly registry: AssetRegistry;
  private rig: Rig | null = null;
  private loading = false;
  private disposed = false;
  constructor(private readonly world: SimWorld, materials: Materials) {
    super(); this.name = 'bicycle';
    this.prompt.className = 'interaction-prompt'; this.prompt.dataset.testid = 'bike-prompt'; this.prompt.hidden = true; this.prompt.innerHTML = '<strong>Cargo bike</strong><span>Stand here or press E to ride</span>';
    document.querySelector('#game')?.append(this.prompt);
    this.registry = new AssetRegistry(() => {}, { materials });
  }
  async load(): Promise<void> { await this.build(); this.update(); }
  private async build(): Promise<void> {
    if (this.rig || this.loading) return; this.loading = true;
    let model = await this.registry.loadAsset(ASSET, 'lod0');
    // A missing or invalid GLB falls back to the registry's generic box: use the animated code placeholder instead.
    if (model.userData.placeholder || !(model.getObjectByName('wheel_front') ?? model.getObjectByName('wheelF'))) model = bicyclePlaceholder();
    this.loading = false; if (this.disposed) return;
    const lean = new Group(), root = new Group(); lean.add(model); root.add(lean); this.add(root);
    const find = (name: string) => model.getObjectByName(name);
    const wheelF = find('wheel_front') ?? find('wheelF'), wheelR = find('wheel_rear') ?? find('wheelR'); for (const w of [wheelF, wheelR]) if (w) w.rotation.order = 'YXZ';
    model.scale.setScalar(SCALE); model.traverse(n => { if (n instanceof Mesh) { n.castShadow = true; n.receiveShadow = true; } });
    // Courier parcel that rides on the cargo box lid while she carries it (dropped in when she mounts), and a glint above the parked bike.
    lean.updateMatrixWorld(true);
    const basket = find('cargo_box') ?? find('basket') ?? model, box = new Box3().setFromObject(basket), top = box.getCenter(new Vector3()); top.y = box.max.y;
    // The delivered tub carries no measurable mesh under the `basket` node: fall back to its authored position (lid top ~0.85 m in model units).
    if (!Number.isFinite(top.y)) top.set(.43 * SCALE, .85 * SCALE, 0);
    const lid = find('box_lid_top');
    if (lid) { lid.getWorldPosition(top); lean.worldToLocal(top); }
    const parcel = new Group(); parcel.visible = false;
    for (const [w, h, d, color, y] of [[.3, .24, .26, '#b98a55', .12], [.31, .045, .08, '#2aa198', .24]] as const) { const m = new Mesh(new BoxGeometry(w, h, d), new MeshBasicNodeMaterial({ color })); m.position.y = y; m.castShadow = true; parcel.add(m); }
    lean.add(parcel);
    const glint = new Mesh(new OctahedronGeometry(.22), new MeshBasicNodeMaterial({ color: '#58ffe0', depthTest: false, transparent: true, opacity: .9 })); glint.renderOrder = 80; root.add(glint);
    const seat = find('seat') ?? find('driverSeat'), saddle = new Vector3();
    if (seat) { seat.getWorldPosition(saddle); lean.worldToLocal(saddle); }
    const profiles: [Profile, Profile] = [tyreProfile(wheelR, SCALE), tyreProfile(wheelF, SCALE)];
    this.rig = { rings: [tyreRing(profiles[0], SCALE), tyreRing(profiles[1], SCALE)], profiles, halfWidths: [tyreHalfWidth(profiles[0]), tyreHalfWidth(profiles[1])], seat: find('seat') ?? find('driverSeat'), kickstand: find('kickstand'), kick: 0, parcel, top, glint, placed: 0, root, model, wheelF, wheelR, handlebar: find('handlebar'), crank: find('crank'), pedals: [find('pedalL') ?? find('pedal_l'), find('pedalR') ?? find('pedal_r')].filter((n): n is Object3D => !!n), lean, offset: -saddle.x, wheelAngle: 0, last: null, leanAngle: 0 };
  }
  /** Rear and front wheel nodes (tyre meshes below them): Scene Lab measures the drawn tyre against the drawn ground. */
  wheelNodes(): Object3D[] { return this.rig ? [this.rig.wheelR, this.rig.wheelF].filter((n): n is Object3D => !!n) : []; }
  /** World position of the saddle (the `seat` node); the rider's pelvis is placed here every frame. */
  seatWorld(out: Vector3): boolean {
    const rig = this.rig; if (!rig?.seat) return false;
    rig.root.updateMatrixWorld(true); rig.seat.getWorldPosition(out); return true;
  }
  private readonly contacts = new RiderContacts();
  frameOrientation(out: Quaternion): boolean {
    if (!this.rig) return false;
    this.rig.root.updateMatrixWorld(true); this.rig.lean.getWorldQuaternion(out); return true;
  }
  snapshot() {
    const rig = this.rig; if (!rig) return null;
    rig.root.updateMatrixWorld(true);
    const wheels = [rig.wheelR, rig.wheelF].map((wheel, i) => {
      const p = wheel?.getWorldPosition(new Vector3()); if (!p || !wheel) return null;
      // Lowest drawn tyre point: the axle's tilt is the wheel's roll; the tyre profile gives the dip of its shoulder.
      const axle = new Vector3(0, 0, 1).applyQuaternion(wheel.getWorldQuaternion(new Quaternion()));
      p.y -= hubAbove(rig.profiles[i], (i === 0 ? WHEEL_R.R : WHEEL_R.F) * SCALE, Math.asin(Math.min(1, Math.abs(axle.y)))); return p.toArray();
    });
    return { position: rig.root.position.toArray(), orientation: rig.lean.getWorldQuaternion(new Quaternion()).toArray(), seat: rig.seat?.getWorldPosition(new Vector3()).toArray() ?? null, wheels };
  }
  private riderNodes: { handL: Object3D; handR: Object3D; footL: Object3D; footR: Object3D } | undefined;
  /** Sample the model's named attachment nodes after its crank/steer/lean update.
   * No anatomy or saddle coordinates are duplicated in the rider. */
  riderContacts(): RiderContacts | undefined {
    const rig = this.rig; if (!rig) return;
    if (!this.riderNodes) {
      const left = rig.model.getObjectByName('grip_l'), right = rig.model.getObjectByName('grip_r');
      const pedalL = rig.model.getObjectByName('pedal_l'), pedalR = rig.model.getObjectByName('pedal_r');
      if (!left || !right || !pedalL || !pedalR) return;
      this.riderNodes = { handL: left, handR: right, footL: pedalL, footR: pedalR };
    }
    if (!rig.seat) return;
    rig.root.updateMatrixWorld(true);
    rig.seat.getWorldPosition(this.contacts.seat);
    for (const name of ['handL', 'handR', 'footL', 'footR'] as const) this.riderNodes[name].getWorldPosition(this.contacts[name]);
    rig.lean.getWorldQuaternion(this.contacts.orientation);
    return this.contacts;
  }
  /** Authored palm contact points follow the handlebar's steering and frame lean. */
  gripsWorld(left: Vector3, right: Vector3): boolean {
    const rig = this.rig, l = rig?.model.getObjectByName('grip_l'), r = rig?.model.getObjectByName('grip_r');
    if (!rig || !l || !r) return false;
    rig.root.updateMatrixWorld(true); l.getWorldPosition(left); r.getWorldPosition(right); return true;
  }
  /** Drawn ground height (GameView: the district's baked roads and paving); null where it draws none. */
  ground: ((x: number, z: number) => number | null) | null = null;
  private groundAt(x: number, z: number): number { return this.ground?.(x, z) ?? this.world.districts?.pavingHeight(x, z) ?? 0; }
  /** Where the bottom of a wheel of radius r rests with its hub above (x, z), rolling along (fx, fz): a circle on the drawn
   * ground, sampled along the wheel's centre line and both tyre shoulders, so it rolls up kerbs and over road paint instead
   * of stepping through them at the hub line. Leaned by `lean`, the raised shoulder clears the ground by side * sin(lean)
   * (the lowered one is covered by the frame lift). */
  private contact(x: number, z: number, fx: number, fz: number, r: number, half: number, lean: number): number {
    let hub = -Infinity;
    for (const side of [-half, 0, half]) for (let i = -12; i <= 12; i++) {
      const d = i / 12 * r * .95, raised = Math.max(0, side * Math.sin(lean));
      hub = Math.max(hub, this.groundAt(x + fx * d + fz * side, z + fz * d - fx * side) + Math.sqrt(r * r - d * d) - raised);
    }
    return hub - r;
  }
  private readonly ringPoint = new Vector3();
  /** Smallest height of a drawn tyre's tread above the drawn ground (null without tread points); the ring is taken before the wheel's spin, so it stays at the bottom. */
  private clearance(wheel: Object3D | undefined, ring: Vector3[]): number | null {
    if (!wheel || !ring.length) return null;
    let gap = Infinity;
    for (const local of ring) { const p = this.ringPoint.copy(local).applyAxisAngle(AXLE, -wheel.rotation.z).applyMatrix4(wheel.matrixWorld); gap = Math.min(gap, p.y - this.groundAt(p.x, p.z)); }
    return gap;
  }
  /** Crank, steer, lean and speed step once per sim tick: present them between the last two ticks at the render alpha
   * (unsampled ticks of a multi-tick frame reconstructed linearly, as in MotionPresentation). */
  private readonly rideTicks = { tick: -1, from: { pedal: 0, steer: 0, lean: 0, speed: 0 }, to: { pedal: 0, steer: 0, lean: 0, speed: 0 } };
  private readonly rideFrame = { pedal: 0, steer: 0, lean: 0, speed: 0 };
  private presentRide(b: { pedal: number; steer: number; lean?: number; speed: number }, alpha: number) {
    const s = this.rideTicks, tick = this.world.tick, now = { pedal: b.pedal, steer: b.steer, lean: b.lean ?? 0, speed: b.speed };
    if (s.tick < 0 || tick < s.tick || tick - s.tick > 10) { Object.assign(s.from, now); Object.assign(s.to, now); s.tick = tick; }
    else if (tick !== s.tick) {
      const k = (tick - s.tick - 1) / (tick - s.tick);
      for (const key of ['pedal', 'steer', 'lean', 'speed'] as const) s.from[key] = s.to[key] + (now[key] - s.to[key]) * k;
      Object.assign(s.to, now); s.tick = tick;
    }
    const a = Math.max(0, Math.min(1, alpha));
    for (const key of ['pedal', 'steer', 'lean', 'speed'] as const) this.rideFrame[key] = lerp(s.from[key], s.to[key], a);
    return this.rideFrame;
  }
  /** Crank phase and steer as presented this frame (the rider's pedalling clip follows the drawn crank). */
  get presentedRide(): { pedal: number; steer: number } | null { return this.rideTicks.tick < 0 ? null : this.rideFrame; }
  private readonly prompt = document.createElement('div');
  private readonly projection = new Vector3();
  private readonly presented = { x: 0, y: 0, z: 0, yaw: 0 };
  update(camera?: Camera, alpha = 1): void {
    const bike = this.world.vehicles?.bicycle.entity;
    if (!bike?.bicycle) return;
    if (!this.rig) { void this.build(); return; }
    // Ridden, the sim pins the bike onto the rider after physics: render it at the rider's interpolated transform.
    // The pin runs before the rider's post-physics sync, so `bike.transform` trails her by a tick: interpolate between the
    // rider's own last two ticks (as the courier and the camera do). Lerping previousPlayer -> bike.transform spanned ~0 m,
    // so bike and rider snapped per tick and juddered whenever frames ran 0/2 ticks (PO: flicker on the bike after a pause).
    const rig = this.rig, b = bike.bicycle, rider = this.world.entities.get(1)?.transform, from = b.mounted && rider ? this.world.previousPlayer : null, to = bike.transform;
    const t = from && rider ? Object.assign(this.presented, { x: lerp(from.x, rider.x, alpha), y: to.y, z: lerp(from.z, rider.z, alpha), yaw: from.yaw + Math.atan2(Math.sin(to.yaw - from.yaw), Math.cos(to.yaw - from.yaw)) * alpha }) : to;
    const ride = this.presentRide(b, alpha);
    rig.model.position.x = b.mounted ? rig.offset : 0;
    // Each wheel rests on the paving under its own contact point (kerbs, crosswalk slabs): the frame pitches between them.
    const districts = this.world.districts, fx = Math.cos(t.yaw), fz = -Math.sin(t.yaw);
    const xR = rig.model.position.x + bicycleGeometry.rearWheel, xF = rig.model.position.x + bicycleGeometry.frontWheel;
    // Heights are the drawn ground (asphalt tops out 5 cm above the layout's paving 0), not the sim plane.
    const drawn = !!districts || !!this.ground, rR = WHEEL_R.R * SCALE, rF = WHEEL_R.F * SCALE;
    const steering = ride.steer * bicycleHandling.maxSteering / (1 + ride.speed / l1v2.bicycle.speedMs), sx = Math.cos(t.yaw - steering), sz = -Math.sin(t.yaw - steering);
    const lean = b.mounted ? ride.lean : 0, [halfR, halfF] = rig.halfWidths;
    // Pitching the frame swings each hub along the heading by R * sin(pitch) (1.7 cm on a kerb): sample under the pitched hubs.
    // Hubs at ground + radius: (xF - xR) sin(p) + (rF - rR) cos(p) = gF - gR + rF - rR.
    const k = Math.hypot(xF - xR, rF - rR), solve = (rear: number, front: number) => Math.asin(Math.max(-1, Math.min(1, (front - rear + rF - rR) / k))) - Math.atan2(rF - rR, xF - xR);
    let gR = Math.max(0, t.y), gF = gR, pitch = 0;
    if (drawn) for (let pass = 0; pass < 2; pass++) {
      const c = Math.cos(pitch), s = Math.sin(pitch), hR = xR * c - rR * s, hF = xF * c - rF * s;
      gR = this.contact(t.x + fx * hR, t.z + fz * hR, fx, fz, rR, halfR, lean); gF = this.contact(t.x + fx * hF, t.z + fz * hF, sx, sz, rF, halfF, lean);
      pitch = solve(gR, gF);
    }
    rig.root.visible = true; rig.root.position.set(t.x, gR + rR - xR * Math.sin(pitch) - rR * Math.cos(pitch), t.z); rig.root.rotation.y = t.yaw;
    if (rig.last) { const d = Math.hypot(t.x - rig.last.x, t.z - rig.last.z); rig.wheelAngle += d; }
    rig.last = { x: t.x, z: t.z };
    if (rig.wheelF) { rig.wheelF.rotation.z = -rig.wheelAngle / (WHEEL_R.F * SCALE); rig.wheelF.rotation.y = -steering; }
    if (rig.wheelR) rig.wheelR.rotation.z = -rig.wheelAngle / (WHEEL_R.R * SCALE);
    if (rig.handlebar) rig.handlebar.rotation.y = -steering;
    if (rig.crank) { rig.crank.rotation.z = -ride.pedal; for (const p of rig.pedals) p.rotation.z = ride.pedal; }
    // Toy feel: lean into the turn while riding.
    const riding = b.mounted;
    // Kickstand folds up while riding and is down when parked (`kickstand` node of the rebuilt model; absent on the old one).
    rig.kick = riding ? lerp(rig.kick, 1, .2) : 0; if (rig.kickstand) rig.kickstand.rotation.z = rig.kick * Math.PI / 2;
    rig.leanAngle = riding ? ride.lean : 0;
    // Rolled about the tyre contact line, the wide tyre's shoulder dips below the road: lift the frame by that dip
    // (no pedal bob: the wheels stay on the ground and the rider's own ride clip carries the stroke).
    const lift = Math.max(hubAbove(rig.profiles[0], rR, rig.leanAngle) - rR * Math.cos(rig.leanAngle), hubAbove(rig.profiles[1], rF, rig.leanAngle) - rF * Math.cos(rig.leanAngle));
    rig.lean.rotation.x = rig.leanAngle; rig.lean.rotation.z = pitch; rig.lean.position.y = lift;
    // Settle on what is drawn: the posed tyres (steer, lean and pitch together) against the drawn ground under them
    // (a second pass absorbs the shift of the contacts that the re-pitch causes).
    if (drawn) for (let pass = 0; pass < 2; pass++) {
      rig.root.updateMatrixWorld(true);
      const cR = this.clearance(rig.wheelR, rig.rings[0]), cF = this.clearance(rig.wheelF, rig.rings[1]);
      if (cR === null || cF === null || Math.max(Math.abs(cR), Math.abs(cF)) < 5e-4) break;
      gR -= cR; gF -= cF; pitch = solve(gR, gF);
      rig.root.position.y = gR + rR - xR * Math.sin(pitch) - rR * Math.cos(pitch); rig.lean.rotation.z = pitch;
    }
    // Parcel in the cargo box: she carries it (sim `survivor.carrying`) and is riding; it drops in over ~0.35 s.
    const carrying = !!this.world.entities.get(1)?.survivor?.carrying;
    rig.placed = riding && carrying ? Math.min(1, rig.placed + 1 / 21) : 0;
    rig.parcel.visible = rig.placed > 0;
    if (rig.parcel.visible) { const k = rig.placed, e = 1 - (1 - k) ** 2; rig.parcel.position.set(rig.top.x + rig.model.position.x, rig.top.y + (1 - e) * .7, rig.top.z); rig.parcel.scale.setScalar(.6 + .4 * e); }
    // Parked bike: floating teal glint (readable from the start) and a ride prompt when close.
    const player = this.world.entities.get(1)?.transform, dist = player ? Math.hypot(player.x - t.x, player.z - t.z) : Infinity;
    rig.glint.visible = !riding && dist < 30; rig.glint.position.set(0, 1.5 + Math.sin(this.world.tick / 20) * .08, 0); rig.glint.rotation.y = this.world.tick / 25;
    const near = !riding && dist <= 1.6 && !!camera; this.prompt.hidden = !near;
    if (near && camera) { this.projection.set(t.x, 1.9, t.z).project(camera); this.prompt.style.left = `${(this.projection.x + 1) * innerWidth / 2}px`; this.prompt.style.top = `${(1 - this.projection.y) * innerHeight / 2}px`; }
  }
  dispose(): void {
    this.prompt.remove(); this.disposed = true;
    if (this.rig) {
      const roots = [this.rig.parcel, this.rig.glint, ...(this.rig.model.userData.placeholder ? [this.rig.model] : [])];
      const materials = new Set<MeshBasicNodeMaterial>();
      for (const root of roots) root.traverse(node => { if (node instanceof Mesh) { node.geometry.dispose(); for (const material of Array.isArray(node.material) ? node.material : [node.material]) materials.add(material as MeshBasicNodeMaterial); } });
      for (const material of materials) material.dispose();
    }
    this.clear(); this.rig = null; void this.registry.dispose();
  }
}
