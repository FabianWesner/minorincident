// Assembly/reference pattern adapted from folio-2025 World.js / References.js (Bruno Simon, MIT).
import {
  BoxGeometry,
  PlaneGeometry,
  Sprite,
  SpriteMaterial,
  Box3,
  CanvasTexture,
  ConeGeometry,
  Group,
  Frustum,
  Matrix4,
  Sphere,
  Vector3,
  InstancedMesh,
  Mesh,
  MeshBasicNodeMaterial,
  Object3D,
  SphereGeometry,
  type BufferGeometry,
  type Material,
} from "three/webgpu";
import type { DistrictWorld } from "../sim/world/DistrictWorld";
import type { PushProp } from "../sim/interact/PropSystem";
import { ROOFED, type DistrictAssets } from "../assets/DistrictAssets";
import type { Materials } from "./Materials";
import { worldAssets } from "../assets/worldDefinitions";
import { InstancedGroup } from "./InstancedGroup";
import { Grass, windPhase } from "./Grass";
import { resolvePosition } from "../levels/districts/validate";
import type { CameraPose } from "./View";
import type { View } from './View';
import { AmbientLife } from './AmbientLife';
import { Foliage } from './Foliage';
import { pickLod, propLod, initialDistrictLods, type Lod } from './lodPolicy';
import { seeThrough } from './SeeThrough';
import type { PaletteToken } from '../data/palette';

const crownTokens = new Map<string, [PaletteToken, PaletteToken]>(Object.values(worldAssets).flatMap(asset => asset.foliage ? [[asset.foliage.colors.join(':'), asset.foliage.tokens ?? ['foliageDark', 'foliageLight']]] : []));
// Repeated fence panels dominated V1 (109k faces in each view/shadow pass).
// Preserve the adjacent panels; farther boards need their silhouette, not fine bevels.
const privacyFenceLodPolicy = { lod1From: 6, lod2From: 45, hysteresis: 2 };

interface LodBatch { hero: InstancedGroup; near: InstancedGroup; far: InstancedGroup; refs: Object3D[]; origin: [number, number]; height: number; radius: number; half: number; id: string; lit: boolean; loaded: boolean; nearLoaded: boolean; farLoaded: boolean; bands: (Lod | undefined)[] }
/** Shared static instances; detailed prototypes stream only into the close view. */
export class DistrictView extends Group {
  readonly spots = new Map<string, CameraPose>();
  readonly batches: InstancedGroup[] = [];
  private readonly dressingBatches: InstancedGroup[] = [];
  readonly windows: Mesh[] = [];
  private readonly lodBatches: LodBatch[] = [];
  private readonly pending = new Map<LodBatch, Promise<void>>();
  private disposed = false;
  private readonly frustum = new Frustum();
  private readonly projection = new Matrix4();
  private readonly bounds = new Sphere(new Vector3(), 1);
  private readonly viewPoint = new Vector3();
  private cameraPosition = [Infinity, Infinity, Infinity];
  private cameraRotation = [Infinity, Infinity, Infinity, Infinity];
  private cameraAspect = 0;
  private cameraHeight = 0;

