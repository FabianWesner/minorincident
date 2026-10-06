// Adapted from Bruno Simon InteractivePoints.js / RayCursor.js (MIT):
// highlighted active point above geometry, range-based reveal, separate presentation state.
import { BoxGeometry, CylinderGeometry, Group, Mesh, MeshBasicNodeMaterial, RingGeometry, SphereGeometry, Vector3, type Camera, type Object3D, type BufferGeometry, type Material } from 'three/webgpu';
import type { View } from './View';
import type { AssetQuality } from '../assets/types';
import { staticBatch } from '../assets/staticBatch';
import { AssetRegistry } from '../assets/registry';
import type { SimWorld } from '../sim/world/SimWorld';
import type { EntitySnapshot } from '../sim/world/types';
import type { Materials } from './Materials';
import './interaction.css';
const assetIds: Record<string, string> = {
  'hazard.propane': 'haz.propane-tank', 'hazard.barrel': 'haz.propane-tank', 'hazard.gas-can': 'haz.gas-can',
  'hazard.car-alarm': 'haz.car-alarm', 'hazard.fuse-box': 'haz.fuse-box', 'prop.fence': 'prop.picket-fence',
  'prop.barricade': 'prop.barricade', 'prop.cone': 'prop.traffic-cone', 'prop.trash-can': 'prop.trash-bin', 'prop.mailbox': 'prop.mailbox-blue',
  'pickup.medkit': 'pick.medkit', 'pickup.soda': 'pick.soda', 'pickup.energy-drink': 'pick.energy-drink', 'device.radio': 'util.radio',
};
/** Registry objects and a constant-contrast ring/DOM prompt. The sim never reads this view. */
export class InteractionView extends Group {
  private readonly registry: AssetRegistry;
  private readonly objects = new Map<number, Object3D>();
  private readonly lods = new Map<number, AssetQuality>();
  private readonly prototypes = new Map<string, Promise<Group>>();
  private readonly geometries = new Set<BufferGeometry>();
  private readonly batchMaterials = new Set<Material>();
  private readonly pending = new Map<number, Promise<void>>();
  private readonly box = new BoxGeometry(1, 1, 1);
  private readonly led = new SphereGeometry(.06, 8, 6);
  private readonly brush = new CylinderGeometry(.18, .18, 2.2, 8);
  private readonly foam = new MeshBasicNodeMaterial({ color: '#f4fbff', transparent: true, opacity: .28, depthWrite: false });
  private readonly black = new MeshBasicNodeMaterial({ color: '#151e30', depthTest: false, depthWrite: false, transparent: true });
  private readonly white = new MeshBasicNodeMaterial({ color: '#ffffff', depthTest: false, depthWrite: false, transparent: true });
  private readonly teal = new MeshBasicNodeMaterial({ color: '#58ffe0', depthTest: false, depthWrite: false, transparent: true });
  private readonly ring = new Group();
  private readonly fillGeometry = new RingGeometry(.87, .98, 64);
  private readonly fill = new Mesh(this.fillGeometry, this.teal);
  private readonly outlineGeometry = new RingGeometry(.84, 1.06, 64);
  private readonly strokeGeometry = new RingGeometry(.99, 1.02, 64);
  private readonly panel = document.createElement('div');
  private readonly label = document.createElement('strong');
  private readonly caption = document.createElement('span');
  private readonly meter = document.createElement('div');
  private readonly meterFill = document.createElement('div');
  private readonly projection = new Vector3();
  private readonly debrisMeshes: Mesh[] = [];
  private disposed = false;
  constructor(private readonly world: SimWorld, private readonly materials: Materials, private readonly view: View, private readonly low = false) {
    super(); this.registry = new AssetRegistry(() => {}, { materials: materials }); this.name = 'interactions';
    const outline = new Mesh(this.outlineGeometry, this.black), stroke = new Mesh(this.strokeGeometry, this.white);
    outline.renderOrder = 90; stroke.renderOrder = 91; this.fill.renderOrder = 92;
    this.ring.add(outline, stroke, this.fill); this.ring.rotation.x = -Math.PI / 2; this.add(this.ring);
    this.panel.className = 'interaction-prompt'; this.panel.dataset.testid = 'interaction-prompt'; this.panel.hidden = true;
    this.meter.className = 'interaction-meter'; this.meter.setAttribute('role', 'progressbar'); this.meter.setAttribute('aria-label', 'Interaction progress'); this.meter.setAttribute('aria-valuemin', '0'); this.meter.setAttribute('aria-valuemax', '100');
    this.meter.append(this.meterFill); this.panel.append(this.label, this.meter, this.caption); document.querySelector('#game')!.append(this.panel);
  }
  /** Asset readiness barrier used at load and screenshotReady, including dynamically spawned objects. */
  async synchronize(): Promise<void> {
    for (const e of this.world.entities.iterate()) {
      this.ensure(e);
    }
    await Promise.all(this.pending.values());
  }
  private ensure(e: EntitySnapshot): void {
    if (!(e.interactable || e.hazard || e.destructible || (e.pickup && 'kind' in e.pickup)) || this.pending.has(e.id)) return;
    const distance = Math.hypot(e.transform.x - this.view.cameraTarget.x, e.transform.z - this.view.cameraTarget.z);
    const lod = !this.assetId(e) ? 'lod0' : distance > 30 ? 'lod2' : this.low || distance > 12 ? 'lod1' : 'lod0';
    if (this.objects.has(e.id) && this.lods.get(e.id) === lod) return;
    const load = this.create(e, lod).then(object => {
      if (!this.disposed) {
        this.objects.get(e.id)?.removeFromParent(); this.objects.set(e.id, object); this.lods.set(e.id, lod);
        object.position.set(e.transform.x, 0, e.transform.z); object.rotation.y = e.transform.yaw; this.add(object);
      }
      this.pending.delete(e.id);
    });
    this.pending.set(e.id, load);
  }
  private assetId(e: EntitySnapshot): string | undefined {
    const pickup = e.pickup && 'kind' in e.pickup ? e.pickup : undefined;
    return pickup?.kind === 'item' && pickup.item?.startsWith('key.') ? 'util.keys' : pickup?.item === 'batteries' ? 'util.batteries' : assetIds[e.archetype];
  }
  /** L1 v2 toys: gameplay-shaped code art (hinged gate leaf, dumpster, car-alarm LED + beacons, car-wash foam curtain and brushes). */
  private toyObject(e: EntitySnapshot): Group {
    const g = new Group(), kind = e.toy?.kind ?? 'gate', box = (w: number, h: number, d: number, material: Material, x: number, y: number, z: number, parent: Object3D = g) => {
      const m = new Mesh(this.box, material); m.scale.set(w, h, d); m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; parent.add(m); return m;
    };
    if (kind === 'gate') {
      // Real model (hinged `gate` node, long axis Z) is attached by `attachGate`; this wrapper turns it onto the entity's wall axis.
      const wrap = new Group(); wrap.name = 'gateModel'; wrap.rotation.y = Math.PI / 2; g.add(wrap);
    } else if (kind === 'dumpster') {
      const rail = Math.abs((e.toy?.to.z ?? 0) - (e.toy?.from.z ?? 0)) > Math.abs((e.toy?.to.x ?? 0) - (e.toy?.from.x ?? 0));
      const body = new Group(); body.rotation.y = rail ? 0 : Math.PI / 2; g.add(body);
      box(2.2, 1.1, 1.2, this.materials.get('grass'), 0, .6, 0, body); box(2.3, .1, 1.3, this.materials.get('asphalt'), 0, 1.2, 0, body);
    } else if (kind === 'car-alarm') {
      const led = new Mesh(this.led, new MeshBasicNodeMaterial({ color: '#ff2020' })); led.name = 'led'; led.position.y = 1.05; g.add(led);
      for (const z of [-.7, .7]) { const b = new Mesh(this.led, new MeshBasicNodeMaterial({ color: '#ffb020' })); b.name = 'beacon'; b.scale.setScalar(2.6); b.position.set(0, 1.45, z); b.visible = false; g.add(b); }
    } else {
      const bay = this.world.toys?.bay ?? [], xs = bay.map(p => p.x), zs = bay.map(p => p.z), cx = (Math.min(...xs) + Math.max(...xs)) / 2, cz = (Math.min(...zs) + Math.max(...zs)) / 2;
      const wx = Math.max(...xs) - Math.min(...xs), wz = Math.max(...zs) - Math.min(...zs), foam = new Group(); foam.name = 'foam'; foam.position.set(cx - e.transform.x, 0, cz - e.transform.z); foam.visible = false; g.add(foam);
      box(wx, 2.6, wz, this.foam, 0, 1.3, 0, foam);
      for (const sx of [-1, 1]) { const brush = new Mesh(this.brush, this.materials.get('picketWhite')); brush.name = 'brush'; brush.position.set(sx * (wx / 2 - .4), 1.2, 0); foam.add(brush); }
      const sign = box(.5, .5, .5, this.materials.get('backpackTeal'), 0, .3, 0); sign.name = 'button';
    }
    return g;
  }
  /** Swaps the real yard-gate / car-wash models into a toy object once loaded (code art stays if a load fails). */
  private async attachModels(e: EntitySnapshot, object: Group): Promise<void> {
    const wrap = object.getObjectByName('gateModel');
    if (wrap) { const model = await this.registry.loadAsset('prop.yard-gate', this.low ? 'lod1' : 'lod0'); if (!this.disposed) wrap.add(model); return; }
    const foam = object.getObjectByName('foam');
    if (foam && e.toy?.kind === 'carwash') {
      // The real kit's curtain and brushes (kit frame at the bay centre): the layout's static kit stays the building.
      const kit = await this.registry.loadAsset('kit.car-wash', this.low ? 'lod1' : 'lod0'); if (this.disposed) return;
      const moved = new Group(); moved.name = 'kitParts';
      for (const name of ['curtain', 'brush_a', 'brush_b', 'brush_c']) { const n = kit.getObjectByName(name); if (n) { n.name = name.startsWith('brush') ? 'brush' : name; moved.add(n); } }
      for (const c of foam.children.filter(c => c.name === 'brush')) c.removeFromParent();
      foam.add(moved);
    }
  }
  private animateToy(e: EntitySnapshot, object: Object3D): void {
    const tick = this.world.tick;
    if (e.toy?.kind === 'car-alarm') {
      const active = tick < e.toy.until, led = object.getObjectByName('led')!;
      // Armed: slow dim blink. Alarming: fast bright blink and alternating roof beacons.
      led.visible = active ? tick % 12 < 6 : tick % 90 < 30; led.scale.setScalar(active ? 1.8 : 1);
      for (const b of object.children.filter(c => c.name === 'beacon')) b.visible = active && (tick % 16 < 8) === (b.position.z < 0);
      if (!e.interactable!.enabled && !active) led.visible = false;
    } else if (e.toy?.kind === 'carwash') {
      const foam = object.getObjectByName('foam')!, active = tick < e.toy.until; foam.visible = active;
      if (active) foam.traverse(c => { if (c.name === 'brush') c.rotation.y += .3; });
    } else if (!e.toy && e.interactable) {
      const hinge = object.getObjectByName('gate'); if (hinge) hinge.rotation.y += ((e.interactable.open ? -Math.PI / 2 : 0) - hinge.rotation.y) * .25;
    }
  }
  private async create(e: EntitySnapshot, lod: AssetQuality): Promise<Object3D> {
    if (e.toy || this.world.toys?.gateIds.includes(e.id)) { const object = this.toyObject(e); await this.attachModels(e, object); return object; }
    const pickup = e.pickup && 'kind' in e.pickup ? e.pickup : undefined, id = this.assetId(e);
    if (id) {
      const def = this.registry.definition(id), canonical = (lod === 'lod1' || lod === 'lod2') && !def.lods?.[lod] ? 'lod0' : lod;
    const key = `${id}:${canonical}`;
      if (!this.prototypes.has(key)) this.prototypes.set(key, this.registry.loadAsset(id, canonical).then(source => {
        if (this.disposed) return source as Group;
        const prototype = staticBatch(source, true, this.materials); prototype.userData = { ...source.userData };
        prototype.traverse(node => { if (node instanceof Mesh) { this.geometries.add(node.geometry); this.batchMaterials.add(node.material as Material); } });
        return prototype;
      }));
      return (await this.prototypes.get(key)!).clone(true);
    }
    // Devices without an integrated art entry use gameplay-shaped code placeholders.
    const g = new Group(), body = new Mesh(this.box, this.materials.get(pickup ? 'backpackTeal' : e.hazard?.kind === 'toxic' ? 'grass' : e.destructible ? 'woodWarm' : 'policeBlue'));
    if (pickup) body.scale.set(.3, .3, .3);
    else if (e.interactable?.kind === 'door' || e.interactable?.kind === 'gate' || e.interactable?.kind === 'car-door') body.scale.set(.9, 1.4, .15);
    else if (e.hazard && ['fire', 'water', 'toxic', 'live-wire', 'fuel-trail'].includes(e.hazard.kind)) body.scale.set(e.hazard.radius * 2, .03, e.hazard.radius * 2);
    else body.scale.set(.8, 1, .6);
    body.position.y = body.scale.y / 2; body.castShadow = true; body.receiveShadow = true; g.add(body); return g;
  }
  update(camera: Camera): void {
    let selected: EntitySnapshot | null = null, nearest = 64;
    const player = this.world.entities.get(1);
    for (const e of this.world.entities.iterate()) {
      this.ensure(e);
      const object = this.objects.get(e.id);
      if (object) {
        const pickup = e.pickup && 'kind' in e.pickup ? e.pickup : undefined;
        object.position.set(e.transform.x, 0, e.transform.z); object.rotation.y = e.transform.yaw;
        object.visible = !pickup?.collected && !e.destructible?.broken && !e.hazard?.exploded;
        if (e.interactable?.open && !this.world.toys?.gateIds.includes(e.id)) object.rotation.y += Math.PI / 2;
        this.animateToy(e, object);
      }
      if (player && e.interactable?.enabled && !e.interactable.completed) {
        const d = (e.transform.x - player.transform.x) ** 2 + (e.transform.z - player.transform.z) ** 2;
        if (d < nearest) { nearest = d; selected = e; }
      }
    }
    this.ring.visible = !!selected; this.panel.hidden = !selected;
    if (selected) {
      const c = selected.interactable!;
      this.ring.position.set(selected.transform.x, .05, selected.transform.z); this.ring.scale.setScalar(c.radius);
      this.fillGeometry.setDrawRange(0, Math.round(c.progress * 64) * 6);
      // Leave the survivor's head/torso clear when they stand just behind the device.
      this.projection.set(selected.transform.x, 2.8, selected.transform.z).project(camera);
      this.panel.style.left = `${(this.projection.x + 1) * innerWidth / 2}px`; this.panel.style.top = `${(1 - this.projection.y) * innerHeight / 2}px`;
      const label = c.label, caption = c.hint || (nearest <= c.radius ** 2 ? c.instant ? 'Stand here · E / middle-click' : 'Stand here to interact' : 'Move into the ring');
      if (this.label.textContent !== label) this.label.textContent = label;
      if (this.caption.textContent !== caption) this.caption.textContent = caption;
      this.panel.dataset.entityId = String(selected.id); this.panel.dataset.hint = c.hint;
      this.meter.setAttribute('aria-valuenow', String(Math.round(c.progress * 100 + 1e-8))); this.meterFill.style.transform = `scaleX(${c.progress})`;
    }
    const pieces = this.world.hazards?.debris.pieces ?? [];
    for (let i = 0; i < pieces.length; i++) {
      if (!this.debrisMeshes[i]) { const m = new Mesh(this.box, this.materials.get('woodWarm')); m.scale.set(.24, .2, .44); this.debrisMeshes.push(m); this.add(m); }
      const p = pieces[i], m = this.debrisMeshes[i]; m.visible = p.until > 0;
      if (m.visible && !p.body.isSleeping()) { const t = p.body.translation(), r = p.body.rotation(); m.position.set(t.x, t.y, t.z); m.quaternion.set(r.x, r.y, r.z, r.w); }
    }
  }
  dispose(): void {
    this.disposed = true; this.panel.remove(); this.clear(); this.objects.clear(); this.lods.clear();
    for (const geometry of this.geometries) geometry.dispose(); for (const material of this.batchMaterials) material.dispose();
    this.geometries.clear(); this.batchMaterials.clear(); this.prototypes.clear();
    this.box.dispose(); this.led.dispose(); this.brush.dispose(); this.foam.dispose(); this.fillGeometry.dispose(); this.outlineGeometry.dispose(); this.strokeGeometry.dispose(); this.black.dispose(); this.white.dispose(); this.teal.dispose();
    void this.registry.dispose();
  }
}
