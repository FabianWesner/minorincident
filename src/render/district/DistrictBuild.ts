import { worldTiers } from '../../levels/districts/types';
// Assembly/reference pattern adapted from folio-2025 World.js / References.js (Bruno Simon, MIT).
import { BoxGeometry, PlaneGeometry, Path, Shape, ShapeGeometry, Sprite, SpriteMaterial, Box3, CanvasTexture, ConeGeometry, Group, Sphere, Vector2, Vector3, InstancedMesh, Mesh, MeshBasicNodeMaterial, Object3D, SphereGeometry, type BufferGeometry, type Material } from 'three/webgpu';
import type { DistrictWorld } from '../../sim/world/DistrictWorld';
import type { DistrictAssets } from '../../assets/DistrictAssets';
import type { Materials } from '../Materials';
import { anchorsFor, placedLightId } from '../../data/placedLights';
import { worldAssets } from '../../assets/worldDefinitions';
import manifest from '../../assets/manifest.json' with { type: 'json' };
import type { AssetDef } from '../../assets/types';
import type { PaletteToken } from '../../data/palette';
import { InstancedGroup } from '../InstancedGroup';
import { Grass } from '../Grass';
import { resolvePosition } from '../../levels/districts/validate';
import type { CameraPose } from '../View';
import { AmbientLife } from '../AmbientLife';
import { timeOfDay } from '../../data/timeOfDay';
import type { Foliage } from '../Foliage';
import { GroundField } from '../GroundField';
import { initialDistrictLods, lodPolicy, type Lod } from '../lodPolicy';
import { stripStrayDecorations } from '../decorationFilter';
import { layoutTerrainChunks } from '../../sim/world/TerrainChunks';
import { TerrainView } from '../TerrainView';
import { heightSteps } from '../../sim/world/HeightSteps';
import { HeightStepEdges } from '../HeightStepEdges';
import { batchPerimeterPosts } from '../PerimeterPosts';
import { NightAccents, nightAccents } from '../NightAccents';

const crownTokens = new Map<string, [PaletteToken, PaletteToken]>(Object.values(worldAssets).flatMap(asset => asset.foliage ? [[asset.foliage.colors.join(':'), asset.foliage.tokens ?? ['foliageDark', 'foliageLight']]] : []));

export interface LodBatch { hero: InstancedGroup; near: InstancedGroup; far: InstancedGroup; refs: Object3D[]; origin: [number, number]; height: number; radius: number; half: number; /** Local footprint of LOD0 (centre offset and half extents): occluder tests use the real oriented box, not the longest side squared. */ foot: { cx: number; cz: number; hx: number; hz: number }; id: string; decay?: string; lit: boolean; loaded: boolean; nearLoaded: boolean; farLoaded: boolean; heroShown: Lod; bands: (Lod | undefined)[] }
export interface DressingEntry { id: string; batch: InstancedGroup; refs: Object3D[]; origin: [number, number]; center: Vector3; radius: number; foot: LodBatch['foot']; height: number }

/** Everything a district load builds: instanced batches, baked layout, terrain, labels and the resources it owns. */
export class DistrictParts {
  readonly spots = new Map<string, CameraPose>();
  readonly batches: InstancedGroup[] = [];
  readonly dressingBatches: InstancedGroup[] = [];
  readonly dressingEntries: DressingEntry[] = [];
  readonly lodBatches: LodBatch[] = [];
  readonly windows: Mesh[] = [];
  readonly machineGuns: { root: Object3D; gun: Object3D; muzzle: Object3D }[] = [];
  readonly grass: Grass[] = [];
  readonly districtRoots: { root: Group; bounds: Box3 }[] = [];
  /** The drawn ground (baked roads, paving, lawns) for tyre contacts: see GroundField. */
  readonly ground = new GroundField();
  readonly mergedLayout: Mesh[] = [];
  readonly ownedGeometry: BufferGeometry[] = [];
  readonly perimeterPosts: InstancedMesh[] = [];
  readonly ownedMaterials: Material[] = [];
  readonly tags: { sprite: Sprite; entered: number | null; done: boolean }[] = [];
  readonly textures: CanvasTexture[] = [];
  ambient?: AmbientLife;
  /** L9 night accents (studs, flares, lanterns, blinkers); render-only. */
  accents?: NightAccents;
  terrain?: TerrainView;
  stepEdges?: HeightStepEdges;
  terrainHorizon?: Group;
  maxBarTerrainHeight = 0;
  /** Releases exactly what the build created; the registry's shared assets are borrowed and never touched. */
  dispose(): void {
    this.terrain?.dispose(); this.stepEdges?.dispose(); this.ambient?.dispose(); this.accents?.dispose();
    for (const b of this.batches) b.dispose();
    for (const b of this.dressingBatches) b.dispose(); this.dressingBatches.length = 0;
    for (const g of this.grass) g.dispose();
    for (const mesh of this.perimeterPosts) { if (mesh.userData.staticInstanceAttributes) mesh.geometry.dispose(); mesh.dispose(); } this.perimeterPosts.length = 0;
    for (const g of this.ownedGeometry) g.dispose();
    for (const m of this.ownedMaterials) m.dispose();
    for (const t of this.textures) t.dispose();
    this.machineGuns.length = 0;
  }
}

