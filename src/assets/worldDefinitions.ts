import manifest from "./manifest.json";
import type { AssetDef } from "./types";
export type WorldAssetDef = AssetDef & { world: NonNullable<AssetDef["world"]> };
/** The canonical manifest remains the only source of asset dimensions and status. */
export const worldAssets: Record<string, WorldAssetDef> = Object.fromEntries(
  (manifest as AssetDef[]).filter((asset): asset is WorldAssetDef => !!asset.world).map((asset) => [asset.id, asset]),
);
/** Placement render id: a decay twin is `<base id>.<decay>` (the same id `assets:pack`/`assets:validate` use). */
export function placementAssetId(p: { assetId: string; decay?: string }): string { return p.decay ? `${p.assetId}.${p.decay}` : p.assetId; }
/** Splits a declared decay twin id (`bld.clinic-annex.burned`) into base and variant; null for plain ids. */
export function decayTwin(id: string): { base: string; decay: string } | null {
  const dot = id.lastIndexOf('.'), base = id.slice(0, dot), decay = id.slice(dot + 1);
  return dot > 0 && !worldAssets[id] && worldAssets[base]?.decayVariants.includes(decay) ? { base, decay } : null;
}
/** World definition of a placement id, resolving decay twins to their base (same footprint, lights and collision). */
export function worldAsset(id: string): WorldAssetDef | undefined { return worldAssets[id] ?? worldAssets[decayTwin(id)?.base ?? '']; }