  private readonly grass: Grass[] = [];
  private readonly foliage: Foliage;
  private ambient?: AmbientLife;
  private readonly districtRoots: { root: Group; bounds: Box3 }[] = [];
  private readonly ownedGeometry: BufferGeometry[] = [];
  private readonly ownedMaterials: Material[] = [];
  private readonly windowMask = new MeshBasicNodeMaterial({ color: "#ffffff" });
  private readonly black = new MeshBasicNodeMaterial({ color: "#000000" });
  private readonly saved = new Map<Mesh, Material | Material[]>();
  private readonly tags: { sprite: Sprite; entered: number | null; done: boolean }[] = [];
  private labelTime = 0;
  private readonly textures: CanvasTexture[] = [];
  constructor(
    readonly world: DistrictWorld,
    private readonly materials: Materials,
    private readonly registry: DistrictAssets,
    readonly phase: ReturnType<typeof windPhase>,
    private readonly grassMaterial: ReturnType<typeof Grass.material>,
    private low = false,
    private readonly instanceCapacity?: number,
  ) {
    super();
    this.name = "sunset-grove";
    this.foliage = new Foliage(materials, phase); this.add(this.foliage); this.foliage.setQuality(low);
  }
  async load(seed: number, focus?: { x: number; z: number }, heroAtSpawn = false): Promise<void> {
    this.phase.value = 0;
    if (this.world.composition.id === 'L1') { this.ambient = new AmbientLife(this.materials); this.add(this.ambient); }
    // Backdrop reaches beyond the camera far plane; it is scenery outside the bounded town.
    const terrain = new PlaneGeometry(2400, 2400);
    this.ownedGeometry.push(terrain);
    const backdrop = new Mesh(terrain, this.materials.get('grass'));
    backdrop.rotation.x = -Math.PI / 2; backdrop.position.y = -.12; backdrop.receiveShadow = true;
    this.add(backdrop);
    // Bound the slice with a visible fence on the actual terrain perimeter.
    // Every collider below has matching rails and posts; internal seams stay open.
    const perimeter = new Group(); perimeter.name = 'slice-perimeter'; this.add(perimeter);
    for (const fence of this.world.boundaries) {
      const x = (fence.min[0] + fence.max[0]) / 2, z = (fence.min[2] + fence.max[2]) / 2;
      const width = fence.max[0] - fence.min[0], depth = fence.max[2] - fence.min[2];
      for (const y of [.35, .8]) this.box(perimeter, 'picketWhite', [width, .15, depth], [x, y, z]);
      const length = Math.max(width, depth), count = Math.ceil(length / 2);
      for (let i = 0; i <= count; i++) this.box(perimeter, 'woodWarm', [.16, 1.05, .16], [width > depth ? fence.min[0] + length * i / count : x, .525, depth > width ? fence.min[2] + length * i / count : z]);
    }
    // Placement asset ids are known from the layout JSON: start their downloads now instead of
    // after each multi-megabyte layout GLB has arrived and been parsed.
    const initialLods = new Map<string, Set<Lod>>();
    for (const d of this.world.districts) for (const p of d.layout.placements) {
      if (p.minTier > this.world.composition.tier || p.maxTier < this.world.composition.tier) continue;
      const distance = focus ? Math.hypot(p.position[0] + d.origin[0] - focus.x, p.position[2] + d.origin[1] - focus.z) : 0;
      const lods = initialLods.get(p.assetId) ?? new Set<Lod>();
      for (const lod of initialDistrictLods(this.low, worldAssets[p.assetId]?.category === 'prop', distance, focus !== undefined, heroAtSpawn)) lods.add(lod);
      initialLods.set(p.assetId, lods);
    }
    for (const [id, lods] of initialLods) for (const lod of lods) this.registry.prefetch(id, lod);
    await Promise.all(
      this.world.districts.map(async (d) => {
        const root = new Group();
        root.name = d.id;
        root.position.set(d.origin[0], 0, d.origin[1]);
        this.add(root); this.districtRoots.push({ root, bounds: new Box3(
          new Vector3(d.origin[0] + Math.min(...d.layout.bounds.map(p => p[0])), -2, d.origin[1] + Math.min(...d.layout.bounds.map(p => p[1]))),
          new Vector3(d.origin[0] + Math.max(...d.layout.bounds.map(p => p[0])), Math.max(...d.layout.placements.map(p => p.visualAabb.max[1])) + 2, d.origin[1] + Math.max(...d.layout.bounds.map(p => p[1]))),
        ) });
        const scenes = await Promise.all(
          Array.from({ length: this.world.composition.tier + 1 }, (_, tier) =>
            this.registry.glb(
              `/assets/layouts/${d.id}.${tier === 0 ? "base" : `w${tier}`}.glb`,
            ),
          ),
        );
        for (const scene of scenes) {
          const clone = scene.clone(true);
          clone.traverse((o) => {
            if (d.decay.removed.includes(o.name)) o.visible = false;
          });
          root.add(clone);
        }
        const references = new Map<string, Object3D[]>();
        const crowns = new Map<string, Object3D[]>();
        const base = scenes[0];
        base.updateMatrixWorld(true);
        base.traverse((o) => {
          if (o.userData.foliageColors && o.userData.minTier <= this.world.composition.tier && o.userData.maxTier >= this.world.composition.tier) {
            const key = o.userData.foliageColors.join(":"), ref = new Object3D(); o.matrixWorld.decompose(ref.position, ref.quaternion, ref.scale);
            if (!crowns.has(key)) crowns.set(key, []); crowns.get(key)!.push(ref);
          }
          if (
            typeof o.userData.assetId !== "string" ||
            o.userData.minTier > this.world.composition.tier ||
            o.userData.maxTier < this.world.composition.tier
          )
            return;
          const lit = d.decay.lights.includes(o.userData.lightGroup),
            key = `${o.userData.assetId}:${lit}`;
          const reference = new Object3D();
          o.matrixWorld.decompose(
            reference.position,
            reference.quaternion,
            reference.scale,
          );
          if (typeof o.userData.tint === 'string') reference.userData.tint = o.userData.tint;
          if (!references.has(key)) references.set(key, []);
          references.get(key)!.push(reference);
        });
        // L3 authors parking and emergency dressing in its loaded layout. Its
        // references must use those positions, rather than the unchanged baked GLB.
        if (this.world.composition.id === 'L3' || this.world.composition.id === 'L2') {
          references.clear();
          for (const p of d.decay.placements) {
            const lit = d.decay.lights.includes(p.lightGroup), key = `${p.assetId}:${lit}`;
            const reference = new Object3D(); reference.position.fromArray(p.position); reference.rotation.y = p.yaw; reference.scale.fromArray(p.scale);
            if (p.tint) reference.userData.tint = p.tint;
            if (!references.has(key)) references.set(key, []);
            references.get(key)!.push(reference);
          }
        }
        for (const [colors, refs] of crowns) this.foliage.addCrowns(refs, crownTokens.get(colors) ?? ['foliageDark', 'foliageLight'], d.origin);
        await Promise.all(
          [...references].map(async ([key, refs]) => {
            const [id, power] = key.split(":");
            if (!worldAssets[id]) {
              const prototype = await this.registry.asset(id, power === 'true', 'lod0');
              const batch = new InstancedGroup(prototype, refs); this.dressingBatches.push(batch); root.add(batch); return;
            }
            const nearLoaded = initialLods.get(id)?.has('lod1') ?? true;
            const farLoaded = initialLods.get(id)?.has('lod2') ?? true;
            const prototypes = await Promise.all([nearLoaded ? 'lod1' : 'lod2', farLoaded ? 'lod2' : 'lod1'].map(lod => this.registry.asset(id, power === 'true', lod as 'lod1' | 'lod2')));
            // L1 uses the shared vertex-attribute instancing path; live counts stay
            // unchanged while shader code no longer depends on placement capacity.
            const capacity = Math.max(refs.length, this.instanceCapacity ?? refs.length);
            const hero = new InstancedGroup(prototypes[0], refs.slice(), capacity), near = new InstancedGroup(prototypes[0], refs.slice(), capacity), far = new InstancedGroup(prototypes[1], refs.slice(), capacity);
            // Distant low-tier props keep their shaded production art without a shadow draw.
            if (this.low) far.traverse(node => { if (node instanceof Mesh) node.castShadow = false; });
            for (const batch of [hero, near, far]) {
              batch.name = `inst:${id}`; this.batches.push(batch); root.add(batch);
              batch.traverse(o => { if (o instanceof Mesh && o.name === 'window-light') this.windows.push(o); });
            }
            const dimensions = new Box3().setFromObject(prototypes[0]).getSize(new Vector3());
            this.lodBatches.push({ hero, near, far, refs, id, lit: power === 'true', loaded: false, nearLoaded, farLoaded, bands: [], origin: d.origin, height: dimensions.y, radius: Math.hypot(dimensions.x, dimensions.y, dimensions.z) * .55, half: Math.max(dimensions.x, dimensions.z) / 2 });
          }),
        );
        // Dynamic nav-blockers use the same positions/extents as their Rapier colliders.
        for (const blocker of d.blockers) {
          const s = blocker.max.map((v, i) => v - blocker.min[i]),
            p = blocker.min.map((v, i) => (v + blocker.max[i]) / 2);
          this.box(
            root,
            "woodWarm",
            s as [number, number, number],
            p as [number, number, number],
          );
        }
        const grass = new Grass(d.layout, this.grassMaterial, seed);
        this.grass.push(grass);
        root.add(grass);
        for (const b of d.layout.buildings) {
          const p = d.layout.placements.find((p) => p.id === b.id)!;
          this.tag(root, b.label, [p.position[0], 2.8, b.aabb.max[2] + .6]);
        }
        for (const spot of d.gameplay.photoSpots) {
          const p = resolvePosition(spot.target, d.layout),
            target: [number, number, number] = [
              p[0] + d.origin[0],
              0,
              p[1] + d.origin[1],
            ];
          for (let tier = 0; tier <= 5; tier++)
            this.spots.set(`${d.id}/W${tier}/${spot.name}`, {
              target,
              position: [
                target[0] + spot.offset[0],
                spot.offset[1],
                target[2] + spot.offset[2],
              ],
            });
        }
      }),
    );
    // Runtime-only emitter placeholders; gameplay damage remains in the fixed-step sim.
    for (const f of this.world.fires) {
      for (let i = 0; i < 3; i++) {
        const geometry = new ConeGeometry(0.55, 2.4 - i * 0.4, 7),
          mesh = new Mesh(
            geometry,
            this.materials.get(
              i === 0 ? "sirenRed" : "schoolBusYellow",
              i === 0 ? 1.4 : 3,
            ),
          );
        mesh.position.set(f.x + (i - 1) * 0.45, 1.2 - i * 0.2, f.z);
        this.ownedGeometry.push(geometry);
        this.add(mesh);
      }
      const geometry = new SphereGeometry(1.3, 8, 6),
        material = new MeshBasicNodeMaterial({
          color: "#443d54",
          transparent: true,
          opacity: 0.55,
        });
      this.ownedMaterials.push(material);
      for (let i = 0; i < 3; i++) {
        const mesh = new Mesh(geometry, material);
        mesh.position.set(f.x + 0.5 * i, 3 + i * 1.2, f.z);
        this.add(mesh);
      }
      this.ownedGeometry.push(geometry);
    }
  }

