import type { PaletteToken } from '../data/palette';
export const statuses = ['placeholder', 'reference', 'upscaled', 'scripted', 'modeled', 'integrated', 'final'] as const;
export type AssetStatus = typeof statuses[number];
export type AssetQuality = 'high' | 'low' | 'lod0' | 'lod1' | 'lod2';
export interface AssetDef {
  /** Runtime leaf crowns in asset-local Y-up metres; layouts export these as foliage empties. */
  foliage?: { colors: [string, string]; tokens?: [PaletteToken, PaletteToken]; crowns: { position: [number, number, number]; radius: [number, number, number] }[] };
  /** E06 code icons and category-specific fallbacks use the same manifest/status gates. */
  icon?: string;
  /** Transparent ground decal image; no GLB or LOD is needed for its two-triangle quad. */
  decalTexture?: string;
  actionCategory?: 'melee' | 'ranged' | 'throwable' | 'ability';
  id: string;
  /** Alternate inventory ID sharing a canonical model and its node/LOD contract. */
  aliasOf?: string;
  /** Presentation supplied by images, UI or procedural effects rather than a GLB. */
  nonModel?: 'ui' | 'ability' | 'procedural';
  /** District code placeholder palette and collision ownership. */
  world?: { token: import("../data/palette").PaletteToken; solid: boolean };
  category: 'vehicle' | 'character' | 'infected' | 'weapon' | 'prop' | 'building' | 'tile' | 'fx' | 'ui';
  status: AssetStatus;
  tier: 'hero' | 'side' | 'distant';
  script?: string;
  glb: string;
  /** Existing standalone exports are inspected without rebuilding their scripts. */
  sourceGlb?: string;
  /** Optional E18 mobile export (<id>.low.glb); otherwise low reuses declared lod1. */
  lowGlb?: string;
  lods?: { lod1?: string; lod2?: string };
  /** Regenerate these tiers from LOD0 when supplied LODs violate size or density contracts. */
  generatedLodRatios?: { lod1?: number; lod2?: number };
  /** Reviewed authored tiers: preserve geometry/normals instead of delivery decimation. */
  authoredLodRatios?: { lod1: number; lod2: number };
  /** Reviewed distance variants: absolute caps; native vehicles/houses also have monotone file sizes. */
  authoredLodTriangles?: { lod1: number; lod2: number };
  dimensions: { x: number; y: number; z: number; tolerance: number };
  forward: '+X';
  /** Uniform metres conversion applied to the entire exported assembly once. */
  sourceScale?: number;
  /** Stronger lossless attribute compression for large scenery exports. */
  compactMeshopt?: boolean;
  /** Forward in the standalone export, when it has no front marker (glTF Y-up). */
  sourceForward?: '+X' | '-X' | '+Z' | '-Z';
  frontNodes: string[];
  requiredNodes: string[];
  animatedNodes: string[];
  sockets: string[];
  budget: { triangles: number; materials: number; fileKB: number; drawCalls: number };
  /** One-line reason for a per-asset budget override above the standard caps. */
  budgetNote?: string;
  /** LOD0 cap for authored decay exports; base hero meshes retain their own budget. */
  decayTriangleBudget?: number;
  /** Stricter delivery limits for damage siblings; unset fields inherit the integrated base budget. */
  decayBudget?: Partial<AssetDef["budget"]>;
  /** Ruin variants may be shorter (collapsed tower/cupola); footprint axes stay on the base value. */
  decayDimensions?: Partial<{ x: number; y: number; z: number }>;
  decayAuthoredLodTriangles?: { lod1: number; lod2: number };
  decayVariants: string[];
}
export function atLeast(status: AssetStatus, minimum: AssetStatus): boolean {
  return statuses.indexOf(status) >= statuses.indexOf(minimum);
}
/** Variants use the same node contract and LOD suffixes as the base asset. */
export function variantPath(path: string, decay?: string): string {
  return decay ? path.replace(/(\.lod[12])?\.glb$/, `.${decay}$1.glb`) : path;
}
