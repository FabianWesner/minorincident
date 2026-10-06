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
import type { DistrictAssets } from "../assets/DistrictAssets";
import type { Materials } from "./Materials";
import { worldAssets } from "../assets/worldDefinitions";
import { InstancedGroup } from "./InstancedGroup";
import { Grass, windPhase } from "./Grass";
import { resolvePosition } from "../levels/districts/validate";
import type { CameraPose } from "./View";
import type { View } from './View';

interface LodBatch { hero: InstancedGroup; near: InstancedGroup; far: InstancedGroup; refs: Object3D[]; origin: [number, number]; height: number; radius: number; id: string; lit: boolean; loaded: boolean }
/** Shared static instances; detailed prototypes stream only into the close view. */
export class DistrictView extends Group {
  readonly spots = new Map<string, CameraPose>();
  readonly batches: InstancedGroup[] = [];
  readonly windows: Mesh[] = [];
  private readonly lodBatches: LodBatch[] = [];
  private readonly pending = new Map<LodBatch, Promise<void>>();
  private disposed = false;
  private readonly frustum = new Frustum();
  private readonly projection = new Matrix4();
  private readonly bounds = new Sphere(new Vector3(), 1);
  private cameraPosition = [Infinity, Infinity, Infinity];
  private cameraRotation = [Infinity, Infinity, Infinity, Infinity];
  private cameraAspect = 0;

