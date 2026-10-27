import {
  Box3,
  Group,
  Frustum,
  Matrix4,
  Sphere,
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
import type { DistrictAssets } from "../assets/DistrictAssets";
import { spinNodes } from "../data/spinNodes";
import { buildingDoors, doorwayOf, doorZone, doorSwingS } from "../data/buildingDoors";
import type { Materials } from "./Materials";
import { worldAssets } from "../assets/worldDefinitions";
import { InstancedGroup } from "./InstancedGroup";
import type { Grass, windPhase } from "./Grass";
import type { View } from './View';
import { Foliage } from './Foliage';
import { pickLod, propLod, lodPolicy, type Lod } from './lodPolicy';
import { seeThrough } from './SeeThrough';
import { terrainPrefetchSeconds } from '../sim/world/TerrainChunks';
import type { NightAccents } from './NightAccents';
import { buildDistrict, DistrictParts, freezeBatch, type DressingEntry, type LodBatch } from './district/DistrictBuild';
import { DistrictOcclusion } from './district/DistrictOcclusion';

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
  /** Courier see-through, interiors, roofs and the bar line of sight (district/DistrictOcclusion). */
  readonly occlusion: DistrictOcclusion;
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
    this.occlusion = new DistrictOcclusion(this.parts, world, (entry, view) => { this.dirtyEntries.add(entry); this.partition(entry, view); }, entry => this.partitionDressing(entry));
    // The hole is module-global: a previous district (scene) must not leave it half open.
    seeThrough.strength.value = 0; seeThrough.cover.value = 0;
    this.name = "sunset-grove"; this.matrixAutoUpdate = false;
    this.foliage = new Foliage(materials, phase); this.add(this.foliage); this.foliage.setQuality(low);
  }
  async load(seed: number, focus?: { x: number; z: number }, heroAtSpawn = false): Promise<void> {
    this.phase.value = 0;
    await buildDistrict(this.parts, { view: this, world: this.world, materials: this.materials, registry: this.registry, grassMaterial: this.grassMaterial, foliage: this.foliage, low: () => this.low, instanceCapacity: this.instanceCapacity }, seed, focus, heroAtSpawn);
    this.occlusion.tagInteriors();
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
    this.foliage.update(view, player, target); this.occlusion.update(view, this.foliage.reveal, player, subject);
  }
  private frameSeconds = 0;
  /** Enemy bars test drawn solid geometry: navigation boxes intentionally omit roofs and upper walls. */
  occludesBar(camera: PerspectiveCamera, target: Vector3): boolean { return this.occlusion.occludesBar(camera, target); }
  /** Scene Lab: the courier hole's live state and the placements it may cut. */
  seeThroughAudit() { return this.occlusion.seeThroughAudit(); }
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
      interiors: this.occlusion.interiorState(),
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
