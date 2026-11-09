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
  /** Courier protection ends on launcher pickup, or after the opening eight seconds. */
  openingGraceSeconds: 8,
  /** Dense regular crowds chip courier health; Alpha attacks retain their full damage. */
  courierLungeDamageScale: .2,
  /** r5-l7: health one completed bite takes from an evacuee (100 HP → the third bite kills), and how long the
   * biter reels after the evacuee tears free. The shared 1 s pedestrian bite killed outright, so the shown bars never
   * mattered and only frame-perfect range fire could keep a 24-person column alive inside the opening mob. */
  followerBite: { damage: 34, shoveTicks: 90, shoveM: 2, contactM: 1.5 },
  finalGroup: 700, firstStreetGroup: 701,
  horde: { x: -64, z: 46 }, passage: { x: -76, z: 46 },
  // The party forms east of the courier, behind the westbound escape heading.
  // Keep the opening pack close enough to engage at pickup; its east rank
  // still clears the nearest follower by 3 m including both body radii.
  streets: [{ x: 259, z: 15 }, { x: 173, z: 15 }, { x: 113, z: 15 }, { x: 35, z: 46 }],
} as const;

/**
 * L7-E2: the survivors board the working evac bus at the corridor's dead end, then it drives out along Lakeshore Drive
 * (the corridor lane is kept clear of wrecks for it) while the camera looks back at the burning city. Orchestrator
 * defaults from epic 29 section 5.5: 6-10 s shot, bus moves >= 30 m.
 */
export const l7Departure = {
  /** Reach this radius to start boarding; followers keep loading while the courier covers the rear and boards last. */
  boardRadius: 6,
  /** Departure approach includes crowd separation in this movement bound. */
  followMs: 4.6,
  /** Where survivors queue (in front of the bus nose) and the door they step through; one new passenger at most every `gapTicks`. */
  // Keep the staging lane south of the courier's boarding anchor. A queue on
  // the bus road funnels the last followers through the stationary courier
  // and each other, where local navigation can deadlock before the door.
  queue: { x: -72.6, z: 45.1 }, door: { x: -74.4, z: 47 }, enterTicks: 36, gapTicks: 15,
  /** Recover a living follower after 20 s without 0.5 m net approach progress; never leave anyone behind. */
  stallTicks: 20 * 60,
  /** Bus lane: straight east along Lakeshore Drive. */
  lane: { z: 47, fromX: -78.5, toX: 40 }, seconds: 9, fadeAtSeconds: 8,
  /** Camera relative to the bus: ahead of it, high, looking back past the bus at the city behind. */
  camera: { position: [22, 12, 14], target: [-14, 4, -3] },
} as const;