  private readonly grass: Grass[] = [];
  private readonly districtRoots: { root: Group; minX: number; maxX: number; minZ: number; maxZ: number }[] = [];
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
  ) {
    super();
    this.name = "sunset-grove";
  }
  async load(seed: number): Promise<void> {
    this.phase.value = 0;
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
    await Promise.all(
      this.world.districts.map(async (d) => {
        const root = new Group();
        root.name = d.id;
        root.position.set(d.origin[0], 0, d.origin[1]);
        this.add(root); this.districtRoots.push({ root, minX: d.origin[0] + Math.min(...d.layout.bounds.map(p => p[0])), maxX: d.origin[0] + Math.max(...d.layout.bounds.map(p => p[0])), minZ: d.origin[1] + Math.min(...d.layout.bounds.map(p => p[1])), maxZ: d.origin[1] + Math.max(...d.layout.bounds.map(p => p[1])) });
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
        const base = scenes[0];
        base.updateMatrixWorld(true);
        base.traverse((o) => {
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
          if (!references.has(key)) references.set(key, []);
          references.get(key)!.push(reference);
        });
        await Promise.all(
          [...references].map(async ([key, refs]) => {
            const [id, power] = key.split(":");
            const prototypes = await Promise.all(['lod1', 'lod1', 'lod2'].map(lod => this.registry.asset(id, power === 'true', lod as 'lod0' | 'lod1' | 'lod2')));
            const hero = new InstancedGroup(prototypes[0], refs.slice()), near = new InstancedGroup(prototypes[1], refs.slice()), far = new InstancedGroup(prototypes[2], refs.slice());
            // Distant low-tier props keep their shaded production art without a shadow draw.
            if (this.low) far.traverse(node => { if (node instanceof Mesh) node.castShadow = false; });
            for (const batch of [hero, near, far]) {
              batch.name = `inst:${id}`; this.batches.push(batch); root.add(batch);
              batch.traverse(o => { if (o instanceof Mesh && o.name === 'window-light') this.windows.push(o); });
            }
            const dimensions = new Box3().setFromObject(prototypes[1]).getSize(new Vector3());
            this.lodBatches.push({ hero, near, far, refs, id, lit: power === 'true', loaded: false, origin: d.origin, height: dimensions.y, radius: Math.hypot(dimensions.x, dimensions.y, dimensions.z) * .55 });
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
  /** Cull whole off-camera district slabs on low; Three still frustum-culls their individual batches. */
  cull(focus: { x: number; z: number }, tier: 'high' | 'low'): void {
    for (const { root, minX, maxX, minZ, maxZ } of this.districtRoots) {
      const dx = Math.max(minX - focus.x, 0, focus.x - maxX);
      const dz = Math.max(minZ - focus.z, 0, focus.z - maxZ);
      root.visible = tier === 'high' || dx * dx + dz * dz <= 60 * 60;
    }
  }
  setQuality(tier: 'high' | 'low'): void {
    if (this.low !== (tier === 'low')) { this.low = tier === 'low'; this.cameraPosition = [Infinity, Infinity, Infinity]; }
    for (const grass of this.grass) grass.visible = tier === 'high';
    // Measured L6 cost: many small prop meshes render again into the sun shadow map.
    // Low preserves building/vehicle/hero shadows and omits detailed prop shadow casters.
    for (const batch of this.batches) if (worldAssets[batch.name.slice(5)].category === 'prop') batch.traverse(node => {
      if (node instanceof Mesh) { node.userData.qualityCastShadow ??= node.castShadow; node.castShadow = tier === 'high' && node.userData.qualityCastShadow; }
    });
  }
  advance(seconds: number): void {
    this.phase.value += seconds; this.labelTime += seconds;
  }
  /** Static matrices are repartitioned only when the camera moves; far props use LOD2. */
  updateLods(view: View): void {
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
      && rotation.every((value, i) => Math.abs(value - this.cameraRotation[i]) < .0001) && this.cameraAspect === view.camera.aspect) return;
    this.cameraPosition = p.toArray(); this.cameraRotation = rotation; this.cameraAspect = view.camera.aspect;
    this.frustum.setFromProjectionMatrix(this.projection.multiplyMatrices(view.camera.projectionMatrix, view.camera.matrixWorldInverse));
    for (const entry of this.lodBatches) {
      const { hero, near, far, refs, origin, height, radius } = entry;
      hero.references.length = 0; near.references.length = 0; far.references.length = 0;
      for (const ref of refs) {
        const x = ref.position.x + origin[0], z = ref.position.z + origin[1];
        this.bounds.center.set(x, ref.position.y + height / 2, z); this.bounds.radius = radius;
        if (!this.frustum.intersectsSphere(this.bounds)) continue;
        const distance = Math.hypot(x - view.cameraTarget.x, z - view.cameraTarget.z);
        (distance > 30 ? far : !this.low && distance <= 12 ? hero : near).references.push(ref);
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
  }
  private async loadHero(entry: LodBatch): Promise<void> {
    const prototype = await this.registry.asset(entry.id, entry.lit, 'lod0');
    if (this.disposed) return;
    // Allocate full placement capacity, then retain only currently visible refs.
    const replacement = new InstancedGroup(prototype, entry.refs.slice()), old = entry.hero;
    replacement.references.splice(0, replacement.references.length, ...old.references);
    replacement.visible = old.visible; replacement.name = old.name;
    for (const child of replacement.children) if (child instanceof InstancedMesh) child.count = replacement.references.length;
    if (replacement.references.length) replacement.update();
    old.parent!.add(replacement);
    old.traverse(node => { const index = this.windows.indexOf(node as Mesh); if (index !== -1) this.windows.splice(index, 1); });
    replacement.traverse(node => { if (node instanceof Mesh && node.name === 'window-light') this.windows.push(node); });
    this.batches[this.batches.indexOf(old)] = replacement; entry.hero = replacement; entry.loaded = true;
    old.removeFromParent(); old.dispose();
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
      })),
      grassBlades: this.grass.reduce(
        (n, g) => n + g.geometry.getAttribute("position").count / 3,
        0,
      ),
      windPhase: this.phase.value,
      photoSpots: [...this.spots.keys()],
      windowMeshes: this.windows.length,
    };
  }
  dispose(): void {
    this.disposed = true;
    for (const b of this.batches) b.dispose();
    for (const g of this.grass) g.dispose();
    for (const g of this.ownedGeometry) g.dispose();
    for (const m of this.ownedMaterials) m.dispose();
    for (const t of this.textures) t.dispose();
    this.windowMask.dispose();
    this.black.dispose();
    this.clear();
  }
}
