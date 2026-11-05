import manifest from "./manifest.json" with { type: 'json' };
import type { AssetDef } from "./types";
export type WorldAssetDef = AssetDef & { world: NonNullable<AssetDef["world"]> };
/** The canonical manifest remains the only source of asset dimensions and status. */
export const worldAssets: Record<string, WorldAssetDef> = Object.fromEntries(
  (manifest as AssetDef[]).filter((asset): asset is WorldAssetDef => !!asset.world).map((asset) => [asset.id, asset]),
);
/** Structural barriers use the foreground fragment cut even when a short span misses the subject sample rays. */
export const isStructuralOccluder = (id: string): boolean => /(?:fence|wall)/i.test(id);
