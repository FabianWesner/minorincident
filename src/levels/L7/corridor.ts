import type { PlacementTransform, Point } from '../districts/types';

/**
 * L7-D2 final evacuation corridor at Fairhaven's north-west edge. The game camera looks from +x/+z, so a
 * strip with nothing tall on its +x/+z side stays readable: the Lakeshore Drive and its promenade (z 43..56; the
 * lake wall closes it at z 56.6) run west from the east mouth at x -30 to the working bus at the dead end (x -84).
 *
 * Two connected routes arrive from the Northgate strip:
 *  A) Harbor Street, then the west rear-yard alley (x -84..-72, z -35..41, the former yard fences expire) north
 *     to Lakeshore Drive and the corridor's west end beside the bus;
 *  B) Lakeshore Drive straight west, entering the corridor along its whole south edge.
 * Every blocker leaves a lane of at least 3 m, so the final horde, not a collider, closes the corridor. The strip z 45.5..48.5
 * (x -74..-28) stays free of solid items: it is the lane the evacuation bus drives out on (l7Departure.lane).
 */
export const l7Corridor = { x: [-84, -30], z: [43, 56], bus: [-78.5, 47] } as const;
export const l7CorridorFires: readonly { at: Point; r: number }[] = [
  { at: [-81, -19], r: 1.8 }, { at: [-75, 7], r: 1.8 },
  { at: [-36, 53], r: 1.8 }, { at: [-52, 55], r: 1.8 }, { at: [-63, 52.5], r: 1.8 }, { at: [-80.5, 54], r: 1.8 },
];
/** [id, asset, x, z, yaw, scale, decay] */
export type CorridorItem = readonly [string, string, number, number, number, number, string?];
const H = Math.PI / 2;
export const l7CorridorItems: readonly CorridorItem[] = [
  // Route A, west alley (11 m wide): long wrecks lie along one wall, so each cross-section keeps a 4 m lane.
  ['alley-checkpoint', 'decay.abandoned-checkpoint', -81, -33, 0, 1],
  ['alley-sandbags', 'decay.blown-sandbags', -75.5, -29, .15, 1],
  ['alley-apc-0', 'veh.military-apc', -82, -24, H + .12, 1, 'wrecked'],
  ['alley-truck-0', 'veh.military-truck', -74.8, -15, H - .1, 1, 'wrecked'],
  ['alley-crater', 'decay.crater', -78.5, -8.5, .4, 1],
  ['alley-apc-1', 'veh.military-apc', -81.5, 2, H + .08, 1, 'wrecked'],
  ['alley-collapse-0', 'decay.collapsed-facade', -73.6, -4, H, 1],
  ['alley-rubble', 'decay.rubble-pile', -77, 8, 2.1, .9],
  ['alley-collapse-1', 'decay.collapsed-facade', -73.6, 14, -H, 1],
  ['alley-sedan', 'veh.wreck', -79, 15, .9, 1, 'wrecked'],
  ['alley-truck-1', 'veh.military-truck', -82, 20, H + .1, 1, 'wrecked'],
  ['alley-collapse-2', 'decay.collapsed-facade', -73.4, 38, -H, 1],
  ['alley-apc-2', 'veh.military-apc', -82, 44.5, H - .2, 1, 'wrecked'],
  // East mouth of the corridor: broken jersey line and sandbags, passable beside the lamp posts.
  ['east-jersey-0', 'prop.jersey-barrier', -32, 52.2, H, 1],
  ['east-jersey-1', 'prop.jersey-barrier', -32.4, 43.6, H + .2, 1],
  ['east-sandbags', 'decay.blown-sandbags', -36, 54, .3, 1],
  // Corridor: a burned convoy staggered north and south so the lane snakes between fires and craters.
  ['apc-0', 'veh.military-apc', -39, 52.6, .2, 1, 'wrecked'],
  ['crater-big', 'decay.fuel-truck-crater', -45, 52.7, .3, .85],
  ['truck-0', 'veh.military-truck', -48, 53.5, -.12, 1, 'wrecked'],
  ['checkpoint', 'decay.abandoned-checkpoint', -55, 51.4, 0, 1],
  ['rubble-0', 'decay.rubble-pile', -58.5, 51, .5, 1],
  ['apc-1', 'veh.military-apc', -66.5, 53, -.25, 1, 'wrecked'],
  ['sedan', 'veh.wreck', -56.5, 54.5, .8, 1, 'wrecked'],
  ['truck-1', 'veh.military-truck', -62.5, 43.7, .1, 1, 'wrecked'],
  // Bus point: the working bus nose-east with a light tower, supplies and a dropped bag on its boarding side.
  ['tower', 'prop.light-tower', -71.5, 50.5, .3, 1],
  ['crates', 'prop.crates', -73.5, 52.5, .3, 1],
  ['belongings', 'decay.dropped-belongings', -72, 49.2, .8, 1],
  ['furniture', 'decay.furniture-barricade', -81.5, 53, .4, 1],
  ['rubble-1', 'decay.rubble-pile', -84, 55, 1.2, .9],
];
export const l7Bus = { id: 'l7-evac-bus', asset: 'veh.evac-bus', x: l7Corridor.bus[0], z: l7Corridor.bus[1], yaw: 0 } as const;
/** Anchors for the encounter, departure and Scene Lab lanes. */
export const l7CorridorAnchors: Record<string, PlacementTransform> = {
  'l7-alley-south': { position: [-78, 0, -36], yaw: 0 },
  'l7-alley': { position: [-78, 0, 0], yaw: 0 },
  'l7-alley-north': { position: [-75, 0, 40], yaw: 0 },
  'l7-corridor-east': { position: [-30, 0, 50], yaw: Math.PI },
  'l7-corridor': { position: [-52, 0, 50], yaw: Math.PI },
  'l7-corridor-west': { position: [-68, 0, 50], yaw: Math.PI },
  'l7-bus': { position: [l7Bus.x, 0, l7Bus.z], yaw: l7Bus.yaw },
  'l7-bus-boarding': { position: [-70.5, 0, 47.5], yaw: Math.PI },
  'l7-bus-depart': { position: [-30, 0, 47], yaw: 0 },
};
