import type {
  DistrictLayout,
  LevelComposition,
  Point,
  Aabb,
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
export class DistrictWorld {
  readonly districts;
  readonly nav;
  readonly playerStart: Point;
  /** Visible perimeter fence footprints; shared district seams stay open. */
  readonly boundaries: Aabb[] = [];
  readonly warnings: string[] = [];
  private readonly supports = new Map<string, Aabb[]>();
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
    this.districts = composition.districts.map((d) => {
      const layout = layouts.find((l) => l.district === d.id);
      if (!layout) throw new Error(`Missing layout: ${d.id}`);
      const gameplay = { ...districtGameplay[d.id], ...d.overrides },
        decay = resolveDecay(layout, composition.tier),
        gameplayLayers = gameplay.decay.filter(
          (l) => l.tier <= composition.tier,
        );
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
      const a: Aabb = { min: [c.aabb.min[0] + d.origin[0], c.aabb.min[1], c.aabb.min[2] + d.origin[1]], max: [c.aabb.max[0] + d.origin[0], c.aabb.max[1], c.aabb.max[2] + d.origin[1]] };
      for (let z = Math.floor(a.min[2] / 4); z <= Math.floor(a.max[2] / 4); z++) for (let x = Math.floor(a.min[0] / 4); x <= Math.floor(a.max[0] / 4); x++) {
        const key = `${x},${z}`, bucket = this.supports.get(key) ?? []; bucket.push(a); this.supports.set(key, bucket);
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
    const reached = this.nav.flood(this.playerStart);
    for (const d of this.districts)
      for (const obj of d.gameplay.objectives) {
        const p = resolvePosition(obj.position, d.layout);
        if (!reached[this.nav.index(p[0] + d.origin[0], p[1] + d.origin[1])])
          throw new Error(`Unreachable level objective: ${d.id}/${obj.id}`);
      }
  }
  /** Exact low compound supports only; roofs and solid props never lift NPCs. */
  groundHeight(x: number, z: number): number {
    let height = 0;
    for (const a of this.supports.get(`${Math.floor(x / 4)},${Math.floor(z / 4)}`) ?? []) {
      if (x >= a.min[0] && x <= a.max[0] && z >= a.min[2] && z <= a.max[2]) height = Math.max(height, a.max[1]);
    }
    return height;
  }
  /** Visible paving is baked into the layout GLB rather than the solid-prop collider set. */
  pavingHeight(x: number, z: number): number {
    let height = this.groundHeight(x, z);
    for (const d of this.districts) for (const s of d.layout.surfaces) if (s.height !== undefined && inside([x - d.origin[0], z - d.origin[1]], s.polygon)) height = Math.max(height, s.height);
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
