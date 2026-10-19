/**
 * PO #23 (10-19): "alphas could have different looks. At the moment they all look the same".
 * Each Alpha asset has sibling assets with the same rig, pose, height and animation set but another skin tone, outfit and
 * silhouette (hard hat, hood, helmet, coat tails, growths). The look is a pure function of the entity id, so replays and
 * checkpoints draw the same Alpha every time; the sim never reads it. Index 0 is always the original asset.
 */
export const alphaLooks: Readonly<Record<string, readonly string[]>> = {
  'inf.alpha': ['inf.alpha', 'inf.alpha-worker', 'inf.alpha-hoodie', 'inf.alpha-fire', 'inf.alpha-suit'],
  'inf.mega-alpha': ['inf.mega-alpha', 'inf.mega-alpha-ashen', 'inf.mega-alpha-ember'],
};

/** Every look asset, for warm-up lists. */
export const alphaLookAssets: readonly string[] = Object.values(alphaLooks).flat();

/** Index of the entity's look among `count` looks (murmur3 finalizer, so neighbouring small ids spread over every look). */
export function alphaLookIndex(entityId: number, count: number): number {
  let h = (entityId + 1) | 0;
  h ^= h >>> 16; h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return (h >>> 0) % count;
}

/** The look asset for an entity drawn with `asset`; any other asset is returned unchanged. */
export function alphaLook(asset: string, entityId: number): string {
  const looks = alphaLooks[asset];
  return looks ? looks[alphaLookIndex(entityId, looks.length)] : asset;
}