export interface DistrictBuildDeps {
  /** The DistrictView group the parts join. */
  readonly view: Group;
  readonly world: DistrictWorld;
  readonly materials: Materials;
  readonly registry: DistrictAssets;
  readonly grassMaterial: ReturnType<typeof Grass.material>;
  readonly foliage: Foliage;
  /** Read live: the quality tier may change while the load awaits. */
  readonly low: () => boolean;
  readonly instanceCapacity?: number;
}

/** Load the district's layout GLBs and assets and assemble its static batches into `parts`, in the established scene order. */
export async function buildDistrict(parts: DistrictParts, deps: DistrictBuildDeps, seed: number, focus?: { x: number; z: number }, heroAtSpawn = false): Promise<void> {
  if (deps.world.composition.id === 'L7') {
    parts.maxBarTerrainHeight = Math.max(0, ...deps.world.districts.flatMap(d => [...d.layout.surfaces.map(s => s.height ?? 0), ...d.decay.colliders.filter(c => c.walkable).map(c => c.aabb.max[1])]));
  }
  const steps = heightSteps(deps.world);
  if (steps.length) { parts.stepEdges = new HeightStepEdges(steps, deps.materials); deps.view.add(parts.stepEdges); }
  const ambient = timeOfDay[deps.world.composition.timeOfDay].ambient;
  if (ambient) { parts.ambient = new AmbientLife(deps.materials, ambient); parts.ambient.setQuality(deps.low()); deps.view.add(parts.ambient); }
  const accents = nightAccents(deps.world);
  if (accents.points.length) { parts.accents = new NightAccents(accents, deps.materials.field); deps.view.add(parts.accents); }
  // Backdrop reaches beyond the camera far plane; it is scenery outside the bounded town.
  // D-CROSSING (L9-A2): the collapsed-road gully (x 508..524, z -90..90, floor 5.5 m down) must not be covered by it.
  const gully = deps.world.composition.districts.find(d => d.id === 'D-CROSSING');
  let terrain: BufferGeometry = new PlaneGeometry(2400, 2400);
  if (gully) {
    const outer = new Shape([new Vector2(-1200, -1200), new Vector2(1200, -1200), new Vector2(1200, 1200), new Vector2(-1200, 1200)]);
    const [x0, x1, z0, z1] = [508 + gully.origin[0], 524 + gully.origin[0], -90 + gully.origin[1], 90 + gully.origin[1]];
    // The mesh is rotated -90 degrees about X, which maps shape y to world -z.
    outer.holes.push(new Path([new Vector2(x0, -z1), new Vector2(x0, -z0), new Vector2(x1, -z0), new Vector2(x1, -z1)]));
    terrain = new ShapeGeometry(outer);
  }
  parts.ownedGeometry.push(terrain);
  const backdrop = new Mesh(terrain, deps.materials.get('grass'));
  backdrop.rotation.x = -Math.PI / 2; backdrop.position.y = -.12; backdrop.receiveShadow = true;
  deps.view.add(backdrop);
  // Bound the slice with a visible fence on the actual terrain perimeter.
  // Every collider below has matching rails and posts; internal seams stay open.
  const perimeter = new Group(); perimeter.name = 'slice-perimeter'; deps.view.add(perimeter);
  const lab = deps.world.composition.scene;
  if (lab && !lab.glb && lab.ground !== 'grass') {
    // Scene Lab flat ground: one paved slab over the synthetic bounds (the backdrop stays grass).
    for (const d of deps.world.districts) {
      const xs = d.layout.bounds.map(p => p[0]), zs = d.layout.bounds.map(p => p[1]);
      const plane = new PlaneGeometry(Math.max(...xs) - Math.min(...xs), Math.max(...zs) - Math.min(...zs)); parts.ownedGeometry.push(plane);
      const slab = new Mesh(plane, deps.materials.get(lab.ground)); slab.name = 'scene-ground'; slab.rotation.x = -Math.PI / 2; slab.receiveShadow = true;
      slab.position.set(d.origin[0] + (Math.max(...xs) + Math.min(...xs)) / 2, .002, d.origin[1] + (Math.max(...zs) + Math.min(...zs)) / 2); deps.view.add(slab);
      slab.updateMatrixWorld(true); parts.ground.add(slab);
    }
  }
  const posts: [number, number, number][] = [];
  for (const fence of lab && !lab.perimeter ? [] : deps.world.boundaries) {
    const x = (fence.min[0] + fence.max[0]) / 2, z = (fence.min[2] + fence.max[2]) / 2;
    const width = fence.max[0] - fence.min[0], depth = fence.max[2] - fence.min[2];
    for (const y of [.35, .8]) box(parts, deps.materials, perimeter, 'picketWhite', [width, .15, depth], [x, y, z]);
    const length = Math.max(width, depth), count = Math.ceil(length / 2);
    for (let i = 0; i <= count; i++) posts.push([width > depth ? fence.min[0] + length * i / count : x, .525, depth > width ? fence.min[2] + length * i / count : z]);
  }
  if (posts.length) {
    const geometry = new BoxGeometry(.16, 1.05, .16); parts.ownedGeometry.push(geometry);
    parts.perimeterPosts.push(...batchPerimeterPosts(posts, geometry, deps.materials.get('woodWarm')));
    perimeter.add(...parts.perimeterPosts);
  }
  // Placement asset ids are known from the layout JSON: start their downloads now instead of
  // after each multi-megabyte layout GLB has arrived and been parsed.
  const initialLods = new Map<string, Set<Lod>>();
  for (const d of deps.world.districts) for (const p of d.layout.placements) {
    if (p.minTier > deps.world.composition.tier || p.maxTier < deps.world.composition.tier) continue;
    const distance = focus ? Math.hypot(p.position[0] + d.origin[0] - focus.x, p.position[2] + d.origin[1] - focus.z) : 0;
    const lods = initialLods.get(p.assetId) ?? new Set<Lod>();
    for (const lod of initialDistrictLods(deps.low(), worldAssets[p.assetId]?.category === 'prop', distance, focus !== undefined)) lods.add(lod);
    initialLods.set(p.assetId, lods);
    // These tiers are required by prepare() before revealing phone/L6 play.
    // Start their decode beside the layout GLB, rather than after it finishes.
    if (deps.low() && worldAssets[p.assetId]?.category !== 'prop' && (deps.world.composition.id !== 'L7' || distance <= 16)) deps.registry.prefetch(p.assetId, 'lod1', p.decay);
    if (deps.world.composition.id === 'L6' && !deps.low()) {
      deps.registry.prefetch(p.assetId, 'lod0', p.decay);
      deps.registry.prefetch(p.assetId, 'lod1', p.decay);
    }
    if (heroAtSpawn && focus && distance <= lodPolicy.lod1From) deps.registry.prefetch(p.assetId, 'lod0', p.decay);
  }
  if (heroAtSpawn && focus) for (const d of deps.world.districts) for (const p of d.decay.placements) {
    if (Math.hypot(p.position[0] + d.origin[0] - focus.x, p.position[2] + d.origin[1] - focus.z) <= lodPolicy.lod1From) deps.registry.prefetch(p.assetId, 'lod0', p.decay);
  }
  for (const [id, lods] of initialLods) for (const lod of lods) deps.registry.prefetch(id, lod);
  await Promise.all(
    deps.world.districts.map(async (d) => {
      const root = new Group();
      root.name = d.id;
      root.position.set(d.origin[0], 0, d.origin[1]); root.updateMatrix(); root.matrixAutoUpdate = false;
      deps.view.add(root); parts.districtRoots.push({ root, bounds: new Box3(
        new Vector3(d.origin[0] + Math.min(...d.layout.bounds.map(p => p[0])), -2, d.origin[1] + Math.min(...d.layout.bounds.map(p => p[1]))),
        new Vector3(d.origin[0] + Math.max(...d.layout.bounds.map(p => p[0])), Math.max(0, ...d.layout.placements.map(p => p.visualAabb.max[1])) + 2, d.origin[1] + Math.max(...d.layout.bounds.map(p => p[1]))),
      ) });
      const scenes = lab && !lab.glb ? [] : await Promise.all(
        // Preserve legacy W0–W5 loading; W6 geometry is opt-in by an authored layer.
        worldTiers.filter(tier => tier <= deps.world.composition.tier && tier <= Math.max(5, ...d.layout.layers.map(layer => layer.tier))).map(tier =>
          deps.registry.glb(
            `/assets/layouts/${d.id}.${tier === 0 ? d.layout.terrainChunks?.length ? 'horizon' : 'base' : `w${tier}`}.glb`,
          ),
        ),
      );
      for (const scene of scenes) {
        const clone = scene.clone(true);
        // Baked layout nodes never move; avoid recomposing every hidden placement marker each frame.
        clone.traverse(o => { o.updateMatrix(); o.matrixAutoUpdate = false; });
        // PO 2026-10-12: the Grove back alleys were baked in the near-black UI token and read as a hole in the ground next to the
        // fences (shadowed they went pure black). Draw that ground like asphalt; the baked GLB stays unchanged.
        if (d.id === 'D-GROVE') {
          const alley = deps.materials.world('asphalt').seeThrough();
          clone.traverse(o => { if (o instanceof Mesh && typeof o.userData.assetId !== 'string' && (o.material as { token?: string }).token === 'uiDark') o.material = alley; });
        }
        clone.traverse((o) => {
          if (d.decay.removed.includes(o.name)) o.visible = false;
        });
        // PO 10-13 "Flowers growing on stone": baked daisies on paths/paving are dropped (shared soil rule with the sim).
        stripStrayDecorations(clone, d.layout);
        stripLayoutMarkers(clone);
        root.add(clone);
        if (d.layout.terrainChunks?.length) parts.terrainHorizon = clone;
      }
      // Base paving (tier 0): roads top out at 5 cm, road paint and kerbs above them; decay-removed nodes are not ground.
      root.updateMatrixWorld(true);
      for (const groundLayer of root.children.slice(-scenes.length)) {
        groundLayer.traverse(o => {
          if (o instanceof Mesh && !(o instanceof InstancedMesh) && o.visible && typeof o.userData.assetId !== 'string') { parts.ground.add(o); parts.mergedLayout.push(o); }
          // Baked ground and placement markers are static in every tier.
          // Their world transforms were composed above; camera frames need no recomposition.
          o.matrixWorldAutoUpdate = false;
        });
        freezeLayout(groundLayer);
      }
      if (d.layout.terrainChunks?.length && scenes.length) {
        parts.terrain = new TerrainView(layoutTerrainChunks(d.layout, d.origin), d.layout.terrainChunks[0].size, id => `/assets/layouts/${d.id}.chunks/${id}.glb`, deps.registry, deps.low() ? 'low' : 'high');
        deps.view.add(parts.terrain);
        parts.terrain.update(focus ? [focus.x, focus.z] : deps.world.playerStart);
        await parts.terrain.ready();
      }
      const references = new Map<string, Object3D[]>();
      const crowns = new Map<string, Object3D[]>();
      const base = scenes[0];
      base?.updateMatrixWorld(true);
      base?.traverse((o) => {
        if (o.userData.foliageColors && o.userData.minTier <= deps.world.composition.tier && o.userData.maxTier >= deps.world.composition.tier) {
          const key = o.userData.foliageColors.join(":"), ref = new Object3D(); o.matrixWorld.decompose(ref.position, ref.quaternion, ref.scale);
          if (!crowns.has(key)) crowns.set(key, []); crowns.get(key)!.push(ref);
        }
        if (
          typeof o.userData.assetId !== "string" ||
          o.userData.minTier > deps.world.composition.tier ||
          o.userData.maxTier < deps.world.composition.tier
        )
          return;
        const lit = d.decay.lights.includes(o.userData.lightGroup),
          key = `${o.userData.assetId}:${lit}:`;
        const reference = new Object3D();
        const first = anchorsFor(o.userData.assetId)[0];
        if (first) reference.userData.lightBase = deps.materials.lamps.base(placedLightId(d.id, d.origin, o.userData.name ?? o.name, first.name), anchorsFor(o.userData.assetId));
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
      if (d.layout.terrainChunks?.length || deps.world.composition.id === 'L7' || deps.world.composition.id === 'L6' || deps.world.composition.id === 'L5' || deps.world.composition.id === 'L4' || deps.world.composition.id === 'L3' || deps.world.composition.id === 'L2' || lab) {
        references.clear();
        // Scene Lab and L2: crowns follow kept placements, including station canopy clearance.
        if (d.layout.terrainChunks?.length || lab || deps.world.composition.id === 'L2') {
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
          if (first) reference.userData.lightBase = deps.materials.lamps.base(placedLightId(d.id, d.origin, p.id, first.name), anchorsFor(p.assetId));
          if (p.tint) reference.userData.tint = p.tint;
          if (!references.has(key)) references.set(key, []);
          references.get(key)!.push(reference);
        }
      }
      // Static vehicles (parked cars, wrecks, the APC) are authored on the y = 0 plane: rest them on the drawn road or paving under their wheels.
      for (const [key, refs] of references) if (/^veh\./.test(key)) for (const ref of refs) restOnGround(parts.ground, ref, key.split(':')[0], d.origin);
      for (const [colors, refs] of crowns) deps.foliage.addCrowns(refs, crownTokens.get(colors) ?? ['foliageDark', 'foliageLight'], d.origin);
      await Promise.all(
        [...references].map(async ([key, refs]) => {
          const [id, power, variant] = key.split(":"), decay = variant || undefined;
          if (id === 'prop.hmg-nest') {
            const prototype = await deps.registry.asset(id, power === 'true', deps.low() ? 'lod2' : 'lod0', decay);
            for (const ref of refs) {
              const nest = prototype.clone(true); nest.position.copy(ref.position); nest.quaternion.copy(ref.quaternion); nest.scale.copy(ref.scale); root.add(nest);
              const gun = nest.getObjectByName('gun'), muzzle = nest.getObjectByName('muzzle');
              if (gun && muzzle) parts.machineGuns.push({ root: nest, gun, muzzle });
            }
            return;
          }
          if (!worldAssets[id]) {
            // Non-world dressing (decals, kits, emergency vehicles) has no LOD bands: the low tier takes its LOD2 when authored.
            const prototype = await deps.registry.asset(id, power === 'true', deps.low() ? 'lod2' : 'lod0', decay);
            const batch = new InstancedGroup(prototype, refs.slice(), deps.instanceCapacity ?? refs.length);
            if (deps.low() && ['L3', 'L7'].includes(deps.world.composition.id)) batch.traverse(node => { if (node instanceof Mesh) node.castShadow = false; });
            const box = new Box3().setFromObject(prototype), bounds = box.getBoundingSphere(new Sphere()), size = box.getSize(new Vector3());
            parts.dressingEntries.push({ id, batch, refs, origin: d.origin, center: bounds.center, radius: bounds.radius, foot: { cx: bounds.center.x, cz: bounds.center.z, hx: size.x / 2, hz: size.z / 2 }, height: size.y });
            parts.dressingBatches.push(batch); root.add(batch); freezeBatch(batch); return;
          }
          const nearLoaded = initialLods.get(id)?.has('lod1') ?? true;
          const farLoaded = initialLods.get(id)?.has('lod2') ?? true;
          const prototypes = await Promise.all([nearLoaded ? 'lod1' : 'lod2', farLoaded ? 'lod2' : 'lod1'].map(lod => deps.registry.asset(id, power === 'true', lod as 'lod1' | 'lod2', decay)));
          // L1 uses the shared vertex-attribute instancing path; live counts stay
          // unchanged while shader code no longer depends on placement capacity.
          const capacity = Math.max(refs.length, deps.instanceCapacity ?? refs.length);
          const hero = new InstancedGroup(prototypes[0], refs.slice(), capacity), near = new InstancedGroup(prototypes[0], refs.slice(), capacity), far = new InstancedGroup(prototypes[1], refs.slice(), capacity);
          // Distant low-tier props keep their shaded production art without a shadow draw.
          if (deps.low()) far.traverse(node => { if (node instanceof Mesh) node.castShadow = false; });
          // Phone tier: a building heavier than 30k triangles per placement would be drawn twice (view + shadow) for little shade.
          if (deps.low()) {
            let triangles = 0; prototypes[0].traverse(node => { if (node instanceof Mesh) triangles += (node.geometry.index?.count ?? node.geometry.getAttribute('position').count) / 3; });
            if (triangles > 30000) for (const batch of [hero, near]) batch.traverse(node => { if (node instanceof Mesh) node.castShadow = false; });
          }
          for (const batch of [hero, near, far]) {
            batch.name = `inst:${id}`; parts.batches.push(batch); root.add(batch); freezeBatch(batch);
            batch.traverse(o => { if (o instanceof Mesh && o.name === 'window-light') parts.windows.push(o); });
          }
          const footBox = new Box3().setFromObject(prototypes[0]), dimensions = footBox.getSize(new Vector3()), footCenter = footBox.getCenter(new Vector3());
          parts.lodBatches.push({ foot: { cx: footCenter.x, cz: footCenter.z, hx: dimensions.x / 2, hz: dimensions.z / 2 }, hero, near, far, refs, id, decay, lit: power === 'true', loaded: false, nearLoaded, farLoaded, heroShown: nearLoaded ? 'lod1' : 'lod2', bands: [], origin: d.origin, height: dimensions.y, radius: Math.hypot(dimensions.x, dimensions.y, dimensions.z) * .55, half: Math.max(dimensions.x, dimensions.z) / 2 });
        }),
      );
      // Dynamic nav-blockers use the same positions/extents as their Rapier colliders.
      for (const blocker of d.blockers) {
        const s = blocker.max.map((v, i) => v - blocker.min[i]),
          p = blocker.min.map((v, i) => (v + blocker.max[i]) / 2);
        box(parts, deps.materials, 
          root,
          "woodWarm",
          s as [number, number, number],
          p as [number, number, number],
        );
      }
      for (const grass of Grass.tiles(d.layout, deps.grassMaterial, seed)) { parts.grass.push(grass); root.add(grass); }
      for (const b of d.layout.buildings) {
        const p = d.layout.placements.find((p) => p.id === b.id)!;
        tag(parts, root, b.label, [p.position[0], 2.8, b.aabb.max[2] + .6]);
      }
      for (const spot of d.gameplay.photoSpots) {
        const p = resolvePosition(spot.target, d.layout),
          target: [number, number, number] = [
            p[0] + d.origin[0],
            0,
            p[1] + d.origin[1],
          ];
        for (const tier of worldTiers)
          parts.spots.set(`${d.id}/W${tier}/${spot.name}`, {
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
  for (const f of deps.world.fires) {
    for (let i = 0; i < 3; i++) {
      const geometry = new ConeGeometry(0.55, 2.4 - i * 0.4, 7),
        mesh = new Mesh(
          geometry,
          deps.materials.get(
            i === 0 ? "sirenRed" : "schoolBusYellow",
            i === 0 ? 1.4 : 3,
          ),
        );
      mesh.position.set(f.x + (i - 1) * 0.45, 1.2 - i * 0.2, f.z);
      parts.ownedGeometry.push(geometry);
      deps.view.add(mesh);
    }
    const geometry = new SphereGeometry(1.3, 8, 6),
      material = new MeshBasicNodeMaterial({
        color: "#443d54",
        transparent: true,
        opacity: 0.55,
      });
    parts.ownedMaterials.push(material);
    for (let i = 0; i < 3; i++) {
      const mesh = new Mesh(geometry, material);
      mesh.position.set(f.x + 0.5 * i, 3 + i * 1.2, f.z);
      deps.view.add(mesh);
    }
    parts.ownedGeometry.push(geometry);
  }}

function restOnGround(ground: GroundField, ref: Object3D, id: string, origin: [number, number]): void {
  const size = (manifest as AssetDef[]).find(a => a.id === id)?.dimensions; if (!size || ref.position.y > .01 || /^veh\.(train|helicopter)/.test(id)) return;
  const hx = size.x * ref.scale.x * .32, hz = size.z * ref.scale.z * .4, c = Math.cos(ref.rotation.y), s = Math.sin(ref.rotation.y);
  const heights = [[hx, hz], [hx, -hz], [-hx, hz], [-hx, -hz]].map(([x, z]) => ground.height(origin[0] + ref.position.x + x * c + z * s, origin[1] + ref.position.z - x * s + z * c)).filter((h): h is number => h !== null).sort((a, b) => a - b);
  if (heights.length < 2) return;
  // Median of the four wheel spots: a lane stripe or a kerb under one wheel does not lift the whole car.
  const middle = heights.length / 2, height = heights.length % 2 ? heights[Math.floor(middle)] : (heights[middle - 1] + heights[middle]) / 2;
  ref.position.y = Math.max(ref.position.y, height);
}
function box(parts: DistrictParts, materials: Materials, root: Group, token: PaletteToken, size: [number, number, number], p: [number, number, number], shadow = true): void {
  const geometry = new BoxGeometry(...size);
  parts.ownedGeometry.push(geometry);
  const mesh = new Mesh(geometry, materials.get(token));
  mesh.position.fromArray(p);
  mesh.castShadow = shadow;
  mesh.receiveShadow = true;
  root.add(mesh);
}
/** Small camera-facing location tags; show once on approach, then fade over one second. */
function tag(parts: DistrictParts, root: Group, text: string, p: [number, number, number]): void {
  const canvas = document.createElement('canvas'); canvas.width = 320; canvas.height = 64;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#352c38dd'; ctx.roundRect(0, 0, 320, 64, 16); ctx.fill();
  ctx.fillStyle = '#ffc773'; ctx.font = 'bold 28px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(text, 160, 32, 300);
  const texture = new CanvasTexture(canvas); parts.textures.push(texture);
  const material = new SpriteMaterial({ map: texture, transparent: true, depthWrite: false }); parts.ownedMaterials.push(material);
  const sprite = new Sprite(material); sprite.name = text; sprite.position.fromArray(p); sprite.scale.set(1.8, .36, 1); sprite.visible = false; root.add(sprite);
  parts.tags.push({ sprite, entered: null, done: false });
}
/** Baked layout transforms are immutable after attachment. Visibility and
 * material cutaways remain live, but rendering need not revisit every child matrix. */
function freezeLayout(root: Object3D): void {
  root.updateWorldMatrix(true, true);
  root.traverse(node => { node.matrixAutoUpdate = false; node.matrixWorldAutoUpdate = false; });
  root.updateMatrixWorld = () => {};
}
/** Batch placement matrices (doors, roofs, physics props) live in instance buffers.
 * The batch's own transform stays fixed under the district's immutable origin. */
export function freezeBatch(batch: InstancedGroup): void {
  batch.visible = batch.references.length > 0;
  batch.freezeWorld();
}
/** Placement/crown data is read from the source GLB below. Its cloned empty
 * markers draw nothing, but otherwise enter every frame's matrix/shadow walk. */
function stripLayoutMarkers(root: Object3D): void {
  const markers: Object3D[] = [];
  root.traverse(node => {
    if (!(node instanceof Mesh) && !node.children.length && (typeof node.userData.assetId === 'string' || node.userData.foliageColors)) markers.push(node);
  });
  for (const marker of markers) marker.removeFromParent();
}
