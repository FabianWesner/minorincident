/** Scripted level moods (06 §2), adapted from Bruno DayCycles.js (MIT), commit 41046b5. */
import { worldLook, type WorldLook } from './worldLook';
export interface TimeOfDayPreset {
  sun: string; intensity: number; polar: number; azimuth: number;
  shadow: string; sky: string; fog: string; fogNear: number; fogFar: number;
  /** E25 practical-light weight of the light field (0 = daylight, the pass is skipped). */
  practical?: number;
  /** E25 night readability: survivor/infected rim strength and the player's light-field aura (§6 2). */
  rim?: number; aura?: number;
  /** Survivor surface fill, independent of the ground light-field aura. */
  heroFill?: number;
  /** Courier-only rim, widened with camera distance for a legible silhouette. */
  heroRim?: number;
  /** Night route read (E31-AC16): moon-pale sheen added to asphalt (0 = none). */
  roadLift?: number;
  /** Authored route sheen; comparable luminance keeps navigation contrast stable. */
  roadColor?: string;
  /** Render-only atmosphere; live look edits take precedence, with no extra post pass. */
  look?: Partial<WorldLook>;
  /** Ambient life counts; `glow` multiplies the dust colour (HDR embers/fireflies), `rise` makes dust climb. */
  ambient?: { leaf: number; dust: number; bird: number; glow?: number; rise?: boolean };
  /** Sparse insects around powered outdoor lamps, high tier only. */
  lampInsects?: boolean;
  /** Visible low-beam cones and dust motes in the driven vehicle's headlights (L9 night drive). */
  headlightBeams?: boolean;
}
const golden: TimeOfDayPreset = { sun: '#ffdb9a', intensity: 1.15, polar: 1.15, azimuth: -1.0, shadow: '#66548d', sky: '#eeb888', fog: '#e5b39e', fogNear: 55, fogFar: 140, practical: .25 };
const presets = {
  L1: { sun: worldLook.sun, intensity: worldLook.sunIntensity, polar: .78, azimuth: -.7, shadow: worldLook.shadow, sky: worldLook.sky, fog: worldLook.fog, fogNear: 65, fogFar: 170,
    look: { shadow: '#6c56ac', skyAmbient: '#c0cee7', groundAmbient: '#cdb28b', vignette: .09, bloomStrength: .22, gradeShadow: '#bac2d2', gradeHighlight: '#ffcf8a', gradeAmount: .85, gradeContrast: 1.08, gradeSaturation: 1.12, haze: '#ffcf9a', hazeAmount: .3, cloudShadow: .35, cloudScale: 10 }, ambient: { leaf: 100, dust: 100, bird: 3, glow: 1.4 } },
  L2: { sun: '#fff9ec', intensity: 1.3, polar: 0.35, azimuth: 0.1, shadow: '#626b8c', sky: '#b4d5e8', fog: '#c4d5dc', fogNear: 65, fogFar: 165,
    look: { skyAmbient: '#b2d0ed', groundAmbient: '#bfba98', bounce: '#9c9d78', vignette: .07, bloomStrength: .18, gradeShadow: '#a0b8ff', gradeHighlight: '#fffaf0', gradeAmount: .7, gradeContrast: 1.16, gradeSaturation: 1.05, haze: '#bcd8f4', hazeAmount: .22, cloudShadow: .6, cloudScale: 11, dust: '#fff8e8' }, ambient: { leaf: 16, dust: 60, bird: 3, glow: 1.3 } },
  // E21 late afternoon: lower, warmer sun (polar 1.08 rad, hue ~37 deg), long shadows (~5x L2's), harsher light, smoke-warm haze.
  L3: { sun: '#ffd7a3', intensity: 1.32, polar: 1.08, azimuth: -0.75, shadow: '#5d4f88', sky: '#dcc3a4', fog: '#b9a8bc', fogNear: 52, fogFar: 140,
    look: { skyAmbient: '#b1b6d0', groundAmbient: '#bc997b', vignette: .1, bloomStrength: .2, leaf: '#aaa292', petal: '#bdb6a4', dust: '#cdbfb0', gradeShadow: '#8a7a8c', gradeHighlight: '#ffd0a5', gradeAmount: .9, gradeContrast: 1.2, gradeSaturation: .78, haze: '#c08a68', hazeAmount: .5, hazeHeight: 9, cloudShadow: .45, cloudScale: 8, cloudSpeed: 1.8 }, ambient: { leaf: 40, dust: 40, bird: 0, glow: 1.1, rise: true } },
  // E22 clean late afternoon (a city the outbreak has not reached): clear air (fog far = L3 + 25 m), saturated warm-neutral sun, polar 1.2 rad (between L3 and the L5 sunset).
  L4: { sun: '#ffe0ae', intensity: 1.3, polar: 1.2, azimuth: -0.85, shadow: '#636081', sky: '#b4d1df', fog: '#dbd1c1', fogNear: 62, fogFar: 165, practical: .12,
    look: { skyAmbient: '#b5cde4', groundAmbient: '#d2b58d', bounce: '#ad9b70', vignette: .08, bloomStrength: .2, gradeShadow: '#b0c4f0', gradeHighlight: '#fff3df', gradeAmount: .7, gradeContrast: 1.1, gradeSaturation: 1.2, haze: '#cfe4f6', hazeAmount: .14, cloudShadow: .45, cloudScale: 12 }, ambient: { leaf: 10, dust: 40, bird: 3, glow: 1.3 } },
  golden,
  // E23 sunset (PO: dark red, orange, increasingly gloomy): the sun sits on the horizon (polar 1.48 rad, hue ~19 deg) at 0.65x L4 (the low sun leaves roofs and ground in core shadow, so the shadow tint is bright: dusky rose beneath the ash, never black) and the level fades it further (gloom ramp); red-to-violet sky, long shadows, fires carry the image.
  L5: { sun: '#ff7a38', intensity: 0.85, polar: 1.48, azimuth: -1.4, shadow: '#6e536e', sky: '#514366', fog: '#a76762', fogNear: 34, fogFar: 105, practical: .8, rim: .25, aura: .25,
    look: { skyAmbient: '#a9a4c3', groundAmbient: '#bb7965', vignette: .1, bloomStrength: .2, gradeShadow: '#7e7a88', gradeHighlight: '#ff9a60', gradeAmount: .9, gradeContrast: 1.14, gradeSaturation: .55, haze: '#8a8282', hazeAmount: .45, hazeHeight: 8, leaf: '#a49c9b', petal: '#77706f', dust: '#ff9a52' }, ambient: { leaf: 70, dust: 24, bird: 0, glow: 2.4, rise: true } },
  "L6-subway": { sun: "#9fb4ff", intensity: 0, polar: 1.55, azimuth: 2.2, shadow: "#252830", sky: "#0c1016", fog: "#181d25", fogNear: 30, fogFar: 85, practical: 1, rim: .25, aura: 1.3,
    look: { skyAmbient: '#8fabc2', groundAmbient: '#8a8077', vignette: .08, bloomStrength: .16, gradeShadow: '#4e6676', gradeHighlight: '#ffa640', gradeAmount: .85, gradeContrast: 1.1, gradeSaturation: .9, haze: '#26282c', hazeAmount: .28, beamStrength: 2.6, dust: '#dcc79a' }, ambient: { leaf: 0, dust: 30, bird: 0, glow: 1.5 } },
  // Shared Northgate air keeps the L6 exit -> L7 handover continuous; W6 fires/ash supply the ruined-city contrast.
  L6: { sun: '#9fb4ff', intensity: 0.38, polar: 1.55, azimuth: 2.2, shadow: '#39365f', sky: '#1b263f', fog: '#4b5268', fogNear: 45, fogFar: 120, practical: 1, rim: .4, aura: .45, heroFill: .8, heroRim: .22,
    look: { skyAmbient: '#99adc9', groundAmbient: '#8e7c83', vignette: .1, bloomStrength: .2, gradeShadow: '#7a6080', gradeHighlight: '#ffa060', gradeAmount: .75, gradeContrast: 1.12, gradeSaturation: .95, haze: '#a0503a', hazeAmount: .45, hazeHeight: 12, beamStrength: 2, dust: '#ff8638' }, ambient: { leaf: 0, dust: 80, bird: 0, glow: 3, rise: true } },
  /** Open crossing: retain the journey's moonlight, with air clear enough for 150 m sight lines. `roadLift`: E31-AC16 night route read (the asphalt road is a pale moonlit band, 3:1 against the verge). */
  'L9-crossing': { sun: '#c6d3f2', intensity: .6, polar: 1.12, azimuth: 3.0, shadow: '#141a2c', sky: '#0d1727', fog: '#2b3c52', fogNear: 200, fogFar: 1400, practical: 1, rim: .4, aura: .45, heroFill: 1.2, roadLift: 1.2, roadColor: '#bbbdc0', headlightBeams: true,   // world-fill (PO #34 "pale purple road ribbon"): a dimmer, neutral lift (AC16 re-measured)
    // E31 art addendum: a low moon (~26 deg) in the north (screen upper right), so trees/poles/fences throw long soft
    // shadows south across the east-west lanes (screen lower left, clear of the casters' own silhouettes); the ground takes the moon fully (coreLightEdge), only turned-away walls
    // fall into core shade. The burning city glows warm from the east (glow*), growing as the route nears it.
    // look-l9b (PO 10-19: "washed-out pale lilac haze, no night contrast"): a dark base with a silver key, deep blue shadows and a
    // contrasty grade; the pools (headlights, lanterns, flares, fires) and the burning-city glow carry the frame.
    look: { skyAmbient: '#7f98b8', groundAmbient: '#55505a', vignette: .1, bloomStrength: .5, gradeShadow: '#22355e', gradeHighlight: '#d6e2f2', gradeAmount: .55, gradeContrast: 1.12, gradeSaturation: .8, haze: '#56708c', hazeAmount: 0, hazeHeight: 5, leaf: '#7b838d', petal: '#5f6670', dust: '#d6ff8c', groundBreakup: .4, roadNeutral: .85,
      // l9-night-look (QA 13j: "an empty black void around the APC"): a softer grade (contrast 1.34 -> 1.12, amount .75 -> .55)
      // stops crushing the verges to black, bloom .5 gives the flares/fires a halo, stronger breakup gives the open ground texture, a brighter moon (.38 -> .6) and city glow lift the silhouettes.
      // All uniforms: no new shader graph.
      coreLightEdge: .45, shadowRadius: 3, glow: '#ff3a10', glowAmount: .4, glowStart: -60, glowEnd: 640, glowDirX: 1, glowDirZ: 0, beamStrength: 1.4 },
    ambient: { leaf: 24, dust: 70, bird: 0, glow: 3.2 } },
  /** L10 night run (E32): the L9 moonlight with a darker shadow tint (dark verges), a brighter horizon haze for building silhouettes and the asphalt `roadLift`, so R1-R6 read at 3:1 (E31-AC16) while the night stays night. */
  // look-l9b recipe (orchestrator 10-20: "pale purple road fills a third of every frame, lane stripes glow"): dark moonlit base,
  // neutral grey asphalt (roadNeutral) with a silver lift sized by the AC16 numbers, deep-blue grade, warm practicals carry the frame.
  'L10-night': { sun: '#c6d3f2', intensity: .38, polar: 1.02, azimuth: 2.35, shadow: '#141a2c', sky: '#0d1727', fog: '#2b3c52', fogNear: 200, fogFar: 1400, practical: 1, rim: .4, aura: .45, roadLift: 1.6, roadColor: '#bbbdc0',   // world-fill: same luminance as #aebfd3, no blue-lilac cast (R3 has no AC16 headroom for a darker lift)
    // gradeHighlight one step off L9's (#d6e2f2): the merged look-l10b/road-life preset had the same grade signature as L9 (@E25 atmosphere 2).
    look: { skyAmbient: '#7f98b8', groundAmbient: '#55505a', vignette: .16, bloomStrength: .3, gradeShadow: '#22355e', gradeHighlight: '#d4e0f0', gradeAmount: .75, gradeContrast: 1.34, gradeSaturation: .8, haze: '#48527c', hazeAmount: 0, beamStrength: 2.4, dust: '#c8d8ff', leaf: '#7b838d', petal: '#5f6670', groundBreakup: .22, roadNeutral: .85 }, ambient: { leaf: 30, dust: 40, bird: 0, glow: 1.6 } },
  /** E30 intact zoo at night: cool moonlight, powered warm practicals; no mandatory blackout. */
  "L8-zoo": { sun: '#afc5ed', intensity: .38, polar: 1.55, azimuth: 2.2, shadow: '#343e57', sky: '#182f3b', fog: '#36505c', fogNear: 45, fogFar: 120, practical: 1, rim: .4, aura: .45, heroFill: .8, lampInsects: true,
    look: { skyAmbient: '#9dbfce', groundAmbient: '#8d987c', vignette: .08, bloomStrength: .2, gradeShadow: '#3f7f86', gradeHighlight: '#ffd88a', gradeAmount: .75, gradeContrast: 1.05, gradeSaturation: 1.12, haze: '#3a6e58', hazeAmount: .42, hazeHeight: 4, beamStrength: 2.6, dust: '#c6ff66' }, ambient: { leaf: 0, dust: 45, bird: 0, glow: 3 } },
  /** Night segments without fires (L4 blackout blocks, scripted night beats): moonlight only, practicals carry the scene. */
  night: { sun: '#8fa6ff', intensity: 0.2, polar: 0.7, azimuth: 2.4, shadow: '#2f2d55', sky: '#141c33', fog: '#26304d', fogNear: 42, fogFar: 115, practical: 1, rim: .45, aura: .5 },
} satisfies Record<string, TimeOfDayPreset>;
export type TimeOfDay = keyof typeof presets;
export const timeOfDay: Record<TimeOfDay, TimeOfDayPreset> = presets;
