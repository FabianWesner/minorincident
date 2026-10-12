import { worldTiers } from '../levels/districts/types';
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
  Raycaster,
  type Intersection,
  type PerspectiveCamera,
  Vector3,
  InstancedMesh,
  Mesh,
  MeshBasicNodeMaterial,
  Object3D,
  SphereGeometry,
  type BufferGeometry,
  type Material,
} from "three/webgpu";
import { attribute, luminance, uniform } from 'three/tsl';
import type { DistrictWorld } from "../sim/world/DistrictWorld";
import type { PushProp } from "../sim/interact/PropSystem";
import { ROOFED, type DistrictAssets } from "../assets/DistrictAssets";
import { buildingDoors, doorwayOf, doorZone, doorSwingS } from "../data/buildingDoors";
import type { Materials } from "./Materials";
import { anchorsFor, placedLightId } from '../data/placedLights';
import { worldAssets } from "../assets/worldDefinitions";
import manifest from "../assets/manifest.json";
import type { AssetDef } from "../assets/types";
import { InstancedGroup } from "./InstancedGroup";
import { Grass, windPhase } from "./Grass";
import { resolvePosition } from "../levels/districts/validate";
import type { CameraPose } from "./View";
import type { View } from './View';
import { AmbientLife } from './AmbientLife';
import { Foliage } from './Foliage';
import { GroundField } from './GroundField';
import { pickLod, propLod, initialDistrictLods, lodPolicy, type Lod } from './lodPolicy';
import { seeThrough } from './SeeThrough';
import type { PaletteToken } from '../data/palette';

const crownTokens = new Map<string, [PaletteToken, PaletteToken]>(Object.values(worldAssets).flatMap(asset => asset.foliage ? [[asset.foliage.colors.join(':'), asset.foliage.tokens ?? ['foliageDark', 'foliageLight']]] : []));
// Repeated fence panels dominated V1 (109k faces in each view/shadow pass).
// Preserve the adjacent panels; farther boards need their silhouette, not fine bevels.
const privacyFenceLodPolicy = { lod1From: 6, lod2From: 45, hysteresis: 2 };
/** Low tier: hero interiors whose LOD1 alone is ≥ 50 k triangles (supermarket, civic centre) stay on their shadowless LOD2
 * even up close; the E20 rescue peak at the Grove Market otherwise spends ~100 k of the 500 k phone budget on one building. */
const heavyOnLow = (id: string) => ((worldAssets[id] as { authoredLodTriangles?: { lod1?: number } }).authoredLodTriangles?.lod1 ?? 0) >= 50_000;

interface LodBatch { hero: InstancedGroup; near: InstancedGroup; far: InstancedGroup; refs: Object3D[]; origin: [number, number]; height: number; radius: number; half: number; id: string; decay?: string; lit: boolean; loaded: boolean; nearLoaded: boolean; farLoaded: boolean; bands: (Lod | undefined)[] }
/** Shared static instances; detailed prototypes stream only into the close view. */
export class DistrictView extends Group {
  readonly spots = new Map<string, CameraPose>();
  readonly batches: InstancedGroup[] = [];
  private readonly dressingBatches: InstancedGroup[] = [];
  readonly windows: Mesh[] = [];
  private readonly machineGuns: { root: Object3D; gun: Object3D; muzzle: Object3D }[] = [];
  /** HMG nests retain their authored gun/muzzle hierarchy so shots rotate the
   * actual barrel and originate at its socket, including every nested transform. */
  machineGunState() { return this.machineGuns.map(n => ({ muzzle: n.muzzle.getWorldPosition(new Vector3()).toArray(), gun: n.gun.getWorldPosition(new Vector3()).toArray() })); }
  aimMachineGun(at: { x: number; z: number }, direction: { x: number; z: number }): Vector3 | null {
    const nest = this.machineGuns.map(n => ({ n, p: n.root.getWorldPosition(new Vector3()) })).sort((a,b) => Math.hypot(a.p.x-at.x,a.p.z-at.z)-Math.hypot(b.p.x-at.x,b.p.z-at.z))[0];
    if (!nest || Math.hypot(nest.p.x-at.x,nest.p.z-at.z)>3) return null;
    nest.n.root.updateWorldMatrix(true,true);
    const heading = new Vector3(direction.x,0,direction.z).transformDirection(nest.n.gun.parent!.matrixWorld.clone().invert());
    nest.n.gun.rotation.y = -Math.atan2(heading.z,heading.x);
    nest.n.root.updateWorldMatrix(true,true);return nest.n.muzzle.getWorldPosition(new Vector3());
  }
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
  private cameraGameLod = false;

