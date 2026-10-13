/**
 * E32 §5.7 / L10-A7: finale assembly anchors of the R7 dispersal complex, authored for the L10-D4 district lane.
 * Local frame in metres, ground plane [x, z] like every layout and scene spec; the console is the origin and the whole hold
 * zone is the 25 m disc around it. D4 maps the frame to the world with one offset (console world position). `yaw` is the
 * placement yaw in degrees (scene-spec convention, 0 = the asset's +X front towards +x); only 0 and 180 are used so the
 * footprint stays an exact axis-aligned box (`propBox`) even for the off-centre assets (platform stair, tank outlets).
 * Orchestrator defaults, changeable after measurement. tests/unit/data/l10-finale-anchors.test.ts and the arena Scene Lab
 * specs (specs/scenes/catalog/asset-l10-dispersal-arena*.json, generated from this file) validate the geometry.
 */
export type FinaleRole = 'console' | 'platform' | 'cover' | 'backdrop' | 'pipe-run';
export interface FinaleProp { id: string; role: FinaleRole; asset: string; at: [number, number]; yaw: 0 | 180 }
export interface FinaleLane { id: string; /** Dodge/run polyline, ground plane. */ points: [number, number][]; /** Free corridor half width the nav must keep clear. */ halfWidth: number; note: string }
export interface Box { min: [number, number]; max: [number, number] }

/** Exact GLB extents on the ground plane, asset frame [x0, x1, z0, z1] (game axes: x forward, z = -Blender Y). */
export const assetExtent: Record<string, [number, number, number, number]> = {
  'kit.dispersal-console': [-.8, .82, -1.65, 1.65],
  'kit.dispersal-platform': [-4.05, 8.26, -2.2, 2.2],
  'kit.dispersal-tank-bullet': [-5.75, 6.08, -5.3, 5.3],
  'kit.dispersal-tank-sphere': [-4.39, 6.08, -4.4, 4.4],
  'kit.dispersal-filtration-tower': [-4.3, 7.6, -4.3, 4.3],
  'kit.dispersal-fan-housing': [-3.6, 3.6, -5.1, 5.1],
  'kit.dispersal-turbine-hall': [-8.4, 8.4, -5.6, 6.6],
  'kit.dispersal-pipe-straight': [-4.04, 4.04, -1.3, 1.3],
  'kit.dispersal-pipe-tee': [-4.04, 4.04, -4.04, 1.3],
  'kit.dispersal-pipe-elbow': [-4.5, 1.3, -4.5, 1.3],
  'wpn.minigun-mounted': [-1.35, 1.45, -1.35, 1.35],
};

/** World-plane box of a placement (yaw 0 or 180). */
export function propBox(asset: string, at: [number, number], yaw: 0 | 180): Box {
  const [x0, x1, z0, z1] = assetExtent[asset];
  return yaw === 0
    ? { min: [at[0] + x0, at[1] + z0], max: [at[0] + x1, at[1] + z1] }
    : { min: [at[0] - x1, at[1] - z1], max: [at[0] - x0, at[1] - z0] };
}

export const finale = {
  /** E32 §5.7: charge only advances while the player is within this planar distance of the console. */
  holdRadius: 25,
  /** E32 §5.7: the mounted gun stands at most this far from the console. */
  gunMaxDistance: 20,
  console: { id: 'console', asset: 'kit.dispersal-console', at: [0, 0] as [number, number], yaw: 0 as const, operator: [1, 0] as [number, number] },
  /** Mounted rotary minigun on the central service platform (deck 3 m above ground; wpn.minigun-mounted). In a scene spec a
   * 3-element prop `at` is [x, y, z]: the gun is placed at [x, deckHeight, z]. */
  gun: { id: 'gun', asset: 'wpn.minigun-mounted', at: [-10, -6] as [number, number], yaw: 0 as const, deckHeight: 3, platform: 'platform' },
  /** Stair of the central platform: foot on the ground 6 m from the console, top on the deck. */
  platformStair: { at: [0.2, -6] as [number, number], top: [-4, -6] as [number, number], topHeight: 3 },
  /** Cure installation (consumes the carried canister, captures `cure-disperse-ready`): in front of the bullet tank outlet. */
  installation: { id: 'cure-install', at: [6.5, -12] as [number, number], facing: 180, tank: 'tank-a', port: 'portOutlet' },
  /** Approach from R6, heading +x towards the arena (D4 chains its first point to the region seam). */
  arrival: { id: 'arrival', at: [-60, 2] as [number, number], route: [[-60, 2], [-45, 2], [-32, 4], [-22, 2]] as [number, number][] },
  props: [
    { id: 'console', role: 'console', asset: 'kit.dispersal-console', at: [0, 0], yaw: 0 },
    { id: 'platform', role: 'platform', asset: 'kit.dispersal-platform', at: [-8, -6], yaw: 0 },
    { id: 'tank-a', role: 'cover', asset: 'kit.dispersal-tank-bullet', at: [14, -12], yaw: 180 },
    { id: 'tank-b', role: 'cover', asset: 'kit.dispersal-tank-bullet', at: [-14, 14], yaw: 0 },
    { id: 'sphere', role: 'cover', asset: 'kit.dispersal-tank-sphere', at: [22, 16], yaw: 180 },
    { id: 'tower-e', role: 'backdrop', asset: 'kit.dispersal-filtration-tower', at: [31, -4], yaw: 0 },
    { id: 'tower-nw', role: 'backdrop', asset: 'kit.dispersal-filtration-tower', at: [-30, 26], yaw: 180 },
    { id: 'fan-w', role: 'backdrop', asset: 'kit.dispersal-fan-housing', at: [-38, -16], yaw: 0 },
    { id: 'hall-s', role: 'backdrop', asset: 'kit.dispersal-turbine-hall', at: [0, -32], yaw: 0 },
    { id: 'pipe-straight', role: 'pipe-run', asset: 'kit.dispersal-pipe-straight', at: [-8, 32], yaw: 0 },
    { id: 'pipe-tee', role: 'pipe-run', asset: 'kit.dispersal-pipe-tee', at: [0, 32], yaw: 0 },
    { id: 'pipe-elbow', role: 'pipe-run', asset: 'kit.dispersal-pipe-elbow', at: [8, 32], yaw: 0 },
  ] as FinaleProp[],
  /** Connected rocket-dodge / run lanes (each starts on an earlier lane), all inside the hold zone and clear of every prop. */
  lanes: [
    { id: 'lane-ew', points: [[-22, 2], [-10, 2], [0, 6], [12, 4], [22, 2]], halfWidth: 2.5, note: 'west-east run past the console, the approach continues into it' },
    { id: 'lane-n', points: [[-4, 4.4], [-4, 8], [2, 18], [10, 20]], halfWidth: 2.5, note: 'north loop between tank B and the sphere tank' },
    { id: 'lane-s', points: [[4.5, 5.25], [4.5, -3], [4.5, -12], [4.5, -20]], halfWidth: 2.5, note: 'south lane between the platform and tank A, passes the installation point' },
  ] as FinaleLane[],
};
