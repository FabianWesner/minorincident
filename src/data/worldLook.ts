/** M1 morning diorama art direction. Existing asset identity swatches stay authoritative. */
export const worldLook = {
  asphalt: '#736c77', sidewalk: '#cfbea8', grass: '#829948', foliage: '#789c4c',
  grassRoot: '#718946', grassTip: '#b6c678',
  sun: '#fff0d2', sunIntensity: 1.22, shadow: '#a0a6c9', sky: '#c5dae5', fog: '#d3dcda',
  bounce: '#9aa362', skyAmbient: '#b8c8e5', groundAmbient: '#c3a576',
  leaf: '#cf9250', petal: '#efb4a8', dust: '#fff0ca', bird: '#514657',
  dofStart: .2, dofEnd: .5, dofAmount: .003, vignette: .12,
  dofRepeats: 8, bloomStrength: .25, bloomRadius: 0, bloomThreshold: 1,
  bounceStrength: .35, ambientStrength: .08, shadowIntensity: 1, hemisphereIntensity: .5,
  coreLightEdge: .8, coreShadowEdge: -.25, saturation: .965,
  sunPolar: .78, sunAzimuth: -.7, shadowBias: -.0005, shadowNormalBias: .04, shadowRadius: 3,
  fogA: '#d3dcda', fogB: '#d3dcda', fogRatioA: .2, fogRatioB: .7, fogNear: 65, fogFar: 170,
  grassDensity: 28, grassDensityLow: 5, grassHeight: .41,
  foliageDensity: 1, foliageHeight: 1, foliageDark: '#4a7533', foliageLight: '#98b94f', windStrength: 1,
} as const;
export type WorldLook = { -readonly [K in keyof typeof worldLook]: typeof worldLook[K] extends number ? number : string };
