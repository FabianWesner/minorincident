/** Converted variant textures keep the same runtime identity as palette variants. */
export function isCrowdVariant(asset: { id: string; status: string; category: string; textureMode?: string; crowdSkin?: boolean }, nativeAssets: ReadonlySet<string>): boolean {
  return (asset.status === 'integrated' || asset.status === 'final') && asset.category === 'infected'
    && (!asset.textureMode || asset.crowdSkin === true) && !nativeAssets.has(asset.id) && asset.id !== 'inf.corpse-poses';
}

/** Default role assets keep their asset identity; remapped brains keep their established batch identity. */
export function crowdModelKey(def: { id: string; asset: string }): string {
  return def.asset === def.id.replace(/^infected\./, 'inf.') ? def.asset : def.id;
}

export function registerCrowdModel(aliases: Map<string, string>, def: { id: string; asset: string }): string {
  const key = crowdModelKey(def);
  aliases.set(def.id, key); aliases.set(def.asset, key);
  return key;
}
