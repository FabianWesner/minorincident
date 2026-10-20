import { wreckRoofHeight } from '../../levels/districts/wreckRoofHeight';
import { closeBarrierJoints } from '../../levels/barrierJoints';
import { l4BreakableLine } from '../../levels/L4/layout';
import { isWorldTier } from '../../levels/districts/types';
import type {
  DistrictLayout,
  LevelComposition,
  Point,
  Aabb,
  Placement,
} from "../../levels/districts/types";
import { districtGameplay } from "../../levels/districts/index";
import {
  resolveDecay,
  resolvePosition,
  minimapData,
  inside,
} from "../../levels/districts/validate";
import { crossValidate } from "../../levels/districts/crossValidate";
import { placementColliders } from "../../levels/districts/staticCollision";
import { bakeNav } from "./NavGrid";
import { pushableProps } from "../../data/pushableProps";
/** Sim-side level assembly. Render consumes the same immutable loaded layouts/placements. */
/** Horizontal reach of a walkable support past its collider edge (m): closes authoring seams between tiled slabs. */
export const supportSeam = .03;
export class DistrictWorld {
  readonly districts;
  readonly nav;
  readonly playerStart: Point;
  readonly playerStartHeight: number;
  /** Visible perimeter fence footprints; shared district seams stay open. */
  readonly boundaries: Aabb[] = [];
  readonly warnings: string[] = [];
  /** Wreck tops are support only for actors already on their layer; they never lift a street actor. */
  private readonly wreckRoofs = new Map<number, { bounds: Aabb; placement: Placement; origin: Point }[]>();
  private readonly supports = new Map<number, Aabb[]>();
  /** Raised sidewalk slabs (layout surfaces, tile >= 10 cm) bucketed like `supports`: the paving is baked into the layout GLB without a collider, so walkers need its height from here. */
  private readonly slabs = new Map<number, { min: Point; max: Point; polygon: Point[]; height: number }[]>();
  private readonly paving = new Map<number, { polygon: Point[]; origin: Point; height: number }[]>();
  readonly fires: {
    x: number;
    z: number;
    radius: number;
    damagePerSecond: number;
  }[] = [];
  constructor(
    readonly composition: LevelComposition,
    layouts: DistrictLayout[],
    seed: number,
  ) {
    if (!isWorldTier(composition.tier)) throw new RangeError("Tier must be W0…W6");
    this.districts = composition.districts.map((d) => {
      const source = layouts.find((l) => l.district === d.id);
      if (!source) throw new Error(`Missing layout: ${d.id}`);
      const layout = { ...source, placements: closeBarrierJoints(source.placements) };
      const gameplay = { ...(d.gameplay ?? districtGameplay[d.id]), ...d.overrides };
      if (gameplay.decay.some(layer => !isWorldTier(layer.tier))) throw new RangeError(`Invalid gameplay decay tier: ${d.id}`);
      const decay = resolveDecay(layout, composition.tier),
        gameplayLayers = gameplay.decay.filter(
          (l) => l.tier <= composition.tier,
        );
      if (composition.id === 'L4' && d.id === 'D-FAIR') {
        const replaced = new Set(l4BreakableLine.map(line => line.placementId));
        decay.placements = decay.placements.filter(p => !replaced.has(p.id));
        decay.colliders = decay.colliders.filter(c => !replaced.has(c.id.split('/')[0]));
      }
      // Pushable props are dynamic bodies (PropSystem): no static collider, no nav-grid footprint.
      const pushables = decay.placements.filter((p) => pushableProps[p.assetId]);
      const pushed = new Set(pushables.map((p) => p.id));
      decay.colliders = placementColliders(decay.placements, decay.colliders).filter((c) => !pushed.has(c.id.split("/")[0]));
      const off = new Set(gameplayLayers.flatMap((l) => l.powerOut));
      decay.lights = decay.lights.filter((id) => !off.has(id));
      return {
        ...d,
        layout,
        gameplay,
        decay,
        blockers: gameplayLayers.flatMap((l) => l.blockers),
        pushables,
      };
    });
    for (const d of this.districts) for (const c of d.decay.colliders) if (c.walkable) {
      // PO 2026-10-13 "Corgi sunken": tiled walkable tops (the fire station apron: 0.75 x 1.5 m slabs) leave 3-4 cm seams; a
      // point sample in a seam dropped the corgi (and any pedestrian) 10 cm into the drawn slab while the courier's capsule spanned it.
      // Each support reaches `supportSeam` past its edge, so seams narrower than twice that are closed for every caller.
      const a: Aabb = { min: [c.aabb.min[0] + d.origin[0] - supportSeam, c.aabb.min[1], c.aabb.min[2] + d.origin[1] - supportSeam], max: [c.aabb.max[0] + d.origin[0] + supportSeam, c.aabb.max[1], c.aabb.max[2] + d.origin[1] + supportSeam] };
      for (let z = Math.floor(a.min[2] / 4); z <= Math.floor(a.max[2] / 4); z++) for (let x = Math.floor(a.min[0] / 4); x <= Math.floor(a.max[0] / 4); x++) {
        const key = DistrictWorld.groundKey(x, z), bucket = this.supports.get(key) ?? []; bucket.push(a); this.supports.set(key, bucket);
      }
    }
    for (const d of this.districts) for (const p of d.decay.placements) {
      if (!p.assetId.startsWith('veh.') || !['wrecked', 'burned'].includes(p.decay ?? '')) continue;
      for (const c of d.decay.colliders) {
        if (!c.id.startsWith(`${p.id}/`) || c.walkable) continue;
        const a: Aabb = { min: [c.aabb.min[0] + d.origin[0], c.aabb.min[1], c.aabb.min[2] + d.origin[1]], max: [c.aabb.max[0] + d.origin[0], c.aabb.max[1], c.aabb.max[2] + d.origin[1]] };
        for (let z = Math.floor(a.min[2] / 4); z <= Math.floor(a.max[2] / 4); z++) for (let x = Math.floor(a.min[0] / 4); x <= Math.floor(a.max[0] / 4); x++) {
          const key = DistrictWorld.groundKey(x, z), bucket = this.wreckRoofs.get(key) ?? []; bucket.push({ bounds: a, placement: p, origin: d.origin }); this.wreckRoofs.set(key, bucket);
        }
      }
    }
    for (const d of this.districts) for (const surf of d.layout.surfaces) if (surf.surface === "tile" && (surf.height ?? 0) >= .1) {
      const polygon = surf.polygon.map((q): Point => [q[0] + d.origin[0], q[1] + d.origin[1]]);
      const xs = polygon.map(q => q[0]), zs = polygon.map(q => q[1]), min: Point = [Math.min(...xs), Math.min(...zs)], max: Point = [Math.max(...xs), Math.max(...zs)];
      for (let z = Math.floor(min[1] / 4); z <= Math.floor(max[1] / 4); z++) for (let x = Math.floor(min[0] / 4); x <= Math.floor(max[0] / 4); x++) {
        const key = DistrictWorld.groundKey(x, z), bucket = this.slabs.get(key) ?? []; bucket.push({ min, max, polygon, height: surf.height! }); this.slabs.set(key, bucket);
      }
    }
    // Vehicle contact probes sample thousands of vertices. Keep the original
    // local polygon decisions, but visit only surfaces in that probe's cell.
    for (const d of this.districts) for (const surface of d.layout.surfaces) if ((surface.height ?? 0) > 0) {
      const xs = surface.polygon.map(p => p[0] + d.origin[0]), zs = surface.polygon.map(p => p[1] + d.origin[1]);
      const minX = Math.min(...xs) - 1e-9, maxX = Math.max(...xs) + 1e-9, minZ = Math.min(...zs) - 1e-9, maxZ = Math.max(...zs) + 1e-9;
      const entry = { polygon: surface.polygon, origin: d.origin, height: surface.height! };
      for (let z = Math.floor(minZ / 4); z <= Math.floor(maxZ / 4); z++) for (let x = Math.floor(minX / 4); x <= Math.floor(maxX / 4); x++) {
        const key = DistrictWorld.groundKey(x, z), bucket = this.paving.get(key) ?? []; bucket.push(entry); this.paving.set(key, bucket);
      }
    }
    const edges = new Map<string, { a: Point; b: Point; count: number }>();
    for (const d of this.districts) for (let i = 1; i < d.layout.bounds.length; i++) {
      const a: Point = [d.layout.bounds[i - 1][0] + d.origin[0], d.layout.bounds[i - 1][1] + d.origin[1]];
      const b: Point = [d.layout.bounds[i][0] + d.origin[0], d.layout.bounds[i][1] + d.origin[1]];
      const key = [a.join(','), b.join(',')].sort().join(':');
      const edge = edges.get(key);
      if (edge) edge.count++; else edges.set(key, { a, b, count: 1 });
    }
    for (const { a, b, count } of edges.values()) if (count === 1) this.boundaries.push({
      min: [Math.min(a[0], b[0]) - .08, 0, Math.min(a[1], b[1]) - .08],
      max: [Math.max(a[0], b[0]) + .08, 1.05, Math.max(a[1], b[1]) + .08],
    });
    this.nav = bakeNav(
      this.districts.map((d) => ({
        layout: d.layout,
        origin: d.origin,
        colliders: d.decay.colliders.filter(c => !c.walkable).map((c) => c.aabb).concat(d.blockers),
      })),
      seed,
      .5,
    );
    for (const d of this.districts) {
      const result = crossValidate(d.gameplay, d.layout, this.nav, d.origin);
      if (result.errors.length) throw new Error(result.errors.join("\n"));
      this.warnings.push(...result.warnings);
      for (const layer of d.gameplay.decay)
        if (layer.tier <= composition.tier)
          for (const fire of layer.fires) {
            const p = resolvePosition(fire.position, d.layout);
            this.fires.push({
              x: p[0] + d.origin[0],
              z: p[1] + d.origin[1],
              radius: fire.radius,
              damagePerSecond: fire.damagePerSecond,
            });
          }
    }
    const d = this.districts[0],
      p = resolvePosition(d.gameplay.playerStart, d.layout);
    this.playerStart = [p[0] + d.origin[0], p[1] + d.origin[1]];
    const start = d.gameplay.playerStart;
    this.playerStartHeight = 'anchor' in start ? d.layout.anchors[start.anchor].position[1] : 0;
    const reached = this.nav.flood(this.playerStart);
    for (const d of this.districts)
      for (const obj of d.gameplay.objectives) {
        const p = resolvePosition(obj.position, d.layout);
        if (!reached[this.nav.index(p[0] + d.origin[0], p[1] + d.origin[1])])
          throw new Error(`Unreachable level objective: ${d.id}/${obj.id}`);
      }
  }
  private static groundKey(x: number, z: number): number { return (x + 32768) * 65536 + z + 32768; }
  /** Exact low compound supports and raised sidewalk slabs; roofs and solid props never lift NPCs. */
  groundHeight(x: number, z: number): number {
    let height = 0;
    const key = DistrictWorld.groundKey(Math.floor(x / 4), Math.floor(z / 4));
    for (const a of this.supports.get(key) ?? []) {
      if (x >= a.min[0] && x <= a.max[0] && z >= a.min[2] && z <= a.max[2]) height = Math.max(height, a.max[1]);
    }
    for (const s of this.slabs.get(key) ?? []) {
      if (s.height > height && x >= s.min[0] && x <= s.max[0] && z >= s.min[1] && z <= s.max[1] && inside([x, z], s.polygon)) height = s.height;
    }
    return height;
  }
  /**
   * The walkable support a body at (x, z) whose feet are at `feet` stands on: the highest support or paving top that is at most
   * `rise` (a step) above the feet. Unlike `pavingHeight` (the highest top anywhere in the column) a body on the street below the
   * highway deck stays on the street, and one that left the deck edge drops to what is under it.
   */
  supportBelow(x: number, z: number, feet: number, rise = .6): number {
    const limit = feet + rise, key = DistrictWorld.groundKey(Math.floor(x / 4), Math.floor(z / 4));
    let height = this.groundBelow(x, z, feet, rise);
    for (const s of this.paving.get(key) ?? []) if (s.height <= limit && s.height > height && inside([x - s.origin[0], z - s.origin[1]], s.polygon)) height = s.height;
    return height;
  }
  /** `groundHeight` for a body at `feet`: only supports and slabs it can step onto, so the street under a deck stays the street (the
   * player's grounding; `supportBelow` adds the baked paving on top). */
  groundBelow(x: number, z: number, feet: number, rise = .6): number {
    const limit = feet + rise, key = DistrictWorld.groundKey(Math.floor(x / 4), Math.floor(z / 4));
    let height = 0;
    for (const a of this.supports.get(key) ?? []) if (a.max[1] <= limit && a.max[1] > height && x >= a.min[0] && x <= a.max[0] && z >= a.min[2] && z <= a.max[2]) height = a.max[1];
    for (const roof of this.wreckRoofs.get(key) ?? []) {
      const a = roof.bounds;
      if (x < a.min[0] || x > a.max[0] || z < a.min[2] || z > a.max[2]) continue;
      const top = wreckRoofHeight(roof.placement, x - roof.origin[0], z - roof.origin[1]) ?? a.max[1];
      // An actor already on the clipped collision top belongs on the actual visible roof, even when the roof exceeds that band.
      if (top <= limit || feet >= a.max[1] - .05) height = Math.max(height, top);
    }
    for (const s of this.slabs.get(key) ?? []) if (s.height <= limit && s.height > height && x >= s.min[0] && x <= s.max[0] && z >= s.min[1] && z <= s.max[1] && inside([x, z], s.polygon)) height = s.height;
    return height;
  }
  /** Visible paving is baked into the layout GLB rather than the solid-prop collider set. */
  pavingHeight(x: number, z: number): number {
    let height = this.groundHeight(x, z);
    for (const s of this.paving.get(DistrictWorld.groundKey(Math.floor(x / 4), Math.floor(z / 4))) ?? []) if (s.height > height && inside([x - s.origin[0], z - s.origin[1]], s.polygon)) height = s.height;
    return height;
  }
  getState() {
    return {
      id: this.composition.id,
      tier: this.composition.tier,
      navHash: this.nav.hash,
      fireEmitters: this.fires.length,
      warnings: this.warnings,
      districts: this.districts.map((d) => ({
        id: d.id,
        origin: d.origin,
        propCount: d.decay.placements.length,
        wreckCount: d.decay.placements.filter((p) => p.assetId === "veh.wreck")
          .length,
        lightsOn: d.decay.lights,
        removed: d.decay.removed,
        minimap: minimapData(d.layout),
      })),
    };
  }
}
