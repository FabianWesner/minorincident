/** Base survivor balance in metres, seconds and HP (00 §2, E04). */
export const survivor = {
  radius: 0.35, height: 1.4, speed: 4.5, walkSpeed: 2.0, acceleration: 36, deceleration: 54,
  turnSpeed: Math.PI * 4, hp: 100, invulnerableTicks: 36, regenDelayTicks: 240,
  regenPerSecond: 2, respawnTicks: 120, hurtTicks: 18, minimumEscapeSpeed: 0.2,
  fallDeathY: -5,
} as const;
export type SurvivorVariant = 'female' | 'male';
export type GearTier = 0 | 1 | 2 | 3 | 4;
export const characterNodes = ['root', 'hip', 'torso', 'head', 'armL', 'armR', 'foreArmL', 'foreArmR', 'handL', 'handR', 'legL', 'legR', 'shinL', 'shinR', 'footL', 'footR', 'weaponSocketR', 'weaponSocketL', 'backpackSocket'] as const;
export type CharacterNode = typeof characterNodes[number];
export const actionStates = ['swing', 'shoot', 'throw', 'kick', 'interact', 'enter-car', 'mount', 'dismount', 'hand-over', 'equip', 'receive', 'rack-grab'] as const;
export type ActionState = typeof actionStates[number];
export type AnimationState = 'idle' | 'walk' | 'run' | 'hurt' | 'die' | ActionState;
/** Action duration is presentation intent; damage/charges remain owned by E05/E06. */
export const actionTicks: Record<ActionState, number> = { swing: 30, shoot: 12, throw: 36, kick: 30, interact: 45, 'enter-car': 60, mount: 24, dismount: 24, 'hand-over': 60, equip: 54, receive: 54, 'rack-grab': 120 };
export interface SurvivorState {
  /** Plain combat timing for authored clips and trails. */
  attack?: { actionId: string; combo: number; started: number; activeAt: number; recoveryAt: number; endsAt: number; style?: 'roundhouse' };
  variant: SurvivorVariant; gearTier: GearTier; animation: AnimationState; animationTick: number;
  /** E19 presentation hook set by the mission sim (E) while the parcel is held; render-only. */
  carrying?: string;
  velocity: { x: number; z: number }; grounded: boolean; invulnerableUntil: number;
  checkpoint: { x: number; y: number; z: number }; diedAt: number | null;
}
