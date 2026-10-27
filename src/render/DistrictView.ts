import {
  Box3,
  Group,
  Frustum,
  Matrix4,
  Sphere,
  Raycaster,
  type PerspectiveCamera,
  Vector3,
  InstancedMesh,
  Mesh,
  MeshBasicNodeMaterial,
  Object3D,
  type Material,
} from "three/webgpu";
import { attribute, luminance, uniform } from 'three/tsl';
import type { DistrictWorld } from "../sim/world/DistrictWorld";
import type { PushProp } from "../sim/interact/PropSystem";
import { ROOFED, type DistrictAssets } from "../assets/DistrictAssets";
import { spinNodes } from "../data/spinNodes";
import { buildingDoors, doorwayOf, doorZone, doorSwingS } from "../data/buildingDoors";
import type { Materials } from "./Materials";
import { worldAssets } from "../assets/worldDefinitions";
import { staticCollision } from "../assets/staticCollision";
import manifest from "../assets/manifest.json" with { type: 'json' };
import type { AssetDef } from "../assets/types";
import { InstancedGroup } from "./InstancedGroup";
import type { Grass, windPhase } from "./Grass";
import type { View } from './View';
import { Foliage } from './Foliage';
import { pickLod, propLod, lodPolicy, type Lod } from './lodPolicy';
import { occluderMinHeight, projectReveal, seeThrough } from './SeeThrough';
import { terrainPrefetchSeconds } from '../sim/world/TerrainChunks';
import type { NightAccents } from './NightAccents';
import { buildDistrict, DistrictParts, freezeBatch, type DressingEntry, type LodBatch } from './district/DistrictBuild';

// Repeated fence panels dominated V1 (109k faces in each view/shadow pass).
// Preserve the adjacent panels; farther boards need their silhouette, not fine bevels.
const privacyFenceLodPolicy = { lod1From: 6, lod2From: 45, hysteresis: 2 };
/** Low tier: hero interiors whose LOD1 alone is ≥ 50 k triangles (supermarket, civic centre) stay on their shadowless LOD2
 * even up close; the E20 rescue peak at the Grove Market otherwise spends ~100 k of the 500 k phone budget on one building. */
const heavyOnLow = (id: string) => ((worldAssets[id] as { authoredLodTriangles?: { lod1?: number } }).authoredLodTriangles?.lod1 ?? 0) >= 50_000;

/** Shared static instances; detailed prototypes stream only into the close view. */
export class DistrictView extends Group {
  /** Built by load() (see district/DistrictBuild); the fields below alias its collections. */
  private readonly parts = new DistrictParts();
  readonly spots = this.parts.spots;
  readonly batches = this.parts.batches;
  private readonly dressingBatches = this.parts.dressingBatches;
  private readonly dressingEntries = this.parts.dressingEntries;
  readonly windows = this.parts.windows;
  private readonly machineGuns = this.parts.machineGuns;
  private readonly machineGunPoint = new Vector3();
  private readonly machineGunHeading = new Vector3();
  private readonly machineGunInverse = new Matrix4();
  /** HMG nests retain their authored gun/muzzle hierarchy so shots rotate the
   * actual barrel and originate at its socket, including every nested transform. */
  machineGunState() { return this.machineGuns.map(n => ({ muzzle: n.muzzle.getWorldPosition(new Vector3()).toArray(), gun: n.gun.getWorldPosition(new Vector3()).toArray() })); }
  aimMachineGun(at: { x: number; z: number }, direction: { x: number; z: number }): Vector3 | null {
    let nest: typeof this.machineGuns[number] | undefined, distance = Infinity;
    for (const candidate of this.machineGuns) {
      const p = candidate.root.getWorldPosition(this.machineGunPoint), d = Math.hypot(p.x - at.x, p.z - at.z);
      if (d < distance) { nest = candidate; distance = d; }
    }
    if (!nest || distance > 3) return null;
    nest.root.updateWorldMatrix(true, true);
    const heading = this.machineGunHeading.set(direction.x, 0, direction.z).transformDirection(this.machineGunInverse.copy(nest.gun.parent!.matrixWorld).invert());
    nest.gun.rotation.y = -Math.atan2(heading.z, heading.x);
    nest.root.updateWorldMatrix(true, true); return nest.muzzle.getWorldPosition(new Vector3());
  }
  private readonly lodBatches = this.parts.lodBatches;
  /** Scene Lab A/B baseline: submit interiors of closed buildings too. */
  interiorCullOff = false;
  private interiorCpuMs = 0;
  private interiorRevision = 0;
  private appliedInteriorRevision = -1;
  private appliedInteriorCullOff = false;
  private readonly interiorPose = { x: Infinity, y: Infinity, z: Infinity };
  private readonly interiorBuildings: { entry: LodBatch; ref: Object3D; props: { entry: LodBatch | DressingEntry; ref: Object3D }[]; visible: boolean }[] = [];
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

