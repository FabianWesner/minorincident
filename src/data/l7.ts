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
