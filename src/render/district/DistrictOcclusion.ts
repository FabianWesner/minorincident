import { Box3, Mesh, Raycaster, Vector3, type Object3D, type PerspectiveCamera } from 'three/webgpu';
import type { DistrictWorld } from '../../sim/world/DistrictWorld';
import { ROOFED } from '../../assets/DistrictAssets';
import { worldAssets } from '../../assets/worldDefinitions';
import { staticCollision } from '../../assets/staticCollision';
import manifest from '../../assets/manifest.json' with { type: 'json' };
import type { AssetDef } from '../../assets/types';
import type { View } from '../View';
import { occluderMinHeight, projectReveal, seeThrough } from '../SeeThrough';
import type { DistrictParts, DressingEntry, LodBatch } from './DistrictBuild';

/** District visibility policy: which placements the courier see-through cuts, closed building interiors, lifted roofs
 * and the health-bar line of sight. Reads the built parts; changed interiors are handed back for repartitioning. */
export class DistrictOcclusion {
  constructor(
    private readonly parts: DistrictParts,
    private readonly world: DistrictWorld,
    /** Re-select the LOD partition of a batch whose interior placements changed. */
    private readonly repartition: (entry: LodBatch, view: View) => void,
    private readonly repartitionDressing: (entry: DressingEntry) => void,
  ) {}
  /** Interior culling counters for getState(). */
  interiorState() { return { cpuMs: this.interiorCpuMs, buildings: this.interiorBuildings.length, hiddenBuildings: this.interiorBuildings.filter(b => !b.visible).length, placements: this.interiorBuildings.reduce((n, b) => n + b.props.length, 0) }; }
  /** Scene Lab A/B baseline: submit interiors of closed buildings too. */
  interiorCullOff = false;
  private interiorCpuMs = 0;
  private interiorRevision = 0;
  private appliedInteriorRevision = -1;
  private appliedInteriorCullOff = false;
  private readonly interiorPose = { x: Infinity, y: Infinity, z: Infinity };
  private readonly interiorBuildings: { entry: LodBatch; ref: Object3D; props: { entry: LodBatch | DressingEntry; ref: Object3D }[]; visible: boolean }[] = [];
  /** Reveal and interior state for this frame: roofs, the courier see-through cut and closed interiors. Runs after the foliage update. */
  update(view: View, reveal: boolean, player?: { x: number; y: number; z: number }, subject?: Box3): void {
    if (player) this.updateRoofs(player);
    seeThrough.floor.value = player ? Math.max(0, player.y - .7) : 0;
    seeThrough.cover.value = 0;
    // The shader tests actual foreground fragments, including gates and car roofs that a chest ray misses.
    // Open immediately at spawn, teleport and checkpoint restore; never widen to the screen edges.
    seeThrough.strength.value = player && reveal && !this.seeThroughOff ? 1 : 0;
    this.occluderId = '';
    this.cutPlacements.clear(); this.lensPlacements.clear();
    if (!player || !reveal || this.seeThroughOff) { this.updateCutPlacements(); this.updateInteriors(view, player); return; }
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
  tagInteriors(): void {
    for (const entry of this.parts.lodBatches) if (worldAssets[entry.id].category === 'building' && /^bld\./.test(entry.id)) for (const ref of entry.refs) {
      this.interiorBuildings.push({ entry, ref, props: [], visible: true });
    }
    const props = [...this.parts.lodBatches.filter(e => worldAssets[e.id].category === 'prop' && !worldAssets[e.id].foliage), ...this.parts.dressingEntries.filter(e => (manifest as AssetDef[]).find(a => a.id === e.id)?.category === 'prop')];
    for (const entry of props) for (const ref of entry.refs) {
      const owner = this.interiorBuildings.find(b => {
        // PO #112 (L2 apron benches vanished under their sitters): the LOD0 bounds of a building include its open
        // apron/forecourt slabs. Only the walled enclosure is an interior; fall back to the bounds without wall boxes.
        const foot = DistrictOcclusion.enclosure(b.entry), [c, s, x, z] = DistrictOcclusion.footFrame({ foot, origin: b.entry.origin }, b.ref, false);
        // Require the complete prop footprint within the building, so doorstep/street furniture stays drawn.
        const [pc, ps, px, pz] = DistrictOcclusion.footFrame(entry, ref);
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
      const [c, s, x, z] = DistrictOcclusion.footFrame(entry, ref);
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
      if ('hero' in entry) this.repartition(entry, view);
      else this.repartitionDressing(entry);
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
    for (const entry of this.parts.lodBatches) {
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
    const cached = cache ? this.footFrames.get(ref) : undefined;
    // Placement geometry is static; pushed props invalidate by their actual transform.
    // Reuse the frame across the camera ray and all forty lens samples.
    if (cached && cached.entry === entry && cached.px === ref.position.x && cached.pz === ref.position.z && cached.qy === ref.quaternion.y && cached.qw === ref.quaternion.w && cached.sx === ref.scale.x && cached.sz === ref.scale.z) return cached.frame;
    const yaw = 2 * Math.atan2(ref.quaternion.y, ref.quaternion.w), c = Math.cos(yaw), s = Math.sin(yaw), { cx, cz } = entry.foot;
    const frame: [number, number, number, number] = [c, s, ref.position.x + entry.origin[0] + cx * ref.scale.x * c + cz * ref.scale.z * s, ref.position.z + entry.origin[1] - cx * ref.scale.x * s + cz * ref.scale.z * c];
    if (cache) this.footFrames.set(ref, { entry, px: ref.position.x, pz: ref.position.z, qy: ref.quaternion.y, qw: ref.quaternion.w, sx: ref.scale.x, sz: ref.scale.z, frame });
    return frame;
  }
  /** A tall solid placement sits right in front of the lens: points 1..hugDistance m along the centre and
   * the four quarter-screen rays (at least three of the five) fall inside its conservative upright box. */
  private huggedOccluder(view: View): boolean {
    const camera = view.camera, o = camera.position, near: { ref: Object3D; frame: [number, number, number, number]; sx: number; sz: number; hx: number; hz: number; y0: number; y1: number }[] = [];
    for (const entry of this.parts.lodBatches) {
      if (entry.height < occluderMinHeight || worldAssets[entry.id].foliage) continue;
      for (const ref of entry.refs) {
        const x = ref.position.x + entry.origin[0], z = ref.position.z + entry.origin[1], half = entry.half * Math.max(ref.scale.x, ref.scale.z);
        if (Math.abs(x - o.x) < half + DistrictOcclusion.hugDistance && Math.abs(z - o.z) < half + DistrictOcclusion.hugDistance) near.push({ ref, frame: DistrictOcclusion.footFrame(entry, ref), sx: ref.scale.x, sz: ref.scale.z, hx: entry.foot.hx, hz: entry.foot.hz, y0: ref.position.y, y1: ref.position.y + entry.height * ref.scale.y });
      }
    }
    if (!near.length) return false;
    let blocked = 0;
    const hits = new Set<Object3D>();
    for (const [sx, sy] of [[0, 0], [-.5, -.5], [.5, -.5], [-.5, .5], [.5, .5]]) {
      this.lensRay.set(sx, sy, .5).unproject(camera).sub(o).normalize();
      for (let d = 1; d <= DistrictOcclusion.hugDistance; d++) {
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
    for (const entry of this.parts.lodBatches) {
      if (entry.height < occluderMinHeight || worldAssets[entry.id].foliage) continue;
      for (const ref of entry.refs) {
        // Reject distant placements before deriving their oriented centre. Include the
        // entire centre offset so this preserves the exact 24 m test below at every yaw.
        const offset = Math.abs(entry.foot.cx * ref.scale.x) + Math.abs(entry.foot.cz * ref.scale.z);
        if (Math.abs(ref.position.x + entry.origin[0] - player.x) > 24 + offset || Math.abs(ref.position.z + entry.origin[1] - player.z) > 24 + offset) continue;
        const [c, sn, x, z] = DistrictOcclusion.footFrame(entry, ref);
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
    const camera = view.camera, o = camera.position, [c, s, x, z] = DistrictOcclusion.footFrame(entry, ref);
    const dx = o.x - x, dz = o.z - z, lx = Math.abs((dx * c - dz * s) / ref.scale.x), lz = Math.abs((dx * s + dz * c) / ref.scale.z);
    const top = ref.position.y + entry.height * ref.scale.y;
    if (o.y <= ref.position.y + .3 || o.y > top + DistrictOcclusion.hugDistance || lx > entry.foot.hx + DistrictOcclusion.hugDistance / Math.abs(ref.scale.x) || lz > entry.foot.hz + DistrictOcclusion.hugDistance / Math.abs(ref.scale.z)) return false;
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
    for (const entry of this.parts.lodBatches) {
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
    for (const entry of this.parts.lodBatches) {
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
  /** Scene Lab: the courier hole's live state, and placements lower than an occluder whose drawn batch would still be cut
   * by it (must stay empty: PO 10-13 bench without planks at zoom 0.66). */
  seeThroughAudit(): { strength: number; cover: number; solidRadius: number; center: [number, number]; occluder: string; cutLowProps: string[]; cutPlacements: string[] } {
    const cut = new Set<string>(), eligible = new Set<string>();
    for (const entry of this.parts.lodBatches) for (const ref of entry.refs) if (ref.userData.occluder === true) eligible.add(`${entry.id}@${(ref.position.x + entry.origin[0]).toFixed(1)},${(ref.position.z + entry.origin[1]).toFixed(1)}`);
    for (const entry of this.parts.lodBatches) {
      if (entry.height >= occluderMinHeight || worldAssets[entry.id].foliage) continue;
      for (const batch of [entry.hero, entry.near, entry.far]) batch.traverse(node => {
        if (node instanceof Mesh && (Array.isArray(node.material) ? node.material : [node.material]).some(m => m.userData.seeThrough)) cut.add(entry.id);
      });
    }
    return { strength: seeThrough.strength.value, cover: seeThrough.cover.value, solidRadius: seeThrough.solidRadius.value, center: seeThrough.center.value.toArray() as [number, number], occluder: this.occluderId, cutLowProps: [...cut].sort(), cutPlacements: [...eligible].sort() };
  }}