  private readonly grass = this.parts.grass;
  private readonly foliage: Foliage;
  /** L9 night accents (studs, flares, lanterns, blinkers); render-only. */
  get accents(): NightAccents | undefined { return this.parts.accents; }
  private readonly districtRoots = this.parts.districtRoots;
  /** The drawn ground (baked roads, paving, lawns) for tyre contacts: see GroundField. */
  readonly ground = this.parts.ground;
  terrainState() { return this.parts.terrain?.snapshot() ?? null; }
  /** Borrowed geometry/materials: the caller warms and detaches this copy. */
  horizonForWarmup(): Group | null { return this.parts.terrainHorizon?.clone(true) ?? null; }
  private readonly mergedLayout = this.parts.mergedLayout;
  private readonly ownedGeometry = this.parts.ownedGeometry;
  private readonly perimeterPosts = this.parts.perimeterPosts;
  private readonly ownedMaterials = this.parts.ownedMaterials;
  private readonly windowMask = new MeshBasicNodeMaterial({ color: "#ffffff" });
  private readonly black = new MeshBasicNodeMaterial({ color: "#000000" });
  private readonly saved = new Map<Mesh, Material | Material[]>();
  private readonly tags = this.parts.tags;
  private labelTime = 0;
  private readonly textures = this.parts.textures;
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
    // The hole is module-global: a previous district (scene) must not leave it half open.
    seeThrough.strength.value = 0; seeThrough.cover.value = 0;
    this.name = "sunset-grove"; this.matrixAutoUpdate = false;
    this.foliage = new Foliage(materials, phase); this.add(this.foliage); this.foliage.setQuality(low);
  }
  async load(seed: number, focus?: { x: number; z: number }, heroAtSpawn = false): Promise<void> {
    this.phase.value = 0;
    await buildDistrict(this.parts, { view: this, world: this.world, materials: this.materials, registry: this.registry, grassMaterial: this.grassMaterial, foliage: this.foliage, low: () => this.low, instanceCapacity: this.instanceCapacity }, seed, focus, heroAtSpawn);
  }

  /** Drawn ground at a world point (null outside the baked district ground). */
  groundAt(x: number, z: number): number | null { return this.parts.terrain?.height(x, z) ?? this.ground.height(x, z); }
  /** Whole-slab frustum culling avoids submitting invisible merged dressing on mobile. */
  cull(view: View, tier: 'high' | 'low'): void {
    this.frustum.setFromProjectionMatrix(this.projection.multiplyMatrices(view.camera.projectionMatrix, view.camera.matrixWorldInverse));
    for (const { root, bounds } of this.districtRoots) root.visible = tier === 'high' || this.frustum.intersectsBox(bounds);
  }
  setQuality(tier: 'high' | 'low'): void {
    if (this.low !== (tier === 'low')) { this.low = tier === 'low'; this.cameraPosition = [Infinity, Infinity, Infinity]; }
    this.parts.terrain?.setQuality(tier);
    for (const grass of this.grass) grass.setQuality(tier === 'low', tier === 'low' ? this.materials.look.values.grassDensityLow : this.materials.look.values.grassDensity);
    this.foliage.setQuality(tier === 'low');
    this.parts.ambient?.setQuality(tier === 'low');
    // L3's merged rail/fence slabs span the district. Keep their visible art, without a second low-tier shadow submission.
    if (this.world.composition.id === 'L3') for (const mesh of this.mergedLayout) {
      mesh.userData.qualityCastShadow ??= mesh.castShadow;
      mesh.castShadow = tier === 'high' && mesh.userData.qualityCastShadow;
    }
    // Measured L6 cost: many small prop meshes render again into the sun shadow map.
    // Low preserves building/vehicle/hero shadows and omits detailed prop shadow casters.
    for (const batch of this.batches) if (worldAssets[batch.name.slice(5)].category === 'prop') batch.traverse(node => {
      if (node instanceof Mesh) { node.userData.qualityCastShadow ??= node.castShadow; node.castShadow = tier === 'high' && node.userData.qualityCastShadow; }
    });
  }
  setFoliageReveal(enabled: boolean): void { this.foliage.reveal = enabled; }
  updateFoliage(view: View, player?: { x: number; y: number; z: number }, target?: { x: number; y: number; z: number }, subject?: Box3): void {
    this.foliage.update(view, player, target); if (player) this.updateRoofs(player);
    seeThrough.floor.value = player ? Math.max(0, player.y - .7) : 0;
    seeThrough.cover.value = 0;
    // The shader tests actual foreground fragments, including gates and car roofs that a chest ray misses.
    // Open immediately at spawn, teleport and checkpoint restore; never widen to the screen edges.
    seeThrough.strength.value = player && this.foliage.reveal && !this.seeThroughOff ? 1 : 0;
    this.occluderId = '';
    this.cutPlacements.clear(); this.lensPlacements.clear();
    if (!player || !this.foliage.reveal || this.seeThroughOff) { this.updateCutPlacements(); this.updateInteriors(view, player); return; }
    const feet = player.y - .7;
    const box = subject ?? this.subjectBox.set(this.holeTarget.set(player.x - .55, feet, player.z - .55), this.holeCorner.set(player.x + .55, feet + 1.9, player.z + .55));
    projectReveal(view.camera, box);
    if (this.seeThroughReference) { this.updateCutPlacements(true); this.updateInteriors(view, player); seeThrough.solidRadius.value = 3; seeThrough.strength.value = 1; return; }
    // Only the placements that actually sit between the lens and some part of the subject (courier or whole player vehicle) are eligible for the cut.
    this.occludedSubject(view, box);
    // Clear only the foreground of placements that enclose most of the lens.
    // The normal courier disc stays bounded; player angle and zoom stay fixed.
    seeThrough.cover.value = +(this.lensPlacements.size > 0);
    this.updateCutPlacements();
    this.updateInteriors(view, player);
  }
  /** Resolve ownership once from oriented building footprints, independently of asset/placement names. */
  private tagInteriors(): void {
    for (const entry of this.lodBatches) if (worldAssets[entry.id].category === 'building' && /^bld\./.test(entry.id)) for (const ref of entry.refs) {
      this.interiorBuildings.push({ entry, ref, props: [], visible: true });
    }
    const props = [...this.lodBatches.filter(e => worldAssets[e.id].category === 'prop' && !worldAssets[e.id].foliage), ...this.dressingEntries.filter(e => (manifest as AssetDef[]).find(a => a.id === e.id)?.category === 'prop')];
    for (const entry of props) for (const ref of entry.refs) {
      const owner = this.interiorBuildings.find(b => {
        // PO #112 (L2 apron benches vanished under their sitters): the LOD0 bounds of a building include its open
        // apron/forecourt slabs. Only the walled enclosure is an interior; fall back to the bounds without wall boxes.
        const foot = DistrictView.enclosure(b.entry), [c, s, x, z] = DistrictView.footFrame({ foot, origin: b.entry.origin }, b.ref, false);
        // Require the complete prop footprint within the building, so doorstep/street furniture stays drawn.
        const [pc, ps, px, pz] = DistrictView.footFrame(entry, ref);
        for (const dx of [-entry.foot.hx, entry.foot.hx]) for (const dz of [-entry.foot.hz, entry.foot.hz]) {
          const wx = px + dx * ref.scale.x * pc + dz * ref.scale.z * ps - x;
          const wz = pz - dx * ref.scale.x * ps + dz * ref.scale.z * pc - z;
          if (Math.abs((wx * c - wz * s) / b.ref.scale.x) >= foot.hx - .2 || Math.abs((wx * s + wz * c) / b.ref.scale.z) >= foot.hz - .2) return false;
        }
        return ref.position.y >= b.ref.position.y && ref.position.y + entry.height * ref.scale.y < b.ref.position.y + b.entry.height * b.ref.scale.y;
      });
      if (owner) { owner.props.push({ entry, ref }); ref.userData.interiorBuilding = owner.ref; }
    }
  }
  /** Runs after reveal selection and applies changed buildings before this frame renders, even with a stationary camera. */
  private updateInteriors(view: View, player?: { x: number; y: number; z: number }): void {
    const started = performance.now();
    const x = player?.x ?? Infinity, y = player?.y ?? Infinity, z = player?.z ?? Infinity;
    if (this.appliedInteriorRevision === this.interiorRevision && this.appliedInteriorCullOff === this.interiorCullOff
      && this.interiorPose.x === x && this.interiorPose.y === y && this.interiorPose.z === z) {
      this.interiorCpuMs = performance.now() - started; return;
    }
    this.interiorPose.x = x; this.interiorPose.y = y; this.interiorPose.z = z;
    this.appliedInteriorRevision = this.interiorRevision; this.appliedInteriorCullOff = this.interiorCullOff;
    let changed: Set<LodBatch | DressingEntry> | undefined;
    for (const building of this.interiorBuildings) {
      const { entry, ref } = building;
      const [c, s, x, z] = DistrictView.footFrame(entry, ref);
      const dx = (player?.x ?? Infinity) - x, dz = (player?.z ?? Infinity) - z;
      const inside = !!player && Math.abs((dx * c - dz * s) / ref.scale.x) < entry.foot.hx && Math.abs((dx * s + dz * c) / ref.scale.z) < entry.foot.hz
        && player.y >= ref.position.y && player.y < ref.position.y + entry.height * ref.scale.y;
      const visible = this.interiorCullOff || inside || ref.userData.occluder === true;
      if (building.visible === visible) continue;
      building.visible = visible;
      for (const batch of [entry.hero, entry.near, entry.far]) batch.interiorVisible(visible, ref);
      for (const prop of building.props) { prop.ref.userData.interiorHidden = !visible; (changed ??= new Set()).add(prop.entry); }
    }
    for (const entry of changed ?? []) {
      if ('hero' in entry) { this.dirtyEntries.add(entry); this.partition(entry, view); }
      else this.partitionDressing(entry);
    }
    this.interiorCpuMs = performance.now() - started;
  }
  // Legacy footprint probes remain available for diagnostics; they no longer control reveal.
  /** How far in front of the lens a solid occluder counts as filling the view. Measured at L4 Kessler's Hardware
   * (PO 2026-10-12 blank viewport): the 35° follow camera saw its pitched roof 2.5-6 m away in every screen quarter. */
  static readonly hugDistance = 8;
  private readonly lensRay = new Vector3();
  private readonly lensPoint = new Vector3();
  private static readonly footFrames = new WeakMap<Object3D, { entry: Pick<LodBatch, 'foot' | 'origin'>; px: number; pz: number; qy: number; qw: number; sx: number; sz: number; frame: [number, number, number, number] }>();
  private readonly cutPlacements = new Set<Object3D>();
  private readonly lensPlacements = new Set<Object3D>();
  private updateCutPlacements(all = false): void {
    for (const entry of this.lodBatches) {
      if (entry.height < occluderMinHeight || worldAssets[entry.id].foliage) continue;
      for (const ref of entry.refs) {
        const enabled = all || this.cutPlacements.has(ref);
        const lens = this.lensPlacements.has(ref);
        if (ref.userData.occluder === enabled && !!ref.userData.lensOccluder === lens) continue;
        if (worldAssets[entry.id].category === 'building') this.interiorRevision++;
        entry.hero.seeThrough(enabled, ref, lens); entry.near.seeThrough(enabled, ref, lens); entry.far.seeThrough(enabled, ref, lens);
      }
    }
  }
  /** Local frame of a placement's real footprint (yaw only): `[cos, sin, centre x, centre z]` on the district plane. */
  private static readonly enclosures = new Map<string, LodBatch['foot']>();
  /** Local footprint of a building's walls: the union of its collision boxes at least 2 m tall (slabs, steps and
   * kerbs excluded). Buildings without wall boxes keep their LOD0 footprint. */
  static enclosure(entry: Pick<LodBatch, 'foot' | 'id'>): LodBatch['foot'] {
    let foot = this.enclosures.get(entry.id);
    if (!foot) {
      const walls = (staticCollision[entry.id]?.boxes ?? []).filter(b => b.max[1] - b.min[1] >= 2);
      if (!walls.length) foot = entry.foot;
      else {
        const x0 = Math.min(...walls.map(b => b.min[0])), x1 = Math.max(...walls.map(b => b.max[0])), z0 = Math.min(...walls.map(b => b.min[2])), z1 = Math.max(...walls.map(b => b.max[2]));
        foot = { cx: (x0 + x1) / 2, cz: (z0 + z1) / 2, hx: (x1 - x0) / 2, hz: (z1 - z0) / 2 };
      }
      this.enclosures.set(entry.id, foot);
    }
    return foot;
  }
  private static footFrame(entry: Pick<LodBatch, 'foot' | 'origin'>, ref: Object3D, cache = true): [number, number, number, number] {
    if (!cache) {
      const yaw = 2 * Math.atan2(ref.quaternion.y, ref.quaternion.w), c = Math.cos(yaw), s = Math.sin(yaw), { cx, cz } = entry.foot;
      return [c, s, ref.position.x + entry.origin[0] + cx * ref.scale.x * c + cz * ref.scale.z * s, ref.position.z + entry.origin[1] - cx * ref.scale.x * s + cz * ref.scale.z * c];
    }
    const cached = this.footFrames.get(ref);
    // Placement geometry is static; pushed props invalidate by their actual transform.
    // Reuse the frame across the camera ray and all forty lens samples.
    if (cached && cached.entry === entry && cached.px === ref.position.x && cached.pz === ref.position.z && cached.qy === ref.quaternion.y && cached.qw === ref.quaternion.w && cached.sx === ref.scale.x && cached.sz === ref.scale.z) return cached.frame;
    const yaw = 2 * Math.atan2(ref.quaternion.y, ref.quaternion.w), c = Math.cos(yaw), s = Math.sin(yaw), { cx, cz } = entry.foot;
    const frame: [number, number, number, number] = [c, s, ref.position.x + entry.origin[0] + cx * ref.scale.x * c + cz * ref.scale.z * s, ref.position.z + entry.origin[1] - cx * ref.scale.x * s + cz * ref.scale.z * c];
    this.footFrames.set(ref, { entry, px: ref.position.x, pz: ref.position.z, qy: ref.quaternion.y, qw: ref.quaternion.w, sx: ref.scale.x, sz: ref.scale.z, frame });
    return frame;
  }
  /** A tall solid placement sits right in front of the lens: points 1..hugDistance m along the centre and
   * the four quarter-screen rays (at least three of the five) fall inside its conservative upright box. */
  private huggedOccluder(view: View): boolean {
    const camera = view.camera, o = camera.position, near: { ref: Object3D; frame: [number, number, number, number]; sx: number; sz: number; hx: number; hz: number; y0: number; y1: number }[] = [];
    for (const entry of this.lodBatches) {
      if (entry.height < occluderMinHeight || worldAssets[entry.id].foliage) continue;
      for (const ref of entry.refs) {
        const x = ref.position.x + entry.origin[0], z = ref.position.z + entry.origin[1], half = entry.half * Math.max(ref.scale.x, ref.scale.z);
        if (Math.abs(x - o.x) < half + DistrictView.hugDistance && Math.abs(z - o.z) < half + DistrictView.hugDistance) near.push({ ref, frame: DistrictView.footFrame(entry, ref), sx: ref.scale.x, sz: ref.scale.z, hx: entry.foot.hx, hz: entry.foot.hz, y0: ref.position.y, y1: ref.position.y + entry.height * ref.scale.y });
      }
    }
    if (!near.length) return false;
    let blocked = 0;
    const hits = new Set<Object3D>();
    for (const [sx, sy] of [[0, 0], [-.5, -.5], [.5, -.5], [-.5, .5], [.5, .5]]) {
      this.lensRay.set(sx, sy, .5).unproject(camera).sub(o).normalize();
      for (let d = 1; d <= DistrictView.hugDistance; d++) {
        const p = this.lensPoint.copy(o).addScaledVector(this.lensRay, d);
        let hit = false;
        for (const b of near) {
          if (p.y <= b.y0 + .3 || p.y >= b.y1) continue;
          const [c, s, x, z] = b.frame, dx = p.x - x, dz = p.z - z;
          if (Math.abs((dx * c - dz * s) / b.sx) < b.hx && Math.abs((dx * s + dz * c) / b.sz) < b.hz) { hits.add(b.ref); hit = true; }
        }
        if (hit) { blocked++; break; }
      }
    }
    // Most of the frame, not a wall at one edge: a street corner keeps its ordinary courier-sized hole.
    if (blocked >= 3) for (const ref of hits) this.cutPlacements.add(ref);
    return blocked >= 3;
  }
  /** Debug/test: open the see-through hole across the whole screen (reference frame for visibility checks). */
  seeThroughReference = false;
  /** Scene Lab: solid occluders never open (the uncut picture the cut-pixel gate diffs against). */
  seeThroughOff = false;
  private frameSeconds = 0;
  /** Legacy footprint-probe diagnostic; rendering now tests foreground fragments directly. */
  occluderId = '';
  private readonly holeTarget = new Vector3();
  private readonly holeCorner = new Vector3();
  private readonly subjectBox = new Box3();
  private readonly subjectPoints = Array.from({ length: 9 }, () => new Vector3());
  /** Segment (camera to chest) against conservative upright boxes of the tall instanced placements nearby. */
  private occluded(view: View, player: { x: number; y: number; z: number }): boolean {
    return this.cutBlockers(view, player, [this.subjectPoints[0].set(player.x, player.y + .2, player.z)], 1);
  }
  /** Segments from the camera to the centre and corners of the subject (courier or whole player vehicle) against the same boxes.
   * Every placement hit by any segment is marked for the per-placement cut; the rest stay opaque. */
  private occludedSubject(view: View, subject: Box3): boolean {
    const points = this.subjectPoints, centre = subject.getCenter(this.holeTarget);
    let n = 0;
    points[n++].copy(centre);
    for (const x of [subject.min.x, subject.max.x]) for (const y of [subject.min.y, subject.max.y]) for (const z of [subject.min.z, subject.max.z]) points[n++].set(x, y, z);
    return this.cutBlockers(view, centre, points, n);
  }
  private cutBlockers(view: View, player: { x: number; z: number }, points: Vector3[], count: number): boolean {
    const o = view.camera.position;
    let blocked = false;
    for (const entry of this.lodBatches) {
      if (entry.height < occluderMinHeight || worldAssets[entry.id].foliage) continue;
      for (const ref of entry.refs) {
        // Reject distant placements before deriving their oriented centre. Include the
        // entire centre offset so this preserves the exact 24 m test below at every yaw.
        const offset = Math.abs(entry.foot.cx * ref.scale.x) + Math.abs(entry.foot.cz * ref.scale.z);
        if (Math.abs(ref.position.x + entry.origin[0] - player.x) > 24 + offset || Math.abs(ref.position.z + entry.origin[1] - player.z) > 24 + offset) continue;
        const [c, sn, x, z] = DistrictView.footFrame(entry, ref);
        if (Math.abs(x - player.x) > 24 || Math.abs(z - player.z) > 24) continue;
        // Slab test in the placement's local frame (oriented footprint, real height).
        const ox = o.x - x, oz = o.z - z, sx = ref.scale.x, sz = ref.scale.z;
        const lox = (ox * c - oz * sn) / sx, loz = (ox * sn + oz * c) / sz;
        for (let i = 0; i < count; i++) {
          const point = points[i], dx = point.x - o.x, dy = point.y - o.y, dz = point.z - o.z, ldx = (dx * c - dz * sn) / sx, ldz = (dx * sn + dz * c) / sz;
          let enter = 0, exit = 1;
          for (let axis = 0; axis < 3; axis++) {
            const origin = axis === 0 ? lox : axis === 1 ? o.y : loz;
            const delta = axis === 0 ? ldx : axis === 1 ? dy : ldz;
            const min = axis === 0 ? -entry.foot.hx : axis === 1 ? ref.position.y : -entry.foot.hz;
            const max = axis === 0 ? entry.foot.hx : axis === 1 ? ref.position.y + entry.height * ref.scale.y : entry.foot.hz;
            if (Math.abs(delta) < 1e-6) { if (origin < min || origin > max) { exit = -1; break; } continue; }
            const a = (min - origin) / delta, b = (max - origin) / delta;
            enter = Math.max(enter, Math.min(a, b)); exit = Math.min(exit, Math.max(a, b));
            if (enter > exit) break;
          }
          if (enter <= exit && enter < .98) { this.cutPlacements.add(ref); if (entry.id.startsWith('bld.') && this.coversLens(view, entry, ref)) this.lensPlacements.add(ref); this.occluderId = `${entry.id}@${(x).toFixed(1)},${(z).toFixed(1)}`; blocked = true; break; }
        }
      }
    }
    return blocked;
  }
  /** Enclosing shells and nearby facades covering most of the screen must not leave a flat viewport.
   * Keep ordinary occluders on the courier disc (the garage fixture covers only ~60% by its bounding rectangle). */
  private coversLens(view: View, entry: LodBatch, ref: Object3D): boolean {
    const camera = view.camera, o = camera.position, [c, s, x, z] = DistrictView.footFrame(entry, ref);
    const dx = o.x - x, dz = o.z - z, lx = Math.abs((dx * c - dz * s) / ref.scale.x), lz = Math.abs((dx * s + dz * c) / ref.scale.z);
    const top = ref.position.y + entry.height * ref.scale.y;
    if (o.y <= ref.position.y + .3 || o.y > top + DistrictView.hugDistance || lx > entry.foot.hx + DistrictView.hugDistance / Math.abs(ref.scale.x) || lz > entry.foot.hz + DistrictView.hugDistance / Math.abs(ref.scale.z)) return false;
    if (lx < entry.foot.hx && lz < entry.foot.hz && o.y < top) return true;
    let left = 1, right = -1, bottom = 1, upper = -1;
    for (let corner = 0; corner < 8; corner++) {
      const px = (corner & 1 ? 1 : -1) * entry.foot.hx * ref.scale.x, pz = (corner & 2 ? 1 : -1) * entry.foot.hz * ref.scale.z;
      const p = this.lensPoint.set(x + px * c + pz * s, corner & 4 ? top : ref.position.y, z - px * s + pz * c).applyMatrix4(camera.matrixWorldInverse);
      if (p.z >= -camera.near) return true;
      p.applyMatrix4(camera.projectionMatrix);
      left = Math.min(left, p.x); right = Math.max(right, p.x); bottom = Math.min(bottom, p.y); upper = Math.max(upper, p.y);
    }
    return Math.max(0, Math.min(1, right) - Math.max(-1, left)) * Math.max(0, Math.min(1, upper) - Math.max(-1, bottom)) / 4 >= 2 / 3;
  }
  private readonly barRay = Object.assign(new Raycaster(), { firstHitOnly: true });
  private readonly barBox = new Box3();
  private readonly barHit = new Vector3();
  /** Enemy bars test drawn solid geometry: navigation boxes intentionally omit roofs and upper walls. */
  occludesBar(camera: PerspectiveCamera, target: Vector3): boolean {
    this.barRay.set(camera.position, this.barHit.copy(target).sub(camera.position).normalize());
    this.barRay.far = camera.position.distanceTo(target) - .01;
    // Generated retaining faces enclose the L7 height field. Limit the filled-column
    // test to that terrain so overhanging decks still use their exact solid geometry.
    const ray = this.barRay.ray, horizontal = Math.hypot(ray.direction.x, ray.direction.z);
    if (this.parts.maxBarTerrainHeight > 0 && this.parts.stepEdges && horizontal > 1e-6) for (let distance = this.barRay.far - .15 / horizontal; distance > 0; distance -= .2 / horizontal) {
      const y = ray.origin.y + ray.direction.y * distance;
      const x = ray.origin.x + ray.direction.x * distance, z = ray.origin.z + ray.direction.z * distance;
      if (this.world.pavingHeight(x, z) > y + .05) return true;
      // All support tops are below the camera. Once above their maximum there
      // is no need to keep marching toward the lens.
      if (y > this.parts.maxBarTerrainHeight) break;
    }
    for (const entry of this.lodBatches) {
      if (entry.height < occluderMinHeight || worldAssets[entry.id].foliage || !worldAssets[entry.id].world.solid) continue;
      for (let i = 0; i < entry.refs.length; i++) {
        const ref = entry.refs[i], band = entry.bands[i];
        if (band === undefined || ref.userData.propEnabled === false) continue;
        const x = ref.position.x + entry.origin[0], z = ref.position.z + entry.origin[1];
        const half = entry.half * Math.max(ref.scale.x, ref.scale.z);
        this.barBox.min.set(x - half, ref.position.y, z - half);
        this.barBox.max.set(x + half, ref.position.y + entry.height * ref.scale.y, z + half);
        if (!this.barRay.ray.intersectBox(this.barBox, this.barHit) || this.barHit.distanceTo(camera.position) > this.barRay.far) continue;
        const batch = band === 'lod0' ? entry.hero : band === 'lod1' ? entry.near : entry.far;
        if (batch.occludesReference(this.barRay, ref)) return true;
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
        // Reject distant roofs before updating/inverting their placement matrices.
        // This sphere conservatively encloses the occupied prism at any yaw/scale.
        const radius = Math.hypot(x / 2, y, z / 2) * Math.max(ref.scale.x, ref.scale.y, ref.scale.z);
        let inside = false;
        if (Math.hypot(player.x - entry.origin[0] - ref.position.x, player.z - entry.origin[1] - ref.position.z) <= radius) {
          ref.worldToLocal(this.roofPoint.set(player.x - entry.origin[0], player.y ?? 0, player.z - entry.origin[1]));
          inside = Math.abs(this.roofPoint.x) < x / 2 - .2 && Math.abs(this.roofPoint.z) < z / 2 - .2 && this.roofPoint.y >= -.1 && this.roofPoint.y < y;
        }
        if (Boolean(ref.userData.roofHidden) === inside) continue;
        for (const group of [entry.hero, entry.near, entry.far]) group.roofVisible(!inside, ref);
      }
    }
  }
  /** Door openness (0 closed .. 1 open) per doored placement, eased toward its target. */
  private readonly doorOpen = new Map<Object3D, { entry: LodBatch; k: number; applied: number; way: ReturnType<typeof doorwayOf> }>();
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
        // Authored building placements do not move; only their leaf instance buffers do.
        let state = this.doorOpen.get(ref);
        if (!state) {
          const way = doorwayOf({ assetId: entry.id, position: [ref.position.x, ref.position.y, ref.position.z], yaw: 2 * Math.atan2(ref.quaternion.y, ref.quaternion.w), scale: [ref.scale.x, ref.scale.y, ref.scale.z] }, entry.origin);
          this.doorOpen.set(ref, state = { entry, k: 0, applied: -1, way });
        }
        const way = state.way;
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
    this.updateSpin(seconds);
  }
  private spinActive = false;
  private spinLevel = 0;
  private readonly spinAngles = new Map<string, number>();
  private cureCollected = false;
  /** The pedestal contains the terminal canister; consumed story props never remain beside the carried copy. */
  setCureCollected(collected: boolean): void {
    if (this.cureCollected === collected) return;
    this.cureCollected = collected;
    for (const entry of this.lodBatches) if (entry.id === 'prop.cure-canister-pedestal') this.dirtyEntries.add(entry);
  }
  /** Dispersal running (finale) or idle: fans, turbine rotors and valve wheels pick their rate from this. */
  setDispersalActive(on: boolean): void { this.spinActive = on; }
  /** Scene Lab reads the same rotation nodes that are written to the rendered batches. */
  dispersalProbe() { return { active: this.spinActive, level: this.spinLevel, angles: Object.fromEntries(this.spinAngles) }; }
  /** One shared angle per rotation node, written only into that node's split batch (no extra draw calls per placement). */
  private updateSpin(seconds: number): void {
    this.spinLevel += (+this.spinActive - this.spinLevel) * (1 - Math.exp(-1.2 * seconds));
    for (const entry of this.lodBatches) {
      const nodes = spinNodes[entry.id];
      if (!nodes || !entry.refs.length) continue;
      for (const spin of nodes) {
        const key = `${entry.id}/${spin.node}`;
        const rate = spin.idle + (spin.active - spin.idle) * this.spinLevel;
        if (rate < 1e-4 && this.spinAngles.has(key)) continue;
        const angle = ((this.spinAngles.get(key) ?? 0) + rate * seconds) % (Math.PI * 2);
        this.spinAngles.set(key, angle);
        for (const group of [entry.hero, entry.near, entry.far]) group.pose(spin.node, angle, undefined, spin.axis);
      }
    }
  }
  private lodPrefetchMetres = 0;
  /** Static matrices are repartitioned only when the camera moves; far props use LOD2. */
  updateLods(view: View, velocity: { x: number; z: number } = { x: 0, z: 0 }): void {
    this.lodPrefetchMetres = Math.hypot(velocity.x, velocity.z) * terrainPrefetchSeconds;
    if (this.parts.terrain) {
      this.parts.terrain.warm = this.warmHero; this.parts.terrain.swap = this.swapSlot;
      this.parts.terrain.update([view.cameraTarget.x, view.cameraTarget.z], [velocity.x, velocity.z]);
    }
    this.parts.ambient?.focus.value.set(view.focus.x, view.focus.z);
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
    for (const entry of this.dressingEntries) this.partitionDressing(entry);
    this.dirtyEntries.clear();
  }
  private partitionDressing(entry: DressingEntry): void {
    const { batch, refs, origin, center, radius } = entry, next: Object3D[] = [];
    for (const ref of refs) {
      if (ref.userData.interiorHidden) continue;
      this.bounds.center.copy(center).applyMatrix4(ref.matrix); this.bounds.center.x += origin[0]; this.bounds.center.z += origin[1];
      this.bounds.radius = radius * Math.max(ref.scale.x, ref.scale.y, ref.scale.z);
      if (this.frustum.intersectsSphere(this.bounds)) next.push(ref);
    }
    if (next.length === batch.references.length && next.every((ref, i) => ref === batch.references[i])) return;
    batch.references.length = 0; batch.references.push(...next); batch.visible = next.length > 0;
    for (const child of batch.children) if (child instanceof InstancedMesh) child.count = next.length;
    if (next.length) batch.update();
  }
  private partition(entry: LodBatch, view: View): void {
    const { hero, near, far, refs, origin, height, radius } = entry;
    const selectedRefs = new Map([[hero, [] as Object3D[]], [near, [] as Object3D[]], [far, [] as Object3D[]]]);
    const foliage = (!!worldAssets[entry.id].foliage || /^prop\.(tree|bush|hedge)/.test(entry.id));
    let prefetchNear = false, prefetchHero = false;
    for (const [index, ref] of refs.entries()) {
      if (ref.userData.interiorHidden) continue;
      if (entry.id === 'prop.cure-canister-pedestal' && this.cureCollected) continue;
      if (foliage && index >= Math.ceil(refs.length * this.materials.look.values.foliageDensity)) continue;
      const x = ref.position.x + origin[0], z = ref.position.z + origin[1];
      this.bounds.center.set(x, ref.position.y + height * ref.scale.y / 2, z); this.bounds.radius = radius * Math.max(ref.scale.x, ref.scale.y, ref.scale.z);
      const distance = view.inspectionPose && !view.inspectionGameLod ? view.camera.position.distanceTo(this.bounds.center) : Math.hypot(x - view.cameraTarget.x, z - view.cameraTarget.z);
      // Bound detail by distance and projected size; preserve the independent low-tier policy.
      const prop = worldAssets[entry.id].category === 'prop', factor = prop ? Math.min(1, radius / 5) : 1;
      const detailDistance = distance / factor;
      // Warm only tiers reachable within the shared two-second travel horizon, before
      // frustum entry or a band promotion can draw a coarser stand-in. Low props stay LOD2.
      const policy = entry.id === 'prop.privacy-fence' ? privacyFenceLodPolicy : lodPolicy;
      if (this.lodPrefetchMetres > 0) {
        if (this.low) prefetchNear ||= !prop && !heavyOnLow(entry.id) && distance <= 16 + this.lodPrefetchMetres;
        else {
          prefetchNear ||= distance <= policy.lod2From * factor + this.lodPrefetchMetres;
          prefetchHero ||= distance <= policy.lod1From * factor + this.lodPrefetchMetres;
        }
      }
      if (!this.frustum.intersectsSphere(this.bounds)) continue;
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
      selectedRefs.get(selected)!.push(ref);
    }
    for (const batch of [hero, near, far]) {
      const next = selectedRefs.get(batch)!;
      // Camera shake changes the frustum every frame, but usually keeps the same
      // wreck/collapse instances. Upload only a changed partition or moved prop.
      const changed = this.dirtyEntries.has(entry) || next.length !== batch.references.length || next.some((ref, i) => ref !== batch.references[i]);
      if (!changed) continue;
      batch.references.length = 0; batch.references.push(...next);
      batch.visible = batch.references.length > 0;
      for (const child of batch.children) if (child instanceof InstancedMesh) child.count = batch.references.length;
      if (batch.references.length) batch.update();
    }
    // A placement in view whose LOD1 has not arrived is drawn from the LOD2 placeholder: fetch the tier now (the background prepare()
    // walks the level nearest-first from the spawn and can be far behind a fast walker). Props never draw LOD1 on the low tier.
    if ((prefetchNear || near.references.length || hero.references.length && !this.low) && !entry.nearLoaded && !this.pending.has(entry)) {
      this.pending.set(entry, this.loadHero(entry, 'lod1').finally(() => this.pending.delete(entry)));
    }
    if ((prefetchHero || hero.references.length) && !entry.loaded && !this.pending.has(entry)) {
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
  /** Set with warmHero: resolves when a warmed tier may swap through the load gate. */
  swapSlot: (() => Promise<void>) | null = null;
  private async loadHero(entry: LodBatch, lod: Lod = 'lod0'): Promise<void> {
    const prototype = await this.registry.asset(entry.id, entry.lit, lod, entry.decay);
    if (this.disposed) return;
    await this.swapTier(entry, lod, lod, prototype);
    // The hero slot shows a LOD2 stand-in until its LOD0 arrives; once LOD1 is resident it shows that instead.
    if (lod === 'lod1' && !this.disposed && !entry.loaded && entry.heroShown === 'lod2') await this.swapTier(entry, 'lod0', 'lod1', prototype);
  }
  /** Replace a slot's batch (`slot`) with the prototype of mesh tier `lod`; the slot keeps its current references. */
  private async swapTier(entry: LodBatch, slot: Lod, lod: Lod, prototype: Object3D): Promise<void> {
    // Allocate full placement capacity, then retain only currently visible refs.
    const old = slot === 'lod0' ? entry.hero : slot === 'lod1' ? entry.near : entry.far;
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
    freezeBatch(replacement);
    old.traverse(node => { const index = this.windows.indexOf(node as Mesh); if (index !== -1) this.windows.splice(index, 1); });
    replacement.traverse(node => { if (node instanceof Mesh && node.name === 'window-light') this.windows.push(node); });
    this.batches[this.batches.indexOf(old)] = replacement;
    if (slot === 'lod0') { entry.hero = replacement; entry.heroShown = lod; if (lod === 'lod0') entry.loaded = true; }
    else if (slot === 'lod1') { entry.near = replacement; entry.nearLoaded = true; }
    else { entry.far = replacement; entry.farLoaded = true; }
    this.dirtyEntries.add(entry);
    old.removeFromParent(); old.dispose();
  }
  private marketDoorK: number | null = null;
  /**
   * L2 Grove Market doors (kit.market-doors, PO 10-15 "no visible door"): both glazed leaves swing 100 degrees outward when the
   * firefighters force the doors. The target follows the mission state every frame, so the open pose survives the checkpoint,
   * a restore and a reload (the first call jumps to the target instead of animating); changes ease over 0.45 s.
   */
  marketDoors(open: boolean, instant = false): void {
    const target = open ? 1 : 0, from = this.marketDoorK ?? target;
    const k = instant || this.marketDoorK === null ? target : from + Math.sign(target - from) * Math.min(Math.abs(target - from), this.frameSeconds / .45);
    this.marketDoorK = k;
    const eased = 1 - (1 - k) * (1 - k);
    for (const entry of this.lodBatches) if (entry.id === 'kit.market-doors') for (const ref of entry.refs) {
      if (ref.userData.marketDoorPose === eased) continue;
      ref.userData.marketDoorPose = eased;
      for (const group of [entry.hero, entry.near, entry.far]) { group.pose('marketLeafL', 1.75 * eased, ref); group.pose('marketLeafR', -1.75 * eased, ref); }
    }
  }
  /** Scene Lab door gate: the current openness (0 closed, 1 open) of the market doors, null before the first update. */
  marketDoorOpenness(): number | null { return this.marketDoorK; }
  /** Scene Lab door gate: every market door placement with its pose and leaf batches. */
  marketDoorPlacements(): { pose: number | null; leaves: string[] }[] { return this.lodBatches.filter(e => e.id === 'kit.market-doors').flatMap(e => e.refs.map(ref => ({ pose: ref.userData.marketDoorPose ?? null, leaves: e.hero.doors }))); }
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
          if (!entry.nearLoaded && (this.low || maximumDistance === Infinity)) await this.loadHero(entry, 'lod1');
          if (!entry.farLoaded) await this.loadHero(entry, 'lod2');
          if (lod === 'lod0' && !entry.loaded) await this.loadHero(entry);
        })();
        this.pending.set(entry, pending); await pending.finally(() => this.pending.delete(entry));
      }
    };
    await Promise.all(Array.from({ length: 4 }, worker));
  }
  async ready(): Promise<void> { await Promise.all([...this.pending.values(), this.parts.terrain?.ready()]); }
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
  /** Scene Lab: the courier hole's live state, and placements lower than an occluder whose drawn batch would still be cut
   * by it (must stay empty: PO 10-13 bench without planks at zoom 0.66). */
  seeThroughAudit(): { strength: number; cover: number; solidRadius: number; center: [number, number]; occluder: string; cutLowProps: string[]; cutPlacements: string[] } {
    const cut = new Set<string>(), eligible = new Set<string>();
    for (const entry of this.lodBatches) for (const ref of entry.refs) if (ref.userData.occluder === true) eligible.add(`${entry.id}@${(ref.position.x + entry.origin[0]).toFixed(1)},${(ref.position.z + entry.origin[1]).toFixed(1)}`);
    for (const entry of this.lodBatches) {
      if (entry.height >= occluderMinHeight || worldAssets[entry.id].foliage) continue;
      for (const batch of [entry.hero, entry.near, entry.far]) batch.traverse(node => {
        if (node instanceof Mesh && (Array.isArray(node.material) ? node.material : [node.material]).some(m => m.userData.seeThrough)) cut.add(entry.id);
      });
    }
    return { strength: seeThrough.strength.value, cover: seeThrough.cover.value, solidRadius: seeThrough.solidRadius.value, center: seeThrough.center.value.toArray() as [number, number], occluder: this.occluderId, cutLowProps: [...cut].sort(), cutPlacements: [...eligible].sort() };
  }
  lodState(): { assetId: string; origin: [number, number]; position: [number, number, number]; lod: Lod | 'culled' }[] {
    return this.lodBatches.flatMap(entry => entry.refs.map(ref => ({ assetId: entry.id, origin: entry.origin, position: ref.position.toArray() as [number, number, number],
      lod: entry.hero.references.includes(ref) ? 'lod0' as const : entry.near.references.includes(ref) ? 'lod1' as const : entry.far.references.includes(ref) ? 'lod2' as const : 'culled' as const })));
  }
  /** Placements drawn this frame from a coarser mesh than the band selected for them (the tier's real mesh has not arrived,
   * so a placeholder is shown). `lod` is the selected band, `shown` the mesh actually drawn. */
  placeholderDraws(): { assetId: string; lod: Lod; shown: Lod; x: number; z: number }[] {
    const out: { assetId: string; lod: Lod; shown: Lod; x: number; z: number }[] = [];
    for (const entry of this.lodBatches) for (const [lod, batch, shown] of [
      ['lod0', entry.hero, entry.heroShown],
      ['lod1', entry.near, entry.nearLoaded ? 'lod1' : 'lod2'],
    ] as const) {
      if (shown === lod || !batch.references.length) continue;
      for (const ref of batch.references) out.push({ assetId: entry.id, lod, shown, x: ref.position.x + entry.origin[0], z: ref.position.z + entry.origin[1] });
    }
    return out;
  }
  getState() {
    return {
      labels: this.tags.map(({ sprite }) => ({ text: sprite.name, visible: sprite.visible, opacity: sprite.material.opacity, width: sprite.scale.x, height: sprite.scale.y })),
      districts: this.world.districts.map((d) => d.id),
      terrain: this.terrainState(),
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
      interiors: { cpuMs: this.interiorCpuMs, buildings: this.interiorBuildings.length, hiddenBuildings: this.interiorBuildings.filter(b => !b.visible).length, placements: this.interiorBuildings.reduce((n, b) => n + b.props.length, 0) },
      foliage: this.foliage.getState(),
      seeThrough: { strength: seeThrough.strength.value, cover: seeThrough.cover.value, radius: seeThrough.radius.value, center: seeThrough.center.value.toArray() },
      movedProps: [...this.propLinks.values()].filter(Boolean).length,
      ambient: this.parts.ambient != null,
      photoSpots: [...this.spots.keys()],
      windowMeshes: this.windows.length,
    };
  }
  dispose(): void {
    this.disposed = true;
    this.parts.terrain?.dispose();
    this.parts.stepEdges?.dispose();
    for (const { material } of this.metroMaterials.values()) material.dispose(); this.metroMaterials.clear();
    this.parts.ambient?.dispose(); this.accents?.dispose();
    this.foliage.dispose();
    for (const b of this.batches) b.dispose();
    for (const b of this.dressingBatches) b.dispose(); this.dressingBatches.length = 0;
    for (const g of this.grass) g.dispose();
    for (const mesh of this.perimeterPosts) mesh.dispose(); this.perimeterPosts.length = 0;
    for (const g of this.ownedGeometry) g.dispose();
    for (const m of this.ownedMaterials) m.dispose();
    for (const t of this.textures) t.dispose();
    this.machineGuns.length = 0;
    this.windowMask.dispose();
    this.black.dispose();
    this.clear();
  }
}
