/** L1 golden-morning palette sheet (quality plan §5.6, D1/D2). Figure identity swatches stay authoritative. */
export const worldLook = {
  asphalt: '#826e74', sidewalk: '#d9b99a', grass: '#899344', foliage: '#7f9a3c',
  grassRoot: '#5f6b2e', grassTip: '#c9b65a', foliageDark: '#596c3c', foliageLight: '#a8b860', blossomPeach: '#f4a99a', blossomPink: '#e7779a',
  sun: '#ffd9b0', sunIntensity: 1.22, shadow: '#6b4fc2', sky: '#f2c7a5', fog: '#c7a2c9',
  bounce: '#a29260', skyAmbient: '#b8c8e5', groundAmbient: '#c3a576',
  leaf: '#cf9250', petal: '#efb4a8', dust: '#fff0ca', bird: '#514657',
  dofStart: .2, dofEnd: .5, dofAmount: .003, vignette: .12,
  dofRepeats: 18, dofRepeatsLow: 6, bloomStrength: .25, bloomRadius: 0, bloomThreshold: 1,
  bounceStrength: .35, ambientStrength: .08, shadowIntensity: 1, hemisphereIntensity: .5,
  coreLightEdge: 1, coreShadowEdge: -.25, saturation: 1,
  sunPolar: .78, sunAzimuth: -.7, shadowBias: -.0005, shadowNormalBias: .08, shadowRadius: 2,
  fogA: '#f2c7a5', fogB: '#c7a2c9', fogRatioA: .05, fogRatioB: .8, fogCenterX: .5, fogCenterY: .35, fogNear: 65, fogFar: 170,
  grassDensity: 28, grassDensityLow: 5, grassHeight: .41,
  foliageDensity: 1, foliageHeight: 1, windStrength: 1,
  worldSurvivorRed: '#cf6565', worldBlood: '#994d55', worldRedDark: '#994854', worldSirenRed: '#dc6974',
} as const;

/** World swatches occupy the world region of the shared texture; figure swatches use palette.json. */
export const worldPalette = {
  asphalt: worldLook.asphalt, sidewalk: worldLook.sidewalk, grass: worldLook.grass,
  foliage: worldLook.foliage, foliageDark: worldLook.foliageDark, foliageLight: worldLook.foliageLight,
  survivorRed: worldLook.worldSurvivorRed, blood: worldLook.worldBlood, redDark: worldLook.worldRedDark, sirenRed: worldLook.worldSirenRed,
  flamingoPink: worldLook.blossomPink, flamingoBlush: worldLook.blossomPeach,
} as const;

export type WorldLook = { -readonly [K in keyof typeof worldLook]: typeof worldLook[K] extends number ? number : string };

/** Live world-sheet bindings; identity swatches remain in the first texture region. */
export const worldPaletteKeys = {
  asphalt: 'asphalt', sidewalk: 'sidewalk', grass: 'grass', foliage: 'foliage', foliageDark: 'foliageDark', foliageLight: 'foliageLight',
  survivorRed: 'worldSurvivorRed', blood: 'worldBlood', redDark: 'worldRedDark', sirenRed: 'worldSirenRed', flamingoPink: 'blossomPink', flamingoBlush: 'blossomPeach',
} as const;
