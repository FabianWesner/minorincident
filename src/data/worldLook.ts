/** L1 golden-morning palette sheet (quality plan §5.6, D1/D2). Figure identity swatches stay authoritative. */
export const worldLook = {
  asphalt: '#826e74', sidewalk: '#d9b99a', grass: '#899344', foliage: '#7f9a3c',
  grassRoot: '#5f6b2e', grassTip: '#c9b65a', foliageDark: '#596c3c', foliageLight: '#a8b860', blossomPeach: '#f4a99a', blossomPink: '#e7779a',
  sun: '#ffd9b0', sunIntensity: 1.22, shadow: '#6b4fc2', sky: '#f2c7a5', fog: '#c7a2c9',
  bounce: '#a29260', skyAmbient: '#b8c8e5', groundAmbient: '#c3a576',
  leaf: '#cf9250', petal: '#efb4a8', dust: '#fff0ca', bird: '#514657',
  dofStart: .2, dofEnd: .5, dofAmount: .003, vignette: .12,
} as const;

/** World swatches occupy the world region of the shared texture; figure swatches use palette.json. */
export const worldPalette = {
  asphalt: worldLook.asphalt, sidewalk: worldLook.sidewalk, grass: worldLook.grass,
  foliage: worldLook.foliage, foliageDark: worldLook.foliageDark, foliageLight: worldLook.foliageLight,
  survivorRed: '#cf6565', blood: '#994d55', redDark: '#994854', sirenRed: '#dc6974',
  flamingoPink: worldLook.blossomPink, flamingoBlush: worldLook.blossomPeach,
} as const;
