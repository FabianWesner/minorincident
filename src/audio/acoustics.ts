import type { SoundPosition, Surface } from '../data/audioEvents';
import type { DistrictWorld } from '../sim/world/DistrictWorld';
import { Rng } from '../core/Rng';
export const reverbPresets = {
    street: { rt60: 0.25, band: [0.16, 0.38], wet: 0.2 }, 'suburb-open': { rt60: 0.16, band: [0.1, 0.25], wet: 0.1 },
    'interior-small': { rt60: 0.45, band: [0.3, 0.6], wet: 0.3 }, 'interior-large': { rt60: 0.7, band: [0.5, 0.9], wet: 0.4 },
    tunnel: { rt60: 1.2, band: [1, 1.4], wet: 0.5 }, 'under-bridge': { rt60: 1, band: [0.8, 1.2], wet: 0.4 },
    park: { rt60: 0.12, band: [0.08, 0.22], wet: 0.08 },
} as const;
export type ReverbPreset = keyof typeof reverbPresets;
export interface AcousticMap {
    buildings: {
        min: {
            x: number;
            z: number;
        };
        max: {
            x: number;
            z: number;
        };
    }[];
    zones: {
        preset: ReverbPreset;
        polygon: [
            number,
            number
        ][];
    }[];
    surfaces: {
        surface: Surface;
        polygon: [
            number,
            number
        ][];
    }[];
}
export function fromDistricts(world: DistrictWorld | null): AcousticMap {
    const map: AcousticMap = { buildings: [], zones: [], surfaces: [] };
    if (world)
        for (const d of world.districts) {
            const polygon = (p: [
                number,
                number
            ][]) => p.map(([x, z]) => [x + d.origin[0], z + d.origin[1]] as [
                number,
                number
            ]);
            for (const b of d.layout.buildings)
                map.buildings.push({ min: { x: b.aabb.min[0] + d.origin[0], z: b.aabb.min[2] + d.origin[1] }, max: { x: b.aabb.max[0] + d.origin[0], z: b.aabb.max[2] + d.origin[1] } });
            for (const z of d.layout.acousticZones)
                map.zones.push({ preset: z.preset in reverbPresets ? z.preset as ReverbPreset : 'street', polygon: polygon(z.polygon) });
            for (const s of d.layout.surfaces)
                map.surfaces.push({ surface: s.surface, polygon: polygon(s.polygon) });
        }
    return map;
}
export function contains(p: SoundPosition, polygon: readonly [
    number,
    number
][]): boolean {
    let inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
        const a = polygon[i], b = polygon[j];
        if ((a[1] > p.z) !== (b[1] > p.z) && p.x < (b[0] - a[0]) * (p.z - a[1]) / (b[1] - a[1]) + a[0])
            inside = !inside;
    }
    return inside;
}
export function surfaceAt(map: AcousticMap, p: SoundPosition): Surface {
    for (const s of map.surfaces)
        if (contains(p, s.polygon))
            return s.surface;
    return 'asphalt';
}
export function zoneAt(map: AcousticMap, p: SoundPosition): ReverbPreset {
    for (const z of map.zones)
        if (contains(p, z.polygon))
            return z.preset;
    return 'street';
}
export function occlusions(map: AcousticMap, a: SoundPosition, b: SoundPosition): number {
    let count = 0;
    for (const box of map.buildings) {
        const inside = (p: SoundPosition) => p.x >= box.min.x && p.x <= box.max.x && p.z >= box.min.z && p.z <= box.max.z;
        if (inside(a) && inside(b))
            continue;
        let lo = 0, hi = 1;
        for (const axis of ['x', 'z'] as const) {
            const delta = b[axis] - a[axis];
            if (Math.abs(delta) < 1e-9) {
                if (a[axis] < box.min[axis] || a[axis] > box.max[axis]) {
                    lo = 2;
                    break;
                }
            }
            else {
                const t1 = (box.min[axis] - a[axis]) / delta, t2 = (box.max[axis] - a[axis]) / delta;
                lo = Math.max(lo, Math.min(t1, t2));
                hi = Math.min(hi, Math.max(t1, t2));
            }
        }
        if (lo < hi && hi > 0 && lo < 1 && ++count === 2)
            return 2;
    }
    return count;
}
export function dopplerRate(emitter: SoundPosition, velocity: SoundPosition, listener: SoundPosition, listenerVelocity: SoundPosition = { x: 0, z: 0 }): number {
    const dx = listener.x - emitter.x, dz = listener.z - emitter.z, d = Math.hypot(dx, dz) || 1;
    const source = (velocity.x * dx + velocity.z * dz) / d, receiver = (listenerVelocity.x * dx + listenerVelocity.z * dz) / d;
    return Math.max(0.5, Math.min(2, (343 - receiver) / (343 - source)));
}
/** Deterministic exponential-noise IR, mono and ≤1.5s. normalize=false preserves authored wet levels. */
export function impulse(context: BaseAudioContext, preset: ReverbPreset, low = false): AudioBuffer {
    const rt = reverbPresets[preset].rt60, length = Math.ceil(Math.min(low ? 0.8 : 1.5, rt * 1.2) * context.sampleRate);
    const buffer = context.createBuffer(1, length, context.sampleRate), data = buffer.getChannelData(0), rng = new Rng(16, preset);
    const scale = 2 / Math.sqrt(context.sampleRate * rt);
    for (let i = 0; i < length; i++) {
        const t = i / context.sampleRate;
        data[i] = (rng.next() * 2 - 1) * Math.exp(-6.907755 * t / rt) * scale;
    }
    return buffer;
}
export function dbGain(db: number): number { return 10 ** (db / 20); }