  private readonly grass: Grass[] = [];
  private readonly foliage: Foliage;
  private ambient?: AmbientLife;
  private readonly districtRoots: { root: Group; bounds: Box3 }[] = [];
  /** The drawn ground (baked roads, paving, lawns) for tyre contacts: see GroundField. */
  readonly ground = new GroundField();
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
    this.name = "sunset-grove"; this.matrixAutoUpdate = false;
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
    const lab = this.world.composition.scene;
    if (lab && !lab.glb && lab.ground !== 'grass') {
      // Scene Lab flat ground: one paved slab over the synthetic bounds (the backdrop stays grass).
      for (const d of this.world.districts) {
        const xs = d.layout.bounds.map(p => p[0]), zs = d.layout.bounds.map(p => p[1]);
        const plane = new PlaneGeometry(Math.max(...xs) - Math.min(...xs), Math.max(...zs) - Math.min(...zs)); this.ownedGeometry.push(plane);
        const slab = new Mesh(plane, this.materials.get(lab.ground)); slab.name = 'scene-ground'; slab.rotation.x = -Math.PI / 2; slab.receiveShadow = true;
        slab.position.set(d.origin[0] + (Math.max(...xs) + Math.min(...xs)) / 2, .002, d.origin[1] + (Math.max(...zs) + Math.min(...zs)) / 2); this.add(slab);
        slab.updateMatrixWorld(true); this.ground.add(slab);
      }
    }
    for (const fence of lab && !lab.perimeter ? [] : this.world.boundaries) {
      const x = (fence.min[0] + fence.max[0]) / 2, z = (fence.min[2] + fence.max[2]) / 2;
      const width = fence.max[0] - fence.min[0], depth = fence.max[2] - fence.min[2];
      for (const y of [.35, .8]) this.box(perimeter, 'picketWhite', [width, .15, depth], [x, y, z]);
      const length = Math.max(width, depth), count = Math.ceil(length / 2);
      for (let i = 0; i <= count; i++) this.box(perimeter, 'woodWarm', [.16, 1.05, .16], [width > depth ? fence.min[0] + length * i / count : x, .525, depth > width ? fence.min[2] + length * i / count : z], false);
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
      // These tiers are required by prepare() before revealing phone/L6 play.
      // Start their decode beside the layout GLB, rather than after it finishes.
      if (this.low && worldAssets[p.assetId]?.category !== 'prop') this.registry.prefetch(p.assetId, 'lod1', p.decay);
      if (this.world.composition.id === 'L6' && !this.low) {
        this.registry.prefetch(p.assetId, 'lod0', p.decay);
        this.registry.prefetch(p.assetId, 'lod1', p.decay);
      }
      if (heroAtSpawn && focus && distance <= lodPolicy.lod1From) this.registry.prefetch(p.assetId, 'lod0', p.decay);
    }
    if (heroAtSpawn && focus) for (const d of this.world.districts) for (const p of d.decay.placements) {
      if (Math.hypot(p.position[0] + d.origin[0] - focus.x, p.position[2] + d.origin[1] - focus.z) <= lodPolicy.lod1From) this.registry.prefetch(p.assetId, 'lod0', p.decay);
    }
    for (const [id, lods] of initialLods) for (const lod of lods) this.registry.prefetch(id, lod);
    await Promise.all(
      this.world.districts.map(async (d) => {
        const root = new Group();
        root.name = d.id;
        root.position.set(d.origin[0], 0, d.origin[1]); root.updateMatrix(); root.matrixAutoUpdate = false;
        this.add(root); this.districtRoots.push({ root, bounds: new Box3(
          new Vector3(d.origin[0] + Math.min(...d.layout.bounds.map(p => p[0])), -2, d.origin[1] + Math.min(...d.layout.bounds.map(p => p[1]))),
          new Vector3(d.origin[0] + Math.max(...d.layout.bounds.map(p => p[0])), Math.max(0, ...d.layout.placements.map(p => p.visualAabb.max[1])) + 2, d.origin[1] + Math.max(...d.layout.bounds.map(p => p[1]))),
        ) });
        const scenes = lab && !lab.glb ? [] : await Promise.all(
          // Preserve legacy W0–W5 loading; W6 geometry is opt-in by an authored layer.
          worldTiers.filter(tier => tier <= this.world.composition.tier && tier <= Math.max(5, ...d.layout.layers.map(layer => layer.tier))).map(tier =>
            this.registry.glb(
              `/assets/layouts/${d.id}.${tier === 0 ? "base" : `w${tier}`}.glb`,
            ),
          ),
        );
        for (const scene of scenes) {
          const clone = scene.clone(true);
          // Baked layout nodes never move; avoid recomposing every hidden placement marker each frame.
          clone.traverse(o => { o.updateMatrix(); o.matrixAutoUpdate = false; });
          clone.traverse((o) => {
            if (d.decay.removed.includes(o.name)) o.visible = false;
          });
          root.add(clone);
        }
        // Base paving (tier 0): roads top out at 5 cm, road paint and kerbs above them; decay-removed nodes are not ground.
        root.updateMatrixWorld(true);
        root.children.at(-scenes.length)?.traverse(o => { if (o instanceof Mesh && !(o instanceof InstancedMesh) && o.visible && typeof o.userData.assetId !== 'string') this.ground.add(o); });
        const references = new Map<string, Object3D[]>();
        const crowns = new Map<string, Object3D[]>();
        const base = scenes[0];
        base?.updateMatrixWorld(true);
        base?.traverse((o) => {
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
            key = `${o.userData.assetId}:${lit}:`;
          const reference = new Object3D();
          const first = anchorsFor(o.userData.assetId)[0];
          if (first) reference.userData.lightBase = this.materials.lamps.base(placedLightId(d.id, d.origin, o.userData.name ?? o.name, first.name), anchorsFor(o.userData.assetId));
          o.matrixWorld.decompose(
            reference.position,
            reference.quaternion,
            reference.scale,
          );
          if (typeof o.userData.tint === 'string') reference.userData.tint = o.userData.tint;
          if (!references.has(key)) references.set(key, []);
          references.get(key)!.push(reference);
        });
        // L2/L3 author their dressing (and L3 its per-placement decay variants) in the loaded layout copy. Their
        // references must use those placements, rather than the unchanged baked GLB empties.
        if (this.world.composition.id === 'L6' || this.world.composition.id === 'L5' || this.world.composition.id === 'L4' || this.world.composition.id === 'L3' || this.world.composition.id === 'L2' || lab) {
          references.clear();
          // Scene Lab and L2: crowns follow kept placements, including station canopy clearance.
          if (lab || this.world.composition.id === 'L2') {
            crowns.clear();
            for (const p of d.decay.placements) for (const crown of worldAssets[p.assetId]?.foliage?.crowns ?? []) {
              const key = worldAssets[p.assetId].foliage!.colors.join(':'), ref = new Object3D();
              const [cx, cy, cz] = crown.position.map((v, a) => v * p.scale[a]);
              ref.position.set(p.position[0] + cx * Math.cos(p.yaw) + cz * Math.sin(p.yaw), p.position[1] + cy, p.position[2] - cx * Math.sin(p.yaw) + cz * Math.cos(p.yaw));
              ref.scale.set(crown.radius[0] * p.scale[0], crown.radius[1] * p.scale[1], crown.radius[2] * p.scale[2]);
              if (!crowns.has(key)) crowns.set(key, []); crowns.get(key)!.push(ref);
            }
          }
          for (const p of d.decay.placements) {
            const lit = d.decay.lights.includes(p.lightGroup), key = `${p.assetId}:${lit}:${p.decay ?? ''}`;
            const reference = new Object3D(); reference.position.fromArray(p.position); reference.rotation.y = p.yaw; reference.scale.fromArray(p.scale);
            const first = anchorsFor(p.assetId)[0];
            if (first) reference.userData.lightBase = this.materials.lamps.base(placedLightId(d.id, d.origin, p.id, first.name), anchorsFor(p.assetId));
            if (p.tint) reference.userData.tint = p.tint;
            if (!references.has(key)) references.set(key, []);
            references.get(key)!.push(reference);
          }
        }
        // Static vehicles (parked cars, wrecks, the APC) are authored on the y = 0 plane: rest them on the drawn road or paving under their wheels.
        for (const [key, refs] of references) if (/^veh\./.test(key)) for (const ref of refs) this.restOnGround(ref, key.split(':')[0], d.origin);
        for (const [colors, refs] of crowns) this.foliage.addCrowns(refs, crownTokens.get(colors) ?? ['foliageDark', 'foliageLight'], d.origin);
        await Promise.all(
          [...references].map(async ([key, refs]) => {
            const [id, power, variant] = key.split(":"), decay = variant || undefined;
            if (id === 'prop.hmg-nest') {
              const prototype = await this.registry.asset(id, power === 'true', this.low ? 'lod2' : 'lod0', decay);
              for (const ref of refs) {
                const nest = prototype.clone(true); nest.position.copy(ref.position); nest.quaternion.copy(ref.quaternion); nest.scale.copy(ref.scale); root.add(nest);
                const gun = nest.getObjectByName('gun'), muzzle = nest.getObjectByName('muzzle');
                if (gun && muzzle) this.machineGuns.push({ root: nest, gun, muzzle });
              }
              return;
            }
            if (!worldAssets[id]) {
              // Non-world dressing (decals, kits, emergency vehicles) has no LOD bands: the low tier takes its LOD2 when authored.
              const prototype = await this.registry.asset(id, power === 'true', this.low ? 'lod2' : 'lod0', decay);
              const batch = new InstancedGroup(prototype, refs); this.dressingBatches.push(batch); root.add(batch); return;
            }
            const nearLoaded = initialLods.get(id)?.has('lod1') ?? true;
            const farLoaded = initialLods.get(id)?.has('lod2') ?? true;
            const prototypes = await Promise.all([nearLoaded ? 'lod1' : 'lod2', farLoaded ? 'lod2' : 'lod1'].map(lod => this.registry.asset(id, power === 'true', lod as 'lod1' | 'lod2', decay)));
            // L1 uses the shared vertex-attribute instancing path; live counts stay
            // unchanged while shader code no longer depends on placement capacity.
            const capacity = Math.max(refs.length, this.instanceCapacity ?? refs.length);
            const hero = new InstancedGroup(prototypes[0], refs.slice(), capacity), near = new InstancedGroup(prototypes[0], refs.slice(), capacity), far = new InstancedGroup(prototypes[1], refs.slice(), capacity);
            // Distant low-tier props keep their shaded production art without a shadow draw.
            if (this.low) far.traverse(node => { if (node instanceof Mesh) node.castShadow = false; });
            // Phone tier: a building heavier than 30k triangles per placement would be drawn twice (view + shadow) for little shade.
            if (this.low) {
              let triangles = 0; prototypes[0].traverse(node => { if (node instanceof Mesh) triangles += (node.geometry.index?.count ?? node.geometry.getAttribute('position').count) / 3; });
              if (triangles > 30000) for (const batch of [hero, near]) batch.traverse(node => { if (node instanceof Mesh) node.castShadow = false; });
            }
            for (const batch of [hero, near, far]) {
              batch.name = `inst:${id}`; this.batches.push(batch); root.add(batch);
              batch.traverse(o => { if (o instanceof Mesh && o.name === 'window-light') this.windows.push(o); });
            }
            const dimensions = new Box3().setFromObject(prototypes[0]).getSize(new Vector3());
            this.lodBatches.push({ hero, near, far, refs, id, decay, lit: power === 'true', loaded: false, nearLoaded, farLoaded, bands: [], origin: d.origin, height: dimensions.y, radius: Math.hypot(dimensions.x, dimensions.y, dimensions.z) * .55, half: Math.max(dimensions.x, dimensions.z) / 2 });
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
          for (const tier of worldTiers)
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

  /** Drawn ground at a world point (null outside the baked district ground). */
  groundAt(x: number, z: number): number | null { return this.ground.height(x, z); }
  private restOnGround(ref: Object3D, id: string, origin: [number, number]): void {
    const size = (manifest as AssetDef[]).find(a => a.id === id)?.dimensions; if (!size || ref.position.y > .01 || /^veh\.(train|helicopter)/.test(id)) return;
    const hx = size.x * ref.scale.x * .32, hz = size.z * ref.scale.z * .4, c = Math.cos(ref.rotation.y), s = Math.sin(ref.rotation.y);
    const heights = [[hx, hz], [hx, -hz], [-hx, hz], [-hx, -hz]].map(([x, z]) => this.ground.height(origin[0] + ref.position.x + x * c + z * s, origin[1] + ref.position.z - x * s + z * c)).filter((h): h is number => h !== null).sort((a, b) => a - b);
    if (heights.length < 2) return;
    // Median of the four wheel spots: a lane stripe or a kerb under one wheel does not lift the whole car.
    const middle = heights.length / 2, ground = heights.length % 2 ? heights[Math.floor(middle)] : (heights[middle - 1] + heights[middle]) / 2;
    ref.position.y = Math.max(ref.position.y, ground);
  }
  private box(
    root: Group,
    token: import("../data/palette").PaletteToken,
    size: [number, number, number],
    p: [number, number, number],
    shadow = true,
  ): void {
    const geometry = new BoxGeometry(...size);
    this.ownedGeometry.push(geometry);
    const mesh = new Mesh(geometry, this.materials.get(token));
    mesh.position.fromArray(p);
    mesh.castShadow = shadow;
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
  private readonly barRay = new Raycaster();
  private readonly barBox = new Box3();
  private readonly barHit = new Vector3();
  private readonly barHits: Intersection[] = [];
  private readonly barChecked = new Set<InstancedGroup>();
  /** Enemy bars test drawn solid geometry: navigation boxes intentionally omit roofs and upper walls. */
  occludesBar(camera: PerspectiveCamera, target: Vector3): boolean {
    this.barRay.set(camera.position, this.barHit.copy(target).sub(camera.position).normalize());
    this.barRay.far = camera.position.distanceTo(target) - .01;
    this.barChecked.clear();
    for (const entry of this.lodBatches) {
      if (entry.height < 1.1 || worldAssets[entry.id].foliage || !worldAssets[entry.id].world.solid) continue;
      for (let i = 0; i < entry.refs.length; i++) {
        const ref = entry.refs[i], band = entry.bands[i];
        if (band === undefined || ref.userData.propEnabled === false) continue;
        const x = ref.position.x + entry.origin[0], z = ref.position.z + entry.origin[1];
        const half = entry.half * Math.max(ref.scale.x, ref.scale.z);
        this.barBox.min.set(x - half, ref.position.y, z - half);
        this.barBox.max.set(x + half, ref.position.y + entry.height * ref.scale.y, z + half);
        if (!this.barRay.ray.intersectBox(this.barBox, this.barHit) || this.barHit.distanceTo(camera.position) > this.barRay.far) continue;
        const batch = band === 'lod0' ? entry.hero : band === 'lod1' ? entry.near : entry.far;
        if (this.barChecked.has(batch)) continue;
        this.barChecked.add(batch); this.barHits.length = 0;
        this.barRay.intersectObject(batch, true, this.barHits);
        if (this.barHits.length) return true;
      }
    }
    return false;
  }
  private readonly roofPoint = new Vector3();
  /** Only the courier's own placement lifts its roof. Test in asset space so yaw, scale and rectangular footprints agree. */
  private updateRoofs(player: { x: number; y?: number; z: number }): void {
    for (const entry of this.lodBatches) {
      if (!ROOFED.has(entry.id)) continue;
      const { x, y, z } = worldAssets[entry.id].dimensions;
      for (const ref of entry.refs) {
        ref.updateWorldMatrix(true, false);
        ref.worldToLocal(this.roofPoint.set(player.x - entry.origin[0], player.y ?? 0, player.z - entry.origin[1]));
        const inside = Math.abs(this.roofPoint.x) < x / 2 - .2 && Math.abs(this.roofPoint.z) < z / 2 - .2 && this.roofPoint.y >= -.1 && this.roofPoint.y < y;
        if (Boolean(ref.userData.roofHidden) === inside) continue;
        for (const group of [entry.hero, entry.near, entry.far]) group.roofVisible(!inside, ref);
      }
    }
  }
  /** Door openness (0 closed .. 1 open) per doored placement, eased toward its target. */
  private readonly doorOpen = new Map<Object3D, { entry: LodBatch; k: number; applied: number }>();
  /**
   * Buildings with animated street doors (src/data/buildingDoors.ts) swing their leaves open while someone stands in or
   * walks up to the doorway (PO 2026-10-08: "door stays closed while the person goes out and in") and close behind them.
   * `held` doors (SimWorld.openDoors: a threshold point, e.g. a house the L1 residents come out of) stay open. Each
   * placement swings on its own (several houses share one batch).
   */
  updateDoors(bodies: Iterable<{ x: number; z: number }>, held: Iterable<{ x: number; z: number }> = []): void {
    const seconds = this.frameSeconds;
    const doored = this.lodBatches.filter(entry => buildingDoors[entry.id]?.leaves.length);
    if (!doored.length) return;
    const list = [...bodies], holds = [...held];
    for (const entry of doored) {
      const def = buildingDoors[entry.id];
      for (const ref of entry.refs) {
        let state = this.doorOpen.get(ref); if (!state) this.doorOpen.set(ref, state = { entry, k: 0, applied: -1 });
        const way = doorwayOf({ assetId: entry.id, position: [ref.position.x, ref.position.y, ref.position.z], yaw: 2 * Math.atan2(ref.quaternion.y, ref.quaternion.w), scale: [ref.scale.x, ref.scale.y, ref.scale.z] }, entry.origin);
        const open = !!way && (holds.some(h => Math.hypot(h.x - way.centre.x, h.z - way.centre.z) < 1) || list.some(b => doorZone(way, b)));
        state.k = Math.max(0, Math.min(1, state.k + (open ? 1 : -1) * seconds / doorSwingS));
        const eased = state.k * state.k * (3 - 2 * state.k);
        if (state.applied === eased) continue;
        state.applied = eased;
        for (const group of [entry.hero, entry.near, entry.far]) for (const leaf of def.leaves) group.pose(leaf.node, leaf.open * eased, ref);
      }
    }
  }
  /** The checkpoint can stream in after the mission first raises its arm; cache on each placement. */
  updateArmyBoom(open: number): void {
    for (const entry of this.lodBatches) if (entry.id === 'kit.army-checkpoint')
      for (const ref of entry.refs) {
        if (ref.userData.armyBoomPose === open) continue;
        ref.userData.armyBoomPose = open;
        for (const group of [entry.hero, entry.near, entry.far]) group.pose('gateArm', Math.PI / 2 * open, ref, 'x');
      }
  }
  /** L5 raises the authored half-open leaf to 1.9 m clearance, then lowers its bar onto the platform. */
  updateMetroShutter(closed: number): void {
    closed = Math.max(0, Math.min(1, closed));
    for (const entry of this.lodBatches) if (entry.id === 'bld.metro-entrance') for (const ref of entry.refs) {
      // Cache per placement so a late-streamed canopy still receives the current pose.
      if (ref.userData.metroShutterClosed === closed) continue;
      ref.userData.metroShutterClosed = closed;
      for (const group of [entry.hero, entry.near, entry.far]) group.slide('shutter', .7 - 1.9 * closed, ref);
    }
  }
  /** Openness of every doored placement (Scene Lab door gate). */
  doorState(): { assetId: string; position: [number, number, number]; open: number }[] {
    return [...this.doorOpen].map(([ref, state]) => ({ assetId: state.entry.id, position: [ref.position.x + state.entry.origin[0], ref.position.y, ref.position.z + state.entry.origin[1]] as [number, number, number], open: state.k }));
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
      && rotation.every((value, i) => Math.abs(value - this.cameraRotation[i]) < .0001) && this.cameraAspect === view.camera.aspect && this.cameraHeight === view.viewportHeight && this.cameraGameLod === view.inspectionGameLod) {
      for (const entry of this.dirtyEntries) this.partition(entry, view);
      this.dirtyEntries.clear(); return;
    }
    this.cameraPosition = p.toArray(); this.cameraRotation = rotation; this.cameraAspect = view.camera.aspect; this.cameraHeight = view.viewportHeight; this.cameraGameLod = view.inspectionGameLod;
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
      const distance = view.inspectionPose && !view.inspectionGameLod ? view.camera.position.distanceTo(this.bounds.center) : Math.hypot(x - view.cameraTarget.x, z - view.cameraTarget.z);
      // Bound detail by distance and projected size; preserve the independent low-tier policy.
      const detailDistance = distance / (worldAssets[entry.id].category === 'prop' ? Math.min(1, radius / 5) : 1);
      let band = this.low ? (distance > 16 || worldAssets[entry.id].category === 'prop' || heavyOnLow(entry.id) ? 'lod2' : 'lod1') : pickLod(detailDistance, entry.bands[index], entry.id === 'prop.privacy-fence' ? privacyFenceLodPolicy : undefined);
      if (!this.low && !foliage && worldAssets[entry.id].category === 'prop') {
        const size = worldAssets[entry.id].dimensions;
        const extent = Math.max(size.x * ref.scale.x, size.y * ref.scale.y, size.z * ref.scale.z);
        this.viewPoint.copy(this.bounds.center).applyMatrix4(view.lodCamera.matrixWorldInverse);
        const pixels = extent * view.lodCamera.projectionMatrix.elements[5] * view.viewportHeight / (2 * Math.max(.1, -this.viewPoint.z));
        const screenBand = propLod(pixels, entry.bands[index]);
        if (screenBand > band) band = screenBand;
      }
      entry.bands[index] = band;
      const selected = band === 'lod2' ? far : band === 'lod1' ? near : hero;
      if (ref.userData.propEnabled && (ref.userData.propContactDirty || ref.userData.propContactBatch !== selected)) {
        ref.position.y = ref.userData.propSimY;
        // Preserve body rotation; the selected mesh's seat/back can support a tipped chair.
        const gap = this.propGap(entry, ref, selected);
        if (Number.isFinite(gap)) ref.position.y -= ref.userData.propAwake ? Math.min(0, gap) : gap;
        ref.userData.propContactDirty = false; ref.userData.propContactBatch = selected;
      }
      selected.references.push(ref);
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
      if (!visibilityChanged && Math.abs(ref.position.x - x) < 1e-4 && Math.abs(ref.userData.propSimY - py) < 1e-4 && Math.abs(ref.position.z - z) < 1e-4
        && ref.userData.propAwake === item.awake && Math.abs(ref.quaternion.x - q[0]) < 1e-5 && Math.abs(ref.quaternion.y - q[1]) < 1e-5
        && Math.abs(ref.quaternion.z - q[2]) < 1e-5 && Math.abs(ref.quaternion.w - q[3]) < 1e-5) continue;
      ref.userData.propSimY = py; ref.userData.propAwake = item.awake;
      ref.userData.propContactDirty = true;
      this.propUploads++;
      ref.position.set(x, py, z); ref.quaternion.set(q[0], q[1], q[2], q[3]);
      // Ground contact is resolved in partition against the LOD that will actually be drawn.
      this.dirtyEntries.add(entry);
    }
  }
  private readonly propPoint = new Vector3();
  private propGap(entry: LodBatch, ref: Object3D, batch: InstancedGroup): number {
    ref.updateMatrix();
    let gap = Infinity;
    for (const point of batch.contactPoints()) {
      const v = this.propPoint.copy(point).applyMatrix4(ref.matrix); v.x += entry.origin[0]; v.z += entry.origin[1];
      const ground = this.groundAt(v.x, v.z);
      if (ground !== null) gap = Math.min(gap, v.y - ground);
    }
    return gap;
  }
  /** Scene Lab: probe the actual selected LOD mesh against the drawn ground. */
  propGroundGaps(): { id: string; gapCm: number }[] {
    const gaps: { id: string; gapCm: number }[] = [];
    for (const [id, link] of this.propLinks) if (link && link.ref.userData.propEnabled) {
      const { entry, ref } = link, index = entry.refs.indexOf(ref), band = entry.bands[index];
      if (band === undefined) continue;
      const batch = band === 'lod0' ? entry.hero : band === 'lod1' ? entry.near : entry.far;
      if (!batch.references.includes(ref)) continue;
      const gap = this.propGap(entry, ref, batch);
      if (Number.isFinite(gap)) gaps.push({ id, gapCm: gap * 100 });
    }
    return gaps;
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
    const prototype = await this.registry.asset(entry.id, entry.lit, lod, entry.decay);
    if (this.disposed) return;
    // Allocate full placement capacity, then retain only currently visible refs.
    const old = lod === 'lod0' ? entry.hero : lod === 'lod1' ? entry.near : entry.far;
    const replacement = new InstancedGroup(prototype, entry.refs.slice(), old.capacity);
    let replacementTriangles = 0; if (this.low) replacement.traverse(node => { if (node instanceof Mesh) replacementTriangles += (node.geometry.index?.count ?? node.geometry.getAttribute('position').count) / 3; });
    // Phone tier: far LODs and buildings heavier than 30k triangles per placement skip the shadow pass.
    if (this.low && (lod === 'lod2' || replacementTriangles > 30000)) replacement.traverse(node => { if (node instanceof Mesh) node.castShadow = false; });
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
    this.dirtyEntries.add(entry);
    old.removeFromParent(); old.dispose();
  }
  private northgateClosed: boolean | null = null;
  northgate(closed: boolean): void {if(this.northgateClosed===closed)return;this.northgateClosed=closed;for(const e of this.lodBatches)if(e.id==='int.metro-exit')for(const b of [e.hero,e.near,e.far])b.pose('exitGate',closed?0:Math.PI*.55);}
  private readonly metroMaterials = new Map<string, { material: Material; power: { value: number } }>();
  /** One resident shader per light group; power changes only its uniform. */
  metroPower(main: boolean, emergency: boolean): void {
    for (const entry of this.lodBatches) {
      const on = entry.id === 'prop.emergency-light' ? emergency : entry.id === 'kit.shelter-camp' || entry.id === 'util.radio' ? true : main;
      entry.lit = on;
      let state = this.metroMaterials.get(entry.id);
      for (const batch of [entry.hero, entry.near, entry.far]) batch.traverse(node => {
        if (!(node instanceof Mesh) || node.name !== 'window-light') return;
        if (!state) {
          const power = uniform(on ? 1 : 0), base = this.materials.sample(attribute('_palette', 'float'));
          const glow = base.div(luminance(base).max(.001)).mul(2).mul(power);
          const material = this.materials.shaded(base.mul(power.oneMinus().mul(.08)), glow).seeThrough();
          material.name = 'emi_static-windows';
          state = { material, power }; this.metroMaterials.set(entry.id, state);
        }
        if (node.material !== state.material) node.material = state.material;
      });
      if (state) state.power.value = on ? 1 : 0;
    }
  }
  /** Scripted weather blackout reuses the authored unpowered asset variants. */
  blackout(): void {
    for (const entry of this.lodBatches) if (entry.lit) {
      entry.lit = false;
      const previous = this.pending.get(entry);
      const work = (async () => {
        await previous; if (this.disposed) return;
        if (entry.loaded) await this.loadHero(entry, 'lod0');
        if (entry.nearLoaded) await this.loadHero(entry, 'lod1');
        if (entry.farLoaded) await this.loadHero(entry, 'lod2');
      })().finally(() => { if (this.pending.get(entry) === work) this.pending.delete(entry); });
      this.pending.set(entry, work);
    }
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
  /** Scene Lab probe: current detail band of every static instance (`culled` outside the frustum), district-local positions. */
  lodState(): { assetId: string; origin: [number, number]; position: [number, number, number]; lod: Lod | 'culled' }[] {
    return this.lodBatches.flatMap(entry => entry.refs.map(ref => ({ assetId: entry.id, origin: entry.origin, position: ref.position.toArray() as [number, number, number],
      lod: entry.hero.references.includes(ref) ? 'lod0' as const : entry.near.references.includes(ref) ? 'lod1' as const : entry.far.references.includes(ref) ? 'lod2' as const : 'culled' as const })));
  }
  getState() {
    return {
      labels: this.tags.map(({ sprite }) => ({ text: sprite.name, visible: sprite.visible, opacity: sprite.material.opacity, width: sprite.scale.x, height: sprite.scale.y })),
      districts: this.world.districts.map((d) => d.id),
      batches: this.batches.map((b) => ({
        assetId: b.name.slice(5),
        instances: b.references.length,
        placeholder: b.userData.placeholder === true,
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
    for (const { material } of this.metroMaterials.values()) material.dispose(); this.metroMaterials.clear();
    this.ambient?.dispose();
    this.foliage.dispose();
    for (const b of this.batches) b.dispose();
    for (const b of this.dressingBatches) b.dispose(); this.dressingBatches.length = 0;
    for (const g of this.grass) g.dispose();
    for (const g of this.ownedGeometry) g.dispose();
    for (const m of this.ownedMaterials) m.dispose();
    for (const t of this.textures) t.dispose();
    this.machineGuns.length = 0;
    this.windowMask.dispose();
    this.black.dispose();
    this.clear();
  }
}
