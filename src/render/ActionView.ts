import { BufferAttribute, BufferGeometry, DoubleSide, Group, Mesh, MeshBasicNodeMaterial, SphereGeometry, Vector3, type Object3D, type WebGPURenderer, type Material } from 'three/webgpu';
import { actionIconUrl } from '../assets/icons';
import { catalog, action } from '../data/actions/catalog';
import { AssetRegistry, type PlaceholderLog } from '../assets/registry';
import type { SimWorld } from '../sim/world/SimWorld';
import type { Materials } from './Materials';
import type { CharacterView } from './characters/CharacterView';
import type { Side } from '../data/actions/schema';
import type { PaletteMaterial } from './PaletteMaterial';

interface LoadedActionAsset { model: Object3D; source: 'glb' | 'placeholder'; reason: string | null }
const sides = ['LEFT', 'RIGHT'] as const;

/** Selected-side telegraph; fixed geometry buffers and reusable projectile meshes.
 * The ribbon update is adapted from Bruno Trails.js (MIT): reuse positions, update in place.
 * Gameplay sockets/VFX/SFX hooks come from ActionDef and combat events, never render state. */
export class ActionView extends Group {
  private readonly registry: AssetRegistry;
  private readonly placeholders: PlaceholderLog[] = [];
  private readonly assets = new Map<string, LoadedActionAsset>();
  private readonly bloodMaterials: PaletteMaterial[] = [];
  private readonly held: Partial<Record<Side, { id: string; model: Object3D }>> = {};
  private readonly pickups = new Map<number, Object3D>();
  private readonly geometry = new BufferGeometry();
  private readonly positions = new Float32Array(256 * 18);
  private readonly material = new MeshBasicNodeMaterial({ color: '#ffd166', depthWrite: false, side: DoubleSide });
  private readonly indicator = new Mesh(this.geometry, this.material);
  private readonly projectileGeometry = new SphereGeometry(0.1, 8, 6);
  private readonly projectileMaterial = new MeshBasicNodeMaterial({ color: '#ffb849' });
  private readonly projectiles: Mesh[] = [];
  private readonly socketPosition = new Vector3();
  private readonly handPosition = new Vector3();
  private readonly gripPosition = new Vector3();
  private offset = 0;
  private maxHeight = 0;
  private selected: Side = 'LEFT';
  private shape = 'cone';
  private landing = { x: 0, z: 0 };
  constructor(private readonly world: SimWorld, private readonly character: CharacterView, private readonly materials: Materials, renderer: WebGPURenderer) {
    super(); this.registry = new AssetRegistry((event) => this.placeholders.push(event), { renderer });
    this.geometry.setAttribute('position', new BufferAttribute(this.positions, 3)); this.geometry.setDrawRange(0, 0); this.indicator.frustumCulled = false; this.indicator.renderOrder = 2; this.add(this.indicator);
    for (let i = 0; i < 32; i++) { const mesh = new Mesh(this.projectileGeometry, this.projectileMaterial); mesh.visible = false; this.projectiles.push(mesh); this.add(mesh); }
  }
  async init(): Promise<void> {
    for (const def of Object.values(catalog)) if (!this.assets.has(def.viewAssetId)) {
      const model = await this.registry.loadAsset(def.viewAssetId);
      model.traverse((node) => {
        if (!(node instanceof Mesh)) return;
        const remap = (source: Material): Material => {
          const material = this.materials.fromColor(`action:${def.viewAssetId}:${source.name}`, (source as import('three').MeshStandardMaterial).color);
          material.userData.sharedPalette = true;
          if (!this.bloodMaterials.includes(material)) this.bloodMaterials.push(material);
          return material;
        };
        node.material = Array.isArray(node.material) ? node.material.map(remap) : remap(node.material); node.castShadow = node.receiveShadow = true;
      });
      const grip = model.getObjectByName('grip')!; model.updateMatrixWorld(true); grip.getWorldPosition(this.gripPosition); model.position.sub(this.gripPosition);
      const log = this.placeholders.find((e) => e.id === def.viewAssetId);
      this.assets.set(def.viewAssetId, { model, source: model.userData.placeholder ? 'placeholder' : 'glb', reason: log?.reason ?? null });
    }
  }
  /** Six vertices form a thick ribbon segment; all buffers are allocated once. */
  private segment(ax: number, ay: number, az: number, bx: number, by: number, bz: number, width = 0.035): void {
    this.maxHeight = Math.max(this.maxHeight, ay, by);
    const dx = bx - ax, dz = bz - az, length = Math.hypot(dx, dz) || 1;
    const x = -dz / length * width, z = dx / length * width;
    if (this.offset + 18 > this.positions.length) return;
    const p = this.positions; let i = this.offset;
    p[i++] = ax + x; p[i++] = ay; p[i++] = az + z; p[i++] = ax - x; p[i++] = ay; p[i++] = az - z; p[i++] = bx + x; p[i++] = by; p[i++] = bz + z;
    p[i++] = bx + x; p[i++] = by; p[i++] = bz + z; p[i++] = ax - x; p[i++] = ay; p[i++] = az - z; p[i++] = bx - x; p[i++] = by; p[i++] = bz - z; this.offset = i;
  }
  private circle(x: number, z: number, radius: number, from = 0, angle = Math.PI * 2): void {
    for (let i = 0; i < 48; i++) { const a = from + angle * i / 48, b = from + angle * (i + 1) / 48; this.segment(x + Math.cos(a) * radius, 0.04, z + Math.sin(a) * radius, x + Math.cos(b) * radius, 0.04, z + Math.sin(b) * radius); }
  }
  update(): void {
    const combat = this.world.combat, player = this.world.entities.get(1); if (!combat || !player) return;
    if (!player.weapons) {
      for (const held of Object.values(this.held)) held.model.removeFromParent();
      this.offset = 0; this.geometry.setDrawRange(0, 0); return;
    }
    const loadout = combat.runner.loadout;
    for (const side of sides) {
      const def = action(loadout.current(side).id); let held = this.held[side];
      if (held?.id !== def.id) { held?.model.removeFromParent(); held = { id: def.id, model: this.assets.get(def.viewAssetId)!.model.clone(true) }; this.held[side] = held; }
      const socket = this.character.socket(side).socket; if (held.model.parent !== socket) socket.add(held.model);
    }
    this.selected = loadout.state.selectedSide; const state = loadout.state[this.selected], def = action(loadout.current(this.selected).id), origin = player.transform;
    this.shape = def.aimIndicator; this.offset = 0; this.maxHeight = 0; this.material.color.set(this.selected === 'LEFT' ? '#ffd166' : '#44ffe0');
    const aim = state.aim, angle = Math.atan2(aim.z, aim.x), halfArc = def.arc * Math.PI / 360;
    if (def.aimIndicator === 'line') this.segment(origin.x, 0.04, origin.z, origin.x + aim.x * def.range, 0.04, origin.z + aim.z * def.range);
    else if (def.aimIndicator === 'cone') {
      this.circle(origin.x, origin.z, def.range, angle - halfArc, halfArc * 2);
      for (let sign = -1; sign <= 1; sign += 2) { const edge = halfArc * sign; this.segment(origin.x, 0.04, origin.z, origin.x + Math.cos(angle + edge) * def.range, 0.04, origin.z + Math.sin(angle + edge) * def.range); }
    } else if (def.aimIndicator === 'arc') {
      const dx = state.aimPoint ? state.aimPoint.x - origin.x : aim.x * def.range, dz = state.aimPoint ? state.aimPoint.z - origin.z : aim.z * def.range;
      const distance = Math.hypot(dx, dz), scale = distance > def.range ? def.range / distance : 1;
      this.landing.x = origin.x + dx * scale; this.landing.z = origin.z + dz * scale;
      const time = Math.hypot(this.landing.x - origin.x, this.landing.z - origin.z) / (def.projectile?.speed ?? 12);
      const gravityHeight = 0.5 * (def.projectile?.gravity ?? 9.81) * time * time;
      for (let i = 0; i < 32; i++) { const a = i / 32, b = (i + 1) / 32; this.segment(origin.x + dx * scale * a, (0.7 + gravityHeight * a) * (1 - a), origin.z + dz * scale * a, origin.x + dx * scale * b, (0.7 + gravityHeight * b) * (1 - b), origin.z + dz * scale * b); }
      this.circle(this.landing.x, this.landing.z, def.splash?.radius ?? def.effect?.radius ?? 1);
    } else this.circle(origin.x, origin.z, def.range);
    // Persistent zone silhouettes; hot fire, smoke, lure and shield share their authored radius.
    for (const zone of combat.effects.zones) this.circle(zone.x, zone.z, zone.radius);
    this.geometry.setDrawRange(0, this.offset / 3); this.geometry.getAttribute('position').needsUpdate = true;
    for (let i = 0; i < this.projectiles.length; i++) { const p = combat.projectiles[i], mesh = this.projectiles[i]; mesh.visible = !!p; if (p) mesh.position.set(p.x, p.y, p.z); }
    for (const entity of this.world.entities.iterate()) if (entity.pickup && 'actionId' in entity.pickup) {
      let model = this.pickups.get(entity.id); if (!model) { model = this.assets.get(action(entity.pickup.actionId).viewAssetId)!.model.clone(true); this.pickups.set(entity.id, model); this.add(model); }
      model.position.set(entity.transform.x, 0.25, entity.transform.z); model.rotation.z = 0.2;
    }
    for (const [id, model] of this.pickups) if (!this.world.entities.get(id)) { model.removeFromParent(); this.pickups.delete(id); }
  }
  setBlood(coverage: number): void { for (const material of this.bloodMaterials) material.bloodCoverage.value = coverage; }
  getState() {
    this.character.updateMatrixWorld(true);
    const attachments = (['LEFT', 'RIGHT'] as const).map((side) => {
      const nodes = this.character.socket(side), held = this.held[side]; nodes.socket.getWorldPosition(this.socketPosition); nodes.hand.getWorldPosition(this.handPosition);
      held?.model.getObjectByName('grip')?.getWorldPosition(this.gripPosition);
      const def = held && action(held.id), asset = def && this.assets.get(def.viewAssetId);
      return { side, actionId: held?.id, iconUrl: def ? actionIconUrl(def.iconId) : null, socket: nodes.socket.name, handDistance: this.socketPosition.distanceTo(this.handPosition), gripDistance: this.gripPosition.distanceTo(this.socketPosition), attached: held?.model.parent === nodes.socket, source: asset?.source, sockets: def ? ['grip', def.category === 'ranged' ? 'muzzle' : 'tip'].filter((name) => held?.model.getObjectByName(name)) : [] };
    });
    return { bloodCoverage: this.bloodMaterials[0]?.bloodCoverage.value ?? 0, indicator: { selectedSide: this.selected, shape: this.shape, visibleSides: [this.selected], vertices: this.offset / 3, maxHeight: this.maxHeight, landing: { ...this.landing } }, attachments, placeholders: this.placeholders };
  }
  dispose(): void { for (const held of Object.values(this.held)) held.model.removeFromParent(); void this.registry.dispose(); this.geometry.dispose(); this.material.dispose(); this.projectileGeometry.dispose(); this.projectileMaterial.dispose(); this.pickups.clear(); this.clear(); }
}
