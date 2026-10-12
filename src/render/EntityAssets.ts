import { modelLod } from './lodPolicy';
import { Group, Mesh, type Object3D, type BufferGeometry, type Material } from 'three/webgpu';
import { AssetRegistry } from '../assets/registry';
import { staticBatch } from '../assets/staticBatch';
import manifest from '../assets/manifest.json';
import type { Materials } from './Materials';
import type { View } from './View';
import type { AssetQuality } from '../assets/types';
import type { SimWorld } from '../sim/world/SimWorld';

export const productionObstacleAssets: Record<string, string> = {
  'obstacle.cone': 'prop.traffic-cone', 'obstacle.fence': 'prop.picket-fence',
  'obstacle.barricade': 'prop.barricade', 'obstacle.trash-can': 'prop.trash-bin', 'obstacle.mailbox': 'prop.mailbox-blue',
};
const actorAssets: Record<string, string> = {
  'escort.alvarez': 'npc.mrs-alvarez', 'escort.brother': 'npc.brother',
  'vehicle.sedan': 'veh.sedan-red', 'defend.bus': 'veh.school-bus',
  'vehicle.fire-engine': 'veh.fire-engine', 'defend.convoy': 'veh.military-truck', 'defend.heli': 'veh.helicopter',
};
/** Last two tick poses of a scripted rigid actor; the drawn pose lerps between them like the camera does (a moving L4 convoy bus judders against the interpolated camera otherwise). */
interface Pose { tick: number; px: number; py: number; pz: number; pyaw: number; x: number; y: number; z: number; yaw: number }
/** Presentation of authored mission actors and the cosmetic corgi companion.
 * Async loads participate in screenshotReady; no visual transform changes the sim. */
