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
