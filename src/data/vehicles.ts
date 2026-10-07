/** E09 tuning in SI units; +X forward, +Y up, +Z left. */
export interface VehicleDef {
  id: string; asset: string; mass: number; length: number; width: number; wheelbase: number;
  wheelRadius: number; suspension: number; stiffness: number; engineForce: number;
  topSpeed: number; steering: number; hp: number; ramStrength: number; emergency: boolean;
  /** Handling is in SI units, except grip/force multipliers and response rates (1/s). */
  handling: {
    highSpeedSteering: number; steeringResponse: number; engineTaperStart: number; reverseSpeed: number;
    brake: number; idleBrake: number; handbrake: number; grip: number; driftGrip: number;
    compression: number; relaxation: number; suspensionTravel: number; suspensionResponse: number;
    centerOfMass: number; flipDelay: number; flipLift: number; flipTorque: number;
  };
}
const sedan: VehicleDef = { id: 'vehicle.sedan', asset: 'veh.sedan-red', mass: 1200, length: 4.2, width: 1.8, wheelbase: 2.7, wheelRadius: .34, suspension: .3, stiffness: 40, engineForce: 3000, topSpeed: 16, steering: .42, hp: 300, ramStrength: 1, emergency: false,
  handling: { highSpeedSteering: .18, steeringResponse: 10, engineTaperStart: .35, reverseSpeed: 6, brake: .16, idleBrake: .004, handbrake: .08, grip: 3, driftGrip: .65, compression: 4.4, relaxation: 2.3, suspensionTravel: .25, suspensionResponse: 25, centerOfMass: -.3, flipDelay: 3, flipLift: 3, flipTorque: 4 },
};
/** The cargo bicycle retains capsule collision and click navigation; these tune its direct steering and frame lean. */
export const bicycleHandling = { slowTurnRadius: 1.6, fastTurnRadius: 6, steeringResponse: 8, maxSteering: .5, leanResponse: 8, maxLean: .32 } as const;
export const vehicles: readonly VehicleDef[] = [
  sedan,
  { ...sedan, id: 'vehicle.pickup', asset: 'veh.pickup-red', mass: 1800, length: 5.2, wheelbase: 3.2, engineForce: 4300, hp: 450, ramStrength: 1.5 },
  { ...sedan, id: 'vehicle.suv', asset: 'veh.suv-dark', mass: 2000, engineForce: 4700, hp: 500, ramStrength: 1.6 },
  { ...sedan, id: 'vehicle.police', asset: 'veh.police-sedan', emergency: true, hp: 400 },
  { ...sedan, id: 'vehicle.ambulance', asset: 'veh.ambulance', emergency: true, mass: 3000, length: 6, width: 2.1, wheelbase: 3.6, engineForce: 6500, topSpeed: 14, hp: 650, ramStrength: 2 },
  { ...sedan, id: 'vehicle.school-bus', asset: 'veh.school-bus', mass: 7000, length: 8, width: 2.4, wheelbase: 5, engineForce: 13000, topSpeed: 12, steering: .55, handling: { ...sedan.handling, highSpeedSteering: .32 }, hp: 1200, ramStrength: 3 },
  { ...sedan, id: 'vehicle.fire-engine', asset: 'veh.fire-engine', emergency: true, mass: 8000, length: 7.4, width: 2.1, wheelbase: 4.5, engineForce: 15000, topSpeed: 13, steering: .55, handling: { ...sedan.handling, highSpeedSteering: .3 }, hp: 1600, ramStrength: 5 },
];
export const vehicleNodes = ['body', 'wheelFL', 'wheelFR', 'wheelRL', 'wheelRR', 'lightsFront', 'lightsBrake', 'driverSeat', 'exitL', 'exitR'] as const;
export function requiredVehicleNodes(def: VehicleDef): string[] { return [...vehicleNodes, ...(def.emergency ? ['sirenL', 'sirenR'] : []), ...(def.id === 'vehicle.fire-engine' ? ['ladder'] : [])]; }
export function validateVehicle(def: VehicleDef): void {
  if (!def.id.startsWith('vehicle.') || !def.asset.startsWith('veh.') || typeof def.emergency !== 'boolean') throw new Error('Invalid vehicle identity');
  for (const key of ['mass', 'length', 'width', 'wheelbase', 'wheelRadius', 'suspension', 'stiffness', 'engineForce', 'topSpeed', 'steering', 'hp', 'ramStrength'] as const) if (!Number.isFinite(def[key]) || def[key] <= 0) throw new Error(`Invalid vehicle ${key}`);
  if (def.wheelbase >= def.length || def.steering >= Math.PI / 2) throw new Error('Invalid vehicle geometry');
  for (const [key, value] of Object.entries(def.handling)) if (!Number.isFinite(value) || (key === 'centerOfMass' ? value >= 0 : value <= 0)) throw new Error(`Invalid vehicle handling ${key}`);
  if (def.handling.highSpeedSteering > def.steering || def.handling.engineTaperStart >= 1 || def.handling.driftGrip >= def.handling.grip) throw new Error('Invalid vehicle handling range');
}
for (const def of vehicles) validateVehicle(def);
export function vehicleDef(id: string): VehicleDef { const def = vehicles.find(v => v.id === id); if (!def) throw new Error(`Unknown vehicle ${id}`); return def; }
