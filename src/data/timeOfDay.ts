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
  L3: { sun: '#ffe2b3', intensity: 1.2, polar: 0.9, azimuth: -0.7, shadow: '#66558e', sky: '#d9c9b2', fog: '#d5c0ad', fogNear: 60, fogFar: 150 },
  L4: golden, golden,
  L5: { sun: '#9c9edb', intensity: 0.65, polar: 1.48, azimuth: -1.4, shadow: '#504978', sky: '#695d91', fog: '#786d96', fogNear: 45, fogFar: 125, practical: .8, rim: .25, aura: .25 },
  L6: { sun: '#9fb4ff', intensity: 0.38, polar: 0.85, azimuth: 2.2, shadow: '#39365f', sky: '#202c4b', fog: '#344161', fogNear: 45, fogFar: 120, practical: 1, rim: .4, aura: .45 },
  /** Night segments without fires (L4 blackout blocks, scripted night beats): moonlight only, practicals carry the scene. */
  night: { sun: '#8fa6ff', intensity: 0.3, polar: 0.7, azimuth: 2.4, shadow: '#2f2d55', sky: '#141c33', fog: '#26304d', fogNear: 42, fogFar: 115, practical: 1, rim: .45, aura: .5 },
} satisfies Record<string, TimeOfDayPreset>;
export type TimeOfDay = keyof typeof presets;
export const timeOfDay: Record<TimeOfDay, TimeOfDayPreset> = presets;
