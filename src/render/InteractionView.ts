// Adapted from Bruno Simon InteractivePoints.js / RayCursor.js (MIT):
// highlighted active point above geometry, range-based reveal, separate presentation state.
import { PaletteMaterial } from './PaletteMaterial';
import { modelLod } from './lodPolicy';
import { BoxGeometry, EdgesGeometry, LineBasicNodeMaterial, LineSegments, ConeGeometry, CylinderGeometry, Group, Mesh, MeshBasicNodeMaterial, PlaneGeometry, RingGeometry, SphereGeometry, Vector3, type Camera, type Object3D, type BufferGeometry, type Material } from 'three/webgpu';
import { uv, vec4 } from 'three/tsl';
import type { View } from './View';
import type { AssetQuality } from '../assets/types';
import { staticBatch } from '../assets/staticBatch';
import { AssetRegistry } from '../assets/registry';
import type { SimWorld } from '../sim/world/SimWorld';
import { isDoor } from '../sim/interact/Interactables';
import type { EntitySnapshot } from '../sim/world/types';
import type { Materials } from './Materials';
import './interaction.css';
import { l6, l6Doors, l6Entries } from '../data/l6';
const assetIds: Record<string, string> = {
  'hazard.propane': 'haz.propane-tank', 'hazard.barrel': 'haz.propane-tank', 'hazard.gas-can': 'haz.gas-can',
  'hazard.extinguisher': 'prop.fire-extinguisher',
  'hazard.car-alarm': 'haz.car-alarm', 'hazard.fuse-box': 'haz.fuse-box', 'prop.fence': 'prop.picket-fence',
  'prop.barricade': 'prop.barricade', 'prop.cone': 'prop.traffic-cone', 'prop.trash-can': 'prop.trash-bin', 'prop.mailbox': 'prop.mailbox-blue',
  'pickup.medkit': 'pick.medkit', 'pickup.soda': 'pick.soda', 'pickup.energy-drink': 'pick.energy-drink', 'device.radio': 'util.radio',
};
/** Ground rings are reserved for the currently active mission interaction. */
export function isMissionInteraction(world: SimWorld, entity: EntitySnapshot): boolean {
  const mission = world.missions;
  if (!mission || mission.state.phase !== 'playing') return false;
  if (entity.archetype === 'pickup.headlamp') return !!entity.pickup && 'collected' in entity.pickup && !entity.pickup.collected;
  return mission.def.steps.some(step => {
    const axeRack = step.id === 'axe' && step.complete.kind === 'interact' && step.complete.anchor === 'l2-axe-rack';
    if ((step.optional && !axeRack) || mission.state.steps[step.id]?.status !== 'active' || step.complete.kind !== 'interact') return false;
    const anchor = mission.def.anchors[step.complete.anchor];
    return !!anchor && Math.hypot(anchor.x - entity.transform.x, anchor.z - entity.transform.z) <= 0.75;
  });
}
/** Registry objects and a constant-contrast ring/DOM prompt. The sim never reads this view. */
export class InteractionView extends Group {
  private readonly registry: AssetRegistry;
  private readonly objects = new Map<number, Object3D>();
  private readonly occluderMaterials = new Map<number, PaletteMaterial[]>();
  private readonly lods = new Map<number, AssetQuality>();
  private readonly prototypes = new Map<string, Promise<Group>>();
  private readonly geometries = new Set<BufferGeometry>();
  private readonly batchMaterials = new Set<Material>();
  private readonly pending = new Map<number, Promise<void>>();
  private readonly box = new BoxGeometry(1, 1, 1);
  private readonly led = new SphereGeometry(.06, 8, 6);
  private readonly brush = new CylinderGeometry(.18, .18, 2.2, 8);
  private readonly gasGeometry = new PlaneGeometry(2, 2).rotateX(-Math.PI / 2);
  private readonly gasMaterial = new MeshBasicNodeMaterial({ transparent: true, depthWrite: false });
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
  private readonly coverage = document.createElement('div');
  private readonly coverageFill = document.createElement('div');
  private readonly projection = new Vector3();
  private readonly debrisMeshes: Mesh[] = [];
  private readonly entryHatches: { door: number; leaf: Group }[] = [];
  private readonly crateEdges = new EdgesGeometry(this.box);
  private readonly crateOutline = new LineBasicNodeMaterial({ color: '#58ffe0', transparent: true, opacity: .85, depthTest: false, depthWrite: false });
  private readonly crateGuides: { id: string; ring: Mesh; outline: LineSegments }[] = [];
  private readonly gateGuides: { x: number; line: Mesh }[] = [];
  private readonly arrowGeometry = new ConeGeometry(.18, .45, 4);
  private readonly crateArrow = new Mesh(this.arrowGeometry, this.teal);
  private disposed = false;
  constructor(private readonly world: SimWorld, private readonly materials: Materials, private readonly view: View, private readonly low = false) {
    super(); this.registry = new AssetRegistry(() => {}, { materials: materials }); this.name = 'interactions';
    this.gasMaterial.outputNode = vec4(.3, .55, .12, uv().sub(.5).mul(2).length().smoothstep(1, .3).mul(.18));
    const outline = new Mesh(this.outlineGeometry, this.black), stroke = new Mesh(this.strokeGeometry, this.white);
    outline.renderOrder = 90; stroke.renderOrder = 91; this.fill.renderOrder = 92;
    this.ring.add(outline, stroke, this.fill); this.ring.rotation.x = -Math.PI / 2; this.add(this.ring);
    if (world.scenario === 'L6') {
      for (const entry of l6Entries) {
        const source = l6Doors[entry.door], hatch = new Group(), leaf = new Group();
        hatch.name = `l6-entry-${entry.door}`; hatch.position.set(source.x, .6, source.z < 15 ? 11.65 : 18.35);
        const backing = new Mesh(this.box, this.materials.get('uiDark')); backing.scale.set(1.5, 1.9, .08); backing.position.y = .95; hatch.add(backing);
        for (const x of [-.7, .7]) { const frame = new Mesh(this.box, this.materials.get('policeBlue')); frame.scale.set(.12, 2, .12); frame.position.set(x, 1, 0); hatch.add(frame); }
        for (let i=0;i<5;i++) { const slat = new Mesh(this.box, this.materials.get('policeBlue')); slat.scale.set(1.3, .12, .14); slat.position.set(0, .25 + i * .35, 0); leaf.add(slat); }
        const signal = new Mesh(this.led, entry.door % 2 ? this.teal : this.white); signal.position.set(.6, 2.1, 0); hatch.add(signal, leaf);
        this.entryHatches.push({ door: entry.door, leaf }); this.add(hatch);
      }
      for (const prop of world.props?.items ?? []) if (prop.assetId === 'prop.crates' && l6.gates.some(x => Math.abs(prop.pose.p[0] - x) < 5)) {
        const ring = new Mesh(this.outlineGeometry, this.teal); ring.rotation.x = -Math.PI / 2; ring.renderOrder = 93; ring.visible = false;
        const outline = new LineSegments(this.crateEdges, this.crateOutline); outline.renderOrder = 93; outline.visible = false;
        ring.scale.setScalar(.65); this.crateGuides.push({ id: prop.id, ring, outline }); this.add(ring, outline);
      }
      for (const x of l6.gates) {
        const line = new Mesh(this.box, this.teal); line.scale.set(.12, .035, 2.2); line.position.set(x, .64, 15); line.visible = false;
        this.gateGuides.push({ x, line }); this.add(line);
      }
      this.crateArrow.rotation.z = Math.PI; this.crateArrow.renderOrder = 94; this.crateArrow.visible = false; this.add(this.crateArrow);
    }
    this.panel.className = 'interaction-prompt'; this.panel.dataset.testid = 'interaction-prompt'; this.panel.hidden = true;
    this.meter.className = 'interaction-meter'; this.meter.setAttribute('role', 'progressbar'); this.meter.setAttribute('aria-label', 'Interaction progress'); this.meter.setAttribute('aria-valuemin', '0'); this.meter.setAttribute('aria-valuemax', '100');
    this.coverage.className = 'interaction-meter'; this.coverage.hidden = true; this.coverage.setAttribute('role', 'meter'); this.coverage.setAttribute('aria-label', 'Slot coverage'); this.coverage.setAttribute('aria-valuemin', '0'); this.coverage.setAttribute('aria-valuemax', '100'); this.coverage.append(this.coverageFill);
    this.meter.append(this.meterFill); this.panel.append(this.label, this.coverage, this.meter, this.caption); document.querySelector('#game')!.append(this.panel);
  }
  /** Warm every service-gate detail tier before L6 begins; later swaps use the registry's cached prototypes. */
  async prewarmServiceGates(): Promise<() => void> {
    const lods: AssetQuality[] = this.low ? ['lod1', 'lod2'] : ['lod0', 'lod1', 'lod2'];
    const models = await Promise.all(lods.map(lod => this.registry.loadAsset('prop.service-gate', lod)));
    for (const model of models) { this.prepareGate(model); model.visible = false; this.add(model); }
    return () => { for (const model of models) model.removeFromParent(); };
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
    const lod = !this.assetId(e) ? 'lod0' : modelLod(distance, this.lods.get(e.id), this.low);
    if (this.objects.has(e.id) && this.lods.get(e.id) === lod) return;
    const load = this.create(e, lod).then(object => {
      if (!this.disposed) {
        // Moving gate leaves are loaded outside DistrictAssets' static occluder batches.
        // Give their palette materials the same bounded cut, without changing shared pickup/ground materials.
        if (this.world.toys?.gateIds.includes(e.id) || e.archetype === 'l6.service-gate' || e.interactable?.kind === 'gate' || e.interactable?.kind === 'door' || e.interactable?.kind === 'car-door' || e.archetype === 'prop.fence') {
          for (const material of this.occluderMaterials.get(e.id) ?? []) { material.dispose(); this.batchMaterials.delete(material); }
          const copies = new Map<PaletteMaterial, PaletteMaterial>();
          object.traverse(node => {
            if (!(node instanceof Mesh)) return;
            const cut = (material: Material) => {
              if (!(material instanceof PaletteMaterial)) return material;
              let copy = copies.get(material);
              if (!copy) { copy = material.frozenCopy().seeThrough(); copies.set(material, copy); this.batchMaterials.add(copy); }
              return copy;
            };
            node.material = Array.isArray(node.material) ? node.material.map(cut) : cut(node.material);
          });
          this.occluderMaterials.set(e.id, [...copies.values()]);
        }
        this.objects.get(e.id)?.removeFromParent(); this.objects.set(e.id, object); this.lods.set(e.id, lod);
        object.position.set(e.transform.x, e.archetype==='l6.service-gate'?e.transform.y:e.pickup&&'kind' in e.pickup?e.transform.y-.3:0, e.transform.z); object.rotation.y = e.transform.yaw;
        if(e.archetype==='l6.service-gate'){const leaf=object.getObjectByName('gate');if(leaf)leaf.rotation.y=e.barricade?.intact?0:-Math.PI/2;} this.add(object);
      }
      this.pending.delete(e.id);
    });
    this.pending.set(e.id, load);
  }
  private assetId(e: EntitySnapshot): string | undefined {
    const pickup = e.pickup && 'kind' in e.pickup ? e.pickup : undefined;
    return e.archetype === 'pickup.headlamp' ? 'acc.headlamp' : e.barricade?.slot.sandbag ? 'prop.sandbag-pallet' : e.archetype === 'l6.service-gate' ? 'prop.service-gate' : pickup?.kind === 'item' && pickup.item?.startsWith('key.') ? 'util.keys' : pickup?.item === 'batteries' ? 'util.batteries' : assetIds[e.archetype];
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
      // Clear on-car highlight while the player stands in range of an armed car: big steady LED and amber roof lights.
      const p = this.world.entities.get(1)?.transform, near = !!p && !active && e.interactable!.enabled && (p.x - e.transform.x) ** 2 + (p.z - e.transform.z) ** 2 <= e.interactable!.radius ** 2;
      if (near) { led.visible = true; led.scale.setScalar(4 + Math.sin(tick / 6)); for (const b of object.children.filter(c => c.name === 'beacon')) b.visible = true; }
    } else if (e.toy?.kind === 'carwash') {
      const foam = object.getObjectByName('foam')!, active = tick < e.toy.until; foam.visible = active;
      if (active) foam.traverse(c => { if (c.name === 'brush') c.rotation.y += .3; });
    } else if (!e.toy && e.interactable && e.archetype!=='l6.service-gate') {
      const hinge = object.getObjectByName('gate'); if (hinge) hinge.rotation.y += ((e.interactable.open ? -Math.PI / 2 : 0) - hinge.rotation.y) * .25;
    }
  }
  private async create(e: EntitySnapshot, lod: AssetQuality): Promise<Object3D> {
    if (e.archetype === 'l6.service-gate') { const model = await this.registry.loadAsset('prop.service-gate', lod); this.prepareGate(model); return model; }
    if (e.barricade) {
      const object = this.barricadeObject(e);
      if (e.barricade.slot.sandbag) {
        const brace = object.getObjectByName('slot-brace')!;
        const crack = brace.getObjectByName('slot-crack')!; brace.clear(); brace.add(crack);
        const model = await this.registry.loadAsset('prop.sandbag-pallet', lod), slot = e.barricade.slot;
        const width = Math.hypot(slot.b.x - slot.a.x, slot.b.z - slot.a.z), count = Math.ceil(width / 1.4);
        for (let i = 0; i < count; i++) { const pallet = model.clone(true); pallet.scale.x *= width / count / 1.4; pallet.position.x = -width / 2 + (i + .5) * width / count; brace.add(pallet); }
      }
      return object;
    }
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
    // E27 draws fire hazards (flame cards, light pools, smoke): no placeholder slab.
    if (e.hazard?.kind === 'fire' || e.hazard?.kind === 'tear-gas') return new Group();
    if (e.hazard?.kind === 'toxic') {
      const g = new Group(), patch = new Mesh(this.gasGeometry, this.gasMaterial);
      patch.scale.set(e.hazard.radius, 1, e.hazard.radius); patch.position.y = .02; g.add(patch); return g;
    }
    // Devices without an integrated art entry use gameplay-shaped code placeholders.
    const g = new Group(), body = new Mesh(this.box, this.materials.get(pickup ? 'backpackTeal' : e.destructible ? 'woodWarm' : 'policeBlue'));
    if (pickup) body.scale.set(.3, .3, .3);
    else if (e.interactable?.kind === 'door' || e.interactable?.kind === 'gate' || e.interactable?.kind === 'car-door') body.scale.set(.9, 1.4, .15);
    else if (e.hazard && ['fire', 'water', 'toxic', 'live-wire', 'fuel-trail'].includes(e.hazard.kind)) body.scale.set(e.hazard.radius * 2, .03, e.hazard.radius * 2);
    else body.scale.set(.8, 1, .6);
    body.position.y = body.scale.y / 2; body.castShadow = true; body.receiveShadow = true; g.add(body); return g;
  }
  private barricadeObject(e: EntitySnapshot): Group {
    const s = e.barricade!.slot, g = new Group(), width = Math.hypot(s.b.x - s.a.x, s.b.z - s.a.z);
    g.rotation.y = -Math.atan2(s.b.z - s.a.z, s.b.x - s.a.x);
    const ghost = new Group(); ghost.name = 'slot-ghost';
    for (let x = -width / 2; x < width / 2; x += .35) for (const y of [.06, s.height]) {
      const dash = new Mesh(this.box, this.white); dash.scale.set(Math.min(.2, width / 2 - x), .035, .04); dash.position.set(x + dash.scale.x / 2, y, 0); ghost.add(dash);
      for (const side of [-1, 1]) { const edge = dash.clone(); edge.position.z = side * ((s.depth ?? .7) / 2 + .15); ghost.add(edge); }
    }
    const brace = new Group(); brace.name = 'slot-brace';
    for (const y of [s.height * .3, s.height * .75]) {
      const plank = new Mesh(this.box, this.materials.get('woodWarm')); plank.scale.set(width, .16, .12); plank.position.set(0, y, (s.depth ?? .7) / 2 + .12); plank.castShadow = true; brace.add(plank);
    }
    const crack = new Mesh(this.box, this.materials.get('uiDark')); crack.name = 'slot-crack'; crack.scale.set(.04, s.height * .75, .14); crack.position.set(0, s.height / 2, (s.depth ?? .7) / 2 + .2); crack.rotation.z = .35; brace.add(crack);
    if (s.boardUp) for (let row = 0; row < 4; row++) { const plank = new Mesh(this.box, this.materials.get('woodWarm')); plank.scale.set(1, .08, .3); plank.position.set(width / 2 + .7, .05 + row * .08, .2); g.add(plank); }
    g.add(ghost, brace); return g;
  }
  /** Scene Lab probe: ground pickups as drawn (object origin = the base of the model). */
  drawnPickups(): { id: number; kind: string; x: number; y: number; z: number }[] {
    const out: { id: number; kind: string; x: number; y: number; z: number }[] = [];
    for (const [id, o] of this.objects) { const p = this.world.entities.get(id)?.pickup; if (p && 'kind' in p && !p.collected && o.visible) out.push({ id, kind: p.kind, x: o.position.x, y: o.position.y, z: o.position.z }); }
    return out;
  }
  private prepareGate(model: Object3D): void {
    model.traverse(node => { if (node instanceof Mesh) for (const material of Array.isArray(node.material) ? node.material : [node.material]) if (material instanceof PaletteMaterial) material.seeThrough(); });
  }
  private updateGateGuides(): void {
    const player = this.world.entities.get(1), state = this.world.missions?.state.l6;
    let next: import('../sim/interact/PropSystem').PushProp | undefined, nearest = Infinity;
    for (const guide of this.crateGuides) {
      const prop = this.world.props?.items.find(p => p.id === guide.id);
      const gate = prop && state?.gates.find(g => Math.abs(g.x - prop.home.p[0]) < 5);
      const distance = prop && player ? Math.hypot(player.transform.x - prop.pose.p[0], player.transform.z - prop.pose.p[2]) : Infinity;
      guide.ring.visible = !!prop && !!gate && !prop.braced && distance < 9;
      guide.outline.visible = guide.ring.visible;
      if (prop && guide.ring.visible) {
        guide.outline.position.set(prop.pose.p[0] + prop.center[0], prop.pose.p[1] + prop.center[1], prop.pose.p[2] + prop.center[2]);
        guide.outline.quaternion.set(...prop.pose.q); guide.outline.scale.set(prop.half[0] * 2 + .08, prop.half[1] * 2 + .08, prop.half[2] * 2 + .08); guide.ring.position.set(prop.pose.p[0], prop.pose.p[1] + .05, prop.pose.p[2]); if (distance < nearest) { nearest = distance; next = prop; } }
    }
    for (const guide of this.gateGuides) guide.line.visible = !!player && Math.abs(player.transform.x - guide.x) < 9 && !!state?.gates.find(g => g.x === guide.x);
    this.crateArrow.visible = !!next;
    if (next) this.crateArrow.position.set(next.pose.p[0], next.pose.p[1] + 1.8 + Math.sin(this.world.tick / 15) * .1, next.pose.p[2]);
  }
  update(camera: Camera): void {
    this.updateGateGuides();
    for(const hatch of this.entryHatches){const state=this.world.missions?.state.l6?.entries?.find(e=>e.door===hatch.door);const age=state?.warnedAt?this.world.tick-state.warnedAt:-1;hatch.leaf.rotation.x=age<0?0:age<120?Math.sin(age*.65)*.045:-1.2;}
    let selected: EntitySnapshot | null = null, nearest = 64, ringTarget: EntitySnapshot | null = null, ringDistance = 64;
    const player = this.world.entities.get(1);
    for (const e of this.world.entities.iterate()) {
      this.ensure(e);
      const object = this.objects.get(e.id);
      if (object) {
        const pickup = e.pickup && 'kind' in e.pickup ? e.pickup : undefined;
        object.position.set(e.transform.x, e.archetype==='l6.service-gate'?e.transform.y:pickup?e.transform.y-.3:0, e.transform.z); object.rotation.y = e.transform.yaw;
        if(e.archetype==='l6.service-gate'){const leaf=object.getObjectByName('gate');if(leaf)leaf.rotation.y=e.barricade?.intact?0:-Math.PI/2;}
        object.visible = !pickup?.collected && !e.destructible?.broken && !e.hazard?.exploded;
        if (e.hazard?.kind === 'toxic') object.visible &&= this.world.tick < e.hazard.activeUntil;
        if (e.interactable?.open && !this.world.toys?.gateIds.includes(e.id)) object.rotation.y += Math.PI / 2;
        this.animateToy(e, object);
        if (e.barricade && e.archetype!=='l6.service-gate') {
          const b = e.barricade, s = b.slot;
          object.rotation.y = -Math.atan2(s.b.z - s.a.z, s.b.x - s.a.x);
          object.getObjectByName('slot-ghost')!.visible = !b.intact && this.world.barricades!.playerBuildable(e) && !!player && Math.hypot(player.transform.x - e.transform.x, player.transform.z - e.transform.z) <= 8;
          object.getObjectByName('slot-brace')!.visible = b.intact;
          object.getObjectByName('slot-crack')!.visible = b.intact && e.health.current < e.health.max * .7;
          const age = this.world.tick - b.hitTick;
          if (b.intact && age < 12) object.position.x += Math.sin(age * 2) * .045 * (1 - age / 12);
        }
      }
      if (player && e.interactable && (!e.barricade || this.world.barricades!.playerBuildable(e)) && (e.interactable.enabled || e.archetype === 'l6.service-gate' || e.barricade && !e.barricade.intact) && (!e.interactable.completed || e.interactable.instant && isDoor(e.interactable.kind))) {
        const d = (e.transform.x - player.transform.x) ** 2 + (e.transform.z - player.transform.z) ** 2;
        if (d < nearest) { nearest = d; selected = e; }
        if (d < ringDistance && isMissionInteraction(this.world, e)) { ringDistance = d; ringTarget = e; }
      }
    }
    const inRange = !!selected && !!player && Math.hypot(selected.transform.x - player.transform.x, selected.transform.z - player.transform.z) <= selected.interactable!.radius;
    this.ring.visible = !!ringTarget;
    this.panel.hidden = !inRange;
    if (ringTarget) {
      const c = ringTarget.interactable!;
      this.ring.position.set(ringTarget.transform.x, (this.world.districts?.pavingHeight(ringTarget.transform.x, ringTarget.transform.z) ?? 0) + .05, ringTarget.transform.z); this.ring.scale.setScalar(c.radius);
      this.fillGeometry.setDrawRange(0, Math.round(c.progress * 64) * 6);
    }
    if (selected && inRange) {
      const c = selected.interactable!;
      // Leave the survivor's head/torso clear when they stand just behind the device.
      this.projection.set(selected.transform.x, 2.8, selected.transform.z).project(camera);
      const b = selected.barricade;
      const service = selected.archetype === 'l6.service-gate';
      const label = service ? 'Block the tunnel' : b && !b.intact ? `${c.label} · ${Math.round(b.coverage * 100)}% coverage` : c.label;
      const gate = this.world.missions?.state.l6?.gates.find(g => g.id === selected.id);
      const purpose = service ? gate?.closedAt ? (b?.props.length ?? 0) >= 2 ? 'Tunnel blocked · keep moving' : 'Push glowing crates onto the line · E to brace' : 'Let everyone pass · E to close the gate' : !b ? null : b.intact ? 'Repair the barricade: stand here to reinforce it' : b.slot.boardUp ? 'Seal this opening: stand here to board it up' : c.enabled ? 'Barricade the gap: press E / middle-click to brace the crates' : 'Barricade the gap: push crates into the marked line · 80% needed';
      const caption = (service ? purpose : c.hint) || purpose || (c.completed && isDoor(c.kind) ? `E / middle-click to ${c.open ? 'close' : 'open'}` : nearest <= c.radius ** 2 ? c.instant ? 'Stand here · E / middle-click' : 'Stand here to interact' : 'Move into the ring');
      if (this.label.textContent !== label) this.label.textContent = label;
      if (this.caption.textContent !== caption) this.caption.textContent = caption;
      this.panel.dataset.entityId = String(selected.id); this.panel.dataset.hint = c.hint;
      this.coverage.hidden = service || !selected.barricade || selected.barricade.intact;
      this.meter.hidden = false;
      if (!this.coverage.hidden) { const coverage = selected.barricade!.coverage; this.coverage.setAttribute('aria-valuenow', String(Math.round(coverage * 100))); this.coverageFill.style.transform = `scaleX(${coverage})`; }
      const progress = service ? gate?.closedAt ? Math.min(1, (b?.props.length ?? 0) / 2) : (gate?.hold ?? 0) / 60 : c.progress;
      this.meter.setAttribute('aria-valuenow', String(Math.round(progress * 100))); this.meterFill.style.transform = `scaleX(${progress})`;
      // Content and visibility determine the final size (coverage, repair and gate
      // captions wrap differently). Clamp the translated panel, not its anchor.
      const viewport = window.visualViewport;
      this.panel.style.maxWidth = `${(viewport?.width ?? innerWidth) - 16}px`;
      this.panel.style.maxHeight = `${(viewport?.height ?? innerHeight) - 16}px`;
      const { width, height } = this.panel.getBoundingClientRect();
      const left = viewport?.offsetLeft ?? 0, top = viewport?.offsetTop ?? 0;
      const right = left + (viewport?.width ?? innerWidth), bottom = top + (viewport?.height ?? innerHeight);
      const x = (this.projection.x + 1) * innerWidth / 2, y = (1 - this.projection.y) * innerHeight / 2;
      this.panel.style.left = `${Math.max(left + 8 + width / 2, Math.min(right - 8 - width / 2, x))}px`;
      this.panel.style.top = `${Math.max(top + 8 + height, Math.min(bottom - 8, y))}px`;
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
    this.crateEdges.dispose(); this.crateOutline.dispose(); this.arrowGeometry.dispose(); this.box.dispose(); this.led.dispose(); this.brush.dispose(); this.foam.dispose(); this.fillGeometry.dispose(); this.outlineGeometry.dispose(); this.strokeGeometry.dispose(); this.black.dispose(); this.white.dispose(); this.teal.dispose();
    this.gasGeometry.dispose(); this.gasMaterial.dispose();
    void this.registry.dispose();
  }
}
