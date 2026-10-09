/** Scripted level moods (06 §2), adapted from Bruno DayCycles.js (MIT), commit 41046b5. */
import { worldLook } from './worldLook';
export interface TimeOfDayPreset {
  sun: string; intensity: number; polar: number; azimuth: number;
  shadow: string; sky: string; fog: string; fogNear: number; fogFar: number;
  /** E25 practical-light weight of the light field (0 = daylight, the pass is skipped). */
  practical?: number;
  /** E25 night readability: survivor/infected rim strength and the player's light-field aura (§6 2). */
  rim?: number; aura?: number;
}
const golden: TimeOfDayPreset = { sun: '#ffdb9a', intensity: 1.15, polar: 1.15, azimuth: -1.0, shadow: '#66548d', sky: '#eeb888', fog: '#e5b39e', fogNear: 55, fogFar: 140, practical: .25 };
const presets = {
  L1: { sun: worldLook.sun, intensity: worldLook.sunIntensity, polar: .78, azimuth: -.7, shadow: worldLook.shadow, sky: worldLook.sky, fog: worldLook.fog, fogNear: 65, fogFar: 170 },
  L2: { sun: '#fff9ec', intensity: 1.3, polar: 0.35, azimuth: 0.1, shadow: '#656398', sky: '#b4d5e8', fog: '#c4d5dc', fogNear: 65, fogFar: 165 },
  // E21 late afternoon: lower, warmer sun (polar 1.08 rad, hue ~37 deg), long shadows (~5x L2's), harsher light, smoke-warm haze.
  L3: { sun: '#ffd7a3', intensity: 1.32, polar: 1.08, azimuth: -0.75, shadow: '#5d4f88', sky: '#dcc3a4', fog: '#d6b596', fogNear: 52, fogFar: 140 },
  // E22 clean late afternoon (a city the outbreak has not reached): clear air (fog far = L3 + 25 m), saturated warm-neutral sun, polar 1.2 rad (between L3 and the L5 sunset).
  L4: { sun: '#ffe0ae', intensity: 1.3, polar: 1.2, azimuth: -0.85, shadow: '#5f5489', sky: '#c7d6e2', fog: '#dbd1c1', fogNear: 62, fogFar: 165, practical: .12 },
  golden,
  // E23 sunset (PO: dark red, orange, increasingly gloomy): the sun sits on the horizon (polar 1.48 rad, hue ~16 deg) at 0.65x L4 and the level fades it further (gloom ramp); red-to-violet sky, long shadows, fires carry the image.
  L5: { sun: '#ff6a2a', intensity: 0.85, polar: 1.48, azimuth: -1.4, shadow: '#4a2f5e', sky: '#8c4f6f', fog: '#7a4a62', fogNear: 45, fogFar: 125, practical: .8, rim: .25, aura: .25 },
  L6: { sun: '#9fb4ff', intensity: 0.38, polar: 0.85, azimuth: 2.2, shadow: '#39365f', sky: '#202c4b', fog: '#344161', fogNear: 45, fogFar: 120, practical: 1, rim: .4, aura: .45 },
  /** Night segments without fires (L4 blackout blocks, scripted night beats): moonlight only, practicals carry the scene. */
  night: { sun: '#8fa6ff', intensity: 0.2, polar: 0.7, azimuth: 2.4, shadow: '#2f2d55', sky: '#141c33', fog: '#26304d', fogNear: 42, fogFar: 115, practical: 1, rim: .45, aura: .5 },
} satisfies Record<string, TimeOfDayPreset>;
export type TimeOfDay = keyof typeof presets;
export const timeOfDay: Record<TimeOfDay, TimeOfDayPreset> = presets;
