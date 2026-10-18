/** Scripted level moods (06 §2), adapted from Bruno DayCycles.js (MIT), commit 41046b5. */
import { worldLook, type WorldLook } from './worldLook';
export interface TimeOfDayPreset {
  sun: string; intensity: number; polar: number; azimuth: number;
  shadow: string; sky: string; fog: string; fogNear: number; fogFar: number;
  /** E25 practical-light weight of the light field (0 = daylight, the pass is skipped). */
  practical?: number;
  /** E25 night readability: survivor/infected rim strength and the player's light-field aura (§6 2). */
  rim?: number; aura?: number;
  /** Night route read (E31-AC16): moon-pale sheen added to asphalt (0 = none). */
  roadLift?: number;
  /** Authored route sheen; comparable luminance keeps navigation contrast stable. */
  roadColor?: string;
  /** Render-only atmosphere; live look edits take precedence, with no extra post pass. */
  look?: Partial<WorldLook>;
  ambient?: { leaf: number; dust: number; bird: number };
  /** Sparse insects around powered outdoor lamps, high tier only. */
  lampInsects?: boolean;
}
const golden: TimeOfDayPreset = { sun: '#ffdb9a', intensity: 1.15, polar: 1.15, azimuth: -1.0, shadow: '#66548d', sky: '#eeb888', fog: '#e5b39e', fogNear: 55, fogFar: 140, practical: .25 };
const presets = {
  L1: { sun: worldLook.sun, intensity: worldLook.sunIntensity, polar: .78, azimuth: -.7, shadow: worldLook.shadow, sky: worldLook.sky, fog: worldLook.fog, fogNear: 65, fogFar: 170,
    look: { shadow: '#6c56ac', skyAmbient: '#c0cee7', groundAmbient: '#cdb28b', vignette: .09, bloomStrength: .22 }, ambient: { leaf: 100, dust: 100, bird: 3 } },
  L2: { sun: '#fff9ec', intensity: 1.3, polar: 0.35, azimuth: 0.1, shadow: '#626b8c', sky: '#b4d5e8', fog: '#c4d5dc', fogNear: 65, fogFar: 165,
    look: { skyAmbient: '#b2d0ed', groundAmbient: '#bfba98', bounce: '#9c9d78', vignette: .07, bloomStrength: .18 }, ambient: { leaf: 12, dust: 48, bird: 2 } },
  // E21 late afternoon: lower, warmer sun (polar 1.08 rad, hue ~37 deg), long shadows (~5x L2's), harsher light, smoke-warm haze.
  L3: { sun: '#ffd7a3', intensity: 1.32, polar: 1.08, azimuth: -0.75, shadow: '#5d4f88', sky: '#dcc3a4', fog: '#b9a8bc', fogNear: 52, fogFar: 140,
    look: { skyAmbient: '#b1b6d0', groundAmbient: '#bc997b', vignette: .1, bloomStrength: .2, leaf: '#aaa292', petal: '#bdb6a4' }, ambient: { leaf: 12, dust: 0, bird: 0 } },
  // E22 clean late afternoon (a city the outbreak has not reached): clear air (fog far = L3 + 25 m), saturated warm-neutral sun, polar 1.2 rad (between L3 and the L5 sunset).
  L4: { sun: '#ffe0ae', intensity: 1.3, polar: 1.2, azimuth: -0.85, shadow: '#636081', sky: '#b4d1df', fog: '#dbd1c1', fogNear: 62, fogFar: 165, practical: .12,
    look: { skyAmbient: '#b5cde4', groundAmbient: '#d2b58d', bounce: '#ad9b70', vignette: .08, bloomStrength: .2 }, ambient: { leaf: 8, dust: 32, bird: 2 } },
  golden,
  // E23 sunset (PO: dark red, orange, increasingly gloomy): the sun sits on the horizon (polar 1.48 rad, hue ~19 deg) at 0.65x L4 (the low sun leaves roofs and ground in core shadow, so the shadow tint is bright: dusky rose beneath the ash, never black) and the level fades it further (gloom ramp); red-to-violet sky, long shadows, fires carry the image.
  L5: { sun: '#ff7a38', intensity: 0.85, polar: 1.48, azimuth: -1.4, shadow: '#6e536e', sky: '#514366', fog: '#a76762', fogNear: 34, fogFar: 105, practical: .8, rim: .25, aura: .25,
    look: { skyAmbient: '#a9a4c3', groundAmbient: '#bb7965', vignette: .1, bloomStrength: .2 } },
  "L6-subway": { sun: "#9fb4ff", intensity: 0, polar: 1.55, azimuth: 2.2, shadow: "#252830", sky: "#0c1016", fog: "#181d25", fogNear: 30, fogFar: 85, practical: 1, rim: .25, aura: 1.3,
    look: { skyAmbient: '#8fabc2', groundAmbient: '#8a8077', vignette: .08, bloomStrength: .16 } },
  // Shared Northgate air keeps the L6 exit -> L7 handover continuous; W6 fires/ash supply the ruined-city contrast.
  L6: { sun: '#9fb4ff', intensity: 0.38, polar: 1.55, azimuth: 2.2, shadow: '#39365f', sky: '#1b263f', fog: '#4b5268', fogNear: 45, fogFar: 120, practical: 1, rim: .4, aura: .45,
    look: { skyAmbient: '#99adc9', groundAmbient: '#8e7c83', vignette: .1, bloomStrength: .2 } },
  /** Open crossing: retain the journey's moonlight, with air clear enough for 150 m sight lines. `roadLift`: E31-AC16 night route read (the asphalt road is a pale moonlit band, 3:1 against the verge). */
  'L9-crossing': { sun: '#9fb4ff', intensity: .38, polar: 1.55, azimuth: 2.2, shadow: '#343b48', sky: '#1a3043', fog: '#4d657a', fogNear: 200, fogFar: 1400, practical: 1, rim: .4, aura: .45, roadLift: 2, roadColor: '#92a7b2',
    look: { skyAmbient: '#a2bad2', groundAmbient: '#8f8a88', vignette: .08, bloomStrength: .18 } },
  /** L10 night run (E32): the L9 moonlight with a darker shadow tint (dark verges), a brighter horizon haze for building silhouettes and the asphalt `roadLift`, so R1-R6 read at 3:1 (E31-AC16) while the night stays night. */
  'L10-night': { sun: '#9fb4ff', intensity: .38, polar: 1.55, azimuth: 2.2, shadow: '#30203f', sky: '#302c50', fog: '#5b4f75', fogNear: 200, fogFar: 1400, practical: 1, rim: .4, aura: .45, roadLift: 2.1, roadColor: '#a79ec7',
    look: { skyAmbient: '#b0accf', groundAmbient: '#978a95', vignette: .1, bloomStrength: .2 } },
  /** E30 intact zoo at night: cool moonlight, powered warm practicals; no mandatory blackout. */
  "L8-zoo": { sun: '#afc5ed', intensity: .38, polar: 1.55, azimuth: 2.2, shadow: '#343e57', sky: '#182f3b', fog: '#36505c', fogNear: 45, fogFar: 120, practical: 1, rim: .4, aura: .45, lampInsects: true,
    look: { skyAmbient: '#9dbfce', groundAmbient: '#8d987c', vignette: .08, bloomStrength: .2 } },
  /** Night segments without fires (L4 blackout blocks, scripted night beats): moonlight only, practicals carry the scene. */
  night: { sun: '#8fa6ff', intensity: 0.2, polar: 0.7, azimuth: 2.4, shadow: '#2f2d55', sky: '#141c33', fog: '#26304d', fogNear: 42, fogFar: 115, practical: 1, rim: .45, aura: .5 },
} satisfies Record<string, TimeOfDayPreset>;
export type TimeOfDay = keyof typeof presets;
export const timeOfDay: Record<TimeOfDay, TimeOfDayPreset> = presets;
