// Adapted from Bruno Simon InteractivePoints.js / RayCursor.js (MIT):
// highlighted active point above geometry, range-based reveal, separate presentation state.
import { BoxGeometry, Group, Mesh, MeshBasicNodeMaterial, RingGeometry, Vector3, type Camera, type Object3D } from 'three/webgpu';
import { AssetRegistry } from '../assets/registry';
import { action } from '../data/actions/fixtures';
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
  private readonly registry = new AssetRegistry(e => console.info(JSON.stringify(e)));
  private readonly objects = new Map<number, Object3D>();
  private readonly pending = new Map<number, Promise<void>>();
  private readonly box = new BoxGeometry(1, 1, 1);
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
  constructor(private readonly world: SimWorld, private readonly materials: Materials) {
    super(); this.name = 'interactions';
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
    if (!(e.interactable || e.hazard || e.destructible || e.pickup) || this.objects.has(e.id) || this.pending.has(e.id)) return;
    const load = this.create(e).then(object => {
      if (!this.disposed) { this.objects.set(e.id, object); this.add(object); }
      this.pending.delete(e.id);
    });
    this.pending.set(e.id, load);
  }
  private async create(e: EntitySnapshot): Promise<Object3D> {
    const id = e.pickup?.kind === 'weapon' ? action(e.pickup.item!).viewAssetId : assetIds[e.archetype];
    if (id) return this.registry.loadAsset(id);
    // Devices without an integrated art entry use gameplay-shaped code placeholders.
    const g = new Group(), body = new Mesh(this.box, this.materials.get(e.pickup ? 'backpackTeal' : e.hazard?.kind === 'toxic' ? 'grass' : e.destructible ? 'woodWarm' : 'policeBlue'));
    if (e.pickup) body.scale.set(.3, .3, .3);
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
        object.position.set(e.transform.x, 0, e.transform.z); object.rotation.y = e.transform.yaw;
        object.visible = !e.pickup?.collected && !e.destructible?.broken && !e.hazard?.exploded;
        if (e.interactable?.open) object.rotation.y += Math.PI / 2;
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
    this.disposed = true; this.panel.remove(); this.clear(); this.objects.clear();
    this.box.dispose(); this.fillGeometry.dispose(); this.outlineGeometry.dispose(); this.strokeGeometry.dispose(); this.black.dispose(); this.white.dispose(); this.teal.dispose();
    void this.registry.dispose();
  }
}
