import { Box3, BoxGeometry, Camera, Group, Mesh, MeshBasicNodeMaterial, OctahedronGeometry, TorusGeometry, Vector3, type Object3D } from 'three/webgpu';
import '../render/interaction.css';
import { AssetRegistry } from '../assets/registry';
import type { SimWorld } from '../sim/world/SimWorld';
import type { Materials } from './Materials';
import { RiderContacts } from './characters/RiderContacts';

/** The delivered cargo bike is courier-sized (2.8 m); the game courier is chibi (1.4 m), so the bike is drawn at toy scale: saddle at the hips, cargo box below the rider's chest. */
const ASSET = 'veh.courier-bike', WHEEL_R = { F: .335, R: .405 }, SCALE = .6;
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
interface Rig { root: Group; model: Object3D; wheelF?: Object3D; wheelR?: Object3D; handlebar?: Object3D; crank?: Object3D; pedals: Object3D[]; lean: Group; seat?: Object3D; kickstand?: Object3D; kick: number; parcel: Group; top: Vector3; glint: Mesh; placed: number; offset: number; wheelAngle: number; last: { x: number; z: number } | null; leanAngle: number }
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
    this.rig = { seat: find('seat') ?? find('driverSeat'), kickstand: find('kickstand'), kick: 0, parcel, top, glint, placed: 0, root, model, wheelF, wheelR, handlebar: find('handlebar'), crank: find('crank'), pedals: [find('pedalL') ?? find('pedal_l'), find('pedalR') ?? find('pedal_r')].filter((n): n is Object3D => !!n), lean, offset: -saddle.x, wheelAngle: 0, last: null, leanAngle: 0 };
  }
  /** World position of the saddle (the `seat` node); the rider's pelvis is placed here every frame. */
  seatWorld(out: Vector3): boolean {
    const rig = this.rig; if (!rig?.seat) return false;
    rig.root.updateMatrixWorld(true); rig.seat.getWorldPosition(out); return true;
  }
  private readonly contacts = new RiderContacts();
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
  private readonly prompt = document.createElement('div');
  private readonly projection = new Vector3();
  update(camera?: Camera): void {
    const bike = this.world.vehicles?.bicycle.entity;
    if (!bike?.bicycle) return;
    if (!this.rig) { void this.build(); return; }
    const rig = this.rig, b = bike.bicycle, t = bike.transform;
    rig.model.position.x = b.mounted ? rig.offset : 0;
    const ground = b.mounted ? (this.world.entities.get(1)?.transform.y ?? .705) - .705 : 0; // ride over curbs and steps with the rider
    rig.root.visible = true; rig.root.position.set(t.x, Math.max(0, ground), t.z); rig.root.rotation.y = t.yaw;
    if (rig.last) { const d = Math.hypot(t.x - rig.last.x, t.z - rig.last.z); rig.wheelAngle += d; }
    rig.last = { x: t.x, z: t.z };
    if (rig.wheelF) { rig.wheelF.rotation.z = -rig.wheelAngle / (WHEEL_R.F * SCALE); rig.wheelF.rotation.y = b.steer * .4; }
    if (rig.wheelR) rig.wheelR.rotation.z = -rig.wheelAngle / (WHEEL_R.R * SCALE);
    if (rig.handlebar) rig.handlebar.rotation.y = b.steer * .5;
    if (rig.crank) { rig.crank.rotation.z = -b.pedal; for (const p of rig.pedals) p.rotation.z = b.pedal; }
    // Toy feel: lean into the turn and bob slightly with every pedal stroke while riding.
    const riding = b.mounted, speed = b.speed / 7.5;
    // Kickstand folds up while riding and is down when parked (`kickstand` node of the rebuilt model; absent on the old one).
    rig.kick = riding ? lerp(rig.kick, 1, .2) : 0; if (rig.kickstand) rig.kickstand.rotation.z = rig.kick * Math.PI / 2;
    rig.leanAngle = lerp(rig.leanAngle, riding ? -b.steer * speed * .32 : 0, .2);
    rig.lean.rotation.x = rig.leanAngle; rig.lean.position.y = riding ? Math.abs(Math.sin(b.pedal * 2)) * .012 * speed : 0;
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
