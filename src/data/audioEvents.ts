/** Audio presentation adapters for E08/E09/E12/E25–27. Producers emit these on the sim event bus;
 * audio never owns damage, vehicle physics, power, or mission progression. Positions are metres. */
export interface SoundPosition {
    x: number;
    y?: number;
    z: number;
}
export type Surface = 'asphalt' | 'sidewalk' | 'grass' | 'wood' | 'gravel' | 'tile' | 'metal' | 'glass' | 'water' | 'blood';
export type PropMaterial = 'wood' | 'metal' | 'plastic' | 'glass' | 'rubber' | 'sandbag';
export type ExplosionBeat = 'tell' | 'crack' | 'boom' | 'sub' | 'debris' | 'roar' | 'crackle';
export type AudioSystemEvent = {
    type: 'footstep';
    tick: number;
    sourceId: number;
    position: SoundPosition;
    surface?: Surface;
    actor: 'survivor' | 'infected' | 'corgi' | 'tires';
} | {
    type: 'light.generator';
    tick: number;
    sourceId: number;
    position: SoundPosition;
    phase: 'pull' | 'sputter' | 'idle' | 'stop';
} | {
    type: 'light.lamp';
    tick: number;
    sourceId: number;
    position: SoundPosition;
    phase: 'hum' | 'flicker' | 'break' | 'off';
} | {
    type: 'light.power';
    tick: number;
    sourceId: number;
    position: SoundPosition;
    on: boolean;
} | {
    type: 'prop.impact';
    tick: number;
    sourceId: number;
    position: SoundPosition;
    material: PropMaterial;
    impulse: number;
} | {
    type: 'prop.motion';
    tick: number;
    sourceId: number;
    position: SoundPosition;
    material: PropMaterial;
    speed: number;
    mode: 'roll' | 'scrape' | 'stop';
} | {
    type: 'barricade.sound';
    tick: number;
    sourceId: number;
    position: SoundPosition;
    phase: 'brace' | 'hit' | 'break';
    hp: number;
    maxHp: number;
} | {
    type: 'explosion.beat';
    tick: number;
    sourceId: number;
    position: SoundPosition;
    beat: ExplosionBeat;
    size: 'small' | 'medium' | 'large' | 'mega';
} | {
    type: 'vehicle.sound';
    tick: number;
    sourceId: number;
    position: SoundPosition;
    velocity: SoundPosition;
    rpm: number;
    speed: number;
    health: number;
    phase: 'engine' | 'horn' | 'siren' | 'crash' | 'skid' | 'grab' | 'stop';
    impulse?: number;
    surface?: Surface;
} | {
    type: 'diegetic';
    tick: number;
    sourceId: number;
    position: SoundPosition;
    kind: 'jukebox' | 'ice-cream' | 'car-radio' | 'emergency' | 'school-bell' | 'pa' | 'megaphone';
    level: string;
    inCar?: boolean;
    stop?: boolean;
} | {
    type: 'dialogue';
    tick: number;
    position?: SoundPosition;
    text: string;
    duration?: number;
} | {
    type: 'music.stinger';
    tick: number;
    kind: 'objective' | 'weapon' | 'elite' | 'low-hp' | 'twist' | 'complete' | 'extraction';
    level: string;
} | {
    type: 'music.intensity';
    tick: number;
    alerted: number;
    damage: number;
    phase: 'normal' | 'timer' | 'defend' | 'boss';
    vehicleSpeed: number;
} | {
    type: 'corgi.sound';
    tick: number;
    sourceId: number;
    position: SoundPosition;
    kind: 'warning' | 'happy' | 'hurt' | 'pant';
} | {
    type: 'survivor.bark';
    tick: number;
    sourceId: number;
    position: SoundPosition;
    variant: 'male' | 'female';
    kind: 'effort' | 'hurt' | 'quip';
} | {
    type: 'gore.sound';
    tick: number;
    position: SoundPosition;
    kind: 'squelch' | 'bone' | 'splat';
};
