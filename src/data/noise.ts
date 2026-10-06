/** One source for sim hearing and audio noise. Radii in metres (09-sound-design §3). */
export const noise = {
    melee: { radius: 6, loudness: 0.5 }, pistol: { radius: 25, loudness: 1 }, smg: { radius: 25, loudness: 1 },
    shotgun: { radius: 35, loudness: 1 }, rifle: { radius: 35, loudness: 1 }, machineGun: { radius: 40, loudness: 1 },
    explosionSmall: { radius: 30, loudness: 1 }, explosionMedium: { radius: 45, loudness: 1 },
    explosionLarge: { radius: 60, loudness: 1 }, explosionMega: { radius: 120, loudness: 1 },
    horn: { radius: 30, loudness: 0.8 }, alarm: { radius: 20, loudness: 0.8 }, siren: { radius: 35, loudness: 1 },
    firecracker: { radius: 15, loudness: 0.7 }, glass: { radius: 12, loudness: 0.6 }, barricade: { radius: 10, loudness: 0.6 },
} as const;
export type NoiseKind = keyof typeof noise;
const weapons: Record<string, NoiseKind> = {
    pistol: 'pistol', smg: 'smg', shotgun: 'shotgun', 'assault-rifle': 'rifle', 'hunting-rifle': 'rifle',
    'machine-gun': 'machineGun', 'nail-gun': 'pistol', 'rocket-launcher': 'explosionLarge',
    grenade: 'explosionSmall', molotov: 'explosionSmall', 'pipe-bomb': 'explosionMedium',
    'firecracker-lure': 'firecracker', turret: 'pistol',
};
export function noiseForAction(id: string): {
    radius: number;
    loudness: number;
} { return noise[weapons[id.split('.')[1]] ?? 'melee']; }
