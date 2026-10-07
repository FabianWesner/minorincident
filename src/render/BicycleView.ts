import { BoxGeometry, Group, Mesh, MeshBasicNodeMaterial, TorusGeometry, type Object3D } from 'three/webgpu';
import { AssetRegistry } from '../assets/registry';
import manifest from '../assets/manifest.json';
import { atLeast, type AssetDef } from '../assets/types';
import type { SimWorld } from '../sim/world/SimWorld';
import type { Materials } from './Materials';

/** The delivered cargo bike is courier-sized (2.8 m); the game courier is chibi (1.4 m), so the bike is drawn at toy scale: saddle at the hips, cargo box below the rider's chest. */
const ASSET = 'veh.courier-bike', WHEEL_R = { F: .335, R: .405 }, SCALE = .6;
/**
 * The delivered model (assets/veh.courier-bike, packed to public/assets/models) carries the vehicle node contract
 * (wheelF/wheelR/handlebar/seat/basket) while the manifest still lists the richer pedal contract of a placeholder entry.
 * Until the manifest registration lands, validate against what the model really contains; a registered (integrated)
 * entry is used unchanged.
 */
function definitions(): AssetDef[] {
  return (manifest as AssetDef[]).map(d => d.id !== ASSET || atLeast(d.status, 'integrated') ? d : {
    ...d, status: 'integrated', lods: { lod1: d.glb.replace('.glb', '.lod1.glb'), lod2: d.glb.replace('.glb', '.lod2.glb') },
    dimensions: { x: 2.8, y: 1.2, z: .76, tolerance: .2 }, requiredNodes: ['root', 'wheelF', 'wheelR', 'handlebar', 'seat', 'basket'],
    animatedNodes: ['wheelF', 'wheelR', 'handlebar'], sockets: [],
  });
}
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
interface Rig { root: Group; model: Object3D; wheelF?: Object3D; wheelR?: Object3D; handlebar?: Object3D; crank?: Object3D; pedals: Object3D[]; lean: Group; offset: number; wheelAngle: number; last: { x: number; z: number } | null; leanAngle: number }
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
    super(); this.name = 'bicycle'; this.registry = new AssetRegistry(() => {}, { materials, manifest: definitions() });
  }
  async load(): Promise<void> { await this.build(); this.update(); }
  private async build(): Promise<void> {
    if (this.rig || this.loading) return; this.loading = true;
    let model = await this.registry.loadAsset(ASSET, 'lod0');
    // A missing or invalid GLB falls back to the registry's generic box: use the animated code placeholder instead.
    if (model.userData.placeholder || !model.getObjectByName('wheelF')) model = bicyclePlaceholder();
    this.loading = false; if (this.disposed) return;
    const lean = new Group(), root = new Group(); lean.add(model); root.add(lean); this.add(root);
    const find = (name: string) => model.getObjectByName(name);
    const wheelF = find('wheelF'), wheelR = find('wheelR'); for (const w of [wheelF, wheelR]) if (w) w.rotation.order = 'YXZ';
    model.scale.setScalar(SCALE); model.traverse(n => { if (n instanceof Mesh) { n.castShadow = true; n.receiveShadow = true; } });
    this.rig = { root, model, wheelF, wheelR, handlebar: find('handlebar'), crank: find('crank'), pedals: [find('pedalL'), find('pedalR')].filter((n): n is Object3D => !!n), lean, offset: 0, wheelAngle: 0, last: null, leanAngle: 0 };
  }
  update(): void {
    const bike = this.world.vehicles?.bicycle.entity;
    if (!bike?.bicycle) return;
    if (!this.rig) { void this.build(); return; }
    const rig = this.rig, b = bike.bicycle, t = bike.transform;
    rig.root.visible = true; rig.root.position.set(t.x, 0, t.z); rig.root.rotation.y = t.yaw;
    if (rig.last) { const d = Math.hypot(t.x - rig.last.x, t.z - rig.last.z); rig.wheelAngle += d; }
    rig.last = { x: t.x, z: t.z };
    if (rig.wheelF) { rig.wheelF.rotation.z = -rig.wheelAngle / (WHEEL_R.F * SCALE); rig.wheelF.rotation.y = b.steer * .4; }
    if (rig.wheelR) rig.wheelR.rotation.z = -rig.wheelAngle / (WHEEL_R.R * SCALE);
    if (rig.handlebar) rig.handlebar.rotation.y = b.steer * .5;
    if (rig.crank) { rig.crank.rotation.z = -b.pedal; for (const p of rig.pedals) p.rotation.z = b.pedal; }
    // Toy feel: lean into the turn and bob slightly with every pedal stroke while riding.
    const riding = b.mounted, speed = b.speed / 7.5;
    // The rider's capsule sits on the saddle (the model's seat is behind its centre): slide the model forward while riding.
    const seat = rig.model.getObjectByName('seat')?.position.x ?? -.58;
    rig.offset = lerp(rig.offset, riding ? -seat * SCALE : 0, .25); rig.lean.position.x = rig.offset;
    rig.leanAngle = lerp(rig.leanAngle, riding ? -b.steer * speed * .32 : 0, .2);
    rig.lean.rotation.x = rig.leanAngle; rig.lean.position.y = riding ? Math.abs(Math.sin(b.pedal * 2)) * .012 * speed : 0;
  }
  dispose(): void { this.disposed = true; this.clear(); this.rig = null; void this.registry.dispose(); }
}
