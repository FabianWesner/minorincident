export const statuses = ['placeholder', 'reference', 'upscaled', 'scripted', 'modeled', 'integrated', 'final'] as const;
export type AssetStatus = typeof statuses[number];
export type AssetQuality = 'high' | 'low' | 'lod0' | 'lod1' | 'lod2';
export interface AssetDef {
  id: string;
  /** District code placeholder palette and collision ownership. */
  world?: { token: import("../data/palette").PaletteToken; solid: boolean };
  category: 'vehicle' | 'character' | 'infected' | 'weapon' | 'prop' | 'building' | 'tile' | 'fx' | 'ui';
  status: AssetStatus;
  tier: 'hero' | 'side' | 'distant';
  script?: string;
  glb: string;
  /** Existing standalone exports are inspected without rebuilding their scripts. */
  sourceGlb?: string;
  lods?: { lod1?: string; lod2?: string };
  dimensions: { x: number; y: number; z: number; tolerance: number };
  forward: '+X';
  /** Forward in the standalone export, when it has no front marker (glTF Y-up). */
  sourceForward?: '+X' | '-X' | '+Z' | '-Z';
  frontNodes: string[];
  requiredNodes: string[];
  animatedNodes: string[];
  sockets: string[];
  budget: { triangles: number; materials: number; fileKB: number; drawCalls: number };
  decayVariants: string[];
}
export function atLeast(status: AssetStatus, minimum: AssetStatus): boolean {
  return statuses.indexOf(status) >= statuses.indexOf(minimum);
}
/** Variants use the same node contract and LOD suffixes as the base asset. */
export function variantPath(path: string, decay?: string): string {
  return decay ? path.replace(/(\.lod[12])?\.glb$/, `.${decay}$1.glb`) : path;
}
