import type { TimeOfDay } from "../../data/timeOfDay";
export const districtIds = [
  "D-RES",
  "D-MAIN",
  "D-SCHOOL",
  "D-SHOP",
  "D-CIVIC",
  "D-PARK",
  "D-ZOO",
  "D-EDGE",
] as const;
/** L1 v2 district. Not in `districtIds`: that list is the campaign set iterated by the district/decay suites and L6. */
export const groveDistrictId = "D-GROVE" as const;
/** E21 L3 corridor district (the three parallel avenues). Like D-GROVE it is not in `districtIds`. */
export const corridorDistrictId = "D-CORRIDOR" as const;
/** E22 L4 Fairhaven downtown (the safe city that falls). Like D-GROVE it is not in `districtIds`. */
export const fairDistrictId = "D-FAIR" as const;
export const subwayDistrictId = "D-SUBWAY" as const;
export type DistrictId = (typeof districtIds)[number] | typeof groveDistrictId | typeof corridorDistrictId | typeof fairDistrictId | typeof subwayDistrictId;
/** Districts that run the L1 v2 outbreak rules (sight-only infected brain, pedestrian outbreak layer, corgi). */
export const outbreakDistrictIds: readonly DistrictId[] = [groveDistrictId, corridorDistrictId, fairDistrictId, subwayDistrictId];
export const isOutbreakDistrict = (id: string): boolean => (outbreakDistrictIds as readonly string[]).includes(id);
export type Tier = 0 | 1 | 2 | 3 | 4 | 5;
export type Point = [number, number];
export interface PlacementTransform {
  position: [number, number, number];
  yaw: number;
}
export interface Aabb {
  min: [number, number, number];
  max: [number, number, number];
}
export interface Placement extends PlacementTransform {
  id: string;
  assetId: string;
  scale: [number, number, number];
  minTier: Tier;
  maxTier: Tier;
  allowRoad: boolean;
  lightGroup: string;
  visualAabb: Aabb;
  /** Optional per-instance colour multiplier (house walls); batches stay shared, colour is an instance attribute. */
  tint?: string;
  /** Army checkpoint boom starts raised; the mission owns its dynamic arm blocker. */
  boomOpen?: boolean;
  /** Optional reviewed decay variant of the asset (manifest `decayVariants`: `w2`/`w3` buildings, `wrecked` vehicles). */
  decay?: string;
}
export interface StaticCollider {
  /** Low GLB paving/steps support feet without blocking planar navigation. */
  walkable?: boolean;
  id: string;
  aabb: Aabb;
  minTier: Tier;
  maxTier: Tier;
}
/** Versioned Blender export. Positions are game-space metres (+Y up), independent of gameplay. */
export interface DistrictLayout {
  version: 1;
  district: DistrictId;
  title: string;
  geometryHash: string;
  bounds: Point[];
  roads: {
    nodes: { id: string; point: Point }[];
    edges: {
      id: string;
      start: string;
      end: string;
      points: Point[];
      laneWidth: number;
    }[];
  };
  placements: Placement[];
  anchors: Record<string, PlacementTransform>;
  /** Named gameplay polygons (no-bicycle zones, car-wash bay); L1 v2 only. */
  zones?: Record<string, Point[]>;
  buildings: { id: string; assetId: string; aabb: Aabb; label: string }[];
  colliders: StaticCollider[];
  walkable: { cellSize: number; excluded: Point[][] };
  lawns: { min: Point; max: Point }[];
  /** Non-solid, baked L1 micro-dressing; retained for density/composition validation. */
  decorations?: { kind: string; position: [number, number, number] }[];
  lightGroups: { id: string; offAt: Tier }[];
  acousticZones: { id: string; preset: string; polygon: Point[] }[];
  surfaces: {
    surface: "asphalt" | "grass" | "wood" | "tile" | "metal" | "gravel";
    /** Top of authored paving boxes; absent on older exports and flat semantic zones. */
    height?: number;
    polygon: Point[];
  }[];
  layers: { tier: Tier; remove: string[]; disableLights: string[] }[];
}
export type PositionRef = { anchor: string } | { x: number; z: number };
/** An authoring reference, resolved and validated against the exported anchor table at load. */
export const anchor = (name: string): PositionRef => ({ anchor: name });
export interface DistrictGameplay {
  id: DistrictId;
  playerStart: PositionRef;
  spawns: PositionRef[];
  spawnVolumes: { center: PositionRef; radius: number }[];
  triggers: { id: string; position: PositionRef; radius: number }[];
  objectives: { id: string; position: PositionRef }[];
  interactables: { id: string; position: PositionRef }[];
  /** E11 runtime objects, distinct from E10's landmark placement markers. */
  barricades?: import('../../sim/interact/Barricades').BarricadeSlot[];
  interactions?: import('../loader').InteractionPlacements;
  civilianRoutes: PositionRef[][];
  safePoints: PositionRef[];
  photoSpots: {
    name: string;
    target: PositionRef;
    offset: [number, number, number];
  }[];
  decay: {
    tier: Tier;
    blockers: Aabb[];
    fires: { position: PositionRef; radius: number; damagePerSecond: number }[];
    powerOut: string[];
  }[];
}
/** Composition owns world placement/tier/light and gameplay overrides; missions remain in E12. */
export interface LevelComposition {
  id: string;
  tier: Tier;
  timeOfDay: TimeOfDay;
  districts: {
    id: DistrictId;
    origin: Point;
    overrides?: Partial<
      Pick<DistrictGameplay, "spawns" | "triggers" | "objectives" | "interactions" | "barricades" | "photoSpots">
    >;
    /** Scene Lab: full gameplay record for a synthetic layout (replaces `districtGameplay[id]`). */
    gameplay?: DistrictGameplay;
  }[];
  /** Scene Lab (src/debug/scenelab): an isolated, synthetic composition. Static instances come from the
   * layout placements (not the baked GLB), crowns from the asset definitions; `glb` keeps the baked district
   * ground, otherwise a flat `ground` plane (palette token) is drawn. `courier` selects the L1 hero look. */
  scene?: { glb: boolean; ground: "grass" | "asphalt" | "sidewalk"; perimeter: boolean; courier: boolean };
}
