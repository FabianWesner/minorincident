import { worldLook, type WorldLook } from './worldLook';
import { palette, type PaletteToken } from './palette';

type NumericKey = { [K in keyof WorldLook]: WorldLook[K] extends number ? K : never }[keyof WorldLook];
/** Units are metres for grass height, relative placement scale for foliage height, blades/m² for grass density. */
export const lookRanges = {
  sunIntensity: [0, 4, .01], dofStart: [0, .49, .01], dofEnd: [.01, .5, .01], dofAmount: [0, .02, .0001], vignette: [0, 1, .01],
  dofRepeats: [1, 32, 1], dofRepeatsLow: [1, 16, 1], bloomStrength: [0, 2, .01], bloomRadius: [0, 1, .01], bloomThreshold: [0, 5, .01],
  bounceStrength: [0, 1, .01], ambientStrength: [0, 1, .01], shadowIntensity: [0, 1, .01], hemisphereIntensity: [0, 2, .01],
  coreLightEdge: [-1, 1, .01], coreShadowEdge: [-1, 1, .01], saturation: [0, 2, .01],
  sunPolar: [.05, 1.55, .01], sunAzimuth: [-Math.PI, Math.PI, .01], shadowBias: [-.01, .01, .0001], shadowNormalBias: [0, .3, .001], shadowRadius: [0, 8, .1],
  fogCenterX: [0, 1, .01], fogCenterY: [0, 1, .01], fogRatioA: [0, 1, .01], fogRatioB: [.01, 2, .01], fogNear: [0, 300, 1], fogFar: [1, 600, 1],
  grassDensity: [0, 28, .1], grassDensityLow: [0, 5, .1], grassHeight: [.05, .6, .01],
  foliageDensity: [0, 1, .01], foliageHeight: [.25, 2, .01], windStrength: [0, 3, .01],
} satisfies Record<NumericKey, readonly [number, number, number]>;
export interface LookPatch { version: 1; worldLook: Partial<WorldLook>; palette: Partial<Record<PaletteToken, string>> }
const hex = /^#[0-9a-f]{6}$/i;
export function validateLookPatch(input: unknown, baseline: WorldLook = worldLook): LookPatch {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Look patch must be an object');
  const patch = input as Record<string, unknown>;
  if (patch.version !== 1 || Object.keys(patch).some(key => !['version', 'worldLook', 'palette'].includes(key))) throw new Error('Unknown look patch version/field');
  const result: LookPatch = { version: 1, worldLook: {}, palette: {} };
  for (const section of ['worldLook', 'palette'] as const) {
    const values = patch[section];
    if (!values || typeof values !== 'object' || Array.isArray(values)) throw new Error(`Invalid ${section}`);
    for (const [key, value] of Object.entries(values)) {
      const defaults = section === 'worldLook' ? worldLook : palette;
      if (!Object.hasOwn(defaults, key)) throw new Error(`Unknown ${section} token: ${key}`);
      const expected = defaults[key as keyof typeof defaults];
      if (typeof expected === 'string') {
        if (typeof value !== 'string' || !hex.test(value)) throw new Error(`Invalid colour: ${key}`);
      } else {
        const [min, max] = lookRanges[key as NumericKey];
        if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max || (key === 'dofRepeats' || key === 'dofRepeatsLow') && !Number.isInteger(value)) throw new Error(`Invalid number: ${key}`);
      }
      Object.assign(result[section], { [key]: typeof value === 'string' ? value.toLowerCase() : value });
    }
  }
  const look = { ...baseline, ...result.worldLook };
  if (look.dofStart >= look.dofEnd || look.fogRatioA >= look.fogRatioB || look.fogNear >= look.fogFar || look.coreShadowEdge >= look.coreLightEdge) throw new Error('Look ranges must have ordered edges');
  return result;
}
/** Minimal JSON patch relative to checked-in values; contains no renderer state, timestamp or secrets. */
export function exportLookPatch(values: WorldLook, colours: Record<PaletteToken, string>): LookPatch {
  const changed = (live: object, defaults: object) => Object.fromEntries(Object.entries(live).filter(([key, value]) => value !== defaults[key as keyof typeof defaults]));
  return validateLookPatch({ version: 1, worldLook: changed(values, worldLook), palette: changed(colours, palette) });
}
