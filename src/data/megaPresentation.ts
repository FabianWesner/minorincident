import type { EntitySnapshot } from '../sim/world/types';
import type { PursuitBand } from '../sim/ai/MegaPursuit';
/** Information exposed to presentation has no bearing or world position. */
export const megaBands: Record<PursuitBand, { gain: number; ringPercent: number; label: string }> = {
  distant: { gain: .125, ringPercent: 88, label: 'Mega Alpha: distant' },
  approaching: { gain: .28, ringPercent: 68, label: 'Mega Alpha: approaching' },
  near: { gain: .63, ringPercent: 44, label: 'Mega Alpha: near' },
};
export const cureRecordingText = 'Dr. Elena Voss: “You’re the courier. The one from the Annex.” “The sample you carried that morning came from here. We sent it to the Annex for testing. The container failed. That’s on us. Not on you.” Courier: “I carried it.” Voss: “Then carry this one.” (She hands over the cure canister.) “It’s airborne. It only kills the infected. The dispersal complex is two kilometres east. Plug it into the main console, hold it while it charges, and release it.”';
/** Seeded 20–35 s interval, independent of audio wall time and other RNG consumers. */
export function megaCueInterval(seed: number, index: number): number {
  let hash = Math.imul(seed ^ index, 0x45d9f3b); hash = Math.imul(hash ^ (hash >>> 16), 0x45d9f3b);
  return 1200 + ((hash ^ (hash >>> 16)) >>> 0) % 901;
}

/** Protect every HUD path, including authored/debug Mega models before pursuit is attached. */
export function isMega(entity: EntitySnapshot | undefined): boolean {
  return !!entity && (!!entity.infected?.pursuit || entity.infected?.variant === 'inf.mega-alpha' || entity.archetype === 'infected.mega-alpha');
}
