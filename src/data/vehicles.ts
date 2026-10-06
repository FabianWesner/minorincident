/** E09 tuning in SI units; +X forward, +Y up, +Z left. */
export interface VehicleDef {
  id: string; asset: string; mass: number; length: number; width: number; wheelbase: number;
  wheelRadius: number; suspension: number; stiffness: number; engineForce: number;
  topSpeed: number; steering: number; hp: number; ramStrength: number; emergency: boolean;
}
const sedan: VehicleDef = { id: 'vehicle.sedan', asset: 'veh.sedan-red', mass: 1200, length: 4.2, width: 1.8, wheelbase: 2.7, wheelRadius: .34, suspension: .3, stiffness: 40, engineForce: 3000, topSpeed: 16, steering: .27, hp: 300, ramStrength: 1, emergency: false };
export const vehicles: readonly VehicleDef[] = [
  sedan,
  { ...sedan, id: 'vehicle.pickup', asset: 'veh.pickup-red', mass: 1800, length: 5.2, wheelbase: 3.2, engineForce: 4300, hp: 450, ramStrength: 1.5 },
  { ...sedan, id: 'vehicle.suv', asset: 'veh.suv-dark', mass: 2000, engineForce: 4700, hp: 500, ramStrength: 1.6 },
  { ...sedan, id: 'vehicle.police', asset: 'veh.police-sedan', emergency: true, hp: 400 },
  { ...sedan, id: 'vehicle.ambulance', asset: 'veh.ambulance', emergency: true, mass: 3000, length: 6, width: 2.1, wheelbase: 3.6, engineForce: 6500, topSpeed: 14, hp: 650, ramStrength: 2 },
  { ...sedan, id: 'vehicle.school-bus', asset: 'veh.school-bus', mass: 7000, length: 8, width: 2.4, wheelbase: 5, engineForce: 13000, topSpeed: 12, steering: .4, hp: 1200, ramStrength: 3 },
  { ...sedan, id: 'vehicle.fire-engine', asset: 'veh.fire-engine', emergency: true, mass: 8000, length: 7.4, width: 2.1, wheelbase: 4.5, engineForce: 15000, topSpeed: 13, steering: .4, hp: 1600, ramStrength: 5 },
];
export const vehicleNodes = ['body', 'wheelFL', 'wheelFR', 'wheelRL', 'wheelRR', 'lightsFront', 'lightsBrake', 'driverSeat', 'exitL', 'exitR'] as const;
export function requiredVehicleNodes(def: VehicleDef): string[] { return [...vehicleNodes, ...(def.emergency ? ['sirenL', 'sirenR'] : []), ...(def.id === 'vehicle.fire-engine' ? ['ladder'] : [])]; }
export function validateVehicle(def: VehicleDef): void {
  if (!def.id.startsWith('vehicle.') || !def.asset.startsWith('veh.') || typeof def.emergency !== 'boolean') throw new Error('Invalid vehicle identity');
  for (const key of ['mass', 'length', 'width', 'wheelbase', 'wheelRadius', 'suspension', 'stiffness', 'engineForce', 'topSpeed', 'steering', 'hp', 'ramStrength'] as const) if (!Number.isFinite(def[key]) || def[key] <= 0) throw new Error(`Invalid vehicle ${key}`);
  if (def.wheelbase >= def.length || def.steering >= Math.PI / 2) throw new Error('Invalid vehicle geometry');
}
for (const def of vehicles) validateVehicle(def);
export function vehicleDef(id: string): VehicleDef { const def = vehicles.find(v => v.id === id); if (!def) throw new Error(`Unknown vehicle ${id}`); return def; }