export class EntityAssets extends Group {
  private readonly logs: { id: string; reason: string }[] = [];
  private readonly registry: AssetRegistry;
  private readonly records = new Map<number, { model: Object3D; lod: AssetQuality; pose?: Pose }>();
  private view?: View;
  private readonly prototypes = new Map<string, Promise<Group>>();
  private readonly geometries = new Set<BufferGeometry>();
  private readonly materials = new Set<Material>();
  private readonly pending = new Map<number, Promise<void>>();
  private companion?: Object3D;
  private disposed = false;
  constructor(private readonly world: SimWorld, private readonly low = false, private readonly shading?: Materials) { super(); this.registry = new AssetRegistry(event => this.logs.push(event), { materials: shading }); }
  async init(view: View): Promise<void> {
    this.view = view;
    if (!this.world.npcs) { this.companion = await this.registry.loadAsset('char.corgi', this.low ? 'lod1' : 'high'); this.add(this.companion); }
    await this.ready(); this.update();
  }
  private async actorModel(id: string, lod: AssetQuality): Promise<Group> {
    const def = this.registry.definition(id), canonical = (lod === 'lod1' || lod === 'lod2') && !def.lods?.[lod] ? 'lod0' : lod;
    const key = `${id}:${canonical}`;
    if (!this.prototypes.has(key)) this.prototypes.set(key, this.registry.loadAsset(id, canonical).then(source => {
      if (this.disposed) return source as Group;
      // Authored mission actors currently move as rigid objects; preserve their
      // production swatches with two draws instead of one draw per Blender part.
      // The helicopter keeps its rotor nodes (spun every frame, update); its <= 8 draws are cheap enough unmerged.
      const model = id === 'veh.helicopter-military' ? source as Group : staticBatch(source, true, this.shading); model.userData = { ...source.userData };
      model.traverse(node => { if (node instanceof Mesh) { this.geometries.add(node.geometry); this.materials.add(node.material as Material); } });
      return model;
    }));
    return (await this.prototypes.get(key)!).clone(true);
  }
  async ready(): Promise<void> {
    for (const entity of this.world.entities.iterate()) {
      // BicycleView owns the animated cargo bike. Loading it again here draws a
      // second rigid bike and downloads an unused phone LOD1 alongside its rig.
      // Light anchors belong to DistrictView's existing placement, just like
      // physics props have their own renderer. Avoid a full manifest scan per
      // lamp on every frame (hundreds of anchors in production levels).
      if (entity.kind === 'light' || entity.kind === 'physics-prop' || entity.id === 1 || entity.bicycle || this.world.npcs && (entity.companion || entity.escort || entity.civilian) || this.world.vehicles?.cars.has(entity.id) || entity.faction === 'infected' || this.pending.has(entity.id)) continue;
      const id = productionObstacleAssets[entity.archetype] ?? actorAssets[entity.archetype] ?? (manifest.some(a => a.id === entity.archetype) ? entity.archetype : entity.kind === 'escort' || entity.faction === 'civilian' ? 'npc.civilian-man-a' : undefined);
      if (!id) continue;
      const target = this.view?.cameraTarget ?? this.world.entities.get(1)!.transform;
      const distance = Math.hypot(entity.transform.x - target.x, entity.transform.z - target.z);
      const lod = modelLod(distance, this.records.get(entity.id)?.lod, this.low);
      if (this.records.get(entity.id)?.lod === lod) continue;
      const load = this.actorModel(id, lod).then(model => {
        if (!this.disposed && this.world.entities.get(entity.id)) {
          this.records.get(entity.id)?.model.removeFromParent(); this.records.set(entity.id, { model, lod });
          model.position.set(entity.transform.x, entity.kind === 'obstacle' ? 0 : Math.max(0, entity.transform.y - .7), entity.transform.z);
          model.rotation.y = entity.transform.yaw;
          // Phone tier: flat scripted dressing (glass shards, craters) never casts a shadow.
          if (this.low && entity.kind === 'setpiece' && !id.startsWith('veh.')) model.traverse(node => { if (node instanceof Mesh) node.castShadow = false; });
          this.add(model);
        }
      }).finally(() => this.pending.delete(entity.id));
      this.pending.set(entity.id, load);
    }
    await Promise.all(this.pending.values());
  }
  update(alpha = 1): void {
    void this.ready();
    const player0 = this.world.entities.get(1)?.transform;
    for (const [id, rec] of this.records) {
      const model = rec.model, entity = this.world.entities.get(id);
      if (!entity) { model.removeFromParent(); this.records.delete(id); continue; }
      const t = entity.transform, flat = entity.kind === 'obstacle';
      let pose = rec.pose;
      if (!pose) pose = rec.pose = { tick: this.world.tick, px: t.x, py: t.y, pz: t.z, pyaw: t.yaw, x: t.x, y: t.y, z: t.z, yaw: t.yaw };
      else if (pose.tick !== this.world.tick) {
        // A jump (checkpoint restore, teleport) must not smear across the map.
        const jump = this.world.tick < pose.tick || Math.hypot(t.x - pose.x, t.z - pose.z) > 6;
        Object.assign(pose, { tick: this.world.tick, px: jump ? t.x : pose.x, py: jump ? t.y : pose.y, pz: jump ? t.z : pose.z, pyaw: jump ? t.yaw : pose.yaw, x: t.x, y: t.y, z: t.z, yaw: t.yaw });
      }
      const a = Math.max(0, Math.min(1, alpha));
      const y = pose.py + (pose.y - pose.py) * a;
      model.position.set(pose.px + (pose.x - pose.px) * a, flat ? 0 : Math.max(0, y - .7), pose.pz + (pose.z - pose.pz) * a);
      model.rotation.y = pose.pyaw + Math.atan2(Math.sin(pose.yaw - pose.pyaw), Math.cos(pose.yaw - pose.pyaw)) * a; model.visible = !entity.hidden && (entity.kind !== 'obstacle' || entity.health.current > 0);
      // Phone tier: scripted set pieces (L4 convoy, tank, glass) beyond the light/camera reach are not drawn at all.
      if (this.low && entity.kind === 'setpiece' && model.visible) { const t = this.view?.cameraTarget ?? player0; if (t && Math.hypot(entity.transform.x - t.x, entity.transform.z - t.z) > 48) model.visible = false; }
      const main = model.getObjectByName('mainRotor'), tail = model.getObjectByName('tailRotor');
      if (main) main.rotation.y = this.world.tick * .62;
      if (tail) tail.rotation.z = this.world.tick * .83;
      model.rotation.z = entity.health.current > 0 ? 0 : Math.PI / 2;
    }
    const player = this.world.entities.get(1);
    if (this.companion && player) {
      const yaw = player.transform.yaw;
      this.companion.position.set(player.transform.x - Math.cos(yaw) * 1.1 + Math.sin(yaw) * .7, Math.max(0, player.transform.y - .7), player.transform.z + Math.sin(yaw) * 1.1 + Math.cos(yaw) * .7);
      this.companion.rotation.y = yaw; this.companion.visible = !player.hidden;
    }
  }
  getState() { return { companion: this.companion?.userData.placeholder ? 'placeholder' : 'glb', actors: [...this.records].map(([id, { model, lod }]) => ({ id, lod, position: model.position.toArray(), yaw: model.rotation.y, source: model.userData.placeholder ? 'placeholder' : 'glb' })), placeholders: this.logs }; }
  dispose(): void { this.disposed = true; this.clear(); this.records.clear();
    for (const geometry of this.geometries) geometry.dispose(); for (const material of this.materials) material.dispose();
    this.geometries.clear(); this.materials.clear(); this.prototypes.clear(); void this.registry.dispose(); }
}
