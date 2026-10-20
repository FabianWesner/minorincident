/** L7-S2 hook: the district lane resolves its shared Northgate exit, then applies this offset. */
export const l7Rocket = {
  action: 'weapon.rocket-launcher', asset: 'wpn.rocket-launcher', icon: 'icon.rocket-launcher',
  vehicle: 'veh.military-truck', decay: 'wrecked', vehicleExitOffset: [3, -3], exitOffset: [3, 0], interactTicks: 36,
} as const;
/** L7-default starts with every previous PO pickup; the rocket is collected at the exit. */
export const l7DefaultArsenal = {
  LEFT: ['weapon.bat', 'weapon.fire-axe'],
  RIGHT: ['weapon.handgun', 'weapon.army-mg', 'weapon.shotgun'],
};

/** Encounter anchors on the retained Northgate, Harbor and Lakeshore roads; E2 owns the bus. */
export const l7Encounters = {
  finalGroup: 700, firstStreetGroup: 701,
  horde: { x: -64, z: 46 }, passage: { x: -76, z: 46 },
  streets: [{ x: 233, z: 15 }, { x: 173, z: 15 }, { x: 113, z: 15 }, { x: 35, z: -40 }],
} as const;

/**
 * L7-E2: the survivors board the working evac bus at the corridor's dead end, then it drives out along Lakeshore Drive
 * (the corridor lane is kept clear of wrecks for it) while the camera looks back at the burning city. Orchestrator
 * defaults from epic 29 section 5.5: 6-10 s shot, bus moves >= 30 m.
 */
export const l7Departure = {
  /** The player enters this radius around `l7-bus-boarding` to start boarding; leaving the larger one pauses it (those aboard stay aboard). */
  boardRadius: 6, leaveRadius: 16,
  /** Where survivors queue (in front of the bus nose) and the door they step through; one new passenger at most every `gapTicks`. */
  queue: { x: -72.6, z: 47 }, door: { x: -74.4, z: 47 }, enterTicks: 36, gapTicks: 15,
  /** Recover a living follower after 20 s without 0.5 m net approach progress; never leave anyone behind. */
  stallTicks: 20 * 60,
  /** Bus lane: straight east along Lakeshore Drive. */
  lane: { z: 47, fromX: -78.5, toX: 40 }, seconds: 9, fadeAtSeconds: 8,
  /** Camera relative to the bus: ahead of it, high, looking back past the bus at the city behind. */
  camera: { position: [22, 12, 14], target: [-14, 4, -3] },
} as const;