  private box(
    root: Group,
    token: import("../data/palette").PaletteToken,
    size: [number, number, number],
    p: [number, number, number],
  ): void {
    const geometry = new BoxGeometry(...size);
    this.ownedGeometry.push(geometry);
    const mesh = new Mesh(geometry, this.materials.get(token));
    mesh.position.fromArray(p);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    root.add(mesh);
  }
  /** Small camera-facing location tags; show once on approach, then fade over one second. */
  private tag(root: Group, text: string, p: [number, number, number]): void {
    const canvas = document.createElement('canvas'); canvas.width = 320; canvas.height = 64;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#352c38dd'; ctx.roundRect(0, 0, 320, 64, 16); ctx.fill();
    ctx.fillStyle = '#ffc773'; ctx.font = 'bold 28px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(text, 160, 32, 300);
    const texture = new CanvasTexture(canvas); this.textures.push(texture);
    const material = new SpriteMaterial({ map: texture, transparent: true, depthWrite: false }); this.ownedMaterials.push(material);
    const sprite = new Sprite(material); sprite.name = text; sprite.position.fromArray(p); sprite.scale.set(1.8, .36, 1); sprite.visible = false; root.add(sprite);
    this.tags.push({ sprite, entered: null, done: false });
  }
  /** Whole-slab frustum culling avoids submitting invisible merged dressing on mobile. */
  cull(view: View, tier: 'high' | 'low'): void {
    this.frustum.setFromProjectionMatrix(this.projection.multiplyMatrices(view.camera.projectionMatrix, view.camera.matrixWorldInverse));
    for (const { root, bounds } of this.districtRoots) root.visible = tier === 'high' || this.frustum.intersectsBox(bounds);
  }
  setQuality(tier: 'high' | 'low'): void {
    if (this.low !== (tier === 'low')) { this.low = tier === 'low'; this.cameraPosition = [Infinity, Infinity, Infinity]; }
    for (const grass of this.grass) grass.setQuality(tier === 'low', tier === 'low' ? this.materials.look.values.grassDensityLow : this.materials.look.values.grassDensity);
    this.foliage.setQuality(tier === 'low');
    this.ambient?.setQuality(tier === 'low');
    // Measured L6 cost: many small prop meshes render again into the sun shadow map.
    // Low preserves building/vehicle/hero shadows and omits detailed prop shadow casters.
    for (const batch of this.batches) if (worldAssets[batch.name.slice(5)].category === 'prop') batch.traverse(node => {
      if (node instanceof Mesh) { node.userData.qualityCastShadow ??= node.castShadow; node.castShadow = tier === 'high' && node.userData.qualityCastShadow; }
    });
  }
  /** L3 collapse extinguishes Civic emissives; ordinary checkpoint restore powers them again. */
  setEmergencyPower(powered: boolean): void {
    const root = this.children.find(child => child.name === 'D-CIVIC');
    root?.traverse(node => {
      if (node instanceof Mesh && !Array.isArray(node.material) && (node.name === 'window-light' || node.material.name.startsWith('emi_'))) node.visible = powered;
    });
  }
  setFoliageReveal(enabled: boolean): void { this.foliage.reveal = enabled; }
  updateFoliage(view: View, player?: { x: number; y: number; z: number }, target?: { x: number; y: number; z: number }): void {
    this.foliage.update(view, player, target); if (player) this.updateRoofs(player);
    // Solid occluders open the shared hole only while one of them is on the camera-to-courier ray.
    const goal = player && this.foliage.reveal && this.occluded(view, player) ? 1 : 0;
    seeThrough.strength.value += (goal - seeThrough.strength.value) * (1 - Math.exp(-10 * this.frameSeconds));
    if (Math.abs(goal - seeThrough.strength.value) < .002) seeThrough.strength.value = goal;
  }
  private frameSeconds = 0;
  /** Segment (camera to chest) against conservative upright boxes of the tall instanced placements nearby. */
  private occluded(view: View, player: { x: number; y: number; z: number }): boolean {
    const o = view.camera.position, dx = player.x - o.x, dy = player.y + .2 - o.y, dz = player.z - o.z;
    for (const entry of this.lodBatches) {
      if (entry.height < 1.1 || worldAssets[entry.id].foliage) continue;
      for (const ref of entry.refs) {
        const x = ref.position.x + entry.origin[0], z = ref.position.z + entry.origin[1];
        if (Math.abs(x - player.x) > 24 || Math.abs(z - player.z) > 24) continue;
        const half = entry.half * Math.max(ref.scale.x, ref.scale.z);
        let enter = 0, exit = 1;
        for (const [origin, delta, min, max] of [[o.x, dx, x - half, x + half], [o.y, dy, ref.position.y, ref.position.y + entry.height * ref.scale.y], [o.z, dz, z - half, z + half]]) {
          if (Math.abs(delta) < 1e-6) { if (origin < min || origin > max) { exit = -1; break; } continue; }
          const a = (min - origin) / delta, b = (max - origin) / delta;
          enter = Math.max(enter, Math.min(a, b)); exit = Math.min(exit, Math.max(a, b));
          if (enter > exit) break;
        }
        if (enter <= exit && enter < .98) return true;
      }
    }
    return false;
  }
  /** Unique enterable buildings (garage, depot, annex, cafe) lift their roof while the courier is inside the footprint: in-house action stays visible. */
  private updateRoofs(player: { x: number; z: number }): void {
    for (const entry of this.lodBatches) {
      if (!ROOFED.has(entry.id)) continue;
      const { x, z } = worldAssets[entry.id].dimensions, half = Math.min(x, z) * .45;
      const inside = entry.refs.some(r => Math.abs(player.x - (r.position.x + entry.origin[0])) < half && Math.abs(player.z - (r.position.z + entry.origin[1])) < half);
      for (const group of [entry.hero, entry.near, entry.far]) group.traverse(o => { if (o instanceof Mesh && /^roof/.test(o.name)) o.visible = !inside; });
    }
  }
  setFoliageVisible(visible: boolean): void { this.foliage.visible = visible; }
  applyLook(): void {
    const v = this.materials.look.values;
    this.foliage.applyLook();
    for (const grass of this.grass) grass.setQuality(this.low, this.low ? v.grassDensityLow : v.grassDensity);
    for (const entry of this.lodBatches) if ((!!worldAssets[entry.id].foliage || /^prop\.(tree|bush|hedge)/.test(entry.id))) {
      for (const ref of entry.refs) { ref.userData.lookHeight ??= ref.scale.y; ref.scale.y = ref.userData.lookHeight * v.foliageHeight; }
    }
    this.cameraPosition = [Infinity, Infinity, Infinity];
  }
  advance(seconds: number): void {
    this.frameSeconds = seconds; this.phase.value += seconds; this.labelTime += seconds;
  }
  /** Static matrices are repartitioned only when the camera moves; far props use LOD2. */
  updateLods(view: View): void {
    this.ambient?.focus.value.set(view.focus.x, view.focus.z);
    for (const tag of this.tags) {
      const position = tag.sprite.getWorldPosition(this.bounds.center);
      if (!tag.done && tag.entered === null && Math.hypot(position.x - view.focus.x, position.z - view.focus.z) < 14) tag.entered = this.labelTime;
      const age = tag.entered === null ? Infinity : this.labelTime - tag.entered;
      tag.sprite.visible = age < 3; tag.sprite.material.opacity = Math.max(0, Math.min(1, 3 - age));
      if (age >= 3 && tag.entered !== null) tag.done = true;
    }
    const p = view.camera.position;
    const rotation = view.camera.quaternion.toArray();
    if (Math.hypot(p.x - this.cameraPosition[0], p.y - this.cameraPosition[1], p.z - this.cameraPosition[2]) < .5
      && rotation.every((value, i) => Math.abs(value - this.cameraRotation[i]) < .0001) && this.cameraAspect === view.camera.aspect && this.cameraHeight === view.viewportHeight) {
      for (const entry of this.dirtyEntries) this.partition(entry, view);
      this.dirtyEntries.clear(); return;
    }
    this.cameraPosition = p.toArray(); this.cameraRotation = rotation; this.cameraAspect = view.camera.aspect; this.cameraHeight = view.viewportHeight;
    this.frustum.setFromProjectionMatrix(this.projection.multiplyMatrices(view.camera.projectionMatrix, view.camera.matrixWorldInverse));
    for (const entry of this.lodBatches) this.partition(entry, view);
    this.dirtyEntries.clear();
  }
  private partition(entry: LodBatch, view: View): void {
    const { hero, near, far, refs, origin, height, radius } = entry;
    hero.references.length = 0; near.references.length = 0; far.references.length = 0;
    const foliage = (!!worldAssets[entry.id].foliage || /^prop\.(tree|bush|hedge)/.test(entry.id));
    for (const [index, ref] of refs.entries()) {
      if (foliage && index >= Math.ceil(refs.length * this.materials.look.values.foliageDensity)) continue;
      const x = ref.position.x + origin[0], z = ref.position.z + origin[1];
      this.bounds.center.set(x, ref.position.y + height * ref.scale.y / 2, z); this.bounds.radius = radius * Math.max(ref.scale.x, ref.scale.y, ref.scale.z);
      if (!this.frustum.intersectsSphere(this.bounds)) continue;
      const distance = Math.hypot(x - view.cameraTarget.x, z - view.cameraTarget.z);
      // Bound detail by distance and projected size; preserve the independent low-tier policy.
      const detailDistance = distance / (worldAssets[entry.id].category === 'prop' ? Math.min(1, radius / 5) : 1);
      let band = this.low ? (distance > 16 || worldAssets[entry.id].category === 'prop' ? 'lod2' : 'lod1') : pickLod(detailDistance, entry.bands[index], entry.id === 'prop.privacy-fence' ? privacyFenceLodPolicy : undefined);
      if (!this.low && !foliage && worldAssets[entry.id].category === 'prop') {
        const size = worldAssets[entry.id].dimensions;
        const extent = Math.max(size.x * ref.scale.x, size.y * ref.scale.y, size.z * ref.scale.z);
        this.viewPoint.copy(this.bounds.center).applyMatrix4(view.camera.matrixWorldInverse);
        const pixels = extent * view.camera.projectionMatrix.elements[5] * view.viewportHeight / (2 * Math.max(.1, -this.viewPoint.z));
        const screenBand = propLod(pixels, entry.bands[index]);
        if (screenBand > band) band = screenBand;
      }
      entry.bands[index] = band;
      (band === 'lod2' ? far : band === 'lod1' ? near : hero).references.push(ref);
    }
    for (const batch of [hero, near, far]) {
      batch.visible = batch.references.length > 0;
      for (const child of batch.children) if (child instanceof InstancedMesh) child.count = batch.references.length;
      if (batch.references.length) batch.update();
    }
    if (hero.references.length && !entry.loaded && !this.pending.has(entry)) {
      this.pending.set(entry, this.loadHero(entry).finally(() => this.pending.delete(entry)));
    }
  }
  /** PO #15: pushable props follow their sim bodies. Placements are matched by asset and home position once;
   * only batches whose props actually moved are re-partitioned (on the next updateLods). */
  private readonly propLinks = new Map<string, { ref: Object3D; entry: LodBatch } | null>();
  private readonly dirtyEntries = new Set<LodBatch>();
  propUploads = 0;
  syncProps(items: readonly PushProp[]): void {
    this.propUploads = 0;
    for (const item of items) {
      let link = this.propLinks.get(item.id);
      if (link === undefined) { link = this.linkProp(item); this.propLinks.set(item.id, link); }
      if (!link) continue;
      const { ref, entry } = link;
      const enabled = item.body.isEnabled(), visibilityChanged = ref.userData.propEnabled !== enabled;
      if (ref.userData.propScale === undefined) ref.userData.propScale = ref.scale.toArray();
      ref.userData.propEnabled = enabled;
      ref.scale.fromArray(ref.userData.propScale).multiplyScalar(enabled ? 1 : 0);
      const [px, py, pz] = item.pose.p, q = item.pose.q, x = px - entry.origin[0], z = pz - entry.origin[1];
      if (!visibilityChanged && Math.abs(ref.position.x - x) < 1e-4 && Math.abs(ref.position.y - py) < 1e-4 && Math.abs(ref.position.z - z) < 1e-4
        && Math.abs(ref.quaternion.x - q[0]) < 1e-5 && Math.abs(ref.quaternion.y - q[1]) < 1e-5 && Math.abs(ref.quaternion.z - q[2]) < 1e-5 && Math.abs(ref.quaternion.w - q[3]) < 1e-5) continue;
      this.propUploads++;
      ref.position.set(x, py, z); ref.quaternion.set(q[0], q[1], q[2], q[3]); this.dirtyEntries.add(entry);
    }
  }
  private linkProp(item: PushProp): { ref: Object3D; entry: LodBatch } | null {
    let best: { ref: Object3D; entry: LodBatch } | null = null, distance = .1;
    for (const entry of this.lodBatches) if (entry.id === item.assetId) for (const ref of entry.refs) {
      const d = Math.hypot(ref.position.x + entry.origin[0] - item.home.p[0], ref.position.z + entry.origin[1] - item.home.p[2]);
      if (d < distance) { distance = d; best = { ref, entry }; }
    }
    return best;
  }
  /** Set while the level is playable: prepares a streamed batch's GPU programs and buffers
   * off-screen before replacing its temporary lower-detail batch. */
  warmHero: ((batch: InstancedGroup) => Promise<void>) | null = null;
  /** Set with warmHero: resolves when a swap may happen (after the first seconds of play, one per frame). */
  swapSlot: (() => Promise<void>) | null = null;
  private async loadHero(entry: LodBatch, lod: Lod = 'lod0'): Promise<void> {
    const prototype = await this.registry.asset(entry.id, entry.lit, lod);
    if (this.disposed) return;
    // Allocate full placement capacity, then retain only currently visible refs.
    const old = lod === 'lod0' ? entry.hero : lod === 'lod1' ? entry.near : entry.far;
    const replacement = new InstancedGroup(prototype, entry.refs.slice(), old.capacity);
    if (this.low && lod === 'lod2') replacement.traverse(node => { if (node instanceof Mesh) node.castShadow = false; });
    if (this.warmHero) { await this.warmHero(replacement); if (this.disposed) { replacement.dispose(); return; } }
    if (this.swapSlot) { await this.swapSlot(); if (this.disposed) { replacement.dispose(); return; } }
    replacement.references.splice(0, replacement.references.length, ...old.references);
    replacement.visible = old.visible; replacement.name = old.name;
    for (const child of replacement.children) if (child instanceof InstancedMesh) child.count = replacement.references.length;
    if (replacement.references.length) replacement.update();
    old.parent!.add(replacement);
    old.traverse(node => { const index = this.windows.indexOf(node as Mesh); if (index !== -1) this.windows.splice(index, 1); });
    replacement.traverse(node => { if (node instanceof Mesh && node.name === 'window-light') this.windows.push(node); });
    this.batches[this.batches.indexOf(old)] = replacement;
    if (lod === 'lod0') { entry.hero = replacement; entry.loaded = true; }
    else if (lod === 'lod1') { entry.near = replacement; entry.nearLoaded = true; }
    else { entry.far = replacement; entry.farLoaded = true; }
    old.removeFromParent(); old.dispose();
  }
  /** Make the route's close tier resident (LOD0 high, LOD1 low). Props never need LOD1 on low.
   * With a focus, nearest placements load first through a small background download window. */
  async prepare(focus?: { x: number; z: number }, cancelled = () => false, maximumDistance = Infinity): Promise<void> {
    await this.ready();
    const lod = this.low ? 'lod1' : 'lod0';
    const entries = this.lodBatches.filter(entry => this.low ? !entry.farLoaded || !entry.nearLoaded && worldAssets[entry.id].category !== 'prop' : !entry.loaded || !entry.nearLoaded && maximumDistance === Infinity);
    if (!focus) { await Promise.all(entries.map(entry => this.loadHero(entry, lod))); return; }
    const distance = (entry: LodBatch) => Math.min(...entry.refs.map(ref => Math.hypot(ref.position.x + entry.origin[0] - focus.x, ref.position.z + entry.origin[1] - focus.z)));
    const queue = entries.map(entry => ({ entry, distance: distance(entry) })).filter(item => item.distance <= maximumDistance).sort((a, b) => a.distance - b.distance).map(({ entry }) => entry);
    const worker = async () => {
      for (let entry = queue.shift(); entry && !cancelled() && !this.disposed; entry = queue.shift()) {
        await this.pending.get(entry);
        const pending = (async () => {
          if (!entry.nearLoaded && maximumDistance === Infinity) await this.loadHero(entry, 'lod1');
          if (!entry.farLoaded) await this.loadHero(entry, 'lod2');
          if (lod === 'lod0' && !entry.loaded) await this.loadHero(entry);
        })();
        this.pending.set(entry, pending); await pending.finally(() => this.pending.delete(entry));
      }
    };
    await Promise.all(Array.from({ length: 4 }, worker));
  }
  async ready(): Promise<void> { await Promise.all(this.pending.values()); }
  /** Probe-only mask; render normal view immediately afterwards so it cannot leak across frames. */
  mask(on: boolean): void {
    if (on) {
      this.traverse((o) => {
        if (o instanceof Mesh) {
          this.saved.set(o, o.material);
          o.material = this.windows.includes(o) ? this.windowMask : this.black;
        }
      });
    } else {
      for (const [mesh, material] of this.saved) mesh.material = material;
      this.saved.clear();
    }
  }
  getState() {
    return {
      labels: this.tags.map(({ sprite }) => ({ text: sprite.name, visible: sprite.visible, opacity: sprite.material.opacity, width: sprite.scale.x, height: sprite.scale.y })),
      districts: this.world.districts.map((d) => d.id),
      batches: this.batches.map((b) => ({
        assetId: b.name.slice(5),
        instances: b.references.length,
        meshes: b.children.filter((c) => c instanceof InstancedMesh).length,
        // Submitted geometry per batch, before shadow/post passes (test/perf diagnostics).
        triangles: b.visible ? b.children.reduce((n, c) => n + (c instanceof InstancedMesh && c.visible ? (c.geometry.index?.count ?? c.geometry.getAttribute('position').count) / 3 * c.count : 0), 0) : 0,
      })),
      grassBlades: this.grass.reduce(
        (n, g) => n + g.geometry.getAttribute("position").count / 3,
        0,
      ),
      windPhase: this.phase.value,
      foliage: this.foliage.getState(),
      seeThrough: { strength: seeThrough.strength.value, radius: seeThrough.radius.value, center: seeThrough.center.value.toArray() },
      movedProps: [...this.propLinks.values()].filter(Boolean).length,
      ambient: this.ambient != null,
      photoSpots: [...this.spots.keys()],
      windowMeshes: this.windows.length,
    };
  }
  dispose(): void {
    this.disposed = true;
    this.ambient?.dispose();
    this.foliage.dispose();
    for (const b of this.batches) b.dispose();
    for (const b of this.dressingBatches) b.dispose(); this.dressingBatches.length = 0;
    for (const g of this.grass) g.dispose();
    for (const g of this.ownedGeometry) g.dispose();
    for (const m of this.ownedMaterials) m.dispose();
    for (const t of this.textures) t.dispose();
    this.windowMask.dispose();
    this.black.dispose();
    this.clear();
  }
}
