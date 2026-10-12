/** Default role assets keep their asset identity; remapped brains keep their established batch identity. */
export function crowdModelKey(def: { id: string; asset: string }): string {
  return def.asset === def.id.replace(/^infected\./, 'inf.') ? def.asset : def.id;
}

export function registerCrowdModel(aliases: Map<string, string>, def: { id: string; asset: string }): string {
  const key = crowdModelKey(def);
  aliases.set(def.id, key); aliases.set(def.asset, key);
  return key;
}
